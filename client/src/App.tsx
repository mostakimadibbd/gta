import { Suspense, useCallback, useEffect, useRef, useState, type ComponentRef, type FormEvent, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, SMAA, BrightnessContrast, HueSaturation, SSAO } from "@react-three/postprocessing";
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
import { M, startPlay, endMission, persist as persistMission } from "./game/missionState";
import { STORY_MISSIONS, REPEATABLE, INTRO_PANELS, ENDING_PANEL, nextSideMission, type DialogueLine, type MissionDef } from "./game/missions";
import { THEMES, loadTheme, saveTheme, type GameTheme } from "./themes";
import { ROAD_COORDS, FUEL_STATIONS, districtAt, isBlocked } from "./world";
import { skyEnvTexture, setNormalsEnabled } from "./textures";
import { gates, initQuality, runFpsSampleOnce, setTier, type QualityTier } from "./game/quality";
import Weather from "./components/Weather";
import Combat from "./components/Combat";
import Interiors from "./components/Interiors";
import Interactions from "./components/Interactions";
import GaragePanel from "./components/GaragePanel";
import CharacterSelect from "./components/CharacterSelect";
import { POSTER_PANELS } from "./posterData";
import Phone from "./components/Phone";
import { loadCharacterChoice, persistCharacterChoice, presetById } from "./game/characters";
import { gyroYawTrim } from "./game/gyro";
import { stashTotal, persistSettings, toast as gameToast } from "./game/store";
import { CORAL_ROAD_X, CORAL_ROAD_Z, OVERLOOK, PIER_SPAWN } from "./world";
import { WEATHER_META, cycleWeather } from "./game/weather";
import { audioTick, initAudio, sfx, startMenuTheme, stopMenuTheme, toggleMute } from "./game/audio";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Environment reflections: the single biggest "not cartoon" upgrade — car
// paint, glass towers and wet roads pick up real reflections. Phase 5
// (Step 3a): Medium/High use a PMREM conversion of ONE procedural
// equirectangular dusk-coast sky (textures.skyEnvTexture) so reflections
// match the world; Low keeps the neutral RoomEnvironment. Themes keep
// their identity through per-theme environment intensity.
const THEME_ENV_INTENSITY: Record<string, number> = { dusk: 0.55, midnight: 0.25, desert: 0.7, emerald: 0.6, noir: 0.3 };
function EnvSetup({ theme, quality }: { theme: GameTheme; quality: QualityTier }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = gates.cc0(quality)
      ? pmrem.fromEquirectangular(skyEnvTexture())
      : pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = THEME_ENV_INTENSITY[theme.id] ?? 0.5;
    return () => { scene.environment = null; rt.dispose(); pmrem.dispose(); };
  }, [gl, scene, theme, quality]);
  return null;
}

const initialRoom = import.meta.env.VITE_MULTIPLAYER_ROOM || "downtown";
const tmpV = new THREE.Vector3();
// (Phase 5: the composer is gated by the quality tier now, not by pointer
// type — see game/quality.ts. Auto-detection still starts coarse-pointer
// devices on Low/Medium.)

interface FpState { on: boolean; yaw: number; pitch: number; }

function CameraRig({ target, camFar, fp, orbit }: { target: RefObject<THREE.Vector3>; camFar: RefObject<boolean>; fp: RefObject<FpState>; orbit: boolean }) {
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (!target.current) return;
    const cam = camera as THREE.PerspectiveCamera;
    // impact shake (collision-driven amplitude, gated by the shake setting)
    const applyShake = () => {
      if (G.settings.shake && G.shakeAmp > 0.004) {
        camera.position.x += (Math.random() - 0.5) * G.shakeAmp * 0.35;
        camera.position.y += (Math.random() - 0.5) * G.shakeAmp * 0.3;
        G.shakeAmp *= Math.exp(-5.5 * delta);
      }
    };
    // ---- first-person (V) and photo mode: head-height, drag to look.
    // Gyro gently trims yaw on foot (±~10°) when enabled.
    if (fp.current?.on || G.photoMode) {
      if (controls.current) controls.current.enabled = false;
      const car = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId] : null;
      const base = car ? car.state.heading : G.playerHeading;
      const headY = car ? 1.14 : 1.62;
      tmpV.copy(target.current); tmpV.y += headY;
      if (car) { tmpV.x += Math.sin(base) * 0.15; tmpV.z += Math.cos(base) * 0.15; }
      camera.position.copy(tmpV);
      const f = fp.current ?? { yaw: 0, pitch: 0 };
      const h = base + f.yaw + (car ? 0 : gyroYawTrim()); const p = f.pitch;
      const cp = Math.cos(p);
      camera.lookAt(tmpV.x + Math.sin(h) * cp, tmpV.y + Math.sin(p), tmpV.z + Math.cos(h) * cp);
      const fpFov = G.settings.fov + 4;
      if (Math.abs(cam.fov - fpFov) > 0.4) { cam.fov += (fpFov - cam.fov) * 0.2; cam.updateProjectionMatrix(); }
      applyShake();
      return;
    }
    if (!controls.current) return;
    if (!controls.current.enabled) controls.current.enabled = true;
    tmpV.copy(target.current); tmpV.y += 1.1;
    controls.current.target.lerp(tmpV, 1 - Math.exp(-5 * delta));
    controls.current.autoRotate = orbit;
    controls.current.autoRotateSpeed = 0.65;
    controls.current.maxDistance = orbit ? 8 : G.interior ? 6.5 : camFar.current ? 26 : 15;
    controls.current.minDistance = orbit ? 5 : 4;
    const targetFov = G.settings.fov + Math.min(14, G.speedKph / 9);
    if (Math.abs(cam.fov - targetFov) > 0.4) { cam.fov += (targetFov - cam.fov) * 0.08; cam.updateProjectionMatrix(); }
    controls.current.update();
    // Phase 5 camera guard (user report: camera pressed inside a dockside
    // container wall): walk the target→camera segment in ~0.55u steps and
    // stop at the last sample outside every building/static AABB. Cheap
    // 2D test against world.ts blockers; skips interiors (rooms are small
    // and already distance-capped) and the menu orbit.
    if (!orbit && !G.interior) {
      const from = controls.current.target;
      const to = camera.position;
      const dist = from.distanceTo(to);
      if (dist > 1.7) {
        const steps = Math.ceil(dist / 0.55);
        for (let i = 1; i <= steps; i++) {
          const d = (i / steps) * dist;
          const k = d / dist;
          const sx = from.x + (to.x - from.x) * k;
          const sy = from.y + (to.y - from.y) * k;
          const sz = from.z + (to.z - from.z) * k;
          if (sy < 56 && isBlocked(sx, sz, 0.25)) {
            const free = Math.max(1.5, d - 0.6) / dist;
            camera.position.set(from.x + (to.x - from.x) * free, from.y + (to.y - from.y) * free, from.z + (to.z - from.z) * free);
            break;
          }
        }
      }
    }
    applyShake();
  });
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={4} maxDistance={18} maxPolarAngle={Math.PI / 2.05} />;
}

/** Photo-mode capture: renders one frame then downloads the canvas PNG. */
function PhotoCapture({ shotRef }: { shotRef: RefObject<number> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const done = useRef(0);
  useFrame(() => {
    if (!shotRef.current || shotRef.current === done.current) return;
    done.current = shotRef.current;
    gl.render(scene, camera);
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = "harborfall-photo.png"; a.click();
  });
  return null;
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

interface HudSnap { cash: number; health: number; wanted: number; speed: number; tokens: number; objective: string; dist: number; timer: number; chapter: string; district: string; driving: boolean; bust: number; status: string; storyDone: boolean; weather: string; weatherIcon: string; fuel: number; damage: number; ammo: number; armed: boolean; prompt: string; promptWarn: boolean; loot: number; lootCount: number; eye: string; holdLabel: string; holdP: number; weapon: string; }
const initialHud: HudSnap = { cash: G.cash, health: 100, wanted: 0, speed: 0, tokens: 0, objective: "", dist: 0, timer: 0, chapter: "", district: "The Docks", driving: false, bust: 0, status: "", storyDone: false, weather: "Clear", weatherIcon: "☀️", fuel: 100, damage: 0, ammo: 0, armed: false, prompt: "", promptWarn: false, loot: 0, lootCount: 0, eye: "", holdLabel: "", holdP: 0, weapon: "fist" };

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
  "V switches to first person — in the car you ride over the hood.",
  "Click or J throws a punch. Find a pistol (villa, docks) and it fires instead — mind the witnesses.",
  "The red bike by the beach is rideable — it leans hard and tops out fast.",
  "Lina's Garage and Club Solace have doors now. Walk up and press E.",
  "Save $7,500 and the villa at Sable Heights is yours — park in its drive to keep a car for good.",
  "Deep water past the wet sand? You can swim — just paddle back to shore.",
  "The Bay Bridge is open — Coral Shores waits across the water: new streets, a pawn shop, new cars.",
  "Press G at the villa garage or Lina's to swap between your stored cars.",
  "Sneak up BEHIND a pedestrian and press E to pickpocket. Crouch (X) first and you're harder to spot.",
  "Hold E at a shop till to rob it — the alarm means 2 stars, so run. Fence loot at Coral Pawn.",
  "Hold E on a locked car to break in — alarms are loud and witnesses talk.",
  "On a phone? Tap GYRO and tilt to steer. Buttons still work as backup.",
  "Your phone has a Camera app now — photo mode hides the HUD for clean shots.",
];
/** Interaction prompt pill: pulls a leading key ("E — …", "Press E — …",
 * "Hold E — …", "G — …") out into a keyboard-key cap. */
function PromptPill({ text, warn }: { text: string; warn?: boolean }) {
  const m = text.match(/^(?:Press\s+)?(Hold\s+)?([A-Z])\s+—\s+(.*)$/);
  if (!m) return <p className={`interaction-prompt ${warn ? "warn" : ""}`}>{text}</p>;
  return (
    <p className={`interaction-prompt ${warn ? "warn" : ""}`}>
      <span className="keycap">{m[2]}</span>{m[1] ? "Hold · " : ""}{m[3]}
    </p>
  );
}

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
  const fpRef = useRef<FpState>({ on: false, yaw: 0, pitch: 0 });
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
  // ---- Phase 4 state: character select, garage panel, photo mode, debrief
  const [charChoice, setCharChoice] = useState(loadCharacterChoice);
  const [charOpen, setCharOpen] = useState(false);
  const [garageZoneId, setGarageZoneId] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [postFx, setPostFx] = useState(G.settings.postFx);
  // ---- Phase 5: quality tier (game/quality.ts owns detection + gates) ----
  const [quality, setQualityState] = useState<QualityTier>(() => { initQuality(); return G.settings.quality; });
  const qualityRef = useRef(quality);
  useEffect(() => { qualityRef.current = quality; setNormalsEnabled(gates.normalMaps(quality)); }, [quality]);
  // ---- Phase 5: cinematic subtitles (typewriter) + ambient barks + choice
  const [subShown, setSubShown] = useState(0);
  const [barkUi, setBarkUi] = useState<{ who: string; text: string } | null>(null);
  const lastBarkAt = useRef(0);
  const [choiceFor, setChoiceFor] = useState<MissionDef | null>(null);
  const [missionResult, setMissionResult] = useState<typeof G.missionResult>(null);
  const photoShotRef = useRef(0);
  const lastMissionAt = useRef(0);
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
  const choiceRef = useRef(choiceFor); choiceRef.current = choiceFor;
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
    setSubShown(0);
    setDialogue({ lines, idx: 0, after });
  }, []);
  const advanceDialogue = useCallback(() => {
    const d = dialogueRef.current; if (!d) return;
    // subtitle flow: first press completes the typewriter line, second advances
    const full = d.lines[d.idx].text.length;
    if (subShown < full) { setSubShown(full); return; }
    sfx.dialogue();
    if (d.idx < d.lines.length - 1) { setSubShown(0); setDialogue({ ...d, idx: d.idx + 1 }); }
    else { setDialogue(null); G.dialogueActive = false; d.after(); }
  }, [subShown]);
  // typewriter reveal ~40 chars/s, with a soft blip every few characters
  useEffect(() => {
    if (!dialogue) return;
    const id = window.setInterval(() => {
      const d = dialogueRef.current; if (!d) { window.clearInterval(id); return; }
      const full = d.lines[d.idx].text.length;
      setSubShown((s) => {
        if (s >= full) { window.clearInterval(id); return s; }
        if (s % 6 === 0) sfx.dialogue();
        return Math.min(full, s + 1);
      });
    }, 25);
    return () => window.clearInterval(id);
  }, [dialogue]);

  const startMission = useCallback((def: MissionDef) => {
    endMission(); M.phase = "intro";
    const intro = def.introAlt && M.choice === "elias" ? def.introAlt : def.intro;
    beginDialogue(intro, () => {
      // Phase 5: the Ch.5 choice interrupts between intro and play, once.
      if (def.choice && !M.choice) { setChoiceFor(def); return; }
      startPlay(def); showBanner(`${def.title} — ${def.giver}`, true);
    });
  }, [beginDialogue, showBanner]);
  const resolveChoice = useCallback((def: MissionDef, flag: string, reply: DialogueLine[]) => {
    M.choice = flag as "voss" | "elias";
    persistMission();
    setChoiceFor(null);
    sfx.click();
    beginDialogue(reply, () => { startPlay(def); showBanner(`${def.title} — ${def.giver}`, true); });
  }, [beginDialogue, showBanner]);

  sysCb.current = {
    dialogue: beginDialogue,
    popup: showPopup,
    banner: showBanner,
    storyFinished: () => setEnding(true),
    event: (name) => {
      if (name === "shake") { if (G.settings.shake) { setShake(true); window.setTimeout(() => setShake(false), 320); } G.shakeAmp = Math.max(G.shakeAmp, 0.3); }
      if (name === "crime") multiplayerRef.current?.sendEvent("crime", { wanted: G.wanted });
      if (name === "missionEnd") multiplayerRef.current?.sendEvent("mission", { storyIndex: M.storyIndex, cash: G.cash });
    },
  };

  const respawn = useCallback(() => {
    if (G.status === "busted") resetAfterArrest(150 + G.wanted * 50);
    else resetAfterWasted();
    G.status = ""; G.crouched = false; playerPositionRef.current.copy(G.playerPos);
  }, []);
  const respawnRef = useRef(respawn); respawnRef.current = respawn;
  const startMissionRef = useRef(startMission); startMissionRef.current = startMission;
  const postFxRef = useRef(G.settings.postFx);

  // ---- Phase 4: character select open/close ----
  const savedPosRef = useRef<{ x: number; z: number } | null>(null);
  const tryOpenCharSelect = useCallback(() => {
    if (dialogueRef.current || G.status) return;
    if (started && M.active && M.phase === "play") { gameToast("Can't change character mid-mission"); return; }
    if (!started) {
      savedPosRef.current = { x: G.playerPos.x, z: G.playerPos.z };
      G.playerPos.set(OVERLOOK.x + 3, 0, OVERLOOK.z + 7);
      G.followPos.set(OVERLOOK.x + 3, 0, OVERLOOK.z + 7);
      G.playerHeading = 2.6;
    }
    setCharOpen(true);
  }, [started]);
  const tryOpenCharSelectRef = useRef(tryOpenCharSelect); tryOpenCharSelectRef.current = tryOpenCharSelect;
  const closeCharSelect = useCallback(() => {
    setCharOpen(false);
    if (!started && savedPosRef.current) {
      G.playerPos.set(PIER_SPAWN.x, 0, PIER_SPAWN.z);
      G.followPos.set(PIER_SPAWN.x, 0, PIER_SPAWN.z);
      G.playerHeading = Math.PI;
      savedPosRef.current = null;
    }
  }, [started]);
  const pickCharacter = useCallback((id: string) => {
    setCharChoice((c) => { const next = { id, variant: c.variant }; persistCharacterChoice(next.id, next.variant); return next; });
    sfx.click();
  }, []);
  const pickVariant = useCallback((v: number) => {
    setCharChoice((c) => { const next = { id: c.id, variant: v }; persistCharacterChoice(next.id, next.variant); return next; });
    sfx.click();
  }, []);

  // ---- PDF delta B: photo mode ----
  const enterPhotoMode = useCallback(() => {
    setPhoneOpen(false);
    G.photoMode = true; setPhotoMode(true);
    fpRef.current.yaw = 0; fpRef.current.pitch = 0;
    gameToast("Photo mode — drag to look, Enter captures");
  }, []);
  const exitPhotoMode = useCallback(() => { G.photoMode = false; setPhotoMode(false); }, []);
  const capturePhoto = useCallback(() => { photoShotRef.current += 1; sfx.click(); }, []);

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
      const mm = theme.minimap;
      // world → map: covers Port Sable + the bay + Coral Shores
      // (x −145..165, z −130..340 around centre (10, 105))
      const S = size / 480;
      const mx = (x: number) => (x - 10) * S + size / 2;
      const mz = (z: number) => (z - 105) * S + size / 2;
      g.fillStyle = mm.bg; g.fillRect(0, 0, size, size);
      // water: the bay band + around Coral island
      g.fillStyle = "#2c5d84";
      g.fillRect(0, mz(128), size, mz(196) - mz(128));
      g.fillRect(0, mz(324), size, size - mz(324));
      g.fillRect(0, mz(196), mx(28), mz(324) - mz(196));
      g.fillRect(mx(112), mz(196), size - mx(112), mz(324) - mz(196));
      // Coral Shores landmass
      g.fillStyle = mm.bg; g.fillRect(mx(28), mz(196), (112 - 28) * S, (324 - 196) * S);
      g.strokeStyle = mm.road; g.lineWidth = Math.max(1.5, 5 * S);
      for (const c of ROAD_COORDS) {
        g.beginPath(); g.moveTo(mx(c), mz(-124)); g.lineTo(mx(c), mz(128)); g.stroke();
        g.beginPath(); g.moveTo(mx(-124), mz(c)); g.lineTo(mx(124), mz(c)); g.stroke();
      }
      for (const c of CORAL_ROAD_X) { g.beginPath(); g.moveTo(mx(c), mz(200)); g.lineTo(mx(c), mz(320)); g.stroke(); }
      for (const c of CORAL_ROAD_Z) { g.beginPath(); g.moveTo(mx(32), mz(c)); g.lineTo(mx(108), mz(c)); g.stroke(); }
      // the bridge
      g.strokeStyle = "#d9d4c5"; g.lineWidth = Math.max(1.5, 4 * S);
      g.beginPath(); g.moveTo(mx(60), mz(112)); g.lineTo(mx(60), mz(214)); g.stroke();
      const dot = (x: number, z: number, col: string, r: number) => { g.fillStyle = col; g.beginPath(); g.arc(mx(x), mz(z), Math.max(1.4, r * S * 2.2), 0, 7); g.fill(); };
      for (const st of FUEL_STATIONS) dot(st.x, st.z, "#ffb703", 3); // fuel pumps
      for (const c of G.cars) if (!c.storedAway) dot(c.state.x, c.state.z, mm.car, 2.4);
      for (const c of G.traffic) dot(c.x, c.z, mm.car, 2);
      for (const c of G.cops) if (c.active) dot(c.x, c.z, mm.police, 3.4);
      if (G.objective && M.phase === "play") dot(G.objective.x, G.objective.z, mm.marker, 4);
      // player arrow
      const px = mx(G.followPos.x), pz = mz(G.followPos.z);
      const h = G.driving && G.activeCarId >= 0 ? G.cars[G.activeCarId].state.heading : playerRotationRef.current.y;
      g.save(); g.translate(px, pz); g.rotate(h); g.fillStyle = mm.player;
      const as = Math.max(3, 6 * S * 2.2);
      g.beginPath(); g.moveTo(0, -as); g.lineTo(as * 0.66, as * 0.83); g.lineTo(-as * 0.66, as * 0.83); g.closePath(); g.fill(); g.restore();
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
        ammo: G.ammo, armed: G.armed, prompt: G.promptText, promptWarn: G.promptWarn,
        loot: stashTotal(), lootCount: G.inventory.length, eye: G.stealthEye,
        holdLabel: G.hold?.label ?? "", holdP: G.hold?.progress ?? 0, weapon: G.weaponSel,
      });
      // Phase 4/V6: mission debrief + phone-driven requests + settings sync
      if (G.missionResult && G.missionResult.at !== lastMissionAt.current) {
        lastMissionAt.current = G.missionResult.at;
        setMissionResult(G.missionResult);
        window.setTimeout(() => setMissionResult((r) => (r && r.at === lastMissionAt.current ? null : r)), 9000);
      }
      if (G.requestCharSelect) { G.requestCharSelect = false; tryOpenCharSelectRef.current(); }
      if (G.settings.postFx !== postFxRef.current) { postFxRef.current = G.settings.postFx; setPostFx(G.settings.postFx); }
      // Phase 5: quality can change under us (FPS step-down, phone settings)
      if (G.settings.quality !== qualityRef.current) setQualityState(G.settings.quality);
      // Phase 5: ambient barks surface as small subtitles for ~4 s
      if (G.bark && G.bark.at !== lastBarkAt.current) {
        lastBarkAt.current = G.bark.at;
        if (G.settings.subBarks) {
          const b = { who: G.bark.who, text: G.bark.text };
          setBarkUi(b);
          window.setTimeout(() => setBarkUi((cur) => (cur === b ? null : cur)), 4200);
        }
      }
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
      if (choiceRef.current) return; // the Ch.5 choice is answered by click/tap only
      // Phase 4/V6: mission debrief dismiss
      if (missionResult && (key === "enter" || key === "e")) { e.preventDefault(); setMissionResult(null); return; }
      // PDF delta B: photo mode owns H / U / Enter / Esc while active
      if (G.photoMode) {
        if (key === "h" || key === "u" || key === "escape") { e.preventDefault(); exitPhotoMode(); }
        else if (key === "enter") { e.preventDefault(); capturePhoto(); }
        return;
      }
      if (charOpen && (key === "escape" || key === "enter")) { e.preventDefault(); closeCharSelect(); return; }
      if (garageZoneId && key === "escape") { e.preventDefault(); setGarageZoneId(null); return; }
      // Phase 3: contextual E (doors, mansion gate) — set by Interiors
      if (key === "e" && G.interact) { e.preventDefault(); G.interact(); return; }
      if (key === "g" && started && G.garageZone) { e.preventDefault(); setGarageZoneId(G.garageZone.id); sfx.click(); return; }
      if ((key === "q" || key === "tab") && started) {
        e.preventDefault();
        if (G.armed) { G.weaponSel = G.weaponSel === "pistol" ? "fist" : "pistol"; showPopup(G.weaponSel === "pistol" ? "Weapon: pistol" : "Weapon: fists"); }
        return;
      }
      if (key === "v") {
        const fp = fpRef.current;
        fp.on = !fp.on; fp.yaw = 0; fp.pitch = 0;
        G.firstPerson = fp.on;
        showPopup(fp.on ? "Camera: first person — drag to look around" : "Camera: third person");
      }
      else if (key === "escape" || key === "p") { if (showHelp) setShowHelp(false); else setPaused((v) => !v); }
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
  }, [advanceDialogue, applyTheme, showHelp, showPopup, theme, missionResult, charOpen, garageZoneId, started, exitPhotoMode, capturePhoto, closeCharSelect]);

  // first-person drag-look (mouse or touch drag while FP is on)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const fp = fpRef.current;
      if (!fp.on || !(e.buttons & 1)) return;
      fp.yaw -= e.movementX * 0.0032;
      fp.pitch = THREE.MathUtils.clamp(fp.pitch - e.movementY * 0.0032, -1.05, 1.05);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const effectivePaused = paused || !!dialogue || !!choiceFor || !!hud.status || introIdx >= 0 || !started || showHelp || phoneOpen || charOpen || !!garageZoneId;
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
    initAudio(); sfx.playStart(); stopMenuTheme(); setStarted(true); setCharOpen(false); savedPosRef.current = null;
    runFpsSampleOnce(); // Phase 5: one 2.5 s sample may step the tier down once
    if (story && M.storyIndex === 0 && !localStorage.getItem("harborfall-intro")) setIntroIdx(0);
    else if (story && M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]);
  };
  const nextStory = () => { if (M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]); };
  const nextRepeatable = () => startMission(REPEATABLE[M.repeatIndex % REPEATABLE.length]);

  return (
    <main className={`game-shell ${shake ? "shake" : ""}`} onContextMenu={(e) => e.preventDefault()}>
      <Canvas shadows="soft" dpr={[1, 2]} camera={{ position: [0, 7, 124], fov: 58, near: 0.1, far: 420 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: THREE.SRGBColorSpace }}>
        <Suspense fallback={null}>
          <EnvSetup theme={theme} quality={quality} />
          <World theme={theme} night={nightBucket} quality={quality} />
          <Collectibles targetRef={followRef} paused={effectivePaused}
            onCollect={() => { tokenCountRef.current += 1; G.tokens = tokenCountRef.current; sfx.pickup(); showPopup("Harbour token +$25"); G.cash += 25; }} />
          <Vehicle playerPositionRef={playerPositionRef} vehiclePositionRef={vehiclePositionRef} vehicleStateRef={vehicleStateRef}
            driving={driving} paused={effectivePaused} onDrivingChange={setDriving} onExit={exitVehicle}
            onNearVehicleChange={setNearVehicle} physicsRef={physicsRef} themeAccent={theme.carAccent} />
          <Player positionRef={playerPositionRef} rotationRef={playerRotationRef} driving={driving} paused={effectivePaused}
            preset={presetById(charChoice.id)} variant={charChoice.variant} showcase={charOpen} />
          <GameSystems paused={effectivePaused} physicsRef={physicsRef} theme={theme} cb={sysCb} tokenCountRef={tokenCountRef} quality={quality} />
          <Weather paused={effectivePaused} theme={theme} />
          <Combat enabled={started && !effectivePaused} />
          <Interiors />
          <Interactions />
          <PhotoCapture shotRef={photoShotRef} />
          <FirstFrame onReady={() => setSceneReady(true)} />
          {players.map((pl) => <RemoteAvatar key={pl.playerId} player={pl} />)}
          <CameraRig target={followRef} camFar={camFar} fp={fpRef} orbit={charOpen} />
          {/* Film grade: bloom + warm grade + grain + vignette + SMAA.
              Phase 5: gated by the quality tier (Low = composer OFF;
              Medium = as Phase 4; High adds SSAO + stronger bloom) and by
              the player's Post FX toggle. */}
          {postFx && gates.composer(quality) && (
            <EffectComposer multisampling={0}>
              <>
                <Bloom intensity={gates.bloom(quality)} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
                <HueSaturation saturation={0.08} />
                <BrightnessContrast contrast={0.06} brightness={0.01} />
                <Noise opacity={0.035} />
                <Vignette darkness={0.22} offset={0.28} />
                {gates.ssao(quality) && (
                  <SSAO worldDistanceThreshold={80} worldDistanceFalloff={40} worldProximityThreshold={6} worldProximityFalloff={3}
                    radius={0.22} intensity={1.1} luminanceInfluence={0.35} samples={16} rings={4} />
                )}
                <SMAA />
              </>
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>

      {flash && <div className="damage-flash" />}
      {started && !hud.status && !photoMode && (
        <section className="hud" aria-label="Game status">
          <div className="hud-topleft">
            <div className="hud-brand">HARBOR<span>FALL</span></div>
            <div className="hud-meta">{hud.district} · {theme.name}{hud.storyDone ? " · Story Complete" : ""}</div>
            <div className="weather-chip" title="Weather (Y to change)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="9" r="3.4" /><path d="M9 2.5v1.6M2.5 9h1.6M4.9 4.9l1.1 1.1M13.1 4.9l-1.1 1.1" /><path d="M10 20h7.2a3.4 3.4 0 0 0 .6-6.7 4.6 4.6 0 0 0-8.7 1A3.2 3.2 0 0 0 10 20Z" /></svg>
              {hud.weather}
            </div>
            <div className="minimap-disc"><canvas ref={minimapRef} className="minimap" width={148} height={148} aria-label="Minimap" /></div>
            <div className="health-wrap"><div className="health-bar" style={{ width: `${hud.health}%` }} /><span>{hud.health}</span></div>
            {hud.bust > 0.2 && <div className="bust-bar"><div style={{ width: `${Math.min(100, (hud.bust / 3) * 100)}%` }} /></div>}
            {hud.eye && <div className={`stealth-eye ${hud.eye}`}>{hud.eye === "open" ? "◉ SEEN" : "◎ HIDDEN"}</div>}
          </div>
          {/* Phase 5 redesign: the ENTIRE right side is one flex stack —
              phone → stars/cash → panel row → popups → vehicle panel →
              speedometer — so siblings can never overlap at any size. */}
          <div className="hud-right">
            <div className="hud-topright">
              <div className={`stars ${starPulse ? "pulse" : ""}`} aria-label={`Wanted ${hud.wanted} stars`}>
                {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= hud.wanted ? "on" : ""}>★</span>)}
              </div>
              <div className="cash">${hud.cash.toLocaleString()}</div>
              {hud.lootCount > 0 && <div className="loot-chip" title="Stolen goods — fence them at Coral Pawn or Lina's">STASH ${hud.loot.toLocaleString()} <span>· {hud.lootCount} item{hud.lootCount > 1 ? "s" : ""}</span></div>}
              {hud.armed && hud.weapon === "pistol" && <div className="ammo-chip" title="Pistol ammo — click or J to fire">PISTOL · {hud.ammo}</div>}
              <div className="hud-meta">Tokens {hud.tokens}/6 · {players.length + 1} player{players.length ? "s" : ""} · GFX {quality.toUpperCase()}</div>
            </div>
            <div className="hud-right-row">
              <button type="button" className="phone-fab" aria-label="Open phone (U)" onClick={() => setPhoneOpen(true)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.4" /><path d="M10.8 18.6h2.4" /></svg>
              </button>
              <button type="button" className="panel-toggle" onClick={() => setPanelOpen((v) => !v)}>Panel</button>
            </div>
            {popup && <div className="cash-popup">{popup}</div>}
            <div className="hud-right-flex" />
            {driving && (
              <div className="car-bars">
                <div className="car-bar"><span>FUEL</span><div className="car-bar-track"><div className={`car-bar-fill fuel ${hud.fuel < 20 ? "low" : ""}`} style={{ width: `${hud.fuel}%` }} /></div><b>{hud.fuel}%</b></div>
                <div className="car-bar"><span>DMG</span><div className="car-bar-track"><div className={`car-bar-fill dmg ${hud.damage > 60 ? "bad" : ""}`} style={{ width: `${hud.damage}%` }} /></div><b>{hud.damage}%</b></div>
              </div>
            )}
            {hud.armed && !driving && (
              <button type="button" className="weapon-chip" onClick={() => { G.weaponSel = G.weaponSel === "pistol" ? "fist" : "pistol"; }}>
                <span className="keycap">Q</span>{hud.weapon === "pistol" ? "PISTOL" : "FISTS"}
              </button>
            )}
            {driving && <div className="speedo"><div className="speedo-arc" style={{ ["--speed" as string]: `${Math.min(100, hud.speed / 1.4)}%` }} /><strong>{hud.speed}</strong><span>km/h</span></div>}
          </div>
          {hud.objective && (
            <div className="objective-banner"><span className="objective-district">{hud.district}</span><span className="objective-label">{M.active?.title}</span><span className="objective-text">{hud.objective}{hud.dist ? ` · ${hud.dist}m` : ""}{M.phase === "play" ? ` · ${Math.floor(hud.timer / 60)}:${String(hud.timer % 60).padStart(2, "0")}` : ""}</span></div>
          )}
          <div className="prompt-stack">
            {nearVehicle && !driving && !hud.prompt && <p className="interaction-prompt"><span className="keycap">E</span>Enter car<span className="prompt-sub">hold — break in</span></p>}
            {hud.prompt && <PromptPill text={hud.prompt} warn={hud.promptWarn} />}
            {hud.holdLabel && (
              <div className="hold-bar"><span>{hud.holdLabel}</span><div className="hold-track"><div style={{ width: `${hud.holdP * 100}%` }} /></div></div>
            )}
          </div>
          {banner && <div className={`mission-banner ${banner.ok ? "ok" : "bad"}`}>{banner.text}</div>}
          <div className="controls"><b>WASD</b> Move <i /><b>E</b> Interact · hold: rob / break in <i /><b>G</b> Garage <i /><b>X</b> Crouch <i /><b>Q</b> Weapon <i /><b>V</b> 1st person <i /><b>U</b> Phone <i /><b>M</b> Map <i /><b>ESC</b> Pause</div>
        </section>
      )}

      {photoMode && started && (
        <div className="photo-bar">
          <span>Photo mode — H or U to exit · drag to look</span>
          <button type="button" onClick={capturePhoto}>Capture ⏎</button>
        </div>
      )}

      {missionResult && started && (
        <div className="debrief glass" role="dialog" aria-label="Mission debrief">
          <div className={`debrief-kicker ${missionResult.ok ? "ok" : "bad"}`}>{missionResult.ok ? "MISSION COMPLETE" : "MISSION FAILED"}</div>
          <div className="debrief-title">{missionResult.title}</div>
          {missionResult.ok ? (
            <div className="debrief-lines">
              <div><span>Reward</span><b>+${missionResult.reward.toLocaleString()}</b></div>
              {missionResult.timeLeft > 0 && <div><span>Time remaining</span><b>{Math.floor(missionResult.timeLeft / 60)}:{String(missionResult.timeLeft % 60).padStart(2, "0")}</b></div>}
              <div><span>Balance</span><b>${hud.cash.toLocaleString()}</b></div>
            </div>
          ) : (
            <div className="debrief-lines"><div><span>Reason</span><b>{missionResult.reason}</b></div></div>
          )}
          <button type="button" className="debrief-btn" onClick={() => setMissionResult(null)}>Continue ⏎</button>
        </div>
      )}

      {garageZoneId && (
        <GaragePanel zoneId={garageZoneId} onClose={() => setGarageZoneId(null)} />
      )}
      {charOpen && (
        <CharacterSelect selectedId={charChoice.id} variant={charChoice.variant} started={started}
          onSelect={pickCharacter} onVariant={pickVariant}
          onDone={() => { if (started) closeCharSelect(); else { closeCharSelect(); startGame(true); } }} />
      )}

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
        onPhotoMode={enterPhotoMode}
        onChangeCharacter={() => { setPhoneOpen(false); G.requestCharSelect = true; }}
        onContact={(name, line, hint) => {
          setPhoneOpen(false);
          // Phase 5 Step 7a: Lina (after Ch.2) and Voss (after Ch.4) offer
          // their side-story arcs by phone — calling them starts the next
          // unplayed part instead of the ambient chat.
          const side = name === "Lina Park" ? "lina" : name === "Det. Mara Voss" ? "voss" : null;
          if (side && started && !M.active && !dialogueRef.current) {
            const unlocked = side === "lina" ? M.storyIndex >= 2 : M.storyIndex >= 4;
            const next = unlocked ? nextSideMission(side, M.side[side]) : null;
            if (next) { startMission(next); return; }
          }
          beginDialogue([{ who: name, text: line }, { who: name, text: hint }], () => {});
        }} />

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
                  <button type="button" className="big-btn ghost" onClick={() => tryOpenCharSelect()}>Character</button>
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

      {introIdx >= 0 && G.settings.letterbox && <><div className="letterbox top" /><div className="letterbox bottom" /></>}
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

      {/* Phase 5 Step 7b: cinematic subtitles replace the old dialogue box.
          Letterbox bars (toggleable), speaker in accent caps, typewriter
          reveal synced to the dialogue blips; E / Enter / click advances —
          first press completes the line, second moves on. */}
      {(dialogue || choiceFor) && G.settings.letterbox && <><div className="letterbox top" /><div className="letterbox bottom" /></>}
      {barkUi && !dialogue && (
        <div className={`bark-sub sub-${G.settings.subSize.toLowerCase()} ${G.settings.subBg ? "with-bg" : ""}`} aria-live="polite">
          <span className="bark-who">{barkUi.who}</span>{barkUi.text}
        </div>
      )}
      {dialogue && (
        <div className={`subtitle-bar sub-${G.settings.subSize.toLowerCase()} ${G.settings.subBg ? "with-bg" : ""}`} role="dialog" aria-label="Dialogue" onClick={advanceDialogue}>
          <div className="subtitle-who">{dialogue.lines[dialogue.idx].who}</div>
          <p className="subtitle-text">{dialogue.lines[dialogue.idx].text.slice(0, subShown)}<span className="subtitle-caret">{subShown < dialogue.lines[dialogue.idx].text.length ? "" : " ▸"}</span></p>
          <div className="subtitle-hint">{dialogue.idx + 1}/{dialogue.lines.length} · E</div>
        </div>
      )}
      {choiceFor?.choice && (
        <div className="choice-box" role="dialog" aria-label="Your choice">
          <div className="choice-kicker">Your call, Rayan</div>
          {choiceFor.choice.options.map((opt) => (
            <button key={opt.flag} type="button" className="choice-btn" onClick={() => resolveChoice(choiceFor, opt.flag, opt.reply)}>{opt.label}</button>
          ))}
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
            <h3 className="settings-head">Settings</h3>
            <div className="settings-list">
              <label><span>Camera shake</span><input type="checkbox" checked={G.settings.shake} onChange={(e) => { G.settings.shake = e.target.checked; persistSettings(); showPopup(`Camera shake ${e.target.checked ? "on" : "off"}`); }} /></label>
              <label><span>Post FX (bloom / grade)</span><input type="checkbox" checked={postFx} onChange={(e) => { G.settings.postFx = e.target.checked; persistSettings(); setPostFx(e.target.checked); }} /></label>
              <label><span>Shadows</span><input type="checkbox" checked={G.settings.shadows} onChange={(e) => { G.settings.shadows = e.target.checked; persistSettings(); showPopup(`Shadows ${e.target.checked ? "on" : "off"}`); }} /></label>
              <label><span>Field of view · {G.settings.fov}°</span><input type="range" min={50} max={75} step={1} defaultValue={G.settings.fov} onChange={(e) => { G.settings.fov = Number(e.target.value); persistSettings(); }} /></label>
            </div>
            <h3 className="settings-head">Graphics · quality {quality.toUpperCase()}</h3>
            <div className="seg-row" role="group" aria-label="Quality tier">
              {(["low", "medium", "high"] as QualityTier[]).map((t) => (
                <button key={t} type="button" className={`seg-btn ${quality === t ? "active" : ""}`} onClick={() => { setTier(t); setQualityState(t); showPopup(`Quality: ${t}`); }}>{t}</button>
              ))}
            </div>
            <p className="settings-note">Low: no composer, 1024 shadows, procedural textures. Medium: + CC0 photo textures at 512, water shader. High: + SSAO, stronger bloom, CC0 at full size.</p>
            <h3 className="settings-head">Subtitles</h3>
            <div className="seg-row" role="group" aria-label="Subtitle size">
              {(["S", "M", "L"] as const).map((s) => (
                <button key={s} type="button" className={`seg-btn ${G.settings.subSize === s ? "active" : ""}`} onClick={() => { G.settings.subSize = s; persistSettings(); showPopup(`Subtitle size ${s}`); }}>{s}</button>
              ))}
            </div>
            <div className="settings-list">
              <label><span>Subtitle background</span><input type="checkbox" defaultChecked={G.settings.subBg} onChange={(e) => { G.settings.subBg = e.target.checked; persistSettings(); }} /></label>
              <label><span>Ambient barks as subtitles</span><input type="checkbox" defaultChecked={G.settings.subBarks} onChange={(e) => { G.settings.subBarks = e.target.checked; persistSettings(); }} /></label>
              <label><span>Letterbox bars in dialogue</span><input type="checkbox" defaultChecked={G.settings.letterbox} onChange={(e) => { G.settings.letterbox = e.target.checked; persistSettings(); }} /></label>
            </div>
            <div className="dialog-actions">
              <button type="button" className="primary" onClick={() => setPaused(false)}>Resume</button>
              <button type="button" onClick={() => { setPaused(false); G.requestCharSelect = true; }}>Change character</button>
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
              <div><dt>Space</dt><dd>Jump</dd></div><div><dt>E / F</dt><dd>Enter car · doors · buy · advance dialogue</dd></div>
              <div><dt>Click / J</dt><dd>Punch — or fire the pistol once you find one</dd></div>
              <div><dt>Q / Tab</dt><dd>Weapon selector — fists ↔ pistol</dd></div>
              <div><dt>X / Ctrl</dt><dd>Crouch — slower, stealthier pickpockets, harder to spot</dd></div>
              <div><dt>Behind a ped + E</dt><dd>Pickpocket (cash or loot for your stash)</dd></div>
              <div><dt>Hold E</dt><dd>Rob a shop till (3s) · break into a locked car (1.5s)</dd></div>
              <div><dt>G</dt><dd>Garage car select (villa garage / Lina's)</dd></div>
              <div><dt>R (in car, at garage)</dt><dd>Repair damage + broken windows for cash</dd></div>
              <div><dt>V</dt><dd>First-person camera (drag to look) — works in cars too</dd></div>
              <div><dt>Swim</dt><dd>Wade past the wet sand and you swim; paddle to shore to climb out</dd></div>
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
