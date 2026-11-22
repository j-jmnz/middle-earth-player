// Spend XP (docs/design-system.md, Spend XP): the Dream-chaser Campaign Log's scalable and upgradable cards, between scenarios. One XP marks one
// box beside a card (dcce.scalable-upgradable); the players pick the cards, nothing is spent for them, and Mark writes the boxes to the log.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { spendOnSave, pick, unpick, type Picks } from "../../../campaign/xp";
import { pickSentence, xpView, type XpRowView } from "../../../campaign/xp-view";
import { rowSurface } from "../../../ui/surfaces";
import { useTableTokens } from "../../../ui/use-table-tokens";
import { ActionBar, BodyText, IconButton, Label, NavBar, PrimaryButton, Screen, ScreenScroll, Section, StatTile, TextButton } from "../../kit/chrome";
import { campaignOf, scenarioNames } from "../../data/campaign-data";
import { goBack } from "../../nav/go-back";
import { usePalette } from "../../kit/palette-hook";
import { routeCode } from "../../nav/route-code";
import { useSave } from "../../data/use-save";
import { useUiScale } from "../../../ui/ui-scale";
import { Text } from "../../../ui/text";

// The boxes beside a card: marked ones filled in the accent, picked ones a thick ring with a dot inside, the rest a thin faint ring. The shapes differ,
// not only the colours. Drawn for the eye; the row's label says the counts.
function Boxes({ marked, picked, boxes }: { marked: number; picked: number; boxes: number }) {
  const palette = usePalette();
  const s = useUiScale();
  return (
    <View className="mt-1 flex-row flex-wrap" style={{ gap: 4 * s }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: boxes }, (_, index) => {
        const lit = index < marked;
        const ringed = !lit && index < marked + picked;
        return (
          <View
            key={index}
            className="items-center justify-center"
            style={{
              width: 14 * s,
              height: 14 * s,
              borderRadius: 3 * s,
              borderWidth: ringed ? 3 : 1.5,
              borderColor: lit || ringed ? palette.accent : palette.faint,
              backgroundColor: lit ? palette.accent : "transparent",
            }}
          >
            {ringed ? <View style={{ width: 4 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: palette.accent }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

// A row that cannot take another box is dimmed to 70%: its words stay above 4.5 to 1 against the ground in both themes (about 5 to 1 on Light), and
// why it is dimmed is in its words and, when it is tapped, in the sentence.
const DIMMED = 0.7;
const OPEN_REASON = "XP is spent only before or after a scenario";

// The room Undo keeps beside a row whether or not it shows, so a pick never moves the row's words.
const UNDO_SLOT = 64;

// A dimmed row (no XP left, or a scenario still to win) is still pressed: the sentence says why. A row with every box marked is full opacity and
// does nothing. The info button beside a row opens the card; the row stays the pick control.
function CardRow({
  row,
  enabled,
  onPick,
  onUnpick,
  onRefuse,
  onInspect,
}: {
  row: XpRowView;
  enabled: boolean;
  onPick: () => void;
  onUnpick: () => void;
  onRefuse: (reason: string) => void;
  onInspect: () => void;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const live = enabled && row.canPick;
  const dimmed = !live && row.picked === 0 && !row.full;
  const reason = enabled ? row.reason : OPEN_REASON;
  const face = (pressed: boolean) => (
    <View className="min-h-14 justify-center overflow-hidden rounded-item px-3.5 py-2" style={{ ...rowSurface(pressed && live, t), opacity: dimmed ? DIMMED : 1 }}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="shrink font-display text-heading text-bone">{row.name}</Text>
        <Text testID={`xp-words-${row.code}`} className="text-label text-muted">
          {row.note ?? row.words}
        </Text>
      </View>
      <Boxes marked={row.marked} picked={row.picked} boxes={row.boxes} />
    </View>
  );
  return (
    <View className="mb-1.5 flex-row items-center">
      {row.full && row.picked === 0 ? (
        <View testID={`xp-row-${row.code}`} accessible accessibilityLabel={`${row.label}, every box marked`} className="flex-1">
          {face(false)}
        </View>
      ) : (
        <Pressable
          testID={`xp-row-${row.code}`}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={live ? `Mark a box beside ${row.label}` : row.label}
          accessibilityHint={live ? undefined : (reason ?? undefined)}
          accessibilityState={{ disabled: !live }}
          onPress={live ? onPick : () => onRefuse(reason ?? "That card cannot take another box")}
          className="flex-1"
        >
          {({ pressed }) => face(pressed)}
        </Pressable>
      )}
      <View style={{ width: UNDO_SLOT * s }} className="items-center">
        {row.picked > 0 ? <TextButton label="Undo" testID={`xp-unpick-${row.code}`} tone="accent" accessibilityLabel={`Take back the box picked beside ${row.name}`} onPress={onUnpick} /> : null}
      </View>
      <IconButton glyph="i" label={`Inspect ${row.name}`} testID={`xp-info-${row.code}`} tone="bone" onPress={onInspect} />
    </View>
  );
}

export default function SpendXp() {
  const router = useRouter();
  const saveId = routeCode(useLocalSearchParams<{ saveId: string }>().saveId);
  const { save, loaded, update } = useSave(saveId ?? undefined);
  const [picks, setPicks] = useState<Picks>({});
  const [refused, setRefused] = useState<string | null>(null);
  const s = useUiScale();

  const campaign = save ? campaignOf(save.campaignId) : null;
  const back = () => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/");
  const bar = <NavBar onBack={back} backTestID="xp-back" backLabel="Path" title="Spend XP" {...(campaign ? { subtitle: campaign.name } : {})} />;
  if (!loaded) {
    return (
      <Screen testID="xp" scene="path">
        {bar}
        <BodyText tone="muted">Loading</BodyText>
      </Screen>
    );
  }
  if (!save || !campaign?.xp) {
    return (
      <Screen testID="xp" scene="path">
        {bar}
        <BodyText tone="danger">This playthrough has no XP to spend.</BodyText>
      </Screen>
    );
  }

  const names = scenarioNames(campaign);
  const view = xpView(save.log, picks, names);
  // XP is spent only before or after a scenario: never with one open.
  const open = save.active != null;

  function mark(): void {
    if (!save) return;
    const spent = spendOnSave(save, picks, names);
    if (!spent.ok) {
      setRefused(spent.reason);
      return;
    }
    update(spent.save);
    setPicks({});
    setRefused(null);
  }

  function clear(): void {
    setPicks({});
    setRefused(null);
  }

  const rows = (list: readonly XpRowView[]) =>
    list.map((row) => (
      <CardRow
        key={row.code}
        row={row}
        enabled={!open}
        onPick={() => {
          setPicks((current) => pick(save.log, current, row.code, names));
          setRefused(null);
        }}
        onUnpick={() => {
          setPicks((current) => unpick(current, row.code));
          setRefused(null);
        }}
        onRefuse={setRefused}
        onInspect={() => router.push({ pathname: "/card/[code]", params: row.kind === "upgradable" ? { code: row.code, side: "B" } : { code: row.code } })}
      />
    ));

  return (
    <Screen testID="xp" scene="path">
      {bar}
      <ScreenScroll top={8} bottom={24} max="readable">
        <View className="flex-row" style={{ gap: 8 * s }}>
          <StatTile label="Gained" value={String(view.gained)} testID="xp-gained" />
          <StatTile label="Spent" value={String(view.spent)} testID="xp-spent" />
          <StatTile label="Unspent" value={String(view.unspent)} testID="xp-unspent" />
        </View>
        <Label tone="muted" className="mt-3">
          One XP marks one box beside a card. A scalable card is as strong as its marked boxes; an upgradable card upgrades when every box is marked. XP is spent only before or after a scenario.
        </Label>
        {open ? (
          <BodyText tone="danger" className="mt-3" testID="xp-open-scenario">
            A scenario is open. Finish it, or leave it, before spending XP.
          </BodyText>
        ) : null}
        <Section title="Scalable cards" className="mt-5" />
        {rows(view.scalable)}
        <Section title="Upgradable cards" className="mt-5" />
        {rows(view.upgradable)}
      </ScreenScroll>
      <ActionBar>
        <View className="gap-2">
          <Label tone={refused != null ? "danger" : "muted"} className="text-center" testID="xp-sentence">
            {refused ?? pickSentence(view)}
          </Label>
          <View className="flex-row items-center gap-2">
            {view.picked > 0 ? <TextButton label="Clear picks" testID="xp-clear" tone="muted" onPress={clear} /> : null}
            <View className="min-w-0 flex-1">
              <PrimaryButton compact label={view.picked === 0 ? "Mark boxes" : `Mark ${view.picked} ${view.picked === 1 ? "box" : "boxes"}`} testID="xp-commit" disabled={view.picked === 0 || open} onPress={mark} />
            </View>
          </View>
        </View>
      </ActionBar>
    </Screen>
  );
}
