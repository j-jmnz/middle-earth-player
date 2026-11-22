// Finds a longer loop in a track of the score (scripts/build/pack-music.ts, --longer; docs/design-system-table.md, Sound): a passage
// that holds the loop chosen by ear and repeats with no seam. The player crossfades the last MUSIC_LEAD_SECONDS of one copy into the
// MUSIC_LEAD_SECONDS before the next copy's start (src/ui/sound/music.ts), so a loop repeats cleanly when the music before its end
// sounds like the music before its start, and goes on alike after both. The search reads the track as frames of pitch classes and
// level, scores every start and end around the old loop, and sets the end on the beat against the start. It hears nothing: each new
// seam is listened to before its pick is kept.
import { MUSIC_LEAD_SECONDS } from "../../src/ui/sound/music-lead.ts";

/** The decode the search reads: mono, at this rate. */
export const SEAM_RATE = 11025;
// A frame is 186 ms of the track, and one starts every 100 ms.
const FRAME = 2048;
const HOP_SECONDS = 0.1;
// The sample a frame starts at: rounded for each frame, so a hundred frames are ten seconds to the sample.
const frameStart = (frame: number) => Math.round(frame * SEAM_RATE * HOP_SECONDS);
// The pitches a frame's pitch classes are read from: the fundamentals of an orchestra, under the noise of cymbals and breath.
const LOW_HZ = 55;
const HIGH_HZ = 2000;
// How much of the music after the seam is compared too, in seconds: what the first copy would have played on against what the next plays.
const AFTER_SECONDS = 1;
// A loop whose length is within this share of the target counts as the target's length.
const LENGTH_SLACK = 0.15;
// The track's last half second is its fade or its silence, and no loop ends in it.
const TAIL_SECONDS = 0.5;
// What a seam costs past its own difference: a second of length off the target, and a decibel of mean level away from the old loop
// (a passage much louder or quieter than the one chosen by ear is another mood, calm against combat).
const LENGTH_WEIGHT = 0.2;
const LEVEL_WEIGHT = 0.02;
const LEVEL_FREE_DB = 2;
const AFTER_WEIGHT = 0.3;
// A seam scored over this is named weak in the report.
export const WEAK_SEAM = 0.25;

/** A track as the search reads it: each frame's 12 pitch classes (unit length; all 0 for silence) and its level in dB. */
export type Frames = { count: number; chroma: Float32Array; level: Float32Array };

// An in-place radix-2 FFT of `re` and `im` (both of a power-of-two length).
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i] ?? 0;
      re[i] = re[j] ?? 0;
      re[j] = r;
      const m = im[i] ?? 0;
      im[i] = im[j] ?? 0;
      im[j] = m;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k += 1) {
        const cos = Math.cos(step * k);
        const sin = Math.sin(step * k);
        const a = start + k;
        const b = a + half;
        const br = (re[b] ?? 0) * cos - (im[b] ?? 0) * sin;
        const bi = (re[b] ?? 0) * sin + (im[b] ?? 0) * cos;
        re[b] = (re[a] ?? 0) - br;
        im[b] = (im[a] ?? 0) - bi;
        re[a] = (re[a] ?? 0) + br;
        im[a] = (im[a] ?? 0) + bi;
      }
    }
  }
}

/** Reads a mono decode at SEAM_RATE into frames. */
export function framesOf(samples: Int16Array): Frames {
  const count = Math.max(0, Math.floor((samples.length - FRAME) / (SEAM_RATE * HOP_SECONDS)) + 1);
  const chroma = new Float32Array(count * 12);
  const level = new Float32Array(count);
  const window = Float32Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
  // The pitch class of each FFT bin between LOW_HZ and HIGH_HZ (-1 outside).
  const classOf = Int8Array.from({ length: FRAME / 2 }, (_, bin) => {
    const hz = (bin * SEAM_RATE) / FRAME;
    if (hz < LOW_HZ || hz > HIGH_HZ) return -1;
    return ((Math.round(12 * Math.log2(hz / 440)) % 12) + 12) % 12;
  });
  const re = new Float32Array(FRAME);
  const im = new Float32Array(FRAME);
  for (let frame = 0; frame < count; frame += 1) {
    let power = 0;
    for (let i = 0; i < FRAME; i += 1) {
      const sample = (samples[frameStart(frame) + i] ?? 0) / 32768;
      power += sample * sample;
      re[i] = sample * (window[i] ?? 0);
      im[i] = 0;
    }
    level[frame] = 10 * Math.log10(power / FRAME + 1e-9);
    fft(re, im);
    let norm = 0;
    for (let bin = 1; bin < FRAME / 2; bin += 1) {
      const pitch = classOf[bin] ?? -1;
      if (pitch < 0) continue;
      const at = frame * 12 + pitch;
      chroma[at] = (chroma[at] ?? 0) + Math.hypot(re[bin] ?? 0, im[bin] ?? 0);
    }
    for (let pitch = 0; pitch < 12; pitch += 1) norm += (chroma[frame * 12 + pitch] ?? 0) ** 2;
    norm = Math.sqrt(norm);
    if (norm > 1e-6) for (let pitch = 0; pitch < 12; pitch += 1) chroma[frame * 12 + pitch] = (chroma[frame * 12 + pitch] ?? 0) / norm;
  }
  return { count, chroma, level };
}

// How unlike two frames sound, 0 (the same pitches at the same level) and up: the pitch classes' distance, and a part for each 20 dB between them.
function unlike(frames: Frames, a: number, b: number): number {
  let dot = 0;
  for (let pitch = 0; pitch < 12; pitch += 1) dot += (frames.chroma[a * 12 + pitch] ?? 0) * (frames.chroma[b * 12 + pitch] ?? 0);
  return 1 - dot + Math.abs((frames.level[a] ?? 0) - (frames.level[b] ?? 0)) / 20;
}

// The mean of `unlike` over `length` frames from `a` and from `b`.
function runUnlike(frames: Frames, a: number, b: number, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += unlike(frames, a + i, b + i);
  return sum / Math.max(1, length);
}

export type LongerLoop = {
  start: number;
  end: number;
  /** How unlike the music before the end and before the start is: 0 is the same; over WEAK_SEAM is named weak. */
  seam: number;
  /** The new loop's mean level less the old loop's, in dB. */
  level: number;
  /** The track has no passage of the target length around the old loop: this is the longest it has. */
  short: boolean;
};

/**
 * The loop of about `factor` times the old one's length that holds the old loop (`start`..`end`, seconds) and repeats best, or null
 * when the track has no room for a longer one. `seconds` is the track's length.
 */
export function longerLoop(frames: Frames, seconds: number, old: { start: number; end: number }, factor: number): LongerLoop | null {
  const lead = Math.round(MUSIC_LEAD_SECONDS / HOP_SECONDS);
  const after = Math.round(AFTER_SECONDS / HOP_SECONDS);
  const oldLength = old.end - old.start;
  const target = oldLength * factor;
  // The latest end and the earliest start, in frames; a frame index is the time its frame starts.
  const last = Math.min(frames.count - 1 - Math.ceil(FRAME / (SEAM_RATE * HOP_SECONDS)), Math.floor((seconds - TAIL_SECONDS) / HOP_SECONDS));
  const first = lead;
  const oldStart = Math.round(old.start / HOP_SECONDS);
  const oldEnd = Math.round(old.end / HOP_SECONDS);
  const room = (last - first) * HOP_SECONDS;
  const short = room < target * (1 - LENGTH_SLACK);
  const least = short ? Math.max(oldLength * 1.05, room * (1 - LENGTH_SLACK)) : target * (1 - LENGTH_SLACK);
  const most = short ? room : target * (1 + LENGTH_SLACK);
  if (room < oldLength * 1.05) return null;
  // The level's running sum, for a passage's mean in one step.
  const sums = new Float64Array(frames.count + 1);
  for (let i = 0; i < frames.count; i += 1) sums[i + 1] = (sums[i] ?? 0) + (frames.level[i] ?? 0);
  const mean = (from: number, to: number) => ((sums[to] ?? 0) - (sums[from] ?? 0)) / Math.max(1, to - from);
  const oldLevel = mean(oldStart, oldEnd);
  let best: { start: number; end: number; cost: number; seam: number } | null = null;
  for (let start = first; start <= Math.min(oldStart, last); start += 1) {
    const from = Math.max(oldEnd, start + Math.ceil(least / HOP_SECONDS));
    const to = Math.min(last, start + Math.floor(most / HOP_SECONDS));
    for (let end = from; end <= to; end += 1) {
      const seam = runUnlike(frames, end - lead, start - lead, lead);
      // No better than the best even with nothing else against it.
      if (best && seam >= best.cost) continue;
      const ahead = Math.min(after, frames.count - end);
      const goesOn = ahead > 0 ? runUnlike(frames, end, start, ahead) : 0;
      const length = (end - start) * HOP_SECONDS;
      const offTarget = short ? (most - length) / most : Math.abs(length - target) / target;
      const offLevel = Math.max(0, Math.abs(mean(start, end) - oldLevel) - LEVEL_FREE_DB);
      const cost = seam + AFTER_WEIGHT * goesOn + LENGTH_WEIGHT * offTarget + LEVEL_WEIGHT * offLevel;
      if (!best || cost < best.cost) best = { start, end, cost, seam };
    }
  }
  if (!best) return null;
  return { start: best.start * HOP_SECONDS, end: best.end * HOP_SECONDS, seam: best.seam, level: mean(best.start, best.end) - oldLevel, short };
}

// The level of each 10 ms of `samples` from `from` (seconds) for `seconds`, for setting two passages on the same beat.
function envelope(samples: Int16Array, from: number, seconds: number): Float32Array {
  const step = Math.round(SEAM_RATE / 100);
  const out = new Float32Array(Math.round(seconds * 100));
  const base = Math.round(from * SEAM_RATE);
  for (let i = 0; i < out.length; i += 1) {
    let sum = 0;
    for (let k = 0; k < step; k += 1) sum += Math.abs(samples[base + i * step + k] ?? 0);
    out[i] = sum / step;
  }
  return out;
}

/**
 * The loop's end set on the beat: moved by up to one frame either way, to where the level's rise and fall before the end lines up
 * best with the level before the start, so the crossfade doubles no beat.
 */
export function onBeat(samples: Int16Array, start: number, end: number): number {
  const reach = HOP_SECONDS;
  const want = envelope(samples, start - MUSIC_LEAD_SECONDS, MUSIC_LEAD_SECONDS + AFTER_SECONDS);
  const wantMean = want.reduce((sum, value) => sum + value, 0) / want.length;
  let best = { shift: 0, score: -Infinity };
  for (let shift = -Math.round(reach * 100); shift <= Math.round(reach * 100); shift += 1) {
    const moved = end + shift / 100;
    if (moved + AFTER_SECONDS > samples.length / SEAM_RATE) continue;
    const have = envelope(samples, moved - MUSIC_LEAD_SECONDS, MUSIC_LEAD_SECONDS + AFTER_SECONDS);
    const haveMean = have.reduce((sum, value) => sum + value, 0) / have.length;
    let dot = 0;
    let a = 0;
    let b = 0;
    for (let i = 0; i < want.length; i += 1) {
      const x = (want[i] ?? 0) - wantMean;
      const y = (have[i] ?? 0) - haveMean;
      dot += x * y;
      a += x * x;
      b += y * y;
    }
    const score = dot / (Math.sqrt(a * b) || 1);
    // The unmoved end wins a tie, so a passage with no beat stays where the search put it.
    if (score > best.score + 1e-6 || (shift === 0 && score >= best.score - 1e-6)) best = { shift, score };
  }
  return end + best.shift / 100;
}
