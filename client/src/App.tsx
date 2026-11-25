import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentRef, type FormEvent, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise, SMAA, BrightnessContrast, HueSaturation, SSAO, ChromaticAberration, SSR } from "@react-three/postprocessing";
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
import { G, resetAfterArrest, resetAfterWasted, windLabel, LASTCAR, FLEET } from "./game/store";
import Tram from "./components/Tram";
import { TRAM, TRAM_MAP_LINE, TRAM_STOPS } from "./game/tram";
import { currentSeason } from "./game/season";
import { M, NGP, startPlay, startPlayAt, recordAttempt, endMission, persist as persistMission, altActive } from "./game/missionState";
import { STORY_MISSIONS, SIDE_MISSIONS, PAIR_MISSIONS, REPEATABLE, INTRO_PANELS, ENDING_PANEL, nextSideMission, type DialogueLine, type MissionDef } from "./game/missions";
import { pushNews } from "./game/feed";
import Phase7Systems from "./components/Phase7";
import Phase8Systems from "./components/Phase8";
import Phase9Systems from "./components/Phase9";
import Phase17Systems from "./components/Phase17";
import BusRide from "./components/BusRide";
import StaffWorld from "./components/StaffWorld";
import { BUS, BUS_STOPS_RIDE } from "./game/bus";
import Phase9Ui from "./components/Phase9Ui";
import { jobTarget } from "./game/jobs";
import { currentMiniUi, clearClothingOverride, type MiniUi } from "./game/phase8";
import { galleryAdd, clearLookOverride } from "./game/phase9";
import { padCam } from "./game/gamepad";
import { perf, DPR_LADDER, tierDprCap, autoDropTier, manualTier, showFps, setShowFps, reflectionMode, REFLECTION_LABEL, setReflFx } from "./game/perf";
import { isBind, BIND_ACTIONS, binds, setBind, resetBinds, codeLabel, type BindAction } from "./game/keybinds";
import { activeSlot, switchSlot, slotSummary, SLOT_COUNT } from "./game/saveslots";
import { applyCarReflTier } from "./components/CarBody";
import { THEMES, loadTheme, saveTheme, type GameTheme } from "./themes";
import { ROAD_COORDS, FUEL_STATIONS, districtAt, isBlocked, routePoints, FARM_ROADS } from "./world";
import { skyEnvTexture, setNormalsEnabled } from "./textures";
import { gates, initQuality, runFpsSampleOnce, type QualityTier } from "./game/quality";
import Weather from "./components/Weather";
import Combat from "./components/Combat";
import Interiors from "./components/Interiors";
import Interactions from "./components/Interactions";
// Phase 12 code-splitting: the four heavy DOM overlays (garage panel,
// mod menu, character select, phone) are lazy chunks, latch-mounted on
// first open below so their internal state survives close/reopen
// exactly as the static mounts did. Interiors/Phase7-9 stay static:
// they own always-running world logic, not just UI.
const GaragePanel = lazy(() => import("./components/GaragePanel"));
const ModMenu = lazy(() => import("./components/ModMenu"));
import { setCc0Deferred } from "./cc0Textures";
import { nowS } from "./game/store";
import { inNorth, onIsland, NORTH_ROAD_X, NORTH_ROAD_Z } from "./world";
const CharacterSelect = lazy(() => import("./components/CharacterSelect"));
import { POSTER_PANELS } from "./posterData";
const Phone = lazy(() => import("./components/Phone"));
import { loadCharacterChoice, persistCharacterChoice, presetById } from "./game/characters";
import { gyroYawTrim } from "./game/gyro";
import { stashTotal, persistSettings, toast as gameToast, syncWeaponMirrors } from "./game/store";
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

// Phase 10: chromatic aberration offset (radial modulation keeps the
// centre clean; ~0.45% of the half-frame at the corners)
const CA_OFFSET = new THREE.Vector2(0.00045, 0.00045);

// Phase 11: screen-space reflections (High tier only) — the `SSR`
// component from @react-three/postprocessing@2.19.1, backed by its
// vendored screen-space-reflections SSREffect. NOTE: that library's
// .d.ts advertises newer prop names (MAX_STEPS, rayStep…) that the
// vendored runtime silently ignores — the options that actually take
// effect (verified in node_modules source) are the ones below:
// resolutionScale renders the G-buffer + reflection targets at a
// fraction of the frame; maxRoughness 0.32 keeps rays on glossy
// surfaces only (wet asphalt ~0.15–0.45 when raining, puddles 0.05,
// glass ~0.1, car paint ~0.3) so matte walls/floors never shimmer;
// distance 26 covers a street width; missed rays fall back to the
// PMREM sky probe, so a miss degrades to the Phase 5 look instead of
// black. The extra runtime-only keys ride in via a cast for that
// reason.
// Phase 14 (stability pass after the Retina-Mac black-screen report):
// the march is cheaper — 12 steps / 3 refine (was 20/5) at 0.35
// resolution scale (was 0.5) — and SSR never runs alongside SSAO
// (see the composer below): two G-buffer-heavy screen-space effects
// at once was a large part of the crash/RAM stack.
const SSR_OPTS = {
  intensity: 1,
  distance: 26,
  steps: 12,
  refineSteps: 3,
  maxRoughness: 0.32,
  thickness: 4,
  maxDepthDifference: 4,
  blur: 0.5,
  blurKernel: 1,
  blurSharpness: 10,
  jitter: 0.3,
  jitterRoughness: 0.2,
  blend: 0.9,
  correction: 1,
  ior: 1.45,
  missedRays: true,
  useNormalMap: true,
  useRoughnessMap: true,
  resolutionScale: 0.35,
  velocityResolutionScale: 0.35,
} as Record<string, unknown>;

// ---- Phase 14: composer crash-proofing. The EffectComposer (and
// especially the vendored SSR effect) used to be hot-swapped INSIDE
// one long-lived composer: a tier/reflection toggle could leave stale
// G-buffer state on screen (the electric-blue normal-buffer frame a
// player reported) or take the canvas black entirely. Two defences:
//  1. the composer gets a React key from tier+reflFx+postFx, so any
//     change REMOUNTS it cleanly instead of mutating it in place;
//  2. this boundary: any composer/effect error kills post-processing
//     for the REST OF THE SESSION (module-level flag, so remounts
//     can't resurrect it) and the game keeps rendering plainly.
const composerKill = { dead: false };
class ComposerBoundary extends Component<{ children: ReactNode }, { dead: boolean }> {
  state = { dead: composerKill.dead };
  static getDerivedStateFromError() { return { dead: true }; }
  componentDidCatch(err: unknown) {
    composerKill.dead = true;
    console.warn("[Harborfall] Post-processing disabled after an error:", err);
    gameToast("Post-processing hit a graphics error — effects are off for this session so the game stays stable.");
  }
  render() { return this.state.dead || composerKill.dead ? null : this.props.children; }
}

const initialRoom = import.meta.env.VITE_MULTIPLAYER_ROOM || "downtown";
const tmpV = new THREE.Vector3();
const tmpOff = new THREE.Vector3(); // Phase 8: gamepad orbit scratch (no per-frame allocation)
const tmpSph = new THREE.Spherical();
// (Phase 5: the composer is gated by the quality tier now, not by pointer
// type — see game/quality.ts. Auto-detection still starts coarse-pointer
// devices on Low/Medium.)

interface FpState { on: boolean; yaw: number; pitch: number; }

/** Phase 9 free-aim look state (module-shared: App's mouse handlers
 * write it, CameraRig reads it). Yaw seeds from the player heading. */
const aimState = { yaw: 0, pitch: 0 };
const mouseAim = { held: false };

interface SweepState { t: number; dur: number; cx: number; cz: number; }

function CameraRig({ target, camFar, fp, orbit, sweep }: { target: RefObject<THREE.Vector3>; camFar: RefObject<boolean>; fp: RefObject<FpState>; orbit: boolean; sweep: { current: SweepState | null } }) {
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (!target.current) return;
    const cam = camera as THREE.PerspectiveCamera;
    // ---- Phase 6 spawn-in sweep: high/wide over the district, easing
    // down to the follow position over ~2.6 s (skippable — App clears
    // the sweep ref on any input) ----
    if (sweep.current) {
      const sw = sweep.current;
      sw.t += delta;
      const p = Math.min(1, sw.t / sw.dur);
      if (controls.current) controls.current.enabled = false;
      if (p >= 1) { sweep.current = null; if (controls.current) controls.current.enabled = true; }
      else {
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
        const tx = target.current.x, tz = target.current.z;
        const ox = tx + (sw.cx - tx) * (1 - e) + Math.sin(G.playerHeading) * -6.5 * e;
        const oz = tz + (sw.cz - tz) * (1 - e) + Math.cos(G.playerHeading) * -6.5 * e;
        const oy = 1.6 + 34 * (1 - e);
        camera.position.set(ox, oy, oz);
        camera.lookAt(tx, 1.2, tz);
        return;
      }
    }
    // impact shake (collision-driven amplitude, gated by the shake setting)
    const applyShake = () => {
      if (G.settings.shake && G.shakeAmp > 0.004) {
        camera.position.x += (Math.random() - 0.5) * G.shakeAmp * 0.35;
        camera.position.y += (Math.random() - 0.5) * G.shakeAmp * 0.3;
        G.shakeAmp *= Math.exp(-5.5 * delta);
      }
    };
    // ---- Phase 9 free-aim: hold right-mouse (or gamepad LT) on foot —
    // an over-shoulder camera with a narrowed FOV; Combat fires along
    // the camera ray while G.aiming is set ----
    if (G.aiming && !G.driving && !G.interior && !orbit) {
      if (controls.current) controls.current.enabled = false;
      const fx = Math.sin(aimState.yaw), fz = Math.cos(aimState.yaw);
      tmpV.copy(target.current);
      camera.position.set(tmpV.x - fx * 3.1 + fz * 0.95, tmpV.y + 1.62, tmpV.z - fz * 3.1 - fx * 0.95);
      const cp = Math.cos(aimState.pitch);
      camera.lookAt(tmpV.x + fx * cp * 12, tmpV.y + 1.45 + Math.sin(aimState.pitch) * 12, tmpV.z + fz * cp * 12);
      const aimFov = G.settings.fov - 14;
      if (Math.abs(cam.fov - aimFov) > 0.4) { cam.fov += (aimFov - cam.fov) * 0.25; cam.updateProjectionMatrix(); }
      applyShake();
      return;
    }
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
    // Phase 8 gamepad: right-stick orbit — rotate the camera offset
    // around the (already damped) target, then let OrbitControls settle
    if ((padCam.yaw !== 0 || padCam.pitch !== 0) && !orbit) {
      const yaw = padCam.yaw, pitch = padCam.pitch;
      padCam.yaw = 0; padCam.pitch = 0;
      tmpSph.setFromVector3(tmpOff.copy(camera.position).sub(controls.current.target));
      tmpSph.theta -= yaw;
      tmpSph.phi = THREE.MathUtils.clamp(tmpSph.phi + pitch, 0.18, 1.45);
      camera.position.copy(controls.current.target).add(tmpOff.setFromSpherical(tmpSph));
    }
    controls.current.autoRotate = orbit;
    controls.current.autoRotateSpeed = 0.65;
    controls.current.maxDistance = orbit ? 8 : G.interior ? 6.5 : camFar.current ? 26 : 15;
    controls.current.minDistance = orbit ? 5 : 4;
    // Phase 21: speed sensation, tuned — the widening is capped at
    // +8° (it ran to +14°) on a gentler slope, and the Speed FOV
    // setting turns it off entirely (FOV then sits at the slider).
    const targetFov = G.settings.fov + (G.settings.speedFov ? Math.min(8, G.speedKph / 14) : 0);
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

/** Phase 8 smoothness governor: dynamic resolution + continuous
 * adaptive quality (game/perf.ts holds the policy). Samples frame time
 * over rolling 1 s windows INSIDE gameplay only; applies DPR through
 * gl.setPixelRatio without remounting the canvas. */
function PerfGovernor({ active }: { active: boolean }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, winT: 0, lastStep: 0, highSince: 0, lowFpsSince: 0, idx: -1 });
  useFrame((_, delta) => {
    const a = acc.current;
    if (!active) { a.frames = 0; a.winT = 0; a.lowFpsSince = 0; return; }
    a.frames += 1;
    a.winT += delta;
    if (a.winT < 1) return;
    const fps = a.frames / a.winT;
    a.frames = 0; a.winT = 0;
    perf.fps = fps;
    const now = performance.now() / 1000;
    const cap = tierDprCap(G.settings.quality);
    // ladder index for the current cap (start at the cap, only adapt down/up within it)
    const capIdx = DPR_LADDER.reduce((best, v, i) => (v <= cap + 0.001 ? i : best), 0);
    if (a.idx < 0 || a.idx > capIdx) a.idx = capIdx;
    const canStep = now - a.lastStep > 2.5;
    if (fps < 47 && a.idx > 0 && canStep) {
      a.idx -= 1; a.lastStep = now; a.highSince = 0;
    } else if (fps > 57 && a.idx < capIdx) {
      a.highSince += 1;
      if (a.highSince >= 5 && canStep) { a.idx += 1; a.lastStep = now; a.highSince = 0; }
    } else a.highSince = 0;
    const dpr = DPR_LADDER[a.idx];
    if (Math.abs(dpr - perf.dpr) > 0.001) { perf.dpr = dpr; gl.setPixelRatio(dpr); }
    // adaptive tier: sustained < 40 FPS for 8 s → one notch down
    if (fps < 40) {
      if (a.lowFpsSince === 0) a.lowFpsSince = now;
      else if (now - a.lowFpsSince > 8) { a.lowFpsSince = 0; autoDropTier(); }
    } else a.lowFpsSince = 0;
  });
  return null;
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
    // Phase 9: also keep a downscaled copy in the phone Gallery
    try {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 320; c.height = Math.max(1, Math.round(320 * (img.height / img.width)));
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        galleryAdd(c.toDataURL("image/jpeg", 0.72));
      };
      img.src = url;
    } catch { /* gallery is best-effort; the download already happened */ }
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

interface HudSnap { cash: number; health: number; wanted: number; speed: number; tokens: number; objective: string; dist: number; timer: number; chapter: string; district: string; driving: boolean; bust: number; status: string; storyDone: boolean; weather: string; weatherIcon: string; fuel: number; damage: number; ammo: number; armed: boolean; prompt: string; promptWarn: boolean; loot: number; lootCount: number; eye: string; holdLabel: string; holdP: number; weapon: string; stamina: number; wind: string; mini: MiniUi | null; fps: number; aiming: boolean; }
const initialHud: HudSnap = { cash: G.cash, health: 100, wanted: 0, speed: 0, tokens: 0, objective: "", dist: 0, timer: 0, chapter: "", district: "The Docks", driving: false, bust: 0, status: "", storyDone: false, weather: "Clear", weatherIcon: "☀️", fuel: 100, damage: 0, ammo: 0, armed: false, prompt: "", promptWarn: false, loot: 0, lootCount: 0, eye: "", holdLabel: "", holdP: 0, weapon: "fist", stamina: 100, wind: "Breezy", mini: null, fps: 0, aiming: false };

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
  "Northgate is open: cross the causeway at Lantern St for mansions, Sable Motors and the parking garage.",
  "The city bus runs a loop and stops at the shelters — or steal one and drive the route yourself.",
  "A skiff waits at the pier. Sable Island's lighthouse is a short hop across the bay.",
  "Traffic stops at red lights now. So should you — 4 stars brings out the spike strips.",
  "At 1 star with empty hands, hold B to surrender: a $100 fine beats a cell.",
  "SMGs and shotguns: Sable Arms in Northgate, or browse the Coral Pawn counter with E.",
  "Sprint, swim and pedal burn stamina. The wrap stall at Market Row puts health back.",
  "In a garage with your car? Press M for Lina's mods — resprays, tunes, brakes.",
  "Your phone's Stats app tracks Driving, Shooting and Stamina — perks unlock at 50.",
  "Grab the yellow Sable Cab at Market Row — fares hail you with an amber marker, and clean fast rides tip best.",
  "Amber rings on the road are street races: Docks Sprint, Bay Run, Northgate Loop. Winners take $600.",
  "Businesses pay every morning: the Wraps stall, the Northgate Car Wash, a share of Club Solace. Sleep at home to settle up.",
  "Fail a mission? Press R to retry from your last checkpoint with a fresh clock.",
  "The causeway toll is $5 at a crawl — or smash the barrier and take the star. Speed cameras fine $75 over ~100 km/h.",
  "Hold right-mouse to free-aim over the shoulder — LT on a gamepad.",
  "The Sable Sparrow at Sable Field actually flies: Shift climbs, Ctrl descends, land gently.",
  "Six stars exist now. Earn the sixth and the Harbour Guard rolls out in force.",
  "Named townsfolk keep real schedules — talk to them, and Port Sable remembers kindness.",
  "Sable Cuts and Port Ink on Market Row: new hair, new ink, cash only, 07:00–23:00.",
];
/** Phase 6 staged loading: each label is a REAL construction stage —
 * World/GameSystems sub-trees mount as the stage counter advances, and
 * stage 5 completes only when the physics engine promise resolves. */
const LOAD_STAGE_LABELS = [
  "Loading textures",
  "Building Port Sable",
  "Raising Coral Shores",
  "Sailing to Northgate",
  "Placing traffic & people",
  "Warming up physics",
  "Finalising",
];
const AREA_CARDS: Record<string, { title: string; sub: string }> = {
  main: { title: "THE DOCKS", sub: "Port Sable" },
  coral: { title: "CORAL SHORES", sub: "Across the bay" },
  north: { title: "NORTHGATE", sub: "The luxury district" },
  island: { title: "SABLE ISLAND", sub: "Mind the lighthouse" },
};

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

// ---- Phase 20: END CREDITS. An original Harborfall roll — the
// city, the cast by name, the systems, and a thank-you. Played as a
// slow scroll over the live city (the Canvas keeps rendering behind
// the overlay; input is locked except Skip / Esc). ~45 s end to end.
// Every name here belongs to Harborfall; the only nod to any other
// work is the factual not-affiliated line, as in the README. ----
const CREDITS_LINES: Array<[string, string]> = [
  ["HARBORFALL", "Port Sable — a harbour-city adventure"],
  ["Starring", "Rayan Kade — home again, five years on"],
  ["", "Tamim Kade — the name on the last page"],
  ["", "Lina Park — Lina's Garage, Market Row"],
  ["", "Old Elias — the harbour provides"],
  ["", "Detective Mara Voss — Harbour Patrol"],
  ["", "Ines Marlo — editor, the Harbour Wire"],
  ["", "Victor Solano — the ledger, closed"],
  ["The City", "Port Sable · Coral Shores · Northgate · Sable Island · Sable Downs"],
  ["Systems", "Harborfall Core physics (C++ / WASM, TypeScript mirror)"],
  ["", "Traffic, patrols & dispatch · the Sable Line · the Cityliner"],
  ["", "Businesses, staff & SableBank · the Sable Cup · drift scoring"],
  ["", "Weather & seasons · day cycle · ray-traced-style reflections"],
  ["Music & Sound", "“Port Sable Sunset” — an original opening theme"],
  ["", "All sound synthesised live in WebAudio — no audio files"],
  ["Built with", "React Three Fiber · Three.js · TypeScript · Python services"],
  ["", "Every building, boat and business name is original to Harborfall"],
  ["", "Not affiliated with Rockstar Games or Grand Theft Auto"],
  ["Thank you", "For playing — for every fare, fence and fish."],
  ["", "Port Sable is yours now. The harbour provides."],
];

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
  const [camFlash, setCamFlash] = useState(false); // Phase 7: speed-camera flash
  const [starPulse, setStarPulse] = useState(false);
  const [ending, setEnding] = useState(false);
  const [credits, setCredits] = useState(false); // Phase 20: end-credits overlay (ending panel + Phone → Story)
  const [panelOpen, setPanelOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  // ---- Phase 4 state: character select, garage panel, photo mode, debrief
  const [charChoice, setCharChoice] = useState(loadCharacterChoice);
  const [charOpen, setCharOpen] = useState(false);
  const [garageZoneId, setGarageZoneId] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [postFx, setPostFx] = useState(G.settings.postFx);
  // ---- Phase 14: key-remap capture (Settings) — while a row is
  // capturing, the next physical keydown (capture phase, so the game
  // never sees it) becomes the binding; conflicts are refused ----
  const [captureBind, setCaptureBind] = useState<BindAction | null>(null);
  const [bindMsg, setBindMsg] = useState("");
  const [, setBindTick] = useState(0);
  useEffect(() => {
    if (!captureBind) return;
    const cap = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === "Escape") { setCaptureBind(null); setBindMsg(""); return; }
      const r = setBind(captureBind, e.code);
      if (r.ok) { setCaptureBind(null); setBindMsg(""); }
      else setBindMsg(`That key already does: ${r.conflict}. Pick another.`);
      setBindTick((v) => v + 1);
    };
    window.addEventListener("keydown", cap, true);
    return () => window.removeEventListener("keydown", cap, true);
  }, [captureBind]);
  // ---- Phase 11: reflection-stack override (polled like postFx) ----
  const [reflFx, setReflFxState] = useState(G.settings.reflFx);
  // ---- Phase 5: quality tier (game/quality.ts owns detection + gates) ----
  const [quality, setQualityState] = useState<QualityTier>(() => { initQuality(); return G.settings.quality; });
  const qualityRef = useRef(quality);
  useEffect(() => { qualityRef.current = quality; setNormalsEnabled(gates.normalMaps(quality)); applyCarReflTier(); }, [quality]);
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
  // ---- Phase 6 game flow: splash → poster → staged loading → spawn
  // sweep → game. loadStage gates World/GameSystems sub-tree mounting;
  // the progress bar is literally loadStage / LOAD_STAGE_LABELS.length.
  const [flow, setFlow] = useState<"splash" | "poster" | "loading" | "spawn" | "game">("splash");
  const [loadStage, setLoadStage] = useState(0);
  const [physicsReady, setPhysicsReady] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  // Phase 12: lazy-overlay latches — once first opened, the phone and
  // mod menu stay mounted (they hide themselves when closed), so
  // their internal state survives close/reopen as with static mounts
  const [phoneMounted, setPhoneMounted] = useState(false);
  const [modMounted, setModMounted] = useState(false);
  useEffect(() => { if (phoneOpen) setPhoneMounted(true); }, [phoneOpen]);
  useEffect(() => { if (modOpen) setModMounted(true); }, [modOpen]);
  const [areaCard, setAreaCard] = useState<{ title: string; sub: string } | null>(null);
  const [respawnScreen, setRespawnScreen] = useState<"hospital" | "patrol" | null>(null);
  const [fadeOn, setFadeOn] = useState(false);
  const sweepRef = useRef<SweepState | null>(null);
  const startedRef = useRef(false);
  const respawnScreenRef = useRef<"hospital" | "patrol" | null>(null);
  const storyModeRef = useRef(true);
  const visitedRef = useRef<Set<string>>(new Set());
  const respawnAtRef = useRef(0);
  const prevStatusRef = useRef("");
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
    recordAttempt(def.id); // Phase 7: mission stats (Stats app)
    const intro = def.introAlt && altActive(def) ? def.introAlt : def.intro;
    beginDialogue(intro, () => {
      // Phase 5: the Ch.5 choice interrupts between intro and play, once.
      // Phase 9: the post-story pack has its own choice flag (M.packChoice).
      const chosen = def.id === "s5" ? M.choice : M.packChoice;
      if (def.choice && !chosen) { setChoiceFor(def); return; }
      startPlay(def); showBanner(`${def.title} — ${def.giver}`, true);
    });
  }, [beginDialogue, showBanner]);
  const resolveChoice = useCallback((def: MissionDef, flag: string, reply: DialogueLine[]) => {
    if (def.id === "s5") M.choice = flag as "voss" | "elias";
    else M.packChoice = flag;
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
  const reflFxRef = useRef(G.settings.reflFx);

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
  // Phase 8: Thread & Tide override — bumped on shop purchases; picking
  // a character or variant in Character Select CLEARS the override (the
  // documented rule: the select screen is the change-out moment)
  const [clothingKey, setClothingKey] = useState(0);
  useEffect(() => {
    const onCloth = () => setClothingKey((k) => k + 1);
    window.addEventListener("harborfall-clothing-changed", onCloth);
    return () => window.removeEventListener("harborfall-clothing-changed", onCloth);
  }, []);
  // ---- Phase 9 free-aim: right-mouse on the canvas holds aim; mouse
  // movement steers the over-shoulder camera (gamepad LT is the other
  // writer — see gamepad.ts) ----
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 2) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag !== "CANVAS" || G.driving || G.photoMode) return;
      mouseAim.held = true; G.aiming = true;
      aimState.yaw = G.playerHeading; aimState.pitch = 0;
    };
    const up = (e: MouseEvent) => {
      if (e.button === 2 && mouseAim.held) { mouseAim.held = false; G.aiming = false; }
    };
    const move = (e: MouseEvent) => {
      if (!G.aiming || !mouseAim.held) return;
      aimState.yaw -= e.movementX * 0.0032;
      aimState.pitch = Math.max(-0.45, Math.min(0.5, aimState.pitch - e.movementY * 0.0028));
    };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
    };
  }, []);
  const pickCharacter = useCallback((id: string) => {
    clearClothingOverride();
    clearLookOverride(); // Phase 9: the barber/tattoo work was on the old face
    setCharChoice((c) => { const next = { id, variant: c.variant }; persistCharacterChoice(next.id, next.variant); return next; });
    sfx.click();
  }, []);
  const pickVariant = useCallback((v: number) => {
    clearClothingOverride();
    clearLookOverride(); // Phase 9: same rule as clothing
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
  const capturePhoto = useCallback(() => { photoShotRef.current += 1; G.lastPhotoAt = G.timeS; sfx.click(); }, []);

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
  useEffect(() => { let m = true; void loadPhysicsEngine().then((e) => { if (m) { physicsRef.current = e; setPhysicsSource(e.source); setPhysicsReady(true); } }); return () => { m = false; }; }, []);
  // Phase 6 first-load order: CC0 photo textures decode AFTER spawn
  // (they're shared texture objects — they sharpen in place).
  // Phase 15 playability: this now applies on EVERY tier — High used
  // to preload during the loading screen, which put the full CC0
  // decode (the 1.27 MB chunk + image decode) squarely on the path to
  // the first playable frame. beginPlay releases the queue on idle.
  useEffect(() => { setCc0Deferred(true); }, []);

  // ---- Phase 15 survivability: global error net. A runtime error in
  // a system the React boundaries can't see (event handlers, timers,
  // async loads) used to surface as a silently frozen or black canvas.
  // Now: log it, and tell the player ONCE (throttled) in plain words
  // that the game kept running. The Phase 14 ComposerBoundary still
  // owns composer/render failures specifically. ----
  useEffect(() => {
    let lastShown = -60;
    const onErr = (e: ErrorEvent | PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error("[Harborfall] runtime error (game kept running):", e);
      const now = performance.now() / 1000;
      if (now - lastShown > 30) { lastShown = now; gameToast("Something glitched — the game kept running."); }
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onErr); };
  }, []);

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
      // world → map (Phase 6): covers Northgate (z −296) to Coral Shores
      // (z 324) — span 700 around centre (5, 15)
      const S = size / 700;
      const mx = (x: number) => (x - 5) * S + size / 2;
      const mz = (z: number) => (z - 15) * S + size / 2;
      g.fillStyle = "#2c5d84"; g.fillRect(0, 0, size, size); // water everywhere first
      g.fillStyle = mm.bg;
      g.fillRect(mx(-124), mz(-124), (124 + 124) * S, (128 + 124) * S); // Port Sable
      g.fillRect(mx(28), mz(196), (112 - 28) * S, (324 - 196) * S);     // Coral Shores
      g.fillRect(mx(-118), mz(-296), (38 + 118) * S, (-186 + 296) * S); // Northgate
      // Sable Island
      g.beginPath(); g.arc(mx(-64), mz(168), Math.max(2, 17 * S), 0, 7); g.fill();
      g.strokeStyle = mm.road; g.lineWidth = Math.max(1.5, 5 * S);
      for (const c of ROAD_COORDS) {
        g.beginPath(); g.moveTo(mx(c), mz(-124)); g.lineTo(mx(c), mz(128)); g.stroke();
        g.beginPath(); g.moveTo(mx(-124), mz(c)); g.lineTo(mx(124), mz(c)); g.stroke();
      }
      for (const c of CORAL_ROAD_X) { g.beginPath(); g.moveTo(mx(c), mz(200)); g.lineTo(mx(c), mz(320)); g.stroke(); }
      for (const c of CORAL_ROAD_Z) { g.beginPath(); g.moveTo(mx(32), mz(c)); g.lineTo(mx(108), mz(c)); g.stroke(); }
      for (const c of NORTH_ROAD_X) { g.beginPath(); g.moveTo(mx(c), mz(-292)); g.lineTo(mx(c), mz(-190)); g.stroke(); }
      for (const c of NORTH_ROAD_Z) { g.beginPath(); g.moveTo(mx(-114), mz(c)); g.lineTo(mx(34), mz(c)); g.stroke(); }
      // the bridge + the causeway
      g.strokeStyle = "#d9d4c5"; g.lineWidth = Math.max(1.5, 4 * S);
      g.beginPath(); g.moveTo(mx(60), mz(112)); g.lineTo(mx(60), mz(214)); g.stroke();
      g.beginPath(); g.moveTo(mx(-20), mz(-196)); g.lineTo(mx(-20), mz(-110)); g.stroke();
      // Phase 13: the Sable Line loop (teal) + its stations; the big
      // map also gets the LIVE tram dot and your last car's ring
      g.strokeStyle = "#2ee6c8"; g.lineWidth = Math.max(1.2, 2.4 * S);
      g.beginPath();
      TRAM_MAP_LINE.forEach(([x, z], i) => { if (i === 0) g.moveTo(mx(x), mz(z)); else g.lineTo(mx(x), mz(z)); });
      g.closePath(); g.stroke();
      for (const st of TRAM_STOPS) { g.fillStyle = "#0f2c38"; g.beginPath(); g.arc(mx(st.x), mz(st.z), Math.max(2, 3.4 * S), 0, 7); g.fill(); g.strokeStyle = "#2ee6c8"; g.lineWidth = 1.2; g.stroke(); }
      // Phase 17: the Cityliner's stops (amber squares) + its live
      // dot — a filled amber square, distinct from the tram's teal
      // ring and from the small white traffic dots
      for (const st of BUS_STOPS_RIDE) { const r = Math.max(2, 3 * S); g.fillStyle = "#f2b134"; g.fillRect(mx(st.streetX) - r / 2, mz(st.streetZ) - r / 2, r, r); }
      { const r = Math.max(3, 5 * S); g.fillStyle = "#f2b134"; g.fillRect(mx(BUS.x) - r / 2, mz(BUS.z) - r / 2, r, r); g.fillStyle = "#17323e"; g.fillRect(mx(BUS.x) - r / 4, mz(BUS.z) - r / 4, r / 2, r / 2); }
      if (size > 300) {
        g.fillStyle = "#2ee6c8"; g.beginPath(); g.arc(mx(TRAM.x), mz(TRAM.z), Math.max(2.5, 4.4 * S), 0, 7); g.fill();
        g.fillStyle = "#0f2c38"; g.beginPath(); g.arc(mx(TRAM.x), mz(TRAM.z), Math.max(1.2, 2 * S), 0, 7); g.fill();
        if (!G.driving) {
          // Phase 16: every parked FLEET car (owned, persisted) gets
          // the amber ring — numbered when there's more than one
          FLEET.list.forEach((s, i) => {
            const cxp = mx(s.x), czp = mz(s.z);
            g.strokeStyle = "#ffb340"; g.lineWidth = 2;
            g.beginPath(); g.arc(cxp, czp, Math.max(5, 7 * S), 0, 7); g.stroke();
            g.fillStyle = "#ffb340"; g.font = `bold ${Math.max(9, 11 * S)}px sans-serif`; g.textAlign = "center";
            g.fillText(FLEET.list.length > 1 ? `YOUR CAR ${i + 1}` : "YOUR CAR", cxp, czp - Math.max(8, 10 * S));
          });
          // the last-car ring still covers a NON-owned last car (the
          // fleet only holds owned ones); skip it when the fleet
          // already rings the same car
          const inFleet = LASTCAR.save ? FLEET.list.some((e) => e.kind === LASTCAR.save!.kind && Math.abs(e.x - LASTCAR.save!.x) < 1 && Math.abs(e.z - LASTCAR.save!.z) < 1) : false;
          if (LASTCAR.save && !inFleet) {
            const cxp = mx(LASTCAR.save.x), czp = mz(LASTCAR.save.z);
            g.strokeStyle = "#ffb340"; g.lineWidth = 2;
            g.beginPath(); g.arc(cxp, czp, Math.max(5, 7 * S), 0, 7); g.stroke();
            g.fillStyle = "#ffb340"; g.font = `bold ${Math.max(9, 11 * S)}px sans-serif`; g.textAlign = "center";
            g.fillText("YOUR CAR", cxp, czp - Math.max(8, 10 * S));
          }
        }
      }
      const dot = (x: number, z: number, col: string, r: number) => { g.fillStyle = col; g.beginPath(); g.arc(mx(x), mz(z), Math.max(1.4, r * S * 2.2), 0, 7); g.fill(); };
      for (const st of FUEL_STATIONS) dot(st.x, st.z, "#ffb703", 3); // fuel pumps
      for (const c of G.cars) if (!c.storedAway) dot(c.state.x, c.state.z, mm.car, 2.4);
      for (const c of G.traffic) dot(c.x, c.z, mm.car, 2);
      for (const c of G.cops) if (c.active) dot(c.x, c.z, mm.police, 3.4);
      // Phase 15: Sable Downs farm roads (dirt brown) + the live
      // dispatch incident blip — a white-ringed red cross, a colour
      // no other map element uses, so an active call reads instantly
      g.fillStyle = "#7d5c3d";
      for (const r of FARM_ROADS) g.fillRect(mx(r.x - r.w / 2), mz(r.z - r.d / 2), r.w * S, r.d * S);
      if (G.incident) {
        const ix = mx(G.incident.x), iz = mz(G.incident.z), ir = Math.max(4, 7 * S);
        g.strokeStyle = "#ffffff"; g.lineWidth = 2;
        g.beginPath(); g.arc(ix, iz, ir + 2, 0, 7); g.stroke();
        g.strokeStyle = "#e23232"; g.lineWidth = Math.max(2, 3 * S);
        g.beginPath(); g.moveTo(ix - ir, iz); g.lineTo(ix + ir, iz); g.moveTo(ix, iz - ir); g.lineTo(ix, iz + ir); g.stroke();
      }
      if (G.objective && M.phase === "play") dot(G.objective.x, G.objective.z, mm.marker, 4);
      // Phase 7: job / race target dot + the GPS route on the big map
      const jt = jobTarget();
      if (jt && M.phase !== "play") dot(jt.x, jt.z, "#ffb340", 3.6);
      if (size > 300) {
        const tgt: { x: number; z: number } | null = M.phase === "play" && G.objective ? { x: G.objective.x, z: G.objective.z } : jt;
        if (tgt) {
          const pts = routePoints(G.followPos.x, G.followPos.z, tgt.x, tgt.z);
          g.strokeStyle = "#ffb340"; g.lineWidth = Math.max(2, 3.5 * S); g.setLineDash([7, 5]);
          g.beginPath();
          pts.forEach(([x, z], i) => { if (i === 0) g.moveTo(mx(x), mz(z)); else g.lineTo(mx(x), mz(z)); });
          g.stroke(); g.setLineDash([]);
          dot(tgt.x, tgt.z, "#ffb340", 4);
        }
      }
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
        chapter: (M.storyDone ? "Story complete — free roam" : `Chapter ${Math.min(6, M.storyIndex + 1)}: ${STORY_MISSIONS[Math.min(5, M.storyIndex)]?.title ?? ""}`) + (NGP.level > 0 ? ` · NG+ ${NGP.level}` : ""), // Phase 20: NG+ badge rides the chapter line
        district: districtAt(px, pz), driving: G.driving, bust: G.bustTimer, status: G.status, storyDone: M.storyDone,
        weather: G.weather, weatherIcon: WEATHER_META[G.weather].icon,
        fuel: myCar ? Math.round(myCar.fuel) : 100, damage: myCar ? Math.round(myCar.damage) : 0,
        ammo: G.ammo, armed: G.armed, prompt: G.promptText, promptWarn: G.promptWarn,
        loot: stashTotal(), lootCount: G.inventory.length, eye: G.stealthEye,
        holdLabel: G.hold?.label ?? "", holdP: G.hold?.progress ?? 0, weapon: G.weaponSel,
        stamina: Math.round(G.stamina),
        wind: windLabel(G.wind),
        mini: currentMiniUi(), // Phase 8: fishing/gym minigame bar (8 Hz poll)
        fps: showFps() ? Math.round(perf.fps) : 0,
        aiming: G.aiming, // Phase 9: free-aim crosshair
      });
      setCamFlash(nowS() - G.camFlashAt < 0.22);
      // ---- Phase 6 flow bits polled with the HUD: door fade, respawn
      // mini-screen, first-visit area title cards ----
      setFadeOn(nowS() - G.fadeAt < 0.3);
      if (G.status && !prevStatusRef.current) { respawnAtRef.current = performance.now(); const rs = G.status === "wasted" ? "hospital" : "patrol"; respawnScreenRef.current = rs; setRespawnScreen(rs); }
      if (!G.status && respawnScreenRef.current && performance.now() - respawnAtRef.current > 1400) { respawnScreenRef.current = null; setRespawnScreen(null); }
      prevStatusRef.current = G.status;
      if (startedRef.current && !G.status) {
        const zone = onIsland(px, pz) ? "island" : inNorth(px, pz) ? "north" : pz > 150 ? "coral" : "main";
        if (!visitedRef.current.has(zone)) {
          visitedRef.current.add(zone);
          const card = AREA_CARDS[zone];
          setAreaCard(card);
          window.setTimeout(() => setAreaCard((c) => (c === card ? null : c)), 2800);
        }
      }
      // Phase 4/V6: mission debrief + phone-driven requests + settings sync
      if (G.missionResult && G.missionResult.at !== lastMissionAt.current) {
        lastMissionAt.current = G.missionResult.at;
        setMissionResult(G.missionResult);
        window.setTimeout(() => setMissionResult((r) => (r && r.at === lastMissionAt.current ? null : r)), 9000);
      }
      if (G.requestCharSelect) { G.requestCharSelect = false; tryOpenCharSelectRef.current(); }
      if (G.requestCredits) { G.requestCredits = false; setCredits(true); } // Phase 20: Phone → Story → Credits
      // Phase 7: phone Story app replay requests (40% payout, no progress)
      if (G.requestReplayId) {
        const rid = G.requestReplayId; G.requestReplayId = "";
        const def = [...STORY_MISSIONS, ...SIDE_MISSIONS].find((m) => m.id === rid);
        if (def && !M.active) { M.replayId = rid; startMissionRef.current(def); showPopup(`Replaying: ${def.title} (40% payout)`); }
      }
      if (G.settings.postFx !== postFxRef.current) { postFxRef.current = G.settings.postFx; setPostFx(G.settings.postFx); }
      if (G.settings.reflFx !== reflFxRef.current) { reflFxRef.current = G.settings.reflFx; setReflFxState(G.settings.reflFx); }
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
    }, 200); // Phase 8 smoothness: HUD snapshot throttled to 5 Hz (was 8 Hz)
    return () => window.clearInterval(id);
  }, [theme, bigMap]);

  // global shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      initAudio();
      if (isInteractiveTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (dialogueRef.current) {
        // Phase 14: the bound interact key advances dialogue too
        if (key === "e" || key === "enter" || key === " " || isBind(e, "interact")) { e.preventDefault(); advanceDialogue(); }
        return;
      }
      if (choiceRef.current) return; // the Ch.5 choice is answered by click/tap only
      // Phase 4/V6: mission debrief dismiss
      if (missionResult && (key === "enter" || key === "e" || isBind(e, "interact"))) { e.preventDefault(); setMissionResult(null); return; }
      // PDF delta B: photo mode owns H / U / Enter / Esc while active
      if (G.photoMode) {
        if (key === "h" || key === "u" || key === "escape") { e.preventDefault(); exitPhotoMode(); }
        else if (key === "enter") { e.preventDefault(); capturePhoto(); }
        return;
      }
      if (charOpen && (key === "escape" || key === "enter")) { e.preventDefault(); closeCharSelect(); return; }
      if (garageZoneId && key === "escape") { e.preventDefault(); setGarageZoneId(null); return; }
      // Phase 3: contextual interact (doors, mansion gate) — set by
      // Interiors. Phase 14: the key is the player's binding now.
      if (isBind(e, "interact") && G.interact) { e.preventDefault(); G.interact(); return; }
      if (key === "g" && started && G.garageZone) { e.preventDefault(); setGarageZoneId(G.garageZone.id); sfx.click(); return; }
      if ((isBind(e, "weapon") || key === "tab") && started) {
        e.preventDefault();
        // Phase 6: Q cycles every OWNED slot — fists → pistol → SMG →
        // shotgun → bat (Phase 9 adds the bottle throw slot)
        const order = ["fist", "pistol", "smg", "shotgun", "bat", "bottle"] as const;
        const owned = order.filter((w) => w === "fist" || G.weaponOwned[w]);
        const next = owned[(owned.indexOf(G.weaponSel) + 1) % owned.length] ?? "fist";
        G.weaponSel = next;
        syncWeaponMirrors();
        showPopup(next === "fist" ? "Weapon: fists"
          : next === "bat" ? "Weapon: BASEBALL BAT"
          : next === "bottle" ? `Weapon: BOTTLES ×${G.weaponAmmo.bottle} — click to throw`
          : `Weapon: ${next.toUpperCase()} · ${G.weaponAmmo[next as "pistol" | "smg" | "shotgun"]} rounds`);
        return;
      }
      if (key === "v") {
        const fp = fpRef.current;
        fp.on = !fp.on; fp.yaw = 0; fp.pitch = 0;
        G.firstPerson = fp.on;
        showPopup(fp.on ? "Camera: first person — drag to look around" : "Camera: third person");
      }
      else if (key === "escape" || key === "p") { if (credits) { setCredits(false); return; } if (showHelp) setShowHelp(false); else setPaused((v) => !v); } // Phase 20: Esc skips the credits, never pauses under them
      else if (key === "?" || key === "h") { e.preventDefault(); setShowHelp((v) => !v); }
      else if (key === "t") { const i = THEMES.findIndex((t) => t.id === theme.id); applyTheme(THEMES[(i + 1) % THEMES.length]); showPopup(`Theme: ${THEMES[(i + 1) % THEMES.length].name}`); }
      else if (["1", "2", "3", "4", "5"].includes(key)) { const t = THEMES[Number(key) - 1]; if (t) { applyTheme(t); showPopup(`Theme: ${t.name}`); } }
      else if (isBind(e, "map")) {
        // Phase 6 (B1): in a garage zone, behind the wheel, the map key
        // is Lina's mod menu — anywhere else it stays the big map
        if (started && G.garageZone && G.driving) { setModOpen((v) => !v); sfx.click(); }
        else setBigMap((v) => !v);
      }
      else if (key === "y") { cycleWeather(); showPopup(`Weather: ${G.weather}`); }
      else if (isBind(e, "phone")) { setPhoneOpen((v) => !v); sfx.click(); }
      else if (key === "l") { G.dayPaused = !G.dayPaused; showPopup(G.dayPaused ? "Day cycle held (L to resume)" : "Day cycle running"); }
      else if (key === "n") { setMuted(toggleMute()); }
      else if (key === "c") { camFar.current = !camFar.current; showPopup(camFar.current ? "Camera: far" : "Camera: near"); }
      else if (key === "r") {
        if (G.status) respawnRef.current();
        // Phase 7: after a failure, R retries from the last checkpoint
        else if (M.lastFailed && !M.active) {
          const lf = M.lastFailed; M.lastFailed = null;
          endMission(); startPlayAt(lf.def, lf.step, lf.collected);
          showPopup(`Retry from checkpoint ${lf.step + 1} — clock refreshed`);
        }
        else if (M.active) { const def = M.active; startMissionRef.current(def); showPopup("Mission restarted"); }
      }
      else if (key === "enter" && introIdx >= 0) { /* handled by intro buttons */ }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [advanceDialogue, applyTheme, showHelp, showPopup, theme, missionResult, charOpen, garageZoneId, started, exitPhotoMode, capturePhoto, closeCharSelect, credits]);

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

  const effectivePaused = paused || !!dialogue || !!choiceFor || !!hud.status || introIdx >= 0 || !started || showHelp || phoneOpen || charOpen || !!garageZoneId || modOpen;
  // Phase 6: which construction stage the 3D world shows. The poster and
  // character showcase sit over a built Port Sable (stage 1); loading
  // walks the real stages; in game everything is mounted.
  const worldStage = flow === "game" || flow === "spawn" ? 6 : flow === "loading" ? loadStage : 1;
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter") startLoad(true); };
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

  // ---- Phase 6 flow: Play → staged loading → spawn sweep → game ----
  const startLoad = (story: boolean) => {
    initAudio();
    storyModeRef.current = story;
    setLoadStage(0);
    setFlow("loading");
  };
  const beginPlay = () => {
    const story = storyModeRef.current;
    sfx.playStart(); stopMenuTheme(); setStarted(true); startedRef.current = true; setCharOpen(false); savedPosRef.current = null;
    // Phase 15: CC0 textures release on IDLE after spawn-in (never on
    // the path to the first playable frame, any tier) — the shared
    // texture objects sharpen in place when the decode lands.
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => setCc0Deferred(false), { timeout: 2500 });
    else window.setTimeout(() => setCc0Deferred(false), 1200);
    runFpsSampleOnce(); // Phase 5: one 2.5 s sample may step the tier down once
    // spawn-in sweep: start high over the spawn point, ease down to Rayan
    const sx = G.playerPos.x, sz = G.playerPos.z;
    sweepRef.current = { t: 0, dur: 2.6, cx: sx + 30, cz: sz + 44 };
    visitedRef.current = new Set(["main"]);
    setAreaCard(AREA_CARDS.main);
    setFlow("spawn");
    window.setTimeout(() => setAreaCard((c) => (c === AREA_CARDS.main ? null : c)), 3400);
    if (story && M.storyIndex === 0 && !localStorage.getItem("harborfall-intro")) setIntroIdx(0);
    else if (story && M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]);
  };
  // Phase 20: credits run ~45 s, then close themselves; Esc skips
  // at any point (the Skip button does the same). The overlay is a
  // plain DOM layer over the Canvas — the city keeps rendering.
  useEffect(() => {
    if (!credits) return;
    // input lock: dialogueActive is the game's standing "player
    // can't act" gate (Player/Combat/prompts all honour it), so the
    // city renders and lives behind the roll while only Skip/Esc —
    // handled here and in the main key handler — get through.
    G.dialogueActive = true;
    const to = window.setTimeout(() => setCredits(false), 47000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCredits(false); };
    window.addEventListener("keydown", onKey);
    return () => { G.dialogueActive = false; window.clearTimeout(to); window.removeEventListener("keydown", onKey); };
  }, [credits]);
  // splash: brief brand beat, then the poster
  useEffect(() => {
    if (flow !== "splash") return;
    const id = window.setTimeout(() => setFlow("poster"), 1500);
    return () => window.clearTimeout(id);
  }, [flow]);
  // staged loading: stages 0–4 advance as their sub-trees mount (two
  // frames apart so each stage's construction actually happens between
  // bar steps); stage 5 waits for the real physics promise; then spawn.
  useEffect(() => {
    if (flow !== "loading") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (loadStage < 4) setLoadStage(loadStage + 1);
        else if (loadStage === 4) setLoadStage(5);
        else if (loadStage === 5 && physicsReady) setLoadStage(6);
        else if (loadStage >= 6) beginPlay();
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, loadStage, physicsReady]);
  // spawn sweep: any key or tap skips straight into the game
  useEffect(() => {
    if (flow !== "spawn") return;
    const skip = () => { sweepRef.current = null; setFlow("game"); };
    const to = window.setTimeout(skip, 2900);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => { window.clearTimeout(to); window.removeEventListener("keydown", skip); window.removeEventListener("pointerdown", skip); };
  }, [flow]);
  const nextStory = () => { if (M.storyIndex < 6) startMission(STORY_MISSIONS[M.storyIndex]); };
  const nextRepeatable = () => startMission(REPEATABLE[M.repeatIndex % REPEATABLE.length]);

  return (
    <main className={`game-shell ${shake ? "shake" : ""}`} onContextMenu={(e) => e.preventDefault()}>
      <Canvas shadows="soft" dpr={[1, 1.5]} camera={{ position: [0, 7, 124], fov: 58, near: 0.1, far: 420 }}
        onCreated={({ gl }) => {
          // ---- Phase 14: WebGL context-loss recovery. A GPU reset
          // (driver hiccup, memory pressure) used to leave a permanent
          // black canvas. preventDefault lets the browser restore the
          // context; meanwhile we shed the heavy stack — reflections
          // off, tier to Medium, both persisted — and tell the player
          // in plain words what happened and why.
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setReflFx(false); setReflFxState(false);
            manualTier("medium"); setQualityState("medium");
            gameToast("Graphics were reset for stability — reflections off, quality set to Medium. (The GPU dropped the drawing context.)");
          });
        }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: THREE.SRGBColorSpace }}>
        <Suspense fallback={null}>
          <EnvSetup theme={theme} quality={quality} />
          <World theme={theme} night={nightBucket} quality={quality} stage={worldStage} reflFx={reflFx} />
          <Collectibles targetRef={followRef} paused={effectivePaused}
            onCollect={() => { tokenCountRef.current += 1; G.tokens = tokenCountRef.current; sfx.pickup(); showPopup("Harbour token +$25"); G.cash += 25; }} />
          <Vehicle playerPositionRef={playerPositionRef} vehiclePositionRef={vehiclePositionRef} vehicleStateRef={vehicleStateRef}
            driving={driving} paused={effectivePaused} onDrivingChange={setDriving} onExit={exitVehicle}
            onNearVehicleChange={setNearVehicle} physicsRef={physicsRef} themeAccent={theme.carAccent} />
          <Player positionRef={playerPositionRef} rotationRef={playerRotationRef} driving={driving} paused={effectivePaused}
            preset={presetById(charChoice.id)} variant={charChoice.variant} clothingKey={clothingKey} showcase={charOpen} />
          <GameSystems paused={effectivePaused} physicsRef={physicsRef} theme={theme} cb={sysCb} tokenCountRef={tokenCountRef} quality={quality} stage={worldStage} />
          <Weather paused={effectivePaused} theme={theme} />
          <Combat enabled={started && !effectivePaused} />
          <Interiors />
          <Interactions />
          <Phase7Systems />
          <Phase8Systems />
          <Phase9Systems />
          {/* Phase 21: hired staff on shift at their businesses —
              display + greeting only, claims no prompts */}
          <StaffWorld />
          {/* Phase 17: world events + the rideable Cityliner — mounted
              before the tram; both claim prompts politely (only when
              the line is free), so the tram keeps its last-writer win */}
          <Phase17Systems />
          <BusRide />
          {/* Phase 13: the Sable Line mounts LAST of the world systems
              on purpose — while the player rides, its prompt claim
              must win over every street-level interaction below the
              guideway (the prompt slot is last-writer-wins) */}
          <Tram />
          <PerfGovernor active={started && !paused && flow === "game"} />
          <PhotoCapture shotRef={photoShotRef} />
          <FirstFrame onReady={() => setSceneReady(true)} />
          {players.map((pl) => <RemoteAvatar key={pl.playerId} player={pl} />)}
          <CameraRig target={followRef} camFar={camFar} fp={fpRef} orbit={charOpen} sweep={sweepRef} />
          {/* Film grade: bloom + warm grade + grain + vignette + SMAA.
              Phase 5: gated by the quality tier (Low = composer OFF;
              Medium = as Phase 4; High adds SSAO + stronger bloom) and by
              the player's Post FX toggle.
              Phase 14: the composer is keyed by tier+reflFx+postFx so
              any change REMOUNTS it (no hot-swapping SSR inside a live
              composer — the stale-G-buffer bug), and ComposerBoundary
              falls back to plain rendering for the session on error. */}
          {postFx && gates.composer(quality) && (
            <ComposerBoundary>
            <EffectComposer key={`fx-${quality}-${reflFx}-${postFx}`} multisampling={0}>
              <>
                <Bloom intensity={gates.bloom(quality)} luminanceThreshold={0.6} luminanceSmoothing={0.25} mipmapBlur />
                {/* Phase 11: screen-space reflections — High tier only,
                    and only while the player's reflection override is
                    on. Sits right after Bloom so reflected hits carry
                    the neon glow; the grade/grain/vignette still run
                    over the composited result. */}
                {gates.ssr(quality) && reflFx && <SSR {...SSR_OPTS} />}
                <HueSaturation saturation={0.08} />
                <BrightnessContrast contrast={0.06} brightness={0.01} />
                <Noise opacity={0.035} />
                <Vignette darkness={0.22} offset={0.28} />
                {/* Phase 10: a whisper of lens chromatic aberration at
                    the frame edges (radial, so the centre stays clean) —
                    the last "camera, not viewport" cue in the chain */}
                <ChromaticAberration offset={CA_OFFSET} radialModulation modulationOffset={0.42} />
                {/* Phase 14: SSAO and SSR NEVER run together — both are
                    G-buffer-heavy screen-space effects; when the
                    ray-traced-style reflections are active, SSAO yields
                    (its contact shading is the smaller loss). */}
                {gates.ssao(quality) && !(gates.ssr(quality) && reflFx) && (
                  <SSAO worldDistanceThreshold={80} worldDistanceFalloff={40} worldProximityThreshold={6} worldProximityFalloff={3}
                    radius={0.22} intensity={1.1} luminanceInfluence={0.35} samples={16} rings={4} />
                )}
                <SMAA />
              </>
            </EffectComposer>
            </ComposerBoundary>
          )}
        </Suspense>
      </Canvas>

      {flash && <div className="damage-flash" />}
      {camFlash && <div className="camera-flash" />}
      {hud.aiming && started && !hud.status && <div className="aim-crosshair" aria-hidden="true" />}
      {started && !hud.status && !photoMode && (
        <section className="hud" aria-label="Game status">
          <div className="hud-topleft">
            <div className="hud-brand">HARBOR<span>FALL</span></div>
            <div className="hud-meta">{hud.district} · {theme.name}{hud.storyDone ? " · Story Complete" : ""}</div>
            <div className="weather-chip" title={`Weather (Y to change) · Wind: ${hud.wind} — palms and boats feel it`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="9" r="3.4" /><path d="M9 2.5v1.6M2.5 9h1.6M4.9 4.9l1.1 1.1M13.1 4.9l-1.1 1.1" /><path d="M10 20h7.2a3.4 3.4 0 0 0 .6-6.7 4.6 4.6 0 0 0-8.7 1A3.2 3.2 0 0 0 10 20Z" /></svg>
              {hud.weather}
            </div>
            <div className="minimap-disc"><canvas ref={minimapRef} className="minimap" width={148} height={148} aria-label="Minimap" /></div>
            <div className="health-wrap"><div className="health-bar" style={{ width: `${hud.health}%` }} /><span>{hud.health}</span></div>
            <div className="stamina-wrap" title="Stamina — sprint, swim and pedal drain it"><div className={`stamina-bar ${hud.stamina <= 20 ? "low" : ""}`} style={{ width: `${hud.stamina}%` }} /></div>
            {hud.bust > 0.2 && <div className="bust-bar"><div style={{ width: `${Math.min(100, (hud.bust / 3) * 100)}%` }} /></div>}
            {hud.eye && <div className={`stealth-eye ${hud.eye}`}>{hud.eye === "open" ? "◉ SEEN" : "◎ HIDDEN"}</div>}
          </div>
          {/* Phase 5 redesign: the ENTIRE right side is one flex stack —
              phone → stars/cash → panel row → popups → vehicle panel →
              speedometer — so siblings can never overlap at any size. */}
          <div className="hud-right">
            <div className="hud-topright">
              <div className={`stars ${starPulse ? "pulse" : ""}`} aria-label={`Wanted ${hud.wanted} stars`}>
                {[1, 2, 3, 4, 5, 6].map((i) => <span key={i} className={i <= hud.wanted ? "on" : ""}>★</span>)}
              </div>
              <div className="cash">${hud.cash.toLocaleString()}</div>
              {hud.lootCount > 0 && <div className="loot-chip" title="Stolen goods — fence them at Coral Pawn or Lina's">STASH ${hud.loot.toLocaleString()} <span>· {hud.lootCount} item{hud.lootCount > 1 ? "s" : ""}</span></div>}
              {hud.armed && hud.weapon !== "fist" && hud.weapon !== "bat" && hud.weapon !== "bottle" && <div className="ammo-chip" title="Ammo — click or J to fire, Q to cycle weapons">{hud.weapon.toUpperCase()} · {hud.ammo}</div>}
              {hud.weapon === "bat" && !driving && <div className="ammo-chip" title="Baseball bat — click or J to swing, Q to cycle weapons">BAT · WOOD</div>}
              {hud.weapon === "bottle" && !driving && <div className="ammo-chip" title="Throwing bottles — click or J to lob one, Q to cycle weapons">BOTTLES ×{G.weaponAmmo.bottle}</div>}
              <div className="hud-meta">Tokens {hud.tokens}/6 · {players.length + 1} player{players.length ? "s" : ""} · GFX {quality.toUpperCase()}{hud.fps > 0 ? ` · ${hud.fps} FPS` : ""}</div>
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
            {(hud.armed || hud.weapon === "bat" || hud.weapon === "bottle") && !driving && (
              <button type="button" className="weapon-chip" onClick={() => {
                const order = ["fist", "pistol", "smg", "shotgun", "bat", "bottle"] as const;
                const owned = order.filter((w) => w === "fist" || G.weaponOwned[w]);
                G.weaponSel = owned[(owned.indexOf(G.weaponSel) + 1) % owned.length] ?? "fist";
                syncWeaponMirrors();
              }}>
                <span className="keycap">Q</span>{hud.weapon === "fist" ? "FISTS" : hud.weapon.toUpperCase()}
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
            {hud.mini && (
              <div className="mini-bar" role="meter" aria-label={hud.mini.label}>
                <span>{hud.mini.label}</span>
                <div className="mini-track">
                  {hud.mini.zone && <div className="mini-zone" style={{ left: `${hud.mini.zone[0] * 100}%`, width: `${(hud.mini.zone[1] - hud.mini.zone[0]) * 100}%` }} />}
                  {hud.mini.fill != null && <div className="mini-fill" style={{ width: `${hud.mini.fill * 100}%` }} />}
                  <div className="mini-marker" style={{ left: `${hud.mini.marker * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          {banner && <div className={`mission-banner ${banner.ok ? "ok" : "bad"}`}>{banner.text}</div>}
          <div className="controls"><b>WASD</b> Move <i /><b>E</b> Interact · hold: rob / buy <i /><b>G</b> Garage <i /><b>M</b> Mods in garage <i /><b>X</b> Crouch <i /><b>Q</b> Weapon <i /><b>RMB</b> Aim <i /><b>B</b> Surrender at 1★ <i /><b>V</b> 1st person <i /><b>U</b> Phone <i /><b>ESC</b> Pause</div>
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
        <Suspense fallback={null}>
          <GaragePanel zoneId={garageZoneId} onClose={() => setGarageZoneId(null)} />
        </Suspense>
      )}
      {modMounted && (
        <Suspense fallback={null}>
          <ModMenu open={modOpen} onClose={() => setModOpen(false)} />
        </Suspense>
      )}

      {/* ======== Phase 6 screen flow overlays ======== */}
      {flow === "splash" && (
        <div className="splash-screen">
          <div className="splash-word">HARBOR<span>FALL</span></div>
          <p className="splash-sub">A Port Sable story</p>
        </div>
      )}
      {flow === "loading" && (
        <div className="loading-screen">
          <div className="loading-card glass">
            <div className="loading-title">HARBOR<span>FALL</span></div>
            <div className="load-bar big"><div className="load-fill" style={{ width: `${(loadStage / LOAD_STAGE_LABELS.length) * 100}%` }} /></div>
            <ul className="load-stages">
              {LOAD_STAGE_LABELS.map((label, i) => (
                <li key={label} className={i < loadStage ? "done" : i === loadStage ? "active" : ""}>
                  <span>{i < loadStage ? "✓" : i === loadStage ? "▸" : "·"}</span>{label}
                </li>
              ))}
            </ul>
            <p className="load-tip">💡 {LOAD_TIPS[tipIdx]}</p>
          </div>
        </div>
      )}
      {flow === "spawn" && <><div className="letterbox top" /><div className="letterbox bottom" /></>}
      {areaCard && flow !== "loading" && (
        <div className="area-card" aria-live="polite">
          <div className="area-card-title">{areaCard.title}</div>
          <div className="area-card-sub">{areaCard.sub}</div>
        </div>
      )}
      {fadeOn && <div className="fade-black" aria-hidden="true" />}
      {respawnScreen && (
        <div className="respawn-screen">
          <div className="respawn-title">{respawnScreen === "hospital" ? "SABLE GENERAL" : "HARBOUR PATROL"}</div>
          <p className="respawn-tip">💡 {LOAD_TIPS[tipIdx]}</p>
        </div>
      )}
      {charOpen && (
        <Suspense fallback={null}>
          <CharacterSelect selectedId={charChoice.id} variant={charChoice.variant} started={started}
            onSelect={pickCharacter} onVariant={pickVariant}
            onDone={() => { if (started) closeCharSelect(); else { closeCharSelect(); startLoad(true); } }} />
        </Suspense>
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

      {phoneMounted && (
      <Suspense fallback={null}>
      <Phone open={phoneOpen && started} onClose={() => setPhoneOpen(false)} theme={theme} applyTheme={applyTheme}
        onOpenMap={() => { setPhoneOpen(false); setBigMap(true); }}
        onPhotoMode={enterPhotoMode}
        onChangeCharacter={() => { setPhoneOpen(false); G.requestCharSelect = true; }}
        onContact={(name, line, hint) => {
          setPhoneOpen(false);
          // Phase 15: THE MERIDIAN PAIR — after Chapter 3, the FIRST of
          // Voss / Elias you call about the shipment gets your answer:
          // starting their branch sets M.pairChoice (persisted) and
          // locks the other branch for this playthrough.
          if (started && !M.active && !dialogueRef.current && M.storyIndex >= 3 && !M.pairChoice) {
            const pairDef = name === "Det. Mara Voss" ? PAIR_MISSIONS[0] : name === "Old Elias" ? PAIR_MISSIONS[1] : null;
            if (pairDef) {
              M.pairChoice = pairDef.pair!; persistMission();
              pushNews("Harbour Wire: quiet phones on the docks", "Two harbour names made a call tonight about the Meridian shipment — and one of them stopped returning calls right after. The docks notice these things.");
              startMission(pairDef);
              return;
            }
          }
          // Phase 16 audit fix: a pair branch that was STARTED but
          // never finished (failed, abandoned, or the session ended —
          // Phase 15 recorded the lock at start and completion
          // nowhere) is re-offered by its OWN giver. The other branch
          // stays locked, and the call-time headline above does not
          // refire (it lives inside the first-call branch only).
          if (started && !M.active && !dialogueRef.current && M.pairChoice && !M.pairDone) {
            const retryDef = M.pairChoice === "informant" && name === "Det. Mara Voss" ? PAIR_MISSIONS[0]
              : M.pairChoice === "dockcrew" && name === "Old Elias" ? PAIR_MISSIONS[1] : null;
            if (retryDef) { startMission(retryDef); return; }
          }
          // Phase 17: THE HARBOUR WIRE — Ines Marlo offers her
          // investigation arc by phone after Chapter 4 (checked
          // before the generic arc branch: her first mission opens
          // with the in-world meeting at Café Coral)
          if (name === "Ines Marlo" && started && !M.active && !dialogueRef.current && M.storyIndex >= 4) {
            const next = nextSideMission("wire", M.side.wire);
            if (next) { startMission(next); return; }
          }
          // Phase 5 Step 7a: Lina (after Ch.2) and Voss (after Ch.4) offer
          // their side-story arcs by phone — calling them starts the next
          // unplayed part instead of the ambient chat.
          const side = name === "Lina Park" ? "lina" : name === "Det. Mara Voss" ? "voss" : name === "Old Elias" ? "heist" : null;
          if (side && started && !M.active && !dialogueRef.current) {
            // Phase 7: Old Elias offers THE HARBOUR HEIST after Chapter 4
            const unlocked = side === "lina" ? M.storyIndex >= 2 : M.storyIndex >= 4;
            const next = unlocked ? nextSideMission(side, M.side[side]) : null;
            if (next) { startMission(next); return; }
          }
          // Phase 9: after the story, the same three contacts offer the
          // "After the Fall" pack missions, one per giver, in order
          if (M.storyDone && started && !M.active && !dialogueRef.current) {
            const pack = nextSideMission("after", M.side.after);
            if (pack && name === pack.giver) { startMission(pack); return; }
          }
          beginDialogue([{ who: name, text: line }, { who: name, text: hint }], () => {});
        }} />
      </Suspense>
      )}

      <Phase9Ui />

      {(flow === "splash" || flow === "poster") && (
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
            <p className="version-stamp">v2.0 — Complete Edition</p>
            {!loaded ? (
              <div className="load-block">
                <div className="load-bar"><div className="load-fill" style={{ width: sceneReady ? "86%" : "52%" }} /></div>
                <p className="load-tip">💡 {LOAD_TIPS[tipIdx]}</p>
                <p className="load-status">{sceneReady ? "Polishing the harbour…" : "Loading Port Sable…"}</p>
              </div>
            ) : (
              <>
                <div className="start-actions">
                  <button type="button" className="big-btn" onClick={() => startLoad(true)}>▶ Play Story</button>
                  <button type="button" className="big-btn ghost" onClick={() => startLoad(false)}>Free Roam</button>
                  <button type="button" className="big-btn ghost" onClick={() => tryOpenCharSelect()}>Character</button>
                </div>
                {/* Phase 14: save slots — three independent profiles.
                    Switching reboots into the chosen slot's save. */}
                <div className="seg-row" role="group" aria-label="Save slot" style={{ justifyContent: "center", marginTop: 10 }}>
                  {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((n) => {
                    const s = slotSummary(n);
                    return (
                      <button key={n} type="button" className={`seg-btn ${n === activeSlot ? "active" : ""}`} onClick={() => { if (n !== activeSlot) switchSlot(n); }}>
                        Slot {n}{n === activeSlot ? " · playing" : s.empty ? " · empty" : ` · $${s.cash.toLocaleString()} · Ch.${Math.min(6, s.storyIndex + 1)}`}
                      </button>
                    );
                  })}
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
            <button type="button" onClick={() => { setEnding(false); setCredits(true); }}>Watch credits</button>
          </section>
        </div>
      )}

      {credits && (
        <div className="credits-overlay" role="dialog" aria-label="End credits">
          <div className="credits-scroll">
            {CREDITS_LINES.map(([head, line], i) => (
              <div key={i} className={head ? "credits-block" : "credits-line"}>
                {head && <div className="credits-head">{head}</div>}
                <div>{line}</div>
              </div>
            ))}
            <div className="credits-end">— FIN —</div>
          </div>
          <button type="button" className="credits-skip" onClick={() => setCredits(false)}>Skip ▸ (Esc)</button>
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
              <label><span>Speed FOV (widens at speed)</span><input type="checkbox" defaultChecked={G.settings.speedFov} onChange={(e) => { G.settings.speedFov = e.target.checked; persistSettings(); showPopup(`Speed FOV ${e.target.checked ? "on" : "off"}`); }} /></label>
              <label><span>Post FX (bloom / grade)</span><input type="checkbox" checked={postFx} onChange={(e) => { G.settings.postFx = e.target.checked; persistSettings(); setPostFx(e.target.checked); }} /></label>
              <label><span>Shadows</span><input type="checkbox" checked={G.settings.shadows} onChange={(e) => { G.settings.shadows = e.target.checked; persistSettings(); showPopup(`Shadows ${e.target.checked ? "on" : "off"}`); }} /></label>
              <label><span>Field of view · {G.settings.fov}°</span><input type="range" min={50} max={75} step={1} defaultValue={G.settings.fov} onChange={(e) => { G.settings.fov = Number(e.target.value); persistSettings(); }} /></label>
            </div>
            <h3 className="settings-head">Graphics · quality {quality.toUpperCase()}</h3>
            <div className="seg-row" role="group" aria-label="Quality tier">
              {(["low", "medium", "high"] as QualityTier[]).map((t) => (
                <button key={t} type="button" className={`seg-btn ${quality === t ? "active" : ""}`} onClick={() => { manualTier(t); setQualityState(t); showPopup(`Quality: ${t}`); }}>{t}</button>
              ))}
            </div>
            <div className="settings-list">
              <label><span>Show FPS</span><input type="checkbox" defaultChecked={showFps()} onChange={(e) => { setShowFps(e.target.checked); showPopup(`FPS readout ${e.target.checked ? "on" : "off"}`); }} /></label>
              <label><span>Reflections</span><b>{REFLECTION_LABEL[reflectionMode()]}</b></label>
              <label><span>Ray-traced reflections (High tier)</span><input type="checkbox" checked={reflFx} onChange={(e) => { setReflFx(e.target.checked); setReflFxState(e.target.checked); showPopup(`Ray-traced-style reflections ${e.target.checked ? "on" : "off"}`); }} /></label>
            </div>
            <h3 className="settings-head">Season · now {currentSeason()}</h3>
            <div className="seg-row" role="group" aria-label="Season">
              {(["auto", "Spring", "Summer", "Autumn", "Winter"] as const).map((s) => (
                <button key={s} type="button" className={`seg-btn ${G.settings.season === s ? "active" : ""}`} onClick={() => { G.settings.season = s; persistSettings(); showPopup(s === "auto" ? "Season: auto — the 7-day calendar rules" : `Season pinned: ${s}`); }}>{s === "auto" ? "Auto" : s}</button>
              ))}
            </div>
            <p className="settings-note">Seasons turn every 7 game-days: the sun's arc and the day's length, the sky / fog / water tints, the street trees (palms stay green — this is the subtropics) and the weather odds all shift with it. Winter here is cool, grey and dry: Port Sable has never seen snow, and won't.</p>
            <p className="settings-note">Low: no composer, 1024 shadows, procedural textures. Medium: + CC0 photo textures at 512, water shader. High: + stronger bloom, CC0 at 768 — and ray-traced-style reflections (screen-space reflections + mirrored bay water; a browser has no hardware ray tracing, this is the real-time reflection stack every web game uses). Reflections are opt-in and off by default since the stability pass: they render at reduced resolution, the water mirror is capped, and SSAO steps aside while they're on. Resolution adapts automatically for smoothness (even on a manual High); picking a tier here turns the auto tier-drop off for this session.</p>
            <h3 className="settings-head">World · density &amp; view distance</h3>
            <div className="seg-row" role="group" aria-label="Traffic density">
              <span className="seg-label">Traffic</span>
              {(["low", "normal", "high"] as const).map((d) => (
                <button key={d} type="button" className={`seg-btn ${G.settings.trafficDensity === d ? "active" : ""}`} onClick={() => { G.settings.trafficDensity = d; persistSettings(); showPopup(`Traffic density: ${d}`); }}>{d}</button>
              ))}
            </div>
            <div className="seg-row" role="group" aria-label="Pedestrian density">
              <span className="seg-label">Pedestrians</span>
              {(["low", "normal", "high"] as const).map((d) => (
                <button key={d} type="button" className={`seg-btn ${G.settings.pedDensity === d ? "active" : ""}`} onClick={() => { G.settings.pedDensity = d; persistSettings(); showPopup(`Pedestrian density: ${d}`); }}>{d}</button>
              ))}
            </div>
            <div className="seg-row" role="group" aria-label="View distance">
              <span className="seg-label">View distance</span>
              {(["near", "normal", "far"] as const).map((d) => (
                <button key={d} type="button" className={`seg-btn ${G.settings.viewDistance === d ? "active" : ""}`} onClick={() => { G.settings.viewDistance = d; persistSettings(); showPopup(`View distance: ${d}`); }}>{d}</button>
              ))}
            </div>
            <p className="settings-note">These take effect live — no reload. Low traffic runs half the ambient cars (buses, taxis and emergency units always run, and nothing ever vanishes within sight of you); High keeps the rush-hour reserve circulating all day. Pedestrian density scales the crowds on top of the time-of-day rhythm. View distance scales how far out traffic and walkers stream in, and where the fog sits. Normal everywhere is exactly how the game shipped before these levers existed.</p>
            <h3 className="settings-head">Controls · keyboard (this slot)</h3>
            <div className="settings-list">
              {BIND_ACTIONS.map((a) => (
                <label key={a.id}><span>{a.label}</span>
                  <button type="button" className="phone-toggle" onClick={() => { setCaptureBind(a.id); setBindMsg(""); }}>
                    {captureBind === a.id ? "press a key…" : codeLabel(binds[a.id])}
                  </button>
                </label>
              ))}
            </div>
            {bindMsg && <p className="settings-note">{bindMsg}</p>}
            <div className="seg-row" role="group" aria-label="Reset controls">
              <button type="button" className="seg-btn" onClick={() => { resetBinds(); setCaptureBind(null); setBindMsg(""); setBindTick((v) => v + 1); showPopup("Controls reset to defaults (E · Shift · Space · Q · U · M)"); }}>Reset to defaults</button>
            </div>
            <p className="settings-note">Tap a binding, then press the new key. Two actions can't share a key — a clash is refused, not stolen. Bindings are saved per save slot; gamepad and touch controls are unaffected. WASD driving, F to enter a car, and the letter shortcuts (T theme, Y weather…) stay fixed.</p>
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
              <div><dt>Click / J</dt><dd>Punch — or fire your weapon (SMG auto-fires while held)</dd></div>
              <div><dt>Hold right-mouse / LT</dt><dd>Free-aim — over-shoulder camera, fire along the crosshair</dd></div>
              <div><dt>Q / Tab</dt><dd>Weapon selector — fists · pistol · SMG · shotgun · bat · bottles</dd></div>
              <div><dt>Bottles</dt><dd>Crates by Club Solace and the pier — Q to the bottle slot, click to throw (breaks shopfront glass)</dd></div>
              <div><dt>Sable Arms mods</dt><dd>Suppressors (quiet shots), extended mag, reflex sight, shotgun choke — hold E at the counter</dd></div>
              <div><dt>Named townsfolk</dt><dd>Tomas, Priya, Bea and Kip keep schedules across the city — walk up and press E to talk</dd></div>
              <div><dt>Sable Cuts / Port Ink</dt><dd>Market Row (07:00–23:00) — barber haircuts (9 styles) &amp; hair colour, beard trims (stubble · goatee · full), tattoos; all reset when you change character</dd></div>
              <div><dt>E at the pier / island dock</dt><dd>Fish — hold E to charge, release to cast, tap E on the bite, hold E to reel (keep the marker in the green)</dd></div>
              <div><dt>E at Lantern Park gym</dt><dd>Bench press / treadmill session ($10, once a day each) — tap E in the zone to build Strength &amp; Stamina</dd></div>
              <div><dt>Thread &amp; Tide (Market Row)</dt><dd>Tap E to browse outfits, hold E to buy — worn until you change character or variant</dd></div>
              <div><dt>Hold B (1★, unarmed)</dt><dd>Surrender — pay a $100 fine, no cell, no teleport</dd></div>
              <div><dt>Caught on foot</dt><dd>If the bust meter fills while you're on foot, an officer walks you to the patrol car — hands up, no input but the camera — and the usual bust (fine, impound, station) lands when you reach it</dd></div>
              <div><dt>Farm work</dt><dd>Phone → Jobs: haul 3 crate loads from the Downs barn to Harbour Wraps in the farm pickup — $120 a load + $150 shift bonus. The farmhouse bunk sleeps free (it isn't a home you buy — your respawn stays at your property)</dd></div>
              <div><dt>Your parked cars</dt><dd>Up to 3 owned cars you park and walk away from stay in the world between sessions — amber rings on the big map. Wrecked, impounded or garaged cars leave the list</dd></div>
              <div><dt>Space near a bench/hedge</dt><dd>Vault over it</dd></div>
              <div><dt>X / Ctrl</dt><dd>Crouch — stealthier; crouch at a wall/car for cover (cops spot you slower)</dd></div>
              <div><dt>Behind a ped + E</dt><dd>Pickpocket (cash or loot for your stash)</dd></div>
              <div><dt>Hold E</dt><dd>Rob a shop till (3s) · break into a locked car (1.5s)</dd></div>
              <div><dt>E at a bench / table</dt><dd>Sit down — E or any movement key stands up</dd></div>
              <div><dt>Space at a water edge</dt><dd>Dive in (deep water ahead) instead of jumping</dd></div>
              <div><dt>E at home</dt><dd>Sleep at the villa / Coral apartment — morning, full heal, businesses pay out</dd></div>
              <div><dt>E at a Sable Line station</dt><dd>Board the tram when it stops (Docks · Market Row · Northgate · Coral Shores) — ride the elevated loop free, E again to step off at a stop. The patrol won't board, but riding never cools your stars</dd></div>
              <div><dt>E at a Cityliner bus stop</dt><dd>Board the city bus when it dwells at a stop (Docks · Ferry Quarter · East Yards · South Market) — $2 fare, ride the road loop seated, E again to step off at a stop. Same rule as the tram: the patrol won't board, and riding never cools your stars</dd></div>
              <div><dt>Phone → Contacts → Ines Marlo</dt><dd>After Chapter 4, the Harbour Wire's editor offers an investigation arc: photograph evidence (stand in the ring, Phone → Camera → Capture), tail the courier inside the distance band, then run the exposé to the newsroom</dd></div>
              <div><dt>Sable Motors showroom</dt><dd>Through the glass front on the Northgate forecourt — the exotics on turntables, same stock and hours as outside: tap E to browse, hold E to buy</dd></div>
              <div><dt>Café Coral (Docks strip)</dt><dd>Coffee ($8, stamina) or a harbour pastry ($12, +35 health) — and chairs you can actually sit in</dd></div>
              <div><dt>G</dt><dd>Garage car select (villa garage / Lina's)</dd></div>
              <div><dt>R (in car, at garage)</dt><dd>Repair damage + broken windows for cash</dd></div>
              <div><dt>V</dt><dd>First-person camera (drag to look) — works in cars too</dd></div>
              <div><dt>Swim</dt><dd>Wade past the wet sand and you swim; paddle to shore to climb out</dd></div>
            </dl>
            <h3>Driving</h3>
            <dl className="key-list">
              <div><dt>WASD / Arrows</dt><dd>Accelerate · brake/reverse · steer</dd></div>
              <div><dt>Space</dt><dd>Handbrake / drift</dd></div><div><dt>B</dt><dd>Horn</dd></div><div><dt>E / F</dt><dd>Exit car · board the boat / bicycle</dd></div>
              <div><dt>Flying the Sparrow</dt><dd>W builds speed, lift-off past ~60 km/h · Shift climbs · Ctrl descends · land under ~27 km/h sink or it costs you</dd></div>
              <div><dt>Boats</dt><dd>Speedboat at the pier, fishing skiffs at the island and Coral docks — E boards, W drives, mind the patrol boat at 2★+</dd></div>
              <div><dt>Six stars</dt><dd>Serious crime at 5★ builds heat — the sixth star brings the Harbour Guard SUV and K9 units (3★+, on foot)</dd></div>
              <div><dt>M (at a garage)</dt><dd>Lina's mods — respray · engine tune · brakes</dd></div>
              <div><dt>C</dt><dd>Camera near / far</dd></div>
              <div><dt>Taxi work</dt><dd>Drive the yellow Sable Cab — fares hail with an amber marker; fast + clean = tips</dd></div>
              <div><dt>Street races</dt><dd>Amber rings: Docks Sprint · Bay Run · Northgate Loop — $600 to win, optional $100 bet (Jobs app)</dd></div>
              <div><dt>Causeway toll</dt><dd>$5 through the bridge booth at a crawl — smashing the barrier earns a star</dd></div>
              <div><dt>Speed cameras</dt><dd>Over ~100 km/h near a camera pole: $75 SableCam fine by phone</dd></div>
            </dl>
            <h3>Game</h3>
            <dl className="key-list">
              <div><dt>Esc / P</dt><dd>Pause</dd></div><div><dt>H / ?</dt><dd>This help</dd></div>
              <div><dt>T</dt><dd>Cycle theme</dd></div><div><dt>1–5</dt><dd>Switch theme directly</dd></div>
              <div><dt>M</dt><dd>Big map</dd></div><div><dt>L</dt><dd>Hold / resume day cycle</dd></div>
              <div><dt>N</dt><dd>Mute / unmute</dd></div><div><dt>R</dt><dd>Respawn (busted/wasted) · retry from checkpoint after a fail · restart mission</dd></div>
              <div><dt>U</dt><dd>Smartphone (contacts · messages · bank · jobs · story · news · social · SableWeb · gallery · music · themes)</dd></div>
              <div><dt>After the Fall</dt><dd>Post-story pack: finish the story, then call Lina, Voss and Elias — three more jobs, one real choice</dd></div>
              <div><dt>Business staff</dt><dd>Bank app → Businesses: hire a hand for +50% takings, minus a $35 daily wage</dd></div>
              <div><dt>Jobs &amp; businesses</dt><dd>Phone Jobs app: taxi + delivery work. Hold E at the Wraps stall, Car Wash or Club Solace to buy in — income lands every morning</dd></div>
              <div><dt>Tow work</dt><dd>Jobs app → Tow shift: take the Sable Wrecker at Lina's, reverse the hook to a marked car, hold still to hitch, deliver to Lina's yard — $150 a drop</dd></div>
              <div><dt>SableBank Invest</dt><dd>Bank app: three local stocks in $100 lots — prices walk hourly and react to your heists, race wins and business buys</dd></div>
              <div><dt>Reputation</dt><dd>Port Sable remembers: witnesses recognise repeat offenders, pickpocket victims avoid you for a day, friendly faces wave back</dd></div>
              <div><dt>The Harbour Heist</dt><dd>After Chapter 4, call Old Elias from Contacts — a two-night job: prep, then the strongroom</dd></div>
              <div><dt>Y</dt><dd>Change the weather</dd></div>
              <div><dt>Seasons</dt><dd>A season every 7 game-days — sun angle, day length, light, foliage and weather odds all turn. Pin one in Pause → Season or Phone → Settings. No snow: subtropical harbour, honestly</dd></div>
              <div><dt>Your last car</dt><dd>The car you last drove waits where you left it — across sessions too (amber YOUR CAR ring on the big map). Wrecked, impounded (busted) or garage-stored cars are the exceptions</dd></div>
              <div><dt>⛽ Fuel</dt><dd>Cars burn fuel — park at a red FUEL canopy to refill for cash</dd></div>
              <div><dt>🔧 Damage</dt><dd>Crashes damage your car; 100% = wrecked</dd></div>
              <div><dt>Enter</dt><dd>Confirm dialogue</dd></div><div><dt>Mouse drag / wheel</dt><dd>Orbit / zoom camera</dd></div>
            </dl>
            <h3>Gamepad</h3>
            <dl className="key-list">
              <div><dt>Left stick</dt><dd>Move / steer (analog — push further to run; past the edge = sprint)</dd></div>
              <div><dt>Right stick</dt><dd>Camera orbit</dd></div>
              <div><dt>RT / LT</dt><dd>Accelerate / brake-reverse</dd></div>
              <div><dt>A</dt><dd>Interact / advance dialogue</dd></div>
              <div><dt>B</dt><dd>Exit car · back / pause</dd></div>
              <div><dt>X</dt><dd>Jump · handbrake (hold, in car)</dd></div>
              <div><dt>Y</dt><dd>Phone</dd></div>
              <div><dt>LB / RB</dt><dd>Weapon cycle / horn</dd></div>
              <div><dt>Start</dt><dd>Pause</dd></div>
              <div><dt>Touch</dt><dd>Floating analog stick (left thumb, appears where you touch) — gyro steers only while the stick is centred</dd></div>
            </dl>
            <button type="button" className="primary" onClick={() => setShowHelp(false)}>Close</button>
          </section>
        </div>
      )}
    </main>
  );
}
