// Harborfall — Phase 13: THE SABLE LINE (components). One two-car
// light-rail tram running the elevated loop from game/tram.ts
// forever: cruise, corner slowdowns, station dwells with a door
// chime, and a player ride mode (board at a station while it dwells,
// sit in the front car, step off at any later stop — stations only,
// there is no emergency handle and the driver will tell you so).
//
// Mounted AFTER Phase9Systems in App.tsx on purpose: the prompt slot
// is last-writer-wins, and while the player is riding, the tram owns
// the prompt (street-level interactions under the guideway must not
// fire through the floor of the car). Wanted rules: riding never
// bleeds heat and the patrol never boards (GameSystems gates on
// G.tramRide) — they wait at the station like everyone else.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast } from "../game/store";
import { groundYAt } from "../world";
import { sfx } from "../game/audio";
import { pushNews, pushSocial } from "../game/feed";
import {
  TRAM, TRAM_STOPS, TRAM_BEAM_SEGS, TRAM_PILLARS, TRAM_LOOP_LENGTH,
  TRAM_CRUISE, TRAM_DECK_Y, tramPointAt, distToNextStop,
} from "../game/tram";

function boardTexture(title: string, sub: string, bg: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#d99a3d"; g.fillRect(0, 0, 512, 10);
  g.fillStyle = fg; g.textAlign = "center";
  g.font = "bold 44px sans-serif"; g.fillText(title, 256, 58);
  g.font = "24px sans-serif"; g.fillText(sub, 256, 98);
  return new THREE.CanvasTexture(c);
}

// station street points: platform side is perp = (-tz, tx) everywhere
const STREET = TRAM_STOPS.map((st) => ({ x: st.x - st.tz * 3.6, z: st.z + st.tx * 3.6 }));
const LOOP_MIN = Math.max(2, Math.round((TRAM_LOOP_LENGTH / 9 + TRAM_STOPS.length * 6) / 60));

export default function Tram() {
  const frontRef = useRef<THREE.Group>(null);
  const rearRef = useRef<THREE.Group>(null);
  const doorRefs = useRef<Array<THREE.Mesh | null>>([]);
  const doorBase = useRef<number[]>([]);
  const state = useRef({ mode: "run" as "run" | "dwell", dwellT: 0, closing: false, armed: -1 });
  // one window-band material for both cars (night glow animated once)
  const winMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1c2b33", roughness: 0.12, metalness: 0.5, emissive: "#ffca7a", emissiveIntensity: 0.25 }), []);

  // one-time launch headline (the line "opens" the first time a
  // Phase 13 build runs, then it's just part of the city)
  useEffect(() => {
    try {
      if (!localStorage.getItem("harborfall-tram-news")) {
        localStorage.setItem("harborfall-tram-news", "1");
        pushNews("The Sable Line opens", "Port Sable's light-rail loop made its first full circuit at dawn — Docks, Market Row, Northgate and Coral Shores on one elevated line, above the traffic the whole way. Free to ride while the city 'evaluates pricing', which in Port Sable means forever.");
        pushSocial("@harbourwire", "the Sable Line is LIVE. whole city from a tram window, above the traffic. this is the good timeline");
      }
    } catch { /* ignore */ }
  }, []);

  const guideway = useMemo(() => {
    const dummy = new THREE.Object3D();
    const beam = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.5, 4.35), new THREE.MeshStandardMaterial({ color: "#3d4a52", roughness: 0.8, metalness: 0.25 }), TRAM_BEAM_SEGS.length);
    TRAM_BEAM_SEGS.forEach((sg, i) => { dummy.position.set(sg.x, sg.y - 0.28, sg.z); dummy.rotation.set(0, sg.ang, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); beam.setMatrixAt(i, dummy.matrix); });
    const railGeo = new THREE.BoxGeometry(0.14, 0.1, 4.35);
    const railMat = new THREE.MeshStandardMaterial({ color: "#9aa4ab", roughness: 0.35, metalness: 0.8 });
    const rails: THREE.InstancedMesh[] = [];
    for (const side of [-0.75, 0.75]) {
      const im = new THREE.InstancedMesh(railGeo, railMat, TRAM_BEAM_SEGS.length);
      TRAM_BEAM_SEGS.forEach((sg, i) => {
        dummy.position.set(sg.x + Math.cos(sg.ang) * side, sg.y + 0.03, sg.z - Math.sin(sg.ang) * side);
        dummy.rotation.set(0, sg.ang, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      });
      rails.push(im);
    }
    // pillars skip the bridge span (the guideway cantilevers over the
    // bay bridge corridor — a centre pillar would pierce the deck);
    // each pillar is scaled to meet its local deck height (the ramps)
    const pillarSpots = TRAM_PILLARS.filter((pl) => !(Math.abs(pl.x - 60) < 3 && pl.z > 106 && pl.z < 218));
    const pillar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1, 0.9), new THREE.MeshStandardMaterial({ color: "#57616a", roughness: 0.85 }), pillarSpots.length);
    pillarSpots.forEach((pl, i) => {
      const g = groundYAt(pl.x, pl.z);
      const h = Math.max(1, pl.y - 0.5 - g);
      dummy.position.set(pl.x, g + h / 2, pl.z); dummy.rotation.set(0, pl.ang, 0); dummy.scale.set(1, h, 1); dummy.updateMatrix(); pillar.setMatrixAt(i, dummy.matrix);
    });
    dummy.scale.set(1, 1, 1);
    for (const m of [beam, pillar, ...rails]) { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; }
    return { beam, pillar, rails };
  }, []);

  const stationTex = useMemo(() => TRAM_STOPS.map((st) => boardTexture(`SABLE LINE · ${st.name.toUpperCase()}`, st.blurb, "#0f2c38", "#ffe9c9")), []);
  const timetableTex = useMemo(() => boardTexture("TIMETABLE", `Loop every ≈${LOOP_MIN} min · Docks → Market Row → Northgate → Coral`, "#17303a", "#cfe0f2"), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = state.current;
    // ---------- motion ----------
    if (st.mode === "run") {
      const { dist, idx } = distToNextStop(TRAM.s);
      const here = tramPointAt(TRAM.s);
      let target = here.corner ? 6 : TRAM_CRUISE;
      // station approach: a linear braking profile the 3.4 u/s² decel
      // can actually track (target slope 0.35 × speed < decel), so the
      // tram rolls to a stop AT the mark instead of blowing through
      if (dist < 34) target = Math.min(target, Math.max(0.5, dist * 0.35));
      const rate = target < TRAM.speed ? 3.4 : 2.2;
      TRAM.speed += THREE.MathUtils.clamp(target - TRAM.speed, -rate * dt, rate * dt);
      TRAM.s += TRAM.speed * dt;
      if (dist > 3) st.armed = idx; // a stop only counts once we've been properly away from it
      if (st.armed === idx && dist < 0.6 && TRAM.speed < 0.9) {
        TRAM.s = TRAM_STOPS[idx].s; TRAM.speed = 0;
        st.mode = "dwell"; st.dwellT = 6; st.closing = false; st.armed = -1;
        TRAM.stopped = true; TRAM.stationIdx = idx;
        sfx.chime();
      }
    } else {
      st.dwellT -= dt;
      if (st.dwellT < 0.8 && !st.closing) { st.closing = true; sfx.chime(); }
      if (st.dwellT <= 0) { st.mode = "run"; TRAM.stopped = false; TRAM.stationIdx = -1; TRAM.speed = 0.4; }
    }
    TRAM.doorOpen += ((TRAM.stopped && !st.closing ? 1 : 0) - TRAM.doorOpen) * Math.min(1, dt * 5);
    // ---------- place the consist (rear car follows the path, so the
    // pair articulates through the corner fillets) ----------
    const fp = tramPointAt(TRAM.s);
    const fx = fp.x, fz = fp.z, ftx = fp.tx, ftz = fp.tz, fy = fp.y;
    TRAM.x = fx; TRAM.z = fz; TRAM.tx = ftx; TRAM.tz = ftz;
    // car children are built around TRAM_DECK_Y; the group rides the
    // height profile (flat streets, climbing over the bay bridge)
    if (frontRef.current) { frontRef.current.position.set(fx, fy - TRAM_DECK_Y, fz); frontRef.current.rotation.y = Math.atan2(ftx, ftz); }
    const rp = tramPointAt(TRAM.s - 8.8);
    if (rearRef.current) { rearRef.current.position.set(rp.x, rp.y - TRAM_DECK_Y, rp.z); rearRef.current.rotation.y = Math.atan2(rp.tx, rp.tz); }
    doorRefs.current.forEach((d, i) => { if (d) d.position.z = (doorBase.current[i] ?? 0) + (i % 2 === 0 ? -1 : 1) * TRAM.doorOpen * 0.5; });
    winMaterial.emissiveIntensity = 0.25 + G.nightFactor * 1.35;
    // ---------- the player ----------
    const px = G.playerPos.x, pz = G.playerPos.z;
    if (G.tramRide >= 0) {
      const seat = tramPointAt(TRAM.s - 2.2);
      G.tramSeatY = seat.y + 0.07;
      G.playerPos.set(seat.x, 0, seat.z);
      G.followPos.set(seat.x, G.tramSeatY, seat.z);
      G.playerHeading = Math.atan2(seat.tx, seat.tz);
      if (TRAM.stopped && TRAM.stationIdx >= 0) {
        const si = TRAM.stationIdx; // captured: stationIdx resets on departure
        const name = TRAM_STOPS[si].name;
        G.promptText = `Press E — step off at ${name}`;
        G.promptWarn = false;
        G.interact = () => {
          const sp = STREET[si];
          G.tramRide = -1;
          G.playerPos.set(sp.x, 0, sp.z);
          G.followPos.set(sp.x, 0, sp.z);
          sfx.door();
          toast(`You step off at ${name}. The Sable Line pulls away behind you.`);
        };
      } else {
        const { idx } = distToNextStop(TRAM.s);
        G.promptText = `Riding the Sable Line — next stop ${TRAM_STOPS[idx].name} · E to step off when we stop`;
        G.promptWarn = false;
        G.interact = null;
      }
      return;
    }
    if (!G.driving && !G.interior && !G.status && !G.dialogueActive) {
      for (let i = 0; i < TRAM_STOPS.length; i++) {
        const sp = STREET[i];
        const d2 = (px - sp.x) ** 2 + (pz - sp.z) ** 2;
        if (TRAM.stopped && TRAM.stationIdx === i && d2 < 3.4 ** 2) {
          const next = TRAM_STOPS[(i + 1) % TRAM_STOPS.length].name;
          G.promptText = `Press E — board the Sable Line (toward ${next})`;
          G.promptWarn = false;
          G.interact = () => { G.tramRide = i; sfx.door(); toast("All aboard — the Sable Line. Mind the doors."); };
          return;
        }
        if (d2 < 2.2 ** 2) {
          const { dist } = distToNextStop(TRAM.s);
          G.promptText = TRAM.stopped ? `Sable Line · ${TRAM_STOPS[i].name} — the tram is at ${TRAM_STOPS[TRAM.stationIdx].name}` : `Sable Line · ${TRAM_STOPS[i].name} — tram ${dist < 40 ? "approaching" : "on the loop"}, every ≈${LOOP_MIN} min`;
          G.promptWarn = false;
          G.interact = null;
          return;
        }
      }
    }
  });

  const car = (isFront: boolean) => (
    <group>
      {/* bogies + skirt */}
      {[-2.6, 2.6].map((z) => <mesh key={z} position={[0, TRAM_DECK_Y + 0.28, z]}><boxGeometry args={[2, 0.5, 1.7]} /><meshStandardMaterial color="#22262b" roughness={0.9} /></mesh>)}
      {/* body: deep harbour teal, amber waist stripe, glass band */}
      <mesh position={[0, TRAM_DECK_Y + 1.5, 0]} castShadow><boxGeometry args={[2.5, 2.3, 7.8]} /><meshStandardMaterial color="#175d6e" roughness={0.35} metalness={0.45} /></mesh>
      <mesh position={[0, TRAM_DECK_Y + 0.78, 0]}><boxGeometry args={[2.54, 0.3, 7.84]} /><meshStandardMaterial color="#d99a3d" roughness={0.4} metalness={0.3} emissive="#d99a3d" emissiveIntensity={0.12} /></mesh>
      <mesh position={[0, TRAM_DECK_Y + 1.95, 0]}><boxGeometry args={[2.54, 0.75, 7.84]} /><primitive object={winMaterial} attach="material" /></mesh>
      {/* roof + pantograph (front car) */}
      <mesh position={[0, TRAM_DECK_Y + 2.72, 0]}><boxGeometry args={[2.2, 0.16, 7.2]} /><meshStandardMaterial color="#0f2c38" roughness={0.6} /></mesh>
      {isFront && (
        <group position={[0, TRAM_DECK_Y + 2.8, -1]}>
          <mesh position={[0, 0.35, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.07, 0.85, 0.07]} /><meshStandardMaterial color="#59616a" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0, 0.35, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.07, 0.85, 0.07]} /><meshStandardMaterial color="#59616a" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0, 0.78, 0]}><boxGeometry args={[1.3, 0.06, 0.3]} /><meshStandardMaterial color="#59616a" metalness={0.6} roughness={0.4} /></mesh>
        </group>
      )}
      {/* cab nose (front car) / tail (rear car): sloped amber-lit face */}
      <mesh position={[0, TRAM_DECK_Y + 1.35, isFront ? 3.95 : -3.95]} rotation={[isFront ? -0.18 : 0.18, 0, 0]}><boxGeometry args={[2.3, 1.9, 0.35]} /><meshStandardMaterial color="#0f2c38" roughness={0.3} metalness={0.4} /></mesh>
      <mesh position={[0, TRAM_DECK_Y + 0.72, isFront ? 4.06 : -4.06]}><boxGeometry args={[1.7, 0.22, 0.06]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={1.6} /></mesh>
      {/* sliding doors on the platform side (local −x) */}
      {[-1.9, 1.9].map((z, di) => (
        <group key={z} position={[-1.26, TRAM_DECK_Y + 1.25, z]}>
          {[0, 1].map((half) => (
            <mesh key={half}
              ref={(m) => { const idx = (isFront ? 0 : 4) + di * 2 + half; doorRefs.current[idx] = m; doorBase.current[idx] = half === 0 ? -0.4 : 0.4; }}
              position={[0, 0, half === 0 ? -0.4 : 0.4]}>
              <boxGeometry args={[0.06, 1.9, 0.78]} /><meshStandardMaterial color="#0e3a47" roughness={0.3} metalness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );

  return (
    <group>
      <primitive object={guideway.beam} />
      <primitive object={guideway.pillar} />
      {guideway.rails.map((r, i) => <primitive key={i} object={r} />)}
      {/* stations: deck + canopy + stair shaft + signs */}
      {TRAM_STOPS.map((st, i) => {
        const px = -st.tz, pz = st.tx; // platform-side perp
        const ang = Math.atan2(st.tx, st.tz);
        return (
          <group key={st.name}>
            <group position={[st.x + px * 3.4, 0, st.z + pz * 3.4]} rotation={[0, ang, 0]}>
              <mesh position={[0, TRAM_DECK_Y - 0.18, 0]} castShadow><boxGeometry args={[3.2, 0.35, 10.5]} /><meshStandardMaterial color="#4a565f" roughness={0.8} /></mesh>
              <mesh position={[-1.35, TRAM_DECK_Y + 0.02, 0]}><boxGeometry args={[0.5, 0.06, 10.5]} /><meshStandardMaterial color="#d99a3d" roughness={0.6} /></mesh>
              {[-4.4, 4.4].map((z) => <mesh key={z} position={[1.3, TRAM_DECK_Y + 1.1, z]}><boxGeometry args={[0.14, 2.2, 0.14]} /><meshStandardMaterial color="#59616a" metalness={0.5} roughness={0.5} /></mesh>)}
              <mesh position={[0.4, TRAM_DECK_Y + 2.28, 0]}><boxGeometry args={[3.4, 0.16, 10.5]} /><meshStandardMaterial color="#0f2c38" roughness={0.7} /></mesh>
            </group>
            {/* stair/lift shaft down to the street point */}
            <mesh position={[STREET[i].x + px * 1.6, TRAM_DECK_Y / 2 - 0.1, STREET[i].z + pz * 1.6]}><boxGeometry args={[2.1, TRAM_DECK_Y, 2.1]} /><meshStandardMaterial color="#3d4a52" roughness={0.85} /></mesh>
            {/* street sign + timetable */}
            <group position={[STREET[i].x, 0, STREET[i].z]} rotation={[0, ang + Math.PI, 0]}>
              <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.06, 0.06, 3, 8]} /><meshStandardMaterial color="#59616a" metalness={0.5} roughness={0.5} /></mesh>
              <mesh position={[0, 2.9, 0]}><planeGeometry args={[3.4, 0.85]} /><meshStandardMaterial map={stationTex[i]} emissive="#ffffff" emissiveMap={stationTex[i]} emissiveIntensity={0.35} side={THREE.DoubleSide} /></mesh>
              <mesh position={[0, 1.9, 0.05]}><planeGeometry args={[2.6, 0.65]} /><meshStandardMaterial map={timetableTex} emissive="#ffffff" emissiveMap={timetableTex} emissiveIntensity={0.25} side={THREE.DoubleSide} /></mesh>
            </group>
          </group>
        );
      })}
      <group ref={frontRef}>{car(true)}</group>
      <group ref={rearRef}>{car(false)}</group>
    </group>
  );
}
