// A list a hub reads again each time it takes the focus (routes/(tabs)): the rows come back as new objects, so setting them would draw
// the whole hub again though nothing changed. `keepSame` hands back the held list when the rows read the same, and React skips the render.
// The rows are the few columns a list shows (plain values and parsed JSON), so their JSON text is the comparison.

/** `held` itself when `next` holds the same rows in the same order, else `next`. */
export function keepSame<T>(held: T, next: T): T {
  return held === next || JSON.stringify(held) === JSON.stringify(next) ? held : next;
}
