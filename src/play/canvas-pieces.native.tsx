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
import type { CardSlot, CombatMark } from "./layout.ts";
import type { Ghost, Motion } from "./motion.ts";
import { tableTokens as t } from "./tokens.ts";
import { wrapName } from "./wrap.ts";

export const RADIUS = 6;
const LINE = 14;
const INACTIVE = "Inactive";
const TOKEN = 18;
const BADGE_H = 14;

// Translucent night, from the token, so the palette drift test covers the canvas's veils too.
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
const veil = withAlpha(t.night, 0.62);
const shadowColor = withAlpha(t.night, 0.5);
const strip = withAlpha(t.night, 0.72);
const glow = withAlpha(t.gold, 0.55);

export type Fonts = { names: SkFont; numbers: SkFont; small: SkFont };
export type TokenImages = { resource: SkImage | null; damage: SkImage | null; progress: SkImage | null };

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

/** The token art on a card, each with its count: resources bottom left, damage top right, progress bottom right. */
export function Tokens({ slot, images, fonts }: { slot: CardSlot; images: TokenImages; fonts: Fonts }) {
  const { x, y, w, h } = slot;
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
 * The effects on a card, along its top edge: each changed number as its icon and the change ("+2"), gold when raised and
 * red when lowered, then each "cannot" as its icon struck through. A committed character shows its willpower at the foot.
 */
export function Badges({ slot, effects, willpower, questPoints, fonts }: { slot: CardSlot; effects: CardEffects; willpower: number | null; questPoints: number | null; fonts: Fonts }) {
  const { x, y, w, h } = slot;
  let at = x + 2;
  const pills: ReactElement[] = [];
  for (const badge of effects.stats) {
    const text = `${badge.delta > 0 ? "+" : ""}${badge.delta}`;
    const width = 12 + fonts.small.getTextWidth(text) + 4;
    const up = badge.delta > 0;
    pills.push(
      <Group key={`s${badge.stat}`}>
        <RoundedRect x={at} y={y + 2} width={width} height={BADGE_H} r={BADGE_H / 2} color={up ? t.gold : t.threat} />
        <CanvasIcon name={badge.icon} x={at + 2} y={y + 4} size={10} color={up ? t.onGold : t.bone} />
        <Text x={at + 13} y={y + 13} text={text} font={fonts.small} color={up ? t.onGold : t.bone} />
      </Group>,
    );
    at += width + 2;
  }
  for (const flag of effects.flags) {
    pills.push(
      <Group key={`f${flag.flag}`}>
        <Circle cx={at + BADGE_H / 2} cy={y + 2 + BADGE_H / 2} r={BADGE_H / 2} color={t.night} />
        <CanvasIcon name={flag.icon} x={at + 2} y={y + 4} size={10} color={t.danger} />
        <Line p1={vec(at + 2, y + 4)} p2={vec(at + BADGE_H - 2, y + BADGE_H)} color={t.danger} strokeWidth={1.5} />
      </Group>,
    );
    at += BADGE_H + 2;
  }
  return (
    <Group clip={{ x, y, width: w, height: h }}>
      {pills}
      {slot.committed && willpower != null ? (
        <Group>
          <RoundedRect x={x + w / 2 - 15} y={y + h - BADGE_H - 3} width={30} height={BADGE_H} r={BADGE_H / 2} color={t.gold} />
          <CanvasIcon name="willpower" x={x + w / 2 - 12} y={y + h - BADGE_H - 1} size={10} color={t.onGold} />
          <Text x={x + w / 2 + 1} y={y + h - 6} text={String(willpower)} font={fonts.small} color={t.onGold} />
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
 * The open moment's marks on a card: a gold glow on a card a tap does something with, a gold edge and a ring on a picked
 * card, and the share a payment or archery gives it.
 */
export function Marks({ slot, tappable, picked, share, fonts }: { slot: CardSlot; tappable: boolean; picked: number; share: "pay" | "damage" | null; fonts: Fonts }) {
  const { x, y, w, h } = slot;
  if (!tappable && picked === 0) return null;
  return (
    <Group>
      {picked > 0 ? (
        <Group>
          <RoundedRect x={x - 1} y={y - 1} width={w + 2} height={h + 2} r={RADIUS + 1} color={t.gold} style="stroke" strokeWidth={3} />
          <Circle cx={x + w - 4} cy={y + 4} r={9} color={share === "damage" ? t.threat : t.gold} />
          {share ? (
            <Text x={x + w - 4 - fonts.small.getTextWidth(`${share === "pay" ? "-" : "+"}${picked}`) / 2} y={y + 8} text={`${share === "pay" ? "-" : "+"}${picked}`} font={fonts.small} color={share === "damage" ? t.bone : t.onGold} />
          ) : (
            // A check, drawn: the system face may not have the glyph.
            <Group>
              <Line p1={vec(x + w - 8, y + 4)} p2={vec(x + w - 5, y + 7)} color={t.onGold} strokeWidth={2} />
              <Line p1={vec(x + w - 5, y + 7)} p2={vec(x + w, y + 1)} color={t.onGold} strokeWidth={2} />
            </Group>
          )}
        </Group>
      ) : (
        <RoundedRect x={x - 1} y={y - 1} width={w + 2} height={h + 2} r={RADIUS + 1} color={glow} style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
}

/** The mark between an engaged enemy and the characters fighting it: a defense, an undefended hit, an attack. */
export function CombatMarkView({ mark }: { mark: CombatMark }) {
  const icon: IconName = mark.kind === "attack" ? "attack" : mark.kind === "defense" ? "defense" : "attack";
  const color = mark.kind === "undefended" ? t.threat : t.gold;
  return (
    <Group>
      <Circle cx={mark.x} cy={mark.y} r={8} color={t.night} />
      <Circle cx={mark.x} cy={mark.y} r={8} color={color} style="stroke" strokeWidth={1.5} />
      <CanvasIcon name={icon} x={mark.x - 5} y={mark.y - 5} size={10} color={color} />
    </Group>
  );
}

/**
 * A slot moving into place: at `progress` 0 it is where its motion starts, at 1 where the layout puts it. `epoch` guards the
 * first frame of a new layout: until the UI thread has the new epoch, the slot is drawn where it starts, not where it ends.
 */
export function Moving({ slot, motion, progress, epoch, at, children }: { slot: CardSlot; motion: Motion; progress: SharedValue<number>; epoch: SharedValue<number>; at: number; children: ReactNode }) {
  const origin = vec(slot.x + slot.w / 2, slot.y + slot.h / 2);
  const transform = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    const q = 1 - p;
    return [{ translateX: motion.dx * q }, { translateY: motion.dy * q }, { scale: 1 + (motion.scale - 1) * q }, { rotate: motion.toRot + (motion.fromRot - motion.toRot) * q }];
  }, [motion, at]);
  const opacity = useDerivedValue(() => {
    const p = epoch.get() === at ? progress.get() : 0;
    return motion.fromOpacity + (1 - motion.fromOpacity) * p;
  }, [motion, at]);
  return (
    <Group transform={transform} origin={origin} opacity={opacity}>
      {children}
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
