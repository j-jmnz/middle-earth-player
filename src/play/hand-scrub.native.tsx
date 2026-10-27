// The hand while the scrub runs (docs/design-system.md, Table, Gestures; phase 25), drawn from the scrub's shared values: no
// state, no timer and no loop, only the clocks the gesture sets. Each hand card is posed from its place in the peeking, fanned
// hand to its place in the risen, spread hand (scrub-pose.ts); the card under the finger is drawn again on top of the others, lifted.
// The rest of the table dims under the scrub's own night (35%), which never runs under the spotlight's: no scrub runs during one.
import { Group, RoundedRect, vec } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue } from "react-native-reanimated";

import { cardFrame } from "./frame.ts";
import type { Scrub } from "./hand-gestures.native.ts";
import type { CardSlot } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";
import { scrubPose } from "./scrub-pose.ts";
import { tableTokens as t } from "./tokens.ts";

// One copy of a hand card: `top` is the lifted copy, shown only while the finger is on this card; the other is shown otherwise.
function Posed({ slot, at, scrub, top, children }: { slot: CardSlot; at: number; scrub: Scrub; top: boolean; children: ReactNode }) {
  const target = scrub.spread.slots[at];
  const { cx, cy } = cardFrame(slot);
  const transform = useDerivedValue(() => {
    if (!target) return [];
    const pose = scrubPose(slot, target, { rise: scrub.rise.get(), apart: scrub.apart.get(), lift: scrub.lift.get() }, top);
    return [{ translateX: pose.dx }, { translateY: pose.dy }, { scale: pose.scale }, { rotate: pose.rot }];
  }, [slot, target, top]);
  const opacity = useDerivedValue(() => ((scrub.index.get() === at) === top ? 1 : 0));
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={opacity}>
      {children}
    </Group>
  );
}

/** The night over the table, then the hand. `piece` draws one hand card as it is at rest (the canvas's own, with its motion). */
export function HandScrub({ slots, scrub, width, height, piece }: { slots: readonly CardSlot[]; scrub: Scrub; width: number; height: number; piece: (slot: CardSlot) => ReactNode }) {
  const night = useDerivedValue(() => SHAPE.scrubNight * scrub.rise.get());
  return (
    <>
      <RoundedRect x={0} y={0} width={width} height={height} r={0} color={t.night} opacity={night} />
      {slots.map((slot, at) => (
        <Posed key={`hand:${slot.id}`} slot={slot} at={at} scrub={scrub} top={false}>
          {piece(slot)}
        </Posed>
      ))}
      {slots.map((slot, at) => (
        <Posed key={`lifted:${slot.id}`} slot={slot} at={at} scrub={scrub} top>
          {piece(slot)}
        </Posed>
      ))}
    </>
  );
}
