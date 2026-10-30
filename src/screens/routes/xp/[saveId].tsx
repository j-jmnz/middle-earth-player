// Spend XP (docs/design-system.md, Spend XP): the Dream-chaser Campaign Log's scalable and upgradable cards, between scenarios. One XP marks one
// box beside a card (dcce.scalable-upgradable); the players pick the cards, nothing is spent for them, and Mark writes the boxes to the log.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { spendOnSave, pick, unpick, type Picks } from "../../../campaign/xp";
import { pickSentence, xpView, type XpRowView } from "../../../campaign/xp-view";
import { rowSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { ActionBar, BodyText, Label, NavBar, PrimaryButton, Screen, ScreenScroll, Section, StatTile, TextButton } from "../../chrome";
import { campaignOf } from "../../campaign-data";
import { goBack } from "../../go-back";
import { usePalette } from "../../palette-hook";
import { routeCode } from "../../route-code";
import { useSave } from "../../use-save";
import { useUiScale } from "../../../play/ui-scale";
import { Text } from "../../../play/text";

// The boxes beside a card: marked ones lit, picked ones ringed, the rest faint. Drawn for the eye; the row's label says the counts.
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
            style={{
              width: 14 * s,
              height: 14 * s,
              borderRadius: 3 * s,
              borderWidth: 1.5,
              borderColor: lit || ringed ? palette.accent : palette.faint,
              backgroundColor: lit ? palette.accent : "transparent",
            }}
          />
        );
      })}
    </View>
  );
}

function CardRow({ row, enabled, onPick, onUnpick }: { row: XpRowView; enabled: boolean; onPick: () => void; onUnpick: () => void }) {
  const t = useTableTokens();
  const live = enabled && row.canPick;
  return (
    <View className="mb-1.5 flex-row items-center">
      <Pressable
        testID={`xp-row-${row.code}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={live ? `Mark a box beside ${row.label}` : row.label}
        accessibilityHint={live ? undefined : (row.reason ?? undefined)}
        accessibilityState={{ disabled: !live }}
        onPress={live ? onPick : undefined}
        className="flex-1"
      >
        {({ pressed }) => (
          <View className="min-h-14 justify-center overflow-hidden rounded-item px-3.5 py-2" style={{ ...rowSurface(pressed && live, t), opacity: live || row.picked > 0 || row.full ? 1 : 0.55 }}>
            <View className="flex-row items-baseline justify-between gap-2">
              <Text className="shrink font-display text-heading text-bone">{row.name}</Text>
              <Text testID={`xp-words-${row.code}`} className="text-label text-muted">
                {row.words}
              </Text>
            </View>
            <Boxes marked={row.marked} picked={row.picked} boxes={row.boxes} />
          </View>
        )}
      </Pressable>
      {row.picked > 0 ? <TextButton label="Undo" testID={`xp-unpick-${row.code}`} tone="accent" accessibilityLabel={`Take back the box picked beside ${row.name}`} onPress={onUnpick} /> : null}
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

  const view = xpView(save.log, picks);
  // XP is spent only before or after a scenario: never with one open.
  const open = save.active != null;
  const total = view.scalable.length + view.upgradable.length;

  function mark(): void {
    if (!save) return;
    const spent = spendOnSave(save, picks);
    if (!spent.ok) {
      setRefused(spent.reason);
      return;
    }
    update(spent.save);
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
          setPicks((current) => pick(save.log, current, row.code));
          setRefused(null);
        }}
        onUnpick={() => setPicks((current) => unpick(current, row.code))}
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
        <Label tone="faint" className="mt-2">{`${total} cards`}</Label>
      </ScreenScroll>
      <ActionBar>
        <View className="gap-2">
          <Label tone="muted" className="text-center" testID="xp-sentence">
            {refused ?? pickSentence(view)}
          </Label>
          {view.picked > 0 ? (
            <View className="items-center">
              <TextButton label="Clear picks" testID="xp-clear" tone="muted" onPress={() => setPicks({})} />
            </View>
          ) : null}
          <PrimaryButton label={view.picked === 0 ? "Mark boxes" : `Mark ${view.picked} ${view.picked === 1 ? "box" : "boxes"}`} testID="xp-commit" disabled={view.picked === 0 || open} onPress={mark} />
        </View>
      </ActionBar>
    </Screen>
  );
}
