// Harborfall audio — pure WebAudio, no audio files. Starts after first gesture.
let ctx: AudioContext | null = null; let muted = false;
let engineOsc: OscillatorNode | null = null; let engineGain: GainNode | null = null;
let sirenOsc: OscillatorNode | null = null; let sirenGain: GainNode | null = null; let sirenTimer = 0;
export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; if (sirenGain) sirenGain.gain.value = 0; if (themeMaster) themeMaster.gain.value = muted ? 0 : 0.5; return muted; }
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
// ---------------------------------------------------------------------------
// Opening theme — "Port Sable Sunset": an ORIGINAL composition written for
// Harborfall (sunset-coast synth-jazz: warm pads, sub bass, soft drums and a
// sax-style lead). It is not based on any other game's music. Pure WebAudio
// sequencer, no audio files. Plays on the start screen after first gesture.
// ---------------------------------------------------------------------------
let themeMaster: GainNode | null = null;
let themeTimer: number | null = null;
let themeStep = 0;
let themeNextTime = 0;
const THEME_BPM = 96;
const STEP_DUR = 60 / THEME_BPM / 2; // 8th notes
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// Bars: Fmaj7 | Dm9 | Bbmaj7 | Cmaj7 — roots + chord tones (MIDI)
const BARS = [
  { root: 29, chord: [53, 57, 60, 64] }, // F
  { root: 26, chord: [50, 53, 57, 60] }, // Dm
  { root: 34, chord: [58, 62, 65, 69] }, // Bb
  { root: 36, chord: [60, 64, 67, 71] }, // C
];
// Original lead melody, per 8th-step within the 8-bar loop (absent = rest)
const MELODY: Record<number, number> = {
  0: 77, 2: 76, 4: 74, 6: 72, 8: 74, 11: 76, 14: 79,
  16: 74, 18: 72, 20: 69, 22: 72, 24: 74, 27: 76,
  32: 81, 34: 79, 36: 77, 38: 76, 40: 77, 43: 74, 46: 76,
  48: 72, 52: 74, 54: 76, 56: 79, 60: 77,
};
function toneAt(t: number, freq: number, dur: number, type: OscillatorType, vol: number, cutoff = 2400, vibrato = 0) {
  const a = ctx; if (!a || !themeMaster) return;
  const o = a.createOscillator(); const g = a.createGain(); const f = a.createBiquadFilter();
  o.type = type; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = cutoff;
  let vib: OscillatorNode | null = null;
  if (vibrato > 0) { vib = a.createOscillator(); const vg = a.createGain(); vib.frequency.value = 5.2; vg.gain.value = vibrato; vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + dur); }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(themeMaster);
  o.start(t); o.stop(t + dur + 0.05);
}
function drumAt(t: number, kind: "kick" | "hat" | "snare") {
  const a = ctx; if (!a || !themeMaster) return;
  if (kind === "kick") {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(themeMaster); o.start(t); o.stop(t + 0.2); return;
  }
  const len = Math.floor(a.sampleRate * 0.08); const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = kind === "hat" ? "highpass" : "bandpass"; f.frequency.value = kind === "hat" ? 7000 : 1800;
  const g = a.createGain(); g.gain.value = kind === "hat" ? 0.12 : 0.22;
  src.connect(f); f.connect(g); g.connect(themeMaster); src.start(t);
}
function scheduleStep(step: number, t: number) {
  const barIdx = Math.floor(step / 8) % 4;
  const inBar = step % 8;
  const B = BARS[barIdx];
  if (inBar === 0) for (const n of B.chord) toneAt(t, midi(n), STEP_DUR * 8 * 0.95, "triangle", 0.05, 1200); // pad
  if (inBar === 0 || inBar === 3 || inBar === 6) toneAt(t, midi(B.root + 12), STEP_DUR * 1.8, "sine", 0.22, 500); // bass
  if (inBar % 2 === 0) drumAt(t, "kick");
  if (inBar % 2 === 1) drumAt(t, "hat");
  if (inBar === 4) drumAt(t, "snare");
  const lead = MELODY[step % 64];
  if (lead) toneAt(t, midi(lead), STEP_DUR * 1.9, "sawtooth", 0.055, 1600, 4); // sax-style lead
}
export function startMenuTheme() {
  const a = ac(); if (!a || themeTimer !== null) return;
  themeMaster = a.createGain(); themeMaster.gain.value = muted ? 0 : 0.5; themeMaster.connect(a.destination);
  themeStep = 0; themeNextTime = a.currentTime + 0.06;
  themeTimer = window.setInterval(() => {
    if (!ctx || !themeMaster) return;
    while (themeNextTime < ctx.currentTime + 0.18) { scheduleStep(themeStep, themeNextTime); themeStep = (themeStep + 1) % 64; themeNextTime += STEP_DUR; }
  }, 90);
}
export function stopMenuTheme() {
  if (themeTimer !== null) { window.clearInterval(themeTimer); themeTimer = null; }
  if (ctx && themeMaster) { const g = themeMaster; g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); window.setTimeout(() => g.disconnect(), 500); }
  themeMaster = null;
}

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
