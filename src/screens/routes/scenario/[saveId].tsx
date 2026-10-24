// DEV ONLY. The table does not exist yet (phase 11). This screen deals nothing the player can play: it runs the open
// scenario with a fixed policy and submits the Resolution choices the reducer offers, so a win, a loss and the log can be
// seen on a phone. Phase 11 deletes this file and moves the Maestro flow onto the real resolution screen.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { devChoices, devChoose, devResume, devSettled, devStep, type DevOutcome } from "../../../campaign/dev";
import { drop, finish } from "../../../campaign/session";
import { logCodes, loadWorld } from "../../../campaign/world";
import { CATALOG_VERSION } from "../../../catalog/version";
import { EFFECTS } from "../../../effects";
import { BodyText, Eyebrow, Label, NavBar, PrimaryButton, Screen, TextButton } from "../../chrome";
import { campaignOf, scenarioOf } from "../../campaign-data";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { routeCode } from "../../route-code";
import { useSave } from "../../use-save";

// Intents played before the screen yields.
const CHUNK = 150;

export default function ScenarioDev() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog } = useDatabases();
  const { save, loaded, update } = useSave(saveId ?? undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const campaign = save ? campaignOf(save.campaignId) : null;
  const scenario = save?.loadout ? scenarioOf(save.loadout.scenarioId) : null;
  const world = useMemo(() => {
    if (!save || !campaign || !scenario || !save.loadout) return null;
    const loadout = save.loadout;
    const extra = [...logCodes(save.log), ...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
    return loadWorld(catalog, campaign, scenario, EFFECTS, extra);
  }, [catalog, save, campaign, scenario]);
  const opened = useMemo(() => (save && world ? devResume(save, world, CATALOG_VERSION) : null), [save, world]);

  const toPath = () => {
    if (save) router.replace({ pathname: "/path/[saveId]", params: { saveId: save.id } });
  };
  const header = <NavBar onBack={() => (save ? toPath() : goBack(router, "/"))} backTestID="scenario-back" backLabel="Path" />;

  if (!loaded) {
    return (
      <Screen testID="scenario-dev" scene="plain">
        {header}
        <BodyText tone="muted">Loading</BodyText>
      </Screen>
    );
  }
  if (!save || !world || !opened) {
    return (
      <Screen testID="scenario-dev" scene="plain">
        {header}
        <BodyText tone="muted">No scenario is open.</BodyText>
      </Screen>
    );
  }
  if (!opened.ok) {
    return (
      <Screen testID="scenario-dev" scene="plain">
        {header}
        <BodyText tone="danger" testID="dev-replay-failed">
          The scenario in progress cannot be rebuilt, so it is dropped. Your log and decks are kept.
        </BodyText>
        <View className="mt-4">
          <PrimaryButton
            label="Drop it"
            testID="dev-drop"
            onPress={() => {
              update(drop(save));
              toPath();
            }}
          />
        </View>
      </Screen>
    );
  }

  const state = opened.state;
  const settled = devSettled(state);
  const name = (code: string) => world.cards.get(code)?.name ?? code;

  // Plays in chunks and yields to the UI between them, so a long game does not freeze the screen.
  async function play(outcome: DevOutcome): Promise<void> {
    if (!save || !world || playing) return;
    setPlaying(true);
    setFailure(null);
    try {
      let current = { save, state };
      let turns = 0;
      for (;;) {
        const run = devStep(current.save, world, current.state, outcome, CHUNK, turns);
        if (!run.ok) {
          setFailure("The reducer refused an intent the policy chose.");
          return;
        }
        turns += CHUNK;
        current = run;
        if (run.done) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      update(current.save);
    } finally {
      setPlaying(false);
    }
  }

  function choose(optionId: string): void {
    if (!save || !world) return;
    const answered = devChoose(save, world, state, optionId);
    if (!answered.ok) {
      setFailure("The reducer refused that choice.");
      return;
    }
    setFailure(null);
    update(answered.save);
  }

  function end(): void {
    if (!save || !world) return;
    update(finish(save, world, state));
    toPath();
  }

  const earned = state.resolutionLog.earned.map((item) => name(item.code));

  return (
    <Screen testID="scenario-dev" scene="plain">
      {header}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6">
        <Eyebrow>Dev only</Eyebrow>
        <Text accessibilityRole="header" className="mt-1 font-display text-title text-bone">
          {scenario?.name ?? ""}
        </Text>
        <BodyText tone="muted" className="mt-2">
          The table is not built yet. This control plays the open scenario with a fixed policy and submits only the choices the reducer offers.
        </BodyText>
        <View className="mt-3 gap-1">
          <Label testID="dev-round">{`Round ${state.round}`}</Label>
          {state.seats.slice(0, state.seatCount).map((seat, index) => (
            <Label key={index} testID={`dev-threat-${index}`}>{`Seat ${index + 1} threat ${seat.threat}`}</Label>
          ))}
        </View>

        {settled === "playing" ? (
          <View className="mt-6 gap-3">
            <PrimaryButton label={playing ? "Playing" : "Play to a win"} testID="dev-play-win" disabled={playing} onPress={() => void play("win")} />
            <TextButton label="Play to a loss" testID="dev-play-loss" onPress={() => void play("loss")} />
          </View>
        ) : null}

        {settled === "lost" ? (
          <View className="mt-6 gap-3">
            <Text testID="dev-outcome" className="font-display text-display text-bone">
              Defeat
            </Text>
            <BodyText tone="muted">The scenario was lost. Nothing is written to the log.</BodyText>
            <View className="items-start">
              <TextButton label="Back to path" testID="dev-finish" onPress={end} />
            </View>
          </View>
        ) : null}

        {settled === "choosing" ? (
          <View className="mt-6 gap-1">
            <Text testID="dev-outcome" className="font-display text-display text-bone">
              Victory
            </Text>
            <Eyebrow tone="muted">Choose</Eyebrow>
            <BodyText tone="muted" testID="dev-choice-note">
              Each choice is written to the campaign log when you confirm. Skip writes nothing for that group.
            </BodyText>
            {devChoices(state, world, save).map((choice) => (
              <TextButton key={choice.optionId} label={choice.label} testID={`dev-choice-${choice.optionId}`} onPress={() => choose(choice.optionId)} />
            ))}
          </View>
        ) : null}

        {settled === "won" ? (
          <View className="mt-6 gap-3">
            <Text testID="dev-outcome" className="font-display text-display text-bone">
              Victory
            </Text>
            <BodyText tone="muted" testID="dev-consequence">
              {earned.length > 0 ? `Confirming records ${earned.join(" and ")} in the campaign and unlocks the next scenario.` : "Confirming records the win and unlocks the next scenario."}
            </BodyText>
            <PrimaryButton label="Confirm" testID="dev-confirm" onPress={end} />
          </View>
        ) : null}

        {failure ? (
          <BodyText tone="danger" className="mt-4" testID="dev-error">
            {failure}
          </BodyText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
