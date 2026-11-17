// Whether the focused element is a keyboard's focus, for the web's focus ring (focus-ring.canvaskit.ts). A click focuses a control on the web too, and the browser says
// which it was (`:focus-visible`).

/** Nothing to ask (a render without a document, an element that cannot say) draws the ring. */
export function keyboardFocus(doc: { activeElement: { matches: (selector: string) => boolean } | null } | undefined): boolean {
  return doc?.activeElement?.matches(":focus-visible") !== false;
}
