// The words and numbers of the combat spotlight's layer (spotlight.native.tsx; docs/design-system-table.md, Spotlight), drawn outside the
// shaking, pushed-in stage so they stay still: the attack and defense medallions, the damage number, the "Blocked" and "Destroyed" stamps,
// the "+n" chip and the note chip. Every number is the engine's (clash.ts); each piece reads the attack's frame (spotlight/beats.ts) through a
// derived value. The stage is in screen points already times the UI scale (spotlight/stage.ts).
import { Circle, Group, RoundedRect, Text, vec, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { CanvasIcon, Outlined } from "../canvas/pieces.native.tsx";
import type { IconName } from "../../ui/icon-map.ts";
import type { Frame } from "./beats.ts";
import { stampLook } from "./fx.ts";
import { SPOT } from "./shape.ts";
import type { Stage } from "./stage.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";

/** A stat medallion straddling a card's foot: a night disc with a ring, the stat's game icon over its number in Marcellus SC. It pops in; the defense one bounces on a block. */
export function Medallion({ at, radius, icon, color, text, font, frame, badge, t, s }: { at: { cx: number; cy: number }; radius: number; icon: IconName; color: string; text: string; font: SkFont; frame: SharedValue<Frame>; badge: "badgeA" | "badgeD"; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => Math.min(1, frame.get()[badge]));
  const transform = useDerivedValue(() => [{ scale: frame.get()[badge] }]);
  const iconSize = radius * 0.5;
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <Circle cx={at.cx} cy={at.cy} r={radius} color={t.night} />
      <Circle cx={at.cx} cy={at.cy} r={radius - 1 * s} color={color} style="stroke" strokeWidth={2 * s} />
      <CanvasIcon name={icon} x={at.cx - iconSize / 2} y={at.cy - radius * 0.8} size={iconSize} color={color} />
      <Text x={at.cx - font.getTextWidth(text) / 2} y={at.cy + radius * 0.58} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/** The damage number at the target's center: it pops in to 1.4 and settles, rises, and fades, in threat red (gold for a kill) on a dark outline. */
export function DamageNumber({ at, text, font, destroyed, frame, cardH, t, s }: { at: { cx: number; cy: number }; text: string; font: SkFont; destroyed: boolean; frame: SharedValue<Frame>; cardH: number; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => frame.get().number.alpha);
  const transform = useDerivedValue(() => [{ translateY: -frame.get().number.rise * SPOT.numberRise * cardH }, { scale: frame.get().number.scale }]);
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <Outlined x={at.cx} y={at.cy + font.getSize() * 0.35} text={text} font={font} t={t} s={s} color={destroyed ? t.fellowship : t.threat} heavy />
    </Group>
  );
}

/**
 * A stamp ("Blocked" in the accent color, "Destroyed" in threat red): it lands from 1.35 down to 1, turned, on a dark outline and on a
 * night plate (75%) turned with it, so it reads over the card's pale text box.
 */
export function Stamp({ at, text, font, color, frame, t, s }: { at: { cx: number; cy: number; turn: number }; text: string; font: SkFont; color: string; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => stampLook(frame.get().stamp).alpha);
  const transform = useDerivedValue(() => [{ rotate: at.turn }, { scale: stampLook(frame.get().stamp).scale }]);
  const width = font.getTextWidth(text) + font.getSize() * 0.7;
  const height = font.getSize() * 1.3;
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <RoundedRect x={at.cx - width / 2} y={at.cy - height / 2} width={width} height={height} r={height * 0.25} color={withAlphaHex(t.night, 0.75)} />
      <Outlined x={at.cx} y={at.cy + font.getSize() * 0.35} text={text} font={font} t={t} s={s} color={color} heavy />
    </Group>
  );
}

/** A small night chip with a hairline and a word on it ("+2" for the attackers past the fan), centered at `at`. */
export function Chip({ at, text, font, opacity, t, s }: { at: { cx: number; cy: number }; text: string; font: SkFont; opacity: SharedValue<number>; t: TableTokens; s: number }) {
  const width = font.getTextWidth(text) + 16 * s;
  const height = font.getSize() + 8 * s;
  return (
    <Group opacity={opacity}>
      <RoundedRect x={at.cx - width / 2} y={at.cy - height / 2} width={width} height={height} r={height / 2} color={t.night} />
      <RoundedRect x={at.cx - width / 2} y={at.cy - height / 2} width={width} height={height} r={height / 2} color={t.hairline} style="stroke" strokeWidth={1 * s} />
      <Text x={at.cx - font.getTextWidth(text) / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/** The note chip above the bottom safe inset: "n of m · Tap to skip", or "Tap to skip" for a lone attack. */
export function Note({ at, text, font, opacity, t, s }: { at: Stage["note"]; text: string; font: SkFont; opacity: SharedValue<number>; t: TableTokens; s: number }) {
  const width = font.getTextWidth(text) + 24 * s;
  return (
    <Group opacity={opacity}>
      <RoundedRect x={at.cx - width / 2} y={at.cy - at.h / 2} width={width} height={at.h} r={at.h / 2} color={t.night} />
      <RoundedRect x={at.cx - width / 2} y={at.cy - at.h / 2} width={width} height={at.h} r={at.h / 2} color={t.hairline} style="stroke" strokeWidth={1 * s} />
      <Text x={at.cx - font.getTextWidth(text) / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={t.muted} />
    </Group>
  );
}
