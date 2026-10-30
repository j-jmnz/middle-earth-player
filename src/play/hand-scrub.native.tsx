// The hand while the scrub runs (docs/design-system-table.md, Gestures; phase 25), drawn from the scrub's shared values: no
// state, no timer and no loop, only the clocks the gesture sets. Each hand card is posed from its place in the peeking, fanned
// hand to its place in the risen, spread hand (scrub-pose.ts); the card under the finger is drawn again on top of the others, lifted.
// The rest of the table dims under the scrub's own night (35%), which never runs under the spotlight's: no scrub runs during one.
// Drawing order: the table's cards, then this (the night, the hand, the lifted card), then the token pops and combat marks, so a
// floating number over a hand card stays visible; the night is over the table's cards and under the hand.
import { Group, RoundedRect, vec } from "@shopify/react-native-skia";
import { memo, useSyncExternalStore, type ReactNode } from "react";
import { useDerivedValue } from "react-native-reanimated";

import { cardFrame } from "./frame.ts";
import type { Scrub } from "./hand-gestures.native.ts";
import type { CardSlot } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";
import { scrubUnder, subscribeScrub } from "./scrub-open.ts";
import { scrubPose } from "./scrub-pose.ts";
import type { TableTokens } from "./tokens.ts";

// One hand card posed by the scrub; `top` is the one lifted copy of the card under the finger.
function Posed({ slot, at, scrub, top, hidden, children }: { slot: CardSlot; at: number; scrub: Scrub; top: boolean; hidden: boolean; children: ReactNode }) {
  const target = scrub.spread.slots[at];
  const room = scrub.spread.room;
  const { cx, cy } = cardFrame(slot);
  const transform = useDerivedValue(() => {
    if (!target) return [];
    // For the frame or two before JavaScript's `under` catches up, the card at the new index lifts in its own place. The card the
    // finger left settles back on the drop clock.
    const under = scrub.index.get();
    const lifted = top || at === under;
    const drop = !top && at !== under && at === scrub.left.get() ? scrub.drop.get() : 0;
    const pose = scrubPose(slot, target, { rise: scrub.rise.get(), apart: scrub.apart.get(), lift: scrub.lift.get() }, lifted, room, drop);
    return [{ translateX: pose.dx }, { translateY: pose.dy }, { scale: pose.scale }, { rotate: pose.rot }];
  }, [slot, target, top, at, room]);
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={hidden ? 0 : 1}>
      {children}
    </Group>
  );
}

// One hand card of the hand, kept as its own memoized child: a step of the scrub changes `under`, and only the card that gained it and the
// card that lost it get a new `hidden`, so only those two draw their piece again (the other cards' props, and the piece function, are the same).
const HandCard = memo(function HandCard({ slot, at, scrub, hidden, piece }: { slot: CardSlot; at: number; scrub: Scrub; hidden: boolean; piece: (slot: CardSlot) => ReactNode }) {
  return (
    <Posed slot={slot} at={at} scrub={scrub} top={false} hidden={hidden}>
      {piece(slot)}
    </Posed>
  );
});

/**
 * The night over the table, then the hand. `piece` draws one hand card as it is at rest (the canvas's own, with its motion). The card
 * under the finger (as JavaScript last heard of it) is drawn once more, lifted, on top of the others, and its own place is left empty;
 * with no scrub that is no extra copy.
 */
export function HandScrub({ slots, scrub, width, height, t, piece }: { slots: readonly CardSlot[]; scrub: Scrub; width: number; height: number; t: TableTokens; piece: (slot: CardSlot) => ReactNode }) {
  const night = useDerivedValue(() => SHAPE.scrubNight * scrub.rise.get());
  const under = useSyncExternalStore(subscribeScrub, scrubUnder);
  const lifted = slots[under];
  return (
    <>
      <RoundedRect x={0} y={0} width={width} height={height} r={0} color={t.night} opacity={night} />
      {slots.map((slot, at) => (
        <HandCard key={`hand:${slot.id}`} slot={slot} at={at} scrub={scrub} hidden={at === under} piece={piece} />
      ))}
      {lifted ? (
        <Posed key={`lifted:${lifted.id}`} slot={lifted} at={under} scrub={scrub} top hidden={false}>
          {piece(lifted)}
        </Posed>
      ) : null}
    </>
  );
}
