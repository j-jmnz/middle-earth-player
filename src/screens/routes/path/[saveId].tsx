import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { campaignPath, openNode, type PathNode } from "../../../campaign/path";
import { rowSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { SceneArt } from "../../art";
import { ActionBar, BodyText, Chip, Eyebrow, IconButton, Label, NavBar, Panel, PrimaryButton, Screen, ScreenScroll, SecondaryButton, TextButton } from "../../chrome";
import { Road, roadLayout } from "../../path-road";
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
import { useBottomInset } from "../../use-bottom-inset";
import { droppedSentence, useSave } from "../../use-save";
import { useUiScale } from "../../../play/ui-scale";
import { useSizeClass } from "../../../play/use-size-class";
import { Text } from "../../../play/text";

// The right column's width on a tablet in landscape: the completed scenarios and the next one's panel.
const PATH_SIDE = 360;
// The room under a stop for its name (up to two lines) and its tag.
const LABEL = 58;

// The path's one next move: Resume the open scenario, else Begin the current one. `testID` keeps the ids the flows know: `begin` for
// the current scenario, `resume-<id>` for an open replay of a won one.
type Next = { label: string; testID: string; words: string; onPress: () => void };

/** The quest stages of a scenario as small chips: "1 Bree-land", in order. */
function StageChips({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5" accessible accessibilityLabel={`Stages: ${names.join(", ")}`}>
      {names.map((stage, index) => (
        <Chip key={`${stage}:${index}`} label={`${index + 1} ${stage}`} />
      ))}
    </View>
  );
}

/** A won scenario as a row: a check in a diamond, its name, rounds and score, and Replay. */
function WonRow({ node, rounds, rewards, onReplay }: { node: PathNode; rounds: number | null; rewards: readonly string[]; onReplay: () => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View className="flex-row items-center gap-3 rounded-tile px-3 py-2.5" style={rowSurface(false, t)} accessible={false}>
      <View style={{ width: 22 * s, height: 22 * s, transform: [{ rotate: "45deg" }], backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: palette.onAccent, fontSize: 12 * s, fontWeight: "700", transform: [{ rotate: "-45deg" }] }}>{"✓"}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-display text-heading text-bone" numberOfLines={1}>
          {node.name}
        </Text>
        <Label>{[rounds != null ? `${rounds} rounds` : null, node.score != null ? `score ${node.score}` : null, rewards.length > 0 ? rewards.join(", ") : null].filter(Boolean).join(" · ")}</Label>
      </View>
      <TextButton label="Replay" testID={`replay-${node.id}`} tone="accent" accessibilityLabel={`Replay ${node.name}`} onPress={onReplay} />
    </View>
  );
}

export default function CampaignPath() {
  const t = useTableTokens();
  const { size } = useSizeClass();
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog } = useDatabases();
  const { save, loaded, dropped } = useSave(saveId ?? undefined);
  const notice = dropped ? droppedSentence(dropped) : null;
  const [picked, setPicked] = useState<string | null>(null);
  const [roadWidth, setRoadWidth] = useState(0);
  const palette = usePalette();
  const s = useUiScale();
  // The landscape column has no ActionBar: its scrolls keep the bottom inset clear at their end (use-bottom-inset.ts).
  const bottomInset = useBottomInset();

  const campaign = save ? campaignOf(save.campaignId) : null;
  const nodes = useMemo(() => (save && campaign ? campaignPath(campaign, scenarioNames(campaign), save.log) : []), [save, campaign]);
  const stageNames = useMemo(() => cardNames(catalog, campaign ? campaign.scenarios.flatMap((id) => scenarioOf(id)?.stages ?? []) : []), [catalog, campaign]);
  const names = useMemo(() => {
    if (!save) return new Map<string, string>();
    return cardNames(catalog, [...save.log.campaignPool.map((card) => card.code), ...save.log.campaignPool.flatMap((card) => (card.attachedTo ? [card.attachedTo] : [])), ...Object.values(save.log.earned).flat(), ...save.log.carryOver.map((card) => card.code)]);
  }, [catalog, save]);

  if (!loaded) return <Screen scene="path" testID="campaign-path"><NavBar onBack={() => goBack(router, "/")} backTestID="path-back" /><BodyText tone="muted">Loading</BodyText></Screen>;
  if (!save || !campaign) {
    return (
      <Screen scene="path" testID="campaign-path">
        <NavBar onBack={() => goBack(router, "/")} backTestID="path-back" />
        <BodyText tone="danger">That playthrough is not on this phone.</BodyText>
      </Screen>
    );
  }

  const currentIndex = nodes.findIndex((node) => node.status === "current");
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

  const navBar = (
    <NavBar
      onBack={() => goBack(router, "/")}
      backTestID="path-back"
      backLabel="Campaigns"
      title={campaign.name}
      subtitle={`${seatWord(save.seatCount)} · ${done} of ${nodes.length} completed`}
      right={<IconButton icon="lore" label="Open the booklet" testID="booklet-open" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(save.campaignId, nodes[currentIndex]?.id) })} />}
    />
  );
  const noticeRow = notice ? (
    <View className="mb-3">
      <BodyText tone="muted" testID="path-notice">
        {notice}
      </BodyText>
    </View>
  ) : null;
  const scores = new Map(nodes.flatMap((node) => (node.score != null ? [[node.id, String(node.score)] as const] : [])));
  const replay = (node: PathNode) => () => router.push(briefingHref(save.id, node.id));
  // A won stop opens its summary with Replay; the scenario to play resumes its table when it is the one open, else opens its briefing;
  // a locked one does nothing.
  const onStop = (node: PathNode) =>
    node.status === "completed"
      ? () => setPicked(picked === node.id ? null : node.id)
      : node.status === "current"
        ? () => router.push(open?.id === node.id ? tableHref(save.id) : briefingHref(save.id, node.id))
        : undefined;
  const wide = size !== "compact";
  const stopSize = size === "compact" ? 72 : size === "medium" ? 110 : 96;
  const currentSize = size === "compact" ? 104 : size === "medium" ? 160 : 140;
  const road = roadWidth > 0 ? roadLayout(nodes, roadWidth, stopSize * s, currentSize * s, LABEL * s, size === "expanded") : null;
  const roadView = (
    // The current stop's glow reaches 40 pt past its ring: the road starts low enough that the scroll's edge never cuts it.
    <View onLayout={(event) => setRoadWidth(Math.round(event.nativeEvent.layout.width))} style={{ paddingTop: 40 * s }}>
      {road ? <Road stops={road.stops} height={road.height} width={roadWidth} label={LABEL * s} onStop={onStop} scores={scores} /> : null}
    </View>
  );
  const poolLine = (
    <View className="mt-3 rounded-tile px-3.5 py-2.5" style={rowSurface(false, t)}>
      <Eyebrow>Pool</Eyebrow>
      <Text testID="pool" className="mt-0.5 text-label text-bone">
        {poolText}
      </Text>
    </View>
  );
  const logButton = (width?: number) => (
    <View style={width ? { width: width * s } : undefined}>
      <SecondaryButton label="Log" testID="log-open" onPress={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })} />
    </View>
  );
  // A replay is open while the campaign's next scenario waits: Begin that one too, with what dealing it costs.
  const beginAnother =
    open && current && open.id !== current.id ? (
      <View>
        <SecondaryButton label={`Begin ${current.name}`} testID="begin" compact onPress={() => router.push(briefingHref(save.id, current.id))} />
        <Text testID={`hint-${current.id}`} className="mt-1.5 text-label text-muted">
          A scenario is open. Dealing this one drops it.
        </Text>
      </View>
    ) : null;
  const pickedNode = picked ? (nodes.find((node) => node.id === picked && node.status === "completed") ?? null) : null;
  const stagesOf = (id: string) => (scenarioOf(id)?.stages ?? []).map((code) => names.get(code) ?? stageNames.get(code) ?? code);
  // The panel at the foot: a won stop's summary while one is picked, else the next move, else the campaign's end.
  const footPanel = (horizontal: boolean) => {
    if (pickedNode) {
      return (
        <Panel>
          <WonRow node={pickedNode} rounds={save.log.scenarios[pickedNode.id]?.rounds ?? null} rewards={pickedNode.reward.map(name)} onReplay={replay(pickedNode)} />
        </Panel>
      );
    }
    if (next) {
      const node = open ?? current;
      const stages = node ? scenarioOf(node.id)?.stages.length ?? null : null;
      return (
        <Panel>
          <View className={horizontal ? "flex-row items-center" : undefined} style={{ gap: 16 * s }}>
            {horizontal && node ? <SceneArt scenarioId={node.id} width={240 * s} height={130 * s} radius={3} /> : null}
            <View className="min-w-0 flex-1" style={{ gap: 12 * s }}>
              <View className="flex-row items-baseline justify-between gap-2">
                <Text className="min-w-0 shrink font-display text-bone" style={{ fontSize: 20 * s, lineHeight: 25 * s }} numberOfLines={1}>
                  {node?.name ?? next.words}
                </Text>
                {stages ? <Label>{`${stages} ${stages === 1 ? "stage" : "stages"}`}</Label> : null}
              </View>
              <View className="flex-row" style={{ gap: 10 * s }}>
                {logButton(90)}
                <View className="flex-1">
                  <PrimaryButton label={next.label} testID={next.testID} accessibilityLabel={`${next.label} ${next.words.replace(/^.*?: /, "")}`} onPress={next.onPress} />
                </View>
              </View>
              {beginAnother}
            </View>
          </View>
        </Panel>
      );
    }
    if (complete) {
      return (
        <Panel>
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
          <View className="mt-2.5 flex-row">{logButton()}</View>
        </Panel>
      );
    }
    return null;
  };

  // A tablet in landscape: the road fills the left, and a 360 pt column at the right holds the won scenarios and the next one, its
  // scene, its stages, Log and Begin (docs/design-system.md, Campaign path).
  if (size === "expanded") {
    const node = open ?? current;
    const won = nodes.filter((entry) => entry.status === "completed");
    return (
      <Screen scene="path" testID="campaign-path">
        {navBar}
        <View className="min-h-0 flex-1 flex-row" style={{ gap: 32 * s }}>
          <ScreenScroll bottom={24 + bottomInset / s}>
            {noticeRow}
            {roadView}
            {poolLine}
          </ScreenScroll>
          <View style={{ width: PATH_SIDE * s }}>
            <ScreenScroll bottom={24 + bottomInset / s}>
              {won.length > 0 ? (
                <View style={{ gap: 8 * s }} className="mb-4">
                  <Eyebrow>Completed</Eyebrow>
                  {won.map((entry) => (
                    <WonRow key={entry.id} node={entry} rounds={save.log.scenarios[entry.id]?.rounds ?? null} rewards={entry.reward.map(name)} onReplay={replay(entry)} />
                  ))}
                </View>
              ) : null}
              {next && node ? (
                <Panel padded={false}>
                  <SceneArt scenarioId={node.id} height={200 * s} fade={0.45} fadeTo={palette.dusk} />
                  <View className="px-4 pb-4" style={{ marginTop: -44 * s, gap: 10 * s }}>
                    <Eyebrow>{`Scenario ${node.number} · ${open ? "On the table" : "Next"}`}</Eyebrow>
                    <Text className="font-display text-bone" style={{ fontSize: 26 * s, lineHeight: 30 * s }}>
                      {node.name}
                    </Text>
                    <StageChips names={stagesOf(node.id)} />
                    <View className="mt-1 flex-row" style={{ gap: 10 * s }}>
                      {logButton(90)}
                      <View className="flex-1">
                        <PrimaryButton label={next.label} testID={next.testID} accessibilityLabel={`${next.label} ${next.words.replace(/^.*?: /, "")}`} onPress={next.onPress} />
                      </View>
                    </View>
                    {beginAnother}
                  </View>
                </Panel>
              ) : (
                footPanel(false)
              )}
            </ScreenScroll>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scene="path" testID="campaign-path">
      {navBar}
      <ScreenScroll bottom={16} max={wide ? "wide" : "readable"}>
        {noticeRow}
        {roadView}
        {poolLine}
      </ScreenScroll>
      {/* A tablet in portrait lays the panel across the page (its scene, the name, Log and Begin in a row), not in the bar's 480 group. */}
      <ActionBar align={size === "medium" ? "fill" : "auto"}>{footPanel(size === "medium")}</ActionBar>
    </Screen>
  );
}
