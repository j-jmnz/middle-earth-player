// The pieces of the combat spotlight's layer (spotlight.native.tsx; docs/design-system.md, Table, Spotlight): a card flying between its
// slot and the stage, the pill under a group, the damage token in the target's corner and a token in flight. Each reads the frame of
// its attack (spotlight-beats.ts) through a derived value, so the UI thread moves it and the canvas draws again only while it plays.
// Each takes `s`, the UI scale (ui-scale.ts), from the canvas root; the sizes below are Medium's and the pieces draw them times `s`.
import { Circle, Group, Image, RoundedRect, Text, vec, type SkFont, type SkImage } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { cardCorner } from "./card-corner.ts";
import { CanvasIcon, CardBody, Outlined, type BackImages, type Fonts } from "./canvas-pieces.native.tsx";
import type { IconName } from "./icon-map.ts";
import type { Rect } from "./layout.ts";
import { burstAt, type Frame, type Place } from "./spotlight-beats.ts";
import type { SpotCard } from "./spotlight-plan.ts";
import { burstPoint, flown, strikeOffset, type Stage } from "./spotlight-stage.ts";
import type { TableTokens } from "./tokens.ts";

// The height of the medallion pill (pt, Medium's).
const PILL_H = 34;

/** Which of an attack's cards this is: it decides how the frame moves it. */
export type Role = "attacker" | "target" | "shadow";

/**
 * A card between its slot and the stage: it flies out, the attacker draws back and lunges, the target shakes and falls, and a
 * shadow card turns over. `rect` is where it stands on the stage and `turn` its fan turn; `children` draw it there.
 */
export function FlyingCard({ spot, rect, turn, role, stage, frame, children }: { spot: SpotCard; rect: Rect; turn: number; role: Role; stage: Stage; frame: SharedValue<Frame>; children: ReactNode }) {
  const origin = vec(rect.x + rect.w / 2, rect.y + rect.h / 2);
  const transform = useDerivedValue(() => {
    const f = frame.get();
    const p = flown(spot.from, spot.turn, rect, turn, role === "target" ? f.flyTarget : f.flyAttackers);
    const dx = role === "attacker" ? strikeOffset(stage, f) : role === "target" ? f.knock * stage.knock : 0;
    const flip = role === "shadow" ? Math.abs(Math.cos(f.flipAngle)) : 1;
    return [{ translateX: p.tx + dx }, { translateY: p.ty }, { rotate: p.turn + (role === "attacker" ? f.tilt : 0) }, { scale: p.scale }, { scaleX: flip }];
  });
  const opacity = useDerivedValue(() => (role === "target" ? 1 - frame.get().dissolve : 1));
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      {children}
    </Group>
  );
}

/** A picture of a card on the stage at `rect`: the card as the table draws it, nothing on it (no tokens, no pills). */
export function StageCard({ spot, rect, image, name, sphere, fonts, backs, t, s, faceDown = false }: { spot: SpotCard; rect: Rect; image: SkImage | null; name: string; sphere: IconName | null; fonts: Fonts; backs: BackImages; t: TableTokens; s: number; faceDown?: boolean }) {
  const slot = { ...rect, id: spot.id, code: spot.code, zone: "play" as const, kind: "card" as const, exhausted: false, faceDown, landscape: false, resources: 0, damage: 0, progress: 0, tilt: 0, count: 0, committed: false };
  return <CardBody slot={slot} image={image} name={name} sphere={sphere} fonts={fonts} encounterBack={faceDown} backs={backs} t={t} s={s} />;
}

/** The night veil over a destroyed target, growing to 50% as it burns (the fallback when the burn shader does not compile). */
export function Veil({ rect, frame, t, s }: { rect: Rect; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => 0.5 * frame.get().dissolve);
  return <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={cardCorner(rect.w, rect.h)} color={t.night} opacity={opacity} />;
}

/** A big pill under a group: the stat's icon and its number in Cinzel Bold. The defense pill bounces when the attack is blocked. */
export function Pill({ at, icon, color, text, font, frame, t, s, badge }: { at: { cx: number; cy: number }; icon: IconName; color: string; text: string; font: SkFont; frame: SharedValue<Frame>; t: TableTokens; s: number; badge: "badgeA" | "badgeD" }) {
  const height = PILL_H * s;
  const width = (12 + 20 + 6 + 12) * s + font.getTextWidth(text);
  const left = at.cx - width / 2;
  const top = at.cy - height / 2;
  const opacity = useDerivedValue(() => Math.min(1, frame.get()[badge]));
  const transform = useDerivedValue(() => [{ scale: frame.get()[badge] }]);
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <RoundedRect x={left} y={top} width={width} height={height} r={height / 2} color={t.night} />
      <RoundedRect x={left} y={top} width={width} height={height} r={height / 2} color={color} style="stroke" strokeWidth={1.5 * s} />
      <CanvasIcon name={icon} x={left + 12 * s} y={at.cy - 10 * s} size={20 * s} color={color} />
      <Text x={left + (12 + 20 + 6) * s} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/** A small night chip with a hairline, like the pills, with a word on it ("+2" for the attackers past the fan, over card art), centered at `at`. */
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

/** A small word under a pill ("Blocked"), centered at `at`. */
export function Word({ at, text, font, t, color = t.bone, opacity }: { at: { cx: number; cy: number }; text: string; font: SkFont; t: TableTokens; color?: string; opacity: SharedValue<number> | number }) {
  return <Text x={at.cx - font.getTextWidth(text) / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={color} opacity={opacity} />;
}

/**
 * The damage token in the target's corner with its count: the count before the attack until the last token lands, then the new count,
 * popping as the table's tokens do (token-fx.ts). It is drawn in the target's own group, so it shakes and falls with it.
 */
export function Corner({ stage, before, after, image, font, frame, t, s }: { stage: Stage; before: number; after: number; image: SkImage | null; font: SkFont; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const { cx, cy } = stage.corner;
  const size = stage.token;
  const pop = useDerivedValue(() => [{ scale: frame.get().pop }]);
  const old = useDerivedValue(() => (frame.get().landed ? 0 : 1));
  const now = useDerivedValue(() => (frame.get().landed ? 1 : 0));
  const shown = useDerivedValue(() => (before > 0 || frame.get().landed ? 1 : 0));
  return (
    <Group transform={pop} origin={vec(cx, cy)} opacity={shown}>
      {image ? <Image image={image} x={cx - size / 2} y={cy - size / 2} width={size} height={size} fit="contain" /> : <Circle cx={cx} cy={cy} r={size / 2} color={t.threat} />}
      <Group opacity={old}>
        <Outlined x={cx} y={cy + font.getSize() * 0.35} text={String(before)} font={font} t={t} s={s} />
      </Group>
      <Group opacity={now}>
        <Outlined x={cx} y={cy + font.getSize() * 0.35} text={String(after)} font={font} t={t} s={s} />
      </Group>
    </Group>
  );
}

/** One damage token on its way from the point of contact to the target's corner. */
export function BurstToken({ stage, index, count, now, k, place, image, t, s }: { stage: Stage; index: number; count: number; now: SharedValue<number>; k: number; place: Place; image: SkImage | null; t: TableTokens; s: number }) {
  const size = stage.token;
  const flight = useDerivedValue(() => burstAt(index, count, now.get(), k, place));
  const transform = useDerivedValue(() => {
    const p = burstPoint(stage, index, count, flight.get().u, s);
    return [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }];
  });
  const opacity = useDerivedValue(() => (flight.get().flying ? burstPoint(stage, index, count, flight.get().u, s).opacity : 0));
  return (
    <Group transform={transform} opacity={opacity}>
      {image ? <Image image={image} x={-size / 2} y={-size / 2} width={size} height={size} fit="contain" /> : <Circle cx={0} cy={0} r={size / 2} color={t.threat} />}
    </Group>
  );
}
