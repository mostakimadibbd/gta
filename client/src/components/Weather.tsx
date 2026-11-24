// Harborfall weather visuals (Blueprint §1/§10): state machine driver +
// rain particle field + fog shaping + storm lightning.
// State lives in G (game/store) + game/weather; this component renders it.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { G } from "../game/store";
import { WEATHER_META, rollWeather } from "../game/weather";
import { viewFogScale } from "../game/perf";
import { sfx } from "../game/audio";
import { groundYAt } from "../world";
import type { GameTheme } from "../themes";

const RAIN_COUNT = 900;
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
  // jagged lightning bolt: regenerated per strike, points from cloud to ground
  const makeBolt = () => {
    const a = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 60;
    const bx = G.followPos.x + Math.cos(a) * dist;
    const bz = G.followPos.z + Math.sin(a) * dist;
    const spine: THREE.Vector3[] = [];
    let x = bx, z = bz;
    for (let i = 0; i <= 7; i++) {
      spine.push(new THREE.Vector3(x, 38 - i * 5.2, z));
      x += (Math.random() - 0.5) * 4.5;
      z += (Math.random() - 0.5) * 4.5;
    }
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < spine.length - 1; i++) pts.push(spine[i], spine[i + 1]);
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
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
        G.lightning = 1;
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
