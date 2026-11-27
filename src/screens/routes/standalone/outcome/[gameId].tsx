// The end of a standalone game. Won: Victory and the score (ltp.scoring); there is no campaign card, so nothing to choose.
// Lost: Defeat and the reason. Under either, the game's details (game-report.tsx): the stage reached, the heroes, the score's parts. The result asks for nothing, but it is final only when the player leaves it:
// leaving the screen any way (Done, Play again, Back, the phone's back gesture) writes it (the game's result and its run, settleStandalone), so a relaunch before that opens the same result again. Undo takes back
// the move that ended the game and returns to the table, with nothing written. Done returns to the scenarios, and Play again opens a new briefing with the same
// seats, decks and difficulty. A game already finished shows its stored result.
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { View } from "react-native";

import { gameReport } from "../../../../campaign/report";
import { finishStandalone } from "../../../../campaign/standalone";
import { gameIsOn } from "../../../../campaign/resolution-view";
import { ActionBar, BodyText, Label, NavBar, OutcomeTitle, PrimaryButton, Screen, ScreenScroll, StatTile, TextButton, TwoPane } from "../../../kit/chrome";
import { useSizeClass } from "../../../../ui/use-size-class";
import { GameReportView } from "../../../campaign/game-report";
import { scenarioName } from "../../../data/campaign-data";
import { useDatabases } from "../../../data/databases";
import { goBack } from "../../../nav/go-back";
import { routeCode } from "../../../nav/route-code";
import { comparisonLossNote } from "../../../../play/readouts/against-the-shadow/amon-din";
import { settleStandalone, standaloneStore, useStandaloneSession } from "../../../session/standalone-session";
import { landOnUndo } from "../../../session/undo-landing";
import { ResultUndo } from "../../../table/result-undo";
import { outcomeLines } from "../../../history/standalone-words";

export default function StandaloneOutcome() {
  const router = useRouter();
  const { size, short } = useSizeClass();
  const params = useLocalSearchParams<{ gameId: string }>();
  const gameId = routeCode(params.gameId);
  const { user } = useDatabases();
  const session = useStandaloneSession(gameId);
  const finished = useMemo(() => (session?.ok ? finishStandalone(session.stored, session.world, session.game) : (session?.stored ?? null)), [session]);
  const ended = session?.ok === true && finished?.result != null;
  // The details of the game, while its final state is at hand (a game reopened from the list keeps only its result).
  const report = useMemo(() => (session?.ok && finished?.result ? gameReport(session.game, session.world.cards, session.destroyedHeroes) : null), [session, finished]);
  // The store of the game that just ended, for Undo only: it takes the last move back and writes the shorter game, as the table's Undo does.
  const opened = useMemo(() => (session?.ok ? standaloneStore(session, user) : null), [session, user]);
  // Leaving the result makes it final: the game's result and its one run (History) are written, the run dated to the move that ended the game. A reopened outcome writes nothing more (its run exists, and a second write changes nothing).
  const settle = () => {
    if (ended && session?.ok) settleStandalone(user, session);
  };
  // Any leave that is not Undo's own settles: Done, Play again and Back call it at once, and the screen losing focus (the phone's back gesture, a swipe) calls it once more, which writes nothing new.
  const undoing = useRef(false);
  const settleOnLeave = useEffectEvent(() => {
    if (!undoing.current) settle();
  });
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    undoing.current = false;
    return () => settleOnLeave();
  }, [focused]);
  // Undo went back over the move that ended the game, or a move after it: back to the table once the game is on again, on the moment taken back (undo-landing.ts).
  const undone = () => {
    if (!opened || !session?.ok || !gameId || !gameIsOn(opened.store.getState().game, session.world)) return;
    undoing.current = true;
    landOnUndo(gameId, opened.game().active?.intents.length ?? 0, opened.store.getState().moment);
    router.replace({ pathname: "/standalone/table/[gameId]", params: { gameId } });
  };
  // Encounter at Amon Dîn's comparison loss says the two counts, as the Defeat sheet did (null for any other loss).
  const counts = session?.ok ? comparisonLossNote(session.game) : null;
  const back = <NavBar onBack={() => { settle(); goBack(router, "/scenarios"); }} backTestID="outcome-back" backLabel="Scenarios" />;

  if (!gameId || !finished || (!session?.ok && !finished.result)) {
    return (
      <Screen testID="standalone-outcome" scene="calm">
        {back}
        <BodyText tone="muted" testID="outcome-closed">
          This game is not open.
        </BodyText>
      </Screen>
    );
  }

  const result = finished.result;
  if (!result) {
    return (
      <Screen testID="standalone-outcome" scene="calm">
        <NavBar onBack={() => goBack(router, { pathname: "/standalone/table/[gameId]", params: { gameId } })} backTestID="outcome-table" backLabel="Table" />
        <BodyText tone="muted">The game is not over yet.</BodyText>
      </Screen>
    );
  }

  const won = result.outcome === "won";
  const done = () => {
    settle();
    router.replace("/scenarios");
  };
  const playAgain = () => {
    settle();
    router.replace({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: finished.scenarioId, from: finished.id } });
  };

  const titleBlock = <OutcomeTitle won={won} scenario={scenarioName(finished.scenarioId)} testID="outcome-title" />;
  const linesBlock =
    result.outcome === "won" ? (
      // The score as the numbers the player watches: score, completed rounds, victory points (ltp.scoring).
      <View className="mt-4" testID="outcome-lines">
        <View className="flex-row gap-2">
          <StatTile label="Score" value={String(result.score.score)} />
          <StatTile label="Rounds" value={String(result.score.rounds)} />
          <StatTile label="Victory points" value={String(result.score.victoryPoints)} />
        </View>
        <Label className="mt-2 text-center">Lower score is better.</Label>
      </View>
    ) : (
      <View className={short ? "mt-2 gap-1" : "mt-6 gap-1"} testID="outcome-lines">
        {outcomeLines(result, counts ?? report?.lossReason).map((line) => (
          <BodyText key={line} tone="muted" className="text-center">
            {line}
          </BodyText>
        ))}
      </View>
    );

  const undo = opened ? <ResultUndo store={opened.store} testID="outcome-undo" onUndone={undone} /> : null;
  const again = <TextButton label="Play again" testID="outcome-again" tone="accent" onPress={playAgain} />;
  // A short window (a phone on its side) puts Play again and Undo side by side under Done: stacked, the three buttons fill half the screen.
  const actions = (
    <>
      <PrimaryButton label="Done" testID="outcome-done" onPress={done} />
      {short ? (
        <View className="mt-1 flex-row items-center justify-center gap-4">
          {again}
          {undo}
        </View>
      ) : (
        <View className="mt-1 items-center">
          {again}
          {undo}
        </View>
      )}
    </>
  );
  const twoPane = size === "expanded" && report != null;

  return (
    <Screen testID="standalone-outcome" scene={won ? "victory" : "ember"}>
      {back}
      {/* Expanded, with the game's details at hand: the title and the numbers at the left, the report in a pane at the right.
          Otherwise (a reopened game keeps only its result; or a phone, or a medium window) one readable column. */}
      {twoPane ? (
        <TwoPane
          kind="supporting"
          side="end"
          start={
            <ScreenScroll top={16} bottom={24}>
              {titleBlock}
              {linesBlock}
            </ScreenScroll>
          }
          // The bar stands in the report's pane, so the title and the lines at the left keep the whole height: under a full-width bar a phone on its side cut them off.
          end={
            <>
              <ScreenScroll top={16} bottom={24}>
                <GameReportView report={report} tiles={won} />
              </ScreenScroll>
              <ActionBar align="fill">{actions}</ActionBar>
            </>
          }
        />
      ) : (
        <ScreenScroll top={16} bottom={24} max="readable">
          {titleBlock}
          {linesBlock}
          {report ? (
            <View className="mt-8">
              <GameReportView report={report} tiles={won} />
            </View>
          ) : null}
        </ScreenScroll>
      )}
      {twoPane ? null : <ActionBar>{actions}</ActionBar>}
    </Screen>
  );
}
