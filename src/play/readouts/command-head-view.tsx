// The command column's head (docs/design-system-table.md, Command column): the quest meter, in the Quest phase only, standing above the dock in the room
// the dock leaves free. It is positioned from the column's top to the dock's top, its content at the foot so the meter sits just above the dock, and
// never pushes the dock; command-head.ts says what it draws in that room. A tap on the meter lists the cards that make up its threat (`onMeter`).
import { View } from "react-native";

import { headPlan, METER_MOST } from "./command-head.ts";
import { QuestMeterView } from "./quest-meter-view.tsx";
import type { QuestScale } from "./quest-scale.ts";
import { useUiScale } from "../../ui/ui-scale.ts";

export function CommandHead({ scale, room, bottom, onMeter }: { scale: QuestScale; room: number; bottom: number; onMeter?: () => void }) {
  const s = useUiScale();
  const mode = headPlan(room, s, scale.live);
  if (mode === "hidden") return null;
  return (
    <View testID="command-head" pointerEvents="box-none" className="absolute inset-x-0 top-0 justify-end" style={{ bottom, paddingHorizontal: 12 * s, paddingTop: 2 * s }}>
      <QuestMeterView scale={scale} compact={mode === "compact"} height={Math.min(METER_MOST * s, room)} onPress={onMeter} />
    </View>
  );
}
