// What a screen reader's focus does when the moment it follows changes (use-reader-focus.ts), as a pure decision: nothing while the key is
// the same; "announce" (say the new moment, leave focus where the reader is) when the caller holds focus; otherwise "focus" (move it).
export type FocusPlan = "none" | "announce" | "focus";

export function focusPlan(previousKey: string, key: string, hold: boolean): FocusPlan {
  if (previousKey === key) return "none";
  return hold ? "announce" : "focus";
}
