// The deck editor's cards as a grid (docs/design-system.md, Deck builder): the editor's rows (a heading, the hero strip, a run of
// cards cut into rows of the grid), one card's cell with its stepper, a section's heading with its count and Add, and the jump chips.
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { TextButton, ToggleChip } from "./chrome";
import { CountStepper } from "./count-stepper";
import { announceDraftChange, changeDraftCount, type TitleLookup } from "./deck-draft";
import type { DeckSectionRow } from "./deck-status";
import { CardThumb, useCardPreview } from "./images/picture";
import { usePalette } from "./palette-hook";
import { SectionHeading } from "../play/section-heading";
import { dropShadowOf } from "../play/surfaces";
import type { PictureSource } from "../play/table-canvas-types";
import { withAlphaHex } from "../play/tokens";
import { useUiScale } from "../play/ui-scale";
import { useTableTokens } from "../play/use-table-tokens";
import { Text } from "../play/text";

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
};

// The editor's list: Heroes first (its heading, then the hero cards and empty slots), then the card subsections, their cards laid
// out as rows of a grid (`cols` to a row).
export type EditorRow = Exclude<DeckSectionRow<EditorCard>, { kind: "card" }> | { kind: "heroes"; key: string } | { kind: "grid"; key: string; cards: EditorCard[] };

/** A heading the jump chips lead to, with how many cards it holds and the row it starts at. */
export type Jump = { key: string; title: string; count: number; index: number };

export const TYPE_NOUN: Readonly<Record<string, string>> = { hero: "heroes", ally: "allies", attachment: "attachments", event: "events" };

/** The section rows with each run of cards cut into grid rows of `cols`. */
export function gridRows(rows: readonly DeckSectionRow<EditorCard>[], cols: number): EditorRow[] {
  const out: EditorRow[] = [];
  let run: EditorCard[] = [];
  const flush = () => {
    for (let at = 0; at < run.length; at += cols) out.push({ kind: "grid", key: `grid-${run[at]!.code}`, cards: run.slice(at, at + cols) });
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
 * One card of the deck in the grid: its picture, a second card peeking out behind it when the deck holds more than one copy, and the
 * − count + stepper overlapping its foot. A tap opens the card, a long press shows it large.
 */
export function DeckCardCell({
  card,
  width,
  full,
  lookup,
  onPreview,
  loss = null,
}: {
  card: EditorCard;
  width: number;
  // What the app does not apply of this card ("Ability not applied"), or null.
  loss?: string | null;
  // Whether + would be refused: the title (any printing) is at its copy limit.
  full: boolean;
  lookup: TitleLookup;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const router = useRouter();
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const picture = useCardPreview(card.code, card.imagesrc);
  const height = Math.round(width * 1.4);
  return (
    <View style={{ width, marginBottom: 30 * s }}>
      {card.count > 1 ? <View pointerEvents="none" style={{ position: "absolute", left: 4 * s, top: 4 * s, width, height, borderRadius: 4, backgroundColor: palette.raised, boxShadow: dropShadowOf(t, 4, 10, 0.8) }} /> : null}
      <Pressable
        testID={`deck-card-${card.code}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${card.name}, ${card.count} in the deck${loss ? `, ${loss}` : ""}`}
        accessibilityHint="Opens the card. Hold to show it large"
        onPress={() => router.push({ pathname: "/card/[code]", params: { code: card.code } })}
        onLongPress={() => onPreview(card.code, card.name, picture)}
        delayLongPress={350}
      >
        {({ pressed }) => (
          <View style={{ width, height, borderRadius: 4, overflow: "hidden", opacity: pressed ? 0.8 : 1, backgroundColor: palette.raised, boxShadow: dropShadowOf(t, 8, 18, 0.85) }}>
            <CardThumb code={card.code} imagesrc={card.imagesrc} width={width} height={height} />
            {loss ? (
              <View className="absolute left-1 right-1 rounded px-1 py-0.5" style={{ top: 4 * s, backgroundColor: withAlphaHex(palette.night, 0.82) }}>
                <Text className="text-center text-micro text-muted" numberOfLines={1}>
                  {loss}
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
          onChange={(delta) => announceDraftChange(changeDraftCount(card.code, card.name, card.deckLimit, delta, lookup))}
        />
      </View>
    </View>
  );
}

/** A type's heading in the deck: its name, the rule, its count ("2 of 3" for heroes), and Add for a card type (heroes add through their slots). */
export function DeckSectionHeader({ type, title, count, onAdd }: { type: string; title: string; count: number; onAdd: (type: string) => void }) {
  const heroSection = type === "hero";
  return (
    <SectionHeading
      title={title}
      className="pb-1 pt-5"
      right={
        <>
          <Text testID={`deck-section-count-${type}`} className="text-label text-faint">
            {heroSection ? `${count} of 3` : String(count)}
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

/** The chips that jump the deck's list to a heading. The count is the screen reader's; the analytics panel shows it on screen. */
export function JumpChips({ jumps, onJump }: { jumps: readonly Jump[]; onJump: (jump: Jump) => void }) {
  return (
    <>
      {jumps.map((jump) => (
        <ToggleChip key={jump.key} testID={`deck-jump-${jump.key}`} label={jump.title} accessibilityLabel={`Go to ${jump.title}, ${jump.count}`} onPress={() => onJump(jump)} />
      ))}
    </>
  );
}
