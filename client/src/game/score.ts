// Harborfall — Phase 46: the AMBIENT SCORE. An original procedural
// free-roam score, synthesised live with WebAudio — no audio files,
// no samples, nothing borrowed. It is NOT an "adaptive AI" system:
// it is three layered loops on a fixed 16th-note grid whose layer
// gains are keyed to game state, in the same lookahead-scheduler
// idiom as the theme (game/audio.ts) and Sable Tunes (game/tunes.ts).
//
// THE LAYERS (84 BPM grid, 64-step loop ≈ 11.4 s, one chord a bar):
//   · PAD — a slow harmonic bed in the "Port Sable Sunset" chord
//     family (the theme's own BARS data: Fmaj7 | Dm9 | Bbmaj7 |
//     Cmaj7), triangle tones with a slow attack, one chord a bar.
//     At wanted 3★+ the progression shifts at the next bar line to
//     the key's relative-minor side (Dm9 | Bbmaj7 | Gm9 | Am7) —
//     the same chords the theme already lives next to, re-ordered
//     darker. Chords only ever change on a bar line, never mid-bar.
//   · PLUCK — a sparse melodic pluck cycling the chord tones an
//     octave up, two notes a bar. Its gain follows G.nightFactor,
//     the same 0..1 the world lighting uses, so it fades in across
//     dusk, plays through the night and fades out at dawn. Days
//     are pad-only.
//   · PULSE — at wanted 3★+ a low sine thump lands on the beats
//     with a soft noise tick between them; at 5★+ the thump
//     doubles to 8ths and the ticks fill the off-8ths. Losing the
//     stars fades it back out. Layer fades are ~2 s ramps — no
//     layer ever hard-cuts.
//
// PRIORITY — the score is a citizen of the existing music
// discipline, not a parallel system. The chain, verified against
// game/tunes.ts: a PLAYING Sable Tunes track outranks the score;
// a ROOM HOLD (Club Solace's rig, the diner jukebox — the single
// roomHold slot, read through tunesRoomHold()) outranks the score
// and suspends Tunes besides; the score plays only when neither
// holds; below that, silence. The start screen is the theme's —
// App.tsx calls scoreStart() from beginPlay (the Play transition),
// and there is no path back to the title, so the score never
// sounds over the menu. Missions have no dedicated music anywhere
// in this game (only sfx stings: complete / fail / star), so the
// score simply continues under them, wanted layers and all.
//
// BUS + MUTE: the score runs through ONE musicBus gain from
// game/audio.ts, re-synced on every scheduler tick, so the N-key
// mute lands within ~90 ms exactly as it does on Tunes. There is
// no separate volume — mute is the game's one audio switch.
//
// COST, stated plainly: 4 persistent nodes (the bus gain + one
// gain per layer) and one 90 ms scheduler interval. Voices are
// transient oscillators in the house idiom (each pad tone is an
// oscillator + filter + gain, stopped at the end of its envelope):
// 4 pad tones per bar, ≤2 plucks per bar, ≤8 pulse voices per bar
// at 5★+. When gated (Tunes playing, a room hold, the setting
// off) the scheduler schedules nothing at all.
import { audioCtx, musicBus, syncMusicBus } from "./audio";
import { G } from "./store";
import { TUNES_STATE, tunesRoomHold } from "./tunes";

const BPM = 84;
const STEP = 60 / BPM / 4; // 16th notes
const BUS_VOL = 0.5;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Chord data — roots + chord tones (MIDI), one chord per bar.
// CALM is the theme's own progression (game/audio.ts BARS).
const CALM_BARS = [
  { root: 29, chord: [53, 57, 60, 64] }, // Fmaj7
  { root: 26, chord: [50, 53, 57, 60] }, // Dm9
  { root: 34, chord: [58, 62, 65, 69] }, // Bbmaj7
  { root: 36, chord: [60, 64, 67, 71] }, // Cmaj7
];
// TENSE is the same key's relative-minor side (D minor): the pad
// "shifts voicing" by walking the progression into the minor.
const TENSE_BARS = [
  { root: 26, chord: [50, 53, 57, 60] }, // Dm9
  { root: 34, chord: [58, 62, 65, 69] }, // Bbmaj7
  { root: 31, chord: [55, 58, 62, 65] }, // Gm9
  { root: 33, chord: [57, 60, 64, 67] }, // Am7
];
/** Pluck notes: two steps per bar, chord-tone index picked by bar. */
const PLUCK_STEPS = [3, 10];
const PLUCK_TONE = [2, 1, 3, 0]; // chord-tone index per bar

let bus: GainNode | null = null;
let padBus: GainNode | null = null;
let pluckBus: GainNode | null = null;
let pulseBus: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;
let tense = false; // latched at bar lines from G.wanted >= 3
// Layer levels 0..1, eased toward their targets every tick so a
// layer takes ~2 s to fade in or out (FADE_S), never a hard cut.
const FADE_S = 2;
const lvl = { pad: 0, pluck: 0, pulse: 0 };

function toneS(into: GainNode | null, t: number, freq: number, dur: number, type: OscillatorType, vol: number, attack: number, cutoff = 2400) {
  const a = audioCtx(); if (!a || !into) return;
  const o = a.createOscillator(); const g = a.createGain(); const f = a.createBiquadFilter();
  o.type = type; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = cutoff;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(attack, dur * 0.4));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(into);
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseS(into: GainNode | null, t: number, dur: number, freq: number, vol: number) {
  const a = audioCtx(); if (!a || !into) return;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(into); src.start(t);
}
function thumpS(t: number, freq: number) {
  const a = audioCtx(); if (!a || !pulseBus) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  o.connect(g); g.connect(pulseBus); o.start(t); o.stop(t + 0.2);
}

function scheduleStep(s: number, t: number) {
  const bar = Math.floor(s / 16) % 4;
  const st = s % 16;
  if (st === 0) {
    // Bar line: the tension latch and the pad chord move together,
    // so the voicing never changes mid-bar.
    tense = G.wanted >= 3;
    if (lvl.pad > 0.02) {
      const B = (tense ? TENSE_BARS : CALM_BARS)[bar];
      for (const n of B.chord) toneS(padBus, t, midi(n), STEP * 16.5, "triangle", 0.05, 0.9, 1100);
    }
  }
  const B = (tense ? TENSE_BARS : CALM_BARS)[bar];
  if (lvl.pluck > 0.02 && PLUCK_STEPS.includes(st)) {
    const n = B.chord[PLUCK_TONE[bar]] + 12;
    toneS(pluckBus, t, midi(n), STEP * 3.2, "triangle", 0.075, 0.012, 2600);
  }
  if (lvl.pulse > 0.02) {
    const hot = G.wanted >= 5;
    if (hot ? st % 2 === 0 : st % 4 === 0) thumpS(t, midi(B.root + 24));
    if (hot ? st % 4 === 2 : st % 8 === 4) noiseS(pulseBus, t, 0.03, 6000, 0.05);
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Ease one layer level toward its target; write the layer gain. */
function ease(cur: number, target: number, dt: number): number {
  const d = dt / FADE_S;
  return cur < target ? Math.min(target, cur + d) : Math.max(target, cur - d);
}

function tick() {
  const a = audioCtx(); if (!a || !bus) return;
  syncMusicBus(bus, BUS_VOL); // the N mute lands on the tick
  // THE GATE — the priority chain from the header, evaluated fresh
  // every tick: Tunes playing or a room hold means the score is
  // silent; the Settings toggle is the player's own veto.
  const gated = !G.settings.ambientScore || TUNES_STATE.playing || tunesRoomHold() !== null;
  const dt = 0.09; // the interval period — fade steps are sized by it
  lvl.pad = ease(lvl.pad, gated ? 0 : 1, dt);
  lvl.pluck = ease(lvl.pluck, gated ? 0 : clamp01(G.nightFactor), dt);
  lvl.pulse = ease(lvl.pulse, gated ? 0 : G.wanted >= 3 ? 1 : 0, dt);
  if (padBus) padBus.gain.value = lvl.pad;
  if (pluckBus) pluckBus.gain.value = lvl.pluck;
  if (pulseBus) pulseBus.gain.value = lvl.pulse;
  while (nextTime < a.currentTime + 0.16) {
    scheduleStep(step % 64, nextTime);
    step += 1; nextTime += STEP;
  }
}

/** Start the score's scheduler. App.tsx calls this once, from
 * beginPlay — the score never sounds on the start screen (the
 * theme owns it) and there is no path back to the title. The
 * scheduler runs for the session; while gated it schedules
 * nothing, so Tunes / room transitions need no calls into here —
 * the tick reads the shared state, like every music citizen. */
export function scoreStart() {
  const a = audioCtx(); if (!a || timer !== null) return;
  bus = musicBus(BUS_VOL); if (!bus) return;
  padBus = a.createGain(); padBus.gain.value = 0; padBus.connect(bus);
  pluckBus = a.createGain(); pluckBus.gain.value = 0; pluckBus.connect(bus);
  pulseBus = a.createGain(); pulseBus.gain.value = 0; pulseBus.connect(bus);
  step = 0; nextTime = a.currentTime + 0.08;
  timer = window.setInterval(tick, 90);
}
