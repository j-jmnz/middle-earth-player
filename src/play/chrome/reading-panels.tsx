// The reading panels (docs/design-system-table.md, Reading panels; phase 21): a discard pile's cards or the victory display's, a row's
// folded cards, the set-aside cards from the menu, the cards that make up the staging threat from the quest meter, this round's log, the threat panel from a dial and the table settings from the menu. They open in one place, the same tray
// frame (tray-frame.tsx), one at a time: a new one replaces the last (reading.ts). Each has a round ✕ labelled "Close" at its top right and
// closes on a tap outside. The card lists stand on night, each card as the table draws it; the log and the threat panel stay on paper:
// they are what gets read and recorded; the settings panel is on night like the Settings tab. Nothing here sends an intent but a playable
// discard card's play, which the table's own pick sends.
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { CardImage } from "../../ui/card-image.tsx";
import { cardCorner } from "../../ui/card-corner.ts";
import { useFocusRing } from "../../ui/focus-ring.ts";
import { longPressA11y, longPressHint } from "../../ui/long-press-action.ts";
import { LIST_PICTURE, LIST_PICTURE_SMALL, smallPictures } from "../choice/dock/budget.ts";
import { chipOnSurface, dropShadowOf } from "../../ui/surfaces.ts";
import type { PictureSource } from "../canvas/table-canvas-types.ts";
import { withAlphaHex } from "../../ui/tokens.ts";

import { logLineSpeech, type LogLine } from "../store/log.ts";
import { CloseButton, TextButton } from "../../ui/buttons.tsx";
import { LineMark } from "./table-chrome.tsx";
import { SettingRows } from "./setting-row.tsx";
import { PANEL_ROWS, rowsFor } from "./settings-catalog.ts";
import { SETTINGS_PLATFORM } from "./settings-platform.ts";
import { ELIMINATION_THREAT } from "../readouts/threat-level.ts";
import type { DialList } from "../readouts/dials.ts";
import type { TableSettings } from "../../ui/table-settings.ts";
import { capLines, touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";
import { usePanelFocus } from "./use-panel-focus.ts";

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
 * A card in a list: its name (`spoken` is what a screen reader hears of the name when it differs: "Deep Deep Dark, 4 copies" for "Deep Deep Dark ×4"), the line under it (its type and sphere), what a screen reader hears of that line when it differs ("4 victory
 * points" for "4 VP"), and its picture (null for a facedown card or while none is known).
 */
// `group`: the encounter set a set-aside row is listed under (SetAsideList); the cards come in the order of their groups.
export type ListCard = { id: string; label: string; spoken?: string; detail?: string | null; said?: string; picture: PictureSource | null; pictureKey: string; group?: string };

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
  const ring = useFocusRing();
  const box = smallPictures(useWindowDimensions().height, s) ? LIST_PICTURE_SMALL : LIST_PICTURE;
  const w = box.w * s;
  const h = box.h * s;
  // Two lines each at the phone's default text size; larger text grows the row (capLines, ui/ui-scale.ts).
  const cap = capLines(2, useWindowDimensions().fontScale);
  const detail = playable ? "Playable now · tap to play" : (card.detail ?? null);
  // The tap is in the hint ("Plays it"), so the label says only that the card can be played.
  const said = playable ? "Playable now" : (card.said ?? detail);
  return (
    <Pressable
      {...ring.props}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: playable }}
      accessibilityLabel={[card.spoken ?? card.label, said].filter(Boolean).join(". ")}
      {...(onLongPress ? longPressA11y("Show card", onLongPress) : null)}
      accessibilityHint={[playable ? "Plays it" : "Shows the card", onLongPress ? longPressHint("Show card") : null].filter(Boolean).join(". ")}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {({ pressed }) => (
        <View
          className="mb-1 flex-row items-center rounded-item px-1.5 py-1"
          style={{ gap: 12 * s, minHeight: touch(s, 48), ...(pressed ? { backgroundColor: t.pressed } : playable ? chipOnSurface(t) : { backgroundColor: "transparent" }), ...ring.style }}
        >
          <View style={{ width: w, height: h, borderRadius: cardCorner(w, h), ...(playable ? { boxShadow: `0 0 0 2px ${t.accent}, 0 0 12px 2px ${withAlphaHex(t.accent, 0.55)}` } : { boxShadow: dropShadowOf(t, 3, 8, 0.8) }) }}>
            {card.picture ? (
              <CardImage source={card.picture} recyclingKey={`${card.pictureKey}:list`} width={w} height={h} />
            ) : (
              <View style={{ width: w, height: h, borderRadius: cardCorner(w, h), backgroundColor: t.raised }} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={cap} className="font-display text-body" style={{ color: playable ? t.accentHigh : t.bone }}>
              {card.label}
            </Text>
            {detail ? (
              <Text numberOfLines={cap} className="mt-0.5 text-label" style={{ color: playable ? t.accent : t.faint }}>
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
  const focus = usePanelFocus();
  return (
    <View style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
      <Text className="text-center font-display text-eyebrow uppercase text-faint">{count}</Text>
      <Text ref={focus} accessibilityRole="header" className="mt-1 text-center font-display text-title text-bone">
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
 * The set-aside cards, from the menu's row (store/set-aside.ts), on the frame of a discard pile's list. The head counts every card and says where they are ("21 cards · out of play").
 * The cards the scenario hides come first, as one line that is no button, "2 cards are facedown": no name, picture or type. Then each printed card the players may read, by name,
 * its copies on one row ("Deep Deep Dark ×4"); a row shows the card large and sends nothing. Cards of more than one encounter set are grouped under the set's name, as the Aside dial's panel lists them (Reading panels).
 */
export function SetAsideList({ title, head, cards, facedown, onRead, onClose }: { title: string; head: string; cards: readonly ListCard[]; facedown: string | null; onRead: (cardId: string) => void; onClose: () => void }) {
  return (
    <View testID="set-aside-list" collapsable={false} style={{ flexShrink: 1 }}>
      <ListHead count={head} title={title} />
      <PanelClose testID="set-aside-list-close" onPress={onClose} paper={false} />
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 && !facedown ? <Text className="text-center text-body text-muted">No card is set aside.</Text> : null}
        {facedown ? <FacedownRow words={facedown} /> : null}
        {cards.map((card, at) => (
          <View key={card.id}>
            {card.group != null && card.group !== cards[at - 1]?.group ? (
              <Text testID={`set-aside-group-${card.group}`} accessibilityRole="header" className="mb-1 mt-2 px-1.5 font-display text-eyebrow uppercase text-faint">
                {card.group}
              </Text>
            ) : null}
            <CardRow card={card} playable={false} testID={`set-aside-card-${card.id}`} onPress={() => onRead(card.id)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// The facedown cards of the Set aside list: a card back's plate where a row has its picture, and the count as a sentence in the body face, muted, so it does not read as a card's
// name or as a row to tap. Text, not a button: there is nothing to open.
function FacedownRow({ words }: { words: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const box = smallPictures(useWindowDimensions().height, s) ? LIST_PICTURE_SMALL : LIST_PICTURE;
  const w = box.w * s;
  const h = box.h * s;
  return (
    <View testID="set-aside-facedown" accessible accessibilityRole="text" accessibilityLabel={words} className="mb-1 flex-row items-center px-1.5 py-1" style={{ gap: 12 * s, minHeight: touch(s, 48) }}>
      <View style={{ width: w, height: h, borderRadius: cardCorner(w, h), backgroundColor: t.raised }} />
      <Text className="min-w-0 flex-1 text-body text-muted">{words}</Text>
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
/** The panel a scenario dial opens: its headed lists of names (the Investigation List's checked off and not checked off), on paper, with the dial's note at the foot. Text only. */
export function DialPanel({ title, lists, said, note, onClose }: { title: string; lists: readonly DialList[]; said: string; note: string | null; onClose: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const focus = usePanelFocus();
  return (
    <View testID="dial-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View ref={focus} accessible accessibilityRole="header" accessibilityLabel={said} className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        <Text className="font-display text-title text-ink">{title}</Text>
      </View>
      <PanelClose testID="dial-panel-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        {lists.map((list) => (
          <View key={list.heading} testID={`dial-list-${list.heading}`} className="border-b py-2" style={{ borderColor: t.inkLine }}>
            <Text className="font-display text-eyebrow uppercase text-inkLabel">{list.heading}</Text>
            <Text className="mt-0.5 text-body text-ink">{list.lines.length > 0 ? list.lines.join(", ") : "None"}</Text>
          </View>
        ))}
        {note ? <Text className="mt-2 text-label text-inkMuted">{note}</Text> : null}
      </ScrollView>
    </View>
  );
}

export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  // The log reads oldest first; a screen reader's focus opens on the newest line (the header when there is none).
  const focus = usePanelFocus();
  return (
    <View testID="log-sheet" collapsable={false} style={{ flexShrink: 1 }}>
      <View className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        <Text ref={lines.length === 0 ? focus : undefined} accessibilityRole="header" accessibilityLabel={`Log, round ${round}`} className="font-display text-title text-ink">
          Log
        </Text>
      </View>
      <PanelClose testID="log-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        {lines.length === 0 ? <Text className="text-center text-body text-inkMuted">Nothing has happened this round yet.</Text> : null}
        {lines.map((line, index) => (
          <View key={line.key} ref={index === lines.length - 1 ? focus : undefined} testID={`log-line-${line.key}`} accessible accessibilityLabel={logLineSpeech(line)} className="border-b py-2" style={{ borderColor: t.inkLine }}>
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
  limit,
  rows,
  held,
  onClose,
}: {
  // "Player 2" in two-handed play, else null.
  seatLabel: string | null;
  threat: number;
  // The elimination level: 99 while the main quest has Dire (mec113.dire); the usual one when absent.
  limit?: number;
  rows: readonly { id: string; name: string; cost: number; verdict: { word: string; engages: boolean } }[];
  // What the seat's dial says of a hero it has lost to the staging area or an Orc ("Legolas is in the staging area"), in the same words: the dial's glyph is too small to read.
  held?: readonly string[];
  onClose: () => void;
}) {
  const s = useUiScale();
  const focus = usePanelFocus();
  const of = limit ?? ELIMINATION_THREAT;
  return (
    <View testID="threat-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View ref={focus} accessible accessibilityRole="header" accessibilityLabel={`${seatLabel ? `${seatLabel}, ` : ""}Threat ${threat} of ${of}`} className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        {seatLabel ? <Text className="font-display text-eyebrow uppercase text-inkLabel">{seatLabel}</Text> : null}
        <Text className="mt-1 font-display text-title text-ink">Threat</Text>
        <Text className="font-display text-heading text-inkMuted">{`${threat} of ${of}`}</Text>
      </View>
      <PanelClose testID="threat-panel-close" onPress={onClose} />
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text className="text-body text-inkMuted">{`At the engagement checks, each enemy in staging whose engagement cost is at or below your threat engages you. At ${of} you are eliminated.`}</Text>
        {(held ?? []).map((words) => (
          <Text key={words} testID="threat-held" className="mt-2 text-body text-ink">{`${words}.`}</Text>
        ))}
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
 * The table's settings, a night side panel from the menu's Table settings: the settings a player changes during a game (settings-catalog.ts,
 * PANEL_ROWS; user decision, 2026-11-21), the Settings pages' own rows (setting-row.tsx) under a left-aligned title. At the end of the rows,
 * All settings opens Settings (the game is saved); the round ✕ closes the panel. Text and switches only; nothing here sends an intent.
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
  const focus = usePanelFocus();
  return (
    <View testID="settings-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View style={{ paddingRight: CLOSE_CLEAR * s }}>
        <Text ref={focus} accessibilityRole="header" className="font-display text-title text-bone">
          Table settings
        </Text>
      </View>
      <PanelClose testID="settings-close" onPress={onClose} paper={false} />
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator persistentScrollbar>
        <View style={{ gap: 4 * s }} testID="settings-rows">
          <SettingRows rows={rowsFor(PANEL_ROWS, SETTINGS_PLATFORM)} settings={settings} onChange={onChange} always={always} testPrefix="settings" />
        </View>
        {/* The last item of the scroll content, not a pinned footer: at Extra large on a short phone the rows take the room. */}
        <View className="-ml-3 items-start pt-2">
          <TextButton tone="accent" label="All settings" accessibilityLabel="All settings. Opens Settings and leaves the table" testID="settings-all" onPress={onAllSettings} />
        </View>
      </ScrollView>
    </View>
  );
}
