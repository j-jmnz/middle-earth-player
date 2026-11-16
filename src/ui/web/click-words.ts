// The web and the desktop say "Click" where the phone says "Tap" (docs/design-system.md, Standards; text.canvaskit.tsx). An instruction the app words for a finger ("Tap
// again: planning ends", "Tap a hero to take one resource", "Tap to skip") is read by a player with a mouse, who clicks. The sentences live in about sixty words modules and
// in the generated asks files, so they are said once, for the phone, and this turns the word on its way to the screen. Only the app's own Text passes through it
// (a screen reader's labels and hints keep the platform's words: "Double tap" is a screen reader's gesture).
import type { ReactNode } from "react";

// The sentences whose gesture has no mouse twin by a plain swap come first: a double tap is a click (a mouse has no use for two), a hold is a right click, and a swipe has no click at all.
// The dock's note for a hand with plays is the one line the folded dock holds at the smallest window (844 x 390), where the phone's words reach "or dr…": a mouse says it in 37 characters.
const WORDS: readonly (readonly [RegExp, string])[] = [
  [/\bTap a glowing card to play it, or drag it\./g, "Click or drag a glowing card to play."],
  [/\bDouble tap to\b/g, "Click to"],
  [/\bdouble tap to\b/g, "click to"],
  [/\bHold a card to read it\b/g, "Right-click a card to read it"],
  [/\btap or swipe it\b/g, "click it"],
  [/\bTap\b/g, "Click"],
  [/\btap\b/g, "click"],
  [/\btapped\b/g, "clicked"],
];

/** A sentence with the phone's tap worded for a mouse. */
export function clickWords(text: string): string {
  let said = text;
  for (const [from, to] of WORDS) said = said.replace(from, to);
  return said;
}

/** A Text's children with every string worded for a mouse; a node that holds no such word is returned as it was (the same object, so nothing re-renders for it). */
export function clickChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return /ap|Hold/.test(children) ? clickWords(children) : children;
  if (!Array.isArray(children)) return children;
  let changed = false;
  const said = children.map((child: ReactNode) => {
    const next = clickChildren(child);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? said : children;
}
