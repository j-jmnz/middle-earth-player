// The settings rows the Settings tab (src/screens/settings/view.tsx) and the table's settings panel (reading-panels.tsx) share (docs/design-system.md,
// Components and Settings; user request, 2026-10-28): the grouped sections with their choices and switches, so the two cannot drift apart.
// They live in src/play because src/play cannot import src/screens. `testPrefix` is `app-settings` on the tab and `settings` on the panel.
import { Platform, View } from "react-native";
import type { ReactNode } from "react";

import { TextButton } from "../../ui/buttons.tsx";
import { Segmented } from "../../ui/segmented.tsx";
import { SettingSwitch } from "../../ui/setting-switch.tsx";
import { ALWAYS_EMPTY_LINE, BANNER_CLOSES_LINE, BANNER_CLOSES_WORDS, ALWAYS_LINE, AWAKE_LINE, CONFIRM_TIME_LINE, CONFIRM_TIME_WORDS, CONTRAST_LINE, fogLine, GUIDE_LINE, HAPTICS_LINE, NONE_YET, PERFORMANCE_LINE, QUALITY_LINE, QUALITY_WORDS, REDUCE_MOTION_LINE, REDUCE_MOTION_WORDS, SCALE_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, STOPS_LINE, STRONG_OUTLINES_WORDS, TITLE_FACE_LINE, TITLE_FACE_WORDS, TABLE_LIST_LINE, TABLE_LIST_WORDS, THEME_LABELS, THEME_LINE, THEME_WORDS, type AlwaysRow } from "./settings-words.ts";
import { SPEEDS } from "../../ui/motion-tokens.ts";
import { useReduceMotion } from "../../ui/motion-run.ts";
import { BANNER_CLOSES_OPTIONS, CARD_QUALITY_OPTIONS, CONFIRM_TIME_OPTIONS, REDUCE_MOTION_OPTIONS, STRONG_OUTLINES_OPTIONS, TABLE_LIST_OPTIONS, THEME_OPTIONS, TITLE_FACE_OPTIONS, UI_SCALE_OPTIONS, type TableSettings } from "../../ui/table-settings.ts";
import { SectionHeading } from "../../ui/section-heading.tsx";
import { useTheme } from "../../ui/theme.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { Text } from "../../ui/text.tsx";

export type SettingGroupId = "display" | "performance" | "motion" | "table";

/** A choice row: its name and what it does over the control, which keeps the full width so three words fit at Large. */
export function SettingChoice({ title, detail, children, testID }: { title: string; detail?: string; children: ReactNode; testID: string }) {
  const s = useUiScale();
  return (
    <View testID={testID} className="min-h-touch" style={{ paddingVertical: 6 * s, gap: 6 * s }}>
      <View>
        <Text className="text-body font-semibold text-bone">{title}</Text>
        {detail ? <Text className="text-label text-muted">{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** A choice row over a stretched Segmented: `id` is the row's test id and the options' prefix, `title` its name to a screen reader too. */
export function ChoiceRow<T extends string>({ title, detail, id, options, words, labels, value, onChange }: { title: string; detail: string; id: string; options: readonly T[]; words: Partial<Record<T, string>>; labels?: Partial<Record<T, string>>; value: T; onChange: (next: T) => void }) {
  return (
    <SettingChoice title={title} detail={detail} testID={id}>
      <Segmented options={options} value={value} onChange={onChange} testIDPrefix={id} accessibilityLabel={title} stretch words={words} labels={labels} />
    </SettingChoice>
  );
}

/**
 * A group of rows under a section heading, with an optional `note` under it that says what the whole group is for. `first` drops the top
 * margin, for the group that opens a panel under its title.
 */
export function SettingGroup({ title, note, testID, first = false, children }: { title: string; note?: string; testID: string; first?: boolean; children: ReactNode }) {
  const s = useUiScale();
  return (
    <View testID={testID} style={{ marginTop: first ? 0 : 20 * s }}>
      <SectionHeading title={title} />
      {note ? (
        <Text testID={`${testID}-note`} className="text-label text-muted" style={{ marginBottom: 4 * s }}>
          {note}
        </Text>
      ) : null}
      <View style={{ gap: 4 * s }}>{children}</View>
    </View>
  );
}

/**
 * The groups: Display (Theme, UI scale, Strong outlines), Performance (Card pictures, Moving fog: the two switches whose only job is to ease
 * a slow phone, under a note that says so), Motion and feel (Animation speed, Reduce motion, Combat spotlight, Haptics) and At the table
 * (First-game guide, Stops on when `stops`, Table as a list on a phone, Confirm time, Keep screen awake and the Responses used every time). Every row shows what it does. `groups` picks which to draw, so a wide Settings page can split them across two columns. Every change
 * goes through `onChange`; the stored `uiScale` and `theme` apply at once. The Stops switch is the tab's: the table's rail carries Stops.
 */
export function SettingsRows({
  settings,
  onChange,
  always,
  testPrefix,
  groups = ["display", "performance", "motion", "table"],
  stops = false,
  first = false,
}: {
  settings: TableSettings;
  onChange: (change: Partial<TableSettings>) => void;
  // The free Responses set to Always, by name: tap to have the table ask again.
  always: readonly AlwaysRow[];
  testPrefix: string;
  groups?: readonly SettingGroupId[];
  stops?: boolean;
  // The first drawn group sits right under a title: no top margin (the panel). The tab leaves it off.
  first?: boolean;
}) {
  const id = (name: string) => `${testPrefix}-${name}`;
  const top = groups[0];
  // The fog is already still under reduced motion: the row says so, dimmed, and still saves. On Rivendell it moves only the table's fog, and says so.
  const light = useTheme() === "light";
  const reduced = useReduceMotion();
  const fogStill = reduced;
  return (
    <>
      {groups.includes("display") ? (
        <SettingGroup title="Display" testID={id("display")} first={first && top === "display"}>
          <ChoiceRow title="Theme" detail={THEME_LINE} id={id("theme")} options={THEME_OPTIONS} words={THEME_WORDS} labels={THEME_LABELS} value={settings.theme} onChange={(theme) => onChange({ theme })} />
          <ChoiceRow title="UI scale" detail={SCALE_LINE} id={id("scale")} options={UI_SCALE_OPTIONS} words={SCALE_WORDS} value={settings.uiScale} onChange={(uiScale) => onChange({ uiScale })} />
          <ChoiceRow title="Strong outlines" detail={CONTRAST_LINE} id={id("contrast")} options={STRONG_OUTLINES_OPTIONS} words={STRONG_OUTLINES_WORDS} value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} />
          <ChoiceRow title="Title face" detail={TITLE_FACE_LINE} id={id("title-face")} options={TITLE_FACE_OPTIONS} words={TITLE_FACE_WORDS} value={settings.titleFace} onChange={(titleFace) => onChange({ titleFace })} />
        </SettingGroup>
      ) : null}

      {groups.includes("performance") ? (
        <SettingGroup title="Performance" note={PERFORMANCE_LINE} testID={id("performance")} first={first && top === "performance"}>
          <ChoiceRow title="Card pictures" detail={QUALITY_LINE} id={id("quality")} options={CARD_QUALITY_OPTIONS} words={QUALITY_WORDS} value={settings.cardQuality} onChange={(cardQuality) => onChange({ cardQuality })} />
          <SettingSwitch roomy label="Moving fog" detail={fogLine(light, reduced)} dim={fogStill} value={settings.fogDrift} onChange={(fogDrift) => onChange({ fogDrift })} testID={id("fog")} />
        </SettingGroup>
      ) : null}

      {groups.includes("motion") ? (
        <SettingGroup title="Motion and feel" testID={id("motion")} first={first && top === "motion"}>
          <ChoiceRow title="Animation speed" detail={SPEED_LINE} id={id("speed")} options={SPEEDS} words={SPEED_WORDS} value={settings.animationSpeed} onChange={(animationSpeed) => onChange({ animationSpeed })} />
          <ChoiceRow title="Reduce motion" detail={REDUCE_MOTION_LINE} id={id("reduce-motion")} options={REDUCE_MOTION_OPTIONS} words={REDUCE_MOTION_WORDS} value={settings.reduceMotion} onChange={(reduceMotion) => onChange({ reduceMotion })} />
          <ChoiceRow title="Banner closes" detail={BANNER_CLOSES_LINE} id={id("banner-closes")} options={BANNER_CLOSES_OPTIONS} words={BANNER_CLOSES_WORDS} value={settings.bannerCloses} onChange={(bannerCloses) => onChange({ bannerCloses })} />
          <SettingSwitch roomy label="Combat spotlight" detail={SPOTLIGHT_LINE} value={settings.spotlight} onChange={(spotlight) => onChange({ spotlight })} testID={id("spotlight")} />
          <SettingSwitch roomy label="Haptics" detail={HAPTICS_LINE} value={settings.haptics} onChange={(haptics) => onChange({ haptics })} testID={id("haptics")} />
        </SettingGroup>
      ) : null}

      {groups.includes("table") ? (
        <SettingGroup title="At the table" testID={id("table")} first={first && top === "table"}>
          <SettingSwitch roomy label="First-game guide" detail={GUIDE_LINE} value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID={id("guide")} />
          {stops ? <SettingSwitch roomy label="Stops on" detail={STOPS_LINE} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID={id("stops")} /> : null}
          {/* The web build is already a list of names: the row would change nothing there. */}
          {Platform.OS !== "web" ? (
            <ChoiceRow title="Table as a list" detail={TABLE_LIST_LINE} id={id("table-list")} options={TABLE_LIST_OPTIONS} words={TABLE_LIST_WORDS} value={settings.tableAsList} onChange={(tableAsList) => onChange({ tableAsList })} />
          ) : null}
          <ChoiceRow title="Confirm time" detail={CONFIRM_TIME_LINE} id={id("confirm-time")} options={CONFIRM_TIME_OPTIONS} words={CONFIRM_TIME_WORDS} value={settings.confirmTime} onChange={(confirmTime) => onChange({ confirmTime })} />
          <SettingSwitch roomy label="Keep screen awake" detail={AWAKE_LINE} value={settings.keepAwake} onChange={(keepAwake) => onChange({ keepAwake })} testID={id("awake")} />
          <SettingChoice title="Responses used every time" detail={always.length > 0 ? ALWAYS_LINE : ALWAYS_EMPTY_LINE} testID={id("always")}>
            {always.length === 0 ? (
              <Text testID={id("always-none")} className="text-label text-muted">
                {NONE_YET}
              </Text>
            ) : null}
            <View className="-mx-3 items-start">
              {always.map((row) => (
                <TextButton tone="accent" key={row.effectId} label={row.label} accessibilityLabel={`Ask again: ${row.label}`} testID={id(`always-${row.effectId}`)} onPress={() => onChange({ alwaysUse: settings.alwaysUse.filter((effectId) => effectId !== row.effectId) })} />
              ))}
            </View>
          </SettingChoice>
        </SettingGroup>
      ) : null}
    </>
  );
}
