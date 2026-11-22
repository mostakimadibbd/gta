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

function finish(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
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
  // panel seams
  g.fillStyle = "rgba(60,58,54,0.35)";
  for (let y = 0; y <= 512; y += 64) g.fillRect(0, y, 512, 2);
  for (let row = 0; row < 8; row++) for (let x = (row % 2) * 128; x <= 512; x += 256) g.fillRect(x, row * 64, 2, 64);
  // weather streaks
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(90,85,78,${0.03 + rnd() * 0.05})`;
    g.fillRect(rnd() * 512, rnd() * 200, 2 + rnd() * 4, 120 + rnd() * 260);
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
  _skin = finish(c, 1, 1);
  return _skin;
}

// ---- faces: drawn features on a transparent canvas, applied to a small
// curved plane on the front of the head — reads far better at gameplay
// distance than geometry eyes, and costs one shared texture per variant.
const faceCache = new Map<string, THREE.CanvasTexture>();
export function faceTexture(variant: "m" | "f" | "beard"): THREE.CanvasTexture {
  const hit = faceCache.get(variant);
  if (hit) return hit;
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  // soft shading: cheek/jaw shadows + nose bridge shading
  const sh = g.createRadialGradient(64, 74, 12, 64, 74, 62);
  sh.addColorStop(0, "rgba(120,70,40,0)"); sh.addColorStop(1, "rgba(120,70,40,0.20)");
  g.fillStyle = sh; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(120,70,40,0.16)";
  g.beginPath(); g.ellipse(64, 58, 5, 12, 0, 0, Math.PI * 2); g.fill(); // nose shading
  // brows
  g.fillStyle = "rgba(30,20,14,0.85)";
  g.fillRect(30, 36, 22, 4); g.fillRect(76, 36, 22, 4);
  // eyes: white + iris + pupil + glint
  for (const cx of [41, 87]) {
    g.fillStyle = "#f4efe8"; g.beginPath(); g.ellipse(cx, 48, 10, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3a2a1c"; g.beginPath(); g.arc(cx, 48, 4.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0d0a08"; g.beginPath(); g.arc(cx, 48, 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(cx - 1.4, 46.4, 1.2, 0, Math.PI * 2); g.fill();
    if (variant === "f") { g.strokeStyle = "rgba(20,12,8,0.9)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 10, 47); g.quadraticCurveTo(cx, 41, cx + 10, 47); g.stroke(); }
  }
  // nostrils + mouth
  g.fillStyle = "rgba(90,50,30,0.5)";
  g.beginPath(); g.arc(59, 74, 1.7, 0, Math.PI * 2); g.arc(69, 74, 1.7, 0, Math.PI * 2); g.fill();
  if (variant === "f") { g.fillStyle = "rgba(168,74,84,0.9)"; g.beginPath(); g.ellipse(64, 88, 11, 4.2, 0, 0, Math.PI * 2); g.fill(); }
  else { g.fillStyle = "rgba(120,66,50,0.75)"; g.beginPath(); g.ellipse(64, 88, 9, 3, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "rgba(90,50,30,0.28)"; g.fillRect(52, 96, 24, 2); // mouth shadow line
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
  faceCache.set(variant, t);
  return t;
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
  for (let i = 0; i < 2600; i++) {
    g.strokeStyle = `rgba(${30 + rnd() * 40},${70 + rnd() * 50},${28 + rnd() * 26},0.5)`;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3); g.stroke();
  }
  stains(g, 512, 512, 5, "#5d7038", 0.10, rnd);
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
