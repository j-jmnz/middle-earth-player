// The choice (docs/design-system-table.md, Choice tray; phase 21): a choice whose options are not all whole cards on the table opens
// its options as rows in the command column, in the dock's own space above the numbers and buttons. The rows have no plate: words on
// the column's fade, a 12 pt accent wash on the one picked. The dock's title asks the question (table-dock.tsx), so there is no count
// above them; the count stays in the title's spoken label. The readout, the refusal and the buttons are the dock's, once, under the
// rows. A row is picked like a card on the table (the same pick, table-choice.ts); a long press on a card's row shows it large. A tap
// outside folds it (use-table-choice.ts).
import { ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { CardImage } from "./card-image.tsx";
import { cardCorner } from "./card-corner.ts";
import { dropShadowOf } from "./surfaces.ts";
import { IconValue } from "./game-icon.tsx";
import { PlaceGlyph } from "./island-glyph.tsx";
import { useOpenMotion } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { CONTROL_RADIUS } from "./radius.ts";
import { Tile } from "./sheet-paper.tsx";
import type { Sheet, Unavailable } from "./sheet-types.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { shareFor, type Choice } from "./table-choice.ts";
import { useHeld } from "./tray-frame.tsx";
import { tileAction, trayTiles, type TrayTile } from "./tray-logic.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// A card's picture beside its row: the table's card, 51 by 71, or 36 by 50 on a short phone, times the UI scale (docs/design-system-table.md, Choice tray).
// Its corners are rounded like the card screen's picture (card-image.tsx); a picked card's picture wears the accent ring it wears on the table.
const cardBox = (dense: boolean, s: number) => (dense ? { width: 36 * s, height: 50 * s } : { width: 51 * s, height: 71 * s });
// The rows enter this far up (MOTION.trayEnter).
const RISE = 16;
// The shortest the rows are drawn when the column is short: one row with its card picture (dock-budget.ts, TRAY_ROOM_PX counts the short phone's), the rest scrolls.
const minRows = (dense: boolean) => (dense ? 52 : 79);

// The foreseen damage of a defender, as a pill; threat red when the card would be destroyed.
// A row's leading mark: a travel row on the Island Map shows the glyph of its place (island-glyph.tsx) beside the card picture.
function TileLead({ tile, source, dense, picked, s }: { tile: TrayTile; source: PictureSource | null; dense: boolean; picked: boolean; s: number }) {
  const t = useTableTokens();
  const box = cardBox(dense, s);
  return (
    <View className="flex-row items-center" style={{ gap: 6 * s }}>
      {tile.place ? <PlaceGlyph mark={tile.place} surface="night" /> : null}
      {tile.code && source ? (
        <View style={{ ...box, borderRadius: cardCorner(box.width, box.height), boxShadow: picked ? `0 0 0 2px ${t.accent}` : dropShadowOf(t, 3, 8, 0.8) }}>
          <CardImage source={source} recyclingKey={`${tile.code}:tray`} {...box} />
        </View>
      ) : null}
    </View>
  );
}

function DamagePill({ mark }: { mark: NonNullable<TrayTile["mark"]> }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View
      className="flex-row items-center px-2"
      style={{ borderRadius: CONTROL_RADIUS, backgroundColor: mark.danger ? t.threatEdge : withAlphaHex(t.bone, 0.08), minHeight: 24 * s }}
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
        <Text className="text-faint">{` · ${item.reason}`}</Text>
      </Text>
    </View>
  );
}

/**
 * The rows, drawn inside the dock between its words and its buttons. `open` false leaves them with the exit motion, showing what they
 * last held. `picture` is a card's picture by code (or null: the row then shows its name alone); `onRead` shows a card large.
 */
export function ChoiceTray({
  open,
  sheet,
  choice,
  picture,
  dense,
  onTile,
  onRead,
}: {
  open: boolean;
  sheet: Sheet;
  choice: Choice;
  picture: (code: string) => PictureSource | null;
  // A short phone (under 400 pt tall): rows on one line.
  dense: boolean;
  onTile: (id: string) => void;
  onRead: ((cardId: string) => void) | null;
}) {
  const s = useUiScale();
  const { progress, leaving } = useOpenMotion(open, MOTION.trayEnter, MOTION.trayLeave);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * RISE * s }] }));
  const shown = useHeld(open ? sheet : null) ?? sheet;
  const picked = useHeld(open ? choice : null) ?? choice;
  const tiles = trayTiles(shown);
  const marks = new Set(picked.ids);
  const refused = shown.kind === "pick" ? (shown.unavailable ?? []) : [];
  if (!open && !leaving) return null;
  return (
    <Animated.View testID="sheet" collapsable={false} pointerEvents={open ? "auto" : "none"} style={[{ flexShrink: 1, minHeight: 0 }, motion]}>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: tiles.length > 0 ? minRows(dense) * s : 0 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
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
              testID={shown.kind === "trigger" ? `sheet-trigger-${tile.id.split("|")[0] ?? tile.id}` : tile.look != null ? `sheet-look-${tile.id}` : `sheet-option-${tile.id}`}
              leading={tile.place || (tile.code && source) ? <TileLead tile={tile} source={source} dense={dense} picked={shown.kind === "distribute" ? share > 0 : marks.has(tile.id)} s={s} /> : null}
              trailing={mark ? <DamagePill mark={mark} /> : null}
              said={mark ? `${mark.danger ? "destroyed" : "damage"} ${mark.value}` : ""}
              // A card the Sailing test looked at is no choice: a tap opens it large, as a long press does.
              onPress={() => (tileAction(tile) === "read" ? (onRead && readId ? onRead(readId) : undefined) : onTile(tile.id))}
              hint={tile.look != null ? "Shows the card" : undefined}
              detailSpoken={tile.look == null}
              onLongPress={onRead && readId ? () => onRead(readId) : null}
            />
          );
        })}
        {refused.map((item) => (
          <RefusedTile key={item.id} item={item} dense={dense} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}
