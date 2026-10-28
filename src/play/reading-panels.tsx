// The reading panels (docs/design-system.md, Table, Panels; phase 21): a discard pile's cards, this round's log, the threat
// panel from a dial and the table settings from the menu. They open in one place, the same tray frame (tray-frame.tsx), one at a
// time: a new one replaces the last (reading.ts). Each has a labeled Close and closes on a tap outside. They stay on paper:
// they are what gets read and recorded. Text, switches and tiles that show a card large; nothing here sends an intent.
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import type { LogLine } from "./log.ts";
import { SPEEDS } from "./motion-tokens.ts";
import { ChromeButton, Tile } from "./sheet-paper.tsx";
import { LineMark } from "./table-chrome.tsx";
import { CONTRAST_LINE, GUIDE_LINE, HAPTICS_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, THEME_WORDS } from "./settings-words.ts";
import { THEME_OPTIONS, UI_SCALE_OPTIONS, type TableSettings } from "./table-settings.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

/**
 * A discard pile's cards, the one on top first. A tap shows a card large. A card the open window lets the seat play from the
 * pile (Elven-light) says so, and a tap on it opens its play, as a tap on a hand card does; a long press still shows it large.
 */
export function PileList({
  title,
  cards,
  playable = [],
  onRead,
  onPlay,
  onClose,
}: {
  title: string;
  cards: readonly { id: string; label: string }[];
  playable?: readonly string[];
  onRead: (cardId: string) => void;
  onPlay?: (cardId: string) => void;
  onClose: () => void;
}) {
  return (
    <View testID="pile-list" collapsable={false} style={{ flexShrink: 1 }}>
      <Text className="text-center font-display-bold text-eyebrow uppercase text-inkLabel">{`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}</Text>
      <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
        {title}
      </Text>
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-inkMuted">The pile is empty.</Text> : null}
        {cards.map((card) =>
          playable.includes(card.id) && onPlay ? (
            <Tile key={card.id} label={card.label} detail="Can be played from here now. Tap to play it." selected testID={`pile-card-${card.id}`} onPress={() => onPlay(card.id)} onLongPress={() => onRead(card.id)} />
          ) : (
            <Tile key={card.id} label={card.label} selected={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
          ),
        )}
      </ScrollView>
      <View className="items-center pt-1">
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="pile-list-close" tone="ink" onPress={onClose} />
      </View>
    </View>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  const t = useTableTokens();
  return (
    <View testID="log-sheet" collapsable={false} style={{ flexShrink: 1 }}>
      <View className="items-center">
        <Text className="font-display-bold text-eyebrow uppercase text-inkLabel">Log</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">{`Round ${round}`}</Text>
      </View>
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        {lines.length === 0 ? <Text className="text-center text-body text-inkMuted">Nothing has happened this round yet.</Text> : null}
        {lines.map((line) => (
          <View key={line.key} testID={`log-line-${line.key}`} className="border-b py-2" style={{ borderColor: t.inkLine }}>
            <View className="flex-row items-center gap-2">
              <LineMark mark={line.mark} />
              <Text className="shrink text-body text-ink">{line.text}</Text>
            </View>
            {line.cause ? <Text className="mt-0.5 text-label text-inkMuted">{line.cause}</Text> : null}
          </View>
        ))}
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="log-close" tone="ink" onPress={onClose} />
      </View>
    </View>
  );
}

/**
 * The threat panel a tap on the dial opens: the seat's threat against the elimination level, each enemy in staging with its
 * engagement cost and whether the engagement checks engage it at this threat, and what the round still adds (rr.engagement-check,
 * rr.refresh-phase, rr.threat-elimination-level). Text only.
 */
export function ThreatPanel({
  seatLabel,
  threat,
  rows,
  onClose,
}: {
  seatLabel: string;
  threat: number;
  rows: readonly { id: string; name: string; cost: number; verdict: { word: string; engages: boolean } }[];
  onClose: () => void;
}) {
  const t = useTableTokens();
  return (
    <View testID="threat-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View className="items-center">
        <Text className="font-display-bold text-eyebrow uppercase text-inkLabel">{seatLabel}</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">{`Threat ${threat} of 50`}</Text>
      </View>
      <ScrollView className="mt-3" style={{ flexGrow: 0, flexShrink: 1 }}>
        <Text className="text-body text-inkMuted">At the engagement checks, each enemy in staging whose engagement cost is at or below your threat engages you. At 50 you are eliminated.</Text>
        {rows.length === 0 ? <Text className="mt-2 text-body text-inkMuted">No enemy is in staging.</Text> : null}
        {rows.map((row) => (
          <View
            key={row.id}
            testID={`threat-row-${row.id}`}
            accessible
            accessibilityLabel={`${row.name}, engagement cost ${row.cost}, ${row.verdict.word}`}
            className="flex-row items-center justify-between border-b py-2 pl-2"
            // An enemy that engages you is marked by a threat-red rule at its left; its word stays ink, readable on paper.
            style={{ borderColor: t.inkLine, borderLeftWidth: 3, borderLeftColor: row.verdict.engages ? t.threat : "transparent" }}
          >
            <Text className="shrink text-body text-ink">{row.name}</Text>
            <Text className={`font-display-bold text-body ${row.verdict.engages ? "text-ink" : "text-inkMuted"}`}>{`${row.cost} · ${row.verdict.word}`}</Text>
          </View>
        ))}
        <Text className="mt-2 text-label text-inkMuted">The refresh phase raises your threat by 1 at the end of the round; a failed quest raises it by what it falls short.</Text>
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="threat-panel-close" tone="ink" onPress={onClose} />
      </View>
    </View>
  );
}

// A labelled switch on paper: the whole row, at least 44 pt tall, is the control, and a screen reader hears it as a switch
// with its detail as the hint. The tracks hold 3:1 against paper (inkMuted off, ink on).
function PaperSwitch({ label, detail, value, onChange, testID }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void; testID: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable
      testID={`${testID}-row`}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 * s, paddingVertical: 4 * s, backgroundColor: pressed ? t.paperPressed : "transparent" })}
    >
      <View className="shrink" importantForAccessibility="no-hide-descendants">
        <Text className="text-body text-ink">{label}</Text>
        {detail ? <Text className="text-label text-inkMuted">{detail}</Text> : null}
      </View>
      <Switch
        testID={testID}
        accessible={false}
        importantForAccessibility="no"
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.inkMuted, true: t.ink }}
        thumbColor={t.paper}
        ios_backgroundColor={t.inkMuted}
        // react-native-web draws the on thumb from activeThumbColor (teal by default); the RN types do not list it.
        {...({ activeThumbColor: t.paper } as object)}
      />
    </Pressable>
  );
}

// A choice among a few words (Animation speed, UI scale, Theme): one row at least 44 pt tall, as the switches are: the label and what it
// does at the left, the choices as pills at the right (narrower when there are three). Each pill is a 44 pt target, the chosen one ink with
// paper text, and a screen reader hears a radio group. Pills are `${testID}-${option}`.
function PaperChoice<T extends string>({ label, detail, options, words, value, onChange, testID }: { label: string; detail?: string; options: readonly T[]; words: Readonly<Record<T, string>>; value: T; onChange: (value: T) => void; testID: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const narrow = options.length > 2;
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={{ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 * s, paddingVertical: 4 * s }}>
      <View className="shrink">
        <Text className="text-body text-ink">{label}</Text>
        {detail ? <Text className="text-label text-inkMuted">{detail}</Text> : null}
      </View>
      <View className="flex-row gap-1.5">
        {options.map((option) => {
          const on = value === option;
          return (
            <Pressable
              key={option}
              testID={`${testID}-${option}`}
              accessibilityRole="radio"
              accessibilityLabel={words[option]}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(option)}
              style={({ pressed }) => ({ minWidth: (narrow ? 50 : 60) * s, minHeight: touch(s, 44), paddingHorizontal: (narrow ? 6 : 8) * s, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.inkMuted, backgroundColor: on ? t.ink : pressed ? t.paperPressed : "transparent" })}
            >
              <Text className="text-label" style={{ color: on ? t.paper : t.ink }}>
                {words[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The table's settings, a paper side panel from the menu's Table settings: Animation speed, the Combat spotlight, Haptics, Strong outlines, UI scale, Theme, the First-game guide and the
 * Responses used every time. (The round's phases and the Stops switches are the carousel behind the rail, phase-carousel.tsx.)
 * Text and switches only; nothing here sends an intent.
 */
export function SettingsPanel({
  settings,
  always,
  onChange,
  onClose,
}: {
  settings: TableSettings;
  // The free Responses set to Always, by name: tap to have the table ask again.
  always: readonly { effectId: string; label: string }[];
  onChange: (change: Partial<TableSettings>) => void;
  onClose: () => void;
}) {
  return (
    <View testID="settings-panel" collapsable={false} style={{ flexShrink: 1 }}>
      <View className="items-center">
        <Text accessibilityRole="header" className="font-display text-title text-ink">
          Table settings
        </Text>
      </View>
      <ScrollView className="mt-2" style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator persistentScrollbar>
        <PaperChoice label="Animation speed" detail={SPEED_LINE} options={SPEEDS} words={SPEED_WORDS} value={settings.animationSpeed} onChange={(animationSpeed) => onChange({ animationSpeed })} testID="settings-speed" />
        <PaperSwitch label="Combat spotlight" detail={SPOTLIGHT_LINE} value={settings.spotlight} onChange={(spotlight) => onChange({ spotlight })} testID="settings-spotlight" />
        <PaperSwitch label="Haptics" detail={HAPTICS_LINE} value={settings.haptics} onChange={(haptics) => onChange({ haptics })} testID="settings-haptics" />
        <PaperSwitch label="Strong outlines" detail={CONTRAST_LINE} value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} testID="settings-contrast" />
        <PaperChoice label="UI scale" options={UI_SCALE_OPTIONS} words={SCALE_WORDS} value={settings.uiScale} onChange={(uiScale) => onChange({ uiScale })} testID="settings-scale" />
        <PaperChoice label="Theme" options={THEME_OPTIONS} words={THEME_WORDS} value={settings.theme} onChange={(theme) => onChange({ theme })} testID="settings-theme" />
        <PaperSwitch label="First-game guide" detail={GUIDE_LINE} value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID="settings-guide" />
        {always.length > 0 ? <Text className="mt-2 text-label text-inkMuted">Responses used every time:</Text> : null}
        {always.map((item) => (
          <ChromeButton key={item.effectId} label={item.label} testID={`settings-always-${item.effectId}`} tone="ink" onPress={() => onChange({ alwaysUse: settings.alwaysUse.filter((id) => id !== item.effectId) })} />
        ))}
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label={"\u2715 Close"} accessibilityLabel="Close" testID="settings-close" tone="ink" onPress={onClose} />
      </View>
    </View>
  );
}
