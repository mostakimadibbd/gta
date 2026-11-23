// Harborfall.WorldTools — desktop-side tooling for the Harborfall game.
//
// C# cannot run inside a browser client (browsers execute JS/WASM), so —
// exactly like C# tooling in Unity/Unreal pipelines — this project lives
// OUTSIDE the game: it validates the world data snapshot and inspects
// exported save files on the developer's machine.
//
//   dotnet run -- validate   [path/to/world-export.json]
//   dotnet run -- saveinspect path/to/save-export.json
//
// Requires the .NET 8 SDK (https://dotnet.microsoft.com/download).
using System.Text.Json;

if (args.Length == 0)
{
    Console.WriteLine("Harborfall.WorldTools — usage:");
    Console.WriteLine("  validate    [world-export.json]   check districts / POIs / spawns");
    Console.WriteLine("  saveinspect <save-export.json>    summarise a localStorage export");
    return 2;
}

return args[0] switch
{
    "validate" => Validate(args.Length > 1 ? args[1] : DefaultWorldPath()),
    "saveinspect" => args.Length > 1 ? SaveInspect(args[1]) : Missing("saveinspect needs a file path"),
    _ => Unknown(args[0]),
};

static string DefaultWorldPath() =>
    Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "world-export.json");

static int Missing(string msg) { Console.Error.WriteLine(msg); return 2; }
static int Unknown(string cmd) { Console.Error.WriteLine($"unknown command '{cmd}'"); return 2; }

static int Validate(string path)
{
    if (!File.Exists(path)) return Missing($"world export not found: {path}");
    using var doc = JsonDocument.Parse(File.ReadAllText(path));
    var root = doc.RootElement;
    var problems = new List<string>();
    var notes = new List<string>();

    var districts = root.GetProperty("districts").EnumerateArray()
        .Select(d => (Name: d.GetProperty("name").GetString() ?? "?",
                      X0: d.GetProperty("x0").GetDouble(), X1: d.GetProperty("x1").GetDouble(),
                      Z0: d.GetProperty("z0").GetDouble(), Z1: d.GetProperty("z1").GetDouble()))
        .ToList();
    foreach (var d in districts)
        if (d.X0 >= d.X1 || d.Z0 >= d.Z1) problems.Add($"district {d.Name}: inverted bounds");

    // district overlaps are warnings, not errors: the causeway/island
    // legitimately sit inside the main bound's z-range in places
    for (var i = 0; i < districts.Count; i++)
        for (var j = i + 1; j < districts.Count; j++)
        {
            var a = districts[i]; var b = districts[j];
            if (a.X0 < b.X1 && b.X0 < a.X1 && a.Z0 < b.Z1 && b.Z0 < a.Z1)
                notes.Add($"districts overlap: {a.Name} × {b.Name} (ok if bridged water/island)");
        }

    var blockers = root.GetProperty("blockers").EnumerateArray()
        .Select(b => (Id: b.GetProperty("id").GetString() ?? "?",
                      X: b.GetProperty("x").GetDouble(), Z: b.GetProperty("z").GetDouble(),
                      Hw: b.GetProperty("hw").GetDouble(), Hd: b.GetProperty("hd").GetDouble()))
        .ToList();

    var seen = new HashSet<string>();
    foreach (var poi in root.GetProperty("pois").EnumerateArray())
    {
        var id = poi.GetProperty("id").GetString() ?? "?";
        var x = poi.GetProperty("x").GetDouble(); var z = poi.GetProperty("z").GetDouble();
        if (!seen.Add(id)) problems.Add($"duplicate POI id: {id}");
        if (!districts.Any(d => x >= d.X0 && x <= d.X1 && z >= d.Z0 && z <= d.Z1))
            problems.Add($"POI {id} ({x},{z}) lies outside every district");
        foreach (var b in blockers)
            if (Math.Abs(x - b.X) < b.Hw && Math.Abs(z - b.Z) < b.Hd)
                problems.Add($"POI {id} is inside blocker {b.Id}");
    }
    foreach (var car in root.GetProperty("carSpawns").EnumerateArray())
    {
        var id = car.GetProperty("id").GetInt32();
        var x = car.GetProperty("x").GetDouble(); var z = car.GetProperty("z").GetDouble();
        foreach (var b in blockers)
            if (Math.Abs(x - b.X) < b.Hw + 1.6 && Math.Abs(z - b.Z) < b.Hd + 1.6)
                problems.Add($"car spawn {id} intersects blocker {b.Id}");
    }

    Console.WriteLine($"World export: {path}");
    Console.WriteLine($"  districts: {districts.Count}, POIs: {seen.Count}, blockers: {blockers.Count}");
    foreach (var n in notes) Console.WriteLine($"  note: {n}");
    foreach (var p in problems) Console.WriteLine($"  PROBLEM: {p}");
    Console.WriteLine(problems.Count == 0 ? "VALIDATE: PASS" : $"VALIDATE: {problems.Count} problem(s)");
    return problems.Count == 0 ? 0 : 1;
}

static int SaveInspect(string path)
{
    if (!File.Exists(path)) return Missing($"save export not found: {path}");
    using var doc = JsonDocument.Parse(File.ReadAllText(path));
    // accepted shapes: a flat { "harborfall-x": "<json string>", ... }
    // map (raw localStorage dump) or { "localStorage": { ...same... } }
    var root = doc.RootElement;
    if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("localStorage", out var inner))
        root = inner;

    string? Get(string key) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() : null;

    Console.WriteLine($"Harborfall save export: {path}");
    if (Get("harborfall-eco") is { } ecoRaw && JsonDocument.Parse(ecoRaw).RootElement is var eco)
    {
        var owned = eco.TryGetProperty("owned", out var o) ? o.GetArrayLength() : 0;
        var apt = eco.TryGetProperty("ownsApartment", out var a) && a.ValueKind == JsonValueKind.True;
        var day = eco.TryGetProperty("daySerial", out var d) ? d.GetInt32() : 0;
        Console.WriteLine($"  Economy: day {day}, {owned} business(es), apartment {(apt ? "owned" : "not owned")}");
    }
    if (Get("harborfall-stored-cars") is { } carsRaw)
        Console.WriteLine($"  Garage: {JsonDocument.Parse(carsRaw).RootElement.GetArrayLength()} stored car(s)");
    if (Get("harborfall-skills") is { } skillsRaw && JsonDocument.Parse(skillsRaw).RootElement is var sk)
    {
        var parts = new List<string>();
        foreach (var p in sk.EnumerateObject()) parts.Add($"{p.Name} {p.Value.GetDouble():0}");
        Console.WriteLine($"  Skills: {string.Join(" · ", parts)}");
    }
    if (Get("harborfall-invest") is { } invRaw && JsonDocument.Parse(invRaw).RootElement is var inv
        && inv.TryGetProperty("shares", out var shares))
    {
        var held = shares.EnumerateObject().Where(p => p.Value.GetDouble() > 0)
            .Select(p => $"{p.Name} ×{p.Value.GetDouble():0.0}").ToList();
        Console.WriteLine(held.Count > 0 ? $"  Portfolio: {string.Join(" · ", held)}" : "  Portfolio: empty");
    }
    if (Get("harborfall-jobstats") is { } jobsRaw && JsonDocument.Parse(jobsRaw).RootElement is var js)
    {
        long Sum(params string[] keys) => keys.Sum(k => js.TryGetProperty(k, out var v) ? v.GetInt64() : 0);
        Console.WriteLine($"  Work: taxi ${Sum("taxiEarned")} · deliveries ${Sum("deliveryEarned")} · tow ${Sum("towEarned")} · fish ${Sum("fishEarned")}");
    }
    Console.WriteLine("SAVEINSPECT: done (cash + story progress live in the game state, not localStorage — see README)");
    return 0;
}
