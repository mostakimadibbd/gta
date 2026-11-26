// Harborfall — Phase 44: the HUD palette (colourblind-safe HUD).
//
// ONE module owns every HUD colour that CARRIES MEANING, so the
// Colourblind-safe HUD setting (Phone → Settings → Assists &
// accessibility) is a palette swap, not a scatter of conditionals
// through the HUD code:
//
//   · the minimap / big-map canvas (App.tsx drawMap) reads
//     hudCanvasPalette(theme.minimap) for its blips — police,
//     mission objective, job target + GPS line, your-car rings,
//     the player arrow, traffic dots, the dispatch incident cross.
//   · the DOM HUD reads hudDomPalette() for its accents — wanted
//     stars, the heat chip, money figures (Bank +$/day, loan owed,
//     debrief reward) and the Bank's business-event badges.
//
// With the setting OFF, the canvas palette returns today's colours
// EXACTLY (the theme's own minimap colours plus the literals the
// map has always used) and the DOM palette returns nulls — "no
// inline style, CSS as shipped" — so default play is pixel-for-
// pixel the pre-Phase-44 HUD.
//
// With it ON, the swaps follow the Okabe–Ito colourblind-safe
// palette (designed to stay separable under red-green colour
// vision deficiency): police become SKY BLUE (and the wanted
// stars take the same blue, tying the HUD to the map), targets go
// YELLOW, your car and you go WHITE (shape + lightness carry it),
// traffic goes ORANGE, the incident cross goes VERMILLION, and
// money reads gain = BLUISH GREEN / loss = VERMILLION — always in
// ADDITION to the +/− signs the figures already carry, never
// instead of them. (In standard mode money meaning is carried by
// the sign alone; no green/red money coding exists to swap.)
//
// SCOPE, stated plainly: this is HUD-only. The world's teal/amber
// art, the vehicle liveries, the tram/bus map lines and the
// personal themes' scenery colours do not change — only the
// colours listed above, which are the ones a player must READ.
import { G } from "./store";

/** The theme minimap colours the canvas palette builds on. */
export interface MiniColours { police: string; marker: string; player: string; car: string; }

export interface HudCanvasPalette {
  police: string;    // cop dots
  objective: string; // mission objective dot
  job: string;       // job target dot + GPS route line
  yours: string;     // your-car rings + labels (fleet / last car)
  player: string;    // the player arrow
  car: string;       // traffic + loose-car dots
  incident: string;  // dispatch incident cross
}

/** Canvas palette for the minimap / big map. `mm` is the active
 * personal theme's minimap set — with the setting off the result
 * IS the current behaviour (theme colours + the map's standing
 * literals), so themes keep owning their map look by default. */
export function hudCanvasPalette(mm: MiniColours): HudCanvasPalette {
  if (!G.settings.colorblindHud) {
    return {
      police: mm.police, objective: mm.marker, job: "#ffb340", yours: "#ffb340",
      player: mm.player, car: mm.car, incident: "#e23232",
    };
  }
  return {
    police: "#56b4e9", objective: "#f0e442", job: "#f0e442", yours: "#ffffff",
    player: "#ffffff", car: "#e69f00", incident: "#d55e00",
  };
}

export interface HudDomPalette {
  /** Wanted-star accent — null = the shipped CSS colour. */
  star: string | null;
  /** Heat-chip border/text accent — null = the shipped CSS. */
  heat: string | null;
  /** Money gained (Bank +$/day figures, debrief reward). */
  gain: string | null;
  /** Money owed / lost (loan figure, fines). */
  loss: string | null;
  /** Bank business-event badge, good day (rush / star / fixed / passed). */
  eventGood: string | null;
  /** Bank business-event badge, bad day (quiet / snag / failed). */
  eventBad: string | null;
}

/** DOM accents. Every field is null with the setting off — callers
 * apply `style={pal.x ? { color: pal.x } : undefined}`, so the
 * default HUD keeps its exact shipped CSS. */
export function hudDomPalette(): HudDomPalette {
  if (!G.settings.colorblindHud) {
    return { star: null, heat: null, gain: null, loss: null, eventGood: null, eventBad: null };
  }
  return {
    star: "#56b4e9", heat: "#e69f00",
    gain: "#009e73", loss: "#d55e00",
    eventGood: "#009e73", eventBad: "#d55e00",
  };
}
