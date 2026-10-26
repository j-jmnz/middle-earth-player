// The choice tray (docs/design-system.md, Table, Choice tray; phase 21): a choice whose options are not all whole cards on the
// table opens a compact night tray over the command column's upper part. It shows the options and nothing else: a muted count
// at its top, then one tile per row. The step, the readout, the refusal and the buttons are the dock's, once, under it
// (the tray's foot sits above them: tray-logic.ts, trayBox). A tile is picked like a card on the table (the same pick,
// table-choice.ts); a long press on a card's tile shows it large. A tap outside folds the tray (use-table-choice.ts).
import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";

import { IconValue } from "./game-icon.tsx";
import { Stats } from "./sheet-paper.tsx";
import type { Sheet, Unavailable } from "./sheet-types.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { shareFor, type Choice } from "./table-choice.ts";
import { TrayFrame, useHeld, type TrayPlace } from "./tray-frame.tsx";
import { trayCount, trayTiles, type TrayTile } from "./tray-logic.ts";
import { tableTokens as t } from "./tokens.ts";

const PICTURE = { width: 32, height: 44 };

function Check() {
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.gold }}>
      <Text style={{ color: t.onGold, fontSize: 13, lineHeight: 16, fontWeight: "700" }}>{"✓"}</Text>
    </View>
  );
}

// The foreseen damage of a defender, as a pill; threat red edge when it would destroy the card.
function DamagePill({ mark }: { mark: NonNullable<TrayTile["mark"]> }) {
  return (
    <View
      className="flex-row items-center rounded-pill px-2"
      style={{ borderWidth: 1, borderColor: mark.danger ? t.threat : t.goldLine, backgroundColor: mark.danger ? t.threat : "transparent", minHeight: 24 }}
    >
      <IconValue name={mark.icon} value={String(mark.value)} word={mark.danger ? "Destroying damage" : "Damage"} tint="bone" size={14} textClass="font-display text-label text-bone" />
    </View>
  );
}

function TileView({
  tile,
  label,
  selected,
  testID,
  source,
  onPress,
  onLongPress,
}: {
  tile: TrayTile;
  label: string;
  selected: boolean;
  testID: string;
  source: PictureSource | null;
  onPress: () => void;
  onLongPress: (() => void) | null;
}) {
  const said = [label, ...tile.stats.map((stat) => `${stat.word} ${stat.value}`), tile.mark ? `${tile.mark.danger ? "destroyed" : "damage"} ${tile.mark.value}` : "", tile.detail ?? ""].filter((part) => part.length > 0).join(". ");
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={said}
      accessibilityHint={onLongPress ? "Hold to read the card" : undefined}
      onPress={onPress}
      onLongPress={onLongPress ?? undefined}
    >
      {({ pressed }) => (
        <View
          className="mb-1.5 flex-row items-center gap-2 rounded-tile px-2 py-1"
          style={{ minHeight: 52, borderWidth: selected ? 1.5 : 1, borderColor: selected ? t.gold : t.hairline, backgroundColor: pressed ? t.pressed : t.night }}
        >
          {tile.code && source ? <Image source={source} recyclingKey={`${tile.code}:tray`} contentFit="contain" accessible={false} style={PICTURE} /> : null}
          <View className="shrink flex-1">
            <Text className={`text-body text-bone ${selected ? "font-semibold" : ""}`} numberOfLines={2}>
              {label}
            </Text>
            {tile.detail ? (
              <Text className="text-label text-muted" numberOfLines={4}>
                {tile.detail}
              </Text>
            ) : null}
            {tile.stats.length > 0 || tile.mark ? (
              <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
                <Stats stats={tile.stats} surface="night" />
                {tile.mark ? <DamagePill mark={tile.mark} /> : null}
              </View>
            ) : null}
          </View>
          {selected ? <Check /> : null}
        </View>
      )}
    </Pressable>
  );
}

// An option the rules refuse now: a dashed hairline outline with the reason in muted. Text, not a choice.
function RefusedTile({ item }: { item: Unavailable }) {
  return (
    <View testID={`sheet-unavailable-${item.id}`} accessible accessibilityLabel={`${item.label}. ${item.reason}`} className="mb-2 rounded-tile px-3 py-2" style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.hairline }}>
      <Text className="text-body text-muted">{item.label}</Text>
      <Text className="text-label text-muted">{item.reason}</Text>
    </View>
  );
}

/**
 * The tray. `open` false leaves it with the exit motion, showing what it last held. `picture` is a card's picture by code (or
 * null: the tile then shows its name alone); `onRead` shows a card large.
 */
export function ChoiceTray({
  open,
  place,
  sheet,
  choice,
  picture,
  onTile,
  onRead,
}: {
  open: boolean;
  place: TrayPlace;
  sheet: Sheet;
  choice: Choice;
  picture: (code: string) => PictureSource | null;
  onTile: (id: string) => void;
  onRead: ((cardId: string) => void) | null;
}) {
  const shown = useHeld(open ? sheet : null) ?? sheet;
  const picked = useHeld(open ? choice : null) ?? choice;
  const tiles = trayTiles(shown);
  const marks = new Set(picked.ids);
  const refused = shown.kind === "pick" ? (shown.unavailable ?? []) : [];
  return (
    <TrayFrame open={open} place={place} testID="sheet">
      <Text testID="sheet-count" accessibilityRole="header" numberOfLines={1} className="mb-1 text-center text-label text-muted">
        {trayCount(shown, picked)}
      </Text>
      <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {tiles.map((tile) => {
          const share = shareFor(shown, picked, tile.id);
          const selected = shown.kind === "distribute" ? share > 0 : marks.has(tile.id);
          return (
            <TileView
              key={tile.id}
              tile={tile}
              label={shown.kind === "distribute" ? `${tile.label} · ${share}` : tile.label}
              selected={selected}
              testID={shown.kind === "trigger" ? `sheet-trigger-${tile.id.split("|")[0] ?? tile.id}` : `sheet-option-${tile.id}`}
              source={tile.code ? picture(tile.code) : null}
              onPress={() => onTile(tile.id)}
              onLongPress={onRead && tile.readId ? () => tile.readId && onRead(tile.readId) : null}
            />
          );
        })}
        {refused.map((item) => (
          <RefusedTile key={item.id} item={item} />
        ))}
      </ScrollView>
    </TrayFrame>
  );
}
