import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { campaignPath, openNode, type PathNode } from "../../../campaign/path";
import { BodyText, Label, NavBar, Panel, PrimaryButton, RingMark, Screen, TextButton, pressedNight } from "../../chrome";
import { bookletParams, campaignOf, scenarioNames } from "../../campaign-data";
import { cardNames } from "../../card-names";
import { useDatabases } from "../../databases";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { briefingHref, tableHref } from "../../scenario-links";
import { goBack } from "../../go-back";
import { droppedSentence, useSave } from "../../use-save";

const STATUS_WORD = { completed: "Completed", current: "Current", locked: "Locked" } as const;

function Node({
  node,
  index,
  currentIndex,
  last,
  rewardText,
  action,
  onOpen,
}: {
  node: PathNode;
  index: number;
  currentIndex: number;
  last: boolean;
  rewardText: string;
  action: { label: string; onPress: () => void; hint?: string } | null;
  onOpen: (() => void) | null;
}) {
  const lineColor = index < currentIndex ? palette.gold : palette.hairline;
  const text = (
    <View
      className={node.status === "current" ? "py-4" : "py-3"}
      accessible
      accessibilityLabel={`${node.name}, ${STATUS_WORD[node.status]}${rewardText ? `, ${rewardText}` : ""}`}
    >
      <Text testID={`node-${node.id}-status`} className={node.status === "current" ? "text-label text-gold" : "text-label text-faint"}>
        {STATUS_WORD[node.status]}
      </Text>
      <Text className={node.status === "locked" ? "font-display text-body text-faint" : "font-display text-title text-bone"}>{node.name}</Text>
      {rewardText ? <Text className="text-label text-muted">{rewardText}</Text> : null}
    </View>
  );
  const left = node.status === "completed" || (node.status === "locked" && index % 2 === 0);
  return (
    <View testID={`node-${node.id}`} className="flex-row items-stretch">
      <View className="flex-1 justify-center pr-4" style={{ alignItems: "flex-end" }}>
        {left ? text : null}
      </View>
      <View className="w-6 items-center">
        {/* One segment of the line per node: gold up to the current node. */}
        <View style={{ position: "absolute", top: index === 0 ? "50%" : 0, bottom: last ? "50%" : 0, width: 1.5, backgroundColor: lineColor }} />
        <View className="flex-1 justify-center">
          <RingMark size={node.status === "current" ? 28 : node.status === "completed" ? 16 : 12} state={node.status === "completed" ? "done" : node.status === "current" ? "current" : "locked"} />
        </View>
      </View>
      <View className="flex-1 justify-center pl-4">
        {!left ? text : null}
        {action ? (
          <View className="pb-3">
            <PrimaryButton label={action.label} testID={node.status === "current" ? "begin" : `resume-${node.id}`} onPress={action.onPress} />
            {action.hint ? (
              <Text testID={`hint-${node.id}`} className="mt-1 text-label text-muted">
                {action.hint}
              </Text>
            ) : null}
          </View>
        ) : null}
        {node.status === "completed" && onOpen ? (
          <Pressable
            testID={`replay-${node.id}`}
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={`Replay ${node.name}`}
            onPress={onOpen}
            className="min-h-11 min-w-11 items-start justify-center self-start rounded-tile px-2"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            <Text className="text-label text-gold">Replay</Text>
          </Pressable>
        ) : null}
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
        right={<TextButton label="Booklet" accessibilityLabel="Open the booklet" testID="booklet-open" tone="gold" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(save.campaignId, nodes[currentIndex]?.id) })} />}
      />
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-4">
        <Text accessibilityRole="header" className="mb-4 mt-2 text-center font-display text-title text-bone">
          {campaign.name}
        </Text>
        {notice ? (
          <View className="mb-3">
            <BodyText tone="muted" testID="path-notice">
              {notice}
            </BodyText>
          </View>
        ) : null}
        {nodes.map((node, index) => (
          <Node
            key={node.id}
            node={node}
            index={index}
            currentIndex={currentIndex < 0 ? nodes.length : currentIndex}
            last={index === nodes.length - 1}
            rewardText={node.reward.map(name).join(" · ")}
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
      </ScrollView>
      <View className="pb-safe pt-2">
        <Panel>
          <Label>Pool</Label>
          {/* A long pool scrolls inside the panel; it never pushes Log off the screen. */}
          <ScrollView className="mt-1 max-h-24" nestedScrollEnabled>
            <Text testID="pool" className="text-body text-bone">
              {poolText}
            </Text>
          </ScrollView>
          <View className="mt-2 items-start">
            <TextButton label="Log" testID="log-open" tone="gold" onPress={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })} />
          </View>
        </Panel>
      </View>
    </Screen>
  );
}
