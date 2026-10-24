// The table's chrome: the phase rail, the threat rings and the bar, and the paper choice sheets. These are React Native text
// and buttons with testIDs, so Maestro can read them; card pictures stay on the canvas (docs/design-system.md, Table).
// Every press shows its pressed fill in the same frame. Phase changes and sheets animate with Reanimated, never gate a rule,
// and snap under reduced motion. Nothing here holds a number the engine did not compute.
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion, SlideInDown } from "react-native-reanimated";

import { GameIcon, IconValue } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import type { LogLine } from "./log.ts";
import { firstShares, shareOf, shareSum, sharesReady, tapShare, type Share } from "./pay.ts";
import type { Rail } from "./rail.ts";
import type { SeatThreat } from "./selectors.ts";
import { distributeIntent, multiIntent, paySheet } from "./bar-sheets.ts";
import type { DistributeSheet, MultiSheet, PickSheet, Sheet, SheetNames, SheetStat, TriggerOption, TriggerSheet } from "./sheet-types.ts";
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

/** The seats' threat in one line, for a sheet's header: "Threat 28", or "Player 1 28 · Player 2 31". */
export function threatLine(threats: readonly SeatThreat[], life: number | null): string {
  const seats = threats.length > 1 ? threats.map((row) => `Player ${row.seat + 1} ${row.threat}`).join(" · ") : `Threat ${threats[0]?.threat ?? 0}`;
  return life != null ? `${seats} · Life ${life}` : seats;
}

/** A threat number in a ring, Marcellus, with its label. The reducer is the only writer of the number. */
export function ThreatRing({ threat, label, testID, icon = "threat" }: { threat: SeatThreat; label: string; testID?: string; icon?: IconName | null }) {
  const id = testID ?? `threat-${threat.seat}`;
  return (
    <View testID={id} accessible accessibilityLabel={`${label} ${threat.threat}`} className="items-center">
      <View className="h-12 w-12 items-center justify-center rounded-pill" style={{ borderWidth: 2, borderColor: threat.eliminated ? t.hairline : t.gold }}>
        <Text testID={`${id}-value`} className="font-display text-title text-bone">
          {String(threat.threat)}
        </Text>
      </View>
      <View className="mt-0.5 flex-row items-center gap-1">
        {icon ? <GameIcon name={icon} size={12} tint="muted" /> : null}
        <Text className="text-label text-muted">{label}</Text>
      </View>
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

/**
 * The one filled action: a gold pill on night, an ink pill on paper. Disabled on night is a raised pill with faint text;
 * disabled on paper is an inkLine outline with inkMuted text (docs/design-system.md). A disabled action has a sentence
 * near it saying why.
 */
export function ChromePrimary({ label, onPress, testID, disabled = false, surface = "night" }: { label: string; onPress: () => void; testID: string; disabled?: boolean; surface?: "night" | "paper" }) {
  const paper = surface === "paper";
  const fill = paper ? t.ink : t.gold;
  const pressedFill = paper ? t.ink : t.goldDeep;
  const text = disabled ? (paper ? "text-inkMuted" : "text-faint") : paper ? "text-paper" : "text-onGold";
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
      style={({ pressed }) =>
        disabled
          ? paper
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: t.inkLine }
            : { backgroundColor: t.raised }
          : { backgroundColor: pressed ? pressedFill : fill, opacity: pressed && paper ? 0.85 : 1 }
      }
    >
      <Text className={`font-display text-body uppercase tracking-widest ${text}`}>{label}</Text>
    </Pressable>
  );
}

/** The engine's numbers with the game's icons beside them, ink on paper. Each reads as "Willpower 2" to a screen reader. */
function Stats({ stats, testID }: { stats: readonly SheetStat[]; testID?: string }) {
  if (stats.length === 0) return null;
  return (
    <View testID={testID} className="flex-row flex-wrap items-center gap-3">
      {stats.map((stat) => (
        <IconValue key={stat.word} name={stat.icon} value={String(stat.value)} word={stat.word} tint="ink" textClass="font-display text-body text-ink" />
      ))}
    </View>
  );
}

function Tile({
  label,
  selected,
  onPress,
  testID,
  detail,
  stats = [],
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  detail?: string | null;
  stats?: readonly SheetStat[];
}) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[label, ...stats.map((stat) => `${stat.word} ${stat.value}`), detail ?? ""].filter((part) => part.length > 0).join(". ")}
      onPress={onPress}
      className="mb-2 min-h-14 justify-center rounded-tile px-4 py-2"
      style={({ pressed }) => ({
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? t.ink : t.inkLine,
        backgroundColor: pressed ? t.paperPressed : "transparent",
      })}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className={`shrink text-body text-ink ${selected ? "font-semibold" : ""}`}>{label}</Text>
        <Stats stats={stats} />
      </View>
      {detail ? <Text className="mt-0.5 text-label text-inkMuted">{detail}</Text> : null}
    </Pressable>
  );
}

/** One sentence under a disabled action saying what it waits for. */
function Why({ children }: { children: string }) {
  return (
    <Text testID="sheet-why" className="mt-1 text-center text-label text-inkMuted">
      {children}
    </Text>
  );
}

/**
 * Parchment over the rail: grabber, the step in an eyebrow, the moment as a title, the engine's numbers in a muted line,
 * and the seats' threat, which stays in sight while a sheet is up. Only the tiles scroll; the reducer's refusal, the primary
 * and the alternative stay pinned at the bottom, in thumb reach.
 */
function Paper({
  step,
  title,
  note,
  threat,
  refusal,
  children,
  actions,
  onCollapse,
  stats = [],
}: {
  step: string;
  title: string;
  note: string | null;
  stats?: readonly SheetStat[];
  threat: string;
  refusal: string | null;
  children?: ReactNode;
  actions: ReactNode;
  onCollapse: () => void;
}) {
  return (
    <Animated.View entering={rise} testID="sheet" className="rounded-t-sheet bg-paper px-6 pb-safe pt-3" style={{ maxHeight: "78%" }}>
      <View className="mb-2 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Text testID="sheet-step" className="font-display text-eyebrow uppercase text-inkLabel">
          {step}
        </Text>
        <Text testID="sheet-title" accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
          {title}
        </Text>
        {stats.length > 0 ? (
          <View className="mt-1">
            <Stats stats={stats} testID="sheet-stats" />
          </View>
        ) : null}
        {note ? (
          <Text testID="sheet-note" className="mt-1 text-center text-body text-inkMuted">
            {note}
          </Text>
        ) : null}
        <Text testID="sheet-threat" className="mt-1 font-display text-label text-inkLabel">
          {threat}
        </Text>
      </View>
      {children ? (
        <ScrollView className="mt-3" contentContainerClassName="pb-1" style={{ flexShrink: 1 }}>
          {children}
        </ScrollView>
      ) : null}
      <View className="mt-2 gap-1">
        {refusal ? (
          <Text testID="sheet-refusal" className="text-center text-body text-danger">
            {refusal}
          </Text>
        ) : null}
        {actions}
        <View className="items-center">
          <ChromeButton label="Look at the table" testID="sheet-collapse" tone="ink" onPress={onCollapse} />
        </View>
      </View>
    </Animated.View>
  );
}

type SheetProps = {
  game: ScenarioState;
  names: SheetNames;
  // The seats' threat in words, kept in sight while the sheet is up.
  threat: string;
  // Why the reducer refused the last intent, shown above the primary so no sheet hides it.
  refusal: string | null;
  onIntent: (intent: PlayerIntent) => void;
  onNext: (sheet: Sheet) => void;
  onOutcome: () => void;
  onInspect: (cardId: string) => void;
  onCollapse: () => void;
};

function paperProps(props: SheetProps, sheet: { step: string; title: string; note: string | null; stats?: readonly SheetStat[] }) {
  return { step: sheet.step, title: sheet.title, note: sheet.note, stats: sheet.stats ?? [], threat: props.threat, refusal: props.refusal, onCollapse: props.onCollapse };
}

function PickView(props: SheetProps & { sheet: PickSheet }) {
  const { sheet, onIntent, onNext } = props;
  const [chosen, setChosen] = useState<string | null>(null);
  const picked = sheet.options.find((item) => item.id === chosen) ?? null;
  const confirm = () => {
    if (!picked) return;
    if ("intent" in picked) onIntent(picked.intent);
    else onNext(picked.next);
  };
  const alternative = sheet.alternative;
  const actions = (
    <>
      {sheet.primary ? (
        <ChromePrimary label={sheet.primary.label} testID="sheet-primary" surface="paper" onPress={() => sheet.primary && onIntent(sheet.primary.intent)} />
      ) : sheet.options.length > 0 ? (
        <>
          <ChromePrimary label={picked ? `${sheet.verb} ${picked.label.split(" · ")[0]}` : sheet.verb} testID="sheet-primary" surface="paper" disabled={!picked} onPress={confirm} />
          {!picked ? <Why>Choose one above.</Why> : null}
        </>
      ) : null}
      {alternative ? (
        <ChromeButton label={alternative.label} testID="sheet-alternative" tone="ink" onPress={() => ("intent" in alternative ? onIntent(alternative.intent) : onNext(alternative.next))} />
      ) : null}
    </>
  );
  return (
    <Paper {...paperProps(props, sheet)} actions={actions}>
      {sheet.options.length > 0
        ? sheet.options.map((item) => <Tile key={item.id} label={item.label} stats={item.stats} selected={item.id === chosen} testID={`sheet-option-${item.id}`} onPress={() => setChosen(item.id)} />)
        : null}
    </Paper>
  );
}

function MultiView(props: SheetProps & { sheet: MultiSheet }) {
  const { sheet, onIntent } = props;
  const [chosen, setChosen] = useState<readonly string[]>(sheet.preselected.filter((id) => sheet.options.some((item) => item.id === id)));
  const toggle = (id: string) => setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const alternative = sheet.alternative;
  const ready = sheet.allowEmpty || chosen.length > 0;
  const actions = (
    <>
      <ChromePrimary
        label={chosen.length === 0 && sheet.allowEmpty ? `${sheet.verb} no one` : `${sheet.verb} ${chosen.length}`}
        testID="sheet-primary"
        surface="paper"
        disabled={!ready}
        onPress={() => onIntent(multiIntent(sheet, chosen))}
      />
      {!ready ? <Why>{sheet.options.length === 0 ? "No character can be chosen." : "Choose at least one above."}</Why> : null}
      {alternative && "intent" in alternative ? <ChromeButton label={alternative.label} testID="sheet-alternative" tone="ink" onPress={() => onIntent(alternative.intent)} /> : null}
    </>
  );
  return (
    <Paper {...paperProps(props, sheet)} actions={actions}>
      {sheet.options.map((item) => (
        <Tile key={item.id} label={item.label} stats={item.stats} selected={chosen.includes(item.id)} testID={`sheet-option-${item.id}`} onPress={() => toggle(item.id)} />
      ))}
    </Paper>
  );
}

function DistributeView(props: SheetProps & { sheet: DistributeSheet }) {
  const { sheet, onIntent } = props;
  const [shares, setShares] = useState<readonly Share[]>(() =>
    sheet.purpose.kind === "archery" ? [] : firstShares({ seat: 0, cardId: "", total: sheet.total, exact: sheet.exact, pools: sheet.options.map((item) => ({ heroId: item.id, max: item.max })) }),
  );
  const given = shareSum(shares);
  const ready = sharesReady(shares, sheet.total, sheet.exact);
  const note = sheet.exact ? `${sheet.note} ${given} of ${sheet.total}.` : `${sheet.note} ${given} paid.`;
  const actions = (
    <>
      <ChromePrimary label="Confirm" testID="sheet-primary" surface="paper" disabled={!ready} onPress={() => onIntent(distributeIntent(sheet, shares))} />
      {!ready ? <Why>{sheet.options.length === 0 ? "Nothing can pay this." : `Assign all ${sheet.total} first.`}</Why> : null}
      <ChromeButton label="Clear" testID="sheet-alternative" tone="ink" onPress={() => setShares([])} />
    </>
  );
  return (
    <Paper {...paperProps(props, { ...sheet, note })} actions={actions}>
      {sheet.options.map((item) => (
        <Tile
          key={item.id}
          label={`${item.label} · ${shareOf(shares, item.id)}`}
          stats={item.stats}
          selected={shareOf(shares, item.id) > 0}
          testID={`sheet-option-${item.id}`}
          onPress={() => setShares((current) => tapShare(current, item.id, item.max, sheet.exact ? sheet.total : null))}
        />
      ))}
    </Paper>
  );
}

function TriggerView(props: SheetProps & { sheet: TriggerSheet }) {
  const { sheet, game, names, onIntent, onNext, onInspect } = props;
  const [chosen, setChosen] = useState<string | null>(null);
  const picked: TriggerOption | null = sheet.options.find((item) => item.id === chosen) ?? null;
  const use = () => {
    if (!picked) return;
    if (picked.pay) onNext(paySheet(game, names, picked.pay, { kind: "trigger", cardId: picked.cardId, effectId: picked.effectId }));
    else onIntent({ type: "Trigger", cardId: picked.cardId, effectId: picked.effectId });
  };
  const actions = (
    <>
      {sheet.options.length > 0 ? (
        <>
          <ChromePrimary label={picked ? `Use ${picked.label}` : "Use"} testID="sheet-primary" surface="paper" disabled={!picked} onPress={use} />
          {!picked ? <Why>Choose one above, or pass.</Why> : null}
        </>
      ) : null}
      {sheet.pass ? <ChromeButton label={sheet.pass} testID="sheet-pass" tone="ink" onPress={() => onIntent({ type: "Pass" })} /> : null}
    </>
  );
  return (
    <Paper {...paperProps(props, sheet)} actions={actions}>
      {/* The timing the moment answers, shown whether or not anything can be used. */}
      <Text testID="sheet-timing" className="mb-2 text-center font-display text-eyebrow uppercase text-inkLabel">
        {sheet.timing}
      </Text>
      {sheet.hide ? (
        <View testID="hide-numbers" className="mb-3 flex-row justify-around">
          <Text className="font-display text-title text-ink">{`Hide ${sheet.hide.x}`}</Text>
          <IconValue name="willpower" value={String(sheet.hide.willpower)} word="Willpower" tint="ink" size={22} textClass="font-display text-title text-ink" />
          <IconValue name="threat" value={String(sheet.hide.threat)} word="Threat" tint="ink" size={22} textClass="font-display text-title text-ink" />
        </View>
      ) : null}
      {sheet.sourceId ? (
        <View className="mb-2 items-center">
          <ChromeButton label="Inspect the card" testID="sheet-inspect" tone="ink" onPress={() => sheet.sourceId && onInspect(sheet.sourceId)} />
        </View>
      ) : null}
      {sheet.options.length === 0 ? <Text className="mb-2 text-center text-body text-inkMuted">Nothing can be used now.</Text> : null}
      {sheet.options.map((item) => (
        <Tile key={item.id} label={`${item.label} · ${item.timing}`} detail={item.text} selected={item.id === chosen} testID={`sheet-trigger-${item.cardId}`} onPress={() => setChosen(item.id)} />
      ))}
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
        <Paper
          {...paperProps(props, { step: sheet.result === "won" ? "Resolution" : "Scenario", title: sheet.title, note: sheet.note })}
          actions={<ChromePrimary label={sheet.result === "won" ? "Choose rewards" : "Continue"} testID="sheet-outcome" surface="paper" onPress={props.onOutcome} />}
        />
      );
  }
}

/** The collapsed sheet: one bar that brings the choice back, with the seats' threat still in sight. */
export function SheetTab({ title, threat, onOpen }: { title: string; threat: string; onOpen: () => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-t-sheet bg-paper px-6 pb-safe pt-2">
      <Text testID="sheet-tab-threat" className="font-display text-label text-inkLabel">
        {threat}
      </Text>
      <ChromeButton label={`Choose: ${title}`} testID="sheet-expand" tone="ink" onPress={onOpen} />
    </View>
  );
}

// A log line's mark: the game icon for threat and willpower, a token coin for damage, progress and resources.
function LogMarkView({ mark }: { mark: LogLine["mark"] }) {
  if (mark === "threat" || mark === "willpower") return <GameIcon name={mark} size={16} tint="ink" />;
  if (!mark) return <View style={{ width: 16 }} />;
  const color = mark === "damage" ? t.threat : mark === "resource" ? t.gold : t.paperPressed;
  return <View accessible={false} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 1, borderColor: t.inkLine }} />;
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
            <View className="flex-row items-center gap-2">
              <LogMarkView mark={line.mark} />
              <Text className="shrink text-body text-ink">{line.text}</Text>
            </View>
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

/** A card and what is attached to it, each a full-size target that opens the card screen. */
export function CardListPanel({ cards, onOpen, onClose }: { cards: readonly { id: string; label: string }[]; onOpen: (cardId: string) => void; onClose: () => void }) {
  return (
    <Animated.View entering={rise} testID="card-list" className="rounded-t-sheet bg-paper px-6 pb-safe pt-3" style={{ maxHeight: "70%" }}>
      <View className="mb-2 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <Text accessibilityRole="header" className="text-center font-display text-title text-ink">
        Inspect
      </Text>
      <ScrollView className="mt-3" style={{ flexShrink: 1 }}>
        {cards.map((card) => (
          <Tile key={card.id} label={card.label} selected={false} testID={`card-list-${card.id}`} onPress={() => onOpen(card.id)} />
        ))}
      </ScrollView>
      <View className="items-center pt-1">
        <ChromeButton label="Close" testID="card-list-close" tone="ink" onPress={onClose} />
      </View>
    </Animated.View>
  );
}
