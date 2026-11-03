// The victory display in the command column's head (docs/design-system-table.md, Command column): "Victory · 3 VP" over the names of the cards in it,
// newest first, one line each; a name opens that card large. Past the room the last line says "+n more"; empty, one muted line. The plan
// (command-head.ts) says how many lines the room holds.
import { Pressable, View } from "react-native";

import type { HeadPlan } from "./command-head.ts";
import { VICTORY_HEADER, VICTORY_ROW } from "./command-head.ts";
import { Text } from "./text.tsx";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import type { VictoryDisplay, VictoryRow } from "./victory-display.ts";

/** The header: "Victory · 3 VP". */
export function victoryTitle(total: number): string {
  return `Victory · ${total} VP`;
}

function NameRow({ row, onPreview, height, tail }: { row: VictoryRow; onPreview: (id: string) => void; height: number; tail: string | null }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable
      testID={`victory-${row.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.points} victory ${row.points === 1 ? "point" : "points"}`}
      accessibilityHint="Shows the card"
      hitSlop={{ top: touchSlop(s, height), bottom: touchSlop(s, height) }}
      onPress={() => onPreview(row.id)}
      className="flex-row items-center"
      style={{ height, gap: 6 * s }}
    >
      <Text className="flex-1 text-label" numberOfLines={1} style={{ color: t.bone }}>
        {row.name}
      </Text>
      {tail ? (
        <Text className="text-micro" numberOfLines={1} style={{ color: t.muted }}>
          {tail}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function VictoryStrip({ display, plan, onPreview }: { display: VictoryDisplay; plan: HeadPlan; onPreview: (id: string) => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const header = VICTORY_HEADER * s;
  const row = VICTORY_ROW * s;
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
        {newest ? <View className="min-w-0 flex-1"><NameRow row={newest} onPreview={onPreview} height={header} tail={more > 0 ? `+${more}` : null} /></View> : null}
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
        <NameRow key={item.id} row={item} onPreview={onPreview} height={row} tail={at === shown.length - 1 ? tail : null} />
      ))}
      {plan.more > 0 && plan.moreLine ? (
        <View className="justify-center" style={{ height: row }}>
          <Text testID="victory-more" className="text-micro" numberOfLines={1} style={{ color: t.muted }}>
            {`+${plan.more} more`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
