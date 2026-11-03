// Where each arc of a ring starts and ends, as fractions of the ring from the top, clockwise (arc-ring.tsx and arc-ring.native.tsx).
// Pure, so both renderers share it and a test reads it.
export type ArcPart = { key: string; share: number; color: string };

export type ArcSpan = ArcPart & { from: number; to: number };

/** Each part laid after the one before it; the shares are clamped so the arcs never run past the ring. */
export function arcSpans(parts: readonly ArcPart[]): ArcSpan[] {
  return parts.reduce<ArcSpan[]>((spans, part) => {
    const from = spans.length > 0 ? spans[spans.length - 1]!.to : 0;
    const to = Math.min(1, from + Math.max(0, part.share));
    return [...spans, { ...part, from, to }];
  }, []);
}
