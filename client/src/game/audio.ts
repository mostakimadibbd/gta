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
export const sfx = {
  pickup() { blip(880, 0.12, "sine", 0.16); blip(1320, 0.18, "sine", 0.14, 0.07); },
  cash() { blip(1046, 0.1, "triangle", 0.15); blip(1568, 0.16, "triangle", 0.13, 0.06); },
  complete() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, "triangle", 0.15, i * 0.1)); },
  fail() { blip(220, 0.35, "sawtooth", 0.1, 0, -110); },
  crime() { blip(196, 0.18, "square", 0.07); },
  door() { blip(160, 0.09, "square", 0.08, 0, -60); },
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
