// The paper panels that slide in from the right of the landscape table: a choice whose options are not cards on the table
// (an either/or of an effect, a seat, a card out of play), a discard pile's cards, and this round's log
// (docs/design-system.md, Table). A panel's tiles are picked the same way as cards on the table, and its buttons are the
// dock's: one that sends with nothing picked asks for a second tap.
import { ScrollView, Text, View } from "react-native";

import type { LogLine } from "./log.ts";
import { ChromeButton, ConfirmButton, SheetFrame, Stats, Tile, Why } from "./sheet-paper.tsx";
import type { Sheet, SheetOption, SheetStat } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";
import { choiceFor, marked, shareFor, type Choice, type Dock, type DockButton } from "./table-choice.ts";
import { LineMark } from "./table-chrome.tsx";

type TileRow = { id: string; tapId: string; label: string; detail: string | null; stats: readonly SheetStat[] };

// The tiles of a sheet: each option, a trigger with its timing and printed line.
function tilesOf(sheet: Sheet): TileRow[] {
  const plain = (item: SheetOption): TileRow => ({ id: item.id, tapId: item.id, label: item.label, detail: null, stats: item.stats ?? [] });
  switch (sheet.kind) {
    case "pick":
    case "multi":
    case "distribute":
      return sheet.options.map(plain);
    case "trigger":
      return sheet.options.map((item) => ({ id: item.id, tapId: item.cardId, label: `${item.label} · ${item.timing}`, detail: item.text, stats: [] }));
    case "window":
    case "outcome":
      return [];
  }
}

function header(sheet: Sheet): { step: string; title: string; note: string | null; stats: readonly SheetStat[] } {
  switch (sheet.kind) {
    case "pick":
    case "multi":
      return { step: sheet.step, title: sheet.title, note: sheet.note, stats: sheet.stats ?? [] };
    case "distribute":
    case "trigger":
    case "window":
      return { step: sheet.step, title: sheet.title, note: sheet.note, stats: [] };
    case "outcome":
      return { step: sheet.result === "won" ? "Resolution" : "Scenario", title: sheet.title, note: sheet.note, stats: [] };
  }
}

function Grabber() {
  return <View className="mb-2 h-10 w-1 self-start rounded-pill bg-inkLine" style={{ position: "absolute", left: 6, top: "45%" }} />;
}

/** A choice on paper: its tiles, picked like cards on the table, and the dock's buttons. */
export function SidePanel({
  sheet,
  held,
  dock,
  threat,
  refusal,
  onTile,
  onButton,
  onFold,
  onRead,
}: {
  sheet: Sheet;
  held: Choice | null;
  dock: Dock;
  threat: string;
  refusal: string | null;
  // A tap on a tile: the same as a tap on that card on the table.
  onTile: (cardId: string) => void;
  onButton: (button: DockButton) => void;
  // Folds the panel so the table under it can be read; the dock brings it back.
  onFold: () => void;
  // Shows a card large, for a tile or the card the moment is about.
  onRead: ((cardId: string) => void) | null;
}) {
  const head = header(sheet);
  const choice = choiceFor(sheet, held);
  const marks = marked(sheet, choice);
  const unavailable = sheet.kind === "pick" ? (sheet.unavailable ?? []) : [];
  const about = sheet.kind === "pick" ? (sheet.about ?? []) : sheet.kind === "trigger" && sheet.sourceId ? [sheet.sourceId] : [];
  const ready = dock.primary != null && dock.why == null && dock.primary.action.kind !== "clear";
  const tiles = tilesOf(sheet);
  return (
    <SheetFrame testID="sheet" edge="right">
      <Grabber />
      <View className="items-center">
        <Text testID="sheet-step" className="font-display text-eyebrow uppercase text-inkLabel">
          {head.step}
        </Text>
        <Text testID="sheet-title" accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
          {head.title}
        </Text>
        {head.stats.length > 0 ? (
          <View className="mt-1">
            <Stats stats={head.stats} testID="sheet-stats" />
          </View>
        ) : null}
        {head.note ? (
          <Text testID="sheet-note" className="mt-1 text-center text-body text-inkMuted">
            {head.note}
          </Text>
        ) : null}
        <Text testID="sheet-threat" className="mt-1 font-display text-label text-inkLabel">
          {threat}
        </Text>
        {onRead && about.length > 0 ? <ChromeButton label="Read the card" testID="sheet-inspect" tone="ink" onPress={() => about[0] && onRead(about[0])} /> : null}
      </View>
      <ScrollView className="mt-2" contentContainerClassName="pb-1" style={{ flexShrink: 1 }}>
        {tiles.map((tile) => {
          const share = shareFor(sheet, choice, tile.id);
          const selected = sheet.kind === "trigger" ? choice.ids.includes(tile.id) : (marks.get(tile.tapId) ?? 0) > 0;
          return (
            <Tile
              key={tile.id}
              label={sheet.kind === "distribute" ? `${tile.label} · ${share}` : tile.label}
              detail={tile.detail}
              stats={tile.stats}
              selected={selected}
              testID={sheet.kind === "trigger" ? `sheet-trigger-${tile.tapId}` : `sheet-option-${tile.id}`}
              onPress={() => onTile(tile.tapId)}
            />
          );
        })}
        {/* What the rules refuse now, and why (Weathertop's Travel cost): text, not a choice. */}
        {unavailable.map((item) => (
          <View key={item.id} testID={`sheet-unavailable-${item.id}`} accessible accessibilityLabel={`${item.label}. ${item.reason}`} className="mb-2 rounded-tile px-4 py-2" style={{ borderWidth: 1, borderColor: t.inkLine, borderStyle: "dashed" }}>
            <Text className="text-body text-inkMuted">{item.label}</Text>
            <Text className={`mt-0.5 ${tiles.length === 0 ? "text-body" : "text-label"} text-inkMuted`}>{item.reason}</Text>
          </View>
        ))}
      </ScrollView>
      <View className="mt-2 gap-1">
        {refusal ? (
          <Text testID="sheet-refusal" className="text-center text-body text-danger">
            {refusal}
          </Text>
        ) : null}
        {dock.primary ? (
          <>
            <ConfirmButton label={dock.primary.label} testID={dock.primary.testID} arm={dock.primary.arm} primary surface="paper" disabled={!ready} onConfirm={() => dock.primary && onButton(dock.primary)} />
            {dock.why ? <Why>{dock.why}</Why> : null}
          </>
        ) : null}
        <View className="flex-row flex-wrap items-center justify-center">
          {dock.secondary.map((button) => (
            <ConfirmButton key={button.testID} label={button.label} testID={button.testID} arm={button.arm} surface="paper" onConfirm={() => onButton(button)} />
          ))}
          <ChromeButton label="Look at the table" testID="sheet-collapse" tone="ink" onPress={onFold} />
        </View>
      </View>
    </SheetFrame>
  );
}

/** A discard pile's cards, the one on top first. A tap shows a card large; nothing here changes the game. */
export function PileList({ title, cards, onRead, onClose }: { title: string; cards: readonly { id: string; label: string }[]; onRead: (cardId: string) => void; onClose: () => void }) {
  return (
    <SheetFrame testID="pile-list" edge="right">
      <Text className="text-center font-display text-eyebrow uppercase text-inkLabel">{`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}</Text>
      <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
        {title}
      </Text>
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-inkMuted">The pile is empty.</Text> : null}
        {cards.map((card) => (
          <Tile key={card.id} label={card.label} selected={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
        ))}
      </ScrollView>
      <View className="items-center pt-1">
        <ChromeButton label="Close" testID="pile-list-close" tone="ink" onPress={onClose} />
      </View>
    </SheetFrame>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  return (
    <SheetFrame testID="log-sheet" edge="right">
      <View className="items-center">
        <Text className="font-display text-eyebrow uppercase text-inkLabel">Log</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">{`Round ${round}`}</Text>
      </View>
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        {lines.length === 0 ? <Text className="text-center text-body text-inkMuted">Nothing has happened this round yet.</Text> : null}
        {lines.map((line) => (
          <View key={line.key} testID={`log-line-${line.key}`} className="border-b py-2" style={{ borderColor: t.inkLine }}>
            <View className="flex-row items-center gap-2">
              <LineMark mark={line.mark} />
              <Text className="shrink text-body text-ink">{line.text}</Text>
            </View>
            {line.cause ? <Text className="mt-0.5 text-label text-inkMuted">{line.cause}</Text> : null}
          </View>
        ))}
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label="Close" testID="log-close" tone="ink" onPress={onClose} />
      </View>
    </SheetFrame>
  );
}
