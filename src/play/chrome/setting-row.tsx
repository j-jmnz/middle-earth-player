// The settings rows the Settings pages (src/screens/settings/view.tsx) and the table's settings panel (reading-panels.tsx) share (docs/design-system.md,
// Components and Settings): each setting's row, drawn by id, so a category page, a search result and the panel say the same thing. Which rows
// each draws is settings-catalog.ts; what a platform draws is settings-platform.ts. They live in src/play because src/play cannot import
// src/screens. `testPrefix` is `app-settings` on the Settings pages and `settings` on the panel.
import { View } from "react-native";
import type { ReactNode } from "react";

import { TextButton } from "../../ui/buttons.tsx";
import { Segmented } from "../../ui/segmented.tsx";
import { SettingSwitch } from "../../ui/setting-switch.tsx";
import { ALWAYS_EMPTY_LINE, BANNER_CLOSES_LINE, BANNER_CLOSES_WORDS, ALWAYS_LINE, AWAKE_LINE, CONFIRM_TIME_LINE, CONFIRM_TIME_WORDS, CONTRAST_LINE, DEBUG_LINE, EFFECTS_VOLUME_LINE, fogLine, GUIDE_LINE, HAPTICS_LINE, MUSIC_LINE, MUSIC_VOLUME_LINE, SOUNDS_LINE, NONE_YET, QUALITY_LINE, QUALITY_WORDS, REDUCE_MOTION_LINE, REDUCE_MOTION_WORDS, SCALE_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, STOPS_LINE, STRONG_OUTLINES_WORDS, TITLE_FACE_LINE, TITLE_FACE_WORDS, TABLE_LIST_WORDS, THEME_LABELS, THEME_LINE, THEME_WORDS, TIMING_TIPS_LINE, type AlwaysRow } from "./settings-words.ts";
import { SETTING_TITLES, type SettingId } from "./settings-catalog.ts";
import { platformLine, TABLE_LIST_DETAIL } from "./settings-platform.ts";
import { CHECK_LINE } from "../../ui/update/offer.ts";
import { playSound } from "../../ui/sound/sound.ts";
import { VolumeSlider } from "../../ui/sound/volume-slider.tsx";
import { SPEEDS } from "../../ui/motion-tokens.ts";
import { useReduceMotion } from "../../ui/motion-run.ts";
import { BANNER_CLOSES_OPTIONS, CARD_QUALITY_OPTIONS, CONFIRM_TIME_OPTIONS, REDUCE_MOTION_OPTIONS, STRONG_OUTLINES_OPTIONS, TABLE_LIST_OPTIONS, THEME_OPTIONS, TITLE_FACE_OPTIONS, UI_SCALE_OPTIONS, type TableSettings } from "../../ui/table-settings.ts";
import { useTheme } from "../../ui/theme.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { Text } from "../../ui/text.tsx";

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

// A new effects volume is written, then a sound plays at it, so the player hears what they chose.
function setVolume(onChange: (change: Partial<TableSettings>) => void, soundVolume: number): void {
  onChange({ soundVolume });
  playSound("ui.confirm");
}

type RowProps = {
  settings: TableSettings;
  onChange: (change: Partial<TableSettings>) => void;
  // The free Responses set to Always, by name: tap to have the table ask again.
  always: readonly AlwaysRow[];
  testPrefix: string;
};

/**
 * The rows `rows` names, in that order, each showing what it does. Every change goes through `onChange`; the stored `uiScale` and
 * `theme` apply at once. The caller passes only rows the platform draws (settings-catalog.ts, rowsFor).
 */
export function SettingRows({ rows, ...props }: RowProps & { rows: readonly SettingId[] }) {
  return (
    <>
      {rows.map((id) => (
        <SettingRow key={id} id={id} {...props} />
      ))}
    </>
  );
}

/** One setting's row by id. */
export function SettingRow({ id, settings, onChange, always, testPrefix }: RowProps & { id: SettingId }) {
  const tid = (name: string) => `${testPrefix}-${name}`;
  // The fog is already still under reduced motion: the row says so, dimmed, and still saves. On Rivendell it moves only the table's fog, and says so.
  const light = useTheme() === "light";
  const reduced = useReduceMotion();
  const title = SETTING_TITLES[id];
  switch (id) {
    case "theme":
      return <ChoiceRow title={title} detail={THEME_LINE} id={tid("theme")} options={THEME_OPTIONS} words={THEME_WORDS} labels={THEME_LABELS} value={settings.theme} onChange={(theme) => onChange({ theme })} />;
    case "scale":
      return <ChoiceRow title={title} detail={SCALE_LINE} id={tid("scale")} options={UI_SCALE_OPTIONS} words={SCALE_WORDS} value={settings.uiScale} onChange={(uiScale) => onChange({ uiScale })} />;
    case "contrast":
      return <ChoiceRow title={title} detail={CONTRAST_LINE} id={tid("contrast")} options={STRONG_OUTLINES_OPTIONS} words={STRONG_OUTLINES_WORDS} value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} />;
    case "titleFace":
      return <ChoiceRow title={title} detail={TITLE_FACE_LINE} id={tid("title-face")} options={TITLE_FACE_OPTIONS} words={TITLE_FACE_WORDS} value={settings.titleFace} onChange={(titleFace) => onChange({ titleFace })} />;
    case "quality":
      return <ChoiceRow title={title} detail={QUALITY_LINE} id={tid("quality")} options={CARD_QUALITY_OPTIONS} words={QUALITY_WORDS} value={settings.cardQuality} onChange={(cardQuality) => onChange({ cardQuality })} />;
    case "fog":
      return <SettingSwitch roomy label={title} detail={platformLine(fogLine(light, reduced))} dim={reduced} value={settings.fogDrift} onChange={(fogDrift) => onChange({ fogDrift })} testID={tid("fog")} />;
    case "speed":
      return <ChoiceRow title={title} detail={SPEED_LINE} id={tid("speed")} options={SPEEDS} words={SPEED_WORDS} value={settings.animationSpeed} onChange={(animationSpeed) => onChange({ animationSpeed })} />;
    case "reduceMotion":
      return <ChoiceRow title={title} detail={REDUCE_MOTION_LINE} id={tid("reduce-motion")} options={REDUCE_MOTION_OPTIONS} words={REDUCE_MOTION_WORDS} value={settings.reduceMotion} onChange={(reduceMotion) => onChange({ reduceMotion })} />;
    case "bannerCloses":
      return <ChoiceRow title={title} detail={BANNER_CLOSES_LINE} id={tid("banner-closes")} options={BANNER_CLOSES_OPTIONS} words={BANNER_CLOSES_WORDS} value={settings.bannerCloses} onChange={(bannerCloses) => onChange({ bannerCloses })} />;
    case "spotlight":
      return <SettingSwitch roomy label={title} detail={SPOTLIGHT_LINE} value={settings.spotlight} onChange={(spotlight) => onChange({ spotlight })} testID={tid("spotlight")} />;
    case "haptics":
      return <SettingSwitch roomy label={title} detail={HAPTICS_LINE} value={settings.haptics} onChange={(haptics) => onChange({ haptics })} testID={tid("haptics")} />;
    case "sounds":
      return <SettingSwitch roomy label={title} detail={SOUNDS_LINE} value={settings.sounds} onChange={(sounds) => onChange({ sounds })} testID={tid("sounds")} />;
    case "soundVolume":
      return <VolumeSlider label={title} detail={EFFECTS_VOLUME_LINE} value={settings.soundVolume} dim={!settings.sounds} onChange={(soundVolume) => setVolume(onChange, soundVolume)} testID={tid("sound-volume")} />;
    case "music":
      return <SettingSwitch roomy label={title} detail={platformLine(MUSIC_LINE)} value={settings.music} onChange={(music) => onChange({ music })} testID={tid("music")} />;
    case "musicVolume":
      return <VolumeSlider label={title} detail={MUSIC_VOLUME_LINE} value={settings.musicVolume} dim={!settings.music} onChange={(musicVolume) => onChange({ musicVolume })} testID={tid("music-volume")} />;
    case "guide":
      return <SettingSwitch roomy label={title} detail={GUIDE_LINE} value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID={tid("guide")} />;
    case "stops":
      return <SettingSwitch roomy label={title} detail={STOPS_LINE} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID={tid("stops")} />;
    case "tableList":
      return <ChoiceRow title={title} detail={TABLE_LIST_DETAIL} id={tid("table-list")} options={TABLE_LIST_OPTIONS} words={TABLE_LIST_WORDS} value={settings.tableAsList} onChange={(tableAsList) => onChange({ tableAsList })} />;
    case "confirmTime":
      return <ChoiceRow title={title} detail={CONFIRM_TIME_LINE} id={tid("confirm-time")} options={CONFIRM_TIME_OPTIONS} words={CONFIRM_TIME_WORDS} value={settings.confirmTime} onChange={(confirmTime) => onChange({ confirmTime })} />;
    case "timingTips":
      return <SettingSwitch roomy label={title} detail={TIMING_TIPS_LINE} value={settings.timingTips} onChange={(timingTips) => onChange({ timingTips })} testID={tid("timing-tips")} />;
    case "awake":
      return <SettingSwitch roomy label={title} detail={platformLine(AWAKE_LINE)} value={settings.keepAwake} onChange={(keepAwake) => onChange({ keepAwake })} testID={tid("awake")} />;
    case "checkUpdates":
      return <SettingSwitch roomy label={title} detail={CHECK_LINE} value={settings.checkUpdates} onChange={(checkUpdates) => onChange({ checkUpdates })} testID={tid("check-updates")} />;
    case "debugTools":
      return <SettingSwitch roomy label={title} detail={DEBUG_LINE} value={settings.debugTools} onChange={(debugTools) => onChange({ debugTools })} testID={tid("debug-tools")} />;
    case "always":
      return (
        <SettingChoice title={title} detail={always.length > 0 ? ALWAYS_LINE : ALWAYS_EMPTY_LINE} testID={tid("always")}>
          {always.length === 0 ? (
            <Text testID={tid("always-none")} className="text-label text-muted">
              {NONE_YET}
            </Text>
          ) : null}
          <View className="-mx-3 items-start">
            {always.map((row) => (
              <TextButton tone="accent" key={row.effectId} label={row.label} accessibilityLabel={`Ask again: ${row.label}`} testID={tid(`always-${row.effectId}`)} onPress={() => onChange({ alwaysUse: settings.alwaysUse.filter((effectId) => effectId !== row.effectId) })} />
            ))}
          </View>
        </SettingChoice>
      );
  }
}
