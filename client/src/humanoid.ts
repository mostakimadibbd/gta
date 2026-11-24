// Harborfall — shared articulated humanoid, REALISTIC-STYLED rebuild.
// Real human proportions (~1.85u ≈ 7.5 heads), tapered-cylinder limbs (no
// toy blocks), rounded torso, canvas skin/fabric/hair textures, and a drawn
// face on a spherical cap patch (eyes/brows/nose shading/lips/beard) that
// reads at gameplay distance. Builds: slim / average / broad. Skin tones and
// outfits come from the caller. Same rig API as before — Player, peds,
// vignettes and the club queue all share it. Geometries are module-level
// singletons; materials are colour-cached, so 20+ rigs stay cheap.
import * as THREE from "three";
import { fabricTexture, skinTexture, hairTexture, faceTexture, hairCardTexture } from "./textures";
import { G } from "./game/store";

/** Phase 6 (B4): cloth weave bump reads stronger on Medium/High tiers. */
const clothBump = () => (G.settings.quality === "low" ? 0.6 : 1.1);

export interface HumanoidOptions {
  top: string;            // shirt / jacket colour
  sleeve?: string;        // contrast sleeve colour (varsity)
  bottom: string;         // jeans / pants colour
  skin: string;
  hair: string;
  shoes?: string;
  undershirt?: string;
  topStyle?: "tee" | "tank" | "hoodie" | "varsity" | "crop" | "jacket";
  bottomStyle?: "jeans" | "shorts";
  gender?: "m" | "f";
  hairStyle?: "cap" | "flat" | "bun" | "ponytail" | "crop" | "bald" | "fade" | "quiff" | "mohawk" | "long";
  sunglasses?: boolean;
  cap?: string;           // cap colour, if wearing one
  tattooSleeve?: boolean; // darker patterned right arm
  necklace?: boolean;
  build?: "slim" | "average" | "broad";
  beard?: boolean;
  /** Phase 16: Sable Cuts beards — "stubble" is the painted face
   * variant only; "goatee"/"full" add layered beard cards below. */
  beardStyle?: "stubble" | "goatee" | "full";
}

export interface HumanoidRig {
  group: THREE.Group;
  body: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  lThigh: THREE.Group; rThigh: THREE.Group;
  lShin: THREE.Group; rShin: THREE.Group;
  lFoot: THREE.Group; rFoot: THREE.Group; // Phase 8: ankle pivots (heel-toe roll)
  lArm: THREE.Group; rArm: THREE.Group;
  lFore: THREE.Group; rFore: THREE.Group;
  lids: THREE.Mesh[]; // Phase 8: blink lids (empty for sunglasses rigs)
  blinkSeed: number;
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
  // Phase 8: finger-block shaping — a finger slab + opposed thumb turns
  // the plain mitt into something that reads as a hand at distance
  fingers: new THREE.BoxGeometry(0.055, 0.075, 0.028),
  thumb: new THREE.BoxGeometry(0.02, 0.055, 0.024),
  lid: new THREE.BoxGeometry(0.056, 0.036, 0.012),
  hairCard: new THREE.PlaneGeometry(0.25, 0.15),
  hairCardSide: new THREE.PlaneGeometry(0.11, 0.21),
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
  // Phase 5 Step 6: cloth weave as a bump map so fabric catches raking light
  if (!m) { m = new THREE.MeshStandardMaterial({ color, map: fabricTexture(), bumpMap: fabricTexture(), bumpScale: clothBump(), roughness: 0.88 }); matCache.set(key, m); }
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
  // Phase 5 Step 6: subtle skin sheen (roughness 0.55 + a touch of env
  // response) instead of the flat 0.62 matte — reads as skin, not clay.
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, map: skinTexture(), roughness: 0.55, envMapIntensity: 0.45 }); matCache.set(k, m); }
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
  // Phase 8: faces paint at 1024² on Medium/High, 512² on Low
  const px = G.settings.quality === "low" ? 512 : 1024;
  const key = `${variant}:${px}`;
  let m = faceMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: faceTexture(variant, px), transparent: true, roughness: 0.55, envMapIntensity: 0.45, depthWrite: false });
    faceMats.set(key, m);
  }
  return m;
}
// Phase 8: alpha hair-card material, colour-cached like the hair mats
const hairCardMats = new Map<string, THREE.MeshStandardMaterial>();
function hairCardMat(c: string): THREE.MeshStandardMaterial {
  let m = hairCardMats.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, map: hairCardTexture(), transparent: true, alphaTest: 0.32, roughness: 0.92, side: THREE.DoubleSide });
    hairCardMats.set(c, m);
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
  const topMat = new THREE.MeshStandardMaterial({ color: o.top, map: fabricTexture(), bumpMap: fabricTexture(), bumpScale: clothBump(), roughness: 0.88 });
  topMats.push(topMat);
  const sleeveMat = style === "varsity"
    ? new THREE.MeshStandardMaterial({ color: o.sleeve ?? "#e8e4da", map: fabricTexture(), bumpMap: fabricTexture(), bumpScale: clothBump(), roughness: 0.88 })
    : topMat;
  if (sleeveMat !== topMat) topMats.push(sleeveMat);
  const tattooMat = new THREE.MeshStandardMaterial({ color: "#5a4638", map: fabricTexture(), roughness: 0.7 });
  const longSleeve = style === "hoodie" || style === "varsity" || style === "jacket";
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
    // Phase 8: the shoe now hangs off an ANKLE PIVOT so the stride can
    // roll heel-toe instead of the whole shin+shoe swinging as one plank
    const foot = new THREE.Group(); foot.position.set(0, -0.44, 0);
    foot.add(mesh(GEO.shoe, shoe, 0, -0.01, 0.04));
    const toe = mesh(GEO.toe, shoe, 0, -0.025, 0.155); toe.scale.set(1, 0.55, 1.15);
    foot.add(toe);
    foot.add(mesh(GEO.sole, darkMat("#24211e"), 0, -0.05, 0.05));
    shin.add(foot);
    thigh.add(shin);
    body.add(thigh);
    return { thigh, shin, foot };
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
    if (style === "jacket") {
      // Phase 6 (B4): jacket = zipped front stripe + raised collar over
      // a plain undershirt V
      torso.add(mesh(GEO.underV, fabricMat(o.undershirt ?? "#2e3138"), 0, 0.33, 0.128, false));
      const zip = mesh(GEO.stripe, plainMat("zip", "#c8ccd2", 0.35, 0.6), 0, 0.13, 0);
      zip.scale.set(0.16, 1, 0.72);
      torso.add(zip);
      const collar = mesh(GEO.hood, topMat, 0, 0.5, -0.06);
      collar.scale.set(0.8, 0.45, 0.8);
      torso.add(collar);
    } else if (style !== "hoodie") torso.add(mesh(GEO.underV, fabricMat(o.undershirt ?? "#e8e2d4"), 0, 0.33, 0.128, false));
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
    // Phase 8 hand: palm + finger slab + opposed thumb (finger-block)
    const hand = mesh(GEO.hand, skin, 0, -0.37, 0);
    hand.scale.set(0.82, 1.15, 0.52);
    fore.add(hand);
    fore.add(mesh(GEO.fingers, skin, 0, -0.455, 0.004, false));
    const thumb = mesh(GEO.thumb, skin, side * -0.038, -0.40, 0.018, false);
    thumb.rotation.z = side * 0.5;
    fore.add(thumb);
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
  const lids: THREE.Mesh[] = [];
  if (!o.sunglasses) {
    const face = new THREE.Mesh(GEO.face, faceMat(o.beard || o.beardStyle === "stubble" || o.beardStyle === "full" ? "beard" : female ? "f" : "m"));
    face.position.set(0, 0.155, 0);
    face.scale.set(0.92, 1.08, 0.97);
    head.add(face);
    // Phase 8 blink lids: skin slivers parked above the painted eyes;
    // animateHumanoid dips them for ~0.12 s every 2.5–5 s (per-rig seed)
    for (const sx of [-0.053, 0.053]) {
      const lid = mesh(GEO.lid, skin, sx, 0.196, 0.144, false);
      lid.scale.y = 0.12;
      head.add(lid);
      lids.push(lid);
    }
  }
  const hairStyle = o.hairStyle ?? (female ? "bun" : "cap");
  // Phase 8 hair cards: layered alpha strand planes over the scalp cap —
  // a fringe card at the hairline + side cards for volume (not on bald)
  const addHairCards = (sides: boolean) => {
    const cm = hairCardMat(o.hair);
    const fringe = new THREE.Mesh(GEO.hairCard, cm);
    fringe.position.set(0, 0.265, 0.128); fringe.rotation.x = -0.42;
    head.add(fringe);
    if (sides) for (const sx of [-1, 1]) {
      const card = new THREE.Mesh(GEO.hairCardSide, cm);
      card.position.set(sx * 0.148, 0.16, 0.01); card.rotation.y = sx * 0.45; card.rotation.z = sx * 0.06;
      head.add(card);
    }
  };
  if (!o.cap) {
    if (hairStyle === "flat") {
      const ft = mesh(GEO.flatTop, hair, 0, 0.315, 0); ft.scale.set(1, 1, 1);
      head.add(ft);
      head.add(mesh(GEO.hairCap, hair, 0, 0.165, -0.02));
    } else if (hairStyle === "bun") {
      head.add(mesh(GEO.hairLong, hair, 0, 0.165, -0.018));
      head.add(mesh(GEO.hairBack, hair, 0, 0.03, -0.135));
      head.add(mesh(GEO.bun, hair, 0, 0.33, -0.11));
      addHairCards(true);
    } else if (hairStyle === "ponytail") {
      head.add(mesh(GEO.hairCap, hair, 0, 0.175, -0.012));
      head.add(mesh(GEO.hairBack, hair, 0, 0.05, -0.135));
      const tail = mesh(GEO.ponytail, hair, 0, 0.08, -0.18);
      tail.rotation.x = 0.25;
      head.add(tail);
      addHairCards(true);
    } else if (hairStyle === "crop") {
      // short crop (B4): a thin close cap of hair, no back panel
      const cp = mesh(GEO.hairCap, hair, 0, 0.178, -0.008);
      cp.scale.set(0.99, 0.82, 0.99);
      head.add(cp);
      addHairCards(false);
    } else if (hairStyle === "bald") {
      // bald (B4): bare skull with a slight sheen — nothing to add
    } else if (hairStyle === "fade") {
      // Phase 16 tight fade: a low, close cap — shorter than the crop,
      // fringe card only, no sides (the fade IS the sides being gone)
      const fd = mesh(GEO.hairCap, hair, 0, 0.172, -0.006);
      fd.scale.set(0.985, 0.66, 0.985);
      head.add(fd);
      addHairCards(false);
    } else if (hairStyle === "quiff") {
      // Phase 16 quiff: standard cap + a raised, swept front block
      head.add(mesh(GEO.hairCap, hair, 0, 0.175, -0.012));
      const qf = mesh(GEO.flatTop, hair, 0, 0.335, 0.075);
      qf.scale.set(0.82, 0.55, 0.5); qf.rotation.x = -0.28;
      head.add(qf);
      addHairCards(true);
    } else if (hairStyle === "mohawk") {
      // Phase 16 mohawk: shaved sides (thin low cap) + a centre strip
      const mh = mesh(GEO.hairCap, hair, 0, 0.17, -0.006);
      mh.scale.set(0.985, 0.6, 0.985);
      head.add(mh);
      const strip = mesh(GEO.flatTop, hair, 0, 0.345, -0.01);
      strip.scale.set(0.3, 0.85, 1.05);
      head.add(strip);
    } else if (hairStyle === "long") {
      // Phase 16 shoulder length: long scalp + a deeper back panel
      head.add(mesh(GEO.hairLong, hair, 0, 0.165, -0.018));
      const bk = mesh(GEO.hairBack, hair, 0, -0.045, -0.138);
      bk.scale.set(1.05, 1.5, 1);
      head.add(bk);
      addHairCards(true);
    } else {
      head.add(mesh(GEO.hairCap, hair, 0, 0.175, -0.012));
      addHairCards(true);
    }
  } else {
    const capMat = fabricMat(o.cap);
    head.add(mesh(GEO.capTop, capMat, 0, 0.285, 0));
    head.add(mesh(GEO.capBrim, capMat, 0, 0.255, 0.19));
  }
  // ---- Phase 16: beard cards (goatee / full) — layered boxes in the
  // hair material over the jaw; stubble lives in the face texture ----
  if (o.beardStyle === "goatee" || o.beardStyle === "full") {
    const chin = mesh(GEO.flatTop, hair, 0, 0.028, 0.128);
    chin.scale.set(0.34, 0.42, 0.22);
    head.add(chin);
    const mo = mesh(GEO.flatTop, hair, 0, 0.082, 0.14);
    mo.scale.set(0.38, 0.14, 0.14);
    head.add(mo);
    if (o.beardStyle === "full") {
      const jaw = mesh(GEO.flatTop, hair, 0, 0.045, 0.104);
      jaw.scale.set(0.72, 0.55, 0.5);
      head.add(jaw);
      for (const sx of [-1, 1]) {
        const cheek = mesh(GEO.flatTop, hair, sx * 0.082, 0.075, 0.098);
        cheek.scale.set(0.22, 0.5, 0.4); cheek.rotation.y = sx * 0.35;
        head.add(cheek);
      }
    }
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
    lFoot: lLeg.foot, rFoot: rLeg.foot,
    lArm: lArm.armG, rArm: rArm.armG, lFore: lArm.fore, rFore: rArm.fore,
    lids, blinkSeed: Math.random() * 10,
    topMats,
    setTop: (color: string) => topMat.color.set(color),
  };
}

/** Walk/run/idle animation. phase advances with stride; intensity 0..1.
 * Phase 8 (realism pass 4 — "human, not robot"): heel-toe foot roll on
 * ankle pivots, torso COUNTER-rotation against the stride, shoulder sway
 * in phase with the arms, limbs that never lock perfectly straight (rest
 * bends at elbow/knee), breathing that never fully stops, and blinking.
 * Callers advance `phase` at ≈ speed × 2.9 rad/s so stride length matches
 * ground speed and the feet plant instead of skating. */
export function animateHumanoid(rig: HumanoidRig, phase: number, intensity: number, time: number) {
  const i = THREE.MathUtils.clamp(intensity, 0, 1);
  const s = Math.sin(phase), c = Math.cos(phase);
  rig.lThigh.rotation.x = -s * 0.62 * i;
  rig.rThigh.rotation.x = s * 0.62 * i;
  // knees: swing bend + a permanent slight rest bend (never locked)
  rig.lShin.rotation.x = Math.max(0, -c) * 0.85 * i + 0.06;
  rig.rShin.rotation.x = Math.max(0, c) * 0.85 * i + 0.06;
  // ---- heel-toe roll: the foot dorsiflexes through toe-off, lands
  // heel-first, and counter-rotates against the shin so the sole stays
  // near-flat while the foot is planted (the anti-skating cue) ----
  rig.lFoot.rotation.x = (Math.sin(phase - 0.7) * 0.34 * i) - rig.lShin.rotation.x * 0.38 * i + 0.02;
  rig.rFoot.rotation.x = (Math.sin(phase + Math.PI - 0.7) * 0.34 * i) - rig.rShin.rotation.x * 0.38 * i + 0.02;
  // arms swing counter-phase to the same-side leg, elbows carried bent
  rig.lArm.rotation.x = s * 0.55 * i;
  rig.rArm.rotation.x = -s * 0.55 * i;
  rig.lFore.rotation.x = -(0.24 + Math.max(0, -s) * 0.42) * Math.max(i, 0.3);
  rig.rFore.rotation.x = -(0.24 + Math.max(0, s) * 0.42) * Math.max(i, 0.3);
  // shoulder sway: arms hang from a shoulder line that rolls with stride
  rig.lArm.rotation.z = 0.09 + s * 0.05 * i + Math.sin(time * 1.7) * 0.022 * (1 - i);
  rig.rArm.rotation.z = -0.09 + s * 0.05 * i - Math.cos(time * 1.6) * 0.022 * (1 - i);
  // torso: forward lean grows with speed; COUNTER-rotation (shoulders
  // turn against the pelvis/stride) + gentle lateral sway
  rig.torso.rotation.x = 0.04 * i + 0.075 * i * i;
  rig.torso.rotation.y = -s * 0.085 * i;
  rig.torso.rotation.z = s * 0.028 * i;
  // breathing: ~0.25 Hz chest swell — full at idle, shallower under way
  const breath = Math.sin(time * 1.55);
  rig.torso.scale.y = 1 + breath * (0.014 * (1 - i) + 0.006 * i);
  rig.torso.scale.x = 1 + breath * 0.010 * (1 - i * 0.5);
  rig.torso.scale.z = 1 + breath * 0.012 * (1 - i * 0.5);
  rig.body.position.y = Math.abs(c) * 0.05 * i;
  // idle weight shift + subtle head bob while walking; the head
  // counter-turns half the torso's twist so the gaze stays steady
  rig.body.position.x = Math.sin(time * 0.5) * 0.018 * (1 - i);
  rig.head.position.y = 1.56 + Math.abs(s) * 0.012 * i;
  rig.head.rotation.y = Math.sin(time * 0.45) * 0.06 * (1 - i) + s * 0.045 * i;
  rig.head.rotation.x = 0.05 * i;
  // ---- blink: 0.12 s lid dip every 2.5–5 s (per-rig seed) ----
  if (rig.lids.length) {
    const period = 2.5 + (rig.blinkSeed % 2.5);
    const ph = (time + rig.blinkSeed) % period;
    const dip = ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
    const sy = 0.12 + dip * 0.88;
    for (const lid of rig.lids) lid.scale.y = sy;
  }
}
