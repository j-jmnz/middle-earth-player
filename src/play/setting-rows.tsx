// The settings rows the Settings tab (src/screens/settings-view.tsx) and the table's settings panel (reading-panels.tsx) share (docs/design-system.md,
// Components and Settings; user request, 2026-10-28): the grouped sections with their choices and switches, so the two cannot drift apart.
// They live in src/play because src/play cannot import src/screens. `testPrefix` is `app-settings` on the tab and `settings` on the panel.
import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

import { Segmented } from "./segmented.tsx";
import { SettingSwitch } from "./setting-switch.tsx";
import { AWAKE_LINE, CONTRAST_LINE, GUIDE_LINE, HAPTICS_LINE, NONE_YET, REDUCE_MOTION_LINE, REDUCE_MOTION_WORDS, SCALE_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, STOPS_LINE, THEME_LINE, THEME_WORDS, type AlwaysRow } from "./settings-words.ts";
import { SPEEDS } from "./motion-tokens.ts";
import { REDUCE_MOTION_OPTIONS, THEME_OPTIONS, UI_SCALE_OPTIONS, type TableSettings } from "./table-settings.ts";
import { SectionHeading } from "./section-heading.tsx";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

export type SettingGroupId = "display" | "motion" | "table";

/** A choice row: its name and what it does over the control, which keeps the full width so three words fit at Large. */
export function SettingChoice({ title, detail, children, testID }: { title: string; detail?: string; children: ReactNode; testID: string }) {
  const s = useUiScale();
  return (
    <View testID={testID} className="min-h-touch" style={{ paddingVertical: 6 * s, gap: 6 * s }}>
      <View>
        <Text className="text-body text-bone">{title}</Text>
        {detail ? <Text className="text-label text-muted">{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** A group of rows under a section heading. `first` drops the top margin, for the group that opens a panel under its title. */
export function SettingGroup({ title, testID, first = false, children }: { title: string; testID: string; first?: boolean; children: ReactNode }) {
  const s = useUiScale();
  return (
    <View testID={testID} style={{ marginTop: first ? 0 : 20 * s }}>
      <SectionHeading title={title} />
      <View style={{ gap: 4 * s }}>{children}</View>
    </View>
  );
}

/** An accent text button on night: body type, 44 pt, a pressed fill. The screens-side twin is `TextButton` (chrome-buttons.tsx), which this look matches; the caller keeps it left with `-mx-3 items-start`. */
export function SettingTextButton({ label, accessibilityLabel, onPress, testID }: { label: string; accessibilityLabel?: string; onPress: () => void; testID: string }) {
  const t = useTableTokens();
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className="min-h-touch items-center justify-center rounded-tile px-3"
      style={({ pressed }) => (pressed ? { backgroundColor: t.pressed } : undefined)}
    >
      <Text className="text-body font-medium text-accent">{label}</Text>
    </Pressable>
  );
}

/**
 * The groups, in the order a setting is reached during a game: Display (Theme, UI scale, Strong outlines), Motion and feel (Animation
 * speed, Reduce motion, Combat spotlight, Haptics) and At the table (First-game guide, Stops on when `stops`, Keep screen awake and the
 * Responses used every time). `groups` picks which to draw, so a wide Settings page can split them across two columns. Every change
 * goes through `onChange`; the stored `uiScale` and `theme` apply at once. The Stops switch is the tab's: the table's rail carries Stops.
 */
export function SettingsRows({
  settings,
  onChange,
  always,
  testPrefix,
  groups = ["display", "motion", "table"],
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
  return (
    <>
      {groups.includes("display") ? (
        <SettingGroup title="Display" testID={id("display")} first={first && top === "display"}>
          <SettingChoice title="Theme" detail={THEME_LINE} testID={id("theme")}>
            <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => onChange({ theme })} testIDPrefix={id("theme")} accessibilityLabel="Theme" stretch words={THEME_WORDS} />
          </SettingChoice>
          <SettingChoice title="UI scale" detail={SCALE_LINE} testID={id("scale")}>
            <Segmented options={UI_SCALE_OPTIONS} value={settings.uiScale} onChange={(uiScale) => onChange({ uiScale })} testIDPrefix={id("scale")} accessibilityLabel="UI scale" stretch words={SCALE_WORDS} />
          </SettingChoice>
          <SettingSwitch roomy label="Strong outlines" detail={CONTRAST_LINE} value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} testID={id("contrast")} />
        </SettingGroup>
      ) : null}

      {groups.includes("motion") ? (
        <SettingGroup title="Motion and feel" testID={id("motion")} first={first && top === "motion"}>
          <SettingChoice title="Animation speed" detail={SPEED_LINE} testID={id("speed")}>
            <Segmented options={SPEEDS} value={settings.animationSpeed} onChange={(animationSpeed) => onChange({ animationSpeed })} testIDPrefix={id("speed")} accessibilityLabel="Animation speed" stretch words={SPEED_WORDS} />
          </SettingChoice>
          <SettingChoice title="Reduce motion" detail={REDUCE_MOTION_LINE} testID={id("reduce-motion")}>
            <Segmented options={REDUCE_MOTION_OPTIONS} value={settings.reduceMotion} onChange={(reduceMotion) => onChange({ reduceMotion })} testIDPrefix={id("reduce-motion")} accessibilityLabel="Reduce motion" stretch words={REDUCE_MOTION_WORDS} />
          </SettingChoice>
          <SettingSwitch roomy label="Combat spotlight" detail={SPOTLIGHT_LINE} value={settings.spotlight} onChange={(spotlight) => onChange({ spotlight })} testID={id("spotlight")} />
          <SettingSwitch roomy label="Haptics" detail={HAPTICS_LINE} value={settings.haptics} onChange={(haptics) => onChange({ haptics })} testID={id("haptics")} />
        </SettingGroup>
      ) : null}

      {groups.includes("table") ? (
        <SettingGroup title="At the table" testID={id("table")} first={first && top === "table"}>
          <SettingSwitch roomy label="First-game guide" detail={GUIDE_LINE} value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID={id("guide")} />
          {stops ? <SettingSwitch roomy label="Stops on" detail={STOPS_LINE} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID={id("stops")} /> : null}
          <SettingSwitch roomy label="Keep screen awake" detail={AWAKE_LINE} value={settings.keepAwake} onChange={(keepAwake) => onChange({ keepAwake })} testID={id("awake")} />
          <SettingChoice title="Responses used every time" detail={always.length > 0 ? "Tap one to have the table ask again." : undefined} testID={id("always")}>
            {always.length === 0 ? (
              <Text testID={id("always-none")} className="text-label text-muted">
                {NONE_YET}
              </Text>
            ) : null}
            <View className="-mx-3 items-start">
              {always.map((row) => (
                <SettingTextButton key={row.effectId} label={row.label} accessibilityLabel={`Ask again: ${row.label}`} testID={id(`always-${row.effectId}`)} onPress={() => onChange({ alwaysUse: settings.alwaysUse.filter((effectId) => effectId !== row.effectId) })} />
              ))}
            </View>
          </SettingChoice>
        </SettingGroup>
      ) : null}
    </>
  );
}
