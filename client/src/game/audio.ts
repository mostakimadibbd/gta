// Harborfall audio — pure WebAudio, no audio files. Starts after first gesture.
let ctx: AudioContext | null = null; let muted = false;
let engineOsc: OscillatorNode | null = null; let engineGain: GainNode | null = null;
let sirenOsc: OscillatorNode | null = null; let sirenGain: GainNode | null = null; let sirenTimer = 0;
export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; if (sirenGain) sirenGain.gain.value = 0; if (themeMaster) themeMaster.gain.value = muted ? 0 : 0.5; if (clubMaster) clubMaster.gain.value = muted ? 0 : 0.4; return muted; }
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
  // Phase 13: the Sable Line's two-tone station chime (doors opening /
  // closing) — a soft railway ding-ding, sine so it never grates.
  chime() { blip(1318, 0.16, "sine", 0.12); blip(988, 0.22, "sine", 0.11, 0.14); },
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
  thunder(delaySec = 0) {
    const fire = () => { noiseBurst(0.9, 0.22, 200); blip(52, 0.9, "sine", 0.18, 0.04, -18); noiseBurst(0.4, 0.1, 500); };
    if (delaySec > 0) window.setTimeout(fire, delaySec * 1000); else fire();
  },
  playStart() {
    // poster → game transition: airy whoosh + deep impact hit
    const a = ac(); if (!a || muted) return;
    const len = Math.floor(a.sampleRate * 0.55);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.1;
    f.frequency.setValueAtTime(320, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(2600, a.currentTime + 0.4);
    f.frequency.exponentialRampToValueAtTime(300, a.currentTime + 0.55);
    const g = a.createGain(); g.gain.value = 0.24;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
    blip(64, 0.7, "sine", 0.4, 0.1, -26); // impact body
    noiseBurst(0.18, 0.16, 300);
  },
  fuel() { blip(520, 0.09, "sine", 0.1); blip(660, 0.09, "sine", 0.1, 0.11); blip(880, 0.14, "triangle", 0.12, 0.22); },
  // ---- Phase 3 combat / water ----
  punch() { noiseBurst(0.09, 0.13, 1400); blip(180, 0.07, "sine", 0.08, 0, -70); }, // fist swish + body
  shot() { noiseBurst(0.16, 0.4, 3400); blip(150, 0.14, "sawtooth", 0.2, 0, -95); noiseBurst(0.3, 0.1, 700, ); }, // pistol crack + tail
  smg() { noiseBurst(0.09, 0.3, 3800); blip(170, 0.08, "sawtooth", 0.15, 0, -100); }, // SMG: shorter, snappier crack
  blast() { noiseBurst(0.34, 0.55, 2400); blip(95, 0.3, "sawtooth", 0.3, 0, -60); noiseBurst(0.5, 0.16, 500); }, // shotgun boom + long tail
  pop() { noiseBurst(0.2, 0.5, 1800); blip(220, 0.16, "sine", 0.25, 0, -160); noiseBurst(0.4, 0.12, 300); }, // tyre blowout on spikes
  eat() { blip(300, 0.07, "sine", 0.08); blip(240, 0.08, "sine", 0.08, 0.11); blip(340, 0.07, "sine", 0.07, 0.23); }, // vendor food: three soft bites
  dryFire() { blip(1200, 0.04, "square", 0.07); blip(900, 0.05, "square", 0.06, 0.05); },
  splash() { noiseBurst(0.45, 0.2, 900); blip(320, 0.3, "sine", 0.07, 0.05, -140); noiseBurst(0.3, 0.1, 1600); },
  glass() { noiseBurst(0.22, 0.3, 5200); noiseBurst(0.34, 0.16, 3600); blip(2400, 0.1, "triangle", 0.06, 0.02, -900); blip(3100, 0.08, "triangle", 0.05, 0.09, -1200); }, // window smash: highpass noise + falling shards
  alarm() { blip(1180, 0.14, "square", 0.06); blip(880, 0.14, "square", 0.06, 0.16); }, // car alarm chirp pair
  shout() { blip(300, 0.16, "sawtooth", 0.1, 0, 160); blip(420, 0.2, "sawtooth", 0.09, 0.14, -120); }, // startled ped shout
  register() { blip(1318, 0.09, "square", 0.07); blip(1760, 0.14, "square", 0.06, 0.08); noiseBurst(0.1, 0.06, 2400); }, // till drawer ding
  // ---- Phase 8: bat + fishing ----
  batSwing() { noiseBurst(0.16, 0.1, 700); blip(240, 0.14, "sine", 0.05, 0, 190); }, // wooden whoosh: low swept noise
  batHit() { noiseBurst(0.14, 0.3, 420); blip(82, 0.2, "sine", 0.22, 0, -30); }, // deep wooden THOCK — heavier than the fist thud
  castLine() { noiseBurst(0.2, 0.06, 2400); blip(900, 0.12, "sine", 0.05, 0, -350); }, // line whirring out
  bite() { blip(1180, 0.07, "sine", 0.1); blip(1180, 0.07, "sine", 0.1, 0.13); }, // bobber dip — double plip
  reel() { blip(500 + Math.random() * 120, 0.05, "square", 0.045); }, // ratchet click (called repeatedly while reeling)
  catchFish() { [659, 784, 988].forEach((f, i) => blip(f, 0.14, "triangle", 0.1, i * 0.07)); }, // little landed-it jingle
  snap() { noiseBurst(0.08, 0.2, 3000); blip(1400, 0.1, "square", 0.08, 0, -700); }, // line snapping
};
export function isMenuThemePlaying() { return themeTimer !== null; }
// ---------------------------------------------------------------------------
// Opening theme — "Port Sable Sunset": an ORIGINAL composition written for
// Harborfall, rebuilt as a full GTA-style LOADING GROOVE: funk/coastal
// rhythm section at 102 BPM (four-on-the-floor kick, snare 2&4, swung hats,
// shaker 16ths, conga/tumba), a syncopated octave-jumping bassline, rhodes
// chord stabs, a muted wah-pluck riff, warm pads and the original sax-style
// lead hook + answering phrase. 8-bar loop in 4 sections:
//   bars 1-2 INTRO (pads + groove) · 3-4 MAIN (lead hook)
//   bars 5-6 BREAKDOWN (bass/percussion/stabs/wah) · 7-8 REPRISE (answer)
// Plus menu ambience under the music: soft waves + sparse distant gulls.
// Not based on any other game's music. Pure WebAudio, no audio files.
// ---------------------------------------------------------------------------
let themeMaster: GainNode | null = null;
let themeTimer: number | null = null;
let themeStep = 0;
let themeNextTime = 0;
let ambNodes: { stop: () => void } | null = null;
const THEME_BPM = 102;
const STEP_DUR = 60 / THEME_BPM / 4; // 16th notes
const LOOP_STEPS = 128; // 8 bars × 16
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
// Bars cycle: Fmaj7 | Dm9 | Bbmaj7 | Cmaj7 — roots + chord tones (MIDI)
const BARS = [
  { root: 29, chord: [53, 57, 60, 64] }, // F
  { root: 26, chord: [50, 53, 57, 60] }, // Dm
  { root: 34, chord: [58, 62, 65, 69] }, // Bb
  { root: 36, chord: [60, 64, 67, 71] }, // C
];
// Original lead hook (the old theme's melody, ×2 from 8ths onto 16ths) —
// played in the MAIN section (bars 3-4 = steps 32..63 of the loop)
const MELODY: Record<number, number> = {
  0: 77, 4: 76, 8: 74, 12: 72, 16: 74, 22: 76, 28: 79, 30: 76,
};
// Answering phrase (REPRISE, bars 7-8 = steps 96..127) — original variation
const ANSWER: Record<number, number> = {
  0: 81, 4: 79, 8: 77, 12: 79, 16: 76, 22: 74, 28: 76, 30: 72,
};
// Syncopated bassline per bar (16th step → semitone offset from root+24)
const BASSLINE: Record<number, number> = { 0: 0, 3: 0, 6: 12, 8: 0, 10: 0, 11: 7, 14: 12 };
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
function noiseAt(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number) {
  const a = ctx; if (!a || !themeMaster) return;
  const len = Math.max(1, Math.floor(a.sampleRate * dur)); const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(themeMaster); src.start(t);
}
function drumAt(t: number, kind: "kick" | "hat" | "openhat" | "snare" | "shaker" | "congaHi" | "congaLo") {
  const a = ctx; if (!a || !themeMaster) return;
  if (kind === "kick") {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(themeMaster); o.start(t); o.stop(t + 0.2); return;
  }
  if (kind === "congaHi" || kind === "congaLo") {
    // synthesised membrane hit: pitch-dropping sine + a skin slap of noise
    const o = a.createOscillator(); const g = a.createGain();
    const f0 = kind === "congaHi" ? 210 : 150;
    o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.09);
    g.gain.setValueAtTime(kind === "congaHi" ? 0.16 : 0.19, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(themeMaster); o.start(t); o.stop(t + 0.16);
    noiseAt(t, 0.03, "bandpass", 2400, 0.05); return;
  }
  if (kind === "snare") { noiseAt(t, 0.11, "bandpass", 1800, 0.2); return; }
  if (kind === "hat") { noiseAt(t, 0.045, "highpass", 7200, 0.1); return; }
  if (kind === "openhat") { noiseAt(t, 0.16, "highpass", 6800, 0.08); return; }
  noiseAt(t, 0.05, "highpass", 5200, 0.045); // shaker
}
function wahAt(t: number, freq: number) {
  // muted guitar-ish pluck: short saw through a sweeping bandpass ("wah")
  const a = ctx; if (!a || !themeMaster) return;
  const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq;
  const f = a.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 5;
  f.frequency.setValueAtTime(650, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.05);
  f.frequency.exponentialRampToValueAtTime(620, t + 0.17);
  const g = a.createGain();
  g.gain.setValueAtTime(0.085, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(f); f.connect(g); g.connect(themeMaster); o.start(t); o.stop(t + 0.2);
}
function stabAt(t: number, notes: number[]) {
  // rhodes-style stab: triangle + slightly detuned twin, short and off-beat
  for (const n of notes) {
    toneAt(t, midi(n), 0.22, "triangle", 0.05, 1900);
    toneAt(t, midi(n) * 1.004, 0.18, "sine", 0.028, 1900);
  }
}
function scheduleStep(step: number, t: number) {
  const bar = Math.floor(step / 16); // 0..7
  const s = step % 16;
  const B = BARS[bar % 4];
  const section = bar < 2 ? 0 : bar < 4 ? 1 : bar < 6 ? 2 : 3; // intro/main/breakdown/reprise
  const swing = s % 2 === 1 ? 0.012 : 0; // gentle 16th swing on odd steps
  const tt = t + swing;
  // pads: full-bar warm wash (softer in the breakdown)
  if (s === 0) for (const n of B.chord) toneAt(t, midi(n), STEP_DUR * 16 * 0.95, "triangle", section === 2 ? 0.032 : 0.05, 1150);
  // bassline — the groove's identity (all sections, drops out nowhere)
  const bass = BASSLINE[s];
  if (bass !== undefined) toneAt(tt, midi(B.root + 24 + bass), STEP_DUR * 1.7, "sine", 0.21, 520);
  // drums
  if (s % 4 === 0 && !(section === 0 && bar === 0)) drumAt(tt, "kick"); // four on the floor
  if (s === 4 || s === 12) drumAt(tt, "snare");
  if (s % 2 === 0) drumAt(tt, "hat");
  if (s === 14 && section !== 0) drumAt(tt, "openhat");
  drumAt(tt, "shaker"); // 16ths throughout
  if (s === 3 || s === 10) drumAt(tt, "congaHi");
  if (s === 6 || s === 12) drumAt(tt, "congaLo");
  // rhodes stabs on off-beats (main/breakdown/reprise)
  if ((s === 7 || s === 10) && section !== 0) stabAt(tt, [B.chord[1], B.chord[2], B.chord[3]]);
  // wah pluck riff — chord-tone rhythm figure, busiest in the breakdown
  const wahSteps = section === 2 ? [2, 5, 9, 13] : section === 0 ? [] : [5, 13];
  if (wahSteps.includes(s)) wahAt(tt, midi(B.chord[[2, 1, 3, 2][wahSteps.indexOf(s)]] + 12));
  // lead hook + answer (sax-style, vibrato)
  if (section === 1) { const lead = MELODY[step - 32]; if (lead) toneAt(t, midi(lead), STEP_DUR * 3.4, "sawtooth", 0.05, 1600, 4); }
  if (section === 3) { const lead = ANSWER[step - 96]; if (lead) toneAt(t, midi(lead), STEP_DUR * 3.4, "sawtooth", 0.05, 1600, 4); }
}
function startAmbience() {
  // menu ambience under the music: looping soft waves (LFO-swelled filtered
  // noise) + sparse gull chirps scheduled from the theme tick.
  const a = ctx; if (!a || !themeMaster || ambNodes) return;
  const master = themeMaster;
  const len = a.sampleRate * 3;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; d[i] = v * 8; } // brownish wash
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 480;
  const g = a.createGain(); g.gain.value = 0.035;
  const lfo = a.createOscillator(); lfo.frequency.value = 0.09;
  const lfoG = a.createGain(); lfoG.gain.value = 0.02;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); lfo.start();
  ambNodes = { stop: () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } } };
}
let gullNext = 0;
function maybeGull() {
  const a = ctx; if (!a || !themeMaster) return;
  if (a.currentTime < gullNext) return;
  gullNext = a.currentTime + 6 + Math.random() * 11;
  // distant gull: two descending chirps through the theme bus
  const t0 = a.currentTime + 0.05;
  for (const off of [0, 0.28]) {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1480, t0 + off);
    o.frequency.exponentialRampToValueAtTime(880, t0 + off + 0.16);
    g.gain.setValueAtTime(0.0001, t0 + off);
    g.gain.exponentialRampToValueAtTime(0.016, t0 + off + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.2);
    o.connect(g); g.connect(themeMaster); o.start(t0 + off); o.stop(t0 + off + 0.24);
  }
}
export function startMenuTheme() {
  const a = ac(); if (!a || themeTimer !== null) return;
  themeMaster = a.createGain(); themeMaster.gain.value = muted ? 0 : 0.5; themeMaster.connect(a.destination);
  themeStep = 0; themeNextTime = a.currentTime + 0.06;
  startAmbience();
  themeTimer = window.setInterval(() => {
    if (!ctx || !themeMaster) return;
    while (themeNextTime < ctx.currentTime + 0.18) { scheduleStep(themeStep, themeNextTime); themeStep = (themeStep + 1) % LOOP_STEPS; themeNextTime += STEP_DUR; }
    maybeGull();
  }, 90);
}
export function stopMenuTheme() {
  if (themeTimer !== null) { window.clearInterval(themeTimer); themeTimer = null; }
  if (ambNodes) { ambNodes.stop(); ambNodes = null; }
  if (ctx && themeMaster) { const g = themeMaster; g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); window.setTimeout(() => g.disconnect(), 500); }
  themeMaster = null;
}

// ---------------------------------------------------------------------------
// Phase 23: CLUB SOLACE BASS — a small ORIGINAL two-bar bass loop that
// runs only while the player is inside the club (Interiors.tsx starts
// and stops it on the room transition). Same scheduler idiom as the
// menu theme, a fraction of the size: a 116 BPM eighth-note grid, a
// syncopated A-minor bass figure, a soft four-on-the-floor kick and a
// whisper of hat. Not based on any other work; pure WebAudio.
// ---------------------------------------------------------------------------
let clubMaster: GainNode | null = null;
let clubTimer: number | null = null;
let clubStep = 0;
let clubNextTime = 0;
const CLUB_BPM = 116;
const CLUB_STEP_DUR = 60 / CLUB_BPM / 2; // eighth notes
const CLUB_BASS: Record<number, number> = { 0: 33, 3: 33, 6: 36, 7: 34, 8: 33, 11: 31, 12: 38, 14: 36 }; // MIDI, A1 figure
function clubNoteAt(t: number, freq: number, dur: number, vol: number) {
  const a = ctx; if (!a || !clubMaster) return;
  const o = a.createOscillator(); const g = a.createGain(); const f = a.createBiquadFilter();
  o.type = "sine"; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = 300;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(clubMaster);
  o.start(t); o.stop(t + dur + 0.05);
}
function clubKickAt(t: number) {
  const a = ctx; if (!a || !clubMaster) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
  g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g); g.connect(clubMaster); o.start(t); o.stop(t + 0.18);
}
function scheduleClubStep(step: number, t: number) {
  const s = step % 16;
  const bass = CLUB_BASS[s];
  if (bass !== undefined) clubNoteAt(t, midi(bass + 12), CLUB_STEP_DUR * 1.6, 0.5);
  if (s % 4 === 0) clubKickAt(t);
}
export function startClubBass() {
  const a = ac(); if (!a || clubTimer !== null) return;
  clubMaster = a.createGain(); clubMaster.gain.value = muted ? 0 : 0.4; clubMaster.connect(a.destination);
  clubStep = 0; clubNextTime = a.currentTime + 0.06;
  clubTimer = window.setInterval(() => {
    if (!ctx || !clubMaster) return;
    while (clubNextTime < ctx.currentTime + 0.15) { scheduleClubStep(clubStep, clubNextTime); clubStep += 1; clubNextTime += CLUB_STEP_DUR; }
  }, 80);
}
export function stopClubBass() {
  if (clubTimer !== null) { window.clearInterval(clubTimer); clubTimer = null; }
  if (ctx && clubMaster) { const g = clubMaster; g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); window.setTimeout(() => g.disconnect(), 350); }
  clubMaster = null;
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
