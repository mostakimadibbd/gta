// Harborfall — shared articulated humanoid (~1.85u). Used by the player
// (Rayan) and every pedestrian, with outfit/accessory variety from the
// mood board: tees, tanks, hoodies, varsity jackets, caps, sunglasses,
// shorts, female silhouettes with bun/ponytail. Shared geometries +
// colour-cached fabric materials keep it cheap (15 rigs ≈ a few draw
// calls each, no per-frame allocation).
import * as THREE from "three";
import { fabricTexture } from "./textures";

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

// ---- shared geometries (created once) ----
const GEO = {
  pelvis: new THREE.BoxGeometry(0.36, 0.2, 0.22),
  chest: new THREE.BoxGeometry(0.42, 0.54, 0.25),
  chestCrop: new THREE.BoxGeometry(0.4, 0.32, 0.24),
  midriff: new THREE.BoxGeometry(0.34, 0.16, 0.21),
  underV: new THREE.BoxGeometry(0.16, 0.32, 0.03),
  stripe: new THREE.BoxGeometry(0.43, 0.07, 0.26),
  hood: new THREE.BoxGeometry(0.3, 0.16, 0.12),
  upperArm: new THREE.BoxGeometry(0.115, 0.38, 0.125),
  foreArm: new THREE.BoxGeometry(0.098, 0.34, 0.108),
  hand: new THREE.BoxGeometry(0.09, 0.13, 0.05),
  thigh: new THREE.BoxGeometry(0.145, 0.46, 0.16),
  thighShort: new THREE.BoxGeometry(0.15, 0.24, 0.165),
  shin: new THREE.BoxGeometry(0.115, 0.44, 0.125),
  shoe: new THREE.BoxGeometry(0.13, 0.085, 0.3),
  sole: new THREE.BoxGeometry(0.14, 0.032, 0.32),
  neck: new THREE.CylinderGeometry(0.052, 0.058, 0.12, 8),
  head: new THREE.SphereGeometry(0.155, 14, 12),
  hairCap: new THREE.SphereGeometry(0.163, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
  hairLong: new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.72),
  bun: new THREE.SphereGeometry(0.075, 8, 8),
  ponytail: new THREE.CapsuleGeometry(0.05, 0.22, 3, 6),
  flatTop: new THREE.BoxGeometry(0.27, 0.07, 0.27),
  eye: new THREE.BoxGeometry(0.032, 0.042, 0.012),
  shades: new THREE.BoxGeometry(0.27, 0.055, 0.03),
  nose: new THREE.BoxGeometry(0.032, 0.052, 0.024),
  capTop: new THREE.CylinderGeometry(0.165, 0.17, 0.075, 10, 1, false, 0, Math.PI * 2),
  capBrim: new THREE.BoxGeometry(0.24, 0.025, 0.15),
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
const skinMat = (c: string) => plainMat("skin", c, 0.55);
const hairMat = (c: string) => plainMat("hair", c, 0.95);
const darkMat = (c: string) => plainMat("dark", c, 0.5);

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
  const hair = hairMat(o.hair);
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
  if (female) body.scale.set(0.94, 0.985, 0.94);

  // pelvis / hips
  const pelvis = mesh(GEO.pelvis, bottom, 0, 0.95, 0);
  if (female) pelvis.scale.set(1.08, 1, 1);
  body.add(pelvis);

  // ---- legs: thigh pivot at hip (y .92), shin pivot at knee ----
  function leg(side: -1 | 1) {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.098, 0.92, 0);
    if (shorts) {
      thigh.add(mesh(GEO.thighShort, bottom, 0, -0.12, 0));
      thigh.add(mesh(GEO.thigh, skin, 0, -0.35, 0)).children;
      thigh.children[1].scale.set(0.88, 0.5, 0.88); thigh.children[1].position.y = -0.35;
    } else {
      thigh.add(mesh(GEO.thigh, bottom, 0, -0.23, 0));
    }
    const shin = new THREE.Group(); shin.position.set(0, -0.46, 0);
    shin.add(mesh(GEO.shin, shorts ? skin : bottom, 0, -0.22, 0));
    shin.add(mesh(GEO.shoe, shoe, 0, -0.445, 0.045));
    shin.add(mesh(GEO.sole, darkMat("#24211e"), 0, -0.485, 0.05));
    thigh.add(shin);
    body.add(thigh);
    return { thigh, shin };
  }
  const lLeg = leg(-1), rLeg = leg(1);

  // ---- torso (pivot at waist for lean/breathing) ----
  const torso = new THREE.Group(); torso.position.set(0, 1.03, 0);
  if (style === "crop") {
    torso.add(mesh(GEO.chestCrop, topMat, 0, 0.42, 0));
    torso.add(mesh(GEO.midriff, skin, 0, 0.17, 0));
  } else {
    const chest = mesh(GEO.chest, topMat, 0, 0.28, 0);
    if (style === "hoodie") chest.scale.set(1.09, 1, 1.12);
    torso.add(chest);
    if (style === "varsity") torso.add(mesh(GEO.stripe, plainMat("stripe", "#e8e4da", 0.8), 0, 0.16, 0));
    if (style !== "hoodie") torso.add(mesh(GEO.underV, fabricMat(o.undershirt ?? "#e8e2d4"), 0, 0.33, 0.118, false));
  }
  if (style === "hoodie") torso.add(mesh(GEO.hood, topMat, 0, 0.52, -0.15));
  body.add(torso);

  // ---- arms: shoulder pivot in torso space, forearm pivot at elbow ----
  function arm(side: -1 | 1) {
    const armG = new THREE.Group(); armG.position.set(side * 0.275, 0.47, 0);
    const upperMat = armSkin ?? sleeveMat;
    armG.add(mesh(GEO.upperArm, side === 1 && o.tattooSleeve ? tattooMat : upperMat, 0, -0.18, 0));
    const fore = new THREE.Group(); fore.position.set(0, -0.37, 0);
    const foreMat = side === 1 && o.tattooSleeve ? tattooMat : longSleeve ? sleeveMat : skin;
    fore.add(mesh(GEO.foreArm, foreMat, 0, -0.16, 0));
    fore.add(mesh(GEO.hand, skin, 0, -0.37, 0));
    armG.add(fore);
    torso.add(armG);
    return { armG, fore };
  }
  const lArm = arm(-1), rArm = arm(1);

  // ---- head ----
  const head = new THREE.Group(); head.position.set(0, 1.56, 0);
  head.add(mesh(GEO.neck, skin, 0, 0.0, 0));
  const skull = mesh(GEO.head, skin, 0, 0.155, 0);
  skull.scale.set(0.92, 1.08, 0.97);
  head.add(skull);
  const hairStyle = o.hairStyle ?? (female ? "bun" : "cap");
  if (!o.cap) {
    if (hairStyle === "flat") head.add(mesh(GEO.flatTop, hair, 0, 0.315, 0));
    else if (hairStyle === "bun") {
      head.add(mesh(GEO.hairLong, hair, 0, 0.165, -0.018));
      head.add(mesh(GEO.bun, hair, 0, 0.33, -0.11));
    } else if (hairStyle === "ponytail") {
      head.add(mesh(GEO.hairCap, hair, 0, 0.175, -0.012));
      const tail = mesh(GEO.ponytail, hair, 0, 0.08, -0.17);
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
  } else {
    head.add(mesh(GEO.eye, darkMat("#241a14"), -0.055, 0.185, 0.143, false));
    head.add(mesh(GEO.eye, darkMat("#241a14"), 0.055, 0.185, 0.143, false));
  }
  head.add(mesh(GEO.nose, skin, 0, 0.125, 0.15, false));
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
  rig.lArm.rotation.x = s * 0.55 * i;
  rig.rArm.rotation.x = -s * 0.55 * i;
  rig.lFore.rotation.x = -(0.18 + Math.max(0, -s) * 0.4) * Math.max(i, 0.15);
  rig.rFore.rotation.x = -(0.18 + Math.max(0, s) * 0.4) * Math.max(i, 0.15);
  // idle life: arm sway + breathing when not walking
  rig.lArm.rotation.z = 0.07 + Math.sin(time * 1.7) * 0.022 * (1 - i);
  rig.rArm.rotation.z = -0.07 - Math.cos(time * 1.6) * 0.022 * (1 - i);
  rig.torso.rotation.x = 0.07 * i;
  rig.torso.scale.y = 1 + Math.sin(time * 1.8) * 0.014 * (1 - i);
  rig.body.position.y = Math.abs(c) * 0.05 * i;
  rig.head.rotation.y = Math.sin(time * 0.45) * 0.06 * (1 - i);
}
