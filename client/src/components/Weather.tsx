// Harborfall weather visuals (Blueprint §1/§10): state machine driver +
// rain particle field + fog shaping + storm lightning.
// State lives in G (game/store) + game/weather; this component renders it.
//
// Phase 36 additions, all in this component's remit: the road-wetness
// drying tick (game/store's G.roadWet), TARGETED lightning (strikes
// now often land on a tall roof or the sea instead of a random point
// at a fixed height — spectacle only, lightning has never dealt
// damage in Port Sable and still doesn't), and the AUTUMN LEAVES
// particle field (windblown leaves while the season is Autumn).
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { G } from "../game/store";
import { WEATHER_META, rollWeather } from "../game/weather";
import { viewFogScale } from "../game/perf";
import { sfx } from "../game/audio";
import { groundYAt, buildings, STREAMED_DISTRICTS } from "../world";
import { currentSeason } from "../game/season";
import type { GameTheme } from "../themes";

const RAIN_COUNT = 900;
// Phase 36: windblown autumn leaves — a pooled point field around
// the camera focus, recycled like the rain. Amber/brown tints from
// the autumn foliage palette (game/season.ts), vertex-coloured.
const LEAF_COUNT = 130;
// Phase 10: rain splash rings — a pooled set of expanding flat rings
// on the ground around the camera focus (plus rings off the swimmer).
const RING_COUNT = 42;
interface SplashRing { age: number; life: number; x: number; z: number; y: number; }

export default function Weather({ paused, theme }: { paused: boolean; theme: GameTheme }) {
  const scene = useThree((s) => s.scene);
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const bolt = useRef<THREE.LineSegments>(null);
  const boltMat = useRef<THREE.LineBasicMaterial>(null);
  const lightningTimer = useRef(5 + Math.random() * 6);
  const ringRefs = useRef<Array<THREE.Mesh | null>>([]);
  const rings = useRef<SplashRing[]>(Array.from({ length: RING_COUNT }, () => ({ age: 1, life: 0.7, x: 0, z: 0, y: -10 })));
  const ringCursor = useRef(0);
  const ringAcc = useRef(0);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.3, 0.38, 20), []);
  // jagged lightning bolt: regenerated per strike, points from cloud to ground.
  // Phase 36: strikes have TARGETS now. ~45% of strikes pick the
  // tallest roof within 150u and land ON it; the rest land on open
  // ground at its real height, or on the sea (y=0) when the point
  // is water. The old bolt always bottomed out at y≈1.6 wherever it
  // fell — through roofs and under the sea alike. Spectacle only:
  // lightning has never dealt damage in Port Sable and still does
  // not — there is no damage path attached to a strike.
  const makeBolt = () => {
    let tx = 0, tz = 0, ty = 0;
    let best: { x: number; z: number; height: number } | null = null;
    if (Math.random() < 0.45) {
      for (const b of buildings) {
        const d2 = (b.x - G.followPos.x) ** 2 + (b.z - G.followPos.z) ** 2;
        if (d2 < 150 * 150 && (!best || b.height > best.height)) best = b;
      }
    }
    if (best) {
      tx = best.x + (Math.random() - 0.5) * 4; tz = best.z + (Math.random() - 0.5) * 4; ty = best.height;
    } else {
      // Phase 37 audit fix: the random point used to land at groundYAt
      // with no footprint test — but groundYAt reads 0 inside building
      // footprints too, so a bolt could spear THROUGH a roof to ground
      // level, in the base city and inside a loaded streamed district
      // alike. The point is footprint-tested now: inside a base
      // building → strike that roof; inside a LOADED district's
      // blocker → resample (district colliders carry no heights, so
      // their roofs are avoided, not aimed at — the tallest-roof
      // targeting above reads the base-city list only); an unloaded
      // district is open water, where y=0 is the sea surface itself.
      let placed = false;
      for (let attempt = 0; attempt < 4 && !placed; attempt++) {
        const a = Math.random() * Math.PI * 2;
        const dist = 55 + Math.random() * 60;
        const cx = G.followPos.x + Math.cos(a) * dist;
        const cz = G.followPos.z + Math.sin(a) * dist;
        const hit = buildings.find((b) => Math.abs(cx - b.x) <= b.width / 2 && Math.abs(cz - b.z) <= b.depth / 2);
        if (hit) { tx = cx; tz = cz; ty = hit.height; placed = true; break; }
        let inDistrict = false;
        for (const d of STREAMED_DISTRICTS) {
          if (!d.loaded) continue;
          for (const bl of d.blockers) if (Math.abs(cx - bl.x) <= bl.hw && Math.abs(cz - bl.z) <= bl.hd) { inDistrict = true; break; }
          if (inDistrict) break;
        }
        if (inDistrict) continue; // resample — never through a district roof
        tx = cx; tz = cz; ty = Math.max(0, groundYAt(tx, tz)); // over water groundYAt reads ≤0: the strike lands ON the sea
        placed = true;
      }
      if (!placed) { tx = G.followPos.x; tz = G.followPos.z; ty = Math.max(0, groundYAt(tx, tz)); } // the ground under the player's feet is always a real surface
    }
    const top = Math.max(42, ty + 30);
    const spine: THREE.Vector3[] = [];
    let x = tx + (Math.random() - 0.5) * 7, z = tz + (Math.random() - 0.5) * 7;
    for (let i = 0; i <= 7; i++) {
      const f = i / 7;
      spine.push(new THREE.Vector3(x, top + (ty - top) * f, z));
      x += (tx - x) * 0.4 + (Math.random() - 0.5) * 3.5;
      z += (tz - z) * 0.4 + (Math.random() - 0.5) * 3.5;
    }
    spine[7].set(tx, ty, tz); // the final point IS the strike point
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < spine.length - 1; i++) pts.push(spine[i], spine[i + 1]);
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
  // ---- Phase 36: autumn leaves (pooled points, recycled like rain)
  const leafPoints = useRef<THREE.Points>(null);
  const leafMat = useRef<THREE.PointsMaterial>(null);
  const leafOpacity = useRef(0);
  const leafPhase = useMemo(() => {
    const p = new Float32Array(LEAF_COUNT);
    for (let i = 0; i < LEAF_COUNT; i++) p[i] = Math.random() * Math.PI * 2;
    return p;
  }, []);
  const leafGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(LEAF_COUNT * 3);
    const col = new Float32Array(LEAF_COUNT * 3);
    const palette = ["#a8742f", "#8a5a24", "#b4622d", "#96702e", "#7a4a20"].map((c) => new THREE.Color(c));
    for (let i = 0; i < LEAF_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 64;
      pos[i * 3 + 1] = Math.random() * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 64;
      const c = palette[i % palette.length];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const positions = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 70;
      arr[i * 3 + 1] = Math.random() * 26;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    return arr;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    // ---- state machine (frozen while paused) ----
    if (!paused) {
      G.weatherIn -= dt;
      if (G.weatherIn <= 0) rollWeather();
    }
    const meta = WEATHER_META[G.weather];
    const k = 1 - Math.exp(-dt * 0.7); // smooth ~1.5s transitions
    G.rainAmt += (meta.rain - G.rainAmt) * k;
    G.fogAmt += (meta.fog - G.fogAmt) * k;
    // ---- Phase 36: road wetness soaks fast, dries slow ----
    // While it rains the streets soak up toward the rain's own
    // intensity within a few seconds; when the rain stops the
    // wetness bleeds off at 1/150 per second — a soaked street
    // (1.0) takes ~2.5 minutes to dry, a Rain-soaked one (0.75)
    // just under two. Road gloss, puddles and grip read roadWet.
    if (G.rainAmt > G.roadWet) G.roadWet = Math.min(G.rainAmt, G.roadWet + dt * 0.3);
    else G.roadWet = Math.max(G.rainAmt, G.roadWet - dt / 150);
    // ---- fog shaping (theme owns base distances; weather scales them) ----
    if (scene.fog instanceof THREE.Fog) {
      // Phase 16: the view-distance lever scales both fog distances
      // (Near ×0.78 / Normal ×1 / Far ×1.3) on top of the weather shape
      const viewFog = viewFogScale();
      const far = theme.fogFar * viewFog * (1 - G.fogAmt * (1 - meta.fogScale) - G.rainAmt * 0.18);
      const near = theme.fogNear * viewFog * (1 - G.fogAmt * 0.55);
      scene.fog.far += (far - scene.fog.far) * k;
      scene.fog.near += (near - scene.fog.near) * k;
    }
    // ---- lightning (storms): jagged bolt + sky flash + DELAYED thunder ----
    G.lightning = Math.max(0, G.lightning - dt * 2.6);
    if (boltMat.current) boltMat.current.opacity = G.lightning * 0.95;
    if (bolt.current) bolt.current.visible = G.lightning > 0.03;
    if (!paused && G.weather === "Storm") {
      lightningTimer.current -= dt;
      if (lightningTimer.current <= 0) {
        lightningTimer.current = 4 + Math.random() * 8;
        // Phase 44: REDUCED FLASH caps the strike's PEAK here, at
        // the one write site — every consumer of G.lightning (the
        // bolt's opacity above, GameSystems' ambient bump and the
        // sky/fog brightening) scales down with it, and the fixed
        // decay rate means a lower peak is also a shorter flash.
        G.lightning = G.settings.reducedFlash ? 0.3 : 1;
        if (bolt.current) { bolt.current.geometry.dispose(); bolt.current.geometry = makeBolt(); }
        sfx.thunder(0.7); // sound arrives after the flash, like real storms
      }
    }
    // ---- rain field around the camera focus ----
    const pts = points.current;
    if (pts) {
      pts.visible = G.rainAmt > 0.04 && !G.interior; // no rain indoors (Phase 3)
      if (pts.visible) {
        pts.position.set(G.followPos.x, 0, G.followPos.z);
        const attr = geo.getAttribute("position") as THREE.BufferAttribute;
        const fall = dt * (26 + G.rainAmt * 10);
        const drift = dt * 3.5; // storm slant
        for (let i = 0; i < RAIN_COUNT; i++) {
          let y = attr.getY(i) - fall;
          if (y < 0) y += 26;
          attr.setY(i, y);
          let x = attr.getX(i) + drift;
          if (x > 35) x -= 70;
          attr.setX(i, x);
        }
        attr.needsUpdate = true;
      }
    }
    if (mat.current) mat.current.opacity = G.rainAmt * 0.55;
    // ---- Phase 36: autumn leaves — the season's one new particle.
    // The field exists only in Autumn (the opacity fades in/out
    // over ~2 s so a season turn never pops it); leaves flutter
    // down, sway on their phase, and ride the Phase 7 wind value
    // sideways. No leaves indoors, none in other seasons.
    {
      const autumn = !G.interior && currentSeason() === "Autumn";
      leafOpacity.current += ((autumn ? 0.55 : 0) - leafOpacity.current) * Math.min(1, dt * 0.8);
      if (leafMat.current) leafMat.current.opacity = leafOpacity.current;
      const lp = leafPoints.current;
      if (lp) {
        lp.visible = leafOpacity.current > 0.02;
        if (lp.visible && !paused) {
          lp.position.set(G.followPos.x, 0, G.followPos.z);
          const attr = leafGeo.getAttribute("position") as THREE.BufferAttribute;
          const tNow = performance.now() / 1000;
          const windPush = (0.6 + G.wind * 2.2) * dt;
          for (let i = 0; i < LEAF_COUNT; i++) {
            const ph = leafPhase[i];
            let y = attr.getY(i) - dt * (0.55 + (ph % 0.7)); // each leaf falls at its own rate
            let x = attr.getX(i) + windPush + Math.sin(tNow * 1.7 + ph) * dt * 0.9;
            let z = attr.getZ(i) + Math.cos(tNow * 1.3 + ph * 1.7) * dt * 0.7;
            if (y < 0.15 || x > 34) { // landed or blown out: recycle at the top, upwind side
              y = 11 + Math.random() * 6;
              x = -34 + Math.random() * 30;
              z = (Math.random() - 0.5) * 64;
            }
            if (z > 34) z -= 68; else if (z < -34) z += 68;
            attr.setXYZ(i, x, y, z);
          }
          attr.needsUpdate = true;
        }
      }
    }
    // ---- Phase 10: splash rings (rain on ground + swimmer ripples) --
    {
      const spawn = (x: number, z: number) => {
        const r = rings.current[ringCursor.current % RING_COUNT];
        ringCursor.current += 1;
        r.age = 0; r.life = 0.65 + Math.random() * 0.25;
        r.x = x; r.z = z; r.y = groundYAt(x, z) + 0.07;
      };
      if (!paused && !G.interior) {
        ringAcc.current += dt;
        if (G.rainAmt > 0.15) {
          const interval = 0.15 - G.rainAmt * 0.115; // denser as rain builds
          while (ringAcc.current > interval) {
            ringAcc.current -= interval;
            const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 30;
            spawn(G.followPos.x + Math.cos(a) * d, G.followPos.z + Math.sin(a) * d);
          }
        } else if (G.swimming) {
          while (ringAcc.current > 0.42) { ringAcc.current -= 0.42; spawn(G.playerPos.x, G.playerPos.z); }
        } else ringAcc.current = 0;
      }
      rings.current.forEach((r, i) => {
        const m = ringRefs.current[i]; if (!m) return;
        if (r.age >= r.life) { m.visible = false; return; }
        r.age += dt;
        const p = Math.min(1, r.age / r.life);
        m.visible = true;
        m.position.set(r.x, r.y, r.z);
        const s = 0.5 + p * 1.7;
        m.scale.set(s, s, s);
        (m.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.4;
      });
    }
  });

  return (
    <>
      <points ref={points} geometry={geo} frustumCulled={false}>
        <pointsMaterial ref={mat} color="#bcd8ff" size={0.14} transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
      {/* Phase 36: windblown autumn leaves (visible only in Autumn) */}
      <points ref={leafPoints} geometry={leafGeo} frustumCulled={false} visible={false}>
        <pointsMaterial ref={leafMat} vertexColors size={0.34} transparent opacity={0} depthWrite={false} sizeAttenuation />
      </points>
      {/* lightning bolt (geometry regenerated per strike) */}
      <lineSegments ref={bolt} visible={false} frustumCulled={false}>
        <bufferGeometry />
        <lineBasicMaterial ref={boltMat} color="#eef4ff" transparent opacity={0} depthWrite={false} />
      </lineSegments>
      {/* Phase 10: splash-ring pool (rain + swimmer) */}
      {rings.current.map((_, i) => (
        <mesh key={i} ref={(n) => { ringRefs.current[i] = n; }} geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <meshBasicMaterial color="#cfe4ee" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
