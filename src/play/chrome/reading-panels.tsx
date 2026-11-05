// The reading panels (docs/design-system-table.md, Reading panels; phase 21): a discard pile's cards or the victory display's, a row's
// folded cards, the cards that make up the staging threat from the quest meter, this round's log, the threat panel from a dial and the table settings from the menu. They open in one place, the same tray
// frame (tray-frame.tsx), one at a time: a new one replaces the last (reading.ts). Each has a round ✕ labelled "Close" at its top right and
// closes on a tap outside. The card lists stand on night, each card as the table draws it; the log and the threat panel stay on paper:
// they are what gets read and recorded; the settings panel is on night like the Settings tab. Nothing here sends an intent but a playable
// discard card's play, which the table's own pick sends.
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { CardImage } from "../../ui/card-image.tsx";
import { cardCorner } from "../../ui/card-corner.ts";
import { LIST_PICTURE, LIST_PICTURE_SMALL, smallPictures } from "../choice/dock/budget.ts";
import { chipOnSurface, dropShadowOf } from "../../ui/surfaces.ts";
import type { PictureSource } from "../canvas/table-canvas-types.ts";
import { withAlphaHex } from "../../ui/tokens.ts";

import { logLineSpeech, type LogLine } from "../store/log.ts";
import { CloseButton, TextButton } from "../../ui/buttons.tsx";
import { LineMark } from "./table-chrome.tsx";
import { SettingsRows } from "./setting-rows.tsx";
import type { TableSettings } from "../../ui/table-settings.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

// The round ✕ at a panel's top right, level with its title: a 44 pt target that sits in the frame's padding. The header keeps this much
// clear at each side so a long title never runs under it.
const CLOSE_CLEAR = 44;

function PanelClose({ testID, onPress, paper = true }: { testID: string; onPress: () => void; paper?: boolean }) {
  const s = useUiScale();
  return (
    <View style={{ position: "absolute", top: -6 * s, right: -6 * s }}>
      <CloseButton testID={testID} onPress={onPress} paper={paper} />
    </View>
  );
}

/**
 * A card in a list: its name, the line under it (its type and sphere), what a screen reader hears of that line when it differs ("4 victory
 * points" for "4 VP"), and its picture (null for a facedown card or while none is known).
 */
export type ListCard = { id: string; label: string; detail?: string | null; said?: string; picture: PictureSource | null; pictureKey: string };

/**
 * One card of a list, on the night panel (docs/design-system-table.md, Reading panels): its picture as the table draws it, its name in
 * Marcellus SC and its type and sphere in faint under it. A tap shows it large, or, for a card the open window lets the seat play from its
 * discard pile, opens its play (it glows as on the table, its row is washed in the accent and says "Playable now"); a long press still shows it large.
 */
function CardRow({ card, playable, testID, onPress, onLongPress }: { card: ListCard; playable: boolean; testID: string; onPress: () => void; onLongPress?: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  // The table's card on a tablet, the smaller picture on a phone, as the choice's rows (dock/budget.ts, smallPictures); a card's corners. A facedown
  // card or a missing file is a raised plate.
  const box = smallPictures(useWindowDimensions().height, s) ? LIST_PICTURE_SMALL : LIST_PICTURE;
  const w = box.w * s;
  const h = box.h * s;
  const detail = playable ? "Playable now · tap to play" : (card.detail ?? null);
  const said = playable ? detail : (card.said ?? detail);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: playable }}
      accessibilityLabel={[card.label, said].filter(Boolean).join(". ")}
      accessibilityHint={playable ? "Tap to play it. Hold to read the card" : "Shows the card"}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {({ pressed }) => (
        <View
          className="mb-1 flex-row items-center rounded-item px-1.5 py-1"
          style={{ gap: 12 * s, minHeight: touch(s, 48), ...(pressed ? { backgroundColor: t.pressed } : playable ? chipOnSurface(t) : { backgroundColor: "transparent" }) }}
        >
          <View style={{ width: w, height: h, borderRadius: cardCorner(w, h), ...(playable ? { boxShadow: `0 0 0 2px ${t.accent}, 0 0 12px 2px ${withAlphaHex(t.accent, 0.55)}` } : { boxShadow: dropShadowOf(t, 3, 8, 0.8) }) }}>
            {card.picture ? (
              <CardImage source={card.picture} recyclingKey={`${card.pictureKey}:list`} width={w} height={h} />
            ) : (
              <View style={{ width: w, height: h, borderRadius: cardCorner(w, h), backgroundColor: t.raised }} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={2} className="font-display text-body" style={{ color: playable ? t.accentHigh : t.bone }}>
              {card.label}
            </Text>
            {detail ? (
              <Text numberOfLines={2} className="mt-0.5 text-label" style={{ color: playable ? t.accent : t.faint }}>
                {detail}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

// A list's head: the count over the title, centred clear of the round ✕.
function ListHead({ count, title }: { count: string; title: string }) {
  const s = useUiScale();
  return (
    <View style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
      <Text className="text-center font-display text-eyebrow uppercase text-faint">{count}</Text>
      <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-bone">
        {title}
      </Text>
    </View>
  );
}

/**
 * A discard pile's cards or the victory display's, on the night panel: the cards the open window lets the seat play from the pile
 * (Elven-light) first, then the rest, the one on top first. A tap shows a card large; a playable card's tap opens its play, as a tap on a
 * hand card does, and a long press still shows it large.
 */
export function PileList({
  title,
  cards,
  playable = [],
  onRead,
  onPlay,
  onClose,
}: {
  title: string;
  cards: readonly ListCard[];
  playable?: readonly string[];
  onRead: (cardId: string) => void;
  onPlay?: (cardId: string) => void;
  onClose: () => void;
}) {
  const plays = onPlay ? playable : [];
  const ordered = [...cards.filter((card) => plays.includes(card.id)), ...cards.filter((card) => !plays.includes(card.id))];
  return (
    <View testID="pile-list" collapsable={false} style={{ flexShrink: 1 }}>
      <ListHead count={`${cards.length} ${cards.length === 1 ? "card" : "cards"}`} title={title} />
      <PanelClose testID="pile-list-close" onPress={onClose} paper={false} />
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-muted">The pile is empty.</Text> : null}
        {ordered.map((card) =>
          plays.includes(card.id) && onPlay ? (
            <CardRow key={card.id} card={card} playable testID={`pile-card-${card.id}`} onPress={() => onPlay(card.id)} onLongPress={() => onRead(card.id)} />
          ) : (
            <CardRow key={card.id} card={card} playable={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
          ),
        )}
      </ScrollView>
    </View>
  );
}

/**
 * A row's folded cards (row-fold.ts): the cards that left staging or the engagement area for the fold stack, left to right, on the night
 * panel like a discard pile's list. A row shows the card large and sends nothing.
 */
export function RowList({ title, cards, onRead, onClose }: { title: string; cards: readonly ListCard[]; onRead: (cardId: string) => void; onClose: () => void }) {
  return (
    <View testID="row-list" collapsable={false} style={{ flexShrink: 1 }}>
      <ListHead count={`${cards.length} more ${cards.length === 1 ? "card" : "cards"}`} title={title} />
      <PanelClose testID="row-list-close" onPress={onClose} paper={false} />
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-muted">Nothing is folded away.</Text> : null}
        {cards.map((card) => (
          <CardRow key={card.id} card={card} playable={false} testID={`row-card-${card.id}`} onPress={() => onRead(card.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The cards that make up the staging threat, from a tap on the quest meter (threat-sources.ts): the total over the title, then each card
 * on the night panel like a row's list, the most Threat first, its line saying the Threat it adds; under them what held effects add or
 * take. A row shows the card large and sends nothing.
 */
export function ThreatSourceList({ title, total, cards, adjust, onRead, onClose }: { title: string; total: number; cards: readonly ListCard[]; adjust: string | null; onRead: (cardId: string) => void; onClose: () => void }) {
  return (
    <View testID="threat-sources" collapsable={false} style={{ flexShrink: 1 }}>
      <ListHead count={`${total} Threat`} title={title} />
      <PanelClose testID="threat-sources-close" onPress={onClose} paper={false} />
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-muted">No card adds Threat.</Text> : null}
        {cards.map((card) => (
          <CardRow key={card.id} card={card} playable={false} testID={`threat-source-${card.id}`} onPress={() => onRead(card.id)} />
        ))}
        {adjust ? (
          <Text testID="threat-sources-adjust" className="mt-1 text-center text-label text-muted">
            {adjust}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View testID="log-sheet" collapsable={false} style={{ flexShrink: 1 }}>
      <View className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        <Text accessibilityRole="header" accessibilityLabel={`Log, round ${round}`} className="font-display text-title text-ink">
          Log
        </Text>
      </View>
      <PanelClose testID="log-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        {lines.length === 0 ? <Text className="text-center text-body text-inkMuted">Nothing has happened this round yet.</Text> : null}
        {lines.map((line) => (
          <View key={line.key} testID={`log-line-${line.key}`} accessible accessibilityLabel={logLineSpeech(line)} className="border-b py-2" style={{ borderColor: t.inkLine }}>
            <View className="flex-row items-center gap-2">
              <LineMark mark={line.mark} />
              <Text className="shrink text-body text-ink">{line.text}</Text>
            </View>
            {line.cause ? <Text className="mt-0.5 text-label text-inkMuted">{line.cause}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The threat panel a tap on the dial opens: the seat's threat against the elimination level, each enemy in staging with its
 * engagement cost and whether the engagement checks engage it at this threat, and what the round still adds (rr.engagement-check,
 * rr.refresh-phase, rr.threat-elimination-level). Text only.
 */
export function ThreatPanel({
  seatLabel,
  threat,
  rows,
  onClose,
}: {
  // "Player 2" in two-handed play, else null.
  seatLabel: string | null;
  threat: number;
  rows: readonly { id: string; name: string; cost: number; verdict: { word: string; engages: boolean } }[];
  onClose: () => void;
}) {
  const s = useUiScale();
  return (
    <View testID="threat-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View accessible accessibilityRole="header" accessibilityLabel={`${seatLabel ? `${seatLabel}, ` : ""}Threat ${threat} of 50`} className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        {seatLabel ? <Text className="font-display text-eyebrow uppercase text-inkLabel">{seatLabel}</Text> : null}
        <Text className="mt-1 font-display text-title text-ink">Threat</Text>
        <Text className="font-display text-heading text-inkMuted">{`${threat} of 50`}</Text>
      </View>
      <PanelClose testID="threat-panel-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text className="text-body text-inkMuted">At the engagement checks, each enemy in staging whose engagement cost is at or below your threat engages you. At 50 you are eliminated.</Text>
        {rows.length === 0 ? <Text className="mt-2 text-body text-inkMuted">No enemy is in staging.</Text> : null}
        {rows.map((row) => (
          <View
            key={row.id}
            testID={`threat-row-${row.id}`}
            accessible
            accessibilityLabel={`${row.name}, engagement cost ${row.cost}, ${row.verdict.word}`}
            className="flex-row items-center justify-between py-2"
          >
            <Text className="shrink text-body text-ink">{row.name}</Text>
            <Text className={`font-display text-body ${row.verdict.engages ? "text-ink" : "text-inkMuted"}`}>{`${row.cost} · ${row.verdict.word}`}</Text>
          </View>
        ))}
        <Text className="mt-2 text-label text-inkMuted">The refresh phase raises your threat by 1 at the end of the round; a failed quest raises it by what it falls short.</Text>
      </ScrollView>
    </View>
  );
}

/**
 * The table's settings, a night side panel from the menu's Table settings (user request, 2026-10-28): the Settings tab's own grouped rows
 * (setting-rows.tsx) under a left-aligned title, minus Stops on, which the rail's carousel carries. At the foot, All settings opens the
 * Settings tab (the game is saved) and Close closes the panel. Text and switches only; nothing here sends an intent.
 */
export function SettingsPanel({
  settings,
  always,
  onChange,
  onAllSettings,
  onClose,
}: {
  settings: TableSettings;
  // The free Responses set to Always, by name: tap to have the table ask again.
  always: readonly { effectId: string; label: string }[];
  onChange: (change: Partial<TableSettings>) => void;
  onAllSettings: () => void;
  onClose: () => void;
}) {
  const s = useUiScale();
  return (
    <View testID="settings-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View style={{ paddingRight: CLOSE_CLEAR * s }}>
        <Text accessibilityRole="header" className="font-display text-title text-bone">
          Table settings
        </Text>
      </View>
      <PanelClose testID="settings-close" onPress={onClose} paper={false} />
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator persistentScrollbar>
        <SettingsRows settings={settings} onChange={onChange} always={always} testPrefix="settings" first />
      </ScrollView>
      <View className="-ml-3 items-start pt-2">
        <TextButton tone="accent" label="All settings" accessibilityLabel="All settings. Opens Settings and leaves the table" testID="settings-all" onPress={onAllSettings} />
      </View>
    </View>
  );
}
