// The pills and marks a card carries on the table, drawn over its piece (pieces.native.tsx): its combat number, an option
// or place mark, a staging tag, the engagement cost, a delayed effect, an attacker, and the mark between an enemy and the
// characters fighting it (docs/design-system-table.md).
import { Circle, Group, Image, Line, RoundedRect, Text, type SkFont, type SkImage, vec } from "@shopify/react-native-skia";

import { cardCorner } from "../../ui/card-corner.ts";
import { type CombatNumber } from "../cards/card-effects.ts";
import { type IconName } from "../../ui/icon-map.ts";
import { glyphCells, type PlaceMark } from "../store/island-place.ts";
import { COLS, ROWS } from "../dream-chaser/island-table.ts";
import type { CombatMark, Rect } from "../layout/layout.ts";
import { STAGE_APART_WORD } from "../words/scenarios/stormcaller.ts";
import type { OptionMark } from "../choice/sheet-types.ts";
import { currentMark } from "./current-mark.ts";
import { TOKEN } from "./token-spots.ts";
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
  const ink = attack ? t.bone : t.onAccent;
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
      {art && !image ? <CanvasIcon name={icon} x={left + 3 * s} y={top + 3 * s} size={token - 6 * s} color={t.bone} /> : null}
      <Text x={art ? left + token + 2 * s : left + (width - words) / 2} y={top + token - 5 * s} text={text} font={fonts.badge} color={t.bone} />
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
export function UnderMarkView({ rect, mark, fonts, t, s }: { rect: Rect; mark: { text: string; loses: boolean }; fonts: Fonts; t: TableTokens; s: number }) {
  const { x, y, w, h } = rect;
  const token = TOKEN * s;
  const width = Math.min(w - 4 * s, fonts.badge.getTextWidth(mark.text) + 10 * s);
  const left = x + (w - width) / 2;
  const top = y + h - token - 4 * s;
  return (
    <Group>
      <RoundedRect x={left} y={top} width={width} height={token} r={token / 2} color={mark.loses ? t.threat : t.night} />
      <RoundedRect x={left} y={top} width={width} height={token} r={token / 2} color={mark.loses ? t.danger : t.hairline} style="stroke" strokeWidth={1 * s} />
      <Text x={left + (width - fonts.badge.getTextWidth(mark.text)) / 2} y={top + token - 5 * s} text={mark.text} font={fonts.badge} color={t.bone} />
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
export function CurrentQuestMark({ rect, fonts, t, s }: { rect: Rect; fonts: Fonts; t: TableTokens; s: number }) {
  return <WordPill rect={rect} text="Current" fonts={fonts} t={t} s={s} />;
}

/** A hero or ally the Campaign Log marks determined ("Determined"), or that carries a Determination ("Determination"): the same pill as the current quest's, a character wearing neither of the other marks (mec108.campaign-log, ledger line 10172:A:1). */
export function DeterminedMarkView({ rect, word, fonts, t, s }: { rect: Rect; word: string; fonts: Fonts; t: TableTokens; s: number }) {
  return <WordPill rect={rect} text={word} fonts={fonts} t={t} s={s} />;
}

// An accent pill with a word inside the card's top edge, upright; where the word does not fit, a short accent dot in its place.
function WordPill({ rect, text, fonts, t, s }: { rect: Rect; text: string; fonts: Fonts; t: TableTokens; s: number }) {
  const words = fonts.badge.getTextWidth(text);
  const box = currentMark(rect, words, BADGE_H * s, s);
  const r = Math.min(box.width, box.height) / 2;
  return (
    <Group>
      <RoundedRect x={box.x} y={box.y} width={box.width} height={box.height} r={r} color={t.accent} />
      <RoundedRect x={box.x} y={box.y} width={box.width} height={box.height} r={r} color={t.night} style="stroke" strokeWidth={1 * s} />
      {box.kind === "word" ? <Text x={box.x + (box.width - words) / 2} y={box.y + 11.5 * s} text={text} font={fonts.badge} color={t.onAccent} /> : null}
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
 * The Stormcaller's stage marks, upright in the part of the stage its area's cards leave uncovered (`rect`, shownBounds): a pill at the top corner with the stage's number ("2", "3", threat red "4/4" at the last
 * stage, where filling it loses the game), and, while the players are at another stage, an "Apart" plate across its middle that the veil on the area's cards does not say (docs/design-system-table.md, Cards).
 */
export function StageMarks({ rect, pill, apart, fonts, t, s }: { rect: Rect; pill: { text: string; danger: boolean }; apart: boolean; fonts: Fonts; t: TableTokens; s: number }) {
  const height = 11 * s;
  const words = fonts.small.getTextWidth(pill.text);
  const pillW = Math.min(rect.w - 6 * s, words + 8 * s);
  const plate = fonts.small.getTextWidth(STAGE_APART_WORD);
  const plateW = Math.min(rect.w - 6 * s, plate + 8 * s);
  const plateY = rect.y + (rect.h - height) / 2;
  return (
    <Group>
      <RoundedRect x={rect.x + 3 * s} y={rect.y + 3 * s} width={pillW} height={height} r={height / 2} color={pill.danger ? t.threat : withAlphaHex(t.night, 0.9)} />
      <RoundedRect x={rect.x + 3 * s} y={rect.y + 3 * s} width={pillW} height={height} r={height / 2} color={pill.danger ? t.danger : t.hairline} style="stroke" strokeWidth={1 * s} />
      <Text x={rect.x + 3 * s + (pillW - words) / 2} y={rect.y + 3 * s + height - 2.5 * s} text={pill.text} font={fonts.small} color={t.bone} />
      {apart ? (
        <Group>
          <RoundedRect x={rect.x + (rect.w - plateW) / 2} y={plateY} width={plateW} height={height} r={2 * s} color={withAlphaHex(t.night, 0.9)} />
          <RoundedRect x={rect.x + (rect.w - plateW) / 2} y={plateY} width={plateW} height={height} r={2 * s} color={t.hairline} style="stroke" strokeWidth={1 * s} />
          <Text x={rect.x + (rect.w - plate) / 2} y={plateY + height - 2.5 * s} text={STAGE_APART_WORD} font={fonts.small} color={t.faint} />
        </Group>
      ) : null}
    </Group>
  );
}
