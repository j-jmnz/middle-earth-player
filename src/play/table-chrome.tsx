// The table's chrome: the phase rail, the threat rings and the bar, and the paper choice sheets (their shared pieces are in
// sheet-paper.tsx, the pick sheet in pick-sheet-view.tsx). These are React Native text
// and buttons with testIDs, so Maestro can read them; card pictures stay on the canvas (docs/design-system.md, Table).
// Every press shows its pressed fill in the same frame. Phase changes and sheets animate with Reanimated, never gate a rule,
// and snap under reduced motion. Nothing here holds a number the engine did not compute.
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";

import { GameIcon, IconValue } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import type { LogLine } from "./log.ts";
import { firstShares, shareOf, shareSum, sharesReady, tapShare, type Share } from "./pay.ts";
import type { Rail } from "./rail.ts";
import type { SeatThreat } from "./selectors.ts";
import { distributeIntent, multiIntent, paySheet } from "./bar-sheets.ts";
import type { DistributeSheet, MultiSheet, Sheet, TriggerOption, TriggerSheet } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";
import { PickView } from "./pick-sheet-view.tsx";
import { ChromeButton, ChromePrimary, Paper, paperProps, SheetFrame, Tile, useTableTaps, Why, type SheetProps } from "./sheet-paper.tsx";

export { ChromeButton, ChromePrimary };

const fade = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

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
          className="font-display text-body uppercase text-gold"
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

function MultiView(props: SheetProps & { sheet: MultiSheet }) {
  const { sheet, onIntent } = props;
  const [chosen, setChosen] = useState<readonly string[]>(sheet.preselected.filter((id) => sheet.options.some((item) => item.id === id)));
  const toggle = (id: string) => setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  // A tap on one of the characters on the table chooses it, as its tile does.
  useTableTaps(props.claimTaps, (cardId) => {
    if (!sheet.options.some((item) => item.id === cardId)) return false;
    toggle(cardId);
    return true;
  });
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
  const take = (id: string, max: number) => setShares((current) => tapShare(current, id, max, sheet.exact ? sheet.total : null));
  // "Tap a hero to take one resource from its pool": a tap on the hero on the table counts as a tap on its tile.
  useTableTaps(props.claimTaps, (cardId) => {
    const item = sheet.options.find((option) => option.id === cardId);
    if (!item) return false;
    take(item.id, item.max);
    return true;
  });
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
          onPress={() => take(item.id, item.max)}
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
          {...paperProps(props, { step: sheet.step, title: sheet.title, note: sheet.note })}
          actions={<ChromePrimary label={sheet.action} testID="sheet-outcome" surface="paper" onPress={props.onOutcome} />}
        />
      );
  }
}

/** The collapsed sheet: one bar that brings the choice back, with the seats' threat still in sight, and Pass when allowed. */
export function SheetTab({ title, threat, onOpen, onPass = null }: { title: string; threat: string; onOpen: () => void; onPass?: (() => void) | null }) {
  return (
    <SheetFrame animated={false} paddingTop={8}>
      <View className="flex-row items-center justify-between gap-2">
        <Text testID="sheet-tab-threat" className="font-display text-label text-inkLabel">
          {threat}
        </Text>
        <View className="shrink flex-row items-center">
          {onPass ? <ChromeButton label="Pass" testID="sheet-tab-pass" tone="ink" onPress={onPass} /> : null}
          <ChromeButton label={`Choose: ${title}`} testID="sheet-expand" tone="ink" onPress={onOpen} />
        </View>
      </View>
    </SheetFrame>
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
    <SheetFrame testID="log-sheet" maxHeight="80%">
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
    </SheetFrame>
  );
}

/** A card and what is attached to it, each a full-size target that opens the card screen. */
export function CardListPanel({ cards, onOpen, onClose }: { cards: readonly { id: string; label: string }[]; onOpen: (cardId: string) => void; onClose: () => void }) {
  return (
    <SheetFrame testID="card-list" maxHeight="70%">
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
    </SheetFrame>
  );
}
