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
