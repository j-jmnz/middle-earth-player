// The hand while the scrub runs (docs/design-system.md, Table, Gestures; phase 25), drawn from the scrub's shared values: no
// state, no timer and no loop, only the clocks the gesture sets. Each hand card is posed from its place in the peeking, fanned
// hand to its place in the risen, spread hand (scrub-pose.ts); the card under the finger is drawn again on top of the others, lifted.
// The rest of the table dims under the scrub's own night (35%), which never runs under the spotlight's: no scrub runs during one.
// Drawing order: the table's cards, then this (the night, the hand, the lifted card), then the token pops and combat marks, so a
// floating number over a hand card stays visible; the night is over the table's cards and under the hand.
import { Group, RoundedRect, vec } from "@shopify/react-native-skia";
import { useSyncExternalStore, type ReactNode } from "react";
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
    // How far this card is from the one under the finger, on the UI thread: the lifted copy is 0, its neighbours grow a little.
    const under = scrub.index.get();
    const distance = top ? 0 : under >= 0 ? Math.abs(at - under) : -1;
    const pose = scrubPose(slot, target, { rise: scrub.rise.get(), apart: scrub.apart.get(), lift: scrub.lift.get() }, distance, room);
    return [{ translateX: pose.dx }, { translateY: pose.dy }, { scale: pose.scale }, { rotate: pose.rot }];
  }, [slot, target, top, at, room]);
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={hidden ? 0 : 1}>
      {children}
    </Group>
  );
}

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
        <Posed key={`hand:${slot.id}`} slot={slot} at={at} scrub={scrub} top={false} hidden={at === under}>
          {piece(slot)}
        </Posed>
      ))}
      {lifted ? (
        <Posed key={`lifted:${lifted.id}`} slot={lifted} at={under} scrub={scrub} top hidden={false}>
          {piece(lifted)}
        </Posed>
      ) : null}
    </>
  );
}
