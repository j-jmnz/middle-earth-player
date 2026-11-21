// The volume slider's numbers (src/ui/sound/volume-slider.tsx): a volume is 0 to 1 in steps of 5%, a touch on the track picks the step under
// it, and a screen reader's adjust gesture moves it 10% at a time.

const STEP = 0.05;
const ADJUST = 0.1;

/** A volume kept between 0 and 1 and on a 5% step. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) / STEP) * STEP;
}

/** The volume at `x` points along a track `width` points wide. */
export function volumeAt(x: number, width: number): number {
  return width > 0 ? clampVolume(x / width) : 0;
}

/** One adjust step up or down, for a screen reader. */
export function stepVolume(value: number, up: boolean): number {
  return clampVolume(value + (up ? ADJUST : -ADJUST));
}

/** The volume as a screen reader and the row's figure say it: "80%". */
export function volumeWords(value: number): string {
  return `${Math.round(clampVolume(value) * 100)}%`;
}
