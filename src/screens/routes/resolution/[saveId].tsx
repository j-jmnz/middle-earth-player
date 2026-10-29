// The end of a scenario. Won: the choices the campaign card's Resolution records open, one group (and, when the card says
// each player chooses, one seat, starting with the first player) at a time; each choice is sent to the reducer, and Confirm
// writes the log. A choice the card lets a seat pass has a visible decline ("No boon") under Confirm, a radio in the same
// group as the tiles. Lost: Defeat and nothing written (docs/design-system.md, Resolution). Under either, the scenario's details
// (game-report.tsx).
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "zustand";

import { gameReport } from "../../../campaign/report";
import { consequenceSentence, resolutionView, settledSentence, type ResolutionTile } from "../../../campaign/resolution-view";
import { finish } from "../../../campaign/session";
import { ActionBar, BodyText, Corners, Label, NavBar, OutcomeTitle, PrimaryButton, Screen, ScreenScroll, Section, SecondaryButton, TextButton, TwoPane } from "../../chrome";
import { tileSurface } from "../../../play/surfaces";
import { useTableTokens } from "../../../play/use-table-tokens";
import { withAlphaHex } from "../../../play/tokens";
import { campaignOf, scenarioName } from "../../campaign-data";
import { writeSave } from "../../campaign-store";
import { recordCampaignRun } from "../../run-writers";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { CardThumb } from "../../images/picture";
import { GameReportView } from "../../game-report";
import { usePalette } from "../../palette-hook";
import { routeCode } from "../../route-code";
import { sessionStore, useTableSession, type SessionStore, type TableSession } from "../../table-session";
import { useUiScale } from "../../../play/ui-scale";
import { useSizeClass } from "../../../play/use-size-class";

function Tile({ tile, selected, imagesrc, onPress }: { tile: ResolutionTile; selected: boolean; imagesrc: string | null; onPress: () => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const label = tile.hero ? `${tile.name} on ${tile.hero}` : tile.name;
  return (
    <Pressable
      testID={`resolution-choice-${tile.optionId}`}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${label}, selected` : label}
      onPress={onPress}
      // Two tiles a row: a boon offered on each hero makes a longer list than one row holds. An odd last tile keeps the
      // two-column width.
      style={{ flexBasis: "46%", flexGrow: 1, maxWidth: "50%" }}
    >
      {({ pressed }) => (
        <View
          className="min-h-14 items-center rounded-card p-3"
          style={{ ...tileSurface(pressed, t), ...(selected ? { borderWidth: 1.5, borderColor: palette.accent, boxShadow: `0 0 18px ${withAlphaHex(palette.accent, 0.28)}` } : {}) }}
        >
          {tile.code ? <CardThumb code={tile.code} imagesrc={imagesrc} width={72 * s} height={100 * s} /> : null}
          <Text className={`mt-2.5 text-center font-display text-heading ${selected ? "text-accentHigh" : "text-bone"}`}>{label}</Text>
          {selected ? <Text className="mt-0.5 text-label font-semibold text-accentHigh">Selected</Text> : null}
          {selected ? <Corners /> : null}
        </View>
      )}
    </Pressable>
  );
}

function Resolution({ session, opened, saveId }: { session: Extract<TableSession, { ok: true }>; opened: SessionStore; saveId: string }) {
  const router = useRouter();
  const { size } = useSizeClass();
  const { user } = useDatabases();
  const game = useStore(opened.store, (state) => state.game);
  const refusal = useStore(opened.store, (state) => state.refusal);
  const [chosen, setChosen] = useState<string | null>(null);
  const view = useMemo(() => resolutionView(game, session.world), [game, session]);
  // The scenario's details under Victory or Defeat: when it ended, the stage reached, the heroes, the score's parts.
  const report = useMemo(() => (view.kind === "playing" ? null : gameReport(game, session.world.cards)), [view.kind, game, session]);
  // A loss is a run the moment it is reached (the table wrote it already; a game lost before this build is written here). The
  // run id is fixed, so a second write changes nothing, and leaving by Path loses nothing.
  const lost = view.kind === "lost";
  useEffect(() => {
    if (lost) recordCampaignRun(user, opened.save(), opened.save(), session.world, game);
  }, [lost, user, opened, session, game]);
  const toPath = () => router.replace({ pathname: "/path/[saveId]", params: { saveId } });
  // Back is a labelled control, never a gesture alone. Each choice is already saved, so leaving loses nothing; the
  // resolution waits on the path (Resume).
  const back = <NavBar onBack={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} backTestID="resolution-path" backLabel="Path" />;

  // A loss writes nothing to the log: the open scenario is dropped and the scenario stays current.
  // The loss is a run all the same (History), written beside the log, not in it.
  const close = () => {
    const before = opened.save();
    const after = finish(before, session.world, game);
    recordCampaignRun(user, before, after, session.world, game);
    writeSave(user, after);
    toPath();
  };

  if (view.kind === "lost") {
    return (
      <Screen testID="resolution" scene="plain">
        {back}
        <ScreenScroll top={32} bottom={24} max="readable">
          <OutcomeTitle won={false} scenario={scenarioName(game.scenarioId)} testID="resolution-outcome" />
          {view.reason ? (
            <BodyText className="mt-6 text-center" testID="resolution-reason">
              {/[.!?]$/.test(view.reason) ? view.reason : `${view.reason}.`}
            </BodyText>
          ) : null}
          <BodyText tone="muted" className={view.reason ? "mt-2 text-center" : "mt-6 text-center"} testID="resolution-consequence">
            The scenario was lost. Nothing is written to the log.
          </BodyText>
          {report ? (
            <View className="mt-8">
              <GameReportView report={report} />
            </View>
          ) : null}
        </ScreenScroll>
        <ActionBar>
          <SecondaryButton label="Back to path" testID="resolution-back" onPress={close} />
        </ActionBar>
      </Screen>
    );
  }

  if (view.kind === "playing") {
    return (
      <Screen testID="resolution" scene="plain">
        <NavBar onBack={() => goBack(router, { pathname: "/table/[saveId]", params: { saveId } })} backTestID="resolution-table" backLabel="Table" />
        <BodyText tone="muted">The scenario is not over yet.</BodyText>
      </Screen>
    );
  }

  const campaign = campaignOf(opened.save().campaignId);
  const done = opened.save().log.completed.includes(game.scenarioId);
  const at = campaign?.scenarios.indexOf(game.scenarioId) ?? -1;
  const nextId = at >= 0 ? campaign?.scenarios[at + 1] : undefined;
  const nextName = !done && nextId ? scenarioName(nextId) : null;
  // The last scenario of the campaign: the win completes it.
  const completes = !done && at >= 0 && nextId == null ? (campaign?.name ?? null) : null;
  const picked = view.kind === "choosing" ? (view.tiles.find((tile) => tile.optionId === chosen) ?? null) : null;
  const declined = view.kind === "choosing" && view.decline != null && chosen === view.decline.optionId;
  const answer = picked?.optionId ?? (declined && view.kind === "choosing" ? (view.decline?.optionId ?? null) : null);

  // While choosing, the outcome word sits higher so a row of tiles shows whole above the bar.
  const titleBlock = (
    <View className={view.kind === "choosing" ? "mt-4" : "mt-16"}>
      <OutcomeTitle won scenario={scenarioName(game.scenarioId)} testID="resolution-outcome" />
    </View>
  );
  const choiceBlock =
    view.kind === "choosing" ? (
      <View className="mt-8">
        <View testID="resolution-group">
          <Section title={view.eyebrow} />
        </View>
        {view.seatLabel ? (
          <BodyText tone="muted" className="mt-1 text-center" testID="resolution-seat">
            {view.seatLabel}
          </BodyText>
        ) : null}
        {/* Two-handed, the choices the seats before this one confirmed. */}
        {view.answered.map((answer) => (
          <BodyText key={answer.seat} tone="muted" className="text-center" testID={`resolution-answered-${answer.seat}`}>
            {`Player ${answer.seat + 1}: ${answer.words}`}
          </BodyText>
        ))}
        <View className="mt-4 flex-row flex-wrap gap-3">
          {view.tiles.map((tile) => (
            <Tile key={tile.optionId} tile={tile} selected={tile.optionId === chosen} imagesrc={tile.code ? (session.facts.get(tile.code)?.imagesrc ?? null) : null} onPress={() => setChosen(tile.optionId)} />
          ))}
        </View>
      </View>
    ) : null;
  // Expanded and choosing: the title and the tiles at the left, the report in a pane at the right. Once settled, a readable column.
  const split = size === "expanded" && view.kind === "choosing";

  return (
    <Screen testID="resolution" scene="victory">
      {back}
      {/* While choosing, the tiles and the decline under Confirm are one radio group. */}
      <View className="min-h-0 flex-1" {...(view.kind === "choosing" ? { accessibilityRole: "radiogroup" as const } : {})}>
        {split ? (
          <TwoPane
            kind="supporting"
            side="end"
            start={
              <ScreenScroll top={16} bottom={24}>
                {titleBlock}
                {choiceBlock}
              </ScreenScroll>
            }
            end={
              <ScreenScroll top={16} bottom={24}>
                {report ? (
                  <View className="mt-4">
                    <GameReportView report={report} />
                  </View>
                ) : null}
              </ScreenScroll>
            }
          />
        ) : (
          <ScreenScroll top={16} bottom={24} max="readable">
            {titleBlock}
            {choiceBlock}
            {report ? (
              <View className="mt-8">
                <GameReportView report={report} />
              </View>
            ) : null}
          </ScreenScroll>
        )}
        <ActionBar>
          {refusal ? (
            <BodyText tone="danger" className="mb-2">
              {refusal}
            </BodyText>
          ) : null}
          {view.kind === "choosing" ? (
            <>
              <Label tone="muted" className="mb-3 text-center" testID="resolution-consequence">
                {consequenceSentence(view, picked, declined)}
              </Label>
              <PrimaryButton
                label="Confirm"
                testID="resolution-confirm"
                disabled={answer == null}
                onPress={() => {
                  if (answer == null) return;
                  if (opened.store.getState().dispatch({ type: "ChooseResolution", optionId: answer })) setChosen(null);
                }}
              />
              {/* The decline sits under Confirm in thumb reach, a radio in the same group as the tiles. */}
              {view.decline ? (
                <View className="mt-1 items-center">
                  <TextButton
                    label={view.decline.label}
                    testID="resolution-decline"
                    selected={declined}
                    accessibilityLabel={declined ? `${view.decline.label}, selected` : view.decline.label}
                    onPress={() => setChosen(view.decline?.optionId ?? null)}
                  />
                  {declined ? <Text className="text-label font-semibold text-accentHigh">Selected</Text> : null}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Label tone="muted" className="mb-3 text-center" testID="resolution-consequence">
                {done ? "You have won this scenario before. Nothing is granted a second time." : settledSentence(view, session.world, nextName, completes)}
              </Label>
              <PrimaryButton
                label="Confirm"
                testID="resolution-confirm"
                onPress={() => close()}
              />
            </>
          )}
        </ActionBar>
      </View>
    </Screen>
  );
}

export default function ResolutionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { user } = useDatabases();
  const session = useTableSession(saveId);
  const opened = useMemo(() => (session?.ok ? sessionStore(session, user) : null), [session, user]);
  if (!saveId || !session?.ok || !opened) {
    return (
      <Screen testID="resolution" scene="plain">
        <NavBar onBack={() => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/")} backTestID="resolution-path" backLabel="Path" />
        <BodyText tone="muted" testID="resolution-closed">
          No scenario is open.
        </BodyText>
      </Screen>
    );
  }
  return <Resolution session={session} opened={opened} saveId={saveId} />;
}
