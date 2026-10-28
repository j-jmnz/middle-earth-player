// The pieces the table canvas draws: a card (its picture, or its name while the file is missing, or its printed back), a pile, the
// token art on a card, the effects on it, the marks of the open moment, and the mark between an enemy and the characters
// fighting it. Each is a Skia group at a slot's rectangle; table-canvas.native.tsx places and moves them.
import { Circle, DashPathEffect, Group, Image, Line, Path, RoundedRect, Text, type SkFont, type SkImage, vec } from "@shopify/react-native-skia";
import type { ReactElement } from "react";

import { badgeSplit, type CardEffects } from "./card-effects.ts";
import { SPHERE_TINT, type IconName } from "./icon-map.ts";
import { ICONS } from "./icons/generated.ts";
import type { CardSlot, CombatMark, Rect } from "./layout.ts";
import type { OptionMark } from "./sheet-types.ts";
import { TOKEN, tokenSpot } from "./token-spots.ts";
import { tableTokens as t } from "./tokens.ts";
import { wrapName } from "./wrap.ts";

export const RADIUS = 6;
const LINE = 14;
const BADGE_H = 15;

// Translucent night, from the token, so the palette drift test covers the canvas's veils too.
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
const shadowColor = withAlpha(t.night, 0.5);
const strip = withAlpha(t.night, 0.72);

export type Fonts = { names: SkFont; numbers: SkFont; small: SkFont; badge: SkFont };
export type TokenImages = { resource: SkImage | null; damage: SkImage | null; progress: SkImage | null; questPoints: SkImage | null; engagementCost: SkImage | null };
// The printed card backs (src/play/icons, CARD_BACKS), null while the file decodes.
export type BackImages = { player: SkImage | null; encounter: SkImage | null };

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
export function Outlined({ x, y, text, font, color = t.bone, heavy = false }: { x: number; y: number; text: string; font: SkFont; color?: string; heavy?: boolean }) {
  const width = font.getTextWidth(text);
  return (
    <Group>
      <Text x={x - width / 2} y={y} text={text} font={font} color={t.night} style="stroke" strokeWidth={heavy ? 4.5 : 3} />
      <Text x={x - width / 2} y={y} text={text} font={font} color={color} />
    </Group>
  );
}

/**
 * A card with printed text the app does not apply (src/catalog/active-text.ts): a small faint mark at its right edge, upright
 * like the tokens, on a corner no token, effect pill or other mark uses: a ring struck through. Never a band over the picture
 * and never a word on the canvas; the preview lists the lines (docs/plans/inactive-text.md). Not gold, which marks the one
 * action, and not danger, which marks a refusal.
 */
export function NotAppliedMark({ rect }: { rect: Rect }) {
  // At the right edge, just under the damage token's corner; the delayed effect's clock goes under it.
  const cx = rect.x + rect.w - 8;
  const cy = rect.y + TOKEN + 3 + 6.5;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={6.5} color={t.night} />
      <Circle cx={cx} cy={cy} r={4.5} color={t.faint} style="stroke" strokeWidth={1.5} />
      <Line p1={vec(cx - 3.2, cy + 3.2)} p2={vec(cx + 3.2, cy - 3.2)} color={t.faint} strokeWidth={1.5} />
    </Group>
  );
}

/**
 * The facedown prisoner's back (01123:B:1): a small hero mark on a night disc in the middle of it, upright whatever the card does. Not gold, which marks
 * the one action, and not danger, which marks a refusal: bone, the colour of a card that is only held.
 */
export function HeldMark({ rect }: { rect: Rect }) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={12} color={t.night} />
      <Circle cx={cx} cy={cy} r={11} color={t.bone} style="stroke" strokeWidth={1.25} />
      <CanvasIcon name="hero" x={cx - 6} y={cy - 6} size={12} color={t.bone} />
    </Group>
  );
}

// A card back: the printed one, the One Ring for a player card and the Eye for an encounter card. While its file decodes,
// the player's is raised night with the gold ring, the encounter deck's night with a threat-red ring.
function Back({ x, y, w, h, encounter, backs }: { x: number; y: number; w: number; h: number; encounter: boolean; backs: BackImages }) {
  const image = encounter ? backs.encounter : backs.player;
  if (image) {
    return (
      <Group clip={{ rect: { x, y, width: w, height: h }, rx: RADIUS, ry: RADIUS }}>
        <Image image={image} x={x} y={y} width={w} height={h} fit="cover" />
      </Group>
    );
  }
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
  encounterBack,
  backs,
}: {
  slot: CardSlot;
  image: SkImage | null;
  name: string;
  sphere: IconName | null;
  fonts: Fonts;
  encounterBack: boolean;
  backs: BackImages;
}) {
  const { x, y, w, h } = slot;
  return (
    <Group>
      <RoundedRect x={x + 1} y={y + 2} width={w} height={h} r={RADIUS} color={shadowColor} />
      {slot.faceDown ? (
        <Back x={x} y={y} w={w} h={h} encounter={encounterBack} backs={backs} />
      ) : image ? (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: RADIUS, ry: RADIUS }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" />
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
        </Group>
      )}
    </Group>
  );
}

const PILE_WORD: Readonly<Record<string, string>> = { deck: "Deck", discard: "Discard", encounterDeck: "Encounter", encounterDiscard: "Discard" };

/** A pile: a stack of backs (or the top card of a discard pile) with its count, or a dashed outline while it is empty. */
export function Pile({ slot, image, name, fonts, label, backs }: { slot: CardSlot; image: SkImage | null; name: string; fonts: Fonts; label: boolean; backs: BackImages }) {
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
      {slot.faceDown ? (
        <Back x={x} y={y} w={w} h={h} encounter={encounter} backs={backs} />
      ) : image ? (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: RADIUS, ry: RADIUS }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" />
        </Group>
      ) : (
        // A face-up top whose file is missing shows its name, so a discard pile never looks like a deck.
        <Group>
          <RoundedRect x={x} y={y} width={w} height={h} r={RADIUS} color={t.raised} />
          <Group clip={{ x: x + 3, y: y + 3, width: w - 6, height: h - 21 }}>
            {wrapName(name, w - 10, (text) => fonts.names.getTextWidth(text)).map((line, index) => (
              <Text key={index} x={x + 5} y={y + 15 + index * LINE} text={line} font={fonts.names} color={t.bone} />
            ))}
          </Group>
        </Group>
      )}
      <RoundedRect x={x} y={y + h - 15} width={w} height={15} r={0} color={strip} />
      <Outlined x={x + w / 2} y={y + h - 3} text={String(slot.count)} font={fonts.numbers} />
      {/* Iron Shackles is attached to this deck (01105:A:1): two linked rings at the strip's left end. */}
      {slot.chained ? (
        <Group>
          <RoundedRect x={x + 3} y={y + h - 11} width={8} height={6} r={3} color={t.bone} style="stroke" strokeWidth={1.25} />
          <RoundedRect x={x + 8} y={y + h - 11} width={8} height={6} r={3} color={t.bone} style="stroke" strokeWidth={1.25} />
        </Group>
      ) : null}
      {label ? <Text x={x + (w - fonts.small.getTextWidth(word)) / 2} y={y + h + 11} text={word} font={fonts.small} color={t.muted} /> : null}
    </Group>
  );
}

/**
 * The token art on a card, each with its count: resources bottom left, damage top right, progress bottom right. `rect` is
 * the card's rectangle on screen, so the tokens of an exhausted card stay upright in its sideways footprint.
 */
export function Tokens({ slot, rect, images, fonts, ring = null, contrast = false }: { slot: CardSlot; rect: Rect; images: TokenImages; fonts: Fonts; ring?: string | null; contrast?: boolean }) {
  const items: { image: SkImage | null; value: number; cx: number; cy: number; fallback: string; ring: string | null }[] = [];
  if (slot.resources > 0) items.push({ image: images.resource, value: slot.resources, ...tokenSpot(rect, "resources"), fallback: t.gold, ring });
  if (slot.damage > 0) items.push({ image: images.damage, value: slot.damage, ...tokenSpot(rect, "damage"), fallback: t.threat, ring: null });
  if (slot.progress > 0) items.push({ image: images.progress, value: slot.progress, ...tokenSpot(rect, "progress"), fallback: t.bone, ring: null });
  return (
    <Group>
      {items.map((item, index) => (
        <Group key={index}>
          {item.image ? (
            <Image image={item.image} x={item.cx - TOKEN / 2} y={item.cy - TOKEN / 2} width={TOKEN} height={TOKEN} fit="contain" />
          ) : (
            <Circle cx={item.cx} cy={item.cy} r={TOKEN / 2} color={item.fallback} />
          )}
          {/* A hero's resources pay for its own sphere: the token is ringed in that sphere's colour. */}
          {item.ring ? <Circle cx={item.cx} cy={item.cy} r={TOKEN / 2 + 0.5} color={item.ring} style="stroke" strokeWidth={1.75} /> : null}
          <Outlined x={item.cx} y={item.cy + 4} text={String(item.value)} font={contrast ? fonts.badge : fonts.numbers} heavy={contrast} />
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
export function Badges({
  slot,
  rect,
  effects,
  willpower,
  questPoints,
  fonts,
  images,
  contrast = false,
}: {
  slot: CardSlot;
  rect: Rect;
  effects: CardEffects;
  willpower: number | null;
  questPoints: number | null;
  fonts: Fonts;
  images: TokenImages;
  // Strong outlines (table-settings.ts): each pill gets a bone edge, so it reads on any picture.
  contrast?: boolean;
}) {
  const { x, y, w, h } = rect;
  // Rows that fit between the top edge and the resource token at the bottom left.
  const room = Math.max(1, Math.floor((h - TOKEN - 6) / (BADGE_H + 2)));
  const items = [...effects.stats.map((badge) => ({ kind: "stat" as const, badge })), ...effects.flags.map((flag) => ({ kind: "flag" as const, flag }))];
  const { shown: count, hidden } = badgeSplit(items.length, room);
  const shown = items.slice(0, count);
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
        {contrast ? <RoundedRect x={x + 2} y={top} width={width} height={BADGE_H} r={BADGE_H / 2} color={up ? t.night : t.bone} style="stroke" strokeWidth={1.5} /> : null}
        {/* An effect that ends with the phase, the round or the attack: a dashed edge says it will go (the preview says when). */}
        {badge.lasting ? (
          <RoundedRect x={x + 1} y={top - 1} width={width + 2} height={BADGE_H + 2} r={BADGE_H / 2 + 1} color={up ? t.bone : t.danger} style="stroke" strokeWidth={1}>
            <DashPathEffect intervals={[2, 2]} />
          </RoundedRect>
        ) : null}
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
 * A number on a pill at a card's foot, upright like the tokens: the token art (or an icon) and the number, threat red with a
 * danger edge when `danger`, night with a hairline otherwise. `lift` raises it above the token row, clear of the resource
 * count a character may hold.
 */
function FootPill({ rect, image, icon, value, danger, lift, fonts }: { rect: Rect; image: SkImage | null; icon: IconName; value: number; danger: boolean; lift: boolean; fonts: Fonts }) {
  const { x, y, w, h } = rect;
  const text = String(value);
  const width = TOKEN + fonts.badge.getTextWidth(text) + 8;
  const left = x + (w - width) / 2;
  const top = y + h - TOKEN - 4 - (lift ? TOKEN + 2 : 0);
  return (
    <Group>
      <RoundedRect x={left} y={top} width={width} height={TOKEN} r={TOKEN / 2} color={danger ? t.threat : t.night} />
      <RoundedRect x={left} y={top} width={width} height={TOKEN} r={TOKEN / 2} color={danger ? t.danger : t.hairline} style="stroke" strokeWidth={1} />
      {image ? <Image image={image} x={left + 1} y={top + 1} width={TOKEN - 2} height={TOKEN - 2} fit="contain" /> : <CanvasIcon name={icon} x={left + 3} y={top + 3} size={TOKEN - 6} color={t.bone} />}
      <Text x={left + TOKEN + 2} y={top + TOKEN - 5} text={text} font={fonts.badge} color={t.bone} />
    </Group>
  );
}

/** A number the open pick draws on a card it asks about: the damage a defender would take, before the shadow card. */
export function OptionMarkView({ rect, mark, fonts, images }: { rect: Rect; mark: OptionMark; fonts: Fonts; images: TokenImages }) {
  return <FootPill rect={rect} image={mark.icon === "damage" ? images.damage : null} icon={mark.icon} value={mark.value} danger={mark.danger} lift fonts={fonts} />;
}

/** An enemy's engagement cost in staging: threat red when the shown seat's threat engages it at the checks (rr.engagement-check). */
export function EngagementMark({ rect, cost, engages, fonts, images }: { rect: Rect; cost: number; engages: boolean; fonts: Fonts; images: TokenImages }) {
  return <FootPill rect={rect} image={images.engagementCost} icon="threat" value={cost} danger={engages} lift={false} fonts={fonts} />;
}

/**
 * A card a delayed effect will act on (Sneak Attack's return): a small clock at the right edge, under the damage token and
 * the not-applied mark, clear of the effect pills down the left edge. The preview says what.
 */
export function DelayedMark({ rect }: { rect: Rect }) {
  const cx = rect.x + rect.w - 8;
  const cy = rect.y + TOKEN + 3 + 13 + 2 + 7;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={7} color={t.night} />
      <Circle cx={cx} cy={cy} r={7} color={t.gold} style="stroke" strokeWidth={1.5} />
      <Line p1={vec(cx, cy)} p2={vec(cx, cy - 4)} color={t.gold} strokeWidth={1.5} />
      <Line p1={vec(cx, cy)} p2={vec(cx + 3, cy)} color={t.gold} strokeWidth={1.5} />
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
