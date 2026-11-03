// The command column's head (docs/design-system-table.md, Command column): the victory display over the quest meter (in the Quest phase only), standing above the dock
// in the room the dock leaves free. It is positioned from the column's top to the dock's top, its content at the foot so the meter sits just above the dock with the strip over it, and never pushes the dock; command-head.ts
// says what it draws in that room. It subscribes to the victory display alone, so a state that does not change it does not render it.
import { View } from "react-native";
import { useStore } from "zustand";

import { headPlan, STRIP_GAP } from "./command-head.ts";
import { QuestMeterView } from "./quest-meter-view.tsx";
import type { QuestScale } from "./quest-scale.ts";
import type { ScenarioState, TableStore } from "./store.ts";
import { useUiScale } from "./ui-scale.ts";
import type { VictoryDisplay } from "./victory-display.ts";
import { VictoryStrip } from "./victory-strip.tsx";

/** The tallest the meter grows (Medium's points). */
const METER_MOST = 230;

export function CommandHead({
  store,
  select,
  scale,
  room,
  bottom,
  onPreview,
  onMore,
}: {
  store: TableStore;
  select: (game: ScenarioState) => VictoryDisplay;
  scale: QuestScale;
  room: number;
  bottom: number;
  onPreview: (id: string) => void;
  onMore: () => void;
}) {
  const s = useUiScale();
  const display = useStore(store, (state) => select(state.game));
  const plan = headPlan(room, display.rows.length, s, scale.live);
  if (plan.mode === "hidden") return null;
  const meter = Math.min(METER_MOST * s, Math.max(0, room - plan.strip - STRIP_GAP * s));
  return (
    <View testID="command-head" pointerEvents="box-none" className="absolute inset-x-0 top-0 justify-end" style={{ bottom, paddingHorizontal: 12 * s, paddingTop: 2 * s }}>
      <VictoryStrip display={display} plan={plan} onPreview={onPreview} onMore={onMore} />
      {scale.live ? (
        <>
          <View style={{ height: STRIP_GAP * s }} />
          <QuestMeterView scale={scale} compact={plan.mode === "compact"} height={meter} />
        </>
      ) : null}
    </View>
  );
}
