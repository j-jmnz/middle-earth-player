// How a web file tells the web app's test meter (render-scale.ts) how long something took, with no import of the meter: the database channel is also bundled
// into expo-sqlite's worker, which has no page. The meter sets the hook when it shows; with none set a span costs one lookup.
export type SpanName = "raf" | "draw" | "db" | "save" | "audio" | "tap" | "img" | "tex" | "texpx" | "sub" | "shader" | "busy";
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
