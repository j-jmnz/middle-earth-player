// The choice tray (docs/design-system.md, Table, Choice tray; phase 21): a choice whose options are not all whole cards on the
// table opens a compact night tray over the command column's upper part, standing on the dock as its upper part in the dock's own
// fill, so the choice and its answers read as one panel. It shows the options and nothing else: the count as an accent eyebrow at its
// top, then one tile per row. The step, the readout, the refusal and the buttons are the dock's, once, under it
// (the tray's foot sits above them: tray-logic.ts, trayBox). A tile is picked like a card on the table (the same pick,
// table-choice.ts); a long press on a card's tile shows it large. A tap outside folds the tray (use-table-choice.ts).
import { ScrollView, View } from "react-native";

import { CardImage } from "./card-image.tsx";
import { IconValue } from "./game-icon.tsx";
import { Tile } from "./sheet-paper.tsx";
import type { Sheet, Unavailable } from "./sheet-types.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { shareFor, type Choice } from "./table-choice.ts";
import { TrayFrame, useHeld, type TrayPlace } from "./tray-frame.tsx";
import { trayCount, trayTiles, type TrayTile } from "./tray-logic.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// A card's picture beside its tile: 32 by 44, or 28 by 38 on a short phone, times the UI scale.
// Its corners are rounded like the card screen's picture (card-image.tsx).
const cardBox = (dense: boolean, s: number) => (dense ? { width: 28 * s, height: 38 * s } : { width: 32 * s, height: 44 * s });

// The foreseen damage of a defender, as a pill; threat red when the card would be destroyed.
function DamagePill({ mark }: { mark: NonNullable<TrayTile["mark"]> }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View
      className="flex-row items-center rounded-control px-2"
      style={{ backgroundColor: mark.danger ? t.threatEdge : withAlphaHex(t.bone, 0.08), minHeight: 24 * s }}
    >
      <IconValue name={mark.icon} value={String(mark.value)} word={mark.danger ? "Destroying damage" : "Damage"} tint="bone" size={14 * s} textClass="font-display text-label text-bone" />
    </View>
  );
}

// An option the rules refuse now: its name and the reason in faint, on no plate. Text, not a choice.
function RefusedTile({ item, dense }: { item: Unavailable; dense: boolean }) {
  return (
    <View testID={`sheet-unavailable-${item.id}`} accessible accessibilityLabel={`${item.label}. ${item.reason}`} className={`${dense ? "mb-1" : "mb-1.5"} px-2 py-0.5`}>
      <Text className="text-label font-medium text-muted">
        {item.label}
        <Text className="text-faint">{` \u00b7 ${item.reason}`}</Text>
      </Text>
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
  dense,
  onTile,
  onRead,
}: {
  open: boolean;
  place: TrayPlace;
  sheet: Sheet;
  choice: Choice;
  picture: (code: string) => PictureSource | null;
  // A short phone (under 400 pt tall): tiles on one line.
  dense: boolean;
  onTile: (id: string) => void;
  onRead: ((cardId: string) => void) | null;
}) {
  const s = useUiScale();
  const shown = useHeld(open ? sheet : null) ?? sheet;
  const picked = useHeld(open ? choice : null) ?? choice;
  const tiles = trayTiles(shown);
  const marks = new Set(picked.ids);
  const refused = shown.kind === "pick" ? (shown.unavailable ?? []) : [];
  return (
    <TrayFrame open={open} place={place} joined testID="sheet">
      {/* The count is the tray's head: an accent eyebrow, where the dock's step stands when the tray is folded. */}
      <Text testID="sheet-count" accessibilityRole="header" numberOfLines={1} className="font-display text-eyebrow uppercase text-accent" style={{ flexShrink: 0, marginBottom: (dense ? 4 : 8) * s }}>
        {trayCount(shown, picked)}
      </Text>
      <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {tiles.map((tile) => {
          const share = shareFor(shown, picked, tile.id);
          const readId = tile.readId;
          const source = tile.code ? picture(tile.code) : null;
          const mark = tile.mark;
          return (
            <Tile
              key={tile.id}
              surface="night"
              dense={dense && tile.detail == null}
              label={shown.kind === "distribute" ? `${tile.label} · ${share}` : tile.label}
              detail={tile.detail}
              stats={tile.stats}
              selected={shown.kind === "distribute" ? share > 0 : marks.has(tile.id)}
              testID={shown.kind === "trigger" ? `sheet-trigger-${tile.id.split("|")[0] ?? tile.id}` : `sheet-option-${tile.id}`}
              leading={tile.code && source ? <CardImage source={source} recyclingKey={`${tile.code}:tray`} {...cardBox(dense, s)} /> : null}
              trailing={mark ? <DamagePill mark={mark} /> : null}
              said={mark ? `${mark.danger ? "destroyed" : "damage"} ${mark.value}` : ""}
              onPress={() => onTile(tile.id)}
              onLongPress={onRead && readId ? () => onRead(readId) : null}
            />
          );
        })}
        {refused.map((item) => (
          <RefusedTile key={item.id} item={item} dense={dense} />
        ))}
      </ScrollView>
    </TrayFrame>
  );
}
