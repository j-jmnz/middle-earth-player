// The victory display in the command column's head (docs/design-system-table.md, Command column): "Victory · 3 VP" over the names of the cards in it,
// newest first, one line each; a name opens that card large. Past the room the last line says "+n more", a button that opens the whole display; empty, one muted line. The plan
// (command-head.ts) says how many lines the room holds.
import { Pressable, View } from "react-native";

import type { HeadPlan } from "./command-head.ts";
import { VICTORY_HEADER, victoryRow } from "./command-head.ts";
import { textSurface } from "./surfaces.ts";
import { Text } from "./text.tsx";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import type { VictoryDisplay, VictoryRow } from "./victory-display.ts";

/** The header: "Victory · 3 VP". */
export function victoryTitle(total: number): string {
  return `Victory · ${total} VP`;
}

// "+n more" (or "+n" beside the newest name): a button that opens the whole victory display. `height` is the row's; the target is never under 44 pt.
function MoreButton({ label, height, onMore }: { label: string; height: number; onMore: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable
      testID="victory-more"
      accessibilityRole="button"
      accessibilityLabel={`${label}, shows the whole victory display`}
      hitSlop={{ top: touchSlop(s, height), bottom: touchSlop(s, height) }}
      onPress={onMore}
      style={{ height }}
    >
      {({ pressed }) => (
        <View className="justify-center rounded-control" style={{ height, paddingHorizontal: 6 * s, ...textSurface(pressed, t) }}>
          <Text className="text-micro" numberOfLines={1} style={{ color: t.muted }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// One card's name: a button that shows the card large. A full row is a 44 pt target on its own; the compact line (one row, nothing under it) borrows the rest as hit slop.
function NameRow({ row, onPreview, height, tail, onMore }: { row: VictoryRow; onPreview: (id: string) => void; height: number; tail: string | null; onMore: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View className="flex-row items-center" style={{ height, gap: 4 * s }}>
      <Pressable
        testID={`victory-${row.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${row.name}, ${row.points} victory ${row.points === 1 ? "point" : "points"}`}
        accessibilityHint="Shows the card"
        hitSlop={{ top: touchSlop(s, height), bottom: touchSlop(s, height) }}
        onPress={() => onPreview(row.id)}
        style={{ flex: 1, height }}
      >
        {({ pressed }) => (
          <View className="justify-center rounded-control" style={{ height, paddingHorizontal: 6 * s, ...textSurface(pressed, t) }}>
            <Text className="text-label" numberOfLines={1} style={{ color: t.bone }}>
              {row.name}
            </Text>
          </View>
        )}
      </Pressable>
      {tail ? <MoreButton label={tail} height={height} onMore={onMore} /> : null}
    </View>
  );
}

export function VictoryStrip({ display, plan, onPreview, onMore }: { display: VictoryDisplay; plan: HeadPlan; onPreview: (id: string) => void; onMore: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const header = VICTORY_HEADER * s;
  const row = victoryRow(s);
  const empty = display.rows.length === 0;
  const newest = display.rows[0];
  if (plan.mode === "hidden") return null;
  if (empty) {
    return (
      <View testID="victory-strip" accessible accessibilityLabel="Victory display, empty" style={{ height: header, justifyContent: "center" }}>
        <Text className="text-label" numberOfLines={1} style={{ color: t.faint }}>
          Victory display — empty
        </Text>
      </View>
    );
  }
  const title = (
    <Text className="font-display text-label" numberOfLines={1} accessibilityLabel={`Victory display, ${display.total} victory points`} style={{ color: t.muted, flexShrink: 0 }}>
      {victoryTitle(display.total)}
    </Text>
  );
  // One line: the header and the newest card beside it.
  if (plan.mode === "compact") {
    const more = display.rows.length - 1;
    return (
      <View testID="victory-strip" className="flex-row items-center" style={{ height: header, gap: 8 * s }}>
        {title}
        {newest ? <View className="min-w-0 flex-1"><NameRow row={newest} onPreview={onPreview} height={header} tail={more > 0 ? `+${more}` : null} onMore={onMore} /></View> : null}
      </View>
    );
  }
  const shown = display.rows.slice(0, plan.rows);
  const tail = plan.more > 0 && !plan.moreLine ? `+${plan.more} more` : null;
  return (
    <View testID="victory-strip" style={{ height: plan.strip }}>
      <View className="justify-center" style={{ height: header }}>
        {title}
      </View>
      {shown.map((item, at) => (
        <NameRow key={item.id} row={item} onPreview={onPreview} height={row} tail={at === shown.length - 1 ? tail : null} onMore={onMore} />
      ))}
      {plan.more > 0 && plan.moreLine ? (
        <View className="items-start" style={{ height: row }}>
          <MoreButton label={`+${plan.more} more`} height={row} onMore={onMore} />
        </View>
      ) : null}
    </View>
  );
}
