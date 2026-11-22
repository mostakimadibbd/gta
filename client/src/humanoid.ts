// Harborfall — shared articulated humanoid, REALISTIC-STYLED rebuild.
// Real human proportions (~1.85u ≈ 7.5 heads), tapered-cylinder limbs (no
// toy blocks), rounded torso, canvas skin/fabric/hair textures, and a drawn
// face on a spherical cap patch (eyes/brows/nose shading/lips/beard) that
// reads at gameplay distance. Builds: slim / average / broad. Skin tones and
// outfits come from the caller. Same rig API as before — Player, peds,
// vignettes and the club queue all share it. Geometries are module-level
// singletons; materials are colour-cached, so 20+ rigs stay cheap.
import * as THREE from "three";
import { fabricTexture, skinTexture, hairTexture, faceTexture } from "./textures";

export interface HumanoidOptions {
  top: string;            // shirt / jacket colour
  sleeve?: string;        // contrast sleeve colour (varsity)
  bottom: string;         // jeans / pants colour
  skin: string;
  hair: string;
  shoes?: string;
  undershirt?: string;
  topStyle?: "tee" | "tank" | "hoodie" | "varsity" | "crop";
  bottomStyle?: "jeans" | "shorts";
  gender?: "m" | "f";
  hairStyle?: "cap" | "flat" | "bun" | "ponytail";
  sunglasses?: boolean;
  cap?: string;           // cap colour, if wearing one
  tattooSleeve?: boolean; // darker patterned right arm
  necklace?: boolean;
  build?: "slim" | "average" | "broad";
  beard?: boolean;
}

export interface HumanoidRig {
  group: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  lThigh: THREE.Group; rThigh: THREE.Group;
  lShin: THREE.Group; rShin: THREE.Group;
  lArm: THREE.Group; rArm: THREE.Group;
  lFore: THREE.Group; rFore: THREE.Group;
  topMats: THREE.MeshStandardMaterial[];
  setTop: (color: string) => void;
}

// ---- shared geometries (created once) — tapered, rounded forms ----
const GEO = {
  pelvis: new THREE.CylinderGeometry(0.168, 0.148, 0.2, 12),
  chest: new THREE.CylinderGeometry(0.208, 0.152, 0.54, 12),
  chestCrop: new THREE.CylinderGeometry(0.192, 0.158, 0.32, 12),
  midriff: new THREE.CylinderGeometry(0.148, 0.138, 0.16, 12),
  underV: new THREE.BoxGeometry(0.15, 0.3, 0.03),
  stripe: new THREE.BoxGeometry(0.4, 0.06, 0.2),
  hood: new THREE.BoxGeometry(0.28, 0.15, 0.11),
  pocket: new THREE.BoxGeometry(0.23, 0.11, 0.035),
  emblem: new THREE.CircleGeometry(0.037, 12),
  upperArm: new THREE.CylinderGeometry(0.054, 0.041, 0.38, 10),
  foreArm: new THREE.CylinderGeometry(0.041, 0.031, 0.34, 10),
  hand: new THREE.SphereGeometry(0.046, 8, 6),
  thigh: new THREE.CylinderGeometry(0.07, 0.05, 0.46, 10),
  thighShort: new THREE.CylinderGeometry(0.072, 0.058, 0.24, 10),
  shin: new THREE.CylinderGeometry(0.049, 0.034, 0.44, 10),
  shoe: new THREE.BoxGeometry(0.125, 0.075, 0.27),
  toe: new THREE.SphereGeometry(0.062, 8, 6),
  sole: new THREE.BoxGeometry(0.135, 0.03, 0.31),
  neck: new THREE.CylinderGeometry(0.05, 0.057, 0.12, 10),
  head: new THREE.SphereGeometry(0.155, 18, 14),
  // face patch: spherical cap hugging the skull's front (phi centred on +Z)
  face: new THREE.SphereGeometry(0.1585, 14, 10, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.56, 1.12),
  hairCap: new THREE.SphereGeometry(0.164, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
  hairLong: new THREE.SphereGeometry(0.166, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.74),
  hairBack: new THREE.BoxGeometry(0.27, 0.34, 0.055),
  bun: new THREE.SphereGeometry(0.075, 8, 8),
  ponytail: new THREE.CapsuleGeometry(0.05, 0.22, 3, 6),
  flatTop: new THREE.BoxGeometry(0.26, 0.065, 0.26),
  shades: new THREE.BoxGeometry(0.26, 0.052, 0.03),
  capTop: new THREE.CylinderGeometry(0.163, 0.168, 0.075, 12, 1, false, 0, Math.PI * 2),
  capBrim: new THREE.BoxGeometry(0.23, 0.024, 0.15),
  necklace: new THREE.TorusGeometry(0.095, 0.013, 6, 14),
};

// ---- colour-cached materials ----
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function fabricMat(color: string): THREE.MeshStandardMaterial {
  const key = `f:${color}`;
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, map: fabricTexture(), roughness: 0.88 }); matCache.set(key, m); }
  return m;
}
function plainMat(key: string, color: string, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  const k = `p:${key}:${color}`;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); matCache.set(k, m); }
  return m;
}
function skinMat(c: string): THREE.MeshStandardMaterial {
  const k = `skin:${c}`;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, map: skinTexture(), roughness: 0.62 }); matCache.set(k, m); }
  return m;
}
function hairMatFn(c: string): THREE.MeshStandardMaterial {
  const k = `hair:${c}`;
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, map: hairTexture(), roughness: 0.92 }); matCache.set(k, m); }
  return m;
}
const darkMat = (c: string) => plainMat("dark", c, 0.5);
const faceMats = new Map<string, THREE.MeshStandardMaterial>();
function faceMat(variant: "m" | "f" | "beard"): THREE.MeshStandardMaterial {
  let m = faceMats.get(variant);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: faceTexture(variant), transparent: true, roughness: 0.62, depthWrite: false });
    faceMats.set(variant, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

export function buildHumanoid(o: HumanoidOptions): HumanoidRig {
  const female = o.gender === "f";
  const style = o.topStyle ?? "tee";
  const shorts = o.bottomStyle === "shorts";
  const skin = skinMat(o.skin);
  const hair = hairMatFn(o.hair);
  const bottom = fabricMat(o.bottom);
  const shoe = darkMat(o.shoes ?? "#16181c");
  const topMats: THREE.MeshStandardMaterial[] = [];
  // Top material is NOT cached-shared for the player (theme recolours it),
  // so each rig gets its own top fabric material instance.
  const topMat = new THREE.MeshStandardMaterial({ color: o.top, map: fabricTexture(), roughness: 0.88 });
  topMats.push(topMat);
  const sleeveMat = style === "varsity"
    ? new THREE.MeshStandardMaterial({ color: o.sleeve ?? "#e8e4da", map: fabricTexture(), roughness: 0.88 })
    : topMat;
  if (sleeveMat !== topMat) topMats.push(sleeveMat);
  const tattooMat = new THREE.MeshStandardMaterial({ color: "#5a4638", map: fabricTexture(), roughness: 0.7 });
  const longSleeve = style === "hoodie" || style === "varsity";
  const armSkin = style === "tank" ? skin : null; // tank: bare upper arms

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  // body variety: gender base × build (slim / average / broad)
  const buildX = o.build === "broad" ? 1.13 : o.build === "slim" ? 0.9 : 1;
  const buildZ = o.build === "broad" ? 1.07 : o.build === "slim" ? 0.94 : 1;
  body.scale.set((female ? 0.94 : 1) * buildX, female ? 0.985 : 1, (female ? 0.94 : 1) * buildZ);

  // pelvis / hips (rounded, narrower than shoulders)
  const pelvis = mesh(GEO.pelvis, bottom, 0, 0.95, 0);
  pelvis.scale.set(female ? 1.1 : 1, 1, 0.74);
  body.add(pelvis);

  // ---- legs: thigh pivot at hip (y .92), shin pivot at knee ----
  function leg(side: -1 | 1) {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.096, 0.92, 0);
    if (shorts) {
      thigh.add(mesh(GEO.thighShort, bottom, 0, -0.12, 0));
      const bare = mesh(GEO.thigh, skin, 0, -0.35, 0);
      bare.scale.set(0.86, 0.5, 0.86);
      thigh.add(bare);
    } else {
      thigh.add(mesh(GEO.thigh, bottom, 0, -0.23, 0));
    }
    const shin = new THREE.Group(); shin.position.set(0, -0.46, 0);
    shin.add(mesh(GEO.shin, shorts ? skin : bottom, 0, -0.22, 0));
    shin.add(mesh(GEO.shoe, shoe, 0, -0.45, 0.04));
    const toe = mesh(GEO.toe, shoe, 0, -0.465, 0.155); toe.scale.set(1, 0.55, 1.15);
    shin.add(toe);
    shin.add(mesh(GEO.sole, darkMat("#24211e"), 0, -0.49, 0.05));
    thigh.add(shin);
    body.add(thigh);
    return { thigh, shin };
  }
  const lLeg = leg(-1), rLeg = leg(1);

  // ---- torso (pivot at waist for lean/breathing) ----
  const torso = new THREE.Group(); torso.position.set(0, 1.03, 0);
  if (style === "crop") {
    const crop = mesh(GEO.chestCrop, topMat, 0, 0.42, 0); crop.scale.z = 0.72;
    torso.add(crop);
    const mid = mesh(GEO.midriff, skin, 0, 0.17, 0); mid.scale.z = 0.7;
    torso.add(mid);
  } else {
    const chest = mesh(GEO.chest, topMat, 0, 0.28, 0);
    chest.scale.z = style === "hoodie" ? 0.78 : 0.7;
    if (style === "hoodie") chest.scale.x = 1.07;
    if (female) chest.scale.x = 1.04;
    torso.add(chest);
    if (style === "varsity") {
      const stripe = mesh(GEO.stripe, plainMat("stripe", "#e8e4da", 0.8), 0, 0.13, 0);
      stripe.scale.set(1, 1, 0.72);
      torso.add(stripe);
      // jacket emblem (left chest) — Rayan's varsity detail
      const em = mesh(GEO.emblem, plainMat("gold", "#d4af37", 0.35, 0.7), -0.09, 0.38, 0.148, false);
      torso.add(em);
    }
    if (style === "hoodie") torso.add(mesh(GEO.pocket, topMat, 0, 0.14, 0.145));
    if (style !== "hoodie") torso.add(mesh(GEO.underV, fabricMat(o.undershirt ?? "#e8e2d4"), 0, 0.33, 0.128, false));
  }
  if (style === "hoodie") torso.add(mesh(GEO.hood, topMat, 0, 0.52, -0.15));
  body.add(torso);

  // ---- arms: shoulder pivot in torso space, forearm pivot at elbow ----
  function arm(side: -1 | 1) {
    const armG = new THREE.Group(); armG.position.set(side * 0.262, 0.47, 0);
    const upperMat = armSkin ?? sleeveMat;
    armG.add(mesh(GEO.upperArm, side === 1 && o.tattooSleeve ? tattooMat : upperMat, 0, -0.18, 0));
    const fore = new THREE.Group(); fore.position.set(0, -0.37, 0);
    const foreMat = side === 1 && o.tattooSleeve ? tattooMat : longSleeve ? sleeveMat : skin;
    fore.add(mesh(GEO.foreArm, foreMat, 0, -0.16, 0));
    const hand = mesh(GEO.hand, skin, 0, -0.38, 0);
    hand.scale.set(0.82, 1.3, 0.5);
    fore.add(hand);
    armG.add(fore);
    torso.add(armG);
    return { armG, fore };
  }
  const lArm = arm(-1), rArm = arm(1);

  // ---- head: rounded skull + drawn face patch + textured hair ----
  const head = new THREE.Group(); head.position.set(0, 1.56, 0);
  head.add(mesh(GEO.neck, skin, 0, 0.0, 0));
  const skull = mesh(GEO.head, skin, 0, 0.155, 0);
  skull.scale.set(0.92, 1.08, 0.97);
  head.add(skull);
  if (!o.sunglasses) {
    const face = new THREE.Mesh(GEO.face, faceMat(o.beard ? "beard" : female ? "f" : "m"));
    face.position.set(0, 0.155, 0);
    face.scale.set(0.92, 1.08, 0.97);
    head.add(face);
  }
  const hairStyle = o.hairStyle ?? (female ? "bun" : "cap");
  if (!o.cap) {
    if (hairStyle === "flat") {
      const ft = mesh(GEO.flatTop, hair, 0, 0.315, 0); ft.scale.set(1, 1, 1);
      head.add(ft);
      head.add(mesh(GEO.hairCap, hair, 0, 0.165, -0.02));
    } else if (hairStyle === "bun") {
      head.add(mesh(GEO.hairLong, hair, 0, 0.165, -0.018));
      head.add(mesh(GEO.hairBack, hair, 0, 0.03, -0.135));
      head.add(mesh(GEO.bun, hair, 0, 0.33, -0.11));
    } else if (hairStyle === "ponytail") {
      head.add(mesh(GEO.hairCap, hair, 0, 0.175, -0.012));
      head.add(mesh(GEO.hairBack, hair, 0, 0.05, -0.135));
      const tail = mesh(GEO.ponytail, hair, 0, 0.08, -0.18);
      tail.rotation.x = 0.25;
      head.add(tail);
    } else {
      head.add(mesh(GEO.hairCap, hair, 0, 0.175, -0.012));
    }
  } else {
    const capMat = fabricMat(o.cap);
    head.add(mesh(GEO.capTop, capMat, 0, 0.285, 0));
    head.add(mesh(GEO.capBrim, capMat, 0, 0.255, 0.19));
  }
  if (o.sunglasses) {
    head.add(mesh(GEO.shades, darkMat("#0c0e11"), 0, 0.185, 0.138, false));
  }
  if (o.necklace) {
    const n = mesh(GEO.necklace, plainMat("gold", "#d4af37", 0.3, 0.85), 0, 0.015, 0.045, false);
    n.rotation.x = 0.5;
    head.add(n);
  }
  body.add(head);

  return {
    group, body, torso, head,
    lThigh: lLeg.thigh, rThigh: rLeg.thigh, lShin: lLeg.shin, rShin: rLeg.shin,
    lArm: lArm.armG, rArm: rArm.armG, lFore: lArm.fore, rFore: rArm.fore,
    topMats,
    setTop: (color: string) => topMat.color.set(color),
  };
}

/** Walk/run/idle animation. phase advances with stride; intensity 0..1. */
export function animateHumanoid(rig: HumanoidRig, phase: number, intensity: number, time: number) {
  const i = THREE.MathUtils.clamp(intensity, 0, 1);
  const s = Math.sin(phase), c = Math.cos(phase);
  rig.lThigh.rotation.x = -s * 0.62 * i;
  rig.rThigh.rotation.x = s * 0.62 * i;
  rig.lShin.rotation.x = Math.max(0, -c) * 0.85 * i + 0.04;
  rig.rShin.rotation.x = Math.max(0, c) * 0.85 * i + 0.04;
  // arms swing counter-phase to the same-side leg
  rig.lArm.rotation.x = s * 0.55 * i;
  rig.rArm.rotation.x = -s * 0.55 * i;
  rig.lFore.rotation.x = -(0.18 + Math.max(0, -s) * 0.4) * Math.max(i, 0.15);
  rig.rFore.rotation.x = -(0.18 + Math.max(0, s) * 0.4) * Math.max(i, 0.15);
  // idle life: arm sway + breathing when not walking
  rig.lArm.rotation.z = 0.07 + Math.sin(time * 1.7) * 0.022 * (1 - i);
  rig.rArm.rotation.z = -0.07 - Math.cos(time * 1.6) * 0.022 * (1 - i);
  // torso: forward lean grows with speed, gentle sway, breathing at idle
  rig.torso.rotation.x = 0.04 * i + 0.075 * i * i;
  rig.torso.rotation.z = s * 0.028 * i;
  rig.torso.scale.y = 1 + Math.sin(time * 1.8) * 0.014 * (1 - i);
  rig.body.position.y = Math.abs(c) * 0.05 * i;
  // idle weight shift + subtle head bob while walking
  rig.body.position.x = Math.sin(time * 0.5) * 0.018 * (1 - i);
  rig.head.position.y = 1.56 + Math.abs(s) * 0.012 * i;
  rig.head.rotation.y = Math.sin(time * 0.45) * 0.06 * (1 - i);
  rig.head.rotation.x = 0.05 * i;
}
