// Harborfall — procedural canvas textures. Generated ONCE at startup,
// cached as singletons, reused by every material (no external assets).
import * as THREE from "three";

// Deterministic PRNG so the city looks the same every load.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number, h = size): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size; c.height = h;
  return [c, c.getContext("2d")!];
}

// Phase 8 smoothness audit: texture anisotropy follows the quality
// tier — 8 on High, 4 otherwise (set by game/quality at boot + on tier
// change; applies to textures created after the change)
let ANISO = 4;
export function setTextureAnisotropy(n: number) { ANISO = n; }

function finish(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = ANISO;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Per-pixel grain noise over the whole canvas. */
function grain(g: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], amp: number, rnd: () => number, sparkle = 0) {
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 2 * amp;
    let r = base[0] + n, gg = base[1] + n, b = base[2] + n;
    if (sparkle && rnd() < sparkle) { r += 42; gg += 42; b += 40; } // exposed aggregate glints
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

function stains(g: CanvasRenderingContext2D, w: number, h: number, count: number, color: string, alpha: number, rnd: () => number) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * (0.5 + rnd() * 0.8);
    const x = rnd() * w, y = rnd() * h, r = 14 + rnd() * 60;
    g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------- asphalt
let _asphalt: THREE.CanvasTexture | undefined;
export function asphaltTexture(): THREE.CanvasTexture {
  if (_asphalt) return _asphalt;
  const rnd = mulberry32(101);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [46, 46, 48], 13, rnd, 0.012);
  // darker repaired patches
  stains(g, 512, 512, 7, "#1d1d1f", 0.16, rnd);
  stains(g, 512, 512, 4, "#5a5a58", 0.05, rnd);
  // tyre-polish bands (run along V = road length on the top face)
  const band = g.createLinearGradient(0, 0, 512, 0);
  band.addColorStop(0.16, "rgba(0,0,0,0)");
  band.addColorStop(0.25, "rgba(12,12,14,0.20)");
  band.addColorStop(0.34, "rgba(0,0,0,0)");
  band.addColorStop(0.66, "rgba(0,0,0,0)");
  band.addColorStop(0.75, "rgba(12,12,14,0.20)");
  band.addColorStop(0.84, "rgba(0,0,0,0)");
  g.fillStyle = band; g.fillRect(0, 0, 512, 512);
  // faint cracks — random dark polylines
  g.strokeStyle = "rgba(16,16,18,0.55)"; g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 70; y += rnd() * 42; g.lineTo(x, y); }
    g.stroke();
  }
  // scattered debris specks + wind-blown leaf dots (lived-in streets)
  for (let i = 0; i < 420; i++) {
    g.fillStyle = `rgba(${140 + rnd() * 60},${135 + rnd() * 50},${110 + rnd() * 40},${0.12 + rnd() * 0.2})`;
    g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 46; i++) {
    g.fillStyle = `rgba(${140 + rnd() * 60},${100 + rnd() * 40},${30 + rnd() * 30},${0.25 + rnd() * 0.3})`;
    g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 2 + rnd() * 2.5, 1.2 + rnd() * 1.4, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "rgba(16,16,18,0.4)"; g.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let s2 = 0; s2 < 4; s2++) { x += (rnd() - 0.5) * 46; y += (rnd() - 0.5) * 46; g.lineTo(x, y); }
    g.stroke();
  }
  _asphalt = finish(c);
  return _asphalt;
}

let _asphaltH: THREE.CanvasTexture | undefined;
/** Asphalt rotated 90° for roads running along X (clone shares the image). */
export function asphaltTextureH(): THREE.CanvasTexture {
  if (_asphaltH) return _asphaltH;
  const t = asphaltTexture().clone();
  t.center.set(0.5, 0.5); t.rotation = Math.PI / 2;
  t.needsUpdate = true;
  _asphaltH = t;
  return t;
}

// ---------------------------------------------------------------- concrete
let _concrete: THREE.CanvasTexture | undefined;
export function concreteTexture(): THREE.CanvasTexture {
  if (_concrete) return _concrete;
  const rnd = mulberry32(202);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [168, 163, 154], 10, rnd, 0.004);
  stains(g, 512, 512, 6, "#7c766a", 0.07, rnd);
  stains(g, 512, 512, 3, "#5d5648", 0.05, rnd);
  // expansion-joint grid: slabs every 128px
  for (let i = 0; i <= 512; i += 128) {
    g.fillStyle = "rgba(88,83,74,0.9)"; g.fillRect(i - 1, 0, 3, 512); g.fillRect(0, i - 1, 512, 3);
    g.fillStyle = "rgba(230,226,218,0.35)"; g.fillRect(i + 2, 0, 1, 512); g.fillRect(0, i + 2, 512, 1);
  }
  _concrete = finish(c);
  return _concrete;
}

let _concreteH: THREE.CanvasTexture | undefined;
export function concreteTextureH(): THREE.CanvasTexture {
  if (_concreteH) return _concreteH;
  const t = concreteTexture().clone();
  t.center.set(0.5, 0.5); t.rotation = Math.PI / 2;
  t.needsUpdate = true;
  _concreteH = t;
  return t;
}

// ---------------------------------------------------------------- facades
/** Light panel facade — tinted per building via material colour multiply. */
let _facade: THREE.CanvasTexture | undefined;
export function facadeTexture(): THREE.CanvasTexture {
  if (_facade) return _facade;
  const rnd = mulberry32(303);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [216, 213, 207], 7, rnd);
  // vertical light gradient: sun-caught top, shaded base — panels read as
  // surfaces with depth instead of flat colour (Phase 3 facade pass)
  const vgrad = g.createLinearGradient(0, 0, 0, 512);
  vgrad.addColorStop(0, "rgba(255,252,244,0.20)"); vgrad.addColorStop(0.5, "rgba(255,255,255,0)");
  vgrad.addColorStop(1, "rgba(30,28,24,0.22)");
  g.fillStyle = vgrad; g.fillRect(0, 0, 512, 512);
  // per-panel tonal variance (each cladding panel catches light differently)
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    const v = (rnd() - 0.5) * 0.13;
    g.fillStyle = v > 0 ? `rgba(255,255,250,${v})` : `rgba(20,18,16,${-v})`;
    g.fillRect(col * 128, row * 64, 128, 64);
  }
  // panel seams — dark groove + 1px highlight under it (embossed depth)
  g.fillStyle = "rgba(60,58,54,0.35)";
  for (let y = 0; y <= 512; y += 64) { g.fillRect(0, y, 512, 2); g.fillStyle = "rgba(255,255,255,0.20)"; g.fillRect(0, y + 2, 512, 1); g.fillStyle = "rgba(60,58,54,0.35)"; }
  for (let row = 0; row < 8; row++) for (let x = (row % 2) * 128; x <= 512; x += 256) g.fillRect(x, row * 64, 2, 64);
  // weather streaks — rain-washed grime running down from seams/rooflines
  for (let i = 0; i < 44; i++) {
    g.fillStyle = `rgba(90,85,78,${0.04 + rnd() * 0.07})`;
    g.fillRect(rnd() * 512, rnd() * 200, 2 + rnd() * 5, 120 + rnd() * 300);
  }
  // water stains: soft vertical blotches with a darker drip tail
  for (let i = 0; i < 12; i++) {
    const x = rnd() * 512, y = rnd() * 300, w = 14 + rnd() * 30, h = 60 + rnd() * 160;
    const sg = g.createLinearGradient(0, y, 0, y + h);
    sg.addColorStop(0, `rgba(70,64,54,${0.10 + rnd() * 0.08})`); sg.addColorStop(1, "rgba(70,64,54,0)");
    g.fillStyle = sg; g.fillRect(x, y, w, h);
  }
  // grime collected under each panel seam row (dirt sits on ledges)
  for (let y = 64; y < 512; y += 64) {
    const ug = g.createLinearGradient(0, y, 0, y + 14);
    ug.addColorStop(0, "rgba(52,48,40,0.16)"); ug.addColorStop(1, "rgba(52,48,40,0)");
    g.fillStyle = ug; g.fillRect(0, y, 512, 14);
  }
  // grime at the base
  const grad = g.createLinearGradient(0, 512, 0, 380);
  grad.addColorStop(0, "rgba(42,38,32,0.42)"); grad.addColorStop(1, "rgba(42,38,32,0)");
  g.fillStyle = grad; g.fillRect(0, 380, 512, 132);
  _facade = finish(c);
  return _facade;
}

/** Light brickwork — tinted per building via material colour multiply. */
let _brick: THREE.CanvasTexture | undefined;
export function brickTexture(): THREE.CanvasTexture {
  if (_brick) return _brick;
  const rnd = mulberry32(404);
  const [c, g] = canvas(512);
  g.fillStyle = "#b7a08e"; g.fillRect(0, 0, 512, 512); // mortar
  const bh = 21, bw = 62;
  for (let row = 0; row * bh < 512; row++) {
    const off = (row % 2) * (bw / 2);
    for (let x = -1; x * bw < 512 + bw; x++) {
      const shade = 216 + Math.floor((rnd() - 0.5) * 22);
      g.fillStyle = `rgb(${shade},${Math.floor(shade * 0.94)},${Math.floor(shade * 0.88)})`;
      g.fillRect(x * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      // per-brick gradient: lit top edge, shadowed bottom edge (Phase 3)
      g.fillStyle = "rgba(255,246,235,0.16)"; g.fillRect(x * bw + off + 2, row * bh + 2, bw - 4, 2);
      g.fillStyle = "rgba(40,26,18,0.20)"; g.fillRect(x * bw + off + 2, row * bh + bh - 5, bw - 4, 3);
    }
  }
  stains(g, 512, 512, 4, "#6b5a48", 0.06, rnd);
  const grad = g.createLinearGradient(0, 512, 0, 400);
  grad.addColorStop(0, "rgba(42,38,32,0.35)"); grad.addColorStop(1, "rgba(42,38,32,0)");
  g.fillStyle = grad; g.fillRect(0, 400, 512, 112);
  _brick = finish(c);
  return _brick;
}

// ---------------------------------------------------------------- fabric
let _fabric: THREE.CanvasTexture | undefined;
/** Greyscale weave — clothing materials tint it with their colour. */
export function fabricTexture(): THREE.CanvasTexture {
  if (_fabric) return _fabric;
  const rnd = mulberry32(505);
  const [c, g] = canvas(128);
  grain(g, 128, 128, [238, 238, 238], 9, rnd);
  g.fillStyle = "rgba(70,70,70,0.10)";
  for (let i = 0; i < 128; i += 3) { g.fillRect(0, i, 128, 1); g.fillRect(i, 0, 1, 128); }
  g.fillStyle = "rgba(255,255,255,0.10)";
  for (let i = 1; i < 128; i += 3) { g.fillRect(0, i, 128, 1); }
  // Phase 8 (realism pass 4): painted cloth FOLDS — soft vertical drape
  // shadows + a hem crease; the same canvas is the bump map, so folds get
  // real raking-light relief on torsos instead of flat weave everywhere.
  for (let i = 0; i < 5; i++) {
    const x = 14 + rnd() * 100;
    const grad = g.createLinearGradient(x - 7, 0, x + 7, 0);
    grad.addColorStop(0, "rgba(60,55,50,0)"); grad.addColorStop(0.5, "rgba(60,55,50,0.13)"); grad.addColorStop(1, "rgba(60,55,50,0)");
    g.fillStyle = grad; g.fillRect(x - 7, 6, 14, 116);
    g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(x + 6, 6, 2, 116);
  }
  g.fillStyle = "rgba(60,55,50,0.12)"; g.fillRect(0, 108, 128, 3);
  _fabric = finish(c, 2, 2);
  return _fabric;
}

// ---------------------------------------------------------------- containers
let _container: THREE.CanvasTexture | undefined;
/** Ribbed shipping-container steel — tinted per container via colour. */
export function containerTexture(): THREE.CanvasTexture {
  if (_container) return _container;
  const rnd = mulberry32(606);
  const [c, g] = canvas(512, 256);
  grain(g, 512, 256, [225, 225, 225], 8, rnd);
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = "rgba(60,60,60,0.28)"; g.fillRect(x, 0, 5, 256);
    g.fillStyle = "rgba(255,255,255,0.20)"; g.fillRect(x + 6, 0, 4, 256);
  }
  g.fillStyle = "rgba(50,45,40,0.20)"; g.fillRect(0, 236, 512, 20);
  _container = finish(c);
  return _container;
}

// ---------------------------------------------------------------- neon signs
const neonCache = new Map<string, THREE.CanvasTexture>();
/** Vertical neon blade sign: dark board, glowing stacked letters. */
export function neonSignTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}|${color}`;
  const hit = neonCache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(128, 512);
  g.fillStyle = "#101216"; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(8, 8, 112, 496);
  g.font = "bold 62px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 20; g.fillStyle = color;
  const letters = text.replace(/ /g, "").split("");
  const step = Math.min(64, 470 / letters.length);
  letters.forEach((ch, i) => g.fillText(ch, 64, 48 + i * step));
  const t = finish(c);
  neonCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------- signs
const signCache = new Map<string, THREE.CanvasTexture>();
/** Green street-name blade sign, Port Sable style (teal board, white text). */
export function streetSignTexture(text: string): THREE.CanvasTexture {
  const hit = signCache.get(text);
  if (hit) return hit;
  const [c, g] = canvas(512, 96);
  g.fillStyle = "#0d3f3c"; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = "#e8f2ee"; g.lineWidth = 5; g.strokeRect(7, 7, 498, 82);
  g.fillStyle = "#f4faf7"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 256, 52);
  const t = finish(c);
  signCache.set(text, t);
  return t;
}

// ================================================================ VISUAL OVERHAUL
// ---- skin: very subtle noise so faces/bodies don't read as flat plastic ----
let _skin: THREE.CanvasTexture | undefined;
export function skinTexture(): THREE.CanvasTexture {
  if (_skin) return _skin;
  const rnd = mulberry32(707);
  const [c, g] = canvas(128);
  grain(g, 128, 128, [242, 240, 238], 5, rnd);
  // Phase 8 (realism pass 4): warm subsurface-look tint — soft blotches
  // that read as blood-warmth variation (cheeks/ears) once the material
  // colour multiplies through, plus faint pore speckle for roughness life.
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 128, y = rnd() * 128, r = 14 + rnd() * 26;
    const warm = g.createRadialGradient(x, y, 2, x, y, r);
    warm.addColorStop(0, "rgba(255,166,130,0.10)"); warm.addColorStop(1, "rgba(255,166,130,0)");
    g.fillStyle = warm; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.fillStyle = "rgba(120,80,60,0.05)";
  for (let i = 0; i < 260; i++) g.fillRect(rnd() * 128, rnd() * 128, 1, 1);
  _skin = finish(c, 1, 1);
  return _skin;
}

// ---- faces: drawn features on a transparent canvas, applied to a small
// curved plane on the front of the head — reads far better at gameplay
// distance than geometry eyes, and costs one shared texture per variant.
const faceCache = new Map<string, THREE.CanvasTexture>();
export function faceTexture(variant: "m" | "f" | "beard", px = 512): THREE.CanvasTexture {
  const key = `${variant}:${px}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  // Phase 6 (B4): painted faces with proper facial shading — eye sockets,
  // cheek hollows, jaw shadow. Phase 8 (realism pass 4): Medium/High tiers
  // paint at 1024² (drawn in 128-space via scale, so the extra resolution
  // is pure crispness) and gain a brow ridge, nose side-shadows, two-tone
  // lips, iris detail with a limbal ring + catchlight, an upper-lid line
  // on every variant, and light stubble on the plain male face.
  const [c, g] = canvas(px, px);
  g.scale(px / 128, px / 128);
  g.clearRect(0, 0, 128, 128);
  // soft shading: cheek/jaw shadows + nose bridge shading
  const sh = g.createRadialGradient(64, 74, 12, 64, 74, 62);
  sh.addColorStop(0, "rgba(120,70,40,0)"); sh.addColorStop(1, "rgba(120,70,40,0.20)");
  g.fillStyle = sh; g.fillRect(0, 0, 128, 128);
  // eye sockets: soft shadow bowls the eyes sit in
  g.fillStyle = "rgba(110,60,35,0.20)";
  for (const cx of [41, 87]) { g.beginPath(); g.ellipse(cx, 47, 13, 8, 0, 0, Math.PI * 2); g.fill(); }
  // cheek hollows + jaw shadow + forehead sheen
  g.fillStyle = "rgba(110,60,35,0.13)";
  g.beginPath(); g.ellipse(30, 66, 9, 13, 0.25, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(98, 66, 9, 13, -0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(110,60,35,0.15)";
  g.beginPath(); g.ellipse(64, 106, 26, 9, 0, 0, Math.PI * 2); g.fill(); // jaw/chin shadow
  const sheen = g.createLinearGradient(0, 6, 0, 34);
  sheen.addColorStop(0, "rgba(255,235,210,0.13)"); sheen.addColorStop(1, "rgba(255,235,210,0)");
  g.fillStyle = sheen; g.fillRect(14, 4, 100, 32);
  // smile lines
  g.strokeStyle = "rgba(110,60,35,0.22)"; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(47, 80); g.quadraticCurveTo(50, 87, 54, 90); g.stroke();
  g.beginPath(); g.moveTo(81, 80); g.quadraticCurveTo(78, 87, 74, 90); g.stroke();
  g.fillStyle = "rgba(120,70,40,0.16)";
  g.beginPath(); g.ellipse(64, 58, 5, 12, 0, 0, Math.PI * 2); g.fill(); // nose shading
  // brow ridge: a soft shadow shelf above each brow + a highlight on the
  // ridge itself — the single strongest "painted skull" cue at distance
  for (const cx of [41, 87]) {
    g.fillStyle = "rgba(110,60,35,0.16)";
    g.beginPath(); g.ellipse(cx, 33, 13, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,235,210,0.10)";
    g.beginPath(); g.ellipse(cx, 30.5, 12, 3, 0, 0, Math.PI * 2); g.fill();
  }
  // brows
  g.fillStyle = "rgba(30,20,14,0.85)";
  g.fillRect(30, 36, 22, 4); g.fillRect(76, 36, 22, 4);
  // eyes: white + two-tone iris + limbal ring + pupil + catchlight, and
  // an upper-lid line on EVERY variant (pass 4)
  for (const cx of [41, 87]) {
    g.fillStyle = "#f4efe8"; g.beginPath(); g.ellipse(cx, 48, 10, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5a4030"; g.beginPath(); g.arc(cx, 48, 4.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2c1c10"; g.beginPath(); g.arc(cx, 48, 3.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0d0a08"; g.beginPath(); g.arc(cx, 48, 2.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(12,8,5,0.85)"; g.lineWidth = 0.9;
    g.beginPath(); g.arc(cx, 48, 4.6, 0, Math.PI * 2); g.stroke(); // limbal ring
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx - 1.4, 46.4, 1.25, 0, Math.PI * 2); g.fill(); // catchlight
    g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.arc(cx + 1.6, 49.8, 0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(20,12,8,0.9)"; g.lineWidth = variant === "f" ? 1.7 : 1.15;
    g.beginPath(); g.moveTo(cx - 10, 47); g.quadraticCurveTo(cx, 41, cx + 10, 47); g.stroke(); // upper lid line
  }
  // nose side-shadows: two soft strokes down the bridge + an under-nose shadow
  g.strokeStyle = "rgba(110,60,35,0.20)"; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(58.5, 56); g.quadraticCurveTo(57.5, 66, 58.5, 71); g.stroke();
  g.beginPath(); g.moveTo(69.5, 56); g.quadraticCurveTo(70.5, 66, 69.5, 71); g.stroke();
  g.fillStyle = "rgba(110,60,35,0.18)";
  g.beginPath(); g.ellipse(64, 73.5, 6.5, 2.2, 0, 0, Math.PI * 2); g.fill();
  // nostrils + mouth (two-tone lips: darker upper, lighter lower + sheen)
  g.fillStyle = "rgba(90,50,30,0.5)";
  g.beginPath(); g.arc(59, 74, 1.7, 0, Math.PI * 2); g.arc(69, 74, 1.7, 0, Math.PI * 2); g.fill();
  if (variant === "f") {
    g.fillStyle = "rgba(146,56,66,0.92)"; g.beginPath(); g.ellipse(64, 86.6, 10.5, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(186,92,100,0.92)"; g.beginPath(); g.ellipse(64, 90, 10, 2.9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,220,215,0.35)"; g.beginPath(); g.ellipse(64, 90.6, 5.5, 1.1, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = "rgba(104,54,42,0.8)"; g.beginPath(); g.ellipse(64, 86.8, 8.6, 2.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(138,80,62,0.8)"; g.beginPath(); g.ellipse(64, 89.6, 8.2, 2.3, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "rgba(90,50,30,0.28)"; g.fillRect(52, 96, 24, 2); // mouth shadow line
  if (variant === "m") {
    // light stubble: sparse short strokes over jaw + upper lip (pass 4)
    const rndS = mulberry32(1111);
    g.strokeStyle = "rgba(30,22,16,0.4)"; g.lineWidth = 0.9;
    for (let i = 0; i < 130; i++) {
      const a = (rndS() - 0.5) * 1.9, r = 30 + rndS() * 15;
      const x = 64 + Math.sin(a) * r, y = 82 + Math.cos(a) * r * 0.6 + rndS() * 5;
      if (y < 86 || (Math.abs(x - 64) < 11 && y < 94)) continue;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rndS() - 0.5) * 1.4, y + 2.2); g.stroke();
    }
  }
  if (variant === "beard") {
    // jaw beard: dense short strokes around the lower face
    const rnd = mulberry32(909);
    g.strokeStyle = "rgba(28,20,14,0.88)"; g.lineWidth = 1.6;
    for (let i = 0; i < 210; i++) {
      const a = (rnd() - 0.5) * 1.9, r = 34 + rnd() * 16;
      const x = 64 + Math.sin(a) * r, y = 80 + Math.cos(a) * r * 0.62 + rnd() * 6;
      if (y < 84 || Math.abs(x - 64) < 12 && y < 92) continue;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y + 3.5); g.stroke();
    }
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  faceCache.set(key, t);
  return t;
}

// ---- hair CARDS (Phase 8, realism pass 4): strand strokes on a
// transparent canvas — layered alpha planes over the scalp cap so hair
// gets fringe/side volume instead of reading as one solid block. The
// material colour tints it; alphaTest keeps the edges cheap. ----
let _hairCard: THREE.CanvasTexture | undefined;
export function hairCardTexture(): THREE.CanvasTexture {
  if (_hairCard) return _hairCard;
  const rnd = mulberry32(1212);
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) {
    const x = 6 + rnd() * 116;
    const len = 60 + rnd() * 62;
    const sway = (rnd() - 0.5) * 14;
    g.strokeStyle = `rgba(235,230,224,${0.5 + rnd() * 0.5})`;
    g.lineWidth = 1.4 + rnd() * 1.6;
    g.beginPath(); g.moveTo(x, -4);
    g.quadraticCurveTo(x + sway * 0.4, len * 0.55, x + sway, len);
    g.stroke();
  }
  // darker root band at the top so the card seats into the cap
  const grad = g.createLinearGradient(0, 0, 0, 26);
  grad.addColorStop(0, "rgba(210,205,198,0.95)"); grad.addColorStop(1, "rgba(210,205,198,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 26);
  _hairCard = finish(c);
  _hairCard.wrapS = _hairCard.wrapT = THREE.ClampToEdgeWrapping;
  return _hairCard;
}

// ---- hair: strand streaks, tinted by material colour ----
let _hair: THREE.CanvasTexture | undefined;
export function hairTexture(): THREE.CanvasTexture {
  if (_hair) return _hair;
  const rnd = mulberry32(808);
  const [c, g] = canvas(128);
  grain(g, 128, 128, [225, 222, 218], 10, rnd);
  for (let i = 0; i < 300; i++) {
    g.strokeStyle = `rgba(40,32,26,${0.10 + rnd() * 0.16})`;
    g.lineWidth = 1;
    const x = rnd() * 128;
    g.beginPath(); g.moveTo(x, rnd() * 30); g.lineTo(x + (rnd() - 0.5) * 5, 60 + rnd() * 68); g.stroke();
  }
  _hair = finish(c, 1, 1);
  return _hair;
}

// ---- grass / sand ground textures (deeper, noisy — kills flat colour) ----
let _grass: THREE.CanvasTexture | undefined;
export function grassTexture(): THREE.CanvasTexture {
  if (_grass) return _grass;
  const rnd = mulberry32(111);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [74, 104, 58], 15, rnd);
  // mow stripes: subtle alternating bands (Phase 3 ground detail)
  for (let i = 0; i < 8; i += 2) { g.fillStyle = "rgba(255,255,230,0.055)"; g.fillRect(0, i * 64, 512, 64); }
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = `rgba(${30 + rnd() * 40},${70 + rnd() * 50},${28 + rnd() * 26},0.5)`;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3); g.stroke();
  }
  stains(g, 512, 512, 5, "#5d7038", 0.10, rnd);
  // worn dirt patches — bare earth showing through (Phase 3)
  stains(g, 512, 512, 6, "#6e5a3a", 0.16, rnd);
  stains(g, 512, 512, 4, "#7d6a42", 0.12, rnd);
  stains(g, 512, 512, 5, "#42582e", 0.14, rnd);
  _grass = finish(c, 26, 26);
  return _grass;
}
let _sand: THREE.CanvasTexture | undefined;
export function sandTexture(): THREE.CanvasTexture {
  if (_sand) return _sand;
  const rnd = mulberry32(222);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [216, 188, 132], 11, rnd, 0.01);
  for (let i = 0; i < 130; i++) {
    g.strokeStyle = `rgba(160,128,84,${0.08 + rnd() * 0.1})`;
    const y = rnd() * 512;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 8, 340, y - 8, 512, y + 4); g.stroke();
  }
  _sand = finish(c, 20, 2);
  return _sand;
}

// ---- palm frond: feathered leaflets with alpha, one side of a bent plane ----
let _frond: THREE.CanvasTexture | undefined;
export function palmFrondTexture(): THREE.CanvasTexture {
  if (_frond) return _frond;
  const rnd = mulberry32(333);
  const [c, g] = canvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  g.strokeStyle = "#2c6e3e"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(2, 64); g.quadraticCurveTo(128, 52, 254, 84); g.stroke(); // midrib
  for (let x = 12; x < 250; x += 7) {
    const t = x / 256, len = 44 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 8;
    const yBase = 64 - 12 * t + 20 * t * t;
    g.strokeStyle = `rgba(${38 + rnd() * 22},${110 + rnd() * 34},${58 + rnd() * 20},0.95)`;
    g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x, yBase); g.lineTo(x + 9, yBase - len); g.stroke();
    g.beginPath(); g.moveTo(x, yBase); g.lineTo(x + 9, yBase + len * 0.92); g.stroke();
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _frond = t;
  return _frond;
}

// ---- soft radial glow (sprites: lamps, police lights, sun, car lights) ----
let _glow: THREE.CanvasTexture | undefined;
export function glowTexture(): THREE.CanvasTexture {
  if (_glow) return _glow;
  const [c, g] = canvas(128);
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.35, "rgba(255,255,255,0.32)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _glow = t;
  return _glow;
}

// ---- tyre tread: wraps the wheel cylinder's side surface ----
let _tyre: THREE.CanvasTexture | undefined;
export function tyreTexture(): THREE.CanvasTexture {
  if (_tyre) return _tyre;
  const rnd = mulberry32(444);
  const [c, g] = canvas(256, 64);
  grain(g, 256, 64, [26, 26, 28], 6, rnd);
  g.fillStyle = "rgba(0,0,0,0.55)";
  for (let x = 0; x < 256; x += 16) { g.save(); g.translate(x + 8, 32); g.rotate(0.5); g.fillRect(-2.5, -30, 5, 60); g.restore(); }
  g.fillStyle = "rgba(120,120,124,0.20)"; g.fillRect(0, 4, 256, 2); g.fillRect(0, 58, 256, 2); // sidewall rings
  _tyre = finish(c, 3, 1);
  return _tyre;
}

// ---- road arrow decal: worn white turn/straight arrow (Phase 3) ----
let _arrow: THREE.CanvasTexture | undefined;
export function arrowTexture(): THREE.CanvasTexture {
  if (_arrow) return _arrow;
  const rnd = mulberry32(1212);
  const [c, g] = canvas(128, 256);
  g.clearRect(0, 0, 128, 256);
  g.fillStyle = "rgba(240,238,230,0.92)";
  // shaft + head (pointing UP = toward canvas top)
  g.fillRect(54, 92, 20, 150);
  g.beginPath(); g.moveTo(64, 8); g.lineTo(116, 96); g.lineTo(80, 96); g.lineTo(80, 130); g.lineTo(48, 130); g.lineTo(48, 96); g.lineTo(12, 96); g.closePath(); g.fill();
  // wear: knock out speckles so it reads as old paint
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 260; i++) { g.globalAlpha = 0.25 + rnd() * 0.5; g.fillRect(rnd() * 128, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _arrow = t;
  return _arrow;
}

// ---- oil stain decal: soft dark blot with a rainbow-sheen rim (Phase 3) ----
let _oil: THREE.CanvasTexture | undefined;
export function oilTexture(): THREE.CanvasTexture {
  if (_oil) return _oil;
  const rnd = mulberry32(1313);
  const [c, g] = canvas(128);
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 7; i++) {
    const x = 34 + rnd() * 60, y = 34 + rnd() * 60, r = 14 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, "rgba(12,12,16,0.55)"); gr.addColorStop(0.75, "rgba(14,14,18,0.30)"); gr.addColorStop(1, "rgba(14,14,18,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _oil = t;
  return _oil;
}

// ================================================================
// Phase 4 / Visual Upgrade V2 — procedural NORMAL + ROUGHNESS maps.
// A height canvas is drawn per surface, then converted with a Sobel
// filter into a tangent-space normal map. Data maps must NOT be sRGB.
// ================================================================
// ---- Phase 5 quality gate: Low tier skips normal maps entirely. World/App
// call setNormalsEnabled when the tier changes; caches reset so materials
// rebuilt afterwards pick the change up.
let _normalsOn = true;
let _flatN: THREE.CanvasTexture | undefined;
function flatNormalTex(): THREE.CanvasTexture {
  if (_flatN) return _flatN;
  const [c, g] = canvas(4);
  g.fillStyle = "rgb(128,128,255)"; g.fillRect(0, 0, 4, 4);
  _flatN = finishData(c);
  return _flatN;
}
export function setNormalsEnabled(on: boolean) {
  if (on === _normalsOn) return;
  _normalsOn = on;
  _asphaltN = _concreteN = _facadeN = _brickN = _sandN = _grassN = undefined;
  _plasterN = _tileN = _corrugatedN = undefined;
}

function finishData(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t; // linear data — no colour space conversion
}

/** Sobel height→normal conversion. strength ~1.5–3 for architectural relief. */
function normalFromHeight(height: HTMLCanvasElement, strength = 2): THREE.CanvasTexture {
  if (!_normalsOn) return flatNormalTex();
  const w = height.width, h = height.height;
  const src = height.getContext("2d")!.getImageData(0, 0, w, h).data;
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const d = img.data;
  const hv = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hv(x + 1, y - 1) + 2 * hv(x + 1, y) + hv(x + 1, y + 1)) - (hv(x - 1, y - 1) + 2 * hv(x - 1, y) + hv(x - 1, y + 1));
    const dy = (hv(x, y + 1) + 2 * hv(x + 1, y + 1) + hv(x - 1, y + 1)) - (hv(x, y - 1) + 2 * hv(x + 1, y - 1) + hv(x - 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz) || 1;
    const i = (y * w + x) * 4;
    d[i] = ((nx / len) * 0.5 + 0.5) * 255;
    d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
    d[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return finishData(c);
}

function heightCanvas(size: number, base: number, draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed: number): HTMLCanvasElement {
  const rnd = mulberry32(seed);
  const [c, g] = canvas(size);
  g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, size, size);
  // per-pixel grain
  const img = g.getImageData(0, 0, size, size); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  draw(g, rnd);
  return c;
}

let _asphaltN: THREE.CanvasTexture | undefined;
export function asphaltNormal(): THREE.CanvasTexture {
  if (_asphaltN) return _asphaltN;
  _asphaltN = normalFromHeight(heightCanvas(512, 128, (g, rnd) => {
    g.strokeStyle = "rgba(30,30,30,0.9)"; g.lineWidth = 2; // cracks sink
    for (let i = 0; i < 9; i++) { let x = rnd() * 512, y = rnd() * 512; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 70; y += rnd() * 42; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = "rgba(70,70,70,0.5)"; // patched areas sit lower
    for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 30 + rnd() * 60, 20 + rnd() * 40, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  }, 1101), 1.6);
  return _asphaltN;
}

let _concreteN: THREE.CanvasTexture | undefined;
export function concreteNormal(): THREE.CanvasTexture {
  if (_concreteN) return _concreteN;
  _concreteN = normalFromHeight(heightCanvas(512, 140, (g) => {
    g.fillStyle = "rgba(28,28,28,1)"; // expansion joints are deep grooves
    for (let i = 0; i <= 512; i += 128) { g.fillRect(i - 2, 0, 4, 512); g.fillRect(0, i - 2, 512, 4); }
    g.fillStyle = "rgba(210,210,210,0.6)"; // chipped slab edges catch light
    for (let i = 0; i <= 512; i += 128) { g.fillRect(i + 2, 0, 2, 512); g.fillRect(0, i + 2, 512, 2); }
  }, 1202), 2.2);
  return _concreteN;
}

let _facadeN: THREE.CanvasTexture | undefined;
export function facadeNormal(): THREE.CanvasTexture {
  if (_facadeN) return _facadeN;
  _facadeN = normalFromHeight(heightCanvas(512, 150, (g, rnd) => {
    for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) { // per-panel relief variance
      const v = 138 + Math.floor((rnd() - 0.5) * 22);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(col * 128, row * 64, 128, 64);
    }
    g.fillStyle = "rgba(26,26,26,1)"; // panel seams
    for (let y = 0; y <= 512; y += 64) g.fillRect(0, y - 1, 512, 3);
    for (let row = 0; row < 8; row++) for (let x = (row % 2) * 128; x <= 512; x += 256) g.fillRect(x, row * 64, 3, 64);
  }, 1303), 2.4);
  return _facadeN;
}

let _brickN: THREE.CanvasTexture | undefined;
export function brickNormal(): THREE.CanvasTexture {
  if (_brickN) return _brickN;
  _brickN = normalFromHeight(heightCanvas(512, 70, (g, rnd) => {
    const bh = 21, bw = 62;
    for (let row = 0; row * bh < 512; row++) {
      const off = (row % 2) * (bw / 2);
      for (let x = -1; x * bw < 512 + bw; x++) {
        const v = 168 + Math.floor((rnd() - 0.5) * 26);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
  }, 1404), 2.6);
  return _brickN;
}

let _sandN: THREE.CanvasTexture | undefined;
export function sandNormal(): THREE.CanvasTexture {
  if (_sandN) return _sandN;
  _sandN = normalFromHeight(heightCanvas(256, 128, (g, rnd) => {
    for (let y = 0; y < 256; y++) { // wind ripples
      const v = 128 + Math.sin(y * 0.55) * 26 + (rnd() - 0.5) * 10;
      g.fillStyle = `rgba(${v},${v},${v},0.55)`; g.fillRect(0, y, 256, 1);
    }
  }, 1505), 1.4);
  _sandN.repeat.set(24, 8);
  return _sandN;
}

let _grassN: THREE.CanvasTexture | undefined;
export function grassNormal(): THREE.CanvasTexture {
  if (_grassN) return _grassN;
  _grassN = normalFromHeight(heightCanvas(256, 120, (g, rnd) => {
    g.strokeStyle = "rgba(215,215,215,0.8)"; g.lineWidth = 1; // blade tips
    for (let i = 0; i < 900; i++) { const x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3); g.stroke(); }
  }, 1606), 1.8);
  _grassN.repeat.set(60, 60);
  return _grassN;
}

let _asphaltR: THREE.CanvasTexture | undefined;
/** Roughness variation: polished tyre bands are smoother (darker = shinier). */
export function asphaltRoughness(): THREE.CanvasTexture {
  if (_asphaltR) return _asphaltR;
  const rnd = mulberry32(1707);
  const [c, g] = canvas(512);
  g.fillStyle = "rgb(228,228,228)"; g.fillRect(0, 0, 512, 512); // mostly rough
  const band = g.createLinearGradient(0, 0, 512, 0);
  band.addColorStop(0.16, "rgba(0,0,0,0)"); band.addColorStop(0.25, "rgba(120,120,120,0.85)");
  band.addColorStop(0.34, "rgba(0,0,0,0)"); band.addColorStop(0.66, "rgba(0,0,0,0)");
  band.addColorStop(0.75, "rgba(120,120,120,0.85)"); band.addColorStop(0.84, "rgba(0,0,0,0)");
  g.fillStyle = band; g.fillRect(0, 0, 512, 512); // wheel-polished lanes
  g.fillStyle = "rgba(150,150,150,0.5)"; // damp patches read smoother
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 26 + rnd() * 54, 16 + rnd() * 34, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  _asphaltR = finishData(c);
  return _asphaltR;
}

let _concreteR: THREE.CanvasTexture | undefined;
export function concreteRoughness(): THREE.CanvasTexture {
  if (_concreteR) return _concreteR;
  const rnd = mulberry32(1808);
  const [c, g] = canvas(512);
  g.fillStyle = "rgb(238,238,238)"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(196,196,196,0.55)";
  for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 20 + rnd() * 60, 14 + rnd() * 40, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  _concreteR = finishData(c);
  return _concreteR;
}

// ---- shattered safety glass: dark pane + bright radial crack web --------
let _shattered: THREE.CanvasTexture | undefined;
export function shatteredTexture(): THREE.CanvasTexture {
  if (_shattered) return _shattered;
  const rnd = mulberry32(1909);
  const [c, g] = canvas(256);
  g.fillStyle = "#232e33"; g.fillRect(0, 0, 256, 256);
  const cx = 90 + rnd() * 70, cy = 90 + rnd() * 70;
  g.strokeStyle = "rgba(215,230,235,0.9)";
  for (let i = 0; i < 26; i++) { // radial cracks from the impact point
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    g.lineWidth = 1 + rnd();
    g.beginPath(); g.moveTo(cx, cy);
    let x = cx, y = cy;
    for (let s = 0; s < 4; s++) { x += Math.cos(a + (rnd() - 0.5) * 0.5) * (22 + rnd() * 26); y += Math.sin(a + (rnd() - 0.5) * 0.5) * (22 + rnd() * 26); g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = "rgba(190,210,218,0.55)"; // concentric fracture rings
  for (let r = 16; r < 130; r += 13 + rnd() * 10) { g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, r, rnd() * 2, Math.PI * (1.1 + rnd() * 0.8)); g.stroke(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(200,220,228,${0.1 + rnd() * 0.25})`; g.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6); }
  _shattered = finish(c);
  return _shattered;
}

// ---- car dirt/scratch overlay (alpha canvas; opacity keyed to damage) --
let _carDirt: THREE.CanvasTexture | undefined;
export function carDirtTexture(): THREE.CanvasTexture {
  if (_carDirt) return _carDirt;
  const rnd = mulberry32(2010);
  const [c, g] = canvas(256);
  g.clearRect(0, 0, 256, 256);
  const dust = g.createLinearGradient(0, 90, 0, 256); // road dust settles low
  dust.addColorStop(0, "rgba(112,96,74,0)"); dust.addColorStop(1, "rgba(112,96,74,0.85)");
  g.fillStyle = dust; g.fillRect(0, 90, 256, 166);
  for (let i = 0; i < 260; i++) { // mud/dust splatter
    g.fillStyle = `rgba(${96 + rnd() * 40},${82 + rnd() * 30},${58 + rnd() * 22},${0.12 + rnd() * 0.3})`;
    g.beginPath(); g.ellipse(rnd() * 256, 150 + rnd() * 106, 1 + rnd() * 4, 1 + rnd() * 2.4, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "rgba(226,226,220,0.75)"; // key/panel scratches
  for (let i = 0; i < 16; i++) {
    g.lineWidth = 0.7 + rnd() * 0.7;
    const y = 60 + rnd() * 150, x = rnd() * 200;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 + rnd() * 44, y + (rnd() - 0.5) * 7); g.stroke();
  }
  _carDirt = finish(c);
  return _carDirt;
}

// ================================================================
// Phase 5 procedural additions (Step 4a): district material identity.
// Coral Shores = light shell plaster + tiled sidewalks; the port /
// industrial district = stained concrete + corrugated metal.
// ================================================================
let _plaster: THREE.CanvasTexture | undefined;
export function plasterTexture(): THREE.CanvasTexture {
  if (_plaster) return _plaster;
  const rnd = mulberry32(7701);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [216, 203, 178], 9, rnd); // warm shell-sand base
  stains(g, 512, 512, 8, "#b8a888", 0.16, rnd); // salt-air weathering patches
  stains(g, 512, 512, 5, "#e8dfc9", 0.2, rnd); // sun-bleached blooms
  g.strokeStyle = "rgba(120,104,80,0.35)"; g.lineWidth = 1; // hairline plaster cracks
  for (let i = 0; i < 6; i++) { let x = rnd() * 512, y = rnd() * 300; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (rnd() - 0.5) * 26; y += 18 + rnd() * 22; g.lineTo(x, y); } g.stroke(); }
  _plaster = finish(c);
  return _plaster;
}

let _plasterN: THREE.CanvasTexture | undefined;
export function plasterNormal(): THREE.CanvasTexture {
  if (_plasterN) return _plasterN;
  _plasterN = normalFromHeight(heightCanvas(512, 142, (g, rnd) => {
    g.fillStyle = "rgba(96,96,96,0.55)"; // trowel sweeps sit slightly low
    for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 40 + rnd() * 90, 14 + rnd() * 26, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  }, 7702), 1.1);
  return _plasterN;
}

let _tile: THREE.CanvasTexture | undefined;
export function sidewalkTileTexture(): THREE.CanvasTexture {
  if (_tile) return _tile;
  const rnd = mulberry32(8801);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [188, 182, 168], 8, rnd); // pale Coral paving stone
  const cell = 128;
  for (let y = 0; y < 512; y += cell) for (let x = 0; x < 512; x += cell) {
    const v = (rnd() - 0.5) * 14; // per-tile tone drift
    g.fillStyle = `rgba(${v > 0 ? "255,250,238" : "70,64,54"},${Math.abs(v) / 160})`;
    g.fillRect(x, y, cell, cell);
    g.fillStyle = "rgba(238,230,214,0.5)"; g.fillRect(x + 3, y + 3, cell - 6, 3); // bevel light
  }
  g.fillStyle = "#5d574c"; // grout lines
  for (let i = 0; i <= 512; i += cell) { g.fillRect(i - 2, 0, 4, 512); g.fillRect(0, i - 2, 512, 4); }
  stains(g, 512, 512, 5, "#8d8474", 0.14, rnd);
  _tile = finish(c);
  return _tile;
}

let _tileN: THREE.CanvasTexture | undefined;
export function sidewalkTileNormal(): THREE.CanvasTexture {
  if (_tileN) return _tileN;
  _tileN = normalFromHeight(heightCanvas(512, 150, (g) => {
    g.fillStyle = "rgba(20,20,20,1)"; // grout grooves
    for (let i = 0; i <= 512; i += 128) { g.fillRect(i - 2, 0, 4, 512); g.fillRect(0, i - 2, 512, 4); }
    g.fillStyle = "rgba(215,215,215,0.7)";
    for (let i = 0; i <= 512; i += 128) { g.fillRect(i + 2, 0, 2, 512); g.fillRect(0, i + 2, 512, 2); }
  }, 8802), 2.0);
  return _tileN;
}

let _corrugated: THREE.CanvasTexture | undefined;
export function corrugatedTexture(): THREE.CanvasTexture {
  if (_corrugated) return _corrugated;
  const rnd = mulberry32(9901);
  const [c, g] = canvas(512);
  grain(g, 512, 512, [104, 116, 118], 10, rnd); // galvanised steel base
  for (let x = 0; x < 512; x += 32) { // ridge light/shade pairs
    const gr = g.createLinearGradient(x, 0, x + 32, 0);
    gr.addColorStop(0, "rgba(0,0,0,0.42)"); gr.addColorStop(0.45, "rgba(255,255,255,0.20)"); gr.addColorStop(0.62, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(0,0,0,0.42)");
    g.fillStyle = gr; g.fillRect(x, 0, 32, 512);
  }
  for (let i = 0; i < 26; i++) { // rust weep streaks from the ridge tops
    const x = rnd() * 512, len = 40 + rnd() * 170;
    const gr = g.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, `rgba(146,84,44,${0.24 + rnd() * 0.2})`); gr.addColorStop(1, "rgba(146,84,44,0)");
    g.save(); g.translate(x, rnd() * 200); g.fillStyle = gr; g.fillRect(-2.5, 0, 5, len); g.restore();
  }
  stains(g, 512, 512, 7, "#4c4238", 0.18, rnd); // dock grime
  _corrugated = finish(c);
  return _corrugated;
}

let _corrugatedN: THREE.CanvasTexture | undefined;
export function corrugatedNormal(): THREE.CanvasTexture {
  if (_corrugatedN) return _corrugatedN;
  _corrugatedN = normalFromHeight(heightCanvas(512, 128, (g) => {
    for (let x = 0; x < 512; x++) { // smooth sinusoidal ridges, 32px pitch
      const v = 128 + Math.round(Math.sin((x / 32) * Math.PI * 2) * 105);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 512);
    }
  }, 9902), 2.4);
  return _corrugatedN;
}

// ================================================================
// Phase 5 (Step 3a): ONE neutral equirectangular environment canvas —
// dusk coastal sky (zenith teal → azure → amber horizon → dark sea).
// PMREM-converted in App for scene.environment on Medium/High; themes
// keep their identity by tinting the visible dome + envMapIntensity.
// ================================================================
let _skyEnv: THREE.CanvasTexture | undefined;
export function skyEnvTexture(): THREE.CanvasTexture {
  if (_skyEnv) return _skyEnv;
  const W = 2048, H = 1024;
  const [c, g] = canvas(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, "#17384a"); // zenith, deep teal
  grad.addColorStop(0.30, "#2e6d8c");
  grad.addColorStop(0.46, "#7fb2c4");
  grad.addColorStop(0.52, "#f2c184"); // amber horizon band
  grad.addColorStop(0.545, "#e8956d");
  grad.addColorStop(0.56, "#274b57"); // sea takes over below the horizon
  grad.addColorStop(0.72, "#12262e");
  grad.addColorStop(1.0, "#08151a");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const rnd = mulberry32(4242);
  for (let i = 0; i < 240; i++) { // soft cloud streaks, denser near the horizon
    const y = H * 0.16 + Math.pow(rnd(), 1.6) * H * 0.36;
    const x = rnd() * W, wdt = 90 + rnd() * 340, hgt = 5 + rnd() * 13;
    g.fillStyle = `rgba(255,244,230,${0.028 + rnd() * 0.05})`;
    g.beginPath(); g.ellipse(x, y, wdt, hgt, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse((x + W / 2) % W, y, wdt * 0.7, hgt, 0, 0, Math.PI * 2); g.fill();
  }
  const sunX = W * 0.70, sunY = H * 0.525; // low sun glow just above the horizon
  const sg = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, 300);
  sg.addColorStop(0, "rgba(255,226,170,0.95)"); sg.addColorStop(0.12, "rgba(255,196,120,0.55)"); sg.addColorStop(1, "rgba(255,180,110,0)");
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,240,205,0.95)";
  g.beginPath(); g.arc(sunX, sunY, 17, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  _skyEnv = t;
  return t;
}

// ---- cloud puffs: overlapping soft blobs, warm-white (tinted at runtime) ----
let _cloud: THREE.CanvasTexture | undefined;
export function cloudTexture(): THREE.CanvasTexture {
  if (_cloud) return _cloud;
  const rnd = mulberry32(555);
  const [c, g] = canvas(256, 128);
  for (let i = 0; i < 16; i++) {
    const x = 40 + rnd() * 176, y = 52 + rnd() * 30, r = 22 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, "rgba(255,252,248,0.55)"); gr.addColorStop(1, "rgba(255,252,248,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _cloud = t;
  return _cloud;
}
