// The pieces the table canvas draws: a card (its picture, or its name while the file is missing, or its back), a pile, the
// token art on a card, the effects on it, the marks of the open moment, and the mark between an enemy and the characters
// fighting it. Each is a Skia group at a slot's rectangle; table-canvas.native.tsx places and moves them.
import { Circle, DashPathEffect, Group, Image, Line, Path, RoundedRect, Text, type SkFont, type SkImage, vec } from "@shopify/react-native-skia";
import type { ReactElement, ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import type { CardEffects } from "./card-effects.ts";
import { SPHERE_TINT, type IconName } from "./icon-map.ts";
import { ICONS } from "./icons/generated.ts";
import type { CardSlot, CombatMark, Rect } from "./layout.ts";
import type { Ghost, Motion } from "./motion.ts";
import { tableTokens as t } from "./tokens.ts";
import { wrapName } from "./wrap.ts";

export const RADIUS = 6;
const LINE = 14;
const INACTIVE = "Inactive";
const TOKEN = 18;
const BADGE_H = 15;

// Translucent night, from the token, so the palette drift test covers the canvas's veils too.
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
const veil = withAlpha(t.night, 0.62);
const shadowColor = withAlpha(t.night, 0.5);
const strip = withAlpha(t.night, 0.72);
const dim = withAlpha(t.night, 0.45);

export type Fonts = { names: SkFont; numbers: SkFont; small: SkFont; badge: SkFont };
export type TokenImages = { resource: SkImage | null; damage: SkImage | null; progress: SkImage | null; questPoints: SkImage | null; engagementCost: SkImage | null };

// A badge's icon: the vector glyph tinted, or the token art of quest points and engagement cost as printed.
function BadgeIcon({ name, x, y, size, color, images }: { name: IconName; x: number; y: number; size: number; color: string; images: TokenImages }) {
  const raster = name === "questPoints" ? images.questPoints : name === "engagementCost" ? images.engagementCost : null;
  if (raster) return <Image image={raster} x={x} y={y} width={size} height={size} fit="contain" />;
  return <CanvasIcon name={name} x={x} y={y} size={size} color={color} />;
}

// A game icon on the canvas: the vector glyph from ./icons/generated.ts, drawn as a Skia path, flipped from the font's
// y-up units into the box (x, y, size) and filled with one colour. A raster icon (quest points) is drawn by its caller.
export function CanvasIcon({ name, x, y, size, color }: { name: IconName; x: number; y: number; size: number; color: string }) {
  const icon = ICONS[name];
  if (icon.kind !== "vector") return null;
  const [vx, vy, vw, vh] = icon.viewBox;
  const scale = size / Math.max(vw, vh);
  return (
    <Group transform={[{ translateX: x - vx * scale }, { translateY: y - vy * scale }, { scaleX: scale }, { scaleY: -scale }]}>
      <Path path={icon.d} color={color} />
    </Group>
  );
}

// A number that stays readable on any token art or picture: a night outline under a bone fill.
function Outlined({ x, y, text, font, color = t.bone }: { x: number; y: number; text: string; font: SkFont; color?: string }) {
  const width = font.getTextWidth(text);
  return (
    <Group>
      <Text x={x - width / 2} y={y} text={text} font={font} color={t.night} style="stroke" strokeWidth={3} />
      <Text x={x - width / 2} y={y} text={text} font={font} color={color} />
    </Group>
  );
}

// The veil over unique text with no effect record, with the word that says what it means.
function Veil({ x, y, w, h, font }: { x: number; y: number; w: number; h: number; font: SkFont }) {
  const top = y + h * 0.55;
  const width = font.getTextWidth(INACTIVE);
  return (
    <Group>
      <RoundedRect x={x} y={top} width={w} height={h * 0.45} r={0} color={veil} />
      <Text x={x + Math.max(3, (w - width) / 2)} y={top + 14} text={INACTIVE} font={font} color={t.bone} />
    </Group>
  );
}

// A card back: the player's is raised night with the gold ring, the encounter deck's is night with a threat-red ring.
function Back({ x, y, w, h, encounter }: { x: number; y: number; w: number; h: number; encounter: boolean }) {
  return (
    <Group>
      <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={encounter ? t.night : t.raised} />
      <RoundedRect x={x + 2} y={y + 2} width={w - 4} height={h - 4} r={RADIUS - 2} color={encounter ? t.threat : t.goldLine} style="stroke" strokeWidth={1} />
      <Circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 4} color={encounter ? t.threat : t.gold} style="stroke" strokeWidth={2} />
    </Group>
  );
}

/** One card at its slot, upright: its picture, its name on raised night while the file is missing, or its back. */
export function CardBody({
  slot,
  image,
  name,
  sphere,
  fonts,
  inactive,
  encounterBack,
}: {
  slot: CardSlot;
  image: SkImage | null;
  name: string;
  sphere: IconName | null;
  fonts: Fonts;
  inactive: boolean;
  encounterBack: boolean;
}) {
  const { x, y, w, h } = slot;
  return (
    <Group>
      <RoundedRect x={x + 1} y={y + 2} width={w} height={h} r={RADIUS} color={shadowColor} />
      {slot.faceDown ? (
        <Back x={x} y={y} w={w} h={h} encounter={encounterBack} />
      ) : image ? (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: RADIUS, ry: RADIUS }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" />
          {/* Unique text with no effect record is inactive: the text box is veiled, and no control applies it. */}
          {inactive ? <Veil x={x} y={y} w={w} h={h} font={fonts.small} /> : null}
        </Group>
      ) : (
        <Group>
          <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={t.raised} />
          <Group clip={{ x: x + 3, y: y + 3, width: w - 6, height: h - 6 }}>
            {wrapName(name, w - 10, (text) => fonts.names.getTextWidth(text)).map((line, index) => (
              <Text key={index} x={x + 5} y={y + 15 + index * LINE} text={line} font={fonts.names} color={t.bone} />
            ))}
          </Group>
          {sphere ? <CanvasIcon name={sphere} x={x + w - 16} y={y + h - 16} size={12} color={t[SPHERE_TINT[sphere] ?? "faint"]} /> : null}
          {inactive ? <Veil x={x} y={y} w={w} h={h} font={fonts.small} /> : null}
        </Group>
      )}
    </Group>
  );
}

const PILE_WORD: Readonly<Record<string, string>> = { deck: "Deck", discard: "Discard", encounterDeck: "Encounter", encounterDiscard: "Discard" };

/** A pile: a stack of backs (or the top card of a discard pile) with its count, or a dashed outline while it is empty. */
export function Pile({ slot, image, fonts, label }: { slot: CardSlot; image: SkImage | null; fonts: Fonts; label: boolean }) {
  const { x, y, w, h } = slot;
  const encounter = slot.zone === "encounterDeck" || slot.zone === "encounterDiscard";
  const word = PILE_WORD[slot.zone] ?? "";
  if (slot.count === 0) {
    return (
      <Group>
        <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={t.hairline} style="stroke" strokeWidth={1}>
          <DashPathEffect intervals={[4, 4]} />
        </RoundedRect>
        {label ? <Text x={x + (w - fonts.small.getTextWidth(word)) / 2} y={y + h / 2 + 4} text={word} font={fonts.small} color={t.faint} /> : null}
      </Group>
    );
  }
  const depth = Math.min(3, Math.ceil(slot.count / 10));
  return (
    <Group>
      {Array.from({ length: depth }, (_, index) => (
        <RoundedRect key={index} x={x + (depth - index) * 1.5} y={y + (depth - index) * 1.5} width={w} height={h} r={RADIUS} color={encounter ? t.night : t.raised} />
      ))}
      {slot.faceDown || !image ? (
        <Back x={x} y={y} w={w} h={h} encounter={encounter} />
      ) : (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: RADIUS, ry: RADIUS }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" />
        </Group>
      )}
      <RoundedRect x={x} y={y + h - 15} width={w} height={15} r={0} color={strip} />
      <Outlined x={x + w / 2} y={y + h - 3} text={String(slot.count)} font={fonts.numbers} />
      {label ? <Text x={x + (w - fonts.small.getTextWidth(word)) / 2} y={y + h + 11} text={word} font={fonts.small} color={t.muted} /> : null}
    </Group>
  );
}

/**
 * The token art on a card, each with its count: resources bottom left, damage top right, progress bottom right. `rect` is
 * the card's rectangle on screen, so the tokens of an exhausted card stay upright in its sideways footprint.
 */
export function Tokens({ slot, rect, images, fonts }: { slot: CardSlot; rect: Rect; images: TokenImages; fonts: Fonts }) {
  const { x, y, w, h } = rect;
  const items: { image: SkImage | null; value: number; cx: number; cy: number; fallback: string }[] = [];
  if (slot.resources > 0) items.push({ image: images.resource, value: slot.resources, cx: x + TOKEN / 2 + 1, cy: y + h - TOKEN / 2 - 1, fallback: t.gold });
  if (slot.damage > 0) items.push({ image: images.damage, value: slot.damage, cx: x + w - TOKEN / 2 - 1, cy: y + TOKEN / 2 + 1, fallback: t.threat });
  if (slot.progress > 0) items.push({ image: images.progress, value: slot.progress, cx: x + w - TOKEN / 2 - 1, cy: y + h - TOKEN / 2 - 1, fallback: t.bone });
  return (
    <Group>
      {items.map((item, index) => (
        <Group key={index}>
          {item.image ? (
            <Image image={item.image} x={item.cx - TOKEN / 2} y={item.cy - TOKEN / 2} width={TOKEN} height={TOKEN} fit="contain" />
          ) : (
            <Circle cx={item.cx} cy={item.cy} r={TOKEN / 2} color={item.fallback} />
          )}
          <Outlined x={item.cx} y={item.cy + 4} text={String(item.value)} font={fonts.numbers} />
        </Group>
      ))}
    </Group>
  );
}

/**
 * The effects on a card, stacked down its left edge under the top: each changed number as its icon and the change ("+2"),
 * a gold pill when raised and a night pill with danger text when lowered; each "cannot" as its icon struck through; "+n" when
 * more do not fit. A committed character shows its willpower at the foot, a quest stage or location its progress. `rect` is
 * upright on screen, so an exhausted card's numbers read the right way.
 */
export function Badges({ slot, rect, effects, willpower, questPoints, fonts, images }: { slot: CardSlot; rect: Rect; effects: CardEffects; willpower: number | null; questPoints: number | null; fonts: Fonts; images: TokenImages }) {
  const { x, y, w, h } = rect;
  // Rows that fit between the top edge and the resource token at the bottom left.
  const room = Math.max(1, Math.floor((h - TOKEN - 6) / (BADGE_H + 2)));
  const items = [...effects.stats.map((badge) => ({ kind: "stat" as const, badge })), ...effects.flags.map((flag) => ({ kind: "flag" as const, flag }))];
  const shown = items.length > room ? items.slice(0, room - 1) : items;
  const hidden = items.length - shown.length;
  const rows: ReactElement[] = shown.map((item, index) => {
    const top = y + 3 + index * (BADGE_H + 2);
    if (item.kind === "flag") {
      return (
        <Group key={`f${item.flag.flag}`}>
          <RoundedRect x={x + 2} y={top} width={BADGE_H + 4} height={BADGE_H} r={BADGE_H / 2} color={t.night} />
          <BadgeIcon name={item.flag.icon} x={x + 5} y={top + 2} size={11} color={t.danger} images={images} />
          <Line p1={vec(x + 4, top + 2)} p2={vec(x + BADGE_H + 2, top + BADGE_H - 2)} color={t.danger} strokeWidth={1.5} />
        </Group>
      );
    }
    const { badge } = item;
    const up = badge.delta > 0;
    const text = `${up ? "+" : "-"}${Math.abs(badge.delta)}`;
    const width = 15 + fonts.badge.getTextWidth(text) + 5;
    return (
      <Group key={`s${badge.stat}`}>
        <RoundedRect x={x + 2} y={top} width={width} height={BADGE_H} r={BADGE_H / 2} color={up ? t.gold : t.night} />
        {up ? null : <RoundedRect x={x + 2} y={top} width={width} height={BADGE_H} r={BADGE_H / 2} color={t.danger} style="stroke" strokeWidth={1} />}
        <BadgeIcon name={badge.icon} x={x + 5} y={top + 2} size={11} color={up ? t.onGold : t.danger} images={images} />
        <Text x={x + 18} y={top + 11.5} text={text} font={fonts.badge} color={up ? t.onGold : t.danger} />
      </Group>
    );
  });
  if (hidden > 0) {
    const top = y + 3 + shown.length * (BADGE_H + 2);
    rows.push(
      <Group key="more">
        <RoundedRect x={x + 2} y={top} width={24} height={BADGE_H} r={BADGE_H / 2} color={t.night} />
        <Text x={x + 6} y={top + 11.5} text={`+${hidden}`} font={fonts.badge} color={t.bone} />
      </Group>,
    );
  }
  return (
    <Group>
      {rows}
      {slot.committed && willpower != null ? (
        <Group>
          <RoundedRect x={x + w / 2 - 16} y={y + h - BADGE_H - 3} width={32} height={BADGE_H} r={BADGE_H / 2} color={t.gold} />
          <CanvasIcon name="willpower" x={x + w / 2 - 13} y={y + h - BADGE_H - 1} size={11} color={t.onGold} />
          <Text x={x + w / 2 + 1} y={y + h - 6.5} text={String(willpower)} font={fonts.badge} color={t.onGold} />
        </Group>
      ) : null}
      {questPoints != null ? (
        <Group>
          <RoundedRect x={x} y={y + h - 15} width={w} height={15} r={0} color={strip} />
          <Outlined x={x + w / 2} y={y + h - 3} text={`${slot.progress} / ${questPoints}`} font={fonts.numbers} />
        </Group>
      ) : null}
    </Group>
  );
}

/**
 * The open moment's marks on a card, on its upright rectangle: a solid gold edge on a card a tap does something with, a
 * thicker edge and a ring at its center on a picked card (the share a payment or archery gives it in the ring), and a night
 * veil over a card the open pick does not ask about.
 */
export function Marks({ rect, tappable, picked, share, dimmed, fonts }: { rect: Rect; tappable: boolean; picked: number; share: "pay" | "damage" | null; dimmed: boolean; fonts: Fonts }) {
  const { x, y, w, h } = rect;
  if (dimmed) return <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={dim} />;
  if (!tappable && picked === 0) return null;
  if (picked === 0) return <RoundedRect x={x + 1} y={y + 1} width={w - 2} height={h - 2} r={RADIUS} color={t.gold} style="stroke" strokeWidth={2} />;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const text = share ? `${share === "pay" ? "-" : "+"}${picked}` : "";
  return (
    <Group>
      <RoundedRect x={x - 1} y={y - 1} width={w + 2} height={h + 2} r={RADIUS + 1} color={t.gold} style="stroke" strokeWidth={3} />
      <Circle cx={cx} cy={cy} r={11} color={share === "damage" ? t.threat : t.gold} />
      {share ? (
        <Text x={cx - fonts.badge.getTextWidth(text) / 2} y={cy + 4} text={text} font={fonts.badge} color={share === "damage" ? t.bone : t.onGold} />
      ) : (
        // A check, drawn: the system face may not have the glyph.
        <Group>
          <Line p1={vec(cx - 5, cy)} p2={vec(cx - 1, cy + 4)} color={t.onGold} strokeWidth={2.5} />
          <Line p1={vec(cx - 1, cy + 4)} p2={vec(cx + 6, cy - 4)} color={t.onGold} strokeWidth={2.5} />
        </Group>
      )}
    </Group>
  );
}

/** The enemy whose attack is in progress: a threat-red edge and its attack icon at its side. */
export function AttackerMark({ rect }: { rect: Rect }) {
  const { x, y, w, h } = rect;
  return (
    <Group>
      <RoundedRect x={x - 1} y={y - 1} width={w + 2} height={h + 2} r={RADIUS + 1} color={t.threat} style="stroke" strokeWidth={3} />
      <Circle cx={x + w} cy={y + h / 2} r={9} color={t.night} />
      <Circle cx={x + w} cy={y + h / 2} r={9} color={t.threat} style="stroke" strokeWidth={1.5} />
      <CanvasIcon name="attack" x={x + w - 6} y={y + h / 2 - 6} size={12} color={t.threat} />
    </Group>
  );
}

/**
 * The mark between an engaged enemy and the characters fighting it: a defense, an undefended hit, an attack. A fight picked
 * but not confirmed yet is drawn fainter.
 */
export function CombatMarkView({ mark }: { mark: CombatMark }) {
  const icon: IconName = mark.kind === "defense" ? "defense" : "attack";
  const color = mark.kind === "undefended" ? t.threat : t.gold;
  return (
    <Group opacity={mark.preview ? 0.7 : 1}>
      <Circle cx={mark.x} cy={mark.y} r={8} color={t.night} />
      <Circle cx={mark.x} cy={mark.y} r={8} color={color} style="stroke" strokeWidth={1.5} />
      <CanvasIcon name={icon} x={mark.x - 5} y={mark.y - 5} size={10} color={color} />
    </Group>
  );
}

/**
 * A slot moving into place: at `progress` 0 it is where its motion starts, at 1 where the layout puts it. `epoch` guards the
 * first frame of a new layout: until the UI thread has the new epoch, the slot is drawn where it starts, not where it ends.
 * The card itself turns (exhausted, the hand's fan); `overlay` (tokens, effects, marks) moves with it but stays upright.
 */
export function Moving({ slot, motion, progress, epoch, at, children, overlay }: { slot: CardSlot; motion: Motion; progress: SharedValue<number>; epoch: SharedValue<number>; at: number; children: ReactNode; overlay?: ReactNode }) {
  const origin = vec(slot.x + slot.w / 2, slot.y + slot.h / 2);
  const transform = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    const q = 1 - p;
    return [{ translateX: motion.dx * q }, { translateY: motion.dy * q }, { scale: 1 + (motion.scale - 1) * q }];
  }, [motion, at]);
  const turn = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    return [{ rotate: motion.toRot + (motion.fromRot - motion.toRot) * (1 - p) }];
  }, [motion, at]);
  const opacity = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    return motion.fromOpacity + (1 - motion.fromOpacity) * p;
  }, [motion, at]);
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      <Group transform={turn} origin={origin}>
        {children}
      </Group>
      {overlay}
    </Group>
  );
}

/** A card that left the table: it moves from where it was toward its pile, shrinking and fading. */
export function Leaving({ ghost, progress, epoch, at, children }: { ghost: Ghost; progress: SharedValue<number>; epoch: SharedValue<number>; at: number; children: ReactNode }) {
  const { slot } = ghost;
  const origin = vec(slot.x + slot.w / 2, slot.y + slot.h / 2);
  const transform = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    return [{ translateX: ghost.dx * p }, { translateY: ghost.dy * p }, { scale: 1 + (ghost.scale - 1) * p }, { rotate: ghost.rot }];
  }, [ghost, at]);
  const opacity = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    return Math.max(0, 1 - p * 1.1);
  }, [ghost, at]);
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      {children}
    </Group>
  );
}
