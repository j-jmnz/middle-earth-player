// The sounds of one state's card motions and token pops (docs/design-system-table.md, Sound): each at the moment its motion shows it,
// in unscaled ms on the clock that draws it, as the landing haptic is. One sound of a kind a state, at its first moment: six cards
// drawn together make one draw sound, not six.
import type { SoundSlot } from "../../ui/sound/slots.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import type { CardSlot } from "../layout/layout.ts";
import { still, type Ghost, type Motion } from "./motion.ts";
import type { Fx } from "./token-fx.ts";

export type SoundCue = { at: number; slot: SoundSlot };

// What a card's motion sounds like, and when, or null for a card that moves without one (a row that shifts, a card that glides to a
// new place).
function cueOf(slot: CardSlot | undefined, motion: Motion): SoundCue | null {
  if (!slot || still(motion)) return null;
  // Played from the hand: lands with a squash after its lift and glide.
  if (motion.land === "squash") return { at: motion.delay + MOTION.lift.ms + MOTION.glide.ms, slot: "card.land" };
  // Dealt to an enemy facedown, or turned face up beside it.
  if (slot.kind === "shadow") return { at: motion.delay, slot: "dread.shadow" };
  // Drawn: rises on an arc into the hand.
  if (slot.zone === "hand" && motion.arc > 0) return { at: motion.delay, slot: "card.draw" };
  // Revealed or turned face up: flips and lands with a pop.
  if (motion.flip && motion.land === "pop") return { at: motion.delay, slot: "card.flip" };
  // Exhausted or readied in place: the quarter turn.
  if (motion.fromRot !== motion.toRot && motion.dx === 0 && motion.dy === 0 && !motion.flip) return { at: motion.delay, slot: slot.exhausted ? "card.exhaust" : "card.ready" };
  return null;
}

function firstOfEach(cues: readonly SoundCue[]): SoundCue[] {
  const first = new Map<SoundSlot, SoundCue>();
  for (const cue of cues) {
    const seen = first.get(cue.slot);
    if (!seen || cue.at < seen.at) first.set(cue.slot, cue);
  }
  return [...first.values()].sort((a, b) => a.at - b.at);
}

/** The sounds of a state's card motions: the cards' own, and a card destroyed or discarded from play as it starts to shake. */
export function motionCues(motions: ReadonlyMap<string, Motion>, ghosts: readonly Ghost[], slots: readonly CardSlot[]): SoundCue[] {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  const cues: SoundCue[] = [];
  for (const [id, motion] of motions) {
    const cue = cueOf(byId.get(id), motion);
    if (cue) cues.push(cue);
  }
  if (ghosts.some((ghost) => ghost.leave === "shake")) cues.push({ at: 0, slot: "card.discard" });
  return firstOfEach(cues);
}

/** The sounds of a state's token pops, on their own clock: a resource, damage or progress placed, or any token taken off. */
export function fxCues(fx: readonly Fx[]): SoundCue[] {
  const kinds: Record<Fx["delta"]["token"], SoundSlot> = { resources: "token.resource", damage: "token.damage", progress: "token.progress" };
  return firstOfEach(fx.map(({ delta, start }) => ({ at: start, slot: delta.change > 0 ? kinds[delta.token] : "token.remove" })));
}
