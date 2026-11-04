// The light and the shock of the combat spotlight's layer (spotlight.native.tsx; docs/plans/done/combat-spotlight-redesign.md, §5): a pool
// of light under the cards (the dark is black fog, spotlight/fog.native.tsx), the attacker's rim glow, the warm-white flash over the
// target, the shockwave ring and the glint across a turned shadow card. Every glow is a gradient (no blur filter); each piece reads
// the attack's frame (spotlight/beats.ts) through a derived value. The stage is in screen points already times the UI scale.
import { Circle, Group, LinearGradient, RadialGradient, Rect as SkRect, RoundedRect, vec } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { cardCorner } from "../../ui/card-corner.ts";
import type { Rect } from "../layout/layout.ts";
import type { Frame } from "./beats.ts";
import { FX } from "./fx.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";

// The warm white of the flash and the ring.
const FLASH = "#FFF1D6";
// The pool of light's peak opacity, and its radius in card heights.
const POOL = 0.2;
const POOL_REACH = 1.6;
// The rim glow: three strokes from the wide faint one to the narrow bright one, as (width in pt, opacity).
const RIM: readonly (readonly [number, number])[] = [
  [16, 0.12],
  [9, 0.24],
  [3.5, 0.7],
];

/** A pool of light on the stage, added to the dark with the screen blend. */
export function Pool({ cx, cy, cardH, dark, t }: { cx: number; cy: number; cardH: number; dark: SharedValue<number>; t: TableTokens }) {
  const r = cardH * POOL_REACH;
  return (
    <Circle cx={cx} cy={cy} r={r} blendMode="screen" opacity={dark}>
      <RadialGradient c={vec(cx, cy)} r={r} colors={[withAlphaHex(t.glow, POOL), withAlphaHex(t.glow, 0)]} />
    </Circle>
  );
}

/** The attacker's rim glow, building over the charge, held through the strike and let go over the flash after the impact: three gradient strokes around the card, brightest at its foot. */
export function RimGlow({ rect, color, frame, s }: { rect: Rect; color: string; frame: SharedValue<Frame>; s: number }) {
  const opacity = useDerivedValue(() => frame.get().charge);
  const r = cardCorner(rect.w, rect.h);
  return (
    <Group opacity={opacity}>
      {RIM.map(([width, alpha]) => (
        <RoundedRect key={width} x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={r} style="stroke" strokeWidth={width * s} blendMode="plus">
          <LinearGradient start={vec(0, rect.y)} end={vec(0, rect.y + rect.h)} colors={[withAlphaHex(color, alpha * 0.45), withAlphaHex(color, alpha)]} />
        </RoundedRect>
      ))}
    </Group>
  );
}

/** The localized flash: warm white over the target only, a radius of `FX.flashRadius` card heights, at most `FX.flashPeak` opaque. */
export function Flash({ cx, cy, cardH, frame }: { cx: number; cy: number; cardH: number; frame: SharedValue<Frame> }) {
  const opacity = useDerivedValue(() => frame.get().flash);
  const r = FX.flashRadius * cardH;
  return (
    <Circle cx={cx} cy={cy} r={r} blendMode="screen" opacity={opacity}>
      <RadialGradient c={vec(cx, cy)} r={r} colors={[withAlphaHex(FLASH, 1), withAlphaHex(FLASH, 0)]} />
    </Circle>
  );
}

/** The shockwave: a stroked circle from the point of contact, growing and fading. */
export function Ring({ x, y, cardH, frame, s }: { x: number; y: number; cardH: number; frame: SharedValue<Frame>; s: number }) {
  const r = useDerivedValue(() => frame.get().ring.r * cardH);
  const opacity = useDerivedValue(() => frame.get().ring.alpha);
  return <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={3 * s} color={FLASH} opacity={opacity} />;
}

/** The glint across a card turning over: a slanted band of light sweeping from left to right, clipped to the card. */
export function Glint({ rect, frame }: { rect: Rect; frame: SharedValue<Frame> }) {
  const opacity = useDerivedValue(() => Math.sin(Math.PI * frame.get().glint) * 0.6);
  const transform = useDerivedValue(() => [{ translateX: (frame.get().glint * 1.7 - 0.35) * rect.w }, { skewX: -0.35 }]);
  const band = rect.w * 0.3;
  return (
    <Group clip={{ rect: { x: rect.x, y: rect.y, width: rect.w, height: rect.h }, rx: cardCorner(rect.w, rect.h), ry: cardCorner(rect.w, rect.h) }} opacity={opacity}>
      <Group transform={transform} origin={vec(rect.x, rect.y + rect.h / 2)}>
        <SkRect x={rect.x} y={rect.y} width={band} height={rect.h} blendMode="screen">
          <LinearGradient start={vec(rect.x, 0)} end={vec(rect.x + band, 0)} colors={[withAlphaHex(FLASH, 0), withAlphaHex(FLASH, 0.9), withAlphaHex(FLASH, 0)]} />
        </SkRect>
      </Group>
    </Group>
  );
}
