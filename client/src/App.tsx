import { Suspense, useCallback, useEffect, useRef, useState, type ComponentRef, type FormEvent, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Collectibles from "./components/Collectibles";
import GameSystems, { type SysCallbacks } from "./components/GameSystems";
import TouchControls from "./components/TouchControls";
import { Multiplayer, type NetworkState, type RemotePlayer } from "./components/Multiplayer";
import Player from "./components/Player";
import Vehicle from "./components/Vehicle";
import World from "./components/World";
import { isInteractiveTarget } from "./keyboard";
import { fallbackPhysics, loadPhysicsEngine, type PhysicsEngine, type VehicleState } from "./physics/GamePhysics";
import { G, resetAfterArrest, resetAfterWasted } from "./game/store";
import { M, startPlay, endMission } from "./game/missionState";
import { STORY_MISSIONS, REPEATABLE, INTRO_PANELS, ENDING_PANEL, type DialogueLine, type MissionDef } from "./game/missions";
import { THEMES, loadTheme, saveTheme, type GameTheme } from "./themes";
import { ROAD_COORDS, FUEL_STATIONS, districtAt } from "./world";
import Weather from "./components/Weather";
import { POSTER_PANELS } from "./posterData";
import Phone from "./components/Phone";
import { WEATHER_META, cycleWeather } from "./game/weather";
import { audioTick, initAudio, sfx, startMenuTheme, stopMenuTheme, toggleMute } from "./game/audio";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Environment reflections (PMREM RoomEnvironment): the single biggest
// "not cartoon" upgrade — car paint, glass towers and wet roads pick up
// real reflections. Moderate intensity keeps the dusk grade in charge.
function EnvSetup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.5;
    return () => { scene.environment = null; rt.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

const initialRoom = import.meta.env.VITE_MULTIPLAYER_ROOM || "downtown";
const tmpV = new THREE.Vector3();

function CameraRig({ target, camFar }: { target: RefObject<THREE.Vector3>; camFar: RefObject<boolean> }) {
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (!controls.current || !target.current) return;
    tmpV.copy(target.current); tmpV.y += 1.1;
    controls.current.target.lerp(tmpV, 1 - Math.exp(-5 * delta));
    controls.current.maxDistance = camFar.current ? 26 : 15;
    const cam = camera as THREE.PerspectiveCamera;
    const targetFov = 58 + Math.min(14, G.speedKph / 9);
    if (Math.abs(cam.fov - targetFov) > 0.4) { cam.fov += (targetFov - cam.fov) * 0.08; cam.updateProjectionMatrix(); }
    controls.current.update();
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={4} maxDistance={18} maxPolarAngle={Math.PI / 2.05} />;
}
function RemoteAvatar({ player }: { player: RemotePlayer }) {
  const root = useRef<THREE.Group>(null);
  const state = player.state;
  useFrame((_, delta) => {
    if (!root.current || !state) return;
    const position = state.car?.position ?? state.position;
    root.current.position.lerp(tmpV.set(...position), 1 - Math.exp(-12 * delta));
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, state.car?.rotation[1] ?? state.rotation[1], 12, delta);
  });
  if (!state) return null;
  return (
    <group ref={root} position={state.car?.position ?? state.position}>
      {state.car ? (
        <group><mesh position={[0, 0.62, 0]} castShadow><boxGeometry args={[2, 0.62, 3.5]} /><meshStandardMaterial color="#6e72cc" flatShading /></mesh>
        <mesh position={[0, 1.12, -0.12]} castShadow><boxGeometry args={[1.48, 0.55, 1.72]} /><meshStandardMaterial color="#9ed3df" /></mesh></group>
      ) : (
        <group position={[0, 0.86, 0]}><mesh castShadow><capsuleGeometry args={[0.34, 0.72, 4, 6]} /><meshStandardMaterial color="#6e72cc" flatShading /></mesh>
        <mesh position={[0, 0.64, 0]} castShadow><icosahedronGeometry args={[0.27, 1]} /><meshStandardMaterial color="#d5a77b" flatShading /></mesh></group>
      )}
    </group>
  );
}

interface HudSnap { cash: number; health: number; wanted: number; speed: number; tokens: number; objective: string; dist: number; timer: number; chapter: string; district: string; driving: boolean; bust: number; status: string; storyDone: boolean; weather: string; weatherIcon: string; fuel: number; damage: number; }
const initialHud: HudSnap = { cash: G.cash, health: 100, wanted: 0, speed: 0, tokens: 0, objective: "", dist: 0, timer: 0, chapter: "", district: "The Docks", driving: false, bust: 0, status: "", storyDone: false, weather: "Clear", weatherIcon: "☀️", fuel: 100, damage: 0 };

const LOAD_TIPS = [
  "Press E to enter a car — F works too.",
  "Lose the cops by breaking line of sight, then stay hidden while they search.",
  "T changes your personal theme. Keys 1–5 jump straight to one.",
  "Watch the fuel gauge — pumps at the Docks, Ferry Quarter and East Yards refill for cash.",
  "U opens your phone: contacts, messages, SableBank, music and themes.",
  "Y forces the weather to change. Storms over the bay are… dramatic.",
  "Rayan came home to free his brother Tamim from Solano's ledger. Six chapters.",
  "Smash a car past 60% damage and it smokes; at 100% it's a wreck. Walk away.",
  "Hold L to freeze the day cycle at golden hour.",
  "Harbour tokens hide around the city — each one is worth $25.",
];
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => { if (!done.current) { done.current = true; onReady(); } });
  return null;
}

export default function App() {
  const playerPositionRef = useRef(G.playerPos);
  const followRef = useRef<THREE.Vector3>(G.followPos);
  const playerRotationRef = useRef(new THREE.Vector3());
  const vehiclePositionRef = useRef(new THREE.Vector3(3, 0, 106));
  const vehicleStateRef = useRef<VehicleState>({ x: 3, z: 106, heading: Math.PI, speed: 0 });
  const physicsRef = useRef<PhysicsEngine>(fallbackPhysics);
  const tokenCountRef = useRef(0);
  const camFar = useRef(false);
  const [driving, setDriving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [nearVehicle, setNearVehicle] = useState(false);
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const [networkStatus, setNetworkStatus] = useState("Offline");
  const [roomName, setRoomName] = useState(initialRoom);
  const [activeRoom, setActiveRoom] = useState("");
  const [physicsSource, setPhysicsSource] = useState<"typescript" | "wasm">("typescript");
  const [theme, setTheme] = useState<GameTheme>(loadTheme);
  const [started, setStarted] = useState(false);
  const [introIdx, setIntroIdx] = useState(-1);
  const [dialogue, setDialogue] = useState<{ lines: DialogueLine[]; idx: number; after: () => void } | null>(null);
  const [hud, setHud] = useState<HudSnap>(initialHud);
  const [popup, setPopup] = useState("");
  const [banner, setBanner] = useState<{ text: string; ok: boolean } | null>(null);
  const [bigMap, setBigMap] = useState(false);
  const [muted, setMuted] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [starPulse, setStarPulse] = useState(false);
  const [ending, setEnding] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [minWait, setMinWait] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);
  const [posterIdx, setPosterIdx] = useState(0);
  const [showHow, setShowHow] = useState(false);
  const [nightBucket, setNightBucket] = useState(0);
  const lastToastAt = useRef(0);
  const multiplayerRef = useRef<Multiplayer | null>(null);
  const serverUrl = import.meta.env.VITE_MULTIPLAYER_SERVER_URL;
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const bigmapRef = useRef<HTMLCanvasElement>(null);
  const prevHud = useRef({ health: 100, wanted: 0 });
  const dialogueRef = useRef(dialogue); dialogueRef.current = dialogue;
  const sysCb = useRef<SysCallbacks>(null as unknown as SysCallbacks);

  const applyTheme = useCallback((t: GameTheme) => {
    setTheme(t); saveTheme(t.id);
    const root = document.documentElement;
    root.dataset.theme = t.id;
    for (const [k, v] of Object.entries(t.css)) root.style.setProperty(k, v);
  }, []);
  useEffect(() => { applyTheme(theme); /* initial CSS vars */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPopup = useCallback((text: string) => { setPopup(text); window.setTimeout(() => setPopup((p) => (p === text ? "" : p)), 2200); }, []);
  const showBanner = useCallback((text: string, ok: boolean) => { setBanner({ text, ok }); window.setTimeout(() => setBanner(null), 4200); }, []);

  const beginDialogue = useCallback((lines: DialogueLine[], after: () => void) => {
    if (!lines.length) { after(); return; }
    G.dialogueActive = true;
    setDialogue({ lines, idx: 0, after });
  }, []);
  const advanceDialogue = useCallback(() => {
    const d = dialogueRef.current; if (!d) return;
    sfx.dialogue();
    if (d.idx < d.lines.length - 1) setDialogue({ ...d, idx: d.idx + 1 });
    else { setDialogue(null); G.dialogueActive = false; d.after(); }
  }, []);

  const startMission = useCallback((def: MissionDef) => {
    endMission(); M.phase = "intro";
    beginDialogue(def.intro, () => { startPlay(def); showBanner(`${def.title} — ${def.giver}`, true); });
  }, [beginDialogue, showBanner]);

  sysCb.current = {
    dialogue: beginDialogue,
    popup: showPopup,
    banner: showBanner,
    storyFinished: () => setEnding(true),
    event: (name) => {
      if (name === "shake") { setShake(true); window.setTimeout(() => setShake(false), 320); }
      if (name === "crime") multiplayerRef.current?.sendEvent("crime", { wanted: G.wanted });
      if (name === "missionEnd") multiplayerRef.current?.sendEvent("mission", { storyIndex: M.storyIndex, cash: G.cash });
    },
  };

  const respawn = useCallback(() => {
    if (G.status === "busted") resetAfterArrest(150 + G.wanted * 50);
    else resetAfterWasted();
    G.status = ""; playerPositionRef.current.copy(G.playerPos);
  }, []);
  const respawnRef = useRef(respawn); respawnRef.current = respawn;
  const startMissionRef = useRef(startMission); startMissionRef.current = startMission;

  // multiplayer connect (optional; game is fully playable offline)
  const connectToRoom = useCallback((room: string) => {
    if (!serverUrl) { setNetworkStatus("Set VITE_MULTIPLAYER_SERVER_URL to enable multiplayer."); return; }
    multiplayerRef.current?.disconnect(); setPlayers([]); setActiveRoom(room);
    const mp = new Multiplayer(setPlayers, setNetworkStatus);
    multiplayerRef.current = mp; mp.connect(serverUrl, room);
  }, [serverUrl]);
  useEffect(() => {
    if (!serverUrl) { setNetworkStatus("Offline — single-player. Set VITE_MULTIPLAYER_SERVER_URL to join a room."); return; }
    connectToRoom(initialRoom);
    return () => { multiplayerRef.current?.disconnect(); multiplayerRef.current = null; };
  }, [connectToRoom, serverUrl]);
  useEffect(() => { let m = true; void loadPhysicsEngine().then((e) => { if (m) { physicsRef.current = e; setPhysicsSource(e.source); } }); return () => { m = false; }; }, []);

  // network state sender
  useEffect(() => {
    const id = window.setInterval(() => {
      const v = vehicleStateRef.current;
      const state: NetworkState = {
        position: [G.playerPos.x, G.playerPos.y, G.playerPos.z],
        rotation: [playerRotationRef.current.x, playerRotationRef.current.y, playerRotationRef.current.z],
        car: G.driving ? { position: [v.x, 0, v.z], rotation: [0, v.heading, 0] } : null,
      };
      multiplayerRef.current?.sendState(state);
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  // HUD poll ~8Hz + minimap + audio tick
  useEffect(() => {
    const drawMap = (cv: HTMLCanvasElement | null, size: number) => {
      if (!cv) return;
      const g = cv.getContext("2d"); if (!g) return;
      const mm = theme.minimap; const S = size / 260;
      g.fillStyle = mm.bg; g.fillRect(0, 0, size, size);
      g.strokeStyle = mm.road; g.lineWidth = 5 * S;
      for (const c of ROAD_COORDS) {
        g.beginPath(); g.moveTo((c + 130) * S, 0); g.lineTo((c + 130) * S, size); g.stroke();
        g.beginPath(); g.moveTo(0, (c + 130) * S); g.lineTo(size, (c + 130) * S); g.stroke();
      }
      g.fillStyle = "#3b82c4"; g.fillRect(0, (128 + 130) * S - 3, size, 5 * S); // water edge
      const dot = (x: number, z: number, col: string, r: number) => { g.fillStyle = col; g.beginPath(); g.arc((x + 130) * S, (z + 130) * S, r * S, 0, 7); g.fill(); };
      for (const st of FUEL_STATIONS) dot(st.x, st.z, "#ffb703", 3); // fuel pumps
      for (const c of G.cars) dot(c.state.x, c.state.z, mm.car, 2.4);
      for (const c of G.traffic) dot(c.x, c.z, mm.car, 2);
      for (const c of G.cops) if (c.active) dot(c.x, c.z, mm.police, 3.4);
      if (G.objective && M.phase === "play") dot(G.objective.x, G.objective.z, mm.marker, 4);
      // player arrow
      const px = (G.followPos.x + 130) * S, pz = (G.followPos.z + 130) * S;
      const h = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.heading : playerRotationRef.current.y;
      g.save(); g.translate(px, pz); g.rotate(h); g.fillStyle = mm.player;
      g.beginPath(); g.moveTo(0, -6 * S); g.lineTo(4 * S, 5 * S); g.lineTo(-4 * S, 5 * S); g.closePath(); g.fill(); g.restore();
    };
    const id = window.setInterval(() => {
      const px = G.followPos.x, pz = G.followPos.z;
      const o = G.objective;
      const myCar = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
      setHud({
        cash: G.cash, health: Math.round(G.health), wanted: G.wanted, speed: G.speedKph, tokens: tokenCountRef.current,
        objective: M.active && M.phase === "play" ? M.active.objectiveText : M.active ? M.active.title : "",
        dist: o && M.phase === "play" ? Math.round(Math.hypot(o.x - px, o.z - pz)) : 0,
        timer: Math.max(0, Math.ceil(M.timer)),
        chapter: M.storyDone ? "Story complete — free roam" : `Chapter ${Math.min(6, M.storyIndex + 1)}: ${STORY_MISSIONS[Math.min(5, M.storyIndex)]?.title ?? ""}`,
        district: districtAt(px, pz), driving: G.driving, bust: G.bustTimer, status: G.status, storyDone: M.storyDone,
        weather: G.weather, weatherIcon: WEATHER_META[G.weather].icon,
        fuel: myCar ? Math.round(myCar.fuel) : 100, damage: myCar ? Math.round(myCar.damage) : 0,
      });
      if (G.toastAt !== lastToastAt.current) { lastToastAt.current = G.toastAt; if (G.toast) showPopup(G.toast); }
      if (G.health < prevHud.current.health) { setFlash(true); window.setTimeout(() => setFlash(false), 350); }
      if (G.wanted > prevHud.current.wanted) { setStarPulse(true); window.setTimeout(() => setStarPulse(false), 900); }
      prevHud.current = { health: G.health, wanted: G.wanted };
      setNightBucket(Math.round(G.nightFactor * 4) / 4);
      drawMap(minimapRef.current, 148);
      if (bigMap) drawMap(bigmapRef.current, 520);
      audioTick(G.driving, G.speedKph, G.wanted);
      if (G.status) { /* overlay visible via hud.status */ }
    }, 125);
    return () => window.clearInterval(id);
  }, [theme, bigMap]);

  // global shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      initAudio();
      if (isInteractiveTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (dialogueRef.current) {
        if (key === "e" || key === "enter" || key === " ") { e.preventDefault(); advanceDialogue(); }
        return;
      }
      if (key === "escape" || key === "p") { if (showHelp) setShowHelp(false); else setPaused((v) => !v); }
      else if (key === "?" || key === "h") { e.preventDefault(); setShowHelp((v) => !v); }
      else if (key === "t") { const i = THEMES.findIndex((t) => t.id === theme.id); applyTheme(THEMES[(i + 1) % THEMES.length]); showPopup(`Theme: ${THEMES[(i + 1) % THEMES.length].name}`); }
      else if (["1", "2", "3", "4", "5"].includes(key)) { const t = THEMES[Number(key) - 1]; if (t) { applyTheme(t); showPopup(`Theme: ${t.name}`); } }
      else if (key === "m") setBigMap((v) => !v);
      else if (key === "y") { cycleWeather(); showPopup(`Weather: ${G.weather}`); }
      else if (key === "u") { setPhoneOpen((v) => !v); sfx.click(); }
      else if (key === "l") { G.dayPaused = !G.dayPaused; showPopup(G.dayPaused ? "Day cycle held (L to resume)" : "Day cycle running"); }
      else if (key === "n") { setMuted(toggleMute()); }
      else if (key === "c") { camFar.current = !camFar.current; showPopup(camFar.current ? "Camera: far" : "Camera: near"); }
      else if (key === "r") {
        if (G.status) respawnRef.current();
        else if (M.active) { const def = M.active; startMissionRef.current(def); showPopup("Mission restarted"); }
      }
      else if (key === "enter" && introIdx >= 0) { /* handled by intro buttons */ }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [advanceDialogue, applyTheme, showHelp, showPopup, theme]);

  const effectivePaused = paused || !!dialogue || !!hud.status || introIdx >= 0 || !started || showHelp || phoneOpen;
  // ---- poster loading screen: real first-frame signal + minimum display ----
  const loaded = sceneReady && minWait;
  useEffect(() => { const id = window.setTimeout(() => setMinWait(true), 1800); return () => window.clearTimeout(id); }, []);
  useEffect(() => {
    if (started) return;
    const id = window.setInterval(() => setTipIdx((v) => (v + 1) % LOAD_TIPS.length), 2800);
    return () => window.clearInterval(id);
  }, [started]);
  // Poster slideshow: the crew panel opens and holds, then the rest of the
  // key-art panels crossfade in one by one (GTA loading-screen style).
  useEffect(() => {
    if (started) return;
    const id = window.setTimeout(() => {
      setPosterIdx((v) => (v + 1) % POSTER_PANELS.length);
    }, posterIdx === 0 ? 6000 : 4200);
    return () => window.clearTimeout(id);
  }, [started, posterIdx]);
  useEffect(() => {
    if (started || !loaded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter") startGame(true); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, loaded]);
  const exitVehicle = useCallback((pos: THREE.Vector3) => { playerPositionRef.current.copy(pos); }, []);
  const handleRoomSubmit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const r = roomName.trim(); if (r) connectToRoom(r); };
  // Opening theme ("Port Sable Sunset") on the start screen — browsers need a
  // user gesture before audio, so it starts on the first tap/keypress there.
  useEffect(() => {
    if (started) return;
    const kick = () => { initAudio(); startMenuTheme(); };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    return () => { window.removeEventListener("pointerdown", kick); window.removeEventListener("keydown", kick); };
  }, [started]);

  const startGame = (story: boolean) => {
    initAudio(); sfx.playStart(); stopMenuTheme(); setStarted(true);
    if (story && M.storyIndex === 0 && !localStorage.getItem("harborfall-intro")) setIntroIdx(0);
    else if (story && M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]);
  };
  const nextStory = () => { if (M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]); };
  const nextRepeatable = () => startMission(REPEATABLE[M.repeatIndex % REPEATABLE.length]);

  return (
    <main className={`game-shell ${shake ? "shake" : ""}`}>
      <Canvas shadows="soft" dpr={[1, 2]} camera={{ position: [0, 7, 124], fov: 58, near: 0.1, far: 420 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: THREE.SRGBColorSpace }}>
        <Suspense fallback={null}>
          <EnvSetup />
          <World theme={theme} night={nightBucket} />
          <Collectibles targetRef={followRef} paused={effectivePaused}
            onCollect={() => { tokenCountRef.current += 1; G.tokens = tokenCountRef.current; sfx.pickup(); showPopup("Harbour token +$25"); G.cash += 25; }} />
          <Vehicle playerPositionRef={playerPositionRef} vehiclePositionRef={vehiclePositionRef} vehicleStateRef={vehicleStateRef}
            driving={driving} paused={effectivePaused} onDrivingChange={setDriving} onExit={exitVehicle}
            onNearVehicleChange={setNearVehicle} physicsRef={physicsRef} themeAccent={theme.carAccent} />
          <Player positionRef={playerPositionRef} rotationRef={playerRotationRef} driving={driving} paused={effectivePaused} shirt={theme.shirt} />
          <GameSystems paused={effectivePaused} physicsRef={physicsRef} theme={theme} cb={sysCb} tokenCountRef={tokenCountRef} />
          <Weather paused={effectivePaused} theme={theme} />
          <FirstFrame onReady={() => setSceneReady(true)} />
          {players.map((pl) => <RemoteAvatar key={pl.playerId} player={pl} />)}
          <CameraRig target={followRef} camFar={camFar} />
        </Suspense>
      </Canvas>

      {flash && <div className="damage-flash" />}
      {started && !hud.status && (
        <section className="hud" aria-label="Game status">
          <div className="hud-topleft">
            <div className="hud-brand">HARBOR<span>FALL</span></div>
            <div className="hud-meta">{hud.district} · Port Sable · {theme.name}{hud.storyDone ? " · ★ Story Complete" : ""}</div>
            <div className="weather-chip" title="Weather (Y to change)">{hud.weatherIcon} {hud.weather}</div>
            <canvas ref={minimapRef} className="minimap" width={148} height={148} aria-label="Minimap" />
            <div className="health-wrap"><div className="health-bar" style={{ width: `${hud.health}%` }} /><span>HP {hud.health}</span></div>
            {hud.bust > 0.2 && <div className="bust-bar"><div style={{ width: `${Math.min(100, (hud.bust / 3) * 100)}%` }} /></div>}
          </div>
          <div className="hud-topright">
            <div className={`stars ${starPulse ? "pulse" : ""}`} aria-label={`Wanted ${hud.wanted} stars`}>
              {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= hud.wanted ? "on" : ""}>★</span>)}
            </div>
            <div className="cash">${hud.cash.toLocaleString()}</div>
            <div className="hud-meta">Tokens {hud.tokens}/6 · {players.length + 1} player{players.length ? "s" : ""}</div>
          </div>
          {hud.objective && (
            <div className="objective-banner"><b>{M.active?.title}</b> — {hud.objective}{hud.dist ? ` · ${hud.dist}m` : ""}{M.phase === "play" ? ` · ⏱ ${Math.floor(hud.timer / 60)}:${String(hud.timer % 60).padStart(2, "0")}` : ""}</div>
          )}
          {nearVehicle && !driving && <p className="interaction-prompt">Press <b>E</b> to enter the car</p>}
          {driving && <div className="speedo"><div className="speedo-arc" style={{ ["--speed" as string]: `${Math.min(100, hud.speed / 1.4)}%` }} /><strong>{hud.speed}</strong><span>km/h</span></div>}
          {driving && (
            <div className="car-bars">
              <div className="car-bar"><span>⛽</span><div className="car-bar-track"><div className={`car-bar-fill fuel ${hud.fuel < 20 ? "low" : ""}`} style={{ width: `${hud.fuel}%` }} /></div><b>{hud.fuel}%</b></div>
              <div className="car-bar"><span>🔧</span><div className="car-bar-track"><div className={`car-bar-fill dmg ${hud.damage > 60 ? "bad" : ""}`} style={{ width: `${hud.damage}%` }} /></div><b>{hud.damage}%</b></div>
            </div>
          )}
          <button type="button" className="phone-fab" aria-label="Open phone (U)" onClick={() => setPhoneOpen(true)}>📱</button>
          {popup && <div className="cash-popup">{popup}</div>}
          {banner && <div className={`mission-banner ${banner.ok ? "ok" : "bad"}`}>{banner.text}</div>}
          <div className="controls"><b>WASD</b> Move <i /><b>E/F</b> Car <i /><b>T</b> Theme <i /><b>M</b> Map <i /><b>H</b> Help <i /><b>ESC/P</b> Pause</div>
        </section>
      )}

      <button type="button" className="panel-toggle" onClick={() => setPanelOpen((v) => !v)}>☰ Panel</button>
      <aside className={`game-panel ${panelOpen ? "open" : ""}`} aria-label="Game panel">
        <header className="panel-header">
          <div><h1>Harborfall</h1><p>Port Sable — an original harbour-city adventure</p></div>
          <span className={`status-dot ${networkStatus.startsWith("Connected") ? "online" : ""}`} />
        </header>
        <div className="stats-row">
          <div><span>Cash</span><strong>${hud.cash.toLocaleString()}</strong></div>
          <div><span>Chapter</span><strong className="small-strong">{M.storyDone ? "Complete" : `${M.storyIndex + 1} / 6`}</strong></div>
          <div><span>Physics</span><strong>{physicsSource === "wasm" ? "WASM" : "JS"}</strong></div>
        </div>
        <p className="chapter-line">{hud.chapter}</p>
        <p className="chapter-line">Weather: {hud.weatherIcon} {hud.weather} · Phone: press <b>U</b> 📱</p>
        <div className="panel-actions">
          {!M.storyDone && <button type="button" onClick={nextStory}>▶ Next story chapter</button>}
          <button type="button" onClick={nextRepeatable}>↻ Repeatable job</button>
          <button type="button" onClick={() => setPaused((v) => !v)}>{paused ? "Resume" : "Pause"}</button>
          <button type="button" onClick={() => setShowHelp(true)}>Shortcuts (H)</button>
          <button type="button" onClick={() => setMuted(toggleMute())}>{muted ? "Unmute (N)" : "Mute (N)"}</button>
        </div>
        <div className="theme-picker" role="group" aria-label="Personal themes">
          <h2>Personal theme <span>{theme.name}</span></h2>
          <div className="theme-grid">
            {THEMES.map((t, i) => (
              <button key={t.id} type="button" className={t.id === theme.id ? "theme-btn active" : "theme-btn"} onClick={() => applyTheme(t)} title={`${t.blurb} (key ${i + 1})`}>
                <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.sky} 50%, ${t.css["--accent"]} 50%)` }} />{t.name}
              </button>
            ))}
          </div>
          <small>Keys 1–5 switch instantly · T cycles · saved automatically</small>
        </div>
        <form className="room-form" onSubmit={handleRoomSubmit}>
          <label htmlFor="room-name">Multiplayer room (optional)</label>
          <div className="room-row">
            <input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={48} autoComplete="off" />
            <button type="submit" disabled={!serverUrl || !roomName.trim()}>Join</button>
          </div>
          <small>Single-player works with no server configured.</small>
        </form>
        <p className="network-status" role="status">{networkStatus}</p>
        {activeRoom && <button type="button" onClick={() => { multiplayerRef.current?.disconnect(); multiplayerRef.current = null; setPlayers([]); setActiveRoom(""); setNetworkStatus("Disconnected"); }}>Leave room</button>}
      </aside>

      <TouchControls driving={driving} onPause={() => setPaused((v) => !v)} />

      <Phone open={phoneOpen && started} onClose={() => setPhoneOpen(false)} theme={theme} applyTheme={applyTheme}
        onOpenMap={() => { setPhoneOpen(false); setBigMap(true); }}
        onContact={(name, line, hint) => { setPhoneOpen(false); beginDialogue([{ who: name, text: line }, { who: name, text: hint }], () => {}); }} />

      {!started && (
        <div className="start-screen poster-screen">
          {POSTER_PANELS.map((panel, i) => (
            <img key={panel.caption} className={i === posterIdx ? "poster-bg active" : "poster-bg"} src={panel.src} alt="" aria-hidden="true" />
          ))}
          <div className="poster-shade" aria-hidden="true" />
          <div className="poster-caption" aria-hidden="true">
            <span>{POSTER_PANELS[posterIdx].caption}</span>
            <span className="poster-dots">{POSTER_PANELS.map((panel, i) => (<i key={panel.caption} className={i === posterIdx ? "on" : ""} />))}</span>
          </div>
          <div className="poster-content">
            <h1 className="game-title">HARBOR<span>FALL</span></h1>
            <p className="tagline">Port Sable · a harbour city of debts, cranes and second chances</p>
            {!loaded ? (
              <div className="load-block">
                <div className="load-bar"><div className="load-fill" style={{ width: sceneReady ? "86%" : "52%" }} /></div>
                <p className="load-tip">💡 {LOAD_TIPS[tipIdx]}</p>
                <p className="load-status">{sceneReady ? "Polishing the harbour…" : "Loading Port Sable…"}</p>
              </div>
            ) : (
              <>
                <div className="start-actions">
                  <button type="button" className="big-btn" onClick={() => startGame(true)}>▶ Play Story</button>
                  <button type="button" className="big-btn ghost" onClick={() => startGame(false)}>Free Roam</button>
                </div>
                <p className="press-enter">Press <b>Enter</b> / tap Play to start</p>
                <button type="button" className="how-toggle" onClick={() => setShowHow((v) => !v)}>{showHow ? "Hide" : "How to play + story"}</button>
                {showHow && (
                  <div className="how-box">
                    <p className="start-story">Rayan Kade returns after five years to free his brother Tamim from Victor Solano's debt ledger. Drive, earn, outrun the harbour patrol — and finish the story.</p>
                    <p className="start-controls">WASD drive · E enter car · Shift sprint · Space jump/drift · B horn · U phone · Y weather · T theme · M map · H all shortcuts · Touch controls on mobile</p>
                    <div className="theme-grid start-themes">
                      {THEMES.map((t) => (
                        <button key={t.id} type="button" className={t.id === theme.id ? "theme-btn active" : "theme-btn"} onClick={() => applyTheme(t)}>
                          <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.sky} 50%, ${t.css["--accent"]} 50%)` }} />{t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {introIdx >= 0 && (
        <div className="dialog-backdrop">
          <section className="game-dialog story-panel">
            <span className="panel-kicker">Harborfall — the story so far · {introIdx + 1}/{INTRO_PANELS.length}</span>
            <h2>{INTRO_PANELS[introIdx].title}</h2>
            <p>{INTRO_PANELS[introIdx].text}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => { localStorage.setItem("harborfall-intro", "1"); setIntroIdx(-1); if (M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]); }}>Skip intro</button>
              <button type="button" className="primary" onClick={() => {
                if (introIdx < INTRO_PANELS.length - 1) setIntroIdx(introIdx + 1);
                else { localStorage.setItem("harborfall-intro", "1"); setIntroIdx(-1); if (M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]); }
              }}>{introIdx < INTRO_PANELS.length - 1 ? "Continue" : "Begin — Chapter 1"}</button>
            </div>
          </section>
        </div>
      )}

      {dialogue && (
        <div className="dialogue-box" role="dialog" aria-label="Dialogue">
          <div className="dialogue-avatar">{dialogue.lines[dialogue.idx].who.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
          <div className="dialogue-main">
            <b>{dialogue.lines[dialogue.idx].who}</b>
            <p>{dialogue.lines[dialogue.idx].text}</p>
            <button type="button" onClick={advanceDialogue}>{dialogue.idx < dialogue.lines.length - 1 ? "Continue ▸ (E)" : "Let's go ▸ (E)"}</button>
          </div>
        </div>
      )}

      {ending && (
        <div className="dialog-backdrop">
          <section className="game-dialog story-panel">
            <span className="panel-kicker">★ Story Complete ★</span>
            <h2>{ENDING_PANEL.title}</h2><p>{ENDING_PANEL.text}</p>
            <button type="button" className="primary" onClick={() => setEnding(false)}>Keep free-roaming Port Sable</button>
          </section>
        </div>
      )}

      {hud.status && (
        <div className="dialog-backdrop">
          <section className={`game-dialog status-dialog ${hud.status}`}>
            <h2>{hud.status === "busted" ? "BUSTED" : "WASTED"}</h2>
            <p>{hud.status === "busted" ? "The harbour patrol got you. Fine paid, record noted — Det. Voss is not impressed." : "You woke up outside Sable General. The city keeps your car keys, and $100 for the trouble."}</p>
            <button type="button" className="primary" onClick={respawn}>Respawn (R)</button>
          </section>
        </div>
      )}

      {bigMap && (
        <div className="bigmap" role="dialog" aria-label="City map">
          <h2>Port Sable — city map <span>(M to close)</span></h2>
          <canvas ref={bigmapRef} width={520} height={520} />
        </div>
      )}

      {paused && !showHelp && started && (
        <div className="dialog-backdrop">
          <section className="game-dialog" role="dialog" aria-modal="true">
            <h2>Paused</h2>
            <p>Theme: <b>{theme.name}</b> · {hud.chapter}</p>
            <div className="theme-grid">
              {THEMES.map((t, i) => (
                <button key={t.id} type="button" className={t.id === theme.id ? "theme-btn active" : "theme-btn"} onClick={() => applyTheme(t)}>
                  <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.sky} 50%, ${t.css["--accent"]} 50%)` }} />{i + 1}. {t.name}
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button type="button" className="primary" onClick={() => setPaused(false)}>Resume</button>
              <button type="button" onClick={() => setShowHelp(true)}>Shortcuts</button>
            </div>
          </section>
        </div>
      )}

      {showHelp && (
        <div className="dialog-backdrop">
          <section className="game-dialog help-dialog" role="dialog" aria-modal="true">
            <h2>Keyboard shortcuts</h2>
            <h3>On foot</h3>
            <dl className="key-list">
              <div><dt>WASD / Arrows</dt><dd>Move</dd></div><div><dt>Shift</dt><dd>Sprint</dd></div>
              <div><dt>Space</dt><dd>Jump</dd></div><div><dt>E / F</dt><dd>Enter car · advance dialogue</dd></div>
            </dl>
            <h3>Driving</h3>
            <dl className="key-list">
              <div><dt>WASD / Arrows</dt><dd>Accelerate · brake/reverse · steer</dd></div>
              <div><dt>Space</dt><dd>Handbrake / drift</dd></div><div><dt>B</dt><dd>Horn</dd></div><div><dt>E / F</dt><dd>Exit car</dd></div>
              <div><dt>C</dt><dd>Camera near / far</dd></div>
            </dl>
            <h3>Game</h3>
            <dl className="key-list">
              <div><dt>Esc / P</dt><dd>Pause</dd></div><div><dt>H / ?</dt><dd>This help</dd></div>
              <div><dt>T</dt><dd>Cycle theme</dd></div><div><dt>1–5</dt><dd>Switch theme directly</dd></div>
              <div><dt>M</dt><dd>Big map</dd></div><div><dt>L</dt><dd>Hold / resume day cycle</dd></div>
              <div><dt>N</dt><dd>Mute / unmute</dd></div><div><dt>R</dt><dd>Respawn (busted/wasted) · restart mission</dd></div>
              <div><dt>U</dt><dd>Smartphone (contacts · messages · bank · music · themes)</dd></div>
              <div><dt>Y</dt><dd>Change the weather</dd></div>
              <div><dt>⛽ Fuel</dt><dd>Cars burn fuel — park at a red FUEL canopy to refill for cash</dd></div>
              <div><dt>🔧 Damage</dt><dd>Crashes damage your car; 100% = wrecked</dd></div>
              <div><dt>Enter</dt><dd>Confirm dialogue</dd></div><div><dt>Mouse drag / wheel</dt><dd>Orbit / zoom camera</dd></div>
            </dl>
            <button type="button" className="primary" onClick={() => setShowHelp(false)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}
