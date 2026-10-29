// The cards of the combat spotlight's layer (spotlight.native.tsx; docs/design-system.md, Table, Spotlight): a card flying between its
// slot and the stage with an arc, the shadow card's perspective flip, the afterimages of the lunge, the damage token in the target's
// corner and a token in flight. Each reads the frame of its attack (spotlight-beats.ts) through a derived value, so the UI thread moves
// it and the canvas draws again only while it plays. The stage is in screen points already times the UI scale (spotlight-stage.ts).
import { Circle, Group, Image, RoundedRect, vec, type SkFont, type SkImage } from "@shopify/react-native-skia";
import type { ReactNode } from "react";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { cardCorner } from "./card-corner.ts";
import { CardBody, Outlined, type BackImages, type Fonts } from "./canvas-pieces.native.tsx";
import type { IconName } from "./icon-map.ts";
import type { Rect } from "./layout.ts";
import { burstAt, TRAIL, trailAt, type ClashShape, type Frame, type Place } from "./spotlight-beats.ts";
import { CARD, cardTransform, trailTransform, type Role } from "./spotlight-card.ts";
import type { SpotCard } from "./spotlight-plan.ts";
import { burstPoint, type Stage } from "./spotlight-stage.ts";
import type { TableTokens } from "./tokens.ts";

/**
 * A card between its slot and the stage: it arcs out, the attacker draws back, lunges and is thrown back if blocked, the target is
 * knocked back, and a shadow card turns over in perspective. `rect` is where it stands on the stage and `turn` its fan turn;
 * `children` draw it there. A burning target fades and drops here only when no burn shader runs (`fades`).
 */
export function FlyingCard({ spot, rect, turn, role, stage, frame, fades = false, s, children }: { spot: SpotCard; rect: Rect; turn: number; role: Role; stage: Stage; frame: SharedValue<Frame>; fades?: boolean; s: number; children: ReactNode }) {
  const origin = vec(rect.x + rect.w / 2, rect.y + rect.h / 2);
  const fall = fades ? CARD.fall * s : 0;
  const transform = useDerivedValue(() => cardTransform(role, spot.from, spot.turn, rect, turn, stage, frame.get(), fall));
  const opacity = useDerivedValue(() => (fades ? 1 - frame.get().dissolve : 1));
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
export function Veil({ rect, frame, t }: { rect: Rect; frame: SharedValue<Frame>; t: TableTokens }) {
  const opacity = useDerivedValue(() => 0.5 * frame.get().dissolve);
  return <RoundedRect x={rect.x} y={rect.y} width={rect.w} height={rect.h} r={cardCorner(rect.w, rect.h)} color={t.night} opacity={opacity} />;
}

/**
 * The afterimages of the front attacker during the lunge: `TRAIL` copies, copy `j` posed where the same clock read it `j` trail
 * steps ago (spotlight-beats.ts, trailAt), each fainter than the one before; they show only during the lunge.
 */
export function Trail({ rect, turn, stage, shape, now, k, children }: { rect: Rect; turn: number; stage: Stage; shape: ClashShape; now: SharedValue<number>; k: number; children: ReactNode }) {
  const origin = vec(rect.x + rect.w / 2, rect.y + rect.h / 2);
  return (
    <>
      {Array.from({ length: TRAIL }, (_, at) => (
        <TrailCopy key={at} j={at + 1} origin={origin} turn={turn} stage={stage} shape={shape} now={now} k={k}>
          {children}
        </TrailCopy>
      ))}
    </>
  );
}

function TrailCopy({ j, origin, turn, stage, shape, now, k, children }: { j: number; origin: { x: number; y: number }; turn: number; stage: Stage; shape: ClashShape; now: SharedValue<number>; k: number; children: ReactNode }) {
  const then = useDerivedValue(() => trailAt(shape, now.get(), k, j));
  const transform = useDerivedValue(() => trailTransform(stage, turn, then.get()));
  const opacity = useDerivedValue(() => then.get().alpha);
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      {children}
    </Group>
  );
}

/**
 * The damage token in the target's corner with its count: the count before the attack until the last token lands, then the new count,
 * popping as the table's tokens do (token-fx.ts). It is drawn in the target's own group, so it shakes and burns with it.
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
