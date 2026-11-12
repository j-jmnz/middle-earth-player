import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { needsChoiceBeforeOpen } from "../../../campaign/replay";
import { campaignPath, openNode, soonNode, soonWords, type PathNode } from "../../../campaign/path";
import { rowSurface } from "../../../ui/surfaces";
import { useTableTokens } from "../../../ui/use-table-tokens";
import { SceneArt } from "../../art/art";
import { BodyText, Chip, Eyebrow, IconButton, Label, NavBar, Panel, PrimaryButton, Screen, ScreenScroll, TextButton } from "../../kit/chrome";
import { Road, roadLayout } from "../../campaign/path-road";
import { CardLines } from "../../campaign/card-lines";
import { poolCardLine, type Line } from "../../campaign/log-facts";
import { PoolEncounterLine, WilderlandLine } from "../../campaign/wilderland-log";
import { useListPreview } from "../../pool/list-preview";
import { carryVerb, carryWords } from "../../../campaign/carry-words";
import { keepsWilderlandLog, wilderlandView } from "../../../campaign/wilderland-view";
import { xpWords } from "../../../campaign/xp-view";
import { xpUnspentOf } from "../../../campaign/xp";
import { campaignEnd } from "../../campaign/campaign-end";
import { bookletParams, campaignOf, scenarioNames, scenarioOf } from "../../data/campaign-data";
import { scenarioEndsInDefeat } from "../../data/scenario-ends";
import { cardNames } from "../../data/card-names";
import { useDatabases } from "../../data/databases";
import { usePalette } from "../../kit/palette-hook";
import { routeCode } from "../../nav/route-code";
import { briefingHref, tableHref } from "../../campaign/scenario-links";
import { seatWord } from "../../data/seats";
import { goBack } from "../../nav/go-back";
import { useBottomInset } from "../../nav/use-bottom-inset";
import { droppedSentence, useSave } from "../../data/use-save";
import { STALE_STEP } from "../../session/stale-words";
import { useUiScale } from "../../../ui/ui-scale";
import { useSizeClass } from "../../../ui/use-size-class";
import { Text } from "../../../ui/text";

// The right column's width on a tablet in landscape: the completed scenarios and the next one's panel.
const PATH_SIDE = 360;
// The room under a stop for its name (up to two lines) and its tag.
const LABEL = 58;

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

/** A won scenario as a row: a check in a diamond, its name, rounds, score and XP, and Replay. */
function WonRow({ node, rounds, rewards, onReplay }: { node: PathNode; rounds: number | null; rewards: readonly string[]; onReplay: () => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View className="flex-row items-center gap-3 rounded-item px-3 py-2.5" style={rowSurface(false, t)} accessible={false}>
      <View style={{ width: 22 * s, height: 22 * s, transform: [{ rotate: "45deg" }], backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: palette.onAccent, fontSize: 12 * s, fontWeight: "700", transform: [{ rotate: "-45deg" }] }}>{"✓"}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-display text-heading text-bone" numberOfLines={1}>
          {node.name}
        </Text>
        <Label>{[rounds != null ? `${rounds} rounds` : null, node.score != null ? `score ${node.score}` : null, node.xp != null ? `${node.xp} XP` : null, rewards.length > 0 ? rewards.join(", ") : null].filter(Boolean).join(" · ")}</Label>
      </View>
      <TextButton label="Replay" testID={`replay-${node.id}`} tone="accent" accessibilityLabel={`Replay ${node.name}`} onPress={onReplay} />
    </View>
  );
}

export default function CampaignPath() {
  const { size } = useSizeClass();
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog } = useDatabases();
  const { save, loaded, dropped } = useSave(saveId ?? undefined);
  const notice = dropped ? droppedSentence() : null;
  const [picked, setPicked] = useState<string | null>(null);
  const [roadWidth, setRoadWidth] = useState(0);
  const palette = usePalette();
  const s = useUiScale();
  // The landscape column has no ActionBar: its scrolls keep the bottom inset clear at their end (use-bottom-inset.ts).
  const bottomInset = useBottomInset();
  // A tap on a pool card's name opens its preview (user request, 2026-11-01).
  const preview = useListPreview();

  const campaign = save ? campaignOf(save.campaignId) : null;
  const nodes = useMemo(() => (save && campaign ? campaignPath(campaign, scenarioNames(campaign), save.log, scenarioEndsInDefeat) : []), [save, campaign]);
  const stageNames = useMemo(() => cardNames(catalog, campaign ? campaign.scenarios.flatMap((id) => scenarioOf(id)?.stages ?? []) : []), [catalog, campaign]);
  const names = useMemo(() => {
    if (!save) return new Map<string, string>();
    return cardNames(catalog, [...save.log.campaignPool.map((card) => card.code), ...save.log.campaignPool.flatMap((card) => (card.attachedTo ? [card.attachedTo] : [])), ...Object.values(save.log.earned).flat(), ...save.log.carryOver.map((card) => card.code), ...save.log.treasures, ...Object.keys(save.log.encounterPool)]);
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
  // The open scenario asks to be continued or restarted when it opens (the same rule as the lists: needsChoiceBeforeOpen).
  const asksChoice = open != null && save.active != null && needsChoiceBeforeOpen(save.active, save.active.intents.length, save.active.checks?.length ?? null);
  const name = (code: string) => names.get(code) ?? code;
  // The pool on one line, the cards a comma apart, each name opening its card.
  const poolLines: Line[] = save.log.campaignPool.length === 0 ? [] : [save.log.campaignPool.flatMap((card, at) => [...(at > 0 ? [{ text: ", " }] : []), ...poolCardLine(card, save.log.usedOnce, name)])];

  const current = currentIndex >= 0 ? nodes[currentIndex] : null;
  // The path stops at a scenario the app cannot deal yet: "Coming soon", no Begin, no briefing.
  const soon = soonNode(nodes);
  // The stop a tap begins or resumes the game from: the open scenario, else the current one. The path has no Begin or Resume button
  // (user request, 2026-10-29): a tap on that stop on the road does it.
  const goNode = open ?? current;
  const go = goNode ? { id: goNode.id, action: open ? "Resumes the game on the table" : "Opens the briefing to begin" } : null;

  // Every scenario is won: the bar says so, and says what waits for the next campaign (the carry-over a Resolution kept, 41051:B:1).
  const complete = nodes.length > 0 && done === nodes.length;
  const kept = save.log.carryOver.map((card) => ({ code: card.code, perPlayer: card.perPlayer }));
  const waiting = kept.length > 0 ? carryWords(kept, name) : null;
  // The campaign's end: "Ered Mithrin won. The players win the campaign!", the line the last campaign card prints.
  const lastId = nodes.at(-1)?.id;
  const end = complete ? campaignEnd(campaign, lastId ? (scenarioOf(lastId)?.campaignCard ?? null) : null, save.log.campaignEnd) : null;

  const navBar = (
    <NavBar
      onBack={() => goBack(router, "/")}
      backTestID="path-back"
      backLabel="Campaigns"
      title={campaign.name}
      subtitle={`${seatWord(save.seatCount)} · ${done} of ${nodes.length} completed`}
      right={<IconButton icon="lore" label="Open the booklet" testID="booklet-open" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(save.campaignId, nodes[currentIndex]?.id ?? soon?.id) })} />}
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
  // The open scenario resumes its table (a replay of a won one too); a won stop opens its summary with Replay; the current one opens
  // its briefing; a locked or coming-soon one does nothing.
  const onStop = (node: PathNode) =>
    open?.id === node.id
      ? () => router.push(tableHref(save.id))
      : node.status === "completed"
      ? () => setPicked(picked === node.id ? null : node.id)
      : node.status === "current"
        ? () => router.push(briefingHref(save.id, node.id))
        : undefined;
  const wide = size !== "compact";
  const stopSize = size === "compact" ? 72 : size === "medium" ? 110 : 96;
  const currentSize = size === "compact" ? 104 : size === "medium" ? 160 : 140;
  const road = roadWidth > 0 ? roadLayout(nodes, roadWidth, stopSize * s, currentSize * s, LABEL * s, size === "expanded") : null;
  const roadView = (
    // The current stop's glow reaches 40 pt past its ring: the road starts low enough that the scroll's edge never cuts it.
    <View onLayout={(event) => setRoadWidth(Math.round(event.nativeEvent.layout.width))} style={{ paddingTop: 40 * s }}>
      {road ? <Road stops={road.stops} height={road.height} width={roadWidth} label={LABEL * s} onStop={onStop} scores={scores} go={go} /> : null}
    </View>
  );
  const poolLine = (
    <View className="mt-3">
      <Eyebrow header>Pool</Eyebrow>
      <CardLines lines={poolLines} empty="Nothing earned yet." onCard={preview.openCode} testID="pool" className="mt-0.5 text-label text-bone" />
    </View>
  );
  // A campaign with XP (Dream-chaser): what the won scenarios gave and what is unspent, and Spend XP between scenarios (dcce.scalable-upgradable).
  const xpLine = campaign.xp ? (
    <View className="mt-3">
      <Eyebrow header>XP</Eyebrow>
      <Text testID="xp-line" className="mt-0.5 text-label text-bone">
        {xpWords(save.log)}
      </Text>
      {save.active != null ? (
        <Label tone="muted" testID="xp-after-scenario">
          Spend after this scenario.
        </Label>
      ) : null}
      {/* Once the last scenario is won there is no scenario to spend before: the total stays, the control goes. */}
      {save.active == null && !complete && xpUnspentOf(save.log) > 0 ? (
        <View className="-ml-3 mt-1 items-start">
          <TextButton label="Spend XP" testID="xp-open" tone="accent" onPress={() => router.push({ pathname: "/xp/[saveId]", params: { saveId: save.id } })} />
        </View>
      ) : null}
    </View>
  ) : null;
  // Ered Mithrin: the pool's encounter cards under the pool, then the treasures found, the lines the boon allies were traded for and Beldis's boxes (emce.campaign-log).
  const wilderland = keepsWilderlandLog(campaign) ? wilderlandView(save.log, save.seatCount) : null;
  const wilderlandPool = wilderland ? <PoolEncounterLine view={wilderland} name={name} onCard={preview.openCode} /> : null;
  const wilderlandLine = wilderland ? <WilderlandLine view={wilderland} name={name} onCard={preview.openCode} /> : null;
  // The campaign log, in the page under the pool, not at the screen's foot (user request, 2026-10-29).
  const logButton = (
    <View className="-ml-3 mt-1 items-start">
      <TextButton label="Campaign log" icon="contract" testID="log-open" tone="accent" onPress={() => router.push({ pathname: "/log/[saveId]", params: { saveId: save.id } })} />
    </View>
  );
  const pickedNode = picked ? (nodes.find((node) => node.id === picked && node.status === "completed") ?? null) : null;
  const stagesOf = (id: string) => (scenarioOf(id)?.stages ?? []).map((code) => names.get(code) ?? stageNames.get(code) ?? code);
  // Under the road: a won stop's summary while one is picked, else the campaign's end.
  const footPanel = () => {
    if (pickedNode) {
      return (
        <WonRow node={pickedNode} rounds={save.log.scenarios[pickedNode.id]?.rounds ?? null} rewards={pickedNode.reward.map(name)} onReplay={replay(pickedNode)} />
      );
    }
    if (soon) {
      return (
        <Label testID="path-soon" className="text-center">
          {`${soonWords(soon)}.`}
        </Label>
      );
    }
    if (complete) {
      return (
        <View>
          <Label testID="path-complete" tone={end?.tone === "danger" ? "danger" : "muted"} className="mb-2.5 text-center">
            {end?.won ?? `${campaign.name} won.`}
          </Label>
          {waiting ? (
            <Text testID="path-carry" className="mb-2.5 text-center text-label text-bone">
              {`${waiting.charAt(0).toUpperCase()}${waiting.slice(1)} ${carryVerb(kept) === "is" ? "waits" : "wait"} for your next campaign.`}
            </Text>
          ) : null}
          <PrimaryButton label="Start a new campaign" testID="path-new-campaign" onPress={() => router.navigate({ pathname: "/", params: { start: "1" } })} />
        </View>
      );
    }
    return null;
  };

  // A tablet in landscape: the road fills the left with the pool and the log under it, and a 360 pt column at the right holds the won
  // scenarios and the next one: its scene, its name and its stages (docs/design-system.md, Campaign path). The road's stop begins it.
  if (size === "expanded") {
    const won = nodes.filter((entry) => entry.status === "completed");
    const footer = footPanel();
    return (
      <Screen scene="path" testID="campaign-path">
        {navBar}
        <View className="min-h-0 flex-1 flex-row" style={{ gap: 32 * s }}>
          <ScreenScroll bottom={24 + bottomInset / s}>
            {noticeRow}
            {roadView}
            {poolLine}
            {wilderlandPool}
            {xpLine}
            {wilderlandLine}
            {logButton}
          </ScreenScroll>
          <View style={{ width: PATH_SIDE * s }}>
            <ScreenScroll bottom={24 + bottomInset / s}>
              {won.length > 0 ? (
                <View style={{ gap: 8 * s }} className="mb-4">
                  <Eyebrow header>Completed</Eyebrow>
                  {won.map((entry) => (
                    <WonRow key={entry.id} node={entry} rounds={save.log.scenarios[entry.id]?.rounds ?? null} rewards={entry.reward.map(name)} onReplay={replay(entry)} />
                  ))}
                </View>
              ) : null}
              {goNode && !complete ? (
                <Panel padded={false}>
                  <SceneArt scenarioId={goNode.id} height={200 * s} fade={0.45} fadeTo={palette.dusk} />
                  <View className="px-4 pb-4" style={{ marginTop: -44 * s, gap: 10 * s }}>
                    <Eyebrow>{`Scenario ${goNode.number} · ${open ? (asksChoice ? STALE_STEP : "On the table") : "Next"}`}</Eyebrow>
                    <Text className="font-display text-bone" style={{ fontSize: 26 * s, lineHeight: 30 * s }}>
                      {goNode.name}
                    </Text>
                    <StageChips names={stagesOf(goNode.id)} />
                  </View>
                </Panel>
              ) : null}
              {footer ? <View className="mt-4">{footer}</View> : null}
            </ScreenScroll>
          </View>
        </View>
        {preview.overlay}
      </Screen>
    );
  }

  // A phone and a tablet in portrait: one page, nothing pinned at the foot (user request, 2026-10-29: Resume is the road's stop, and
  // the log sits under the pool). A picked won stop's summary, or the campaign's end, stands under the road.
  const footer = footPanel();
  return (
    <Screen scene="path" testID="campaign-path">
      {navBar}
      <ScreenScroll bottom={24 + bottomInset / s} max={wide ? "wide" : "readable"}>
        {noticeRow}
        {roadView}
        {footer ? <View className="mt-3">{footer}</View> : null}
        {poolLine}
        {wilderlandPool}
        {xpLine}
        {wilderlandLine}
        {logButton}
      </ScreenScroll>
      {preview.overlay}
    </Screen>
  );
}
