import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import { campaignPath, openNode, type PathNode } from "../../../campaign/path";
import { nightFade, panelSurface, raisedEdge, topShade } from "../../../play/surfaces";
import { withAlphaHex } from "../../../play/tokens";
import { SceneArt } from "../../art";
import { ActionBar, BodyText, Chip, Corners, Eyebrow, IconButton, JourneyBar, Label, NavBar, PrimaryButton, Screen, ScreenScroll, SecondaryButton, TextButton } from "../../chrome";
import { bookletParams, campaignOf, scenarioNames, scenarioOf } from "../../campaign-data";
import { cardNames } from "../../card-names";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { briefingHref, tableHref } from "../../scenario-links";
import { seatWord } from "../../seats";
import { goBack } from "../../go-back";
import { droppedSentence, useSave } from "../../use-save";

const STATUS_WORD = { completed: "Completed", current: "Current", locked: "Locked" } as const;
const RAIL = 44;

type Action = { label: string; onPress: () => void; hint?: string } | null;

// The medallion on the trail: a gold disc with a check for a won scenario, a lit gold ring for the one to play, a night disc
// with its number for one still locked.
function Medallion({ node }: { node: PathNode }) {
  if (node.status === "completed") {
    return (
      <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: palette.gold, borderWidth: 3, borderColor: palette.night }}>
        <Text style={{ color: palette.onGold, fontSize: 13, fontWeight: "800" }}>{"✓"}</Text>
      </View>
    );
  }
  if (node.status === "current") {
    return (
      <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: palette.night, borderWidth: 2, borderColor: palette.gold, boxShadow: `0 0 16px ${withAlphaHex(palette.gold, 0.6)}` }}>
        <Text className="font-display-bold text-body text-goldHigh">{String(node.number)}</Text>
      </View>
    );
  }
  return (
    <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.hairline }}>
      <Text className="font-display-bold text-label text-faint">{String(node.number)}</Text>
    </View>
  );
}

function StatusChip({ node, onArt = false }: { node: PathNode; onArt?: boolean }) {
  return <Chip testID={`node-${node.id}-status`} label={STATUS_WORD[node.status]} tone={node.status === "completed" ? "ok" : node.status === "current" ? "gold" : "faint"} onArt={onArt} />;
}

function ActionButton({ node, action }: { node: PathNode; action: Action }) {
  if (!action) return null;
  return (
    <View className="mt-4">
      <PrimaryButton label={action.label} testID={node.status === "current" ? "begin" : `resume-${node.id}`} onPress={action.onPress} />
      {action.hint ? (
        <Text testID={`hint-${node.id}`} className="mt-1.5 text-label text-muted">
          {action.hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One stop on the trail. A won scenario is a panel with its score and what it earned (Replay under it); the scenario to play is
 * a framed card with its scene and the one primary; a locked one is a dim line.
 */
function Node({ node, index, count, reached, rewards, rounds, action, onOpen }: {
  node: PathNode;
  index: number;
  count: number;
  // Whether the trail is gold up to this stop.
  reached: boolean;
  rewards: readonly string[];
  rounds: number | null;
  action: Action;
  onOpen: (() => void) | null;
}) {
  const said = `${node.name}, ${STATUS_WORD[node.status]}${rewards.length > 0 ? `, ${rewards.join(", ")}` : ""}`;
  const stages = scenarioOf(node.id)?.stages.length ?? null;
  return (
    <View testID={`node-${node.id}`} className="flex-row">
      <View style={{ width: RAIL }} className="items-center">
        {/* One segment of the trail per stop: gold up to the current stop, night past it. */}
        <View style={{ position: "absolute", top: index === 0 ? 20 : 0, bottom: index === count - 1 ? "50%" : 0, width: 2, backgroundColor: reached ? palette.gold : palette.hairline }} />
        <View style={{ marginTop: node.status === "current" ? 18 : 12 }}>
          <Medallion node={node} />
        </View>
      </View>
      <View className="flex-1 pb-3.5">
        {node.status === "current" ? (
          <View className="rounded-card" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.goldLine, boxShadow: raisedEdge }}>
            <View className="overflow-hidden rounded-t-card">
              <SceneArt scenarioId={node.id} height={128}>
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...topShade(0.35) }} />
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(0.35, 1, palette.raised) }} />
                <View className="absolute right-3 top-3">
                  <StatusChip node={node} onArt />
                </View>
              </SceneArt>
            </View>
            <View className="px-4 pb-4" style={{ marginTop: -30 }} accessible accessibilityLabel={said}>
              <Eyebrow>{`Scenario ${node.number}`}</Eyebrow>
              <Text className="mt-1 font-display text-title text-bone">{node.name}</Text>
              {stages ? <Label>{`${stages} quest ${stages === 1 ? "stage" : "stages"}`}</Label> : null}
            </View>
            <View className="px-4 pb-4" style={{ marginTop: -16 }}>
              <ActionButton node={node} action={action} />
            </View>
            <Corners />
          </View>
        ) : node.status === "completed" ? (
          <View className="rounded-card px-4 py-3" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline, boxShadow: raisedEdge }}>
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
            <ActionButton node={node} action={action} />
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
    return cardNames(catalog, [...save.log.campaignPool.map((card) => card.code), ...save.log.campaignPool.flatMap((card) => (card.attachedTo ? [card.attachedTo] : [])), ...Object.values(save.log.earned).flat()]);
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
      : save.log.campaignPool.map((card) => (card.attachedTo ? `${name(card.code)} on ${name(card.attachedTo)}` : name(card.code))).join(", ");

  return (
    <Screen scene="ember" testID="campaign-path">
      <NavBar
        onBack={() => goBack(router, "/")}
        backTestID="path-back"
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
              action={
                open?.id === node.id
                  ? { label: "Resume", onPress: () => router.push(tableHref(save.id)) }
                  : node.status === "current"
                    ? { label: "Begin", hint: open ? "A scenario is open. Dealing this one drops it." : undefined, onPress: () => router.push(briefingHref(save.id, node.id)) }
                    : null
              }
              onOpen={node.status === "completed" ? () => router.push(briefingHref(save.id, node.id)) : null}
            />
          ))}
        </View>
      </ScreenScroll>
      <ActionBar>
        <View className="flex-row items-center gap-2.5">
          <View className="flex-1 rounded-tile px-3.5 py-2" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.hairline }}>
            <Eyebrow tone="moon">Pool</Eyebrow>
            {/* A long pool scrolls inside its plate; it never pushes Log off the screen. */}
            <ScrollView className="max-h-12" nestedScrollEnabled>
              <Text testID="pool" className="text-label text-bone">
                {poolText}
              </Text>
            </ScrollView>
          </View>
          <SecondaryButton label="Log" icon="lore" testID="log-open" onPress={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })} />
        </View>
      </ActionBar>
    </Screen>
  );
}
