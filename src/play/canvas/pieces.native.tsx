// The pieces the table canvas draws: a card (its picture, or its name while the file is missing, or its printed back; a pile is
// pile-piece.native.tsx), the token art on a card and the effects on it. Each is a Skia group at a slot's rectangle;
// table-canvas.native.tsx places and moves them. The pills and marks over a card, and the mark between an enemy and the
// characters fighting it, are in mark-pieces.native.tsx.
import { Circle, DashPathEffect, FilterMode, Group, Image, Line, MipmapMode, Path, RoundedRect, Skia, Text, type SamplingOptions, type SkFont, type SkImage, type SkPath, vec } from "@shopify/react-native-skia";
import type { ReactElement } from "react";

import { cardCorner } from "../../ui/card-corner.ts";
import { chipText, moreText, MUST_COMMIT_WORD, type CardEffects } from "../cards/card-effects.ts";
import { SPHERE_TINT, type IconName } from "../../ui/icon-map.ts";
import { ICONS } from "../../ui/icons/generated.ts";
import type { CardSlot, Rect } from "../layout/layout.ts";
import { medallionAt } from "../layout/look-strip.ts";
import { medallionCount } from "../words/scenarios/sea.ts";
import { progressInStrip as progressInStripOf, stripText } from "./table-canvas-views.ts";
import { badgeLayout, badgeShown } from "./badge-room.ts";
import { TOKEN, tokenSpot } from "./token-spots.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";
import { wrapName } from "./wrap.ts";

// Medium's sizes in points. Every piece draws them times `s`, the UI scale (ui-scale.ts, user request, 2026-10-28), which the canvas root
// hands down as a prop beside the tokens `t`: a piece does not read the scale itself. A card's corner is the card screen's share of its
// shorter side (`cardCorner`, user request, 2026-10-29); `RADIUS` is left for the shapes that are not cards (a drop zone's outline).
export const RADIUS = 6;
export const LINE = 14;
export const BADGE_H = 15;
// A card picture is drawn at sizes other than its copy's (a hand card at rest is smaller than the scrub's lifted copy; a card moving
// grows and shrinks): linear filtering between mipmap levels, so it neither aliases when smaller nor blocks when larger.
export const PICTURE_SAMPLING: SamplingOptions = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };

// Every piece draws with the tokens of the theme in force, handed down from the canvas root as `t` (user request, 2026-10-28); a piece
// does not read the theme itself.
// Translucent night, from the token, so the palette drift test covers the canvas's veils too.
export const shadowOf = (t: TableTokens) => withAlphaHex(t.night, 0.5);
export const stripOf = (t: TableTokens) => withAlphaHex(t.night, 0.72);

export type Fonts = { names: SkFont; numbers: SkFont; small: SkFont; badge: SkFont };
export type TokenImages = { resource: SkImage | null; damage: SkImage | null; progress: SkImage | null; questPoints: SkImage | null; engagementCost: SkImage | null };
// The printed card backs (src/ui/icons, CARD_BACKS), null while the file decodes.
export type BackImages = { player: SkImage | null; encounter: SkImage | null };

// A badge's icon: the vector glyph tinted, or the token art of quest points and engagement cost as printed.
export function BadgeIcon({ name, x, y, size, color, images }: { name: IconName; x: number; y: number; size: number; color: string; images: TokenImages }) {
  const raster = name === "questPoints" ? images.questPoints : name === "engagementCost" ? images.engagementCost : null;
  if (raster) return <Image image={raster} x={x} y={y} width={size} height={size} fit="contain" />;
  return <CanvasIcon name={name} x={x} y={y} size={size} color={color} />;
}

// Each vector glyph parsed into a Skia path once, on first use. The canvas records its whole scene on every render, and a path given as its
// SVG string is parsed again each time; a parsed path is just drawn. A glyph the parser refuses stays a string (Path takes either).
const GLYPHS = new Map<IconName, SkPath>();

function glyphOf(name: IconName, d: string): SkPath | string {
  const held = GLYPHS.get(name);
  if (held) return held;
  const made = Skia.Path.MakeFromSVGString(d);
  if (!made) return d;
  GLYPHS.set(name, made);
  return made;
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
      <Path path={glyphOf(name, icon.d)} color={color} />
    </Group>
  );
}

// A number that stays readable on any token art or picture: a night outline under a bone fill.
export function Outlined({ x, y, text, font, t, s, color, heavy = false }: { x: number; y: number; text: string; font: SkFont; t: TableTokens; s: number; color?: string; heavy?: boolean }) {
  const width = font.getTextWidth(text);
  return (
    <Group>
      <Text x={x - width / 2} y={y} text={text} font={font} color={t.night} style="stroke" strokeWidth={(heavy ? 4.5 : 3) * s} />
      <Text x={x - width / 2} y={y} text={text} font={font} color={color ?? t.bone} />
    </Group>
  );
}

/**
 * A card with printed text the app does not apply (src/catalog/active-text.ts): a small faint mark at its right edge, upright
 * like the tokens, on a corner no token, effect pill or other mark uses: a ring struck through. Never a band over the picture
 * and never a word on the canvas; the preview lists the lines (docs/brief.md, Three layers). Not accent, which marks the one
 * action, and not danger, which marks a refusal.
 */
export function NotAppliedMark({ rect, t, s }: { rect: Rect; t: TableTokens; s: number }) {
  // At the right edge, just under the damage token's corner; the delayed effect's clock goes under it.
  const cx = rect.x + rect.w - 8 * s;
  const cy = rect.y + (TOKEN + 3 + 6.5) * s;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={6.5 * s} color={t.night} />
      <Circle cx={cx} cy={cy} r={4.5 * s} color={t.faint} style="stroke" strokeWidth={1.5 * s} />
      <Line p1={vec(cx - 3.2 * s, cy + 3.2 * s)} p2={vec(cx + 3.2 * s, cy - 3.2 * s)} color={t.faint} strokeWidth={1.5 * s} />
    </Group>
  );
}

/**
 * The facedown prisoner's back (01123:B:1), and a facedown Reanimated Dead's (the Threat icon: an Undead enemy): a small mark on a night disc in the middle of it, upright whatever the card does. Not accent, which marks
 * the one action, and not danger, which marks a refusal: bone, the colour of a card that is only held.
 */
export function HeldMark({ rect, icon, t, s }: { rect: Rect; icon: IconName; t: TableTokens; s: number }) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={12 * s} color={t.night} />
      <Circle cx={cx} cy={cy} r={11 * s} color={t.bone} style="stroke" strokeWidth={1.25 * s} />
      <CanvasIcon name={icon} x={cx - 6 * s} y={cy - 6 * s} size={12 * s} color={t.bone} />
    </Group>
  );
}

// A card back: the printed one, the One Ring for a player card and the Eye for an encounter card. While its file decodes,
// the player's is raised night with the accent ring, the encounter deck's night with a threat-red ring.
export function Back({ x, y, w, h, encounter, backs, t, s }: { x: number; y: number; w: number; h: number; encounter: boolean; backs: BackImages; t: TableTokens; s: number }) {
  const image = encounter ? backs.encounter : backs.player;
  const radius = cardCorner(w, h);
  if (image) {
    return (
      <Group clip={{ rect: { x, y, width: w, height: h }, rx: radius, ry: radius }}>
        <Image image={image} x={x} y={y} width={w} height={h} fit="cover" sampling={PICTURE_SAMPLING} />
      </Group>
    );
  }
  return (
    <Group>
      <RoundedRect x={x} y={y} width={w} height={h} r={radius} color={encounter ? t.night : t.raised} />
      <RoundedRect x={x + 2 * s} y={y + 2 * s} width={w - 4 * s} height={h - 4 * s} r={Math.max(0, radius - 2 * s)} color={encounter ? t.threat : t.accentLine} style="stroke" strokeWidth={1 * s} />
      <Circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 4} color={encounter ? t.threat : t.accent} style="stroke" strokeWidth={2 * s} />
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
  nameLines,
  t,
  s,
}: {
  slot: CardSlot;
  image: SkImage | null;
  name: string;
  sphere: IconName | null;
  fonts: Fonts;
  encounterBack: boolean;
  backs: BackImages;
  // How many lines the placeholder name may take (3 by default): one when effect pills stand down the left edge from 17 pt, so they never cover a second line of the name.
  nameLines?: number;
  t: TableTokens;
  s: number;
}) {
  const { x, y, w, h } = slot;
  const radius = cardCorner(w, h);
  return (
    <Group>
      <RoundedRect x={x + 1 * s} y={y + 2 * s} width={w} height={h} r={radius} color={shadowOf(t)} />
      {slot.faceDown ? (
        <Back x={x} y={y} w={w} h={h} encounter={encounterBack} backs={backs} t={t} s={s} />
      ) : image ? (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: radius, ry: radius }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" sampling={PICTURE_SAMPLING} />
        </Group>
      ) : (
        <Group>
          <RoundedRect x={x} y={y} width={w} height={h} r={radius} color={t.raised} />
          <Group clip={{ x: x + 3 * s, y: y + 3 * s, width: w - 6 * s, height: h - 6 * s }}>
            {wrapName(name, w - 10 * s, (text) => fonts.names.getTextWidth(text), nameLines).map((line, index) => (
              <Text key={index} x={x + 5 * s} y={y + (15 + index * LINE) * s} text={line} font={fonts.names} color={t.bone} />
            ))}
          </Group>
          {sphere ? <CanvasIcon name={sphere} x={x + w - 16 * s} y={y + h - 16 * s} size={12 * s} color={t[SPHERE_TINT[sphere] ?? "faint"]} /> : null}
        </Group>
      )}
    </Group>
  );
}

/** The Sailing test's success mark on a looked-at card (dcce.sailing-tests): a 22 pt night medallion straddling its foot with the symbol in the accent, upright; "×2" beside it with two symbols. */
export function SuccessMedallion({ slot, fonts, t, s }: { slot: CardSlot; fonts: Fonts; t: TableTokens; s: number }) {
  const at = medallionAt(slot, s);
  const count = medallionCount(slot.success ?? 0);
  return (
    <Group>
      <Circle cx={at.cx} cy={at.cy} r={at.r} color={t.night} />
      <Circle cx={at.cx} cy={at.cy} r={at.r} color={t.accent} style="stroke" strokeWidth={1 * s} />
      <CanvasIcon name="sailingSuccess" x={at.cx - at.r * 0.62} y={at.cy - at.r * 0.62} size={at.r * 1.24} color={t.accent} />
      {count ? <CountPill slot={slot} text={count} fonts={fonts} t={t} s={s} /> : null}
    </Group>
  );
}

// A small night pill with a count, whole on the card at its foot's right end (the stack mark's pill): never half on the card and half on the felt.
function CountPill({ slot, text, fonts, t, s }: { slot: CardSlot; text: string; fonts: Fonts; t: TableTokens; s: number }) {
  const width = fonts.small.getTextWidth(text) + 6 * s;
  const height = 10 * s;
  const x = slot.x + slot.w - width - 3 * s;
  const y = slot.y + slot.h - height;
  return (
    <Group>
      <RoundedRect x={x} y={y} width={width} height={height} r={height / 2} color={withAlphaHex(t.night, 0.9)} />
      <Text x={x + 3 * s} y={y + height - 1.5 * s} text={text} font={fonts.small} color={t.bone} />
    </Group>
  );
}

/** The count on a staging card's one peek when more than one card is under it ("×2"): a small night pill at the right end of the visible strip. */
export function StackMark({ slot, fonts, t, s }: { slot: CardSlot; fonts: Fonts; t: TableTokens; s: number }) {
  return <CountPill slot={slot} text={`×${slot.stack ?? 0}`} fonts={fonts} t={t} s={s} />;
}

/**
 * The token art on a card, each with its count: resources bottom left, damage top right, progress bottom right. `rect` is
 * the card's rectangle on screen, so the tokens of an exhausted card stay upright in its sideways footprint.
 */
export function Tokens({ slot, rect, images, fonts, t, s, ring = null, contrast = false, progressInStrip = false }: { slot: CardSlot; rect: Rect; images: TokenImages; fonts: Fonts; t: TableTokens; s: number; ring?: string | null; contrast?: boolean; progressInStrip?: boolean }) {
  const size = TOKEN * s;
  const items: { image: SkImage | null; value: number; cx: number; cy: number; fallback: string; ring: string | null }[] = [];
  if (slot.resources > 0) items.push({ image: images.resource, value: slot.resources, ...tokenSpot(rect, "resources", s), fallback: t.accent, ring });
  if (slot.damage > 0) items.push({ image: images.damage, value: slot.damage, ...tokenSpot(rect, "damage", s), fallback: t.threat, ring: null });
  if (slot.progress > 0 && !progressInStrip) items.push({ image: images.progress, value: slot.progress, ...tokenSpot(rect, "progress", s), fallback: t.bone, ring: null });
  return (
    <Group>
      {items.map((item, index) => (
        <Group key={index}>
          {item.image ? (
            <Image image={item.image} x={item.cx - size / 2} y={item.cy - size / 2} width={size} height={size} fit="contain" />
          ) : (
            <Circle cx={item.cx} cy={item.cy} r={size / 2} color={item.fallback} />
          )}
          {/* A hero's resources pay for its own sphere: the token is ringed in that sphere's colour. */}
          {item.ring ? <Circle cx={item.cx} cy={item.cy} r={size / 2 + 0.5 * s} color={item.ring} style="stroke" strokeWidth={1.75 * s} /> : null}
          <Outlined x={item.cx} y={item.cy + 4 * s} text={String(item.value)} font={contrast ? fonts.badge : fonts.numbers} t={t} s={s} heavy={contrast} />
        </Group>
      ))}
    </Group>
  );
}

// The strip's count stands in the middle of the card, or just left of the progress token at the card's foot when the card wears one (`tokenLeft`, its left edge; null with none), so the token never covers a digit.
function stripCenter(x: number, w: number, tokenLeft: number | null, label: string, font: Fonts["numbers"], s: number): number {
  const half = font.getTextWidth(label) / 2;
  return tokenLeft == null ? x + w / 2 : Math.min(x + w / 2, tokenLeft - 2 * s - half);
}

/**
 * The effects on a card, stacked down its left edge under the top: each changed number as its icon and the change ("+2"),
 * an accent pill when raised and a night pill with danger text when lowered; each "cannot" as its icon struck through; "+n" when
 * more do not fit. A committed character shows its willpower at the foot, a quest stage or location its progress. `rect` is
 * upright on screen, so an exhausted card's numbers read the right way.
 */
export function Badges({
  slot,
  rect,
  effects,
  willpower,
  commitStat,
  questPoints,
  stop,
  owner,
  stageLoses,
  fonts,
  images,
  t,
  s,
  contrast = false,
}: {
  slot: CardSlot;
  rect: Rect;
  effects: CardEffects;
  willpower: number | null;
  commitStat: "willpower" | "attack" | "defense";
  questPoints: number | null;
  // How far below the rect's top the highest pill at the foot stands (footStop in badge-room.ts); the rows stop above it.
  stop: number | null;
  // Whose stage this is ("P2") once stages are separate between players: told on the progress strip.
  owner?: string | null;
  // Filling the stage loses the game (143075:B:3): the strip's numbers are threat red, with the word.
  stageLoses?: boolean;
  fonts: Fonts;
  images: TokenImages;
  t: TableTokens;
  s: number;
  // Strong outlines (table-settings.ts): each pill gets a bone edge, so it reads on any picture.
  contrast?: boolean;
}) {
  const { x, y, w, h } = rect;
  const pill = BADGE_H * s;
  const strip = 15 * s;
  const label = questPoints != null ? (stripText(slot, questPoints, owner, stageLoses ?? false) ?? "") : "";
  // Rows that fit between the title band (or the top edge of a short card) and the resource token and the foot pills (badgeLayout).
  const { top: first, rows: room } = badgeLayout(h, s, pill, stop);
  const items = [...effects.stats.map((badge) => ({ kind: "stat" as const, badge })), ...effects.flags.map((flag) => ({ kind: "flag" as const, flag }))];
  const { shown: count, hidden } = badgeShown(items.length, room);
  const shown = items.slice(0, count);
  const rows: ReactElement[] = shown.map((item, index) => {
    const top = y + first + index * (pill + 2 * s);
    if (item.kind === "flag" && item.flag.flag === "mustCommit") {
      const width = 15 * s + fonts.badge.getTextWidth(MUST_COMMIT_WORD) + 5 * s;
      return (
        <Group key="fmustCommit">
          <RoundedRect x={x + 2 * s} y={top} width={width} height={pill} r={pill / 2} color={t.accent} />
          {contrast ? <RoundedRect x={x + 2 * s} y={top} width={width} height={pill} r={pill / 2} color={t.night} style="stroke" strokeWidth={1.5 * s} /> : null}
          <BadgeIcon name={item.flag.icon} x={x + 5 * s} y={top + 2 * s} size={11 * s} color={t.onAccent} images={images} />
          <Text x={x + 18 * s} y={top + 11.5 * s} text={MUST_COMMIT_WORD} font={fonts.badge} color={t.onAccent} />
        </Group>
      );
    }
    if (item.kind === "flag") {
      return (
        <Group key={`f${item.flag.flag}`}>
          <RoundedRect x={x + 2 * s} y={top} width={pill + 4 * s} height={pill} r={pill / 2} color={t.night} />
          <BadgeIcon name={item.flag.icon} x={x + 5 * s} y={top + 2 * s} size={11 * s} color={t.danger} images={images} />
          <Line p1={vec(x + 4 * s, top + 2 * s)} p2={vec(x + pill + 2 * s, top + pill - 2 * s)} color={t.danger} strokeWidth={1.5 * s} />
        </Group>
      );
    }
    const { badge } = item;
    const up = badge.delta > 0;
    const text = chipText(badge);
    const width = 15 * s + fonts.badge.getTextWidth(text) + 5 * s;
    return (
      <Group key={`s${badge.stat}`}>
        <RoundedRect x={x + 2 * s} y={top} width={width} height={pill} r={pill / 2} color={up ? t.accent : t.night} />
        {up ? null : <RoundedRect x={x + 2 * s} y={top} width={width} height={pill} r={pill / 2} color={t.danger} style="stroke" strokeWidth={1 * s} />}
        {contrast ? <RoundedRect x={x + 2 * s} y={top} width={width} height={pill} r={pill / 2} color={up ? t.night : t.bone} style="stroke" strokeWidth={1.5 * s} /> : null}
        {/* An effect that ends with the phase, the round or the attack: a dashed edge says it will go (the preview says when). */}
        {badge.lasting ? (
          <RoundedRect x={x + 1 * s} y={top - 1 * s} width={width + 2 * s} height={pill + 2 * s} r={pill / 2 + 1 * s} color={up ? t.bone : t.danger} style="stroke" strokeWidth={1 * s}>
            <DashPathEffect intervals={[2 * s, 2 * s]} />
          </RoundedRect>
        ) : null}
        <BadgeIcon name={badge.icon} x={x + 5 * s} y={top + 2 * s} size={11 * s} color={up ? t.onAccent : t.danger} images={images} />
        <Text x={x + 18 * s} y={top + 11.5 * s} text={text} font={fonts.badge} color={up ? t.onAccent : t.danger} />
      </Group>
    );
  });
  if (hidden > 0) {
    const top = y + first + shown.length * (pill + 2 * s);
    const more = moreText(hidden);
    const width = fonts.badge.getTextWidth(more) + 12 * s;
    rows.push(
      <Group key="more">
        <RoundedRect x={x + 2 * s} y={top} width={width} height={pill} r={pill / 2} color={t.night} />
        <Text x={x + 8 * s} y={top + 11.5 * s} text={more} font={fonts.badge} color={t.bone} />
      </Group>,
    );
  }
  return (
    <Group>
      {rows}
      {willpower != null ? (
        <Group>
          <RoundedRect x={x + w / 2 - 16 * s} y={y + h - pill - 3 * s} width={32 * s} height={pill} r={pill / 2} color={t.accent} />
          <CanvasIcon name={commitStat} x={x + w / 2 - 13 * s} y={y + h - pill - 1 * s} size={11 * s} color={t.onAccent} />
          <Text x={x + w / 2 + 1 * s} y={y + h - 6.5 * s} text={String(willpower)} font={fonts.badge} color={t.onAccent} />
        </Group>
      ) : null}
      {questPoints != null ? (
        <Group>
          <RoundedRect x={x} y={y + h - strip} width={w} height={strip} r={0} color={stripOf(t)} />
          <Outlined x={stripCenter(x, w, slot.progress > 0 && !progressInStripOf(slot.progress, questPoints) ? x + w - TOKEN * s : null, label, fonts.numbers, s)} y={y + h - 3 * s} text={label} font={fonts.numbers} t={t} s={s} {...(stageLoses ? { color: t.threat } : {})} />
        </Group>
      ) : null}
    </Group>
  );
}
