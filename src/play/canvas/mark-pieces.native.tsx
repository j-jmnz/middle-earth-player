// The pills and marks a card carries on the table, drawn over its piece (pieces.native.tsx): its combat number, an option
// or place mark, a staging tag, the engagement cost, a delayed effect, an attacker, and the mark between an enemy and the
// characters fighting it (docs/design-system-table.md).
import { Circle, Group, Image, Line, RoundedRect, Text, type SkFont, type SkImage, vec } from "@shopify/react-native-skia";

import { cardCorner } from "../../ui/card-corner.ts";
import { chipText, moreText, MUST_COMMIT_WORD, type CardEffects, type CombatNumber } from "../cards/card-effects.ts";
import { DETERMINED_WORD } from "../words/scenarios/angmar/wastes-table.ts";
import { BLANK_WORD } from "../words/card-bars.ts";
import { CHAMPION_WORD } from "../words/scenarios/haradrim/umbar-table.ts";
import { type IconName } from "../../ui/icon-map.ts";
import { glyphCells, type PlaceMark } from "../store/island-place.ts";
import { COLS, ROWS } from "../dream-chaser/island-table.ts";
import type { CombatMark, Rect } from "../layout/layout.ts";
import { STAGE_APART_WORD, type StagePill } from "../words/scenarios/stormcaller.ts";
import type { OptionMark } from "../choice/sheet-types.ts";
import { currentMark } from "./current-mark.ts";
import { BADGE_TOP, badgeRoom, hiddenBadges, lonePick } from "./badge-room.ts";
import { TOKEN } from "./token-spots.ts";
import { STRIP, underMarkBox } from "./under-mark.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";
import { CanvasIcon, BADGE_H, type Fonts, type TokenImages } from "./pieces.native.tsx";

/**
 * The number a card brings to the enemy attacks, at its foot where a committed character's willpower stands (user request,
 * 2026-11-01): an enemy's attack on a threat-red pill, a character's defense on an accent pill, each with its icon. The value counts
 * every effect; the effect pills down the card's left edge still say what changed it.
 */
export function CombatPill({ rect, combat, fonts, t, s }: { rect: Rect; combat: CombatNumber; fonts: Fonts; t: TableTokens; s: number }) {
  const { x, y, w, h } = rect;
  const pill = BADGE_H * s;
  const text = String(combat.value);
  const width = 18 * s + fonts.badge.getTextWidth(text) + 5 * s;
  const left = x + (w - width) / 2;
  const top = y + h - pill - 3 * s;
  const attack = combat.stat === "attack";
  const ink = attack ? t.onThreatPill : t.onAccent;
  return (
    <Group>
      <RoundedRect x={left} y={top} width={width} height={pill} r={pill / 2} color={attack ? t.threat : t.accent} />
      <RoundedRect x={left} y={top} width={width} height={pill} r={pill / 2} color={attack ? t.danger : t.night} style="stroke" strokeWidth={1 * s} />
      <CanvasIcon name={combat.stat} x={left + 3 * s} y={top + 2 * s} size={11 * s} color={ink} />
      <Text x={left + 17 * s} y={top + 11.5 * s} text={text} font={fonts.badge} color={ink} />
    </Group>
  );
}

/**
 * A number on a pill at a card's foot, upright like the tokens: the token art (or an icon) and the number, threat red with a
 * danger edge when `danger`, night with a hairline otherwise. `lift` raises it above the token row, clear of the resource
 * count a character may hold.
 */
function FootPill({ rect, image, icon, value, danger, lift, fonts, t, s }: { rect: Rect; image: SkImage | null; icon: IconName; value: number | string; danger: boolean; lift: boolean; fonts: Fonts; t: TableTokens; s: number }) {
  const { x, y, w, h } = rect;
  const text = String(value);
  const token = TOKEN * s;
  const words = fonts.badge.getTextWidth(text);
  // The pill stays inside the card: when the art and the number do not fit its width, the number stands alone.
  const art = token + words + 8 * s <= w - 4 * s;
  const width = art ? token + words + 8 * s : Math.min(words + 10 * s, w - 4 * s);
  const left = x + (w - width) / 2;
  const top = y + h - token - 4 * s - (lift ? token + 2 * s : 0);
  return (
    <Group>
      <RoundedRect x={left} y={top} width={width} height={token} r={token / 2} color={danger ? t.threat : t.night} />
      <RoundedRect x={left} y={top} width={width} height={token} r={token / 2} color={danger ? t.danger : t.hairline} style="stroke" strokeWidth={1 * s} />
      {art && image ? <Image image={image} x={left + 1 * s} y={top + 1 * s} width={token - 2 * s} height={token - 2 * s} fit="contain" /> : null}
      {art && !image ? <CanvasIcon name={icon} x={left + 3 * s} y={top + 3 * s} size={token - 6 * s} color={danger ? t.onThreatPill : t.bone} /> : null}
      <Text x={art ? left + token + 2 * s : left + (width - words) / 2} y={top + token - 5 * s} text={text} font={fonts.badge} color={danger ? t.onThreatPill : t.bone} />
    </Group>
  );
}

/** A number the open pick draws on a card it asks about: the damage a defender would take, before the shadow card. */
export function OptionMarkView({ rect, mark, fonts, images, t, s }: { rect: Rect; mark: OptionMark; fonts: Fonts; images: TokenImages; t: TableTokens; s: number }) {
  return <FootPill rect={rect} image={mark.icon === "damage" ? images.damage : null} icon={mark.icon} value={mark.value} danger={mark.danger} lift fonts={fonts} t={t} s={s} />;
}

/**
 * The cards underneath The Havens Burn against the number that loses the game: a night pill at the card's foot with the short count ("2/5"), threat red when the next card placed under it loses (11038:A:2).
 * The count is short on purpose: it stays inside the card at every size (the full sentence is in the preview and the screen reader's line). Only the count is shown, never which cards are underneath.
 */
export function UnderMarkView({ rect, mark, sideways, strip, fonts, t, s }: { rect: Rect; mark: { text: string; loses: boolean; count?: number; clearName?: true }; sideways: boolean; strip: boolean; fonts: Fonts; t: TableTokens; s: number }) {
  // Captured cards (a `count`) stand a row above the foot, clear of the engagement cost, the combat number and the quest strip; where "3 captured" does not fit, a facedown-card glyph and the bare count stand in.
  const counted = mark.count != null;
  const count = String(mark.count ?? "");
  const box = underMarkBox(rect, fonts.badge.getTextWidth(mark.text), fonts.badge.getTextWidth(count), s, counted, sideways && mark.clearName === true, strip);
  const text = box.kind === "words" ? mark.text : count;
  const words = fonts.badge.getTextWidth(text);
  const token = box.height;
  const left = box.x;
  const top = box.y;
  const glyph = box.kind === "count";
  return (
    <Group>
      <RoundedRect x={left} y={top} width={box.width} height={token} r={token / 2} color={mark.loses ? t.threat : t.night} />
      <RoundedRect x={left} y={top} width={box.width} height={token} r={token / 2} color={mark.loses ? t.danger : t.hairline} style="stroke" strokeWidth={1 * s} />
      {glyph ? <RoundedRect x={left + 5 * s} y={top + (token - 10 * s) / 2} width={7 * s} height={10 * s} r={1.5 * s} color={t.bone} style="stroke" strokeWidth={1 * s} /> : null}
      <Text x={glyph ? left + 5 * s + 9 * s : left + (box.width - words) / 2} y={top + token - 5 * s} text={text} font={fonts.badge} color={mark.loses ? t.onThreatPill : t.bone} />
    </Group>
  );
}

/**
 * A location of the Island Map in the staging area: a night pill at the top of the card with the 5 × 3 glyph of the map, the card's place lit in accent and the marker's ringed (island-place.ts), so the look-alike Lost Islands
 * in the staging area are told apart without reading a row. Decoration: the preview and the row say the place in words.
 */
export function PlaceMarkView({ rect, mark, t, s }: { rect: Rect; mark: PlaceMark; t: TableTokens; s: number }) {
  const { x, y, w } = rect;
  const cell = 4 * s;
  const gap = 1 * s;
  const pad = 2 * s;
  const width = COLS * cell + (COLS - 1) * gap + 2 * pad;
  const height = ROWS * cell + (ROWS - 1) * gap + 2 * pad;
  const left = x + (w - width) / 2;
  const top = y + 3 * s;
  return (
    <Group>
      <RoundedRect x={left} y={top} width={width} height={height} r={3 * s} color={t.night} />
      {glyphCells(mark).flatMap((cells, row) =>
        cells.map((lit, col) => {
          const at = { x: left + pad + col * (cell + gap), y: top + pad + row * (cell + gap) };
          const marker = mark.from != null && mark.from.row === row && mark.from.col === col;
          return (
            <Group key={`${row}-${col}`}>
              <RoundedRect x={at.x} y={at.y} width={cell} height={cell} r={1 * s} color={lit ? t.accent : t.hairline} />
              {marker ? <RoundedRect x={at.x} y={at.y} width={cell} height={cell} r={1 * s} color={t.bone} style="stroke" strokeWidth={0.75 * s} /> : null}
            </Group>
          );
        }),
      )}
    </Group>
  );
}

/** An Aflame location's damage against the value that destroys it ("3/5"): the damage token art and the count on a pill at the card's foot, threat red when one more damage destroys it (dcce.aflame). */
export function FireMarkView({ rect, mark, fonts, images, t, s }: { rect: Rect; mark: { text: string; danger: boolean }; fonts: Fonts; images: TokenImages; t: TableTokens; s: number }) {
  return <FootPill rect={rect} image={images.damage} icon="damage" value={mark.text} danger={mark.danger} lift={false} fonts={fonts} t={t} s={s} />;
}

/**
 * The current quest among the side quests in the staging area: a small accent pill with the word "Current" inside the card's top edge, upright, left of the damage token's column (mec108.side-quests-in-play); where the word does not fit, a short accent dot in its place,
 * as the foot pills drop their art. The preview and the screen reader's line say what it means.
 */
export function CurrentQuestMark({ rect, clear, fonts, t, s }: { rect: Rect; clear: number; fonts: Fonts; t: TableTokens; s: number }) {
  return <WordPill rect={rect} text="Current" clear={clear} fonts={fonts} t={t} s={s} />;
}

// The round glyph a word falls back to where it does not fit: "Determined" is a "D", the Champion of Escape from Umbar a "C", Desert Crossing's "Blank" a "B"; "Determination" has none (the plain dot).
const SHORT_GLYPHS: ReadonlyMap<string, string> = new Map([[DETERMINED_WORD, "D"], [CHAMPION_WORD, "C"], [BLANK_WORD, "B"]]);
const shortGlyph = (word: string): string | undefined => SHORT_GLYPHS.get(word);

/** A hero or ally the Campaign Log marks determined ("Determined"), or that carries a Determination ("Determination"): the same pill as the current quest's, a character wearing neither of the other marks (mec108.campaign-log, ledger line 10172:A:1). */
export function DeterminedMarkView({ rect, word, clear, fonts, t, s }: { rect: Rect; word: string; clear: number; fonts: Fonts; t: TableTokens; s: number }) {
  // Where the word does not fit, "Determined" falls back to a round "D" and "Determination" to the plain dot, so the two differ without colour; the Champion falls back to a round "C".
  return <WordPill rect={rect} text={word} short={shortGlyph(word)} clear={clear} fonts={fonts} t={t} s={s} />;
}

/**
 * A card whose text box is blank (Desert Crossing, Cold from Angmar, the heroes The Long Arm of Mordor holds): the accent "Blank" pill stands in the pill column at the card's foot, as the "1 held" pill does, never on the name at the top; where the word does not fit, a round "B".
 * `lifted`: another mark holds the foot row (the engagement cost, a combat number, the progress strip, a held pill), so this one stands a row above it.
 */
export function BlankMarkView({ rect, lifted, fonts, t, s }: { rect: Rect; lifted: boolean; fonts: Fonts; t: TableTokens; s: number }) {
  const words = fonts.badge.getTextWidth(BLANK_WORD);
  const box = underMarkBox(rect, words, 0, s, false, false, lifted);
  const fits = words + 10 * s <= rect.w - 4 * s;
  const text = fits ? BLANK_WORD : "B";
  const width = fits ? box.width : box.height;
  const x = box.x + (box.width - width) / 2;
  const shown = fonts.badge.getTextWidth(text);
  return (
    <Group>
      <RoundedRect x={x} y={box.y} width={width} height={box.height} r={box.height / 2} color={t.accent} />
      <RoundedRect x={x} y={box.y} width={width} height={box.height} r={box.height / 2} color={t.night} style="stroke" strokeWidth={1 * s} />
      <Text x={x + (width - shown) / 2} y={box.y + box.height - 5 * s} text={text} font={fonts.badge} color={t.onAccent} />
    </Group>
  );
}

/** The owner of a hero in the staging area ("P2"): a small night chip at the card's bottom right edge, clear of the foot pills in the middle (docs/design-system-table.md, Cards). */
export function SeatChipView({ rect, text, fonts, t, s }: { rect: Rect; text: string; fonts: Fonts; t: TableTokens; s: number }) {
  const words = fonts.badge.getTextWidth(text);
  const height = BADGE_H * s;
  const width = Math.min(rect.w - 4 * s, words + 8 * s);
  const x = rect.x + rect.w - width - 2 * s;
  const y = rect.y + rect.h - height - 2 * s;
  return (
    <Group>
      <RoundedRect x={x} y={y} width={width} height={height} r={height / 2} color={t.night} />
      <RoundedRect x={x} y={y} width={width} height={height} r={height / 2} color={t.bone} style="stroke" strokeWidth={1 * s} />
      <Text x={x + (width - words) / 2} y={y + height - 5 * s} text={text} font={fonts.badge} color={t.bone} />
    </Group>
  );
}

/** How far the widest effect badge reaches from the card's left edge, so a word pill keeps clear of the badge column (the rows are drawn by `Badges`: a stat is the icon, the number and 5 pt, a flag the pill and 4 pt (the must-commit pill is a stat's width), the "more" pill its words and 12 pt, at least 24 pt). */
export function badgeReach(effects: CardEffects, fonts: Fonts, s: number, height: number, stop: number | null): number {
  const widths = [
    ...effects.stats.map((badge) => 15 * s + fonts.badge.getTextWidth(chipText(badge)) + 5 * s),
    ...effects.flags.map((flag) => (flag.flag === "mustCommit" ? 15 * s + fonts.badge.getTextWidth(MUST_COMMIT_WORD) + 5 * s : BADGE_H * s + 4 * s)),
  ];
  // The pill for the effects left out ("2 more") is as wide as its words and 12 pt, and is drawn when any are left out: the count is the one `Badges` draws, which depends on the room the card's height leaves.
  const left = hiddenBadges(effects.stats.length + effects.flags.length, height, s, BADGE_H * s, stop);
  const more = left > 0 ? fonts.badge.getTextWidth(moreText(left)) + 12 * s : 0;
  // A card with no room for a row draws no pill at all (badgeLayout).
  if (widths.length === 0 || badgeRoom(height, s, BADGE_H * s, stop) < 1) return 0;
  // One row for several effects: the kept chip and "N more" stand side by side (Badges), so the pills reach as far as both.
  const lone = badgeRoom(height, s, BADGE_H * s, stop) === 1 && widths.length > 1;
  return lone ? 2 * s + Math.max(24 * s, (widths[lonePick(effects.stats)] ?? 0) + 2 * s + 12 * s + fonts.badge.getTextWidth(moreText(widths.length - 1))) : 2 * s + Math.max(24 * s, more, ...widths);
}

// An accent pill with a word inside the card's top edge, upright, clear of the effect badges' column; where the word does not fit, a short accent dot in its place (a round pill with `short` in it when the word has one).
function WordPill({ rect, text, short, clear, fonts, t, s }: { rect: Rect; text: string; short?: string; clear: number; fonts: Fonts; t: TableTokens; s: number }) {
  const words = fonts.badge.getTextWidth(text);
  const box = currentMark(rect, words, BADGE_H * s, s, clear, short != null);
  const r = Math.min(box.width, box.height) / 2;
  return (
    <Group>
      <RoundedRect x={box.x} y={box.y} width={box.width} height={box.height} r={r} color={t.accent} />
      <RoundedRect x={box.x} y={box.y} width={box.width} height={box.height} r={r} color={t.night} style="stroke" strokeWidth={1 * s} />
      {box.kind === "word" ? <Text x={box.x + (box.width - words) / 2} y={box.y + 11.5 * s} text={text} font={fonts.badge} color={t.onAccent} /> : null}
      {box.kind === "dot" && short != null ? <Text x={box.x + (box.width - fonts.badge.getTextWidth(short)) / 2} y={box.y + 11.5 * s} text={short} font={fonts.badge} color={t.onAccent} /> : null}
    </Group>
  );
}

/** A Ship location's Threat against the total that loses the game at stage 3 ("8/9"): the Threat icon and the count on a pill at the card's foot, threat red at the total (12041:B:2). */
export function ShipLossView({ rect, mark, fonts, t, s }: { rect: Rect; mark: { text: string; danger: boolean }; fonts: Fonts; t: TableTokens; s: number }) {
  return <FootPill rect={rect} image={null} icon="threat" value={mark.text} danger={mark.danger} lift={false} fonts={fonts} t={t} s={s} />;
}

/** An enemy's engagement cost in staging: threat red when the shown seat's threat engages it at the checks (rr.engagement-check). */
export function EngagementMark({ rect, cost, engages, fonts, images, t, s }: { rect: Rect; cost: number; engages: boolean; fonts: Fonts; images: TokenImages; t: TableTokens; s: number }) {
  return <FootPill rect={rect} image={images.engagementCost} icon="threat" value={cost} danger={engages} lift={false} fonts={fonts} t={t} s={s} />;
}

/**
 * A card a delayed effect will act on (Sneak Attack's return): a small clock at the right edge, under the damage token and
 * the not-applied mark, clear of the effect pills down the left edge. The preview says what.
 */
export function DelayedMark({ rect, t, s }: { rect: Rect; t: TableTokens; s: number }) {
  const cx = rect.x + rect.w - 8 * s;
  const cy = rect.y + (TOKEN + 3 + 13 + 2 + 7) * s;
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={7 * s} color={t.night} />
      <Circle cx={cx} cy={cy} r={7 * s} color={t.accent} style="stroke" strokeWidth={1.5 * s} />
      <Line p1={vec(cx, cy)} p2={vec(cx, cy - 4 * s)} color={t.accent} strokeWidth={1.5 * s} />
      <Line p1={vec(cx, cy)} p2={vec(cx + 3 * s, cy)} color={t.accent} strokeWidth={1.5 * s} />
    </Group>
  );
}

/** The enemy whose attack is in progress: a threat-red edge and its attack icon at its side. */
export function AttackerMark({ rect, t, s }: { rect: Rect; t: TableTokens; s: number }) {
  const { x, y, w, h } = rect;
  return (
    <Group>
      <RoundedRect x={x - 1 * s} y={y - 1 * s} width={w + 2 * s} height={h + 2 * s} r={cardCorner(w, h) + 1 * s} color={t.threat} style="stroke" strokeWidth={3 * s} />
      <Circle cx={x + w} cy={y + h / 2} r={9 * s} color={t.night} />
      <Circle cx={x + w} cy={y + h / 2} r={9 * s} color={t.threat} style="stroke" strokeWidth={1.5 * s} />
      <CanvasIcon name="attack" x={x + w - 6 * s} y={y + h / 2 - 6 * s} size={12 * s} color={t.threat} />
    </Group>
  );
}

/**
 * The mark between an engaged enemy and the characters fighting it: a defense, an undefended hit, an attack. A fight picked
 * but not confirmed yet is drawn fainter.
 */
export function CombatMarkView({ mark, t, s }: { mark: CombatMark; t: TableTokens; s: number }) {
  const icon: IconName = mark.kind === "defense" ? "defense" : "attack";
  const color = mark.kind === "undefended" ? t.threat : t.accent;
  return (
    <Group opacity={mark.preview ? 0.7 : 1}>
      <Circle cx={mark.x} cy={mark.y} r={8 * s} color={t.night} />
      <Circle cx={mark.x} cy={mark.y} r={8 * s} color={color} style="stroke" strokeWidth={1.5 * s} />
      <CanvasIcon name={icon} x={mark.x - 5 * s} y={mark.y - 5 * s} size={10 * s} color={color} />
    </Group>
  );
}

/**
 * Whose staging area the row is, once the table is split between players: a small caps tag standing in the gutter at the row's left end, reading upward,
 * clear of the cards.
 */
export function StagingTag({ rect, text, font, t, s }: { rect: Rect; text: string; font: SkFont; t: TableTokens; s: number }) {
  const scale = 0.7;
  return (
    <Group transform={[{ translateX: rect.x - 0.5 * s }, { translateY: rect.y + rect.h - 2 * s }, { rotate: -Math.PI / 2 }, { scale }]}>
      <Text x={0} y={0} text={text.toUpperCase()} font={font} color={t.faint} />
    </Group>
  );
}

/**
 * A quest area's stage marks, upright in the part of the stage its area's cards leave uncovered (`rect`, shownBounds): the stage's pill at the lower corner, just above the progress strip ("2", "Orcs 2", threat red
 * "4/4" where filling the stage loses the game), and, while the players are at another stage, an "Apart" plate under the title band that the veil on the area's cards does not say. Neither stands over the title
 * (docs/design-system-table.md, The Stormcaller's area).
 */
export function StageMarks({ rect, pill, apart, fonts, t, s }: { rect: Rect; pill: StagePill; apart: boolean; fonts: Fonts; t: TableTokens; s: number }) {
  const height = 11 * s;
  const room = rect.w - 6 * s;
  const plate = fonts.small.getTextWidth(STAGE_APART_WORD);
  const plateW = Math.min(room, plate + 8 * s);
  const pillX = rect.x + 3 * s;
  const pillY = rect.y + rect.h - STRIP * s - height - 2 * s;
  // The plate stands under the picture's title band, clear of the pill when the card is tall enough for both; when it is not, the pill keeps only its number and the plate stands beside it.
  const below = rect.y + BADGE_TOP * s + 1 * s;
  const roomBelow = below + height + 1 * s <= pillY;
  const beside = apart && !roomBelow;
  // The pill says whose stage it is when it fits the uncovered width, and only its number when it does not.
  const text = !beside && fonts.small.getTextWidth(pill.text) + 8 * s <= room ? pill.text : pill.short;
  const words = fonts.small.getTextWidth(text);
  const pillW = Math.min(room, words + 8 * s);
  const plateX = roomBelow ? rect.x + (rect.w - plateW) / 2 : Math.min(pillX + pillW + 2 * s, rect.x + rect.w - plateW - 1 * s);
  const plateY = roomBelow ? below : pillY;
  return (
    <Group>
      <RoundedRect x={pillX} y={pillY} width={pillW} height={height} r={height / 2} color={pill.danger ? t.threat : withAlphaHex(t.night, 0.9)} />
      <RoundedRect x={pillX} y={pillY} width={pillW} height={height} r={height / 2} color={pill.danger ? t.danger : t.hairline} style="stroke" strokeWidth={1 * s} />
      <Text x={pillX + (pillW - words) / 2} y={pillY + height - 2.5 * s} text={text} font={fonts.small} color={pill.danger ? t.onThreatPill : t.bone} />
      {apart ? (
        <Group>
          <RoundedRect x={plateX} y={plateY} width={plateW} height={height} r={2 * s} color={withAlphaHex(t.night, 0.9)} />
          <RoundedRect x={plateX} y={plateY} width={plateW} height={height} r={2 * s} color={t.hairline} style="stroke" strokeWidth={1 * s} />
          <Text x={plateX + (plateW - plate) / 2} y={plateY + height - 2.5 * s} text={STAGE_APART_WORD} font={fonts.small} color={t.faint} />
        </Group>
      ) : null}
    </Group>
  );
}
