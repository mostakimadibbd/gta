// Harborfall audio — pure WebAudio, no audio files. Starts after first gesture.
let ctx: AudioContext | null = null; let muted = false;
let engineOsc: OscillatorNode | null = null; let engineGain: GainNode | null = null;
let sirenOsc: OscillatorNode | null = null; let sirenGain: GainNode | null = null; let sirenTimer = 0;
export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; if (sirenGain) sirenGain.gain.value = 0; return muted; }
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
export function initAudio() { ac(); }
function blip(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slide = 0) {
  const a = ac(); if (!a || muted) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + when);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + when + dur);
  g.gain.setValueAtTime(vol, a.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.02);
}
function noiseBurst(dur: number, vol: number, cutoff: number) {
  const a = ac(); if (!a || muted) return;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}
export const sfx = {
  pickup() { blip(880, 0.12, "sine", 0.16); blip(1320, 0.18, "sine", 0.14, 0.07); },
  cash() { blip(1046, 0.1, "triangle", 0.15); blip(1568, 0.16, "triangle", 0.13, 0.06); },
  complete() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, "triangle", 0.15, i * 0.1)); },
  fail() { blip(220, 0.35, "sawtooth", 0.1, 0, -110); },
  crime() { blip(196, 0.18, "square", 0.07); },
  door() { blip(160, 0.09, "square", 0.08, 0, -60); },
  crash() { noiseBurst(0.28, 0.32, 900); blip(90, 0.25, "sawtooth", 0.12, 0, -40); },
  thud() { noiseBurst(0.12, 0.18, 500); },
  horn() { blip(370, 0.38, "square", 0.07); blip(466, 0.38, "square", 0.07); },
  jump() { blip(300, 0.18, "sine", 0.1, 0, 260); },
  land() { noiseBurst(0.06, 0.07, 400); },
  click() { blip(740, 0.06, "triangle", 0.1); },
  dialogue() { blip(660, 0.07, "sine", 0.09); blip(880, 0.08, "sine", 0.07, 0.05); },
  star() { blip(523, 0.12, "square", 0.08); blip(784, 0.2, "square", 0.08, 0.09); },
  busted() { [392, 330, 262].forEach((f, i) => blip(f, 0.25, "triangle", 0.12, i * 0.14)); },
  skid() { noiseBurst(0.3, 0.1, 2600); },
};
/** Call every ~200ms from HUD loop: engine hum tied to speed + siren when wanted. */
export function audioTick(driving: boolean, speedKph: number, wanted: number) {
  const a = ac(); if (!a) return;
  if (driving && !muted) {
    if (!engineOsc || !engineGain) {
      const osc = a.createOscillator(); const gain = a.createGain();
      osc.type = "sawtooth"; gain.gain.value = 0;
      const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
      osc.connect(f); f.connect(gain); gain.connect(a.destination); osc.start();
      engineOsc = osc; engineGain = gain;
    }
    engineOsc.frequency.value = 55 + speedKph * 1.6;
    engineGain.gain.value = 0.028 + Math.min(0.05, speedKph / 1800);
  } else if (engineGain) engineGain.gain.value = 0;
  if (wanted > 0 && !muted) {
    if (!sirenOsc || !sirenGain) {
      const osc = a.createOscillator(); const gain = a.createGain();
      osc.type = "triangle"; gain.gain.value = 0.02;
      osc.connect(gain); gain.connect(a.destination); osc.start();
      sirenOsc = osc; sirenGain = gain;
    }
    sirenTimer += 0.2; sirenOsc.frequency.value = 700 + Math.sin(sirenTimer * 4.2) * 220;
    if (sirenGain) sirenGain.gain.value = 0.018;
  } else if (sirenGain) sirenGain.gain.value = 0;
}
