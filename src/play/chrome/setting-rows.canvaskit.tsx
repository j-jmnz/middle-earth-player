// The settings rows on the web and the desktop (setting-rows.tsx is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only). The
// phone's `SettingsRows` hides Table as a list on the web, and this one shows it with its own words: the web draws the canvas, and the setting is the way to the list. It also draws the group the Settings tab provides through ExtraSettingsRows (backup and restore) after the last group of whichever column
// holds it. The group pieces are the phone's. scripts/checks/web-copies.test.ts holds the rest to the phone's file.
import { useContext } from "react";
import { View } from "react-native";

import { TextButton } from "../../ui/buttons.tsx";
import { SettingSwitch } from "../../ui/setting-switch.tsx";
import { ALWAYS_EMPTY_LINE, BANNER_CLOSES_LINE, BANNER_CLOSES_WORDS, ALWAYS_LINE, AWAKE_LINE, CONFIRM_TIME_LINE, CONFIRM_TIME_WORDS, CONTRAST_LINE, fogLine, GUIDE_LINE, EFFECTS_VOLUME_LINE, MUSIC_VOLUME_LINE, NONE_YET, SOUNDS_LINE, PERFORMANCE_LINE, QUALITY_LINE, QUALITY_WORDS, REDUCE_MOTION_LINE, REDUCE_MOTION_WORDS, SCALE_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, STOPS_LINE, STRONG_OUTLINES_WORDS, TITLE_FACE_LINE, TITLE_FACE_WORDS, TABLE_LIST_WORDS, THEME_LABELS, THEME_LINE, THEME_WORDS, TIMING_TIPS_LINE, type AlwaysRow } from "./settings-words.ts";
import { SPEEDS } from "../../ui/motion-tokens.ts";
import { useReduceMotion } from "../../ui/motion-run.ts";
import { BANNER_CLOSES_OPTIONS, CARD_QUALITY_OPTIONS, CONFIRM_TIME_OPTIONS, REDUCE_MOTION_OPTIONS, STRONG_OUTLINES_OPTIONS, TABLE_LIST_OPTIONS, THEME_OPTIONS, TITLE_FACE_OPTIONS, UI_SCALE_OPTIONS, type TableSettings } from "../../ui/table-settings.ts";
import { useTheme } from "../../ui/theme.ts";
import { Text } from "../../ui/text.tsx";
import { ExtraSettingsRows } from "../../ui/web/extra-settings-rows.ts";
import { MUSIC_BUNDLED } from "../../ui/sound/music.ts";
import { playSound, SOUNDS_BUNDLED } from "../../ui/sound/sound.ts";
import { VolumeSlider } from "../../ui/sound/volume-slider.tsx";
import { ChoiceRow, SettingChoice, SettingGroup, type SettingGroupId } from "./setting-rows";

export { ChoiceRow, SettingChoice, SettingGroup, type SettingGroupId };

// Table as a list, worded for a browser and the desktop app (the phone's line names TalkBack, VoiceOver and Switch Access): a screen reader a browser cannot detect and keyboard play.
const TABLE_LIST_LINE = "Lists the table's cards and choices as text, in place of the drawn table. Follow screen reader does it only while the app is told a screen reader is on; Always does it for a screen reader a browser cannot detect, for keyboard play, or if you prefer it.";

// A computer has no battery to spare and no vibration motor: the lines drop their battery clauses and the Haptics row is left out (a browser or the desktop app never vibrates).
const noBattery = (line: string): string => line.replace(/ (Off saves|Uses more) battery\./, "");

// Music, worded for a browser and the desktop app: they cannot hear another app's audio, so the music does not wait for it (other-audio.ts).
const MUSIC_LINE = "The film score: one piece for the menus, and a calm piece and a fight piece for each scenario.";

// A new effects volume is written, then a sound plays at it, so the player hears what they chose.
function setVolume(onChange: (change: Partial<TableSettings>) => void, soundVolume: number): void {
  onChange({ soundVolume });
  playSound("ui.confirm");
}

/**
 * The groups: Display (Theme, UI scale, Strong outlines), Performance (Card pictures, Moving fog: the two switches whose only job is to ease
 * a slow phone, under a note that says so), Motion and feel (Animation speed, Reduce motion, Combat spotlight, Haptics), Sound (Sound effects, Music and their volumes, each only in a bundle packed with its files) and At the table
 * (First-game guide, Stops on when `stops`, Table as a list on a phone, Confirm time, Explain timing words, Keep screen awake and the Responses used every time). Every row shows what it does. `groups` picks which to draw, so a wide Settings page can split them across two columns. Every change
 * goes through `onChange`; the stored `uiScale` and `theme` apply at once. The Stops switch is the tab's: the table's rail carries Stops.
 */
export function SettingsRows({
  settings,
  onChange,
  always,
  testPrefix,
  groups = ["display", "performance", "motion", "sound", "table"],
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
  const extra = useContext(ExtraSettingsRows);
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
          <SettingSwitch roomy label="Moving fog" detail={noBattery(fogLine(light, reduced))} dim={fogStill} value={settings.fogDrift} onChange={(fogDrift) => onChange({ fogDrift })} testID={id("fog")} />
        </SettingGroup>
      ) : null}

      {groups.includes("motion") ? (
        <SettingGroup title="Motion and feel" testID={id("motion")} first={first && top === "motion"}>
          <ChoiceRow title="Animation speed" detail={SPEED_LINE} id={id("speed")} options={SPEEDS} words={SPEED_WORDS} value={settings.animationSpeed} onChange={(animationSpeed) => onChange({ animationSpeed })} />
          <ChoiceRow title="Reduce motion" detail={REDUCE_MOTION_LINE} id={id("reduce-motion")} options={REDUCE_MOTION_OPTIONS} words={REDUCE_MOTION_WORDS} value={settings.reduceMotion} onChange={(reduceMotion) => onChange({ reduceMotion })} />
          <ChoiceRow title="Banner closes" detail={BANNER_CLOSES_LINE} id={id("banner-closes")} options={BANNER_CLOSES_OPTIONS} words={BANNER_CLOSES_WORDS} value={settings.bannerCloses} onChange={(bannerCloses) => onChange({ bannerCloses })} />
          <SettingSwitch roomy label="Combat spotlight" detail={SPOTLIGHT_LINE} value={settings.spotlight} onChange={(spotlight) => onChange({ spotlight })} testID={id("spotlight")} />
        </SettingGroup>
      ) : null}

      {/* Only a bundle packed with the sounds or the music can play them (src/ui/sound/sound.ts, music.ts). */}
      {groups.includes("sound") && (SOUNDS_BUNDLED || MUSIC_BUNDLED) ? (
        <SettingGroup title="Sound" testID={id("sound")} first={first && top === "sound"}>
          {SOUNDS_BUNDLED ? <SettingSwitch roomy label="Sound effects" detail={SOUNDS_LINE} value={settings.sounds} onChange={(sounds) => onChange({ sounds })} testID={id("sounds")} /> : null}
          {SOUNDS_BUNDLED ? <VolumeSlider label="Effects volume" detail={EFFECTS_VOLUME_LINE} value={settings.soundVolume} dim={!settings.sounds} onChange={(soundVolume) => setVolume(onChange, soundVolume)} testID={id("sound-volume")} /> : null}
          {MUSIC_BUNDLED ? <SettingSwitch roomy label="Music" detail={MUSIC_LINE} value={settings.music} onChange={(music) => onChange({ music })} testID={id("music")} /> : null}
          {MUSIC_BUNDLED ? <VolumeSlider label="Music volume" detail={MUSIC_VOLUME_LINE} value={settings.musicVolume} dim={!settings.music} onChange={(musicVolume) => onChange({ musicVolume })} testID={id("music-volume")} /> : null}
        </SettingGroup>
      ) : null}

      {groups.includes("table") ? (
        <SettingGroup title="At the table" testID={id("table")} first={first && top === "table"}>
          <SettingSwitch roomy label="First-game guide" detail={GUIDE_LINE} value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID={id("guide")} />
          {stops ? <SettingSwitch roomy label="Stops on" detail={STOPS_LINE} value={settings.stopsOn} onChange={(stopsOn) => onChange({ stopsOn })} testID={id("stops")} /> : null}
          <ChoiceRow title="Table as a list" detail={TABLE_LIST_LINE} id={id("table-list")} options={TABLE_LIST_OPTIONS} words={TABLE_LIST_WORDS} value={settings.tableAsList} onChange={(tableAsList) => onChange({ tableAsList })} />
          <ChoiceRow title="Confirm time" detail={CONFIRM_TIME_LINE} id={id("confirm-time")} options={CONFIRM_TIME_OPTIONS} words={CONFIRM_TIME_WORDS} value={settings.confirmTime} onChange={(confirmTime) => onChange({ confirmTime })} />
          <SettingSwitch roomy label="Explain timing words" detail={TIMING_TIPS_LINE} value={settings.timingTips} onChange={(timingTips) => onChange({ timingTips })} testID={id("timing-tips")} />
          <SettingSwitch roomy label="Keep screen awake" detail={noBattery(AWAKE_LINE)} value={settings.keepAwake} onChange={(keepAwake) => onChange({ keepAwake })} testID={id("awake")} />
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

      {groups.includes("table") ? extra : null}
    </>
  );
}
