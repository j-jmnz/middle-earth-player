// The reading panels (docs/design-system.md, Table, Panels; phase 21): a discard pile's cards, this round's log, the threat
// panel from a dial and the table settings from the menu. They open in one place, the same tray frame (tray-frame.tsx), one at a
// time: a new one replaces the last (reading.ts). Each has a labeled Close and closes on a tap outside. They stay on paper:
// they are what gets read and recorded. Text, switches and tiles that show a card large; nothing here sends an intent.
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import type { LogLine } from "./log.ts";
import type { Speed } from "./motion-tokens.ts";
import { ChromeButton, Tile } from "./sheet-paper.tsx";
import { LineMark } from "./table-chrome.tsx";
import type { TableSettings } from "./table-settings.ts";
import { useTableTokens } from "./use-table-tokens.ts";

/** A discard pile's cards, the one on top first. A tap shows a card large; nothing here changes the game. */
export function PileList({ title, cards, onRead, onClose }: { title: string; cards: readonly { id: string; label: string }[]; onRead: (cardId: string) => void; onClose: () => void }) {
  return (
    <View testID="pile-list" collapsable={false} style={{ flexShrink: 1 }}>
      <Text className="text-center font-display-bold text-eyebrow uppercase text-inkLabel">{`${cards.length} ${cards.length === 1 ? "card" : "cards"}`}</Text>
      <Text accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
        {title}
      </Text>
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.length === 0 ? <Text className="text-center text-body text-inkMuted">The pile is empty.</Text> : null}
        {cards.map((card) => (
          <Tile key={card.id} label={card.label} selected={false} testID={`pile-card-${card.id}`} onPress={() => onRead(card.id)} />
        ))}
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
  return (
    <Pressable
      testID={`${testID}-row`}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4, backgroundColor: pressed ? t.paperPressed : "transparent" })}
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
      />
    </Pressable>
  );
}

const SPEED_WORDS: Readonly<Record<Speed, string>> = { normal: "Normal", quick: "Quick" };

// Animation speed: one row at least 44 pt tall, as the switches are: the label and what it does at the left, the two choices as pills
// at the right, each a 44 pt target. The chosen one is ink with paper text. A screen reader hears a radio group of two.
function SpeedChoice({ value, onChange }: { value: Speed; onChange: (value: Speed) => void }) {
  const t = useTableTokens();
  return (
    <View testID="settings-speed" accessibilityRole="radiogroup" accessibilityLabel="Animation speed" style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 }}>
      <View className="shrink">
        <Text className="text-body text-ink">Animation speed</Text>
        <Text className="text-label text-inkMuted">Quick shortens every motion and skips the phase title.</Text>
      </View>
      <View className="flex-row gap-1.5">
        {(["normal", "quick"] as const).map((speed) => {
          const on = value === speed;
          return (
            <Pressable
              key={speed}
              testID={`settings-speed-${speed}`}
              accessibilityRole="radio"
              accessibilityLabel={SPEED_WORDS[speed]}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(speed)}
              style={({ pressed }) => ({ minWidth: 60, minHeight: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.inkMuted, backgroundColor: on ? t.ink : pressed ? t.paperPressed : "transparent" })}
            >
              <Text className="text-label" style={{ color: on ? t.paper : t.ink }}>
                {SPEED_WORDS[speed]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The table's settings, a paper side panel from the menu's Table settings: Animation speed, the Combat spotlight, Strong outlines, the First-game guide and the
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
      <ScrollView className="mt-2" style={{ flexGrow: 0, flexShrink: 1 }}>
        <SpeedChoice value={settings.animationSpeed} onChange={(animationSpeed) => onChange({ animationSpeed })} />
        <PaperSwitch label="Combat spotlight" detail="An attack that deals or blocks damage plays large over a darkened table. A tap skips it." value={settings.spotlight} onChange={(spotlight) => onChange({ spotlight })} testID="settings-spotlight" />
        <PaperSwitch label="Strong outlines" detail="Effect marks and token counts drawn with heavier outlines." value={settings.highContrast} onChange={(highContrast) => onChange({ highContrast })} testID="settings-contrast" />
        <PaperSwitch label="First-game guide" detail="A line under the dock's title the first two times each step comes up." value={settings.guide} onChange={(guide) => onChange({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID="settings-guide" />
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
