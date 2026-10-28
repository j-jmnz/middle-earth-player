import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { campaignPath, openNode, type PathNode } from "../../../campaign/path";
import { tileSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { withAlphaHex } from "../../../play/tokens";
import { SceneCard } from "../../art";
import { ActionBar, BodyText, Chip, Eyebrow, IconButton, JourneyBar, Label, NavBar, PrimaryButton, Screen, ScreenScroll, SecondaryButton, TextButton } from "../../chrome";
import { poolCardWords } from "../../log-facts";
import { carryVerb, carryWords } from "../../../campaign/carry-words";
import { bookletParams, campaignOf, scenarioNames, scenarioOf } from "../../campaign-data";
import { cardNames } from "../../card-names";
import { useDatabases } from "../../databases";
import { usePalette } from "../../palette-hook";
import { routeCode } from "../../route-code";
import { briefingHref, tableHref } from "../../scenario-links";
import { seatWord } from "../../seats";
import { goBack } from "../../go-back";
import { droppedSentence, useSave } from "../../use-save";
import { useUiScale } from "../../../play/ui-scale";

const STATUS_WORD = { completed: "Completed", current: "Current", locked: "Locked" } as const;
const RAIL = 44;

// The path's one next move, pinned in the ActionBar: Resume the open scenario, else Begin the current one. `testID` keeps the ids the
// flows know: `begin` for the current scenario, `resume-<id>` for an open replay of a won one.
type Next = { label: string; testID: string; words: string; onPress: () => void };

// The medallion on the trail: a gold disc with a check for a won scenario, a lit gold ring for the one to play, a night disc
// with its number for one still locked.
function Medallion({ node }: { node: PathNode }) {
  const palette = usePalette();
  const s = useUiScale();
  if (node.status === "completed") {
    return (
      <View className="items-center justify-center" style={{ width: 30 * s, height: 30 * s, borderRadius: 15 * s, backgroundColor: palette.gold, borderWidth: 3, borderColor: palette.night }}>
        <Text style={{ color: palette.onGold, fontSize: 13 * s, fontWeight: "800" }}>{"✓"}</Text>
      </View>
    );
  }
  if (node.status === "current") {
    return (
      <View className="items-center justify-center" style={{ width: 38 * s, height: 38 * s, borderRadius: 19 * s, backgroundColor: palette.night, borderWidth: 2, borderColor: palette.gold, boxShadow: `0 0 16px ${withAlphaHex(palette.gold, 0.6)}` }}>
        <Text className="font-display-bold text-body text-goldHigh">{String(node.number)}</Text>
      </View>
    );
  }
  return (
    <View className="items-center justify-center" style={{ width: 30 * s, height: 30 * s, borderRadius: 15 * s, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.hairline }}>
      <Text className="font-display-bold text-label text-faint">{String(node.number)}</Text>
    </View>
  );
}

function StatusChip({ node, onArt = false }: { node: PathNode; onArt?: boolean }) {
  return <Chip testID={`node-${node.id}-status`} label={STATUS_WORD[node.status]} tone={node.status === "completed" ? "ok" : node.status === "current" ? "gold" : "faint"} onArt={onArt} />;
}

/**
 * One stop on the trail. A won scenario is a panel with its score and what it earned (Replay under it); the scenario to play is
 * a framed card with its scene (its Begin is the ActionBar's primary, or a secondary plate here while another scenario is open);
 * a locked one is a dim line. The medallion column is drawn for the eye; the stop's words carry its status for a screen reader.
 */
function Node({ node, index, count, reached, rewards, rounds, begin, onOpen }: {
  node: PathNode;
  index: number;
  count: number;
  // Whether the trail is gold up to this stop.
  reached: boolean;
  rewards: readonly string[];
  rounds: number | null;
  // Begin on this card: only while another scenario is open, which Begin drops.
  begin: { hint: string; onPress: () => void } | null;
  onOpen: (() => void) | null;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const said = `${node.name}, ${STATUS_WORD[node.status]}${rewards.length > 0 ? `, ${rewards.join(", ")}` : ""}`;
  const stages = scenarioOf(node.id)?.stages.length ?? null;
  return (
    <View testID={`node-${node.id}`} className="flex-row">
      <View style={{ width: RAIL * s }} className="items-center" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {/* One segment of the trail per stop: gold up to the current stop, night past it. */}
        <View style={{ position: "absolute", top: index === 0 ? 20 * s : 0, bottom: index === count - 1 ? "50%" : 0, width: 2, backgroundColor: reached ? palette.gold : palette.hairline }} />
        <View style={{ marginTop: (node.status === "current" ? 18 : 12) * s }}>
          <Medallion node={node} />
        </View>
      </View>
      <View className="flex-1 pb-3.5">
        {node.status === "current" ? (
          <SceneCard
            scenarioId={node.id}
            sceneHeight={128}
            pullUp={30}
            over={
              <View className="absolute right-3 top-3">
                <StatusChip node={node} onArt />
              </View>
            }
          >
            <View className="px-4 pb-4" accessible accessibilityLabel={said}>
              <Eyebrow>{`Scenario ${node.number}`}</Eyebrow>
              <Text className="mt-1 font-display text-title text-bone">{node.name}</Text>
              {stages ? <Label>{`${stages} quest ${stages === 1 ? "stage" : "stages"}`}</Label> : null}
            </View>
            {begin ? (
              <View className="px-4 pb-4">
                <SecondaryButton label="Begin" testID="begin" tone="gold" onPress={begin.onPress} />
                <Text testID={`hint-${node.id}`} className="mt-1.5 text-label text-muted">
                  {begin.hint}
                </Text>
              </View>
            ) : null}
          </SceneCard>
        ) : node.status === "completed" ? (
          <View className="rounded-card px-4 py-3" style={tileSurface(false, t)}>
            <View accessible accessibilityLabel={said}>
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-display text-heading text-bone">{node.name}</Text>
                <StatusChip node={node} />
              </View>
              {node.score != null ? <Label>{`${rounds != null ? `${rounds} rounds · ` : ""}score ${node.score}`}</Label> : null}
              {rewards.length > 0 ? (
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {rewards.map((reward, at) => (
                    <Chip key={`${reward}:${at}`} label={reward} />
                  ))}
                </View>
              ) : null}
            </View>
            {onOpen ? (
              <View className="-mx-3 mt-1 flex-row">
                <TextButton label="Replay" testID={`replay-${node.id}`} tone="gold" accessibilityLabel={`Replay ${node.name}`} onPress={onOpen} />
              </View>
            ) : null}
          </View>
        ) : (
          <View className="min-h-14 flex-row items-center justify-between gap-2 py-2" accessible accessibilityLabel={said}>
            <Text className="flex-1 font-display text-heading text-faint">{node.name}</Text>
            <StatusChip node={node} />
          </View>
        )}
      </View>
    </View>
  );
}

export default function CampaignPath() {
  const t = useTableTokens();
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog } = useDatabases();
  const { save, loaded, dropped } = useSave(saveId ?? undefined);
  const notice = dropped ? droppedSentence(dropped) : null;

  const campaign = save ? campaignOf(save.campaignId) : null;
  const nodes = useMemo(() => (save && campaign ? campaignPath(campaign, scenarioNames(campaign), save.log) : []), [save, campaign]);
  const names = useMemo(() => {
    if (!save) return new Map<string, string>();
    return cardNames(catalog, [...save.log.campaignPool.map((card) => card.code), ...save.log.campaignPool.flatMap((card) => (card.attachedTo ? [card.attachedTo] : [])), ...Object.values(save.log.earned).flat(), ...save.log.carryOver.map((card) => card.code)]);
  }, [catalog, save]);

  if (!loaded) return <Screen scene="ember" testID="campaign-path"><NavBar onBack={() => goBack(router, "/")} backTestID="path-back" /><BodyText tone="muted">Loading</BodyText></Screen>;
  if (!save || !campaign) {
    return (
      <Screen scene="ember" testID="campaign-path">
        <NavBar onBack={() => goBack(router, "/")} backTestID="path-back" />
        <BodyText tone="danger">That playthrough is not on this phone.</BodyText>
      </Screen>
    );
  }

  const currentIndex = nodes.findIndex((node) => node.status === "current");
  const reachedUpTo = currentIndex < 0 ? nodes.length : currentIndex;
  const done = nodes.filter((node) => node.status === "completed").length;
  // The same open scenario the campaign list's Continue resumes (nextStep).
  const open = openNode(nodes, save.loadout?.scenarioId);
  const name = (code: string) => names.get(code) ?? code;
  const poolText =
    save.log.campaignPool.length === 0
      ? "Nothing earned yet."
      : save.log.campaignPool.map((card) => poolCardWords(card, save.log.usedOnce, name)).join(", ");

  const current = currentIndex >= 0 ? nodes[currentIndex] : null;
  const next: Next | null = open
    ? { label: "Resume", testID: open.status === "current" ? "begin" : `resume-${open.id}`, words: `On the table: ${open.name}`, onPress: () => router.push(tableHref(save.id)) }
    : current
      ? { label: "Begin", testID: "begin", words: `Next: ${current.name}`, onPress: () => router.push(briefingHref(save.id, current.id)) }
      : null;

  // Every scenario is won: the bar says so, and says what waits for the next campaign (the carry-over a Resolution kept, 41051:B:1).
  const complete = nodes.length > 0 && done === nodes.length;
  const kept = save.log.carryOver.map((card) => ({ code: card.code, perPlayer: card.perPlayer }));
  const waiting = kept.length > 0 ? carryWords(kept, name) : null;

  return (
    <Screen scene="ember" testID="campaign-path">
      <NavBar
        onBack={() => goBack(router, "/")}
        backTestID="path-back"
        backLabel="Campaigns"
        title={campaign.name}
        subtitle={`${seatWord(save.seatCount)} · ${done} of ${nodes.length} completed`}
        right={<IconButton icon="lore" label="Open the booklet" testID="booklet-open" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(save.campaignId, nodes[currentIndex]?.id) })} />}
      />
      <View className="pb-3 pt-1">
        <JourneyBar total={nodes.length} done={done} current={currentIndex >= 0} />
      </View>
      <ScreenScroll bottom={16}>
        {notice ? (
          <View className="mb-3">
            <BodyText tone="muted" testID="path-notice">
              {notice}
            </BodyText>
          </View>
        ) : null}
        <View className="pt-1">
          {nodes.map((node, index) => (
            <Node
              key={node.id}
              node={node}
              index={index}
              count={nodes.length}
              reached={index < reachedUpTo}
              rewards={node.reward.map(name)}
              rounds={save.log.scenarios[node.id]?.rounds ?? null}
              begin={open && open.id !== node.id && node.status === "current" ? { hint: "A scenario is open. Dealing this one drops it.", onPress: () => router.push(briefingHref(save.id, node.id)) } : null}
              onOpen={node.status === "completed" ? () => router.push(briefingHref(save.id, node.id)) : null}
            />
          ))}
        </View>
        {/* What the campaign has earned so far, and the log, at the end of the trail. */}
        <View className="mt-2 flex-row items-center gap-2.5">
          <View className="flex-1 rounded-tile px-3.5 py-2.5" style={tileSurface(false, t)}>
            <Eyebrow tone="moon">Pool</Eyebrow>
            <Text testID="pool" className="mt-0.5 text-label text-bone">
              {poolText}
            </Text>
          </View>
          <SecondaryButton label="Log" icon="lore" testID="log-open" onPress={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })} />
        </View>
      </ScreenScroll>
      {next ? (
        <ActionBar>
          <Label className="mb-2.5 text-center">{next.words}</Label>
          <PrimaryButton label={next.label} testID={next.testID} accessibilityLabel={`${next.label} ${next.words.replace(/^.*?: /, "")}`} onPress={next.onPress} />
        </ActionBar>
      ) : complete ? (
        <ActionBar>
          <Label testID="path-complete" className="mb-2.5 text-center">
            Campaign complete.
          </Label>
          {waiting ? (
            <>
              <Text testID="path-carry" className="mb-2.5 text-center text-label text-bone">
                {`${waiting.charAt(0).toUpperCase()}${waiting.slice(1)} ${carryVerb(kept) === "is" ? "waits" : "wait"} for your next campaign.`}
              </Text>
              <PrimaryButton label="Start a new campaign" testID="path-new-campaign" onPress={() => router.navigate({ pathname: "/", params: { start: "1" } })} />
            </>
          ) : null}
        </ActionBar>
      ) : null}
    </Screen>
  );
}
