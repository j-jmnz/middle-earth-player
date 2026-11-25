// The dock beside the table, in reach of the right thumb: what the engine is asking (the moment, a sentence), the engine's
// numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and the buttons that
// confirm it (docs/design-system-table.md). It has no panel: it stands on the command column's fade. A choice's options are rows in
// its own space, above the buttons (choice/tray.tsx). Picking happens on the table; nothing here is sent until a button is pressed
// (dock/buttons.tsx). The outcome banner over the table says what the last intent did (moment-banner.tsx).
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { DockButtons, type DockExtra } from "./buttons.tsx";
import { lineCount } from "./armed-room.ts";
import { isDense, labelChars, PILL_PT, planWords, smallPictures, trayRoom, wordsWindow } from "./budget.ts";
import { dockLines } from "./lines.ts";
import { useReaderMoment } from "./use-reader-moment.ts";
import { momentHint } from "../reader-moment.ts";
import { useReaderMode } from "../../../ui/screen-reader.ts";
import type { Readout } from "../../readouts/readout.ts";
import { Stats } from "../sheet-paper.tsx";
import type { Unavailable } from "../sheet-types.ts";
import type { Dock, DockButton } from "../table-choice.ts";
import { useFocusRing } from "../../../ui/focus-ring.ts";
import { CONTROL_RADIUS } from "../../../ui/radius.ts";
import { withAlphaHex } from "../../../ui/tokens.ts";
import { capLines, touchSlop, useUiScale } from "../../../ui/ui-scale.ts";
import { useTableTokens } from "../../../ui/use-table-tokens.ts";
import { Text } from "../../../ui/text.tsx";

/** The engine's numbers for the moment, large, and what they come to: inline in the dock, on no band. */
// `oneLine`: the result is one line (the choice rows are open in the dock on a short phone); its words stay in the label.
function ReadoutView({ readout, tight = false, oneLine = false, onNumbers }: { readout: Readout; tight?: boolean; oneLine?: boolean; onNumbers?: (height: number) => void }) {
  // The result keeps its three lines at the phone's default text size and larger text grows it (the pinned block is measured, room.block and
  // fit.ts); a dense dock with the rows open keeps it one line at every size, a fixed slot: a cut result is whole behind the "i".
  const { fontScale } = useWindowDimensions();
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
        <Text testID="readout-result" numberOfLines={oneLine ? 1 : capLines(3, fontScale)} accessibilityLabel={readout.result} className={`${tight ? "" : "mt-0.5"} text-center text-label text-muted`}>
          {readout.result}
        </Text>
      ) : null}
    </View>
  );
}

// The dock's padding (dock/budget.ts counts it): above the words, under the buttons, and both on a short phone.
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
  onTitle,
  note,
  picked,
  unavailable = [],
  readout,
  refusal,
  dock,
  onButton,
  extras = [],
  more = [],
  aidsFolded = false,
  onMore,
  onLines,
  resetKey,
  momentKey = "",
  stay = false,
  guide = null,
  trayOpen = false,
  hidden = false,
  count = "",
  tray = null,
  onTop,
  onHeight,
  onNumbers,
}: {
  // The step in words ("Combat", "Stops on, Combat"): not drawn, the rail names the phase; a screen reader hears it before the title.
  step: string;
  // What leads the title: the seat that is asked in two-handed play ("Player 1 · ") and a Response's or an Action's timing
  // ("Response · "), or "". The step overline is not drawn, so this is how the player knows a chance to respond from a plain question.
  lead?: string;
  title: string;
  // The title names the card the moment is about (a look's card, a Response's source): a tap on it opens that card in the preview, as Read does.
  onTitle?: () => void;
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
  // The quiet pills folded behind the More pill, and what it does (dock/extras.ts, dockPills; dock/more.tsx).
  more?: readonly DockExtra[];
  // Every reading aid is behind More at this text size (dock/extras.ts, foldAids); More then sits on the answers' row.
  aidsFolded?: boolean;
  onMore?: (foot: number) => void;
  // The "i" pill opens the full title and every line in a popover (dock/more.tsx); it reports the screen y of the pill's top.
  onLines?: (top: number) => void;
  // Changes with the moment and the pick: an armed button goes back to unarmed.
  resetKey: string;
  // The open sheet's key, and whether a screen reader's focus stays where it is when it changes (use-reader-moment.ts): both are for the reader only.
  momentKey?: string;
  stay?: boolean;
  // The first-game guide's line for the moment (reference.ts); it is turned off in the table settings.
  guide?: string | null;
  // The choice's options are open in the dock (`tray`, choice/tray.tsx): the title asks the question and the folded line waits behind
  // the "i", so the rows get the room; on a short phone the readout is one line (its words stay in the accessibility label).
  trayOpen?: boolean;
  // The choice's count ("Defend · pick 1 of 6"): not drawn, a screen reader hears it with the title while the rows are open ("Defend, pick 1 of 6").
  count?: string;
  // The choice's rows, drawn between the words and the buttons.
  tray?: ReactNode;
  // The screen y of the top of the dock's content: the choice tray's outside-tap layer over the column stops there.
  onTop?: (top: number) => void;
  // The quest advance screen holds a question over the table (quest-advance-view.tsx): it asks the same choice, so the dock stays laid out but is not drawn, heard or touched.
  hidden?: boolean;
  // The dock's own height (the content stack, padding included): the column's head fills the room above it.
  // `hasNumbers`: whether the readout's numbers row is in it.
  onHeight?: (height: number, hasNumbers: boolean) => void;
  // The height of the readout's numbers row while it shows: the head plans against the dock with it, whether or not the quest meter has taken it over (command-head.ts, dockWithNumbers).
  onNumbers?: (height: number) => void;
}) {
  const t = useTableTokens();
  // The "i" button's focus ring (ui/focus-ring.ts), on the 26 pt round inside its 44 pt target.
  const pillRing = useFocusRing();
  // The UI scale (ui-scale.ts): the dock's padding and budget are Medium's sizes times it.
  const s = useUiScale();
  const root = useRef<ComponentRef<typeof View>>(null);
  const pillRef = useRef<ComponentRef<typeof View>>(null);
  const titleRef = useRef<ComponentRef<typeof View>>(null);
  useReaderMoment(titleRef, { momentKey, title: lead + title, note, stay });
  // A reader hears the moment's note after the title, as its hint (use-reader-moment.ts).
  const readerHint = useReaderMode() ? momentHint(note) : undefined;
  const [room, setRoom] = useState({ column: 0, block: 0, text: 198 });
  const measure = () => root.current?.measureInWindow((_x, y) => onTop?.(Math.round(y)));
  // The folded line is one line on a short phone (under DENSE_BELOW tall, as the choice rows) and two on a taller one.
  const { height: screenHeight, fontScale } = useWindowDimensions();
  const dense = isDense(screenHeight, s);
  const lines = dockLines({ guide, note, unavailable, chars: (dense ? 1 : 2) * labelChars(room.text - PILL_PT * s, s, fontScale) });
  // The words' window (budget in dock/budget.ts): the title keeps the lines that fit above the folded line and the buttons (and, with the
  // choice open, above one row), and the rest of it waits behind the "i", which sits on the title row when the room cannot hold a
  // folded line. With the choice open the folded line waits behind the "i" too.
  const space = room.column > 0 ? wordsWindow({ room: room.column, block: room.block + (trayOpen ? trayRoom(smallPictures(screenHeight, s), fontScale) * s : 0), dense }, s) : Infinity;
  // The readout's result (one line while the rows are open) and the refusal (three lines) are fixed slots on a dense dock; a cut one is whole behind the "i".
  const chars = labelChars(room.text, s, fontScale);
  const cutWords = (dense && trayOpen && readout?.result != null && lineCount(readout.result, chars) > 1) || (dense && refusal != null && lineCount(refusal, chars) > 3);
  const plan = planWords({ space, dense, clamp: trayOpen, title: lead + title, textWidth: room.text, hasLine: !trayOpen && lines.first != null, foldable: lines.foldable || (trayOpen && lines.first != null) || cutWords, text: fontScale }, s);
  const pill = plan.pill ? (
    // The "i" button (`dock-more`) opens the full title and every line; the More pill (`dock-more-actions`) folds the reading aids.
    // 26 pt round with a 44 pt target that stays clear of the line's words (6 pt gap) and inside the dock's padding.
    <Pressable
      {...pillRing.props}
      ref={pillRef}
      testID="dock-more"
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="More about this moment"
      hitSlop={{ top: touchSlop(s, PILL * s), bottom: touchSlop(s, PILL * s), left: 6 * s, right: 12 * s }}
      onPress={() => pillRef.current?.measureInWindow((_x, y) => onLines?.(Math.round(y)))}
    >
      <View className="items-center justify-center" style={{ width: PILL * s, height: PILL * s, borderRadius: CONTROL_RADIUS, backgroundColor: withAlphaHex(t.bone, 0.1), ...pillRing.style }}>
        <Text className="text-label font-semibold" style={{ color: t.bone }}>
          i
        </Text>
      </View>
    </Pressable>
  ) : null;
  const readoutLine = dense && trayOpen;
  // A title that opens its card is underlined faintly, so the name reads as a link to the card.
  const titleStyle = onTitle ? { flexShrink: 0, textDecorationLine: "underline" as const, textDecorationColor: withAlphaHex(t.bone, 0.35) } : { flexShrink: 0 };
  return (
    <View pointerEvents={hidden ? "none" : "box-none"} importantForAccessibility={hidden ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={hidden === true} style={{ flex: 1, minHeight: 0, justifyContent: "flex-end", opacity: hidden ? 0 : 1 }} onLayout={(event) => setRoom((now) => ({ ...now, column: Math.round(event.nativeEvent.layout.height) }))}>
      {/* No panel: the dock stands on the command column's fade (table/view.tsx). The words, the choice's rows (when it is open) and the
          numbers and buttons are stacked from the foot of the column up. The column's empty top above them passes taps to the canvas. */}
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
              {/* A budgeted slot (planWords): the title keeps the lines the room holds at the phone's text size; a cut title is whole behind the "i". */}
              <Text ref={titleRef} testID="sheet-title" accessibilityRole="header" accessibilityLabel={[step, title, trayOpen ? count.replaceAll(" · ", ", ") : ""].filter(Boolean).join(". ")} accessibilityHint={readerHint} numberOfLines={plan.titleLines} className="flex-1 font-display text-heading text-bone" style={titleStyle} onPress={onTitle} suppressHighlighting>
                {lead + title}
              </Text>
              {plan.pillOnTitle ? pill : null}
            </View>
            {plan.showLine && lines.first ? (
              <View className="mt-0.5 flex-row items-start gap-1.5">
                {/* A budgeted slot (dockLines, labelChars at the font scale): one line shows on a dense dock, two on a taller one; the rest is behind the "i". A screen reader hears every line from it. */}
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
            <Text testID="sheet-refusal" numberOfLines={dense ? 3 : capLines(3, fontScale)} className="text-center text-label text-danger">
              {refusal}
            </Text>
          ) : null}
          <DockButtons key={resetKey} dock={dock} extras={extras} more={more} aidsFolded={aidsFolded} onMore={onMore} picked={picked} dense={dense} chars={chars} onButton={onButton} />
        </View>
      </View>
    </View>
  );
}
