// The table's chrome: the phase rail, the threat rings and the bar, and the paper choice sheets. These are React Native text
// and buttons with testIDs, so Maestro can read them; card pictures stay on the canvas (docs/design-system.md, Table).
// Every press shows its pressed fill in the same frame. Phase changes and sheets animate with Reanimated, never gate a rule,
// and snap under reduced motion. Nothing here holds a number the engine did not compute.
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion, SlideInDown } from "react-native-reanimated";

import type { LogLine } from "./log.ts";
import { firstShares, shareOf, sharesReady, tapShare, type Share } from "./pay.ts";
import type { Rail } from "./rail.ts";
import type { SeatThreat } from "./selectors.ts";
import { distributeIntent, multiIntent, paySheet, type DistributeSheet, type MultiSheet, type PickSheet, type Sheet, type SheetNames, type TriggerOption, type TriggerSheet } from "./sheets.ts";
import type { PlayerIntent, ScenarioState } from "./store.ts";
import { tableTokens as t } from "./tokens.ts";

const fade = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const rise = SlideInDown.duration(220).reduceMotion(ReduceMotion.System);

/** Previous step, the current step in gold caps, the next step: one centered line above the bar. Text, not a control. */
export function PhaseRail({ rail }: { rail: Rail }) {
  return (
    <View testID="rail" accessible accessibilityLabel={`Round ${rail.round}. ${rail.current}`} className="flex-row items-center justify-center px-4 py-1">
      <Text testID="rail-previous" numberOfLines={1} className="flex-1 text-right text-label text-muted">
        {rail.previous}
      </Text>
      <Animated.View key={rail.current} entering={fade} className="mx-3">
        <Text
          testID="rail-current"
          className="font-display text-eyebrow uppercase text-gold"
          style={{ textShadowColor: t.gold, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }}
        >
          {rail.current}
        </Text>
      </Animated.View>
      <Text testID="rail-next" numberOfLines={1} className="flex-1 text-label text-muted">
        {rail.next}
      </Text>
    </View>
  );
}

/** A threat number in a ring, Marcellus, with its label. The reducer is the only writer of the number. */
export function ThreatRing({ threat, label }: { threat: SeatThreat; label: string }) {
  return (
    <View testID={`threat-${threat.seat}`} accessible accessibilityLabel={`${label} ${threat.threat}`} className="items-center">
      <View className="h-12 w-12 items-center justify-center rounded-pill" style={{ borderWidth: 2, borderColor: threat.eliminated ? t.hairline : t.gold }}>
        <Text testID={`threat-${threat.seat}-value`} className="font-display text-title text-bone">
          {String(threat.threat)}
        </Text>
      </View>
      <Text className="mt-0.5 text-label text-muted">{label}</Text>
    </View>
  );
}

/** A text button on night or paper: 44 pt target, the pressed fill in the same frame. */
export function ChromeButton({
  label,
  onPress,
  testID,
  tone = "bone",
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  tone?: "bone" | "gold" | "ink";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const color = disabled ? (tone === "ink" ? "text-inkMuted" : "text-faint") : tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : "text-bone";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 min-w-11 items-center justify-center rounded-tile px-3"
      style={({ pressed }) => (pressed && !disabled ? { backgroundColor: tone === "ink" ? t.paperPressed : t.pressed } : undefined)}
    >
      <Text className={`text-body font-medium ${color}`}>{label}</Text>
    </Pressable>
  );
}

/** The one filled action: a gold pill on night, an ink pill on paper. Disabled is a raised pill with faint text. */
export function ChromePrimary({ label, onPress, testID, disabled = false, surface = "night" }: { label: string; onPress: () => void; testID: string; disabled?: boolean; surface?: "night" | "paper" }) {
  const fill = surface === "paper" ? t.ink : t.gold;
  const pressedFill = surface === "paper" ? t.ink : t.goldDeep;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-14 items-center justify-center rounded-pill px-6"
      style={({ pressed }) => ({ backgroundColor: disabled ? t.raised : pressed ? pressedFill : fill, opacity: pressed && surface === "paper" ? 0.85 : 1 })}
    >
      <Text className={`font-display text-body uppercase tracking-widest ${disabled ? "text-faint" : surface === "paper" ? "text-paper" : "text-onGold"}`}>{label}</Text>
    </Pressable>
  );
}

function Tile({ label, selected, onPress, testID, detail }: { label: string; selected: boolean; onPress: () => void; testID: string; detail?: string | null }) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      className="mb-2 min-h-14 justify-center rounded-tile px-4 py-2"
      style={({ pressed }) => ({
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? t.ink : t.inkLine,
        backgroundColor: pressed ? t.paperPressed : "transparent",
      })}
    >
      <Text className={`text-body text-ink ${selected ? "font-semibold" : ""}`}>{label}</Text>
      {detail ? <Text className="mt-0.5 text-label text-inkMuted">{detail}</Text> : null}
    </Pressable>
  );
}

/** Parchment over the rail: grabber, the step in an eyebrow, the moment as a title, the engine's numbers in a muted line. */
function Paper({ step, title, note, children, onCollapse }: { step: string; title: string; note: string | null; children: ReactNode; onCollapse: () => void }) {
  return (
    <Animated.View entering={rise} testID="sheet" className="rounded-t-sheet bg-paper px-6 pb-safe pt-3" style={{ maxHeight: "72%" }}>
      <View className="mb-2 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Text testID="sheet-step" className="font-display text-eyebrow uppercase text-inkLabel">
          {step}
        </Text>
        <Text testID="sheet-title" accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
          {title}
        </Text>
        {note ? (
          <Text testID="sheet-note" className="mt-1 text-center text-body text-inkMuted">
            {note}
          </Text>
        ) : null}
      </View>
      <ScrollView className="mt-4" contentContainerClassName="pb-2" style={{ flexGrow: 0 }}>
        {children}
      </ScrollView>
      <View className="items-center">
        <ChromeButton label="Look at the table" testID="sheet-collapse" tone="ink" onPress={onCollapse} />
      </View>
    </Animated.View>
  );
}

type SheetProps = {
  game: ScenarioState;
  names: SheetNames;
  onIntent: (intent: PlayerIntent) => void;
  onNext: (sheet: Sheet) => void;
  onOutcome: () => void;
  onInspect: (cardId: string) => void;
  onCollapse: () => void;
};

function PickView({ sheet, onIntent, onNext, onCollapse }: SheetProps & { sheet: PickSheet }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const picked = sheet.options.find((item) => item.id === chosen) ?? null;
  const confirm = () => {
    if (!picked) return;
    if ("intent" in picked) onIntent(picked.intent);
    else onNext(picked.next);
  };
  const alternative = sheet.alternative;
  return (
    <Paper step={sheet.step} title={sheet.title} note={sheet.note} onCollapse={onCollapse}>
      {sheet.options.map((item) => (
        <Tile key={item.id} label={item.label} selected={item.id === chosen} testID={`sheet-option-${item.id}`} onPress={() => setChosen(item.id)} />
      ))}
      <View className="mt-2 gap-1">
        {sheet.primary ? (
          <ChromePrimary label={sheet.primary.label} testID="sheet-primary" surface="paper" onPress={() => sheet.primary && onIntent(sheet.primary.intent)} />
        ) : sheet.options.length > 0 ? (
          <ChromePrimary label={picked ? `${sheet.verb} ${picked.label.split(" · ")[0]}` : sheet.verb} testID="sheet-primary" surface="paper" disabled={!picked} onPress={confirm} />
        ) : null}
        {alternative ? (
          <ChromeButton
            label={alternative.label}
            testID="sheet-alternative"
            tone="ink"
            onPress={() => ("intent" in alternative ? onIntent(alternative.intent) : onNext(alternative.next))}
          />
        ) : null}
      </View>
    </Paper>
  );
}

function MultiView({ sheet, onIntent, onCollapse }: SheetProps & { sheet: MultiSheet }) {
  const [chosen, setChosen] = useState<readonly string[]>(sheet.preselected.filter((id) => sheet.options.some((item) => item.id === id)));
  const toggle = (id: string) => setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const alternative = sheet.alternative;
  const ready = sheet.allowEmpty || chosen.length > 0;
  return (
    <Paper step={sheet.step} title={sheet.title} note={sheet.note} onCollapse={onCollapse}>
      {sheet.options.length === 0 ? <Text className="mb-2 text-center text-body text-inkMuted">No character can be chosen.</Text> : null}
      {sheet.options.map((item) => (
        <Tile key={item.id} label={item.label} selected={chosen.includes(item.id)} testID={`sheet-option-${item.id}`} onPress={() => toggle(item.id)} />
      ))}
      <View className="mt-2 gap-1">
        <ChromePrimary
          label={chosen.length === 0 && sheet.allowEmpty ? `${sheet.verb} no one` : `${sheet.verb} ${chosen.length}`}
          testID="sheet-primary"
          surface="paper"
          disabled={!ready}
          onPress={() => onIntent(multiIntent(sheet, chosen))}
        />
        {alternative && "intent" in alternative ? <ChromeButton label={alternative.label} testID="sheet-alternative" tone="ink" onPress={() => onIntent(alternative.intent)} /> : null}
      </View>
    </Paper>
  );
}

function DistributeView({ sheet, onIntent, onCollapse }: SheetProps & { sheet: DistributeSheet }) {
  const [shares, setShares] = useState<readonly Share[]>(() =>
    sheet.purpose.kind === "archery" ? [] : firstShares({ seat: 0, cardId: "", total: sheet.total, exact: sheet.exact, pools: sheet.options.map((item) => ({ heroId: item.id, max: item.max })) }),
  );
  const given = shares.reduce((sum, share) => sum + share.amount, 0);
  const ready = sharesReady(shares, sheet.total, sheet.exact);
  return (
    <Paper step={sheet.step} title={sheet.title} note={sheet.exact ? `${sheet.note} ${given} of ${sheet.total}.` : `${sheet.note} ${given} paid.`} onCollapse={onCollapse}>
      {sheet.options.length === 0 ? <Text className="mb-2 text-center text-body text-inkMuted">Nothing can pay this.</Text> : null}
      {sheet.options.map((item) => (
        <Tile
          key={item.id}
          label={`${item.label} · ${shareOf(shares, item.id)}`}
          selected={shareOf(shares, item.id) > 0}
          testID={`sheet-option-${item.id}`}
          onPress={() => setShares((current) => tapShare(current, item.id, item.max, sheet.exact ? sheet.total : null))}
        />
      ))}
      <View className="mt-2 gap-1">
        <ChromePrimary label="Confirm" testID="sheet-primary" surface="paper" disabled={!ready} onPress={() => onIntent(distributeIntent(sheet, shares))} />
        <ChromeButton label="Clear" testID="sheet-alternative" tone="ink" onPress={() => setShares([])} />
      </View>
    </Paper>
  );
}

function TriggerView({ sheet, game, names, onIntent, onNext, onInspect, onCollapse }: SheetProps & { sheet: TriggerSheet }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const picked: TriggerOption | null = sheet.options.find((item) => item.id === chosen) ?? null;
  const use = () => {
    if (!picked) return;
    if (picked.pay) onNext(paySheet(game, names, picked.pay, { kind: "trigger", cardId: picked.cardId, effectId: picked.effectId }));
    else onIntent({ type: "Trigger", cardId: picked.cardId, effectId: picked.effectId });
  };
  return (
    <Paper step={sheet.step} title={sheet.title} note={sheet.note} onCollapse={onCollapse}>
      {sheet.hide ? (
        <View testID="hide-numbers" className="mb-3 flex-row justify-around">
          <Text className="font-display text-title text-ink">{`Hide ${sheet.hide.x}`}</Text>
          <Text className="font-display text-title text-ink">{`Willpower ${sheet.hide.willpower}`}</Text>
          <Text className="font-display text-title text-ink">{`Threat ${sheet.hide.threat}`}</Text>
        </View>
      ) : null}
      {sheet.sourceId ? (
        <View className="mb-2 items-center">
          <ChromeButton label="Inspect the card" testID="sheet-inspect" tone="ink" onPress={() => sheet.sourceId && onInspect(sheet.sourceId)} />
        </View>
      ) : null}
      {sheet.options.length === 0 && sheet.pass ? <Text className="mb-2 text-center text-body text-inkMuted">Nothing can be used now.</Text> : null}
      {sheet.options.map((item) => (
        <Tile
          key={item.id}
          label={`${item.label} · ${item.timing}`}
          detail={item.text}
          selected={item.id === chosen}
          testID={`sheet-trigger-${item.cardId}`}
          onPress={() => setChosen(item.id)}
        />
      ))}
      <View className="mt-2 gap-1">
        {sheet.options.length > 0 ? (
          <ChromePrimary label={picked ? `Use ${picked.label}` : "Use"} testID="sheet-primary" surface="paper" disabled={!picked} onPress={use} />
        ) : null}
        {sheet.pass ? <ChromeButton label={sheet.pass} testID="sheet-pass" tone="ink" onPress={() => onIntent({ type: "Pass" })} /> : null}
      </View>
    </Paper>
  );
}

/** The sheet for the open moment. `key` resets its local choice when the engine moves on. */
export function SheetView(props: SheetProps & { sheet: Sheet }) {
  const { sheet } = props;
  switch (sheet.kind) {
    case "pick":
      return <PickView key={sheet.key} {...props} sheet={sheet} />;
    case "multi":
      return <MultiView key={sheet.key} {...props} sheet={sheet} />;
    case "distribute":
      return <DistributeView key={sheet.key} {...props} sheet={sheet} />;
    case "trigger":
      return <TriggerView key={sheet.key} {...props} sheet={sheet} />;
    case "outcome":
      return (
        <Paper step={sheet.result === "won" ? "Resolution" : "Scenario"} title={sheet.title} note={sheet.note} onCollapse={props.onCollapse}>
          <ChromePrimary label={sheet.result === "won" ? "Choose rewards" : "Continue"} testID="sheet-outcome" surface="paper" onPress={props.onOutcome} />
        </Paper>
      );
  }
}

/** The collapsed sheet: one bar that brings the choice back. */
export function SheetTab({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <View className="rounded-t-sheet bg-paper px-6 pb-safe pt-2">
      <ChromeButton label={`Choose: ${title}`} testID="sheet-expand" tone="ink" onPress={onOpen} />
    </View>
  );
}

/** This round's engine steps and their causes, on paper. Text only: it is how a player checks a number against its source. */
export function LogPanel({ round, lines, onClose }: { round: number; lines: readonly LogLine[]; onClose: () => void }) {
  return (
    <Animated.View entering={rise} testID="log-sheet" className="rounded-t-sheet bg-paper px-6 pb-safe pt-3" style={{ maxHeight: "80%" }}>
      <View className="mb-2 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Text className="font-display text-eyebrow uppercase text-inkLabel">Log</Text>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-ink">{`Round ${round}`}</Text>
      </View>
      <ScrollView className="mt-3" style={{ flexGrow: 0 }}>
        {lines.length === 0 ? <Text className="text-center text-body text-inkMuted">Nothing has happened this round yet.</Text> : null}
        {lines.map((line) => (
          <View key={line.key} testID={`log-line-${line.key}`} className="border-b py-2" style={{ borderColor: t.inkLine }}>
            <Text className="text-body text-ink">{line.text}</Text>
            {line.cause ? <Text className="mt-0.5 text-label text-inkMuted">{line.cause}</Text> : null}
          </View>
        ))}
      </ScrollView>
      <View className="items-center pt-2">
        <ChromeButton label="Close" testID="log-close" tone="ink" onPress={onClose} />
      </View>
    </Animated.View>
  );
}
