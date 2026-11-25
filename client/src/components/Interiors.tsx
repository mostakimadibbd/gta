// Harborfall — enterable interiors (Phase 3, Blueprint §1/§5): Lina's
// Garage + Club Solace. The rooms live in an offset pocket at z ≈ -175;
// walking through a door fades you across (teleport) and Player clamps
// movement to the room while G.interior is set. This component also runs
// ALL proximity interactions (doors + the mansion gate) and publishes
// the HUD prompt through G.promptText / G.interact.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { G, toast, nowS, bark, persistStoredCars } from "../game/store";
import { isBind } from "../game/keybinds";
import { pushPhoneMsg } from "../game/phone";
import { sfx } from "../game/audio";
import { GARAGE_EXT_DOOR, CLUB_EXT_DOOR, POLICE_EXT_DOOR, CLINIC_EXT_DOOR, RESTAURANT_EXT_DOOR, AIRPORT_DOOR, SHOWROOM_EXT_DOOR, CAFE_EXT_DOOR, GYM_EXT_DOOR, LOFT_EXT_DOOR, CLOTHING_EXT_DOOR, FARMHOUSE_EXT_DOOR, INTERIORS, MANSION_GATE, MANSION_PRICE, DEALER_CARS, CAR_MODELS, type InteriorKind } from "../world";
import { ECO, LOFT, persistEco, setHomePref, sleepToMorning } from "../game/economy";
import { CLOTH, CLOTHING_ITEMS, persistClothing, type ClothingItem } from "../game/phase8";
import { shopsClosed, gameHour } from "./Interactions";
import { isClubOpen, CLUB_DRINK_NAME, CLUB_DRINK_PRICE, CLUB_DRINK_STAMINA, CLUB_DRINK_WARM_S } from "../game/club";
import { startClubBass, stopClubBass } from "../game/audio";
import { dealerPrice, consumeVoucher } from "../game/cup";
import CarBody from "./CarBody";
import { buildHumanoid, animateHumanoid, type HumanoidRig } from "../humanoid";
import { neonSignTexture } from "../textures";

function signTexture(text: string, bg: string, fg: string, w = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = w; c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, w, 96);
  g.fillStyle = fg; g.font = "bold 44px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, 52);
  return new THREE.CanvasTexture(c);
}

const WALL_G = new THREE.MeshStandardMaterial({ color: "#4d4438", roughness: 0.9 });
const WALL_C = new THREE.MeshStandardMaterial({ color: "#14161d", roughness: 0.85 });
const FLOOR_G = new THREE.MeshStandardMaterial({ color: "#3c3f45", roughness: 0.6, metalness: 0.15 });
const FLOOR_C = new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.35, metalness: 0.3 });
const WOOD = new THREE.MeshStandardMaterial({ color: "#6d4c33", roughness: 0.85 });
const METAL = new THREE.MeshStandardMaterial({ color: "#8a929a", metalness: 0.65, roughness: 0.4 });

function RoomShell({ cx, cz, w, d, h, wall, floor, ceiling }: {
  cx: number; cz: number; w: number; d: number; h: number;
  wall: THREE.Material; floor: THREE.Material; ceiling?: boolean;
}) {
  const hw = w / 2, hd = d / 2;
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.02, 0]} receiveShadow><boxGeometry args={[w, 0.06, d]} /><primitive object={floor} attach="material" /></mesh>
      <mesh position={[0, h / 2, -hd]}><boxGeometry args={[w, h, 0.3]} /><primitive object={wall} attach="material" /></mesh>
      <mesh position={[0, h / 2, hd]}><boxGeometry args={[w, h, 0.3]} /><primitive object={wall} attach="material" /></mesh>
      <mesh position={[-hw, h / 2, 0]}><boxGeometry args={[0.3, h, d]} /><primitive object={wall} attach="material" /></mesh>
      <mesh position={[hw, h / 2, 0]}><boxGeometry args={[0.3, h, d]} /><primitive object={wall} attach="material" /></mesh>
      {ceiling && <mesh position={[0, h, 0]}><boxGeometry args={[w, 0.25, d]} /><primitive object={wall} attach="material" /></mesh>}
    </group>
  );
}

const WALL_P = new THREE.MeshStandardMaterial({ color: "#3d4a5c", roughness: 0.9 });
const WALL_CL = new THREE.MeshStandardMaterial({ color: "#cfd6d4", roughness: 0.85 });
const WALL_R = new THREE.MeshStandardMaterial({ color: "#4a3527", roughness: 0.9 });
const FLOOR_P = new THREE.MeshStandardMaterial({ color: "#2e3540", roughness: 0.55, metalness: 0.1 });
const FLOOR_CL = new THREE.MeshStandardMaterial({ color: "#9fb3ae", roughness: 0.4 });
const FLOOR_R = new THREE.MeshStandardMaterial({ color: "#2b2019", roughness: 0.7 });
// Phase 9: hangar — corrugated steel + oil-stained concrete
const WALL_H = new THREE.MeshStandardMaterial({ color: "#5d6a72", roughness: 0.7, metalness: 0.35 });
const FLOOR_H = new THREE.MeshStandardMaterial({ color: "#43484d", roughness: 0.5, metalness: 0.2 });
// Phase 13: showroom — slate walls over polished dark stone; café —
// warm cream over terracotta tile
const WALL_S = new THREE.MeshStandardMaterial({ color: "#26303a", roughness: 0.6, metalness: 0.2 });
const FLOOR_S = new THREE.MeshStandardMaterial({ color: "#191d21", roughness: 0.22, metalness: 0.35 });
const WALL_CF = new THREE.MeshStandardMaterial({ color: "#e6d9bf", roughness: 0.9 });
const FLOOR_CF = new THREE.MeshStandardMaterial({ color: "#8a5a3c", roughness: 0.8 });
// Phase 14: gym — deep teal walls over black rubber; loft — warm
// slate over light oak
const WALL_GY = new THREE.MeshStandardMaterial({ color: "#1d2b2e", roughness: 0.9 });
const FLOOR_GY = new THREE.MeshStandardMaterial({ color: "#23272c", roughness: 0.95 });
// Phase 15: Thread & Tide — warm cream walls over pale boards
const WALL_TT = new THREE.MeshStandardMaterial({ color: "#ddd2ba", roughness: 0.9 });
const FLOOR_TT = new THREE.MeshStandardMaterial({ color: "#9a7a54", roughness: 0.75 });
const WALL_LF = new THREE.MeshStandardMaterial({ color: "#3a3f45", roughness: 0.85 });
const FLOOR_LF = new THREE.MeshStandardMaterial({ color: "#7a5a3d", roughness: 0.7 });
// Phase 23: Club Solace floor-cycle scratch colours — module-level
// so the per-frame emissive lerp never allocates.
const CLUB_TEAL = new THREE.Color("#2ee6c8");
const CLUB_AMBER = new THREE.Color("#ffb340");
const CLUB_SCRATCH = new THREE.Color();
/** Phase 23: the 7 clubbers' spots on the floor grid (room-relative). */
const DANCER_SPOTS: ReadonlyArray<readonly [number, number]> = [[-1, -2], [1.6, -2.1], [-2.4, 0.4], [0.4, 0.2], [3, -0.9], [-0.9, 2.1], [2.3, 2.2]];

/** Wanted-poster wall art (canvas): three harbour faces, drawn not copied. */
function posterTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8e2d4"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#7a1f1f"; g.fillRect(0, 0, 512, 44);
  g.fillStyle = "#fff"; g.font = "bold 26px sans-serif"; g.textAlign = "center";
  g.fillText("HARBOUR PATROL — WANTED", 256, 31);
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 160;
    g.fillStyle = "#d8d2c2"; g.fillRect(x, 60, 130, 130);
    g.fillStyle = "#8a6f52"; g.beginPath(); g.arc(x + 65, 105, 26, 0, Math.PI * 2); g.fill();
    g.fillRect(x + 30, 128, 70, 55);
    g.fillStyle = "#222"; g.font = "bold 15px sans-serif";
    g.fillText(["SOLANO, V.", "“THE LEDGER”", "UNKNOWN"][i], x + 65, 215);
    g.font = "12px sans-serif"; g.fillText(["REWARD $5,000", "REWARD $2,500", "DO NOT APPROACH"][i], x + 65, 236);
  }
  return new THREE.CanvasTexture(c);
}

export default function Interiors() {
  const garageSign = useMemo(() => signTexture("LINA'S GARAGE", "#0f4442", "#ffca7a"), []);
  const policeSign = useMemo(() => signTexture("HARBOUR PATROL", "#1c2f4a", "#cfe0f2"), []);
  const clinicSign = useMemo(() => signTexture("SABLE CLINIC", "#eef2f0", "#c22e2e"), []);
  const restSign = useMemo(() => signTexture("MARINA TABLE", "#241a12", "#ffca7a"), []);
  const showroomSign = useMemo(() => signTexture("SABLE MOTORS", "#0f2c38", "#ffca7a"), []);
  const cafeSign = useMemo(() => signTexture("CAFÉ CORAL", "#2b1c10", "#ffca7a"), []);
  const gymSign = useMemo(() => signTexture("SABLE FITNESS", "#0f4442", "#ffca7a"), []);
  const loftSign = useMemo(() => signTexture("NORTHGATE LOFT", "#232a31", "#ffca7a"), []);
  const ttSign = useMemo(() => signTexture("THREAD & TIDE", "#17303a", "#ffb340"), []);
  // Phase 13: showroom turntables (rotated in useFrame) + the café's
  // two regulars — static seated rigs, posed once (they're mid-chat
  // and in no hurry; a slow head-bob in useFrame keeps them alive)
  const turnRefs = useRef<Array<THREE.Group | null>>([]);
  const cafeGuests = useMemo<HumanoidRig[]>(() => {
    const mk = (o: Parameters<typeof buildHumanoid>[0]) => {
      const rig = buildHumanoid(o);
      rig.group.position.y = -0.42;
      rig.lThigh.rotation.x = rig.rThigh.rotation.x = -1.45;
      rig.lShin.rotation.x = rig.rShin.rotation.x = 1.35;
      rig.lArm.rotation.x = -0.55; rig.rArm.rotation.x = -0.7;
      rig.rFore.rotation.x = -0.5;
      return rig;
    };
    return [
      mk({ top: "#e8e4da", bottom: "#40342a", skin: "#c68863", hair: "#4a2f1a", topStyle: "tee", gender: "f", hairStyle: "bun" }),
      mk({ top: "#31556e", bottom: "#232c38", skin: "#8d5524", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "flat" }),
    ];
  }, []);
  // Phase 13: the showroom counter works like the forecourt's — tap E
  // browses the stock, HOLD E (0.9 s) buys. Its own e-down clock so
  // the indoor counter never fights the outdoor one in Interactions
  // (whose "Buying…" hold-clear can't see this "Purchasing…" label).
  const srEDown = useRef(-1);
  const srIdx = useRef(0);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (isBind(e, "interact") && !e.repeat) srEDown.current = performance.now() / 1000; };
    const up = (e: KeyboardEvent) => {
      // Phase 15 playability: this keyup used to check the PHYSICAL
      // "e" key while its keydown twin used the interact BINDING —
      // with interact remapped, the showroom's tap-to-browse never
      // fired and its hold state cleared on the wrong key. Both
      // halves now read the binding, like Phase7/8/9.
      if (!isBind(e, "interact")) return;
      const held = srEDown.current > 0 ? performance.now() / 1000 - srEDown.current : 9;
      srEDown.current = -1;
      if (G.hold?.label.startsWith("Purchasing")) G.hold = null;
      if (held < 0.35 && G.interior === "showroom" && !shopsClosed()) {
        const S = INTERIORS.showroom;
        const d2 = (G.playerPos.x - S.cx) ** 2 + (G.playerPos.z - (S.cz - 4.4)) ** 2;
        if (d2 < 2.6 ** 2) {
          srIdx.current = (srIdx.current + 1) % DEALER_CARS.length;
          const dc = DEALER_CARS[srIdx.current];
          toast(`Sable Motors — ${CAR_MODELS[dc.kind].name} · $${dealerPrice(dc.kind, dc.price).toLocaleString()} (hold E to buy)`);
          sfx.click();
        }
      }
    };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  const posters = useMemo(() => posterTexture(), []);
  const clubNeon = useMemo(() => neonSignTexture("SOLACE", "#2ee6c8"), []);
  const beamMatA = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2ee6c8", transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const beamMatB = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffb340", transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const beams = useRef<THREE.Group>(null);
  const dancers = useMemo<HumanoidRig[]>(() => [
    buildHumanoid({ top: "#b3312c", bottom: "#232c38", skin: "#f1c27d", hair: "#14100e", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "ponytail" }),
    buildHumanoid({ top: "#274268", bottom: "#1d2126", skin: "#8d5524", hair: "#20242a", topStyle: "tee", gender: "m", hairStyle: "flat" }),
    buildHumanoid({ top: "#e8e4da", bottom: "#40342a", skin: "#c68863", hair: "#4a2f1a", topStyle: "tank", gender: "f", hairStyle: "bun", necklace: true }),
    buildHumanoid({ top: "#1f7a72", bottom: "#2b3440", skin: "#6b4423", hair: "#14100e", topStyle: "hoodie", gender: "m", hairStyle: "cap", cap: "#101216" }),
    // Phase 23: the floor fills out — 7 clubbers on the grid
    buildHumanoid({ top: "#d99a3d", bottom: "#232c38", skin: "#f1c27d", hair: "#4a2f1a", topStyle: "tank", gender: "m", hairStyle: "quiff" }),
    buildHumanoid({ top: "#31556e", bottom: "#1d2126", skin: "#8d5524", hair: "#14100e", topStyle: "crop", bottomStyle: "shorts", gender: "f", hairStyle: "long", sunglasses: true }),
    buildHumanoid({ top: "#40342a", bottom: "#2b3440", skin: "#c68863", hair: "#20242a", topStyle: "tee", gender: "m", hairStyle: "fade", tattooSleeve: true }),
  ], []);
  // Phase 23: the dance floor is a 6×4 TILE GRID whose emissive
  // cycles slowly between the house teal and amber (never pink /
  // purple). One material per tile, created once here; useFrame
  // only lerps their emissive colours through two scratch colours —
  // no per-frame allocation.
  const floorTiles = useMemo<THREE.MeshStandardMaterial[]>(() =>
    Array.from({ length: 24 }, () => new THREE.MeshStandardMaterial({ color: "#141e26", roughness: 0.25, metalness: 0.4, emissive: "#2ee6c8", emissiveIntensity: 0.3 })), []);
  const clubBassOn = useRef(false);
  useEffect(() => () => { stopClubBass(); }, []);

  // Phase 6 screen flow: door teleports are DELAYED ~130 ms behind a
  // fade-to-black (App watches G.fadeAt) so entering a room reads as a
  // transition, not a pop.
  const pendingGo = useRef<{ x: number; z: number; interior: "" | InteriorKind; at: number } | null>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (pendingGo.current && t >= pendingGo.current.at) {
      const pg = pendingGo.current;
      pendingGo.current = null;
      G.playerPos.set(pg.x, 0, pg.z);
      G.followPos.set(pg.x, 0, pg.z);
      G.interior = pg.interior;
    }
    if (beams.current) beams.current.rotation.y = t * 0.35;
    // Phase 13: showroom turntables turn at a stately pace; the café
    // regulars nod along to a conversation you're not part of
    turnRefs.current.forEach((g, i) => { if (g) g.rotation.y = t * (0.22 + i * 0.045); });
    cafeGuests.forEach((rig, i) => { rig.head.rotation.y = Math.sin(t * 0.4 + i * 2.1) * 0.24; rig.head.rotation.x = 0.08 + Math.sin(t * 0.9 + i) * 0.05; });
    dancers.forEach((rig, i) => {
      animateHumanoid(rig, t * 2.2 + i * 1.7, 0.22, t + i);
      // arms up, swaying to the groove
      rig.lArm.rotation.x = -2.6 + Math.sin(t * 2.2 + i * 1.7) * 0.35;
      rig.rArm.rotation.x = -2.6 + Math.cos(t * 2.2 + i * 1.7) * 0.35;
      rig.group.position.y = Math.abs(Math.sin(t * 2.2 + i * 1.7)) * 0.05;
    });
    // Phase 23: the floor grid breathes teal → amber → teal on a
    // slow wave across the tiles (checkerboard phase offsets), and
    // the bass loop (game/audio.ts) runs only while you're inside.
    floorTiles.forEach((m, i) => {
      const ph = (i % 6) * 0.55 + Math.floor(i / 6) * 0.95;
      const k = 0.5 + 0.5 * Math.sin(t * 0.85 + ph);
      m.emissive.copy(CLUB_SCRATCH.copy(CLUB_TEAL).lerp(CLUB_AMBER, k));
      m.emissiveIntensity = 0.3 + k * 0.45;
    });
    const inClub = G.interior === "club";
    if (inClub !== clubBassOn.current) {
      clubBassOn.current = inClub;
      if (inClub) startClubBass(); else stopClubBass();
    }

    // ---------- proximity interactions ----------
    let prompt = ""; let warn = false; let act: (() => void) | null = null;
    if (!G.driving && !G.status && !G.dialogueActive) {
      const px = G.playerPos.x, pz = G.playerPos.z;
      const near = (x: number, z: number, r: number) => (px - x) ** 2 + (pz - z) ** 2 < r * r;
      const go = (x: number, z: number, interior: "" | InteriorKind) => () => {
        G.fadeAt = nowS(); // App fades to black…
        sfx.door();
        pendingGo.current = { x, z, interior, at: t + 0.13 }; // …teleport lands mid-fade
      };
      if (G.interior === "garage") {
        const [x, z] = INTERIORS.garage.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave the garage"; act = go(GARAGE_EXT_DOOR.x, GARAGE_EXT_DOOR.z - 1.2, ""); }
      } else if (G.interior === "club") {
        // ---- Phase 23: CLUB SOLACE, WORKING — exit + the bar. The
        // counter stands on the west wall (the rotated bar group);
        // its front line is ≈7.3 west of centre. One drink on the
        // menu (game/club.ts): a little stamina and a brief warm
        // vignette — COSMETIC warmth only, no drunkenness physics,
        // no driving effect, stated in the toast so nobody guesses.
        const [x, z] = INTERIORS.club.exitDoor;
        const C = INTERIORS.club;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Club Solace"; act = go(CLUB_EXT_DOOR.x, CLUB_EXT_DOOR.z - 1.2, ""); }
        else if (near(C.cx - 7.3, C.cz + 0.5, 2.8)) {
          if (G.cash >= CLUB_DRINK_PRICE) {
            prompt = `Press E — a ${CLUB_DRINK_NAME} at the bar ($${CLUB_DRINK_PRICE} — a little stamina, a warm glow)`;
            act = () => {
              G.cash -= CLUB_DRINK_PRICE;
              G.stamina = Math.min(100, G.stamina + CLUB_DRINK_STAMINA);
              G.drinkUntil = G.timeS + CLUB_DRINK_WARM_S;
              G.eatingUntil = G.timeS + 1.6;
              sfx.eat();
              bark("Bartender", "One Sunset. House rule: the glow's just a glow — your driving's still your own problem.");
              toast(`🍹 ${CLUB_DRINK_NAME} — $${CLUB_DRINK_PRICE}. Stamina +${CLUB_DRINK_STAMINA} and a warm edge to the lights for a bit. (Cosmetic only — no effect on driving.)`);
            };
          } else { prompt = `The bartender polishes a glass. A ${CLUB_DRINK_NAME} is $${CLUB_DRINK_PRICE} — you're short.`; warn = true; }
        }
        else prompt = "Club Solace — the floor's live, the bar's on the west wall.";
      } else if (G.interior === "police") {
        // ---- Phase 7: Harbour Patrol HQ lobby — exit + the desk
        // surrender point (same outcome as hold-B on the street) ----
        const [x, z] = INTERIORS.police.exitDoor;
        const P = INTERIORS.police;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Harbour Patrol HQ"; act = go(POLICE_EXT_DOOR.x, POLICE_EXT_DOOR.z - 1.2, ""); }
        else if (near(P.cx, P.cz - 2.6, 2.4)) {
          if (G.wanted === 1) {
            prompt = "Press E — surrender at the desk (pay the $100 fine, walk out clean)";
            act = () => {
              const fine = Math.min(100, G.cash);
              G.finesPaid += fine; G.cash -= fine;
              G.wanted = 0; G.wantedCooldown = 0; G.bustTimer = 0;
              for (const c of G.cops) c.active = false;
              toast("You surrendered at the desk — fined $100. The sergeant stamps the form without looking up.");
              bark("Desk Sergeant", "Fine paid. Don't make a habit of it, Kade.");
              sfx.click();
            };
          } else if (G.wanted > 1) { prompt = "The desk sergeant shakes his head — you're too hot to surrender. Lose the patrol first."; warn = true; }
          else prompt = "Harbour Patrol front desk — wanted posters on the wall, cells behind. You're clean today.";
        }
      } else if (G.interior === "clinic") {
        const [x, z] = INTERIORS.clinic.exitDoor;
        const C = INTERIORS.clinic;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Sable Clinic"; act = go(CLINIC_EXT_DOOR.x, CLINIC_EXT_DOOR.z - 1.2, ""); }
        else if (near(C.cx, C.cz - 2.2, 2.2)) {
          if (G.health >= 99.5) prompt = "Sable Clinic — you're fully patched up already.";
          else if (G.cash >= 50) {
            prompt = "Press E — clinic treatment ($50, full heal)";
            act = () => { G.cash -= 50; G.health = 100; sfx.cash(); toast("The clinic patches you up — full health for $50."); };
          } else { prompt = "Clinic treatment is $50 — you're short."; warn = true; }
        }
      } else if (G.interior === "restaurant") {
        const [x, z] = INTERIORS.restaurant.exitDoor;
        const R = INTERIORS.restaurant;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Marina Table"; act = go(RESTAURANT_EXT_DOOR.x, RESTAURANT_EXT_DOOR.z - 1.2, ""); }
        else if (near(R.cx - 3.4, R.cz + 0.4, 2.1) || near(R.cx + 3.4, R.cz + 0.4, 2.1)) {
          // sit at a table — E stands back up (or any movement key)
          if (G.sitting) { prompt = "Press E — stand up"; act = () => { G.sitting = false; G.sitSpot = null; }; }
          else {
            prompt = "Press E — sit at the table";
            act = () => { G.sitting = true; G.sitSpot = { x: px, z: pz, heading: G.playerHeading }; sfx.click(); };
          }
        } else if (near(R.cx, R.cz - 3.4, 2.4)) {
          if (G.cash >= 25) {
            prompt = "Press E — the Marina Table set menu ($25 — full heal + stamina boost)";
            act = () => {
              G.cash -= 25; G.health = 100; G.stamina = 100; G.staminaBoostUntil = G.timeS + 180;
              G.eatingUntil = G.timeS + 2.2; sfx.eat();
              toast("Grilled harbour fish, citrus rice, strong coffee — full health, and stamina drains half as fast for a while.");
            };
          } else { prompt = "The set menu is $25 — you're short."; warn = true; }
        }
      } else if (G.interior === "hangar") {
        // ---- Phase 9: Port Sable Airport hangar — exit only (the
        // Sparrow outside is the attraction; in here: a display plane,
        // crates and the crew's kettle) ----
        const [x, z] = INTERIORS.hangar.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave the hangar"; act = go(AIRPORT_DOOR.x, AIRPORT_DOOR.z - 1.2, ""); }
        else prompt = "";
      } else if (G.interior === "showroom") {
        // ---- Phase 13: SABLE MOTORS SHOWROOM — the exotics indoors
        // on turntables; the counter sells the same stock as the
        // forecourt (tap E browses, hold E buys, same hours) ----
        const [x, z] = INTERIORS.showroom.exitDoor;
        const S = INTERIORS.showroom;
        if (near(x, z, 2.2)) { prompt = "Press E — leave the showroom"; act = go(SHOWROOM_EXT_DOOR.x, SHOWROOM_EXT_DOOR.z - 1.2, ""); }
        else if (near(S.cx, S.cz - 4.4, 2.6)) {
          if (shopsClosed()) { prompt = "Sable Motors is closed (07:00–23:00) — the turntables keep turning under the lights."; warn = true; }
          else {
            const dc = DEALER_CARS[srIdx.current];
            const name = CAR_MODELS[dc.kind].name;
            // Phase 18: voucher pricing via game/cup.ts (showroom too)
            const price = dealerPrice(dc.kind, dc.price);
            prompt = `Sable Motors — ${name} · $${price.toLocaleString()}${price < dc.price ? " (gold voucher −20%)" : ""} (tap E to browse · hold E to buy)`;
            if (srEDown.current > 0) {
              const progress = (performance.now() / 1000 - srEDown.current) / 0.9;
              G.hold = { label: `Purchasing ${name} — $${price.toLocaleString()}…`, progress: Math.min(1, progress) };
              if (progress >= 1) {
                srEDown.current = -1; G.hold = null;
                if (G.cash < price) { toast(`${name} costs $${price.toLocaleString()} — not enough cash.`); sfx.dryFire(); }
                else if (G.storedCars.length >= 6) toast("Your garage is full (6) — store or sell a car first.");
                else {
                  G.cash -= price;
                  G.storedCars.push({ kind: dc.kind, color: dc.color, name, damage: 0, fuel: 90, brokenWindow: false });
                  persistStoredCars();
                  consumeVoucher(dc.kind);
                  pushPhoneMsg("Sable Motors", `🚗 ${name} delivered to your garage. Press G at a garage to take it out.`);
                  toast(`${name} bought — delivered to your garage`);
                  sfx.cash();
                }
              }
            }
          }
        }
      } else if (G.interior === "cafe") {
        // ---- Phase 13: CAFÉ CORAL — coffee for the road, a pastry
        // when you're hurt, and chairs that are actually for sitting --
        const [x, z] = INTERIORS.cafe.exitDoor;
        const CF = INTERIORS.cafe;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Café Coral"; act = go(CAFE_EXT_DOOR.x, CAFE_EXT_DOOR.z - 1.2, ""); }
        else if (near(CF.cx - 2.9, CF.cz + 0.6, 2) || near(CF.cx + 2.9, CF.cz + 0.6, 2)) {
          if (G.sitting) { prompt = "Press E — stand up"; act = () => { G.sitting = false; G.sitSpot = null; }; }
          else {
            prompt = "Press E — sit with a coffee";
            act = () => { G.sitting = true; G.sitSpot = { x: px, z: pz, heading: G.playerHeading }; sfx.click(); };
          }
        } else if (near(CF.cx, CF.cz - 2.2, 2.3)) {
          if (G.health < 70) {
            if (G.cash >= 12) {
              prompt = "Press E — harbour pastry ($12 — restores 35 health)";
              act = () => { G.cash -= 12; G.health = Math.min(100, G.health + 35); G.eatingUntil = G.timeS + 2.2; sfx.eat(); toast("Flaky, warm, gone in four bites — you feel human again (+35 health)."); };
            } else { prompt = "The harbour pastry is $12 — you're short."; warn = true; }
          } else if (G.cash >= 8) {
            prompt = "Press E — Café Coral coffee ($8 — full stamina, steady hands for 2 min)";
            act = () => { G.cash -= 8; G.stamina = 100; G.staminaBoostUntil = G.timeS + 120; G.eatingUntil = G.timeS + 2.2; sfx.eat(); toast("Harbour-roast coffee — stamina full, and it drains at half rate for a while."); };
          } else { prompt = "Coffee is $8 — you're short."; warn = true; }
        }
      } else if (G.interior === "gym") {
        // ---- Phase 14: SABLE FITNESS — the stations themselves are
        // run by Phase8 (its prompts publish after this component);
        // here: the exit + a welcome line at the door mat ----
        const [x, z] = INTERIORS.gym.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Sable Fitness"; act = go(GYM_EXT_DOOR.x, GYM_EXT_DOOR.z + 1.2, ""); }
        else if (near(INTERIORS.gym.cx, INTERIORS.gym.cz + 3.4, 2.2)) prompt = "Sable Fitness — bench press west, treadmill east. $10 a session, once a day each.";
      } else if (G.interior === "loft") {
        // ---- Phase 14: THE NORTHGATE LOFT — bed (sleep/save),
        // wardrobe (change into anything you OWN), harbour windows --
        const [x, z] = INTERIORS.loft.exitDoor;
        const L = INTERIORS.loft;
        if (near(x, z, 2.2)) { prompt = "Press E — leave the Loft"; act = go(LOFT_EXT_DOOR.x, LOFT_EXT_DOOR.z + 1.2, ""); }
        else if (near(L.cx + 4.5, L.cz - 3, 2.4)) {
          prompt = "Press E — sleep until morning at the Loft (the day ticks over, businesses pay out)";
          act = () => { setHomePref("loft"); sleepToMorning("the Northgate Loft"); };
        } else if (near(L.cx - 5, L.cz - 3, 2.2)) {
          if (CLOTH.owned.length === 0) prompt = "Your wardrobe — empty for now. Outfits you buy at Thread & Tide hang here.";
          else {
            prompt = `Press E — wardrobe (wearing: ${CLOTH.current?.label ?? "character-select outfit"}) — change`;
            act = () => {
              const opts: Array<ClothingItem | null> = [null, ...CLOTH.owned.map((id) => CLOTHING_ITEMS.find((i) => i.id === id)).filter((i): i is ClothingItem => !!i)];
              const idx = opts.findIndex((o) => (o?.id ?? null) === (CLOTH.current?.id ?? null));
              const next = opts[(idx + 1) % opts.length];
              CLOTH.current = next; persistClothing();
              toast(next ? `🧥 Changed into ${next.label}.` : "Back to your character-select outfit.");
              sfx.click();
            };
          }
        } else if (near(L.cx, L.cz - 4.6, 2.6)) prompt = "The whole harbour from up here — bridge, island light, the bay turning amber at dusk.";
      } else if (G.interior === "clothing") {
        // ---- Phase 15: THREAD & TIDE — the counter logic lives in
        // Phase8 (it publishes after this component); here: the exit
        // + a welcome line. Hours are enforced at the STREET door —
        // a player already inside when 23:00 lands can finish up. ----
        const [x, z] = INTERIORS.clothing.exitDoor;
        if (near(x, z, 2.2)) { prompt = "Press E — leave Thread & Tide"; act = go(CLOTHING_EXT_DOOR.x, CLOTHING_EXT_DOOR.z + 1.2, ""); }
        else if (near(INTERIORS.clothing.cx, INTERIORS.clothing.cz + 3.4, 2.2)) prompt = "Thread & Tide — racks on both walls, the counter's at the back. Tap E to browse, hold E to buy.";
      } else if (G.interior === "farmhouse") {
        // ---- Phase 16: THE SABLE DOWNS FARMHOUSE — kitchen/living
        // room + the FARMHAND'S BUNK. Design choice, documented: the
        // bunk is NOT a purchasable home. Sleeping here is free and
        // saves the day like any bed, but it deliberately does NOT
        // call setHomePref — your respawn home stays wherever you
        // bought one; the bunk just starts your morning at the farm.
        // No door hours either: farmhands keep farm hours. ----
        const [x, z] = INTERIORS.farmhouse.exitDoor;
        const FH = INTERIORS.farmhouse;
        if (near(x, z, 2.2)) { prompt = "Press E — step out to the farmyard"; act = go(FARMHOUSE_EXT_DOOR.x, FARMHOUSE_EXT_DOOR.z + 1.2, ""); }
        else if (near(FH.cx + 4.5, FH.cz - 3, 2.4)) {
          prompt = "Press E — sleep in the farmhand's bunk until morning (free — the day ticks over, businesses pay out)";
          act = () => { sleepToMorning("the Downs farmhouse bunk"); };
        }
        else if (near(FH.cx, FH.cz + 3.4, 2.2)) prompt = "The farmhouse kitchen — kettle on the stove, yesterday's catch still in the sink. The bunk's through the back.";
      } else if (near(GARAGE_EXT_DOOR.x, GARAGE_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Lina's Garage";
        act = go(INTERIORS.garage.spawnIn[0], INTERIORS.garage.spawnIn[1], "garage");
      } else if (near(CLUB_EXT_DOOR.x, CLUB_EXT_DOOR.z, 2.8)) {
        // ---- Phase 23: the club keeps CLUB HOURS (20:00–04:00,
        // game/club.ts) and a BOUNCER (the broad rig by the door in
        // World.tsx): outside hours the door is simply locked; at
        // wanted 3★+ he turns you away — the house doesn't harbour
        // anyone the patrol is actively hunting. Inside, wanted
        // follows the standing interior rule (no bust in the pocket;
        // heat bleeds while unseen, exactly as in every other room).
        if (!isClubOpen(gameHour())) { prompt = "Club Solace — doors 20:00–04:00. Right now the bouncer's just a man enjoying the quiet."; warn = true; }
        else if (G.wanted >= 3) {
          prompt = "Press E — try the club door";
          act = () => {
            bark("Bouncer", G.wanted >= 5 ? "Half the harbour's looking for you and the other half's me. Not tonight." : "Three stars or better, the door stays shut. House rules — cool off and come back.");
            toast("The bouncer folds his arms. Club Solace won't take you at 3★+.");
            sfx.dryFire();
          };
        } else {
          prompt = "Press E — enter Club Solace";
          act = go(INTERIORS.club.spawnIn[0], INTERIORS.club.spawnIn[1], "club");
        }
      } else if (near(POLICE_EXT_DOOR.x, POLICE_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Harbour Patrol HQ";
        act = go(INTERIORS.police.spawnIn[0], INTERIORS.police.spawnIn[1], "police");
      } else if (near(CLINIC_EXT_DOOR.x, CLINIC_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Sable Clinic";
        act = go(INTERIORS.clinic.spawnIn[0], INTERIORS.clinic.spawnIn[1], "clinic");
      } else if (near(RESTAURANT_EXT_DOOR.x, RESTAURANT_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Marina Table restaurant";
        act = go(INTERIORS.restaurant.spawnIn[0], INTERIORS.restaurant.spawnIn[1], "restaurant");
      } else if (near(AIRPORT_DOOR.x, AIRPORT_DOOR.z, 2.8)) {
        prompt = "Press E — enter the airport hangar";
        act = go(INTERIORS.hangar.spawnIn[0], INTERIORS.hangar.spawnIn[1], "hangar");
      } else if (near(SHOWROOM_EXT_DOOR.x, SHOWROOM_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter the Sable Motors showroom";
        act = go(INTERIORS.showroom.spawnIn[0], INTERIORS.showroom.spawnIn[1], "showroom");
      } else if (near(CAFE_EXT_DOOR.x, CAFE_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Café Coral";
        act = go(INTERIORS.cafe.spawnIn[0], INTERIORS.cafe.spawnIn[1], "cafe");
      } else if (near(GYM_EXT_DOOR.x, GYM_EXT_DOOR.z, 2.8)) {
        prompt = "Press E — enter Sable Fitness";
        act = go(INTERIORS.gym.spawnIn[0], INTERIORS.gym.spawnIn[1], "gym");
      } else if (near(CLOTHING_EXT_DOOR.x, CLOTHING_EXT_DOOR.z, 2.8)) {
        // Phase 15: shop hours enforced at the door (07:00–23:00)
        if (shopsClosed()) { prompt = "Thread & Tide — closed (opens 07:00)"; warn = true; }
        else {
          prompt = "Press E — enter Thread & Tide";
          act = go(INTERIORS.clothing.spawnIn[0], INTERIORS.clothing.spawnIn[1], "clothing");
        }
      } else if (near(FARMHOUSE_EXT_DOOR.x, FARMHOUSE_EXT_DOOR.z, 2.8)) {
        // Phase 16: the farmhouse door is never locked — it's a
        // working farmhouse, and the bunk is the farmhand's by right
        prompt = "Press E — enter the Downs farmhouse";
        act = go(INTERIORS.farmhouse.spawnIn[0], INTERIORS.farmhouse.spawnIn[1], "farmhouse");
      } else if (near(LOFT_EXT_DOOR.x, LOFT_EXT_DOOR.z, 2.8)) {
        // ---- Phase 14: the Loft is bought at its own door, like the
        // villa at its gate — owning both properties is supported;
        // the latest purchase becomes the respawn home ----
        if (ECO.ownsLoft) {
          prompt = "Press E — enter your Northgate Loft";
          act = go(INTERIORS.loft.spawnIn[0], INTERIORS.loft.spawnIn[1], "loft");
        } else if (G.cash >= LOFT.price) {
          prompt = `Press E — buy the Northgate Loft ($${LOFT.price.toLocaleString()}) — bed, wardrobe, harbour view`;
          act = () => {
            G.cash -= LOFT.price;
            ECO.ownsLoft = true; persistEco(); setHomePref("loft");
            pushPhoneMsg("SableBank", `🏠 -$${LOFT.price.toLocaleString()} — Northgate Loft purchased. Keys are yours, Rayan.`);
            toast("🏠 You bought the Northgate Loft! Sleep, change outfits, watch the harbour — respawns now start here.");
            sfx.cash();
          };
        } else { prompt = `Northgate Loft — $${LOFT.price.toLocaleString()} (you have $${G.cash.toLocaleString()})`; warn = true; }
      } else if (near(MANSION_GATE.x, MANSION_GATE.z, 3.2)) {
        if (G.ownsMansion) prompt = "🏠 Sable Heights Villa — your home. Park in the drive to garage-save a car.";
        else if (G.cash >= MANSION_PRICE) {
          prompt = `Press E — buy Sable Heights Villa ($${MANSION_PRICE.toLocaleString()})`;
          act = () => {
            G.cash -= MANSION_PRICE;
            G.ownsMansion = true;
            try { localStorage.setItem("harborfall-mansion", "1"); } catch { /* ignore */ }
            pushPhoneMsg("SableBank", `🏠 -$${MANSION_PRICE.toLocaleString()} — Sable Heights Villa purchased. Welcome home, Rayan.`);
            toast("🏠 You bought Sable Heights Villa! Respawns + garage parking are yours now.");
            sfx.cash();
          };
        } else { prompt = `Sable Heights Villa — $${MANSION_PRICE.toLocaleString()} (you have $${G.cash.toLocaleString()})`; warn = true; }
      }
    }
    G.promptText = prompt; G.promptWarn = warn; G.interact = act;
  });

  const G0 = INTERIORS.garage, C0 = INTERIORS.club;
  const P0 = INTERIORS.police, CL0 = INTERIORS.clinic, R0 = INTERIORS.restaurant;
  const H0 = INTERIORS.hangar;
  const S0 = INTERIORS.showroom, CF0 = INTERIORS.cafe;
  const GY0 = INTERIORS.gym, LF0 = INTERIORS.loft;
  const TT0 = INTERIORS.clothing;
  const FH0 = INTERIORS.farmhouse;
  return (
    <group>
      {/* ================= LINA'S GARAGE — interior ================= */}
      <RoomShell cx={G0.cx} cz={G0.cz} w={G0.w} d={G0.d} h={3.6} wall={WALL_G} floor={FLOOR_G} ceiling />
      <group position={[G0.cx, 0, G0.cz]}>
        <pointLight position={[0, 3.1, 0]} intensity={26} distance={17} decay={1.7} color="#ffd9a0" />
        {/* roller door on the south wall (the way in/out) */}
        <mesh position={[0, 1.5, G0.d / 2 - 0.12]}><boxGeometry args={[4.6, 3, 0.1]} /><meshStandardMaterial color="#7d8894" metalness={0.55} roughness={0.45} /></mesh>
        {[-1.8, -0.9, 0, 0.9, 1.8].map((y) => (
          <mesh key={y} position={[0, 1.5 + y * 0.62, G0.d / 2 - 0.06]}><boxGeometry args={[4.6, 0.05, 0.04]} /><meshStandardMaterial color="#59616a" metalness={0.5} roughness={0.5} /></mesh>
        ))}
        {/* car lift with a sedan up on it */}
        <group position={[-4.6, 0, -1.5]} rotation={[0, 0.12, 0]}>
          {[-1.7, 1.7].map((x) => <mesh key={x} position={[x, 0.95, 0]} castShadow><boxGeometry args={[0.28, 1.9, 0.5]} /><primitive object={METAL} attach="material" /></mesh>)}
          <mesh position={[0, 0.55, 0]}><boxGeometry args={[4.1, 0.12, 1.9]} /><primitive object={METAL} attach="material" /></mesh>
          <group position={[0, 0.62, 0]}><CarBody kind="sedan" color="#3f7fae" /></group>
        </group>
        {/* workbench + tool wall */}
        <group position={[5.9, 0, -4.6]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[4.6, 0.12, 1]} /><primitive object={WOOD} attach="material" /></mesh>
          {[-2, 2].map((x) => <mesh key={x} position={[x, 0.42, 0]}><boxGeometry args={[0.14, 0.85, 0.85]} /><primitive object={WOOD} attach="material" /></mesh>)}
          <mesh position={[0, 2, -0.5]}><boxGeometry args={[4.6, 1.7, 0.08]} /><meshStandardMaterial color="#5d4a38" roughness={0.95} /></mesh>
          {[-1.7, -0.9, -0.1, 0.8, 1.6].map((x, i) => (
            <mesh key={i} position={[x, 1.7 + (i % 2) * 0.5, -0.44]}><boxGeometry args={[0.1, 0.5, 0.06]} /><meshStandardMaterial color={["#c22e2e", "#8a929a", "#d99a3d", "#3f7fae", "#39b56a"][i]} metalness={0.5} roughness={0.4} /></mesh>
          ))}
          {[-1.2, 0.3, 1.4].map((x, i) => (
            <mesh key={i} position={[x, 0.98, 0.15]} castShadow><boxGeometry args={[0.5, 0.24, 0.4]} /><meshStandardMaterial color={["#7a1f1f", "#274268", "#4c3b28"][i]} roughness={0.6} /></mesh>
          ))}
        </group>
        {/* shelves with crates + tyres */}
        <group position={[-7.9, 0, 2.5]} rotation={[0, Math.PI / 2, 0]}>
          {[0.6, 1.5, 2.4].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[4.4, 0.08, 0.8]} /><primitive object={METAL} attach="material" /></mesh>)}
          {[-1.6, -0.4, 0.9].map((x, i) => <mesh key={i} position={[x, 0.95, 0]} castShadow><boxGeometry args={[0.8, 0.6, 0.6]} /><meshStandardMaterial color={["#a3764f", "#6a7076", "#7a4a2b"][i]} roughness={0.9} /></mesh>)}
          {[-1.2, 0.6, 1.7].map((x, i) => <mesh key={i} position={[x, 1.85, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 12]} /><meshStandardMaterial color="#17181a" roughness={0.95} /></mesh>)}
        </group>
        {/* neon sign + warm wall lamp */}
        <mesh position={[0, 2.6, -G0.d / 2 + 0.2]}>
          <planeGeometry args={[6.4, 1.2]} />
          <meshStandardMaterial map={garageSign} emissive="#ffffff" emissiveMap={garageSign} emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[3.4, 1, 3.4]} castShadow><boxGeometry args={[0.9, 0.65, 0.9]} /><meshStandardMaterial color="#b3402e" metalness={0.4} roughness={0.5} /></mesh>
      </group>

      {/* ================= CLUB SOLACE — interior ================= */}
      <RoomShell cx={C0.cx} cz={C0.cz} w={C0.w} d={C0.d} h={4.4} wall={WALL_C} floor={FLOOR_C} ceiling />
      <group position={[C0.cx, 0, C0.cz]}>
        <pointLight position={[0, 3.6, 0]} intensity={15} distance={19} decay={1.8} color="#7fd8e8" />
        {/* stage (north end) + backdrop neon */}
        <mesh position={[0, 0.35, -5.6]} receiveShadow><boxGeometry args={[10, 0.7, 3.2]} /><meshStandardMaterial color="#1d2129" roughness={0.5} /></mesh>
        <mesh position={[0, 2.6, -C0.d / 2 + 0.2]}>
          <planeGeometry args={[1.05, 4.2]} />
          <meshStandardMaterial map={clubNeon} emissive="#ffffff" emissiveMap={clubNeon} emissiveIntensity={1.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.75, -5.4]}><boxGeometry args={[1.4, 0.1, 1]} /><meshStandardMaterial color="#22262e" roughness={0.4} /></mesh>
        {/* sweeping light beams from the stage corners */}
        <group ref={beams} position={[0, 0.7, -5.6]}>
          {[-4.2, 4.2].map((x, i) => (
            <mesh key={i} position={[x, 2, 4.6]} rotation={[0.72, 0, i === 0 ? -0.3 : 0.3]}>
              <coneGeometry args={[1.7, 7.6, 14, 1, true]} />
              <primitive object={i === 0 ? beamMatA : beamMatB} attach="material" />
            </mesh>
          ))}
        </group>
        {/* bar counter (west) + stools + bottles */}
        <group position={[-8.6, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[6.4, 1.1, 0.9]} /><meshStandardMaterial color="#232830" roughness={0.35} metalness={0.3} /></mesh>
          <mesh position={[0, 1.14, 0]}><boxGeometry args={[6.6, 0.07, 1.05]} /><meshStandardMaterial color="#3d2c1c" roughness={0.3} /></mesh>
          <mesh position={[0, 1.9, -0.42]}><boxGeometry args={[6.2, 1.5, 0.06]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={0.5} /></mesh>
          {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => (
            <group key={x} position={[x, 0, 0.95]}>
              <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 6]} /><primitive object={METAL} attach="material" /></mesh>
              <mesh position={[0, 0.84, 0]} castShadow><cylinderGeometry args={[0.26, 0.26, 0.09, 12]} /><meshStandardMaterial color="#7a2440" roughness={0.6} /></mesh>
            </group>
          ))}
          {[-2.2, -0.7, 0.9, 2.1].map((x, i) => (
            <mesh key={i} position={[x, 1.32, 0.1]}><cylinderGeometry args={[0.05, 0.06, 0.3, 6]} /><meshStandardMaterial color={["#39b56a", "#d99a3d", "#3f7fae", "#c22e2e"][i]} roughness={0.2} metalness={0.2} /></mesh>
          ))}
        </group>
        {/* dance floor: dark base + the Phase 23 colour-cycling
            tile grid (6×4, teal/amber wave driven in useFrame) */}
        <mesh position={[0.5, 0.05, -0.5]} receiveShadow><boxGeometry args={[8.5, 0.03, 6]} /><meshStandardMaterial color="#1b2a33" roughness={0.15} metalness={0.5} /></mesh>
        {floorTiles.map((m, i) => (
          <mesh key={i} position={[0.5 - 3.55 + (i % 6) * 1.42, 0.075, -0.5 - 2.13 + Math.floor(i / 6) * 1.42]} receiveShadow>
            <boxGeometry args={[1.34, 0.03, 1.34]} />
            <primitive object={m} attach="material" />
          </mesh>
        ))}
        {dancers.map((rig, i) => (
          <group key={i} position={[DANCER_SPOTS[i][0], 0, DANCER_SPOTS[i][1]]} rotation={[0, i * 1.9, 0]}>
            <primitive object={rig.group} />
          </group>
        ))}
        {/* exit door glow on the south wall */}
        <mesh position={[0, 1.4, C0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#0b0d10" emissive="#2ee6c8" emissiveIntensity={0.35} /></mesh>
      </group>
      {/* garage exit door visual (south wall, inside) */}
      <mesh position={[G0.cx, 1.4, G0.cz + G0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#20242a" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>

      {/* ================= Phase 7: HARBOUR PATROL HQ — lobby ============ */}
      <RoomShell cx={P0.cx} cz={P0.cz} w={P0.w} d={P0.d} h={3.8} wall={WALL_P} floor={FLOOR_P} ceiling />
      <group position={[P0.cx, 0, P0.cz]}>
        <pointLight position={[0, 3.2, 0]} intensity={24} distance={18} decay={1.7} color="#dfe9f5" />
        <mesh position={[0, 2.7, -P0.d / 2 + 0.2]}>
          <planeGeometry args={[6.4, 1.2]} />
          <meshStandardMaterial map={policeSign} emissive="#ffffff" emissiveMap={policeSign} emissiveIntensity={0.9} />
        </mesh>
        {/* front desk counter (surrender point) */}
        <mesh position={[0, 0.55, -2.6]} castShadow><boxGeometry args={[6.4, 1.1, 0.9]} /><meshStandardMaterial color="#2c3644" roughness={0.4} /></mesh>
        <mesh position={[0, 1.14, -2.6]}><boxGeometry args={[6.6, 0.07, 1.05]} /><primitive object={WOOD} attach="material" /></mesh>
        <mesh position={[0, 0.35, -2.6]}><boxGeometry args={[5.6, 0.1, 0.06]} /><meshStandardMaterial color="#c8a24a" metalness={0.7} roughness={0.3} /></mesh>
        {/* wanted-poster wall (east) */}
        <mesh position={[P0.w / 2 - 0.2, 1.9, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[7, 3.5]} />
          <meshStandardMaterial map={posters} roughness={0.9} />
        </mesh>
        {/* cell bars (west end) */}
        {[-3.4, -2.6, -1.8, -1.0, -0.2, 0.6].map((dz) => (
          <mesh key={dz} position={[-P0.w / 2 + 1.6, 1.5, dz]}><cylinderGeometry args={[0.045, 0.045, 3, 6]} /><primitive object={METAL} attach="material" /></mesh>
        ))}
        <mesh position={[-P0.w / 2 + 1.6, 2.9, -1.4]}><boxGeometry args={[0.08, 0.12, 4.6]} /><primitive object={METAL} attach="material" /></mesh>
        <mesh position={[-P0.w / 2 + 0.9, 0.45, -1.4]} castShadow><boxGeometry args={[1.2, 0.25, 3.4]} /><meshStandardMaterial color="#39424e" roughness={0.8} /></mesh>
        {/* waiting bench + flag stripe */}
        <mesh position={[3.4, 0.5, 3.4]} castShadow><boxGeometry args={[3.4, 0.12, 0.6]} /><primitive object={WOOD} attach="material" /></mesh>
        <mesh position={[0, 3.1, -P0.d / 2 + 0.16]}><boxGeometry args={[P0.w - 1, 0.22, 0.02]} /><meshStandardMaterial color="#c22e2e" roughness={0.6} /></mesh>
        <mesh position={[0, 1.4, P0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#141a22" emissive="#7fb2e8" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 7: SABLE CLINIC ========================= */}
      <RoomShell cx={CL0.cx} cz={CL0.cz} w={CL0.w} d={CL0.d} h={3.4} wall={WALL_CL} floor={FLOOR_CL} ceiling />
      <group position={[CL0.cx, 0, CL0.cz]}>
        <pointLight position={[0, 2.9, 0]} intensity={22} distance={15} decay={1.7} color="#f2f7f4" />
        <mesh position={[0, 2.5, -CL0.d / 2 + 0.2]}>
          <planeGeometry args={[5.4, 1]} />
          <meshStandardMaterial map={clinicSign} emissive="#ffffff" emissiveMap={clinicSign} emissiveIntensity={0.7} />
        </mesh>
        {/* reception desk (heal point) */}
        <mesh position={[0, 0.55, -2.2]} castShadow><boxGeometry args={[4.6, 1.1, 0.9]} /><meshStandardMaterial color="#e8ecea" roughness={0.35} /></mesh>
        <mesh position={[0, 1.5, -3.4]}><boxGeometry args={[0.5, 0.14, 0.14]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
        <mesh position={[0, 1.5, -3.4]}><boxGeometry args={[0.14, 0.5, 0.14]} /><meshStandardMaterial color="#c22e2e" roughness={0.5} /></mesh>
        {/* waiting chairs */}
        {[-3.4, -2.2, 2.2, 3.4].map((x) => (
          <group key={x} position={[x, 0, 2.6]}>
            <mesh position={[0, 0.48, 0]} castShadow><boxGeometry args={[0.55, 0.08, 0.5]} /><meshStandardMaterial color="#3f7fae" roughness={0.6} /></mesh>
            <mesh position={[0, 0.85, -0.24]}><boxGeometry args={[0.55, 0.8, 0.08]} /><meshStandardMaterial color="#3f7fae" roughness={0.6} /></mesh>
            <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.08, 0.48, 0.08]} /><primitive object={METAL} attach="material" /></mesh>
          </group>
        ))}
        {/* exam bed + cabinet */}
        <group position={[-5.4, 0, -2.6]} rotation={[0, 0.5, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[2.2, 0.25, 0.9]} /><meshStandardMaterial color="#eef2f0" roughness={0.5} /></mesh>
          <mesh position={[0, 0.95, -0.2]}><boxGeometry args={[0.7, 0.12, 0.6]} /><meshStandardMaterial color="#ffffff" roughness={0.6} /></mesh>
        </group>
        <mesh position={[5.6, 1.1, -3.6]} castShadow><boxGeometry args={[1.6, 2.2, 0.6]} /><meshStandardMaterial color="#b9c4c0" metalness={0.3} roughness={0.5} /></mesh>
        <mesh position={[0, 1.4, CL0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#dfe5e2" emissive="#7fd8a8" emissiveIntensity={0.25} /></mesh>
      </group>

      {/* ================= Phase 7: MARINA TABLE — restaurant ============ */}
      <RoomShell cx={R0.cx} cz={R0.cz} w={R0.w} d={R0.d} h={3.6} wall={WALL_R} floor={FLOOR_R} ceiling />
      <group position={[R0.cx, 0, R0.cz]}>
        <pointLight position={[0, 2.9, 0]} intensity={20} distance={16} decay={1.7} color="#ffca7a" />
        <pointLight position={[-5, 2.4, 2]} intensity={7} distance={8} decay={1.8} color="#ffb37f" />
        <pointLight position={[5, 2.4, 2]} intensity={7} distance={8} decay={1.8} color="#ffb37f" />
        <mesh position={[0, 2.6, -R0.d / 2 + 0.2]}>
          <planeGeometry args={[6, 1.1]} />
          <meshStandardMaterial map={restSign} emissive="#ffffff" emissiveMap={restSign} emissiveIntensity={1} />
        </mesh>
        {/* counter (meal point) */}
        <mesh position={[0, 0.55, -3.4]} castShadow><boxGeometry args={[5.6, 1.1, 0.9]} /><meshStandardMaterial color="#3a2a1c" roughness={0.35} /></mesh>
        <mesh position={[0, 1.14, -3.4]}><boxGeometry args={[5.8, 0.07, 1.05]} /><meshStandardMaterial color="#6d4c33" roughness={0.3} /></mesh>
        {[-1.8, 0, 1.8].map((x, i) => (
          <mesh key={i} position={[x, 1.36, -3.3]}><cylinderGeometry args={[0.16, 0.16, 0.05, 12]} /><meshStandardMaterial color="#e8e4da" roughness={0.4} /></mesh>
        ))}
        {/* two dining tables with chairs (sit points) */}
        {[-3.4, 3.4].map((tx) => (
          <group key={tx} position={[tx, 0, 0.4]}>
            <mesh position={[0, 0.74, 0]} castShadow><cylinderGeometry args={[0.85, 0.85, 0.07, 16]} /><meshStandardMaterial color="#e8e0d0" roughness={0.4} /></mesh>
            <mesh position={[0, 0.37, 0]}><cylinderGeometry args={[0.07, 0.07, 0.74, 8]} /><primitive object={METAL} attach="material" /></mesh>
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a, i) => (
              <group key={i} position={[Math.sin(a) * 1.25, 0, Math.cos(a) * 1.25]} rotation={[0, a + Math.PI, 0]}>
                <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[0.5, 0.07, 0.46]} /><primitive object={WOOD} attach="material" /></mesh>
                <mesh position={[0, 0.8, -0.22]}><boxGeometry args={[0.5, 0.7, 0.07]} /><primitive object={WOOD} attach="material" /></mesh>
              </group>
            ))}
            <mesh position={[0.3, 0.82, 0.2]}><cylinderGeometry args={[0.13, 0.13, 0.04, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.35} /></mesh>
            <mesh position={[-0.25, 0.84, -0.15]}><cylinderGeometry args={[0.05, 0.06, 0.14, 8]} /><meshStandardMaterial color="#7a4a2b" roughness={0.3} /></mesh>
          </group>
        ))}
        {/* window glow strip + exit */}
        <mesh position={[0, 2, R0.d / 2 - 0.16]}><boxGeometry args={[10, 1.4, 0.03]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffca7a" emissiveIntensity={0.35} transparent opacity={0.85} /></mesh>
        <mesh position={[0, 1.4, R0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#1d140d" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 9: PORT SABLE AIRPORT — hangar ======== */}
      <RoomShell cx={H0.cx} cz={H0.cz} w={H0.w} d={H0.d} h={5.2} wall={WALL_H} floor={FLOOR_H} ceiling />
      <group position={[H0.cx, 0, H0.cz]}>
        <pointLight position={[0, 4.4, 0]} intensity={30} distance={22} decay={1.7} color="#ffe2b8" />
        {/* the display Sparrow, chocked and roped off */}
        <group position={[-2.5, 0, -1.5]} rotation={[0, 0.5, 0]}>
          <CarBody kind="plane" color="#b3402e" />
        </group>
        {/* crates, drums + a tool bench along the east wall */}
        {([[6.8, -4.4], [7.6, -3.2], [6.9, 2.8]] as const).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.45, z]} castShadow><boxGeometry args={[0.95, 0.9, 0.95]} /><primitive object={WOOD} attach="material" /></mesh>
        ))}
        {([[8.6, 0.6], [8.6, 1.5]] as const).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.55, z]} castShadow><cylinderGeometry args={[0.34, 0.34, 1.1, 12]} /><meshStandardMaterial color={i ? "#31556e" : "#b3402e"} metalness={0.4} roughness={0.5} /></mesh>
        ))}
        <group position={[-8.6, 0, 3.6]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[4.2, 0.12, 1]} /><primitive object={WOOD} attach="material" /></mesh>
          {[-1.9, 1.9].map((x) => <mesh key={x} position={[x, 0.42, 0]}><boxGeometry args={[0.14, 0.85, 0.85]} /><primitive object={WOOD} attach="material" /></mesh>)}
          {[-1.2, 0.2, 1.3].map((x, i) => (
            <mesh key={i} position={[x, 1.02, 0.1]} castShadow><boxGeometry args={[0.46, 0.22, 0.36]} /><meshStandardMaterial color={["#7a1f1f", "#274268", "#4c3b28"][i]} roughness={0.6} /></mesh>
          ))}
        </group>
        {/* painted floor markings + exit door */}
        <mesh position={[-2.5, 0.06, -1.5]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4.6, 4.85, 28]} /><meshBasicMaterial color="#d99a3d" transparent opacity={0.5} /></mesh>
        <mesh position={[0, 1.4, H0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#20242a" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 13: SABLE MOTORS — showroom ============ */}
      <RoomShell cx={S0.cx} cz={S0.cz} w={S0.w} d={S0.d} h={4.8} wall={WALL_S} floor={FLOOR_S} ceiling />
      <group position={[S0.cx, 0, S0.cz]}>
        <pointLight position={[0, 4.2, 0]} intensity={34} distance={24} decay={1.7} color="#ffe2b8" />
        <mesh position={[0, 3.4, -S0.d / 2 + 0.2]}>
          <planeGeometry args={[7.4, 1.35]} />
          <meshStandardMaterial map={showroomSign} emissive="#ffffff" emissiveMap={showroomSign} emissiveIntensity={1} />
        </mesh>
        {/* the glass front, from inside: a teal sheet with the street's
            warm glow behind it (the pocket has no outside to show) */}
        <mesh position={[0, 1.75, S0.d / 2 - 0.32]}><boxGeometry args={[17, 2.7, 0.04]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffca7a" emissiveIntensity={0.28} /></mesh>
        <mesh position={[0, 1.75, S0.d / 2 - 0.26]}><boxGeometry args={[17, 2.7, 0.03]} /><meshStandardMaterial color="#a8ccd4" roughness={0.1} metalness={0.4} transparent opacity={0.35} /></mesh>
        {[-5.6, 0, 5.6].map((x) => <mesh key={x} position={[x, 1.75, S0.d / 2 - 0.24]}><boxGeometry args={[0.18, 3.1, 0.05]} /><meshStandardMaterial color="#10161e" metalness={0.5} roughness={0.4} /></mesh>)}
        {/* three turntables with the exotics (spin in useFrame) */}
        {([["wedge", "#d99a3d", -6.8], ["hyper", "#e8ecef", 0], ["gt", "#31556e", 6.8]] as const).map(([kind, color, x], i) => (
          <group key={kind} position={[x, 0, -1.6]}>
            <mesh position={[0, 0.09, 0]} receiveShadow><cylinderGeometry args={[2.7, 2.85, 0.18, 24]} /><meshStandardMaterial color="#2c3644" roughness={0.35} metalness={0.5} /></mesh>
            <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.45, 2.62, 24]} /><meshBasicMaterial color="#d99a3d" transparent opacity={0.65} /></mesh>
            <group ref={(g) => { turnRefs.current[i] = g; }} position={[0, 0.18, 0]}>
              <CarBody kind={kind} color={color} />
            </group>
          </group>
        ))}
        {/* dealer counter (the buy point) + desk glow */}
        <mesh position={[0, 0.55, -5.6]} castShadow><boxGeometry args={[5.6, 1.1, 0.9]} /><meshStandardMaterial color="#141c24" roughness={0.3} metalness={0.3} /></mesh>
        <mesh position={[0, 1.14, -5.6]}><boxGeometry args={[5.8, 0.07, 1.05]} /><meshStandardMaterial color="#d99a3d" roughness={0.35} metalness={0.4} /></mesh>
        <mesh position={[1.9, 1.32, -5.6]}><sphereGeometry args={[0.09, 10, 8]} /><meshStandardMaterial color="#ffe9a8" emissive="#ffca7a" emissiveIntensity={1.6} /></mesh>
        <mesh position={[-8.9, 0.5, 3.4]} castShadow><boxGeometry args={[1.4, 1, 0.7]} /><meshStandardMaterial color="#1f4c34" roughness={1} /></mesh>
        <mesh position={[8.9, 0.5, 3.4]} castShadow><boxGeometry args={[1.4, 1, 0.7]} /><meshStandardMaterial color="#1f4c34" roughness={1} /></mesh>
        {/* exit door on the glass line */}
        <mesh position={[0, 1.4, S0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#0b0f14" emissive="#7fd8e8" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 13: CAFÉ CORAL ========================= */}
      <RoomShell cx={CF0.cx} cz={CF0.cz} w={CF0.w} d={CF0.d} h={3.4} wall={WALL_CF} floor={FLOOR_CF} ceiling />
      <group position={[CF0.cx, 0, CF0.cz]}>
        <pointLight position={[0, 2.85, 0]} intensity={21} distance={16} decay={1.7} color="#ffca7a" />
        <mesh position={[0, 2.5, -CF0.d / 2 + 0.2]}>
          <planeGeometry args={[5.6, 1.05]} />
          <meshStandardMaterial map={cafeSign} emissive="#ffffff" emissiveMap={cafeSign} emissiveIntensity={0.9} />
        </mesh>
        {/* counter + pastry case + the machine that pays the rent */}
        <mesh position={[0, 0.55, -3.4]} castShadow><boxGeometry args={[6.6, 1.1, 0.9]} /><primitive object={WOOD} attach="material" /></mesh>
        <mesh position={[0, 1.14, -3.4]}><boxGeometry args={[6.8, 0.07, 1.05]} /><meshStandardMaterial color="#e8e0d0" roughness={0.3} /></mesh>
        <group position={[1.7, 1.18, -3.4]}>
          <mesh position={[0, 0.26, 0]}><boxGeometry args={[2.3, 0.52, 0.72]} /><meshStandardMaterial color="#cfe0e4" roughness={0.08} metalness={0.3} transparent opacity={0.4} /></mesh>
          {[-0.7, 0, 0.7].map((x, i) => (
            <mesh key={i} position={[x, 0.1, 0]}><sphereGeometry args={[0.17, 10, 8]} /><meshStandardMaterial color={["#e8c88a", "#b3542e", "#7a4a2b"][i]} roughness={0.6} /></mesh>
          ))}
        </group>
        <mesh position={[-2.3, 1.5, -3.55]} castShadow><boxGeometry args={[0.9, 0.65, 0.6]} /><meshStandardMaterial color="#22262b" metalness={0.55} roughness={0.35} /></mesh>
        <mesh position={[-2.3, 1.9, -3.55]}><boxGeometry args={[0.5, 0.14, 0.4]} /><meshStandardMaterial color="#c8ccd0" metalness={0.7} roughness={0.3} /></mesh>
        {/* two café tables with chairs (sit points) + cups */}
        {[-2.9, 2.9].map((tx) => (
          <group key={tx} position={[tx, 0, 0.6]}>
            <mesh position={[0, 0.73, 0]} castShadow><cylinderGeometry args={[0.78, 0.78, 0.06, 16]} /><meshStandardMaterial color="#e8e0d0" roughness={0.4} /></mesh>
            <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.06, 0.06, 0.73, 8]} /><primitive object={METAL} attach="material" /></mesh>
            {[0, Math.PI].map((a, i) => (
              <group key={i} position={[Math.sin(a) * 1.15, 0, Math.cos(a) * 1.15]} rotation={[0, a + Math.PI, 0]}>
                <mesh position={[0, 0.46, 0]} castShadow><boxGeometry args={[0.48, 0.07, 0.44]} /><primitive object={WOOD} attach="material" /></mesh>
                <mesh position={[0, 0.78, -0.21]}><boxGeometry args={[0.48, 0.66, 0.07]} /><primitive object={WOOD} attach="material" /></mesh>
              </group>
            ))}
            <mesh position={[0.25, 0.82, 0.15]}><cylinderGeometry args={[0.07, 0.05, 0.1, 10]} /><meshStandardMaterial color="#ffffff" roughness={0.35} /></mesh>
            <mesh position={[-0.2, 0.82, -0.2]}><cylinderGeometry args={[0.07, 0.05, 0.1, 10]} /><meshStandardMaterial color="#b3542e" roughness={0.35} /></mesh>
          </group>
        ))}
        {/* the regulars, mid-conversation at the east table */}
        <group position={[CF0.w / 2 - 5.1, 0, 1.75]} rotation={[0, Math.PI, 0]}><primitive object={cafeGuests[0].group} /></group>
        <group position={[CF0.w / 2 - 5.1, 0, -0.55]} rotation={[0, 0, 0]}><primitive object={cafeGuests[1].group} /></group>
        {/* warm window strip + exit */}
        <mesh position={[0, 2, CF0.d / 2 - 0.16]}><boxGeometry args={[9, 1.3, 0.03]} /><meshStandardMaterial color="#ffd9a0" emissive="#ffca7a" emissiveIntensity={0.35} transparent opacity={0.85} /></mesh>
        <mesh position={[0, 1.4, CF0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#2b1c10" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 14: SABLE FITNESS ===================== */}
      <RoomShell cx={GY0.cx} cz={GY0.cz} w={GY0.w} d={GY0.d} h={3.6} wall={WALL_GY} floor={FLOOR_GY} ceiling />
      <group position={[GY0.cx, 0, GY0.cz]}>
        <pointLight position={[0, 3, 0]} intensity={24} distance={17} decay={1.7} color="#dff3ee" />
        <mesh position={[0, 2.6, -GY0.d / 2 + 0.2]}>
          <planeGeometry args={[6.4, 1.05]} />
          <meshStandardMaterial map={gymSign} emissive="#ffffff" emissiveMap={gymSign} emissiveIntensity={0.9} />
        </mesh>
        {/* mirror strip along the back wall */}
        <mesh position={[0, 1.6, -GY0.d / 2 + 0.17]}><boxGeometry args={[13, 1.7, 0.03]} /><meshStandardMaterial color="#b9d4d8" metalness={0.9} roughness={0.08} /></mesh>
        {/* bench press at the west station (GYM_STATIONS bench: rel −5, −3) */}
        <group position={[-5, 0, -3]}>
          <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[1.9, 0.16, 0.55]} /><meshStandardMaterial color="#274036" roughness={0.8} /></mesh>
          <mesh position={[-0.85, 0.35, 0]}><boxGeometry args={[0.09, 0.7, 0.5]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
          <mesh position={[0.85, 0.35, 0]}><boxGeometry args={[0.09, 0.7, 0.5]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
          <mesh position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 2, 8]} /><meshStandardMaterial color="#c8ccd2" metalness={0.8} roughness={0.3} /></mesh>
          <mesh position={[-1.06, 0.72, 0]}><cylinderGeometry args={[0.21, 0.21, 0.07, 12]} /><meshStandardMaterial color="#22262b" roughness={0.6} /></mesh>
          <mesh position={[1.06, 0.72, 0]}><cylinderGeometry args={[0.21, 0.21, 0.07, 12]} /><meshStandardMaterial color="#22262b" roughness={0.6} /></mesh>
        </group>
        {/* treadmill at the east station (GYM_STATIONS tread: rel +4, −3) */}
        <group position={[4, 0, -3]}>
          <mesh position={[0, 0.16, 0]} rotation={[0.1, 0, 0]} castShadow><boxGeometry args={[0.85, 0.14, 2.3]} /><meshStandardMaterial color="#22262b" roughness={0.85} /></mesh>
          <mesh position={[0, 0.55, 1.15]}><boxGeometry args={[0.8, 0.75, 0.12]} /><meshStandardMaterial color="#39424e" metalness={0.5} roughness={0.5} /></mesh>
          <mesh position={[0, 0.95, 1.18]}><boxGeometry args={[0.5, 0.3, 0.05]} /><meshStandardMaterial color="#7fd8e8" emissive="#7fd8e8" emissiveIntensity={0.5} /></mesh>
        </group>
        {/* dumbbell rack + kettlebells along the east wall */}
        <group position={[7.6, 0, 1.5]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[3.4, 0.08, 0.5]} /><primitive object={METAL} attach="material" /></mesh>
          {[-1.4, -0.7, 0, 0.7, 1.4].map((x, i) => (
            <mesh key={i} position={[x, 0.68, 0]} castShadow><sphereGeometry args={[0.14 + i * 0.012, 10, 8]} /><meshStandardMaterial color="#22262b" roughness={0.5} metalness={0.4} /></mesh>
          ))}
        </group>
        {/* stretching mats in the middle (the park corner, remembered) */}
        {([-1.8, 0, 1.8] as const).map((x, i) => (
          <mesh key={i} position={[x, 0.05, 1.8]} rotation={[0, i * 0.1, 0]} receiveShadow>
            <boxGeometry args={[1.9, 0.04, 1]} />
            <meshStandardMaterial color={i === 1 ? "#14524f" : "#274036"} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 1.4, GY0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#0d2226" emissive="#7fd8e8" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 14: THE NORTHGATE LOFT ================ */}
      <RoomShell cx={LF0.cx} cz={LF0.cz} w={LF0.w} d={LF0.d} h={3.4} wall={WALL_LF} floor={FLOOR_LF} ceiling />
      <group position={[LF0.cx, 0, LF0.cz]}>
        <pointLight position={[0, 2.9, 0]} intensity={20} distance={15} decay={1.7} color="#ffca7a" />
        <mesh position={[0, 2.55, LF0.d / 2 - 0.2]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[4.6, 0.9]} />
          <meshStandardMaterial map={loftSign} emissive="#ffffff" emissiveMap={loftSign} emissiveIntensity={0.7} />
        </mesh>
        {/* harbour-view window wall (the −z side): three tall panes
            over a painted bay gradient — bridge, island light, water */}
        {[-4.6, 0, 4.6].map((x, i) => (
          <group key={i} position={[x, 0, -LF0.d / 2 + 0.17]}>
            <mesh position={[0, 1.75, 0]}><boxGeometry args={[3.6, 2.5, 0.05]} /><meshStandardMaterial color="#8fc6d8" emissive="#5f96ad" emissiveIntensity={0.55} /></mesh>
            <mesh position={[0, 1.05, 0.03]}><boxGeometry args={[3.6, 0.5, 0.02]} /><meshStandardMaterial color="#2e4a56" roughness={0.6} /></mesh>
            <mesh position={[0, 2.2, 0.03]}><boxGeometry args={[3.6, 0.28, 0.02]} /><meshStandardMaterial color="#e8a34c" emissive="#c97e2c" emissiveIntensity={0.4} /></mesh>
          </group>
        ))}
        {/* bed at the sleep point (rel +4.5, −3) */}
        <group position={[4.5, 0, -3]}>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[2.3, 0.5, 3.1]} /><meshStandardMaterial color="#31556e" roughness={0.85} /></mesh>
          <mesh position={[0, 0.58, 0.2]}><boxGeometry args={[2.2, 0.14, 2.2]} /><meshStandardMaterial color="#e8e0d0" roughness={0.9} /></mesh>
          <mesh position={[0, 0.62, -1.15]}><boxGeometry args={[1.7, 0.16, 0.6]} /><meshStandardMaterial color="#f2ead8" roughness={0.9} /></mesh>
          <mesh position={[0, 0.75, -1.62]}><boxGeometry args={[2.3, 1, 0.12]} /><primitive object={WOOD} attach="material" /></mesh>
        </group>
        {/* wardrobe at its point (rel −5, −3): doors + the rail of
            whatever Thread & Tide sold you */}
        <group position={[-5, 0, -3]}>
          <mesh position={[0, 1.15, 0]} castShadow><boxGeometry args={[2.2, 2.3, 0.7]} /><primitive object={WOOD} attach="material" /></mesh>
          <mesh position={[-0.55, 1.15, 0.37]}><boxGeometry args={[1, 2.1, 0.03]} /><meshStandardMaterial color="#54382a" roughness={0.8} /></mesh>
          <mesh position={[0.55, 1.15, 0.37]}><boxGeometry args={[1, 2.1, 0.03]} /><meshStandardMaterial color="#54382a" roughness={0.8} /></mesh>
        </group>
        {/* sofa + rug + plant, harbour-side living corner */}
        <group position={[-2.5, 0, 2.8]}>
          <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[3, 0.7, 1.1]} /><meshStandardMaterial color="#14524f" roughness={0.9} /></mesh>
          <mesh position={[0, 0.95, -0.45]}><boxGeometry args={[3, 0.6, 0.25]} /><meshStandardMaterial color="#14524f" roughness={0.9} /></mesh>
          <mesh position={[0, 0.03, 1.6]} receiveShadow><boxGeometry args={[3.6, 0.03, 2]} /><meshStandardMaterial color="#8a4a2e" roughness={0.95} /></mesh>
        </group>
        <group position={[6.8, 0, 3.4]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.3, 0.24, 0.6, 10]} /><meshStandardMaterial color="#b3542e" roughness={0.8} /></mesh>
          <mesh position={[0, 1, 0]}><sphereGeometry args={[0.55, 10, 8]} /><meshStandardMaterial color="#2e5d43" roughness={0.95} /></mesh>
        </group>
        <mesh position={[0, 1.4, LF0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#232a31" emissive="#ffca7a" emissiveIntensity={0.3} /></mesh>
      </group>

      {/* ================= Phase 15: THREAD & TIDE (walk-in) ========== */}
      <RoomShell cx={TT0.cx} cz={TT0.cz} w={TT0.w} d={TT0.d} h={3.4} wall={WALL_TT} floor={FLOOR_TT} ceiling />
      <group position={[TT0.cx, 0, TT0.cz]}>
        <pointLight position={[0, 2.9, 0]} intensity={20} distance={15} decay={1.7} color="#ffe9c4" />
        <mesh position={[0, 2.55, TT0.d / 2 - 0.2]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[5.2, 0.95]} />
          <meshStandardMaterial map={ttSign} emissive="#ffffff" emissiveMap={ttSign} emissiveIntensity={0.8} />
        </mesh>
        {/* clothing racks along both side walls — the stock itself,
            coloured from CLOTHING_ITEMS like the street signage rack */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * (TT0.w / 2 - 1.1), 0, -0.5]} rotation={[0, side * Math.PI / 2, 0]}>
            <mesh position={[-1.6, 0.8, 0]} castShadow><boxGeometry args={[0.08, 1.6, 0.08]} /><primitive object={METAL} attach="material" /></mesh>
            <mesh position={[1.6, 0.8, 0]} castShadow><boxGeometry args={[0.08, 1.6, 0.08]} /><primitive object={METAL} attach="material" /></mesh>
            <mesh position={[0, 1.58, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 3.3, 8]} /><primitive object={METAL} attach="material" /></mesh>
            {CLOTHING_ITEMS.map((it, i) => (
              <mesh key={it.id} position={[-1.35 + i * 0.54, 1.2, 0]} castShadow>
                <boxGeometry args={[0.44, 0.64, 0.1]} />
                <meshStandardMaterial color={it.top} roughness={0.85} />
              </mesh>
            ))}
          </group>
        ))}
        {/* the counter at the back (CLOTHING_COUNTER point, rel 0,−3.5):
            till, folded stack, mirror card */}
        <group position={[0, 0, -3.5]}>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[3.4, 1.1, 0.9]} /><primitive object={WOOD} attach="material" /></mesh>
          <mesh position={[1.1, 1.22, 0]}><boxGeometry args={[0.5, 0.24, 0.4]} /><meshStandardMaterial color="#22262b" roughness={0.4} metalness={0.3} /></mesh>
          <mesh position={[-1, 1.16, 0]}><boxGeometry args={[0.7, 0.12, 0.5]} /><meshStandardMaterial color="#1f7a72" roughness={0.85} /></mesh>
          <mesh position={[0, 1.7, -0.55]}><boxGeometry args={[1.1, 1.5, 0.04]} /><meshStandardMaterial color="#b9d4d8" metalness={0.9} roughness={0.08} /></mesh>
        </group>
        {/* changing-room curtain corner */}
        <group position={[-TT0.w / 2 + 1.6, 0, TT0.d / 2 - 1.6]}>
          <mesh position={[0, 1.3, 0]} castShadow><boxGeometry args={[2.2, 2.6, 0.08]} /><meshStandardMaterial color="#7a2e2e" roughness={0.95} /></mesh>
        </group>
        <mesh position={[0, 1.4, TT0.d / 2 - 0.12]}><boxGeometry args={[1.7, 2.8, 0.08]} /><meshStandardMaterial color="#17303a" emissive="#ffb340" emissiveIntensity={0.3} /></mesh>
      </group>
      {/* ================= THE DOWNS FARMHOUSE — interior (Phase 16) =================
          Kitchen/living in one room; the bunk at the back (rel +4.5,−3,
          the sleep prompt point). Cream walls over wood boards. */}
      <RoomShell cx={FH0.cx} cz={FH0.cz} w={FH0.w} d={FH0.d} h={3.2} wall={WALL_CF} floor={FLOOR_LF} ceiling />
      <group position={[FH0.cx, 0, FH0.cz]}>
        <pointLight position={[0, 2.7, 0]} intensity={22} distance={15} decay={1.7} color="#ffd9a0" />
        {/* the farmhand's bunk — frame, mattress, pillow, harbour-teal blanket */}
        <group position={[4.5, 0, -3]}>
          <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[1.15, 0.55, 2.3]} /><primitive object={WOOD} attach="material" /></mesh>
          <mesh position={[0, 0.62, 0]}><boxGeometry args={[1.05, 0.16, 2.15]} /><meshStandardMaterial color="#e8e2d2" roughness={0.9} /></mesh>
          <mesh position={[0, 0.68, 0.55]}><boxGeometry args={[1.0, 0.14, 1.35]} /><meshStandardMaterial color="#1f7a72" roughness={0.9} /></mesh>
          <mesh position={[0, 0.74, -0.85]}><boxGeometry args={[0.7, 0.12, 0.45]} /><meshStandardMaterial color="#f2ecdc" roughness={0.95} /></mesh>
        </group>
        {/* kitchen run along the west wall: counter, stove, kettle */}
        <group position={[-FH0.w / 2 + 0.75, 0, -1]}>
          <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[1.1, 1, 4.6]} /><primitive object={WOOD} attach="material" /></mesh>
          <mesh position={[0.1, 1.02, -1.2]}><boxGeometry args={[0.95, 0.05, 1.1]} /><meshStandardMaterial color="#22262b" roughness={0.4} metalness={0.3} /></mesh>
          <mesh position={[0.1, 1.16, -1.2]}><cylinderGeometry args={[0.14, 0.17, 0.24, 10]} /><meshStandardMaterial color="#8a929c" roughness={0.3} metalness={0.7} /></mesh>
          <mesh position={[0.1, 1.1, 1.4]}><boxGeometry args={[0.8, 0.14, 0.9]} /><meshStandardMaterial color="#5d4a33" roughness={0.8} /></mesh>
        </group>
        {/* living end: table, two chairs, rug, a low sofa facing the stove */}
        <group position={[-2.5, 0, 2.2]}>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.4, 2.4]} /><meshStandardMaterial color="#7a3b2e" roughness={0.95} /></mesh>
          <mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[1.5, 0.08, 0.95]} /><primitive object={WOOD} attach="material" /></mesh>
          {[-0.6, 0.6].map((lx) => (
            <mesh key={lx} position={[lx, 0.21, 0]}><boxGeometry args={[0.09, 0.42, 0.09]} /><primitive object={WOOD} attach="material" /></mesh>
          ))}
          {[-1.05, 1.05].map((cx2) => (
            <group key={cx2} position={[cx2, 0, 0]}>
              <mesh position={[0, 0.26, 0]}><boxGeometry args={[0.5, 0.07, 0.5]} /><primitive object={WOOD} attach="material" /></mesh>
              <mesh position={[0, 0.55, cx2 > 0 ? 0.24 : -0.24]}><boxGeometry args={[0.5, 0.6, 0.06]} /><primitive object={WOOD} attach="material" /></mesh>
            </group>
          ))}
        </group>
        <group position={[2.8, 0, 2.6]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[2, 0.5, 0.8]} /><meshStandardMaterial color="#4a5d23" roughness={0.9} /></mesh>
          <mesh position={[0, 0.85, -0.32]}><boxGeometry args={[2, 0.6, 0.18]} /><meshStandardMaterial color="#43561f" roughness={0.9} /></mesh>
        </group>
        {/* window glow over the yard + a door mat at the exit */}
        <mesh position={[0, 1.5, FH0.d / 2 - 0.12]}><boxGeometry args={[1.8, 1.3, 0.08]} /><meshStandardMaterial color="#17303a" emissive="#ffb340" emissiveIntensity={0.3} /></mesh>
        <mesh position={[0, 0.02, FH0.d / 2 - 1.1]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.4, 0.8]} /><meshStandardMaterial color="#5d4a33" roughness={0.95} /></mesh>
      </group>
    </group>
  );
}
