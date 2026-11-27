// The command column's head (docs/design-system-table.md, Command column): the last move's line (Last move) and, in the Quest phase only, the quest
// meter under it, standing above the dock in the room the dock leaves free. It is positioned from the column's top to the dock's top, its content at
// the foot so the meter sits just above the dock, and never pushes the dock; command-head.ts says what it draws in that room. A tap on the meter lists
// the cards that make up its threat (`onMeter`); a tap on the line opens the Log (`onMove`).
import { View } from "react-native";

import { headPlan, METER_MOST, MOVE_GAP, movePlan, moveRoom, type MovePlan } from "./command-head.ts";
import { LastMove } from "./last-move.tsx";
import { QuestMeterView } from "./quest-meter-view.tsx";
import type { QuestScale } from "./quest-scale.ts";
import type { Moment } from "../store/outcome.ts";
import { useUiScale } from "../../ui/ui-scale.ts";

const HIDDEN: MovePlan = { mode: "hidden", inside: false };

export function CommandHead({ scale, room, bare, bottom, move, moveKey, onMeter, onMove }: { scale: QuestScale; room: number; bare: number; bottom: number; move: Moment | null; moveKey: string; onMeter?: () => void; onMove: () => void }) {
  const s = useUiScale();
  const mode = headPlan(room, s, scale.live);
  const line = move ? movePlan(room, bare, mode, s) : HIDDEN;
  if (mode === "hidden" && line.mode === "hidden") return null;
  const meterRoom = room - moveRoom(line, s);
  return (
    <View testID="command-head" pointerEvents="box-none" className="absolute inset-x-0 top-0 justify-end" style={{ bottom, paddingHorizontal: 12 * s, paddingTop: 2 * s }}>
      {move && line.mode !== "hidden" ? (
        <View style={{ marginBottom: MOVE_GAP * s }}>
          <LastMove key={moveKey} moment={move} row={line.mode === "row"} onPress={onMove} />
        </View>
      ) : null}
      {mode === "hidden" ? null : <QuestMeterView scale={scale} compact={mode === "compact"} height={Math.min(METER_MOST * s, meterRoom)} onPress={onMeter} />}
    </View>
  );
}
