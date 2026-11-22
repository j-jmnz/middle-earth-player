// The deck editor's cards as a grid (docs/design-system.md, Deck builder): the editor's rows (a heading, the hero strip, a run of
// cards cut into rows of the grid), one card's cell with its stepper, a section's heading with its count and Add, and the jump chips.
import { useRouter } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { TextButton, ToggleChip } from "../kit/chrome";
import { CountStepper } from "../kit/count-stepper";
import { announceDraftChange, changeDraftCount, draftAddRefused, targetPicks, type DraftPicks, type DraftPile, type TitleLookup } from "./draft";
import type { DeckSectionRow } from "./status";
import { NOT_OWNED } from "../collection/view";
import { CardThumb, useCardPreview } from "../images/picture";
import { usePalette } from "../kit/palette-hook";
import { SectionHeading } from "../../ui/section-heading";
import { cardCorner } from "../../ui/card-corner";
import { longPressA11y } from "../../ui/long-press-action";
import { dropShadowOf } from "../../ui/surfaces";
import type { PictureSource } from "../../play/canvas/table-canvas-types";
import { withAlphaHex } from "../../ui/tokens";
import { useUiScale } from "../../ui/ui-scale";
import { useTableTokens } from "../../ui/use-table-tokens";
import { Text } from "../../ui/text";

export type EditorCard = {
  code: string;
  count: number;
  cost: string | null;
  name: string;
  typeCode: string | null;
  imagesrc: string | null;
  deckLimit: number | null;
  sphereCode: string | null;
  sphereName: string | null;
  // The pile the card is in: the deck, or its side deck. Its stepper changes that pile.
  pile: DraftPile;
};

// The editor's list: Heroes first (its heading, then the hero cards and empty slots), then the card subsections, their cards laid
// out as rows of a grid (`cols` to a row), then the side deck (its heading, a line on what it is for, its cards).
export type EditorRow =
  | Exclude<DeckSectionRow<EditorCard>, { kind: "card" }>
  | { kind: "heroes"; key: string }
  | { kind: "grid"; key: string; cards: EditorCard[] }
  | { kind: "note"; key: string; text: string };

/** A heading the jump chips lead to, with how many cards it holds and the row it starts at. */
export type Jump = { key: string; title: string; count: number; index: number };

export const TYPE_NOUN: Readonly<Record<string, string>> = { hero: "heroes", ally: "allies", attachment: "attachments", event: "events", side: "side deck cards" };

/** The section rows with each run of cards cut into grid rows of `cols`. */
export function gridRows(rows: readonly DeckSectionRow<EditorCard>[], cols: number): EditorRow[] {
  const out: EditorRow[] = [];
  let run: EditorCard[] = [];
  const flush = () => {
    for (let at = 0; at < run.length; at += cols) {
      const first = run[at]!;
      out.push({ kind: "grid", key: `grid-${first.pile === "side" ? "side-" : ""}${first.code}`, cards: run.slice(at, at + cols) });
    }
    run = [];
  };
  for (const row of rows) {
    if (row.kind === "card") run.push(row.card);
    else {
      flush();
      out.push(row);
    }
  }
  flush();
  return out;
}

/**
 * The side deck's rows: its heading, the line that says what it is for (`note`), then its cards by name in rows of `cols`, or the
 * empty row. An empty side deck no contract asks for (`asked` false) is its heading alone, with its Add: most decks never use one.
 */
export function sideRows(cards: readonly EditorCard[], cols: number, note: string, asked: boolean): EditorRow[] {
  const sorted = [...cards].sort((left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code));
  const count = sorted.reduce((sum, card) => sum + card.count, 0);
  const heading: EditorRow = { kind: "type", key: "type-side", type: "side", title: "Side deck", count };
  if (sorted.length === 0 && !asked) return [heading];
  const head: EditorRow[] = [heading, { kind: "note", key: "note-side", text: note }];
  if (sorted.length === 0) return [...head, { kind: "empty", key: "empty-side", type: "side", title: "Side deck" }];
  return [...head, ...gridRows(sorted.map((card) => ({ kind: "card" as const, key: `side-${card.code}`, card })), cols)];
}

/**
 * The cards among `deckCards` whose + would be refused: the title (any printing) is at its copy limit in the card's pile. Worked out
 * once per change of the deck, keyed `pile:code`.
 */
export function refusedCodes(picks: DraftPicks, deckCards: readonly EditorCard[], lookup: TitleLookup): ReadonlySet<string> {
  const out = new Set<string>();
  for (const card of deckCards) {
    const held = targetPicks(picks, card.pile);
    if (draftAddRefused(held, { code: card.code, name: card.name, typeCode: card.typeCode ?? "", deckLimit: card.deckLimit }, lookup, card.pile)) out.add(refusedKey(card));
  }
  return out;
}

/** A card's key in refusedCodes: its pile and code, so a card in both piles is asked about in each. */
export function refusedKey(card: Pick<EditorCard, "pile" | "code">): string {
  return `${card.pile}:${card.code}`;
}

type DeckCardCellProps = {
  card: EditorCard;
  width: number;
  // What the app does not apply of this card ("Ability not applied"), or null.
  loss?: string | null;
  // Outside the player's collection: the strip says "Not owned" (before the loss, which the card screen still shows).
  unowned?: boolean;
  // Whether + would be refused: the title (any printing) is at its copy limit.
  full: boolean;
  lookup: TitleLookup;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
};

// The editor builds a new card object for every card whenever the deck changes; a cell is drawn again only when what it shows changed.
function sameCell(left: DeckCardCellProps, right: DeckCardCellProps): boolean {
  const a = left.card;
  const b = right.card;
  return (
    left.width === right.width &&
    left.full === right.full &&
    (left.loss ?? null) === (right.loss ?? null) &&
    (left.unowned ?? false) === (right.unowned ?? false) &&
    left.lookup === right.lookup &&
    left.onPreview === right.onPreview &&
    a.code === b.code &&
    a.count === b.count &&
    a.cost === b.cost &&
    a.name === b.name &&
    a.typeCode === b.typeCode &&
    a.imagesrc === b.imagesrc &&
    a.deckLimit === b.deckLimit &&
    a.sphereCode === b.sphereCode &&
    a.sphereName === b.sphereName &&
    a.pile === b.pile
  );
}

/**
 * One card of the deck in the grid: its picture, a second card peeking out behind it when the deck holds more than one copy, and the
 * − count + stepper overlapping its foot. A tap opens the card, a long press shows it large.
 */
export const DeckCardCell = memo(function DeckCardCell({ card, width, full, lookup, onPreview, loss = null, unowned = false }: DeckCardCellProps) {
  const router = useRouter();
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const picture = useCardPreview(card.code, card.imagesrc);
  const height = Math.round(width * 1.4);
  const side = card.pile === "side";
  return (
    <View style={{ width, marginBottom: 30 * s }}>
      {card.count > 1 ? <View pointerEvents="none" style={{ position: "absolute", left: 4 * s, top: 4 * s, width, height, borderRadius: cardCorner(width, height), backgroundColor: palette.raised, boxShadow: dropShadowOf(t, 4, 10, 0.8) }} /> : null}
      <Pressable
        testID={side ? `deck-side-card-${card.code}` : `deck-card-${card.code}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${card.name}, ${card.count} in the ${side ? "side deck" : "deck"}${loss ? `, ${loss}` : ""}${unowned ? ", not owned" : ""}`}
        {...longPressA11y("Show card", () => onPreview(card.code, card.name, picture))}
        accessibilityHint="Opens the card. Hold to show it large"
        onPress={() => router.push({ pathname: "/card/[code]", params: { code: card.code } })}
        onLongPress={() => onPreview(card.code, card.name, picture)}
        delayLongPress={350}
      >
        {({ pressed }) => (
          <View style={{ width, height, borderRadius: cardCorner(width, height), overflow: "hidden", opacity: pressed ? 0.8 : 1, backgroundColor: palette.raised, boxShadow: dropShadowOf(t, 8, 18, 0.85) }}>
            <CardThumb code={card.code} imagesrc={card.imagesrc} width={width} height={height} />
            {loss || unowned ? (
              <View className="absolute left-1 right-1 rounded-control px-1 py-0.5" style={{ top: 4 * s, backgroundColor: withAlphaHex(palette.night, 0.82) }}>
                <Text className={`text-center text-micro ${unowned ? "text-moon" : "text-muted"}`} numberOfLines={1}>
                  {unowned ? NOT_OWNED : loss}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      <View className="absolute left-0 right-0 items-center" style={{ top: height - 22 * s }}>
        <CountStepper
          code={card.code}
          name={card.name}
          count={card.count}
          full={full}
          where={side ? "side deck" : undefined}
          ids={side ? { dec: `count-dec-side-${card.code}`, count: `count-side-${card.code}`, inc: `count-inc-side-${card.code}` } : undefined}
          onChange={(delta) => announceDraftChange(changeDraftCount(card.code, card.name, card.deckLimit, delta, lookup, card.pile))}
        />
      </View>
    </View>
  );
}, sameCell);

/**
 * A type's heading in the deck: its name, the rule, its count ("2 of 3" for heroes, against `heroLimit`: four under Bond of Friendship), and Add for a card type (heroes add through their
 * slots). The side deck's heading (`side`) is one too: its Add opens the pool on the side deck.
 */
export function DeckSectionHeader({ type, title, count, heroLimit, onAdd }: { type: string; title: string; count: number; heroLimit?: number; onAdd: (type: string) => void }) {
  const heroSection = type === "hero";
  return (
    <SectionHeading
      title={title}
      className="pb-1 pt-5"
      right={
        <>
          <Text testID={`deck-section-count-${type}`} className="text-label text-faint">
            {heroSection ? `${count} of ${heroLimit ?? 3}` : String(count)}
          </Text>
          {!heroSection && TYPE_NOUN[type] ? (
            <View className="-mr-3">
              <TextButton testID={`deck-add-${type}`} label="Add" tone="accent" accessibilityLabel={`Add ${TYPE_NOUN[type]}`} onPress={() => onAdd(type)} />
            </View>
          ) : null}
        </>
      }
    />
  );
}

/** The chips that jump the deck's list to a heading. Each chip carries its number of cards (Heroes 3, Allies 21). */
export function JumpChips({ jumps, onJump }: { jumps: readonly Jump[]; onJump: (jump: Jump) => void }) {
  return (
    <>
      {jumps.map((jump) => (
        <ToggleChip key={jump.key} testID={`deck-jump-${jump.key}`} label={`${jump.title} ${jump.count}`} accessibilityLabel={`Go to ${jump.title}, ${jump.count}`} onPress={() => onJump(jump)} />
      ))}
    </>
  );
}
