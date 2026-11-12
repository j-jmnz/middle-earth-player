// A pile on the table (docs/design-system-table.md, Piles): a stack of backs or the top card of a discard pile with its count strip and word,
// the dashed outline of an empty pile, a row's fold stack, and the victory display's fan and coin; a discard pile the seat may play from
// wears the play mark. The other pieces of a card are canvas/pieces.native.tsx.
import { Circle, DashPathEffect, Group, Image, Path, RoundedRect, Text, type SkImage, vec } from "@shopify/react-native-skia";

import { Back, LINE, Outlined, PICTURE_SAMPLING, shadowOf, stripOf, type BackImages, type Fonts } from "./pieces.native.tsx";
import { cardCorner } from "../../ui/card-corner.ts";
import type { CardSlot } from "../layout/layout.ts";
import { FOLD_WORD, foldCount } from "../layout/row-fold.ts";
import { AREA_FOLD_WORD } from "../words/scenarios/stormcaller.ts";
import type { TableTokens } from "../../ui/tokens.ts";
import { wrapName } from "./wrap.ts";

const NO_IMAGES: readonly (SkImage | null)[] = [];

const PILE_WORD: Readonly<Record<string, string>> = { deck: "Deck", discard: "Discard", encounterDeck: "Encounter", encounterDiscard: "Discard", corsairDeck: "Corsair", corsairDiscard: "Discard", unchartedDeck: "Uncharted", grottoDeck: "Grotto", evilCreaturesDeck: "Creatures", evilCreaturesDiscard: "Discard", cavesDeck: "Caves", haradDeck: "Harad", angmarOrcDeck: "Orcs", victory: "Victory" };

// The turn of each card fanned behind the victory pile's top, the nearest first (radians, about the pile's foot; layout.ts keeps VICTORY_FAN of room for it).
const FAN_TURNS = [-0.12, -0.24];

/** The victory pile's fan: the cards before its top, turned about the pile's foot, the oldest farthest out (docs/design-system-table.md, Piles). */
function VictoryFan({ slot, fan, t, s }: { slot: CardSlot; fan: readonly (SkImage | null)[]; t: TableTokens; s: number }) {
  const { x, y, w, h } = slot;
  const radius = cardCorner(w, h);
  return (
    <Group>
      {fan.map((image, index) => {
        const turn = FAN_TURNS[fan.length - 1 - index] ?? 0;
        return (
          <Group key={index} transform={[{ rotate: turn }]} origin={vec(x + w / 2, y + h)}>
            <RoundedRect x={x + 1 * s} y={y + 2 * s} width={w} height={h} r={radius} color={shadowOf(t)} />
            {image ? (
              <Group clip={{ rect: { x, y, width: w, height: h }, rx: radius, ry: radius }}>
                <Image image={image} x={x} y={y} width={w} height={h} fit="cover" sampling={PICTURE_SAMPLING} />
              </Group>
            ) : (
              <RoundedRect x={x} y={y} width={w} height={h} r={radius} color={t.raised} />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

// The disc at a pile's top right corner (the victory pile's coin, a discard pile's play mark): its centre and radius, and the shadow under it.
function cornerDisc(slot: CardSlot, s: number) {
  return { cx: slot.x + slot.w - 2 * s, cy: slot.y + 2 * s, r: 8 * s };
}

function DiscShadow({ cx, cy, r, t, s }: { cx: number; cy: number; r: number; t: TableTokens; s: number }) {
  return <Circle cx={cx} cy={cy + 1 * s} r={r} color={shadowOf(t)} />;
}

/**
 * The victory pile's gold coin at its top right corner: the Victory points its cards score, in ink on the theme's coin gold. On Light the
 * ink ring is drawn whole, so the coin keeps an edge on the light felt.
 */
function PointsCoin({ slot, fonts, t, s }: { slot: CardSlot; fonts: Fonts; t: TableTokens; s: number }) {
  const { cx, cy, r } = cornerDisc(slot, s);
  const text = String(slot.points ?? 0);
  return (
    <Group>
      <DiscShadow cx={cx} cy={cy} r={r} t={t} s={s} />
      <Circle cx={cx} cy={cy} r={r} color={t.coin} />
      <Circle cx={cx} cy={cy} r={r - 0.5 * s} color={t.ink} style="stroke" strokeWidth={(t.depth === "light" ? 1 : 0.75) * s} opacity={t.depth === "light" ? 1 : 0.35} />
      <Text x={cx - fonts.small.getTextWidth(text) / 2} y={cy + 3.5 * s} text={text} font={fonts.small} color={t.ink} />
    </Group>
  );
}

/** The mark on a discard pile that holds a card the open window lets the seat play from it (Elven-light): an accent disc with a play arrow at its top right corner. */
function PlayableMark({ slot, t, s }: { slot: CardSlot; t: TableTokens; s: number }) {
  const { cx, cy, r } = cornerDisc(slot, s);
  const arrow = `M ${cx - 2.5 * s} ${cy - 4 * s} L ${cx + 4 * s} ${cy} L ${cx - 2.5 * s} ${cy + 4 * s} Z`;
  return (
    <Group>
      <DiscShadow cx={cx} cy={cy} r={r} t={t} s={s} />
      <Circle cx={cx} cy={cy} r={r} color={t.accent} />
      <Path path={arrow} color={t.onAccent} />
    </Group>
  );
}

// The piles that show the printed encounter back (the Eye): the encounter pair, the Corsair pair, the Evil Creatures pair and the Caves deck.
const ENCOUNTER_PILES: ReadonlySet<string> = new Set(["encounterDeck", "encounterDiscard", "corsairDeck", "corsairDiscard", "evilCreaturesDeck", "evilCreaturesDiscard", "cavesDeck", "haradDeck", "angmarOrcDeck"]);

/**
 * A pile: a stack of backs (or the top card of a discard pile) with its count, or a dashed outline while it is empty. The victory display
 * fans the cards before its top behind it and wears its Victory points on a gold coin; a discard pile the seat may play from wears the play mark.
 */
export function Pile({
  slot,
  image,
  fan,
  name,
  fonts,
  label,
  playable = false,
  backs,
  t,
  s,
}: {
  slot: CardSlot;
  image: SkImage | null;
  fan?: readonly (SkImage | null)[];
  name: string;
  fonts: Fonts;
  label: boolean;
  playable?: boolean;
  backs: BackImages;
  t: TableTokens;
  s: number;
}) {
  const { x, y, w, h } = slot;
  const radius = cardCorner(w, h);
  const strip = 15 * s;
  const encounter = ENCOUNTER_PILES.has(slot.zone);
  // A row's fold stack shows its first folded card, "+n" on the count strip and the word More (row-fold.ts).
  const word = slot.areaFold ? AREA_FOLD_WORD : slot.fold ? FOLD_WORD : (PILE_WORD[slot.zone] ?? "");
  if (slot.count === 0) {
    return (
      <Group>
        <RoundedRect x={x} y={y} width={w} height={h} r={radius} color={t.hairline} style="stroke" strokeWidth={1 * s}>
          <DashPathEffect intervals={[4 * s, 4 * s]} />
        </RoundedRect>
        {label ? <Text x={x + (w - fonts.small.getTextWidth(word)) / 2} y={y + h / 2 + 4 * s} text={word} font={fonts.small} color={t.faint} /> : null}
      </Group>
    );
  }
  const depth = Math.min(3, Math.ceil(slot.count / 10));
  const behind = fan ?? NO_IMAGES;
  return (
    <Group>
      {behind.length > 0 ? <VictoryFan slot={slot} fan={behind} t={t} s={s} /> : null}
      {Array.from({ length: depth }, (_, index) => (
        <RoundedRect key={index} x={x + (depth - index) * 1.5 * s} y={y + (depth - index) * 1.5 * s} width={w} height={h} r={radius} color={encounter ? t.night : t.raised} />
      ))}
      {slot.faceDown ? (
        <Back x={x} y={y} w={w} h={h} encounter={encounter} backs={backs} t={t} s={s} />
      ) : image ? (
        <Group clip={{ rect: { x, y, width: w, height: h }, rx: radius, ry: radius }}>
          <Image image={image} x={x} y={y} width={w} height={h} fit="cover" sampling={PICTURE_SAMPLING} />
        </Group>
      ) : (
        // A face-up top whose file is missing shows its name, so a discard pile never looks like a deck.
        <Group>
          <RoundedRect x={x} y={y} width={w} height={h} r={radius} color={t.raised} />
          <Group clip={{ x: x + 3 * s, y: y + 3 * s, width: w - 6 * s, height: h - 21 * s }}>
            {wrapName(name, w - 10 * s, (text) => fonts.names.getTextWidth(text)).map((line, index) => (
              <Text key={index} x={x + 5 * s} y={y + (15 + index * LINE) * s} text={line} font={fonts.names} color={t.bone} />
            ))}
          </Group>
        </Group>
      )}
      <RoundedRect x={x} y={y + h - strip} width={w} height={strip} r={0} color={stripOf(t)} />
      <Outlined x={x + w / 2} y={y + h - 3 * s} text={slot.fold ? foldCount(slot.count) : String(slot.count)} font={fonts.numbers} t={t} s={s} />
      {/* Iron Shackles is attached to this deck (01105:A:1): two linked rings at the strip's left end. */}
      {slot.chained ? (
        <Group>
          <RoundedRect x={x + 3 * s} y={y + h - 11 * s} width={8 * s} height={6 * s} r={3 * s} color={t.bone} style="stroke" strokeWidth={1.25 * s} />
          <RoundedRect x={x + 8 * s} y={y + h - 11 * s} width={8 * s} height={6 * s} r={3 * s} color={t.bone} style="stroke" strokeWidth={1.25 * s} />
        </Group>
      ) : null}
      {label ? <Text x={x + (w - fonts.small.getTextWidth(word)) / 2} y={y + h + 11 * s} text={word} font={fonts.small} color={t.muted} /> : null}
      {slot.points != null ? <PointsCoin slot={slot} fonts={fonts} t={t} s={s} /> : null}
      {playable ? <PlayableMark slot={slot} t={t} s={s} /> : null}
    </Group>
  );
}
