// The web build has no Skia canvas (the same split as src/screens/backdrop.tsx): it lists each zone's cards and each pile
// by name. A tap picks, as on the canvas, and a long press previews; the cards the open moment lets the player tap are
// outlined, the picked ones filled. The phone draws the canvas in table-canvas.native.tsx.
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore } from "zustand";

import { NO_HIGHLIGHT } from "./peek.ts";
import { PILE_WORDS, PILES, hidesFace, isPrisoner, TABLE_ZONES, pileSelector, shownSeat, zoneSelector, type PileId, type ZoneId } from "./selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { tableTokens as t } from "./tokens.ts";

const ZONE_WORD: Record<ZoneId, string> = {
  questStage: "Quest",
  staging: "Staging",
  activeLocation: "Active location",
  secondActiveLocation: "Second active location",
  engaged: "Engaged",
  play: "Play area",
  hand: "Hand",
};

type RowProps = Pick<TableCanvasProps, "store" | "nameOf" | "inactive" | "info" | "onTap" | "onPreview" | "highlight"> & { seat: number };

function CardButton({ id, label, faceDown, onTap, onPreview, highlight }: { id: string; label: string; faceDown: boolean } & Pick<TableCanvasProps, "onTap" | "onPreview" | "highlight">) {
  const picked = highlight.picked.get(id) ?? 0;
  const tappable = highlight.tappable.has(id);
  // The number the open pick draws on the card (the damage a defender would take).
  const mark = highlight.marks.get(id);
  const marked = mark ? ` · ${mark.value} ${mark.icon === "damage" ? "damage" : ""}${mark.danger ? ", destroyed" : ""}`.trimEnd() : "";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked > 0 }}
      onPress={() => onTap(id)}
      onLongPress={faceDown ? undefined : () => onPreview(id)}
      delayLongPress={350}
      className={`min-h-11 justify-center rounded-tile px-2 ${picked > 0 ? "bg-goldLine" : "bg-raised"} ${tappable ? "border border-gold" : ""}`}
      style={({ pressed }) => (pressed ? { backgroundColor: t.hairline } : undefined)}
    >
      <Text className={faceDown ? "text-label text-faint" : "text-label text-bone"}>{`${picked > 1 ? `${label} · ${picked}` : label}${marked}`}</Text>
    </Pressable>
  );
}

// What the canvas draws on a card, in words for the web list: an enemy's engagement cost against the threat, a delayed
// effect to come.
function marksText(info: TableCanvasProps["info"], cardId: string, zone: ZoneId): string {
  if (zone === "hand") return "";
  const slot = info(cardId);
  const engagement = slot.engagement ? ` · engagement ${slot.engagement.cost}, ${slot.engagement.engages ? "engages" : "stays"}` : "";
  return `${engagement}${slot.delayed ? " · an effect comes later" : ""}`;
}

function ZoneRow({ store, zone, seat, nameOf, inactive, info, onTap, onPreview, highlight }: RowProps & { zone: ZoneId }) {
  const select = useMemo(() => zoneSelector(zone, seat), [zone, seat]);
  const view = useStore(store, (state) => select(state.game));
  if (view.entries.length === 0) return null;
  return (
    <View className="mb-2">
      <Text className="text-label text-muted">{ZONE_WORD[zone]}</Text>
      <View className="flex-row flex-wrap gap-1">
        {view.entries.flatMap(({ card, attached, paired }) => [card, ...attached, ...paired]).map((card) => (
          <CardButton
            key={card.id}
            id={card.id}
            faceDown={hidesFace(card)}
            label={isPrisoner(card) ? `Prisoner: ${nameOf(card.code)}, face down` : card.prisoner === true ? "Face down, held with the prisoner" : card.face === "down" ? "Face down" : `${nameOf(card.code)}${card.exhausted ? " (exhausted)" : ""}${inactive(card.code) ? " · Not applied" : ""}${marksText(info, card.id, zone)}`}
            onTap={onTap}
            onPreview={onPreview}
            highlight={highlight}
          />
        ))}
      </View>
    </View>
  );
}

function PileRow({ store, pile, seat, nameOf, onTap, onPreview, highlight }: RowProps & { pile: PileId }) {
  const select = useMemo(() => pileSelector(pile, seat), [pile, seat]);
  const view = useStore(store, (state) => select(state.game));
  const top = view.top ? ` · ${nameOf(view.top.code)} on top` : "";
  // An encounter card attached to the deck (Iron Shackles, 01105:A:1): the list says so, as the canvas draws a chain.
  const held = (view.attached ?? []).length > 0 ? ` · ${(view.attached ?? []).map((card) => nameOf(card.code)).join(", ")} attached` : "";
  return <CardButton id={`pile:${pile}`} faceDown={false} label={`${PILE_WORDS[pile]} (${view.ids.length})${top}${held}`} onTap={onTap} onPreview={onPreview} highlight={highlight} />;
}

export function TableCanvas({ store, width, height, nameOf, inactive, info, onTap, onPreview, highlight: marked }: TableCanvasProps) {
  const seat = useStore(store, (state) => shownSeat(state.game, state.viewedSeat));
  // Peeking at the other seat: nothing is outlined or filled, and a tap only previews (use-table-choice.ts).
  const highlight = useStore(store, (state) => state.viewedSeat != null) ? NO_HIGHLIGHT : marked;
  const rowProps = { store, seat, nameOf, inactive, info, onTap, onPreview, highlight };
  return (
    <ScrollView style={{ width, height, backgroundColor: t.felt }} contentContainerStyle={{ padding: 12 }}>
      {TABLE_ZONES.map((zone) => (
        <ZoneRow key={zone} zone={zone} {...rowProps} />
      ))}
      <View className="flex-row flex-wrap gap-1">
        {PILES.map((pile) => (
          <PileRow key={pile} pile={pile} {...rowProps} />
        ))}
      </View>
    </ScrollView>
  );
}
