// How a web file tells the web app's test meter (render-scale.ts) how long something took, with no import of the meter: the database channel is also bundled
// into expo-sqlite's worker, which has no page. The meter sets the hook when it shows; with none set a span costs one lookup.
export type SpanName = "raf" | "draw" | "db" | "save" | "audio" | "tap" | "img" | "tex" | "texpx" | "sub" | "shader" | "ctx" | "busy";
type Hook = (name: SpanName, ms: number, bytes?: number) => void;

const holder = globalThis as { __middleEarthMeter?: Hook };

/** Reports `ms` spent on `name` (and for a save, the bytes copied) to the meter, when it shows. */
export function span(name: SpanName, ms: number, bytes?: number): void {
  holder.__middleEarthMeter?.(name, ms, bytes);
}

/** The meter's side: every span from now on goes to `hook`. */
export function onSpan(hook: Hook): void {
  holder.__middleEarthMeter = hook;
}

type Notes = Map<string, () => string>;
const noted = globalThis as { __middleEarthNotes?: Notes };

/** Gives the meter a line to add to each second of its log under `name` (the state of the music's elements, for one). */
export function describeTo(name: string, describe: () => string): void {
  (noted.__middleEarthNotes ??= new Map()).set(name, describe);
}

/** Every line given with describeTo, as `name: text`, for the meter. */
export function described(): string[] {
  return [...(noted.__middleEarthNotes ?? new Map<string, () => string>())].map(([name, describe]) => `${name}: ${describe()}`).filter((line) => !line.endsWith(": "));
}
