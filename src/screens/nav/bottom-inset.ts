// The bottom safe-area inset a pinned bar keeps clear of: the phone's own buttons or gesture bar. The provider's inset can be stale
// back from the landscape table (still its landscape value, no bottom inset), and the native SafeAreaView did not cover it on a
// phone (user report, 2026-10-29: the campaign path's Log and Resume under the phone's buttons). So, in portrait, it is never less
// than the largest portrait inset seen since launch, the one measured at launch included (use-bottom-inset.ts). Pure, so a test reads it.

/** The larger of the inset now and, in portrait, the largest portrait inset seen (`seen`), with the memory after it. */
export function bottomInset(now: number, portrait: boolean, seen: number): { inset: number; seen: number } {
  if (!portrait) return { inset: now, seen };
  const next = Math.max(seen, now);
  return { inset: next, seen: next };
}

/**
 * How far a pinned bar's bottom edge runs past the app's root view (both in window points), or 0. The campaign path's screen was laid
 * out taller than the window on a phone (user report and screenshot, 2026-10-29: its foot ran past the screen's bottom edge, which
 * the web build does not do); the bar adds this to its bottom padding so its buttons stay in view whatever makes the screen taller.
 */
export function overrun(barBottom: number, rootBottom: number): number {
  return Math.max(0, Math.round(barBottom - rootBottom));
}
