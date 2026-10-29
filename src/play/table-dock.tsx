// The dock beside the table, in reach of the right thumb: what the engine is asking (the step, the moment, a sentence), the
// engine's numbers for it (willpower against threat, attack against defense), what the player has picked on the table, and
// the buttons that confirm it (docs/design-system.md, Table). Picking happens on the table; nothing here is sent until a
// button is pressed (dock-buttons.tsx). The outcome banner over the table says what the last intent did (moment-banner.tsx).
import { useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { DockButtons, type DockExtra } from "./dock-buttons.tsx";
import { isDense, labelChars, PILL_PT, planWords, wordsWindow } from "./dock-budget.ts";
import { dockLines } from "./dock-lines.ts";
import type { Readout } from "./readout.ts";
import { Stats } from "./sheet-paper.tsx";
import type { Unavailable } from "./sheet-types.ts";
import type { Dock, DockButton } from "./table-choice.ts";
import { panelSurface } from "./surfaces.ts";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { touchSlop, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** The engine's numbers for the moment, large, and what they come to: on a sunk band in the dock (no drawn edge), ink on a paper panel. */
// `oneLine`: the result is one line (the choice tray is open over the dock on a short phone); its words stay in the label.
export function ReadoutView({ readout, surface = "night", tight = false, oneLine = false }: { readout: Readout; surface?: "night" | "paper"; tight?: boolean; oneLine?: boolean }) {
  const t = useTableTokens();
  const paper = surface === "paper";
  return (
    <View
      testID={`readout-${readout.kind}`}
      className={`rounded-tile px-2 ${tight ? "py-0.5" : "py-1.5"} ${paper ? "border border-inkLine" : ""}`}
      style={paper ? undefined : { backgroundColor: withAlphaHex(t.night, 0.5) }}
    >
      <View className="flex-row items-center justify-center gap-2">
        {readout.stats.map((stat, index) => (
          <View key={stat.word} className="flex-row items-center gap-2">
            {index > 0 ? <Text className={`text-label ${paper ? "text-inkMuted" : "text-faint"}`}>{readout.join ?? "against"}</Text> : null}
            <Stats stats={[stat]} surface={surface} size="title" />
          </View>
        ))}
      </View>
      {readout.result ? (
        <Text testID="readout-result" numberOfLines={oneLine ? 1 : 3} accessibilityLabel={readout.result} className={`${tight ? "" : "mt-0.5"} text-center text-label ${paper ? "text-ink" : "text-muted"}`}>
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
// The shadow that lifts the dock (and the tray standing on it) off the table while the tray stands on it; at rest it is a floating panel.
const dockShadowOf = (t: TableTokens) => `0 8px 24px ${withAlphaHex(t.shade, t.depth === "light" ? 0.25 : 0.85)}`;

// The tone of a line of words under the title: the guide and the note muted, under the bone title; what the rules refuse faint.
export const lineTone = (kind: "guide" | "note" | "unavailable") => (kind === "unavailable" ? "text-faint" : "text-muted");

export function TableDock({
  step,
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
  onBlock,
}: {
  step: string;
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
  // The choice tray is open over the words: they are not drawn (a half glyph would show in the gap above the block) and, on a
  // short phone, the readout is one line (its words stay in the accessibility label), so the tray gets the room.
  trayOpen?: boolean;
  // The screen y of the top of the block under the sentence (the readout, the armed line and the buttons): the choice tray's
  // foot stays above it.
  onBlock?: (top: number) => void;
}) {
  const t = useTableTokens();
  // The UI scale (ui-scale.ts): the dock's padding and budget are Medium's sizes times it.
  const s = useUiScale();
  const dockShadow = dockShadowOf(t);
  const block = useRef<ComponentRef<typeof View>>(null);
  const pillRef = useRef<ComponentRef<typeof View>>(null);
  const [room, setRoom] = useState({ column: 0, block: 0, text: 198 });
  const measure = () => block.current?.measureInWindow((_x, y) => onBlock?.(Math.round(y)));
  // The folded line is one line on a short phone (under DENSE_BELOW tall, as the choice tray's dense tiles) and two on a taller one.
  const dense = isDense(useWindowDimensions().height, s);
  const lines = dockLines({ guide, note, unavailable, chars: (dense ? 1 : 2) * labelChars(room.text - PILL_PT * s, s) });
  // The words' window (budget in dock-budget.ts): the title keeps the lines that fit under the step and the folded line, and the
  // rest of it waits behind the "i", which sits on the title row when the room cannot hold a folded line.
  const space = room.column > 0 ? wordsWindow({ room: room.column, block: room.block, dense }, s) : Infinity;
  const plan = planWords({ space, dense, title, textWidth: room.text, hasLine: lines.first != null, foldable: lines.foldable }, s);
  const pill = plan.pill ? (
    // The "i" pill (`dock-more`) opens the full title and every line; the More pill (`dock-more-actions`) folds the quiet
    // buttons. 24 pt with a 44 pt target that stays clear of the line's words (6 pt gap) and inside the dock's padding.
    <Pressable
      ref={pillRef}
      testID="dock-more"
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="More about this moment"
      hitSlop={{ top: touchSlop(s, 24 * s), bottom: touchSlop(s, 24 * s), left: 6 * s, right: 12 * s }}
      onPress={() => pillRef.current?.measureInWindow((_x, y) => onLines?.(Math.round(y)))}
    >
      <View className="h-6 w-6 items-center justify-center rounded-pill" style={{ backgroundColor: withAlphaHex(t.bone, 0.1) }}>
        <Text className="text-label font-semibold" style={{ color: t.bone }}>
          i
        </Text>
      </View>
    </Pressable>
  ) : null;
  const readoutLine = dense && trayOpen;
  return (
    <View style={{ flex: 1, minHeight: 0, justifyContent: "flex-end" }} onLayout={(event) => setRoom((now) => ({ ...now, column: Math.round(event.nativeEvent.layout.height) }))}>
      {/* One floating panel with no drawn edge, lifted off the table by its shadow and lit along its top. While the choice tray is open the tray stands on it
          as its upper part (tray-frame.tsx): the words are not drawn and the dock's top corners are square, so the two read as one. */}
      <View
        testID="dock"
        className="rounded-card px-3"
        style={{
          ...panelSurface(false, t),
          boxShadow: trayOpen ? dockShadow : panelSurface(false, t).boxShadow,
          paddingTop: trayOpen ? 0 : (dense ? DENSE_PAD : TOP_PAD) * s,
          paddingBottom: (dense ? DENSE_PAD : FOOT_PAD) * s,
          ...(trayOpen ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}),
          flexShrink: 1,
        }}
      >
        {/* The words above the numbers are budgeted to fit (planWords); the guard scrolls only on a taller screen's long lines. The
            readout, the armed line and every button are pinned to the dock's foot and never scroll away. */}
        {trayOpen ? null : (
          <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 0 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <View onLayout={(event) => setRoom((now) => ({ ...now, text: Math.round(event.nativeEvent.layout.width) }))} style={{ paddingBottom: (dense ? 2 : 8) * s }}>
              <Text testID="sheet-step" numberOfLines={1} className="font-bold text-eyebrow uppercase text-accent" style={{ flexShrink: 0 }}>
                {step}
              </Text>
              <View className="flex-row items-start gap-1.5">
                <Text testID="sheet-title" accessibilityRole="header" accessibilityLabel={title} numberOfLines={plan.titleLines} className="flex-1 font-display text-heading text-bone" style={{ flexShrink: 0 }}>
                  {title}
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
        )}
        <View
          ref={block}
          collapsable={false}
          onLayout={(event) => {
            setRoom((now) => ({ ...now, block: Math.round(event.nativeEvent.layout.height) }));
            measure();
          }}
          className={dense ? "gap-0.5" : "gap-1"}
          style={{ flexShrink: 0, paddingTop: trayOpen ? (dense ? DENSE_PAD : TOP_PAD) * s : 0 }}
        >
          {readout ? <ReadoutView readout={readout} tight={dense} oneLine={readoutLine} /> : null}
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
