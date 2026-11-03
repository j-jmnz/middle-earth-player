// The dock beside the table, in reach of the right thumb: what the engine is asking (the moment, a sentence), the engine's
// numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and the buttons that
// confirm it (docs/design-system-table.md). It has no panel: it stands on the command column's fade. A choice's options are rows in
// its own space, above the buttons (choice-tray.tsx). Picking happens on the table; nothing here is sent until a button is pressed
// (dock-buttons.tsx). The outcome banner over the table says what the last intent did (moment-banner.tsx).
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import { isDense, labelChars, PILL_PT, planWords, TRAY_ROOM_PX, wordsWindow } from "./dock-budget.ts";
import { dockLines } from "./dock-lines.ts";
import type { Readout } from "./readout.ts";
import { Stats } from "./sheet-paper.tsx";
import type { Unavailable } from "./sheet-types.ts";
import type { Dock, DockButton } from "./table-choice.ts";
import { CONTROL_RADIUS } from "./radius.ts";
import { withAlphaHex } from "./tokens.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** The engine's numbers for the moment, large, and what they come to: inline in the dock, on no band. */
// `oneLine`: the result is one line (the choice rows are open in the dock on a short phone); its words stay in the label.
function ReadoutView({ readout, tight = false, oneLine = false, onNumbers }: { readout: Readout; tight?: boolean; oneLine?: boolean; onNumbers?: (height: number) => void }) {
  return (
    <View testID={`readout-${readout.kind}`} className="px-2">
      {readout.stats.length > 0 ? (
        <View className="flex-row items-center justify-center gap-2" onLayout={(event) => onNumbers?.(Math.round(event.nativeEvent.layout.height))}>
          {readout.stats.map((stat, index) => (
            <View key={stat.word} className="flex-row items-center gap-2">
              {index > 0 ? <Text className="text-label text-faint">{readout.join ?? "against"}</Text> : null}
              <Stats stats={[stat]} surface="night" size="title" />
            </View>
          ))}
        </View>
      ) : null}
      {readout.result ? (
        <Text testID="readout-result" numberOfLines={oneLine ? 1 : 3} accessibilityLabel={readout.result} className={`${tight ? "" : "mt-0.5"} text-center text-label text-muted`}>
          {readout.result}
        </Text>
      ) : null}
    </View>
  );
}

// The dock's padding (dock-budget.ts counts it): above the words, under the buttons, and both on a short phone.
const TOP_PAD = 10;
const FOOT_PAD = 8;
const DENSE_PAD = 4;
// The "i" button: a 26 pt round, with a 44 pt target.
const PILL = 26;

// The tone of a line of words under the title: the guide and the note muted, under the bone title; what the rules refuse faint.
export const lineTone = (kind: "guide" | "note" | "unavailable") => (kind === "unavailable" ? "text-faint" : "text-muted");

export function TableDock({
  step,
  lead = "",
  title,
  note,
  picked,
  unavailable = [],
  readout,
  refusal,
  dock,
  onButton,
  extras = [],
  more = [],
  onMore,
  onLines,
  resetKey,
  guide = null,
  trayOpen = false,
  count = "",
  tray = null,
  onTop,
  onHeight,
  onNumbers,
}: {
  // The step in words ("Combat", "Stops on · Combat"): not drawn, the rail names the phase; a screen reader hears it before the title.
  step: string;
  // What leads the title: the seat that is asked in two-handed play ("Player 1 · ") and a Response's or an Action's timing
  // ("Response · "), or "". The step overline is not drawn, so this is how the player knows a chance to respond from a plain question.
  lead?: string;
  title: string;
  note: string | null;
  // The cards picked so far, in words ("Frodo Baggins, Sam Gamgee"), or an ability's printed line, or null: heard in the
  // primary's hint; no line shows it.
  picked: string | null;
  unavailable?: readonly Unavailable[];
  readout: Readout | null;
  refusal: string | null;
  dock: Dock;
  onButton: (button: DockButton) => void;
  extras?: readonly DockExtra[];
  // The quiet pills folded behind the More pill, and what it does (dock-extras.ts, dockPills; dock-more.tsx).
  more?: readonly DockExtra[];
  onMore?: (foot: number) => void;
  // The "i" pill opens the full title and every line in a popover (dock-more.tsx); it reports the screen y of the pill's top.
  onLines?: (top: number) => void;
  // Changes with the moment and the pick: an armed button goes back to unarmed.
  resetKey: string;
  // The first-game guide's line for the moment (reference.ts); it is turned off in the table settings.
  guide?: string | null;
  // The choice's options are open in the dock (`tray`, choice-tray.tsx): the title asks the question and the folded line waits behind
  // the "i", so the rows get the room; on a short phone the readout is one line (its words stay in the accessibility label).
  trayOpen?: boolean;
  // The choice's count ("Defend · pick 1 of 6"): not drawn, a screen reader hears it with the title while the rows are open.
  count?: string;
  // The choice's rows, drawn between the words and the buttons.
  tray?: ReactNode;
  // The screen y of the top of the dock's content: the choice tray's outside-tap layer over the column stops there.
  onTop?: (top: number) => void;
  // The dock's own height (the content stack, padding included): the column's head fills the room above it.
  // `hasNumbers`: whether the readout's numbers row is in it.
  onHeight?: (height: number, hasNumbers: boolean) => void;
  // The height of the readout's numbers row while it shows: the head plans against the dock with it, whether or not the quest meter has taken it over (command-head.ts, dockWithNumbers).
  onNumbers?: (height: number) => void;
}) {
  const t = useTableTokens();
  // The UI scale (ui-scale.ts): the dock's padding and budget are Medium's sizes times it.
  const s = useUiScale();
  const root = useRef<ComponentRef<typeof View>>(null);
  const pillRef = useRef<ComponentRef<typeof View>>(null);
  const [room, setRoom] = useState({ column: 0, block: 0, text: 198 });
  const measure = () => root.current?.measureInWindow((_x, y) => onTop?.(Math.round(y)));
  // The folded line is one line on a short phone (under DENSE_BELOW tall, as the choice rows) and two on a taller one.
  const dense = isDense(useWindowDimensions().height, s);
  const lines = dockLines({ guide, note, unavailable, chars: (dense ? 1 : 2) * labelChars(room.text - PILL_PT * s, s) });
  // The words' window (budget in dock-budget.ts): the title keeps the lines that fit above the folded line and the buttons (and, with the
  // choice open, above one row), and the rest of it waits behind the "i", which sits on the title row when the room cannot hold a
  // folded line. With the choice open the folded line waits behind the "i" too.
  const space = room.column > 0 ? wordsWindow({ room: room.column, block: room.block + (trayOpen ? TRAY_ROOM_PX * s : 0), dense }, s) : Infinity;
  const plan = planWords({ space, dense, clamp: trayOpen, title: lead + title, textWidth: room.text, hasLine: !trayOpen && lines.first != null, foldable: lines.foldable || (trayOpen && lines.first != null) }, s);
  const pill = plan.pill ? (
    // The "i" button (`dock-more`) opens the full title and every line; the More pill (`dock-more-actions`) folds the reading aids.
    // 26 pt round with a 44 pt target that stays clear of the line's words (6 pt gap) and inside the dock's padding.
    <Pressable
      ref={pillRef}
      testID="dock-more"
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="More about this moment"
      hitSlop={{ top: touchSlop(s, PILL * s), bottom: touchSlop(s, PILL * s), left: 6 * s, right: 12 * s }}
      onPress={() => pillRef.current?.measureInWindow((_x, y) => onLines?.(Math.round(y)))}
    >
      <View className="items-center justify-center" style={{ width: PILL * s, height: PILL * s, borderRadius: CONTROL_RADIUS, backgroundColor: withAlphaHex(t.bone, 0.1) }}>
        <Text className="text-label font-semibold" style={{ color: t.bone }}>
          i
        </Text>
      </View>
    </Pressable>
  ) : null;
  const readoutLine = dense && trayOpen;
  return (
    <View style={{ flex: 1, minHeight: 0, justifyContent: "flex-end" }} onLayout={(event) => setRoom((now) => ({ ...now, column: Math.round(event.nativeEvent.layout.height) }))}>
      {/* No panel: the dock stands on the command column's fade (table-view.tsx). The words, the choice's rows (when it is open) and the
          numbers and buttons are stacked from the foot of the column up. */}
      <View
        ref={root}
        collapsable={false}
        testID="dock"
        className="px-3"
        onLayout={(event) => {
          measure();
          onHeight?.(Math.round(event.nativeEvent.layout.height), (readout?.stats.length ?? 0) > 0);
        }}
        style={{
          paddingTop: (dense ? DENSE_PAD : TOP_PAD) * s,
          paddingBottom: (dense ? DENSE_PAD : FOOT_PAD) * s,
          flexShrink: 1,
        }}
      >
        {/* The words above the numbers are budgeted to fit (planWords); the guard scrolls only on a taller screen's long lines. The
            readout, the armed line and every button are pinned to the dock's foot and never scroll away. */}
        <ScrollView style={{ flexGrow: 0, flexShrink: trayOpen ? 0 : 1, minHeight: 0 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          <View onLayout={(event) => setRoom((now) => ({ ...now, text: Math.round(event.nativeEvent.layout.width) }))} style={{ paddingBottom: (dense ? 2 : 8) * s }}>
            <View className="flex-row items-start gap-1.5">
              <Text testID="sheet-title" accessibilityRole="header" accessibilityLabel={[step, title, trayOpen ? count : ""].filter(Boolean).join(". ")} numberOfLines={plan.titleLines} className="flex-1 font-display text-heading text-bone" style={{ flexShrink: 0 }}>
                {lead + title}
              </Text>
              {plan.pillOnTitle ? pill : null}
            </View>
            {plan.showLine && lines.first ? (
              <View className="mt-0.5 flex-row items-start gap-1.5">
                {/* One line shows. A screen reader hears every line from it. */}
                <Text testID={lines.first.testID} numberOfLines={dense ? 1 : 2} accessibilityLabel={lines.spoken} className={`flex-1 text-label ${lineTone(lines.first.kind)}`}>
                  {lines.first.text}
                </Text>
                {plan.pillOnTitle ? null : pill}
              </View>
            ) : null}
          </View>
        </ScrollView>
        {tray}
        <View
          collapsable={false}
          onLayout={(event) => setRoom((now) => ({ ...now, block: Math.round(event.nativeEvent.layout.height) }))}
          className={dense ? "gap-0.5" : "gap-1"}
          style={{ flexShrink: 0, paddingTop: trayOpen ? (dense ? 2 : 4) * s : 0 }}
        >
          {readout ? <ReadoutView readout={readout} tight={dense} oneLine={readoutLine} onNumbers={onNumbers} /> : null}
          {refusal ? (
            <Text testID="sheet-refusal" numberOfLines={3} className="text-center text-label text-danger">
              {refusal}
            </Text>
          ) : null}
          <DockButtons key={resetKey} dock={dock} extras={extras} more={more} onMore={onMore} picked={picked} dense={dense} chars={labelChars(room.text, s)} onButton={onButton} />
        </View>
      </View>
    </View>
  );
}
