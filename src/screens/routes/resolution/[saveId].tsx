// The end of a scenario. Won: the choices the campaign card's Resolution records open, one group (and, when the card says
// each player chooses, one seat, starting with the first player) at a time; each choice is sent to the reducer, and Confirm
// writes the log. A choice the card lets a seat pass has a visible decline ("No boon") under Confirm, a radio in the same
// group as the tiles. Lost: Defeat and nothing written (docs/design-system.md, Resolution).
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useStore } from "zustand";

import { consequenceSentence, resolutionView, settledSentence, type ResolutionTile } from "../../../campaign/resolution-view";
import { finish } from "../../../campaign/session";
import { BodyText, Eyebrow, NavBar, PrimaryButton, Screen, TextButton } from "../../chrome";
import { campaignOf, scenarioOf } from "../../campaign-data";
import { writeSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { CardThumb } from "../../images/picture";
import { palette } from "../../palette.js";
import { routeCode } from "../../route-code";
import { sessionStore, useTableSession, type SessionStore, type TableSession } from "../../table-session";

function Tile({ tile, selected, imagesrc, onPress }: { tile: ResolutionTile; selected: boolean; imagesrc: string | null; onPress: () => void }) {
  const label = tile.hero ? `${tile.name} on ${tile.hero}` : tile.name;
  return (
    <Pressable
      testID={`resolution-choice-${tile.optionId}`}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${label}, selected` : label}
      onPress={onPress}
      className="min-h-14 items-center rounded-tile p-3"
      style={({ pressed }) => ({
        // Two tiles a row: a boon offered on each hero makes a longer list than one row holds. An odd last tile keeps the
        // two-column width.
        flexBasis: "46%",
        flexGrow: 1,
        maxWidth: "50%",
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? palette.gold : palette.hairline,
        backgroundColor: pressed ? palette.pressed : palette.raised,
      })}
    >
      {tile.code ? <CardThumb code={tile.code} imagesrc={imagesrc} width={64} height={88} /> : null}
      <Text className={`mt-2 text-center text-body text-bone ${selected ? "font-semibold" : ""}`}>{label}</Text>
      {selected ? <Text className="text-label text-gold">Selected</Text> : null}
    </Pressable>
  );
}

function Resolution({ session, opened, saveId }: { session: Extract<TableSession, { ok: true }>; opened: SessionStore; saveId: string }) {
  const router = useRouter();
  const { user } = useDatabases();
  const game = useStore(opened.store, (state) => state.game);
  const refusal = useStore(opened.store, (state) => state.refusal);
  const [chosen, setChosen] = useState<string | null>(null);
  const view = useMemo(() => resolutionView(game, session.world), [game, session]);
  const scenario = scenarioOf(game.scenarioId);
  const toPath = () => router.replace({ pathname: "/path/[saveId]", params: { saveId } });
  // Back is a labelled control, never a gesture alone. Each choice is already saved, so leaving loses nothing; the
  // resolution waits on the path (Resume).
  const back = <NavBar onBack={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} backTestID="resolution-path" backLabel="Path" />;

  // A loss writes nothing to the log: the open scenario is dropped and the scenario stays current.
  const close = () => {
    writeSave(user, finish(opened.save(), session.world, game));
    toPath();
  };

  if (view.kind === "lost") {
    return (
      <Screen testID="resolution" scene="plain">
        {back}
        <View className="flex-1 justify-center">
          <Text testID="resolution-outcome" accessibilityRole="header" className="font-display text-display text-bone">
            Defeat
          </Text>
          <BodyText tone="muted" className="mt-2">
            {scenario?.name ?? ""}
          </BodyText>
          <BodyText tone="muted" className="mt-4" testID="resolution-consequence">
            The scenario was lost. Nothing is written to the log.
          </BodyText>
          <View className="mt-6 items-start">
            <TextButton label="Back to path" testID="resolution-back" onPress={close} />
          </View>
        </View>
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
  const nextName = !done && nextId ? (scenarioOf(nextId)?.name ?? null) : null;
  const picked = view.kind === "choosing" ? (view.tiles.find((tile) => tile.optionId === chosen) ?? null) : null;
  const declined = view.kind === "choosing" && view.decline != null && chosen === view.decline.optionId;
  const answer = picked?.optionId ?? (declined && view.kind === "choosing" ? (view.decline?.optionId ?? null) : null);

  return (
    <Screen testID="resolution" scene="victory">
      {back}
      {/* While choosing, the tiles and the decline under Confirm are one radio group. */}
      <View className="min-h-0 flex-1" {...(view.kind === "choosing" ? { accessibilityRole: "radiogroup" as const } : {})}>
        <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6 pt-4">
          <Text
            testID="resolution-outcome"
            accessibilityRole="header"
            className="text-center font-display text-display uppercase text-gold"
            style={{ textShadowColor: palette.gold, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } }}
          >
            Victory
          </Text>
          <BodyText tone="muted" className="mt-1 text-center">
            {scenario?.name ?? ""}
          </BodyText>
          {view.kind === "choosing" ? (
            <View className="mt-8">
              <View className="items-center" testID="resolution-group">
                <Eyebrow>{view.eyebrow}</Eyebrow>
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
          ) : null}
        </ScrollView>
        <View className="pb-safe pt-2">
          {refusal ? (
            <BodyText tone="danger" className="mb-2">
              {refusal}
            </BodyText>
          ) : null}
          {view.kind === "choosing" ? (
            <>
              <BodyText tone="muted" className="mb-3 text-center" testID="resolution-consequence">
                {consequenceSentence(view, picked, declined)}
              </BodyText>
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
                  {declined ? <Text className="text-label text-gold">Selected</Text> : null}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <BodyText tone="muted" className="mb-3 text-center" testID="resolution-consequence">
                {done ? "You have won this scenario before. Nothing is granted a second time." : settledSentence(view, session.world, nextName)}
              </BodyText>
              <PrimaryButton
                label="Confirm"
                testID="resolution-confirm"
                onPress={() => {
                  writeSave(user, finish(opened.save(), session.world, game));
                  toPath();
                }}
              />
            </>
          )}
        </View>
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
