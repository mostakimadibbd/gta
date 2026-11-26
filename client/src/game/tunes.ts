// Harborfall — Phase 35: SABLE TUNES, the phone's music player.
//
// The phone becomes the game's music source: four original WebAudio
// compositions, all synthesised live — no audio files, no samples,
// nothing borrowed.
//
//   1. "Port Sable Sunset" — the opening theme (game/audio.ts,
//      102 BPM, 8-bar loop ≈ 18.8 s). The title screen starts and
//      stops it exactly as it always has; the player can also start
//      it here, in the world.
//   2. "Club Solace" — the club's 116 BPM bass loop (game/audio.ts,
//      a two-bar figure ≈ 4.1 s), playable anywhere from the phone.
//   3. "Daylight Causeway" — NEW this phase. A daytime cruise
//      groove at 96 BPM, 4 bars of 16ths (64 steps, ≈ 10.0 s loop),
//      one chord a bar: Cmaj7 | Am9 | Fmaj7 | Gadd9. Warm triangle
//      pads, a round root–fifth–octave bass, a soft four-on-the-
//      floor kick with 8th hats and a 16th shaker, rhodes stabs on
//      the off-beats, and an original clean-pluck lead that sits
//      out bar 1 (the intro) and plays bars 2–4.
//   4. "Neon Meridian" — NEW this phase. A night-drive synth piece
//      at 84 BPM, 4 bars of 16ths (64 steps, ≈ 11.4 s loop), one
//      chord a bar: Am | F | C | G. Detuned saw pads, an 8th-note
//      octave-pulse bass through a low filter, a soft kick + noise
//      snare, a quiet 16th arp cycling the chord tones, and a
//      sparse original saw lead with vibrato across bars 3–4.
//
// The two new loops run on the same lookahead-scheduler idiom as
// the theme: a setInterval steps a 16th-note grid into a shared
// music bus (game/audio.ts musicBus). The bus re-syncs to the
// global mute on every scheduler tick, so the N key silences Tunes
// within ~90 ms, exactly as it silences the theme and the club
// loop. There is no separate volume setting in this game — mute is
// the one audio switch, and every music source honours it the same
// way; the player UI says so rather than faking a slider.
//
// CLUB PRIORITY: Club Solace's room system outranks the phone.
// Interiors.tsx calls tunesClubEnter / tunesClubExit on the room
// transition (it used to call startClubBass / stopClubBass
// directly): entering suspends whatever phone track is playing —
// unless it IS the club loop — and the club loop takes the room;
// leaving stops the room loop and resumes the suspended track. If
// the phone's own selected track is the club loop, it simply keeps
// playing across the door: it is the same loop. Starting a track
// from the phone while inside the club arms it as suspended — the
// room keeps its loop, yours starts when you step out.
//
// Phase 39: THE DINER JUKEBOX is the second room system, on the
// same machinery (roomHold below). The Eastmere Diner's jukebox
// plays "Daylight Causeway" — but only when the player switches
// it on at the jukebox (default off; it is an appliance, not an
// ambience system). While it holds the room it suspends the
// phone's track exactly like the club does, and switching it off
// — or leaving the diner — hands the phone back. The two rooms
// are never occupied at once, so one hold slot serves both.
//
// STATE: the selected track + playing intent persist per slot
// (harborfall-tunes, slot-prefixed by the Phase 14 layer like every
// save key). Elapsed time is honest: it counts wall-clock seconds
// since the current track was last (re)started — and, since the
// Phase 36 audit, it FREEZES while the club holds the track, so
// suspended silence never counts as listening time. The progress
// bar shows position inside the track's fixed loop — these are
// fixed-grid loops, so loop position is a real number. There is no
// total-length bar, because a loop has no total length. On boot the
// title theme plays as always (untouched); when the player presses
// Play, App.tsx calls resumeTunes() after stopping the title theme,
// and a saved "playing" track picks up from its top.
import {
  audioCtx, musicBus, syncMusicBus,
  startMenuTheme, stopMenuTheme, startClubBass, stopClubBass,
} from "./audio";

export type TuneId = "sunset" | "club" | "causeway" | "meridian";
export interface TuneDef { id: TuneId; name: string; sub: string; bpm: number; loopSeconds: number; }
export const TUNES: TuneDef[] = [
  { id: "sunset", name: "Port Sable Sunset", sub: "The opening theme — coastal funk groove", bpm: 102, loopSeconds: 128 * (60 / 102 / 4) },
  { id: "club", name: "Club Solace", sub: "The club's own 116 BPM bass loop, anywhere", bpm: 116, loopSeconds: 16 * (60 / 116 / 2) },
  { id: "causeway", name: "Daylight Causeway", sub: "Daytime cruise groove — new this season", bpm: 96, loopSeconds: 64 * (60 / 96 / 4) },
  { id: "meridian", name: "Neon Meridian", sub: "Night-drive synth — new this season", bpm: 84, loopSeconds: 64 * (60 / 84 / 4) },
];
export const tuneDef = (id: TuneId): TuneDef => TUNES.find((t) => t.id === id) ?? TUNES[0];

/** The player's selection + intent. The Phone UI reads this (on its
 * 1 s tick) — it is state, not a mirror of the audio nodes. */
export const TUNES_STATE = { track: "sunset" as TuneId, playing: false };
let startedAtMs = 0;
// Which room system currently holds the speakers, if any: Club
// Solace (its bass loop) or the diner jukebox (Daylight Causeway).
// Phase 35 shipped this as a club-only boolean; Phase 39 widens
// the slot rather than adding a second, parallel hold.
let roomHold: "club" | "jukebox" | null = null;
let suspended = false;
// Phase 36 audit: the wall-clock moment the current suspension
// began. While the club holds the track, nothing is playing — the
// elapsed readout must FREEZE at the suspend moment, not keep
// counting listening time for silence. tunesClubExit restarts the
// source (startSource re-stamps startedAtMs), so the freeze only
// ever shows while the player is inside the club.
let suspendedAtMs = 0;

function loadTunes() {
  try {
    const raw = localStorage.getItem("harborfall-tunes");
    if (raw) {
      const s = JSON.parse(raw) as { track?: string; playing?: boolean };
      if (s.track && TUNES.some((t) => t.id === s.track)) TUNES_STATE.track = s.track as TuneId;
      TUNES_STATE.playing = !!s.playing;
    }
  } catch { /* per-key guard (Phase 15): a bad key never blocks boot */ }
}
function persistTunes() {
  try { localStorage.setItem("harborfall-tunes", JSON.stringify(TUNES_STATE)); } catch { /* quota */ }
}
loadTunes();

/** Seconds since the current track was (re)started; 0 when stopped.
 * While the club holds the track the count freezes at the suspend
 * moment (Phase 36 audit) — suspended time is not listening time. */
export const tunesElapsed = (): number => {
  if (!TUNES_STATE.playing || startedAtMs <= 0) return 0;
  const end = suspended && suspendedAtMs > 0 ? suspendedAtMs : Date.now();
  return Math.max(0, (end - startedAtMs) / 1000);
};
/** True while a room system (the club, or the diner jukebox —
 * Phase 39) is holding the player's track. */
export const tunesSuspended = (): boolean => suspended;
/** Phase 46: which room system currently holds the speakers, if
 * any. The ambient score (game/score.ts) reads this to yield to
 * the room exactly as the phone does — one hold slot, every music
 * citizen consults it, nobody keeps a private copy. */
export const tunesRoomHold = (): "club" | "jukebox" | null => roomHold;

// ------------------------------------------------------------------
// The two new loops — one scheduler, per-track step composers, in
// the theme's idiom (tone/noise helpers writing into a bus gain).
// ------------------------------------------------------------------
let loopBus: GainNode | null = null;
let loopTimer: number | null = null;
let loopStep = 0;
let loopNext = 0;
let loopTrack: TuneId | null = null;
const BUS_VOL = 0.42;
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function toneB(t: number, freq: number, dur: number, type: OscillatorType, vol: number, cutoff = 2400, vibrato = 0) {
  const a = audioCtx(); if (!a || !loopBus) return;
  const o = a.createOscillator(); const g = a.createGain(); const f = a.createBiquadFilter();
  o.type = type; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = cutoff;
  if (vibrato > 0) {
    const vib = a.createOscillator(); const vg = a.createGain();
    vib.frequency.value = 5.4; vg.gain.value = vibrato;
    vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + dur);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.06, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(loopBus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noiseB(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number) {
  const a = audioCtx(); if (!a || !loopBus) return;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(loopBus); src.start(t);
}
function kickB(t: number, vol: number, f0 = 115) {
  const a = audioCtx(); if (!a || !loopBus) return;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g); g.connect(loopBus); o.start(t); o.stop(t + 0.18);
}

// ---- "Daylight Causeway" (96 BPM, 64 steps) ----
const CW_STEP = 60 / 96 / 4;
const CW_BARS = [
  { root: 36, chord: [60, 64, 67, 71] }, // Cmaj7
  { root: 33, chord: [57, 60, 64, 71] }, // Am9
  { root: 29, chord: [53, 57, 60, 65] }, // Fmaj7
  { root: 31, chord: [55, 59, 62, 67] }, // Gadd9 colour
];
/** Bass figure per bar (16th step → semitone offset from root+24). */
const CW_BASS: Record<number, number> = { 0: 0, 4: 7, 8: 0, 11: 4, 12: 7, 14: 9 };
/** The lead, keyed by loop step — bar 1 (steps 0–15) is the intro. */
const CW_LEAD: Record<number, number> = {
  16: 76, 20: 74, 24: 72, 28: 71,
  32: 77, 36: 76, 40: 74, 44: 72,
  48: 74, 52: 76, 56: 79, 60: 76,
};
function scheduleCauseway(step: number, t: number) {
  const bar = Math.floor(step / 16) % 4;
  const s = step % 16;
  const B = CW_BARS[bar];
  if (s === 0) for (const n of B.chord) toneB(t, midi(n), CW_STEP * 15, "triangle", 0.038, 1200); // pad wash
  const bass = CW_BASS[s];
  if (bass !== undefined) toneB(t, midi(B.root + 24 + bass), CW_STEP * 1.8, "sine", 0.19, 480);
  if (s % 4 === 0) kickB(t, 0.32);
  if (s % 2 === 0) noiseB(t, 0.04, "highpass", 7000, 0.07); // hat 8ths
  noiseB(t, 0.045, "highpass", 5400, 0.03); // shaker 16ths
  if (s === 7 || s === 10) { // rhodes stabs on the off-beats
    for (const n of [B.chord[1], B.chord[2], B.chord[3]]) {
      toneB(t, midi(n), 0.2, "triangle", 0.042, 1900);
      toneB(t, midi(n) * 1.004, 0.16, "sine", 0.024, 1900);
    }
  }
  const lead = CW_LEAD[step];
  if (lead) toneB(t, midi(lead), CW_STEP * 3.2, "triangle", 0.085, 2600); // clean pluck
}

// ---- "Neon Meridian" (84 BPM, 64 steps) ----
const NM_STEP = 60 / 84 / 4;
const NM_BARS = [
  { root: 33, chord: [57, 60, 64] }, // Am
  { root: 29, chord: [53, 57, 60] }, // F
  { root: 36, chord: [60, 64, 67] }, // C
  { root: 31, chord: [55, 59, 62] }, // G
];
/** The lead hook, keyed by loop step — bars 3–4 only. */
const NM_LEAD: Record<number, number> = { 32: 81, 38: 79, 44: 76, 48: 77, 54: 79, 60: 81 };
function scheduleMeridian(step: number, t: number) {
  const bar = Math.floor(step / 16) % 4;
  const s = step % 16;
  const B = NM_BARS[bar];
  if (s === 0) { // detuned saw pad, one chord a bar
    for (const n of B.chord) {
      const f = midi(n);
      toneB(t, f * 0.9985, NM_STEP * 15.5, "sawtooth", 0.026, 950);
      toneB(t, f * 1.0015, NM_STEP * 15.5, "sawtooth", 0.026, 950);
    }
  }
  if (s % 2 === 0) toneB(t, midi(B.root + 24 + (s % 4 === 2 ? 12 : 0)), NM_STEP * 1.6, "sawtooth", 0.11, 620); // octave-pulse bass, 8ths
  if (s % 4 === 0) kickB(t, 0.3, 105);
  if (s === 4 || s === 12) noiseB(t, 0.1, "bandpass", 1900, 0.13); // snare
  const arp = B.chord[[0, 1, 2, 1][s % 4]] + 12; // quiet 16th arp over the chord tones
  toneB(t, midi(arp), NM_STEP * 0.9, "square", 0.02, 2200);
  const lead = NM_LEAD[step];
  if (lead) toneB(t, midi(lead), NM_STEP * 3.6, "sawtooth", 0.045, 1500, 3.5);
}

function startLoop(id: TuneId) {
  const a = audioCtx(); if (!a || loopTimer !== null) return;
  loopBus = musicBus(BUS_VOL); if (!loopBus) return;
  loopTrack = id; loopStep = 0; loopNext = a.currentTime + 0.06;
  const stepDur = id === "causeway" ? CW_STEP : NM_STEP;
  loopTimer = window.setInterval(() => {
    const c = audioCtx(); if (!c || !loopBus) return;
    syncMusicBus(loopBus, BUS_VOL); // the N mute lands on the tick
    while (loopNext < c.currentTime + 0.16) {
      if (loopTrack === "causeway") scheduleCauseway(loopStep % 64, loopNext);
      else scheduleMeridian(loopStep % 64, loopNext);
      loopStep += 1; loopNext += stepDur;
    }
  }, 80);
}
function stopLoop() {
  if (loopTimer !== null) { window.clearInterval(loopTimer); loopTimer = null; }
  if (loopBus) {
    const g = loopBus; const a = audioCtx();
    if (a) {
      try { g.gain.linearRampToValueAtTime(0, a.currentTime + 0.25); } catch { /* gone */ }
      window.setTimeout(() => { try { g.disconnect(); } catch { /* gone */ } }, 350);
    }
  }
  loopBus = null; loopTrack = null;
}

// ------------------------------------------------------------------
// Source control — one music source at a time across all engines.
// ------------------------------------------------------------------
function startSource(id: TuneId) {
  startedAtMs = Date.now();
  if (id === "sunset") startMenuTheme();
  else if (id === "club") startClubBass();
  else startLoop(id);
}
function stopSource(id: TuneId) {
  if (id === "sunset") stopMenuTheme();
  else if (id === "club") { if (roomHold !== "club") stopClubBass(); } // inside, the room owns the loop
  // Phase 39: the loop scheduler is also the jukebox's engine —
  // while the jukebox holds the room, stopping a (suspended)
  // phone loop track must not kill the room's own loop.
  else if (roomHold !== "jukebox") stopLoop();
}

/** Play a track (switching stops the current source first). While
 * a room holds the speakers, a track that isn't the room's own
 * arms as suspended — see the header. */
export function playTune(id: TuneId) {
  if (TUNES_STATE.playing && TUNES_STATE.track === id && !suspended) return; // already on
  stopSource(TUNES_STATE.track);
  TUNES_STATE.track = id; TUNES_STATE.playing = true; persistTunes();
  // The room's own track (the club loop in the club, Causeway at
  // the jukebox) is already sounding as the room loop — selecting
  // it just adopts it. Anything else arms as suspended.
  const holdTrack: TuneId | null = roomHold === "club" ? "club" : roomHold === "jukebox" ? "causeway" : null;
  if (holdTrack && id !== holdTrack) {
    // Armed, not started: stamp both clocks at the arm moment so
    // the frozen elapsed reads 0, not the previous track's age.
    suspended = true; startedAtMs = Date.now(); suspendedAtMs = startedAtMs;
    return;
  }
  suspended = false;
  startSource(id);
}
/** Pause = stop the source. Loops are short; the next play starts
 * the track from its top, and the elapsed readout says so. */
export function pauseTunes() {
  if (!TUNES_STATE.playing) return;
  stopSource(TUNES_STATE.track);
  TUNES_STATE.playing = false; suspended = false; startedAtMs = 0; persistTunes();
}
export function stepTune(dir: 1 | -1) {
  const i = TUNES.findIndex((t) => t.id === TUNES_STATE.track);
  playTune(TUNES[(i + dir + TUNES.length) % TUNES.length].id);
}
/** App.tsx calls this on Play (after the title theme stops): a
 * saved "playing" track picks up from its top. */
export function resumeTunes() {
  if (!TUNES_STATE.playing || roomHold) return;
  startSource(TUNES_STATE.track);
}

// ------------------------------------------------------------------
// Club priority — called by Interiors.tsx on the room transition.
// ------------------------------------------------------------------
export function tunesClubEnter() {
  if (roomHold === "club") return;
  roomHold = "club";
  if (TUNES_STATE.playing && TUNES_STATE.track !== "club") {
    stopSource(TUNES_STATE.track);
    suspended = true; suspendedAtMs = Date.now(); // freeze the elapsed clock here
  }
  startClubBass(); // the room's own system takes the room
}
export function tunesClubExit() {
  if (roomHold !== "club") return;
  roomHold = null;
  // If the phone's own track IS the club loop, it keeps playing —
  // it is the same loop, now carried by the phone instead of the
  // room. Anything else: the room loop stops here.
  if (!(TUNES_STATE.playing && TUNES_STATE.track === "club")) stopClubBass();
  if (suspended) {
    suspended = false;
    if (TUNES_STATE.playing) startSource(TUNES_STATE.track);
  }
}

// ------------------------------------------------------------------
// Phase 39: the Eastmere Diner jukebox — the second room system.
// Interiors.tsx calls these from the jukebox prompt and when the
// player leaves the diner. The jukebox's loop is Daylight
// Causeway on the shared loop scheduler (startLoop directly, NOT
// startSource: the phone's elapsed clock belongs to the phone's
// track, and a room appliance must not re-stamp it).
// ------------------------------------------------------------------
export function tunesJukeboxStart() {
  if (roomHold) return; // a room already holds the speakers
  if (TUNES_STATE.playing && TUNES_STATE.track !== "causeway") {
    stopSource(TUNES_STATE.track);
    suspended = true; suspendedAtMs = Date.now(); // freeze the elapsed clock here
  }
  roomHold = "jukebox";
  // If the phone's own Causeway is already playing, its loop IS
  // this loop — startLoop's timer guard makes this a no-op.
  startLoop("causeway");
}
export function tunesJukeboxStop() {
  if (roomHold !== "jukebox") return;
  roomHold = null;
  // The club rule, mirrored: if the phone's own track IS
  // Causeway and playing, the same loop keeps playing, now
  // carried by the phone. Anything else: the room loop stops.
  if (!(TUNES_STATE.playing && TUNES_STATE.track === "causeway")) stopLoop();
  if (suspended) {
    suspended = false;
    if (TUNES_STATE.playing) startSource(TUNES_STATE.track);
  }
}
export const tunesJukeboxOn = (): boolean => roomHold === "jukebox";
