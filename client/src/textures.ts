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
