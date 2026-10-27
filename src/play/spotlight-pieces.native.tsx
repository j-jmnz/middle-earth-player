// The pieces of the combat spotlight's layer (spotlight.native.tsx; docs/design-system.md, Table, Spotlight): a card flying between its
// slot and the stage, the pill under a group, the damage token in the target's corner and a token in flight. Each reads the frame of
// its attack (spotlight-beats.ts) through a derived value, so the UI thread moves it and the canvas draws again only while it plays.
import { Circle, Group, Image, RoundedRect, Text, vec, type SkFont, type SkImage } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { CanvasIcon, CardBody, Outlined, RADIUS, type BackImages, type Fonts } from "./canvas-pieces.native.tsx";
import type { IconName } from "./icon-map.ts";
import type { Rect } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";
import { burstAt, type Frame, type Place } from "./spotlight-beats.ts";
import type { SpotCard } from "./spotlight-plan.ts";
import { burstPoint, flown, PILL_H, type Stage } from "./spotlight-stage.ts";
import { tableTokens as t } from "./tokens.ts";

/** Which of an attack's cards this is: it decides how the frame moves it. */
export type Role = "attacker" | "target" | "shadow";

/**
 * A card between its slot and the stage: it flies out, the attacker draws back and lunges, the target shakes and falls, and a
 * shadow card turns over. `rect` is where it stands on the stage and `turn` its fan turn; `children` draw it there.
 */
export function FlyingCard({ spot, rect, turn, role, frame, children }: { spot: SpotCard; rect: Rect; turn: number; role: Role; frame: SharedValue<Frame>; children: ReactNode }) {
  const origin = vec(rect.x + rect.w / 2, rect.y + rect.h / 2);
  const transform = useDerivedValue(() => {
    const f = frame.get();
    const p = flown(spot.from, spot.turn, rect, turn, role === "target" ? f.flyTarget : f.flyAttackers);
    const dx = role === "attacker" ? f.strike : role === "target" ? f.shake : 0;
    const dy = role === "target" ? SHAPE.spotlightDrop * f.fall : 0;
    const flip = role === "shadow" ? Math.abs(Math.cos(Math.PI * f.flip)) : 1;
    return [{ translateX: p.tx + dx }, { translateY: p.ty + dy }, { rotate: p.turn + (role === "attacker" ? f.tilt : 0) }, { scale: p.scale }, { scaleX: flip }];
  });
  const opacity = useDerivedValue(() => (role === "target" ? frame.get().targetOpacity : 1));
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      {children}
    </Group>
  );
}

/** A picture of a card on the stage at `rect`: the card as the table draws it, nothing on it (no tokens, no pills). */
export function StageCard({ spot, rect, image, name, sphere, fonts, backs, faceDown = false }: { spot: SpotCard; rect: Rect; image: SkImage | null; name: string; sphere: IconName | null; fonts: Fonts; backs: BackImages; faceDown?: boolean }) {
  const slot = { ...rect, id: spot.id, code: spot.code, zone: "play" as const, kind: "card" as const, exhausted: false, faceDown, landscape: false, resources: 0, damage: 0, progress: 0, tilt: 0, count: 0, committed: false };
  return <CardBody slot={slot} image={image} name={name} sphere={sphere} fonts={fonts} encounterBack={faceDown} backs={backs} />;
}

/** The night veil over a destroyed target, growing to 50% over the first 40% of its fall. */
export function Veil({ rect, frame }: { rect: Rect; frame: SharedValue<Frame> }) {
  const opacity = useDerivedValue(() => frame.get().veil);
  return <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={RADIUS} color={t.night} opacity={opacity} />;
}

/** A big pill under a group: the stat's icon and its number in Cinzel Bold. The defense pill bounces when the attack is blocked. */
export function Pill({ at, icon, color, text, font, frame, bounce = false }: { at: { cx: number; cy: number }; icon: IconName; color: string; text: string; font: SkFont; frame: SharedValue<Frame>; bounce?: boolean }) {
  const width = 12 + 20 + 6 + font.getTextWidth(text) + 12;
  const left = at.cx - width / 2;
  const top = at.cy - PILL_H / 2;
  const opacity = useDerivedValue(() => frame.get().pills);
  const transform = useDerivedValue(() => [{ scale: bounce ? frame.get().bounce : 1 }]);
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <RoundedRect x={left} y={top} width={width} height={PILL_H} r={PILL_H / 2} color={t.night} />
      <RoundedRect x={left} y={top} width={width} height={PILL_H} r={PILL_H / 2} color={color} style="stroke" strokeWidth={1.5} />
      <CanvasIcon name={icon} x={left + 12} y={at.cy - 10} size={20} color={color} />
      <Text x={left + 12 + 20 + 6} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/** A small night chip with a hairline, like the pills, with a word on it ("+2" for the attackers past the fan, over card art), centered at `at`. */
export function Chip({ at, text, font, opacity }: { at: { cx: number; cy: number }; text: string; font: SkFont; opacity: SharedValue<number> }) {
  const width = font.getTextWidth(text) + 16;
  const height = font.getSize() + 8;
  return (
    <Group opacity={opacity}>
      <RoundedRect x={at.cx - width / 2} y={at.cy - height / 2} width={width} height={height} r={height / 2} color={t.night} />
      <RoundedRect x={at.cx - width / 2} y={at.cy - height / 2} width={width} height={height} r={height / 2} color={t.hairline} style="stroke" strokeWidth={1} />
      <Text x={at.cx - font.getTextWidth(text) / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/** A small word under a pill ("Blocked"), centered at `at`. */
export function Word({ at, text, font, color = t.bone, opacity }: { at: { cx: number; cy: number }; text: string; font: SkFont; color?: string; opacity: SharedValue<number> | number }) {
  return <Text x={at.cx - font.getTextWidth(text) / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={color} opacity={opacity} />;
}

/**
 * The damage token in the target's corner with its count: the count before the attack until the last token lands, then the new count,
 * popping as the table's tokens do (token-fx.ts). It is drawn in the target's own group, so it shakes and falls with it.
 */
export function Corner({ stage, before, after, image, font, frame }: { stage: Stage; before: number; after: number; image: SkImage | null; font: SkFont; frame: SharedValue<Frame> }) {
  const { cx, cy } = stage.corner;
  const size = SHAPE.spotlightToken;
  const pop = useDerivedValue(() => [{ scale: frame.get().pop }]);
  const old = useDerivedValue(() => (frame.get().landed ? 0 : 1));
  const now = useDerivedValue(() => (frame.get().landed ? 1 : 0));
  const shown = useDerivedValue(() => (before > 0 || frame.get().landed ? 1 : 0));
  return (
    <Group transform={pop} origin={vec(cx, cy)} opacity={shown}>
      {image ? <Image image={image} x={cx - size / 2} y={cy - size / 2} width={size} height={size} fit="contain" /> : <Circle cx={cx} cy={cy} r={size / 2} color={t.threat} />}
      <Group opacity={old}>
        <Outlined x={cx} y={cy + font.getSize() * 0.35} text={String(before)} font={font} />
      </Group>
      <Group opacity={now}>
        <Outlined x={cx} y={cy + font.getSize() * 0.35} text={String(after)} font={font} />
      </Group>
    </Group>
  );
}

/** One damage token on its way from the point of contact to the target's corner. */
export function BurstToken({ stage, index, count, now, k, place, image }: { stage: Stage; index: number; count: number; now: SharedValue<number>; k: number; place: Place; image: SkImage | null }) {
  const size = SHAPE.spotlightToken;
  const flight = useDerivedValue(() => burstAt(index, count, now.get(), k, place));
  const transform = useDerivedValue(() => {
    const p = burstPoint(stage, index, count, flight.get().u);
    return [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }];
  });
  const opacity = useDerivedValue(() => (flight.get().flying ? burstPoint(stage, index, count, flight.get().u).opacity : 0));
  return (
    <Group transform={transform} opacity={opacity}>
      {image ? <Image image={image} x={-size / 2} y={-size / 2} width={size} height={size} fit="contain" /> : <Circle cx={0} cy={0} r={size / 2} color={t.threat} />}
    </Group>
  );
}
