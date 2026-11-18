// The table for a screen reader on the phone (docs/design-system-table.md, Screen reader): a native list in place of the Skia canvas
// (table-canvas.native.tsx chooses it under useReaderMode). The zones are headings, in the order reader-table-rows.ts gives, and a card is a
// button that says its whole state and what a tap does now (card-speech.ts). A double tap is the canvas tap (`onTap`), and the custom action
// "Show card" is the long press (`onPreview`). It reads the same selectors as the canvas, for a sighted helper's glance too.
import { useLayoutEffect } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useStore } from "zustand";

import type { ScenarioState } from "../../rules/core/state.ts";

import type { CardSpeechDeps } from "../words/card-speech.ts";
import { cardSpeech } from "../words/card-speech.ts";
import { lookIdsOf } from "../words/scenarios/wilderland.ts";
import { beatIds } from "../store/beat-store.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { useReaderGateEnd } from "../spotlight/reader-gate.ts";
import { tableVisibility } from "../choice/panel-visibility.ts";
import { useReaderPanelOpen } from "../choice/reader-panel.ts";
import { hidesFace, isDead, shownSeat } from "../store/selectors.ts";
import type { ReaderSeed, TableCanvasProps } from "./table-canvas-types.ts";
import { readerRows, type ReaderItem } from "./reader-table-rows.ts";
import { useBannerHeight } from "../readouts/banner-height.ts";
import { useFocusRing } from "../../ui/focus-ring.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

type ReaderProps = Pick<TableCanvasProps, "store" | "width" | "height" | "bottomInset" | "nameOf" | "inactive" | "facts" | "info" | "beats" | "onTap" | "onPreview" | "highlight"> & { readerSeed: ReaderSeed };

const SHOW_CARD = [{ name: "show", label: "Show card" }];
// The hint of a card the open pick does not ask about.
const NOT_PART = "Not part of this choice. Double tap to show the card.";
const OPEN_LIST = [{ name: "open", label: "Open the list" }];

type ButtonProps = {
  id: string;
  // The stable id a test taps: the card's place in its zone, or the pile's name; a card's own id changes from game to game.
  testID: string;
  label: string;
  hint: string | null;
  picked: number;
  glows: boolean;
  dimmed: boolean;
  muted: boolean;
  faint: boolean;
  actions: typeof SHOW_CARD | null;
  onAction: (name: string) => void;
  onTap: (id: string) => void;
};

// One button: the card's or pile's words, 44 pt high at least. `dimmed`: a pick is open and does not ask about it (drawn faint and told in its hint; it is
// not disabled, since TalkBack may then block its click and actions, and a double tap still goes to the canvas tap, which opens the card large). The pressed fill is on a view inside: NativeWind drops a style function on a
// Pressable that also has a className.
function ReaderButton({ id, testID, label, hint, picked, glows, dimmed, muted, faint, actions, onAction, onTap }: ButtonProps) {
  const t = useTableTokens();
  const ring = useFocusRing();
  return (
    <Pressable
      {...ring.props}
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint ?? undefined}
      accessibilityState={{ selected: picked > 0 }}
      accessibilityActions={actions ?? undefined}
      onAccessibilityAction={(event) => onAction(event.nativeEvent.actionName)}
      onPress={() => onTap(id)}
    >
      {({ pressed }) => (
        // The ring is on a view of its own so a dimmed row's opacity does not fade it.
        <View className="rounded-item" style={ring.style}>
          <View
            className={`min-h-touch justify-center rounded-item px-2 py-1 ${picked > 0 ? "bg-accentLine" : "bg-raised"} ${glows ? "border border-accent" : ""} ${dimmed || muted ? "opacity-60" : ""}`}
            style={pressed ? { backgroundColor: t.hairline } : undefined}
          >
            <Text className={faint ? "text-label text-faint" : "text-label text-bone"}>{label}</Text>
            {hint ? <Text className="text-label text-muted">{hint}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function Item({ item, place, game, seat, deps, onTap, onPreview }: { item: ReaderItem; place: number; game: ScenarioState; seat: number; deps: CardSpeechDeps } & Pick<ReaderProps, "onTap" | "onPreview">) {
  const highlight = deps.highlight;
  if (item.kind === "text") return <Text className="text-label text-bone">{item.text}</Text>;
  if (item.kind === "pile") {
    return (
      <ReaderButton
        id={item.id}
        testID={`reader-pile-${item.pile}`}
        label={item.label}
        hint={item.hint}
        picked={highlight.picked.get(item.id) ?? 0}
        glows={highlight.tappable.has(item.id)}
        dimmed={highlight.dimOthers && !highlight.tappable.has(item.id)}
        muted={false}
        faint={false}
        actions={item.opens ? OPEN_LIST : null}
        onAction={() => onTap(item.id)}
        onTap={onTap}
      />
    );
  }
  const card = game.cards[item.id];
  // A Reanimated Dead is facedown, but its owner knows it: it opens a preview that says what it is (realm-preview.ts).
  const faceDown = hidesFace(card) && !isDead(card);
  const said = cardSpeech(game, seat, item.id, deps);
  const dimmed = highlight.dimOthers && !highlight.tappable.has(item.id);
  return (
    <ReaderButton
      id={item.id}
      testID={`reader-card-${item.zone}-${place}`}
      label={said.label}
      hint={dimmed && !faceDown && !highlight.muted.has(item.id) ? NOT_PART : said.hint}
      picked={highlight.picked.get(item.id) ?? 0}
      glows={highlight.tappable.has(item.id)}
      dimmed={dimmed}
      muted={highlight.muted.has(item.id)}
      faint={faceDown}
      actions={faceDown ? null : SHOW_CARD}
      onAction={(name) => {
        if (name === "show") onPreview(item.id);
      }}
      onTap={onTap}
    />
  );
}

export function ReaderTable({ store, width, height, bottomInset, nameOf, inactive, facts, info, beats, onTap, onPreview, highlight: marked, readerSeed }: ReaderProps) {
  const s = useUiScale();
  // No canvas plays the spotlight here, so the gate of an attack ends at once.
  useReaderGateEnd(store);
  // A reading panel over the table is modal on iOS; Android hides the table from TalkBack while it is open (reader-panel.ts).
  const panelOpen = useReaderPanelOpen();
  // The outcome banner lies over the table's top; while it is up the rows start under it, so a focused row is never covered (banner-height.ts).
  const banner = useBannerHeight();
  const seat = useStore(store, (state) => shownSeat(state.game, state.viewedSeat));
  const game = useStore(store, (state) => state.game);
  // Peeking at the other seat: nothing is outlined, a tap only previews (use-table-choice.ts).
  const peeking = useStore(store, (state) => state.viewedSeat != null);
  const highlight = peeking ? NO_HIGHLIGHT : marked;
  // The cards the banner's Discover beat lays in the look strip.
  const beatKey = useStore(beats, (state) => state.key);
  const discover = peeking ? 0 : lookIdsOf(beatIds(beatKey)).length;
  // No row of this table is folded away: every card is a button, so the pick reaches all of them (row-fold.ts).
  useLayoutEffect(() => {
    store.getState().setRowFolds({ staging: [], engaged: [] });
  }, [store]);
  const deckFaceUp = useStore(store, (state) => state.faceUpDecks.includes(seat));
  const rows = readerRows(game, seat, { facts, cards: readerSeed.cards, nameOf, playable: highlight.tappable, discover, deckFaceUp });
  const deps: CardSpeechDeps = { nameOf, inactive, facts, info, highlight, cards: readerSeed.cards, sheet: readerSeed.sheet, peeking };
  return (
    <ScrollView testID="reader-table" importantForAccessibility={tableVisibility(Platform.OS, panelOpen)} style={{ width, height }} contentContainerStyle={{ padding: 12 * s, paddingTop: 12 * s + banner, paddingBottom: 12 * s + bottomInset }}>
      {rows.map((section) => (
        <View key={section.key} className="mb-3 gap-1">
          {section.heading ? (
            <Text testID={`reader-zone-${section.key}`} accessibilityRole="header" className="text-label text-muted">
              {section.heading}
            </Text>
          ) : null}
          {section.items.map((item, index) => (
            <Item key={item.kind === "text" ? `text:${index}` : item.id} item={item} place={section.items.slice(0, index).filter((before) => before.kind === "card").length} game={game} seat={seat} deps={deps} onTap={onTap} onPreview={onPreview} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
