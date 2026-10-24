// The table for the open scenario of a save. The canvas is src/play; this screen opens the session, keeps each accepted
// intent in user.db, and hands the canvas the pictures in the image cache. The reducer is the only writer of the game.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useStore } from "zustand";

import { record } from "../../../campaign/session";
import type { Save } from "../../../campaign/save";
import { dropOutcome, targetFromKey } from "../../../play/selection";
import { createTableStore, type TableStore } from "../../../play/store";
import { TableCanvas } from "../../../play/table-canvas";
import type { PictureSource } from "../../../play/table-canvas-types";
import { BodyText, NavBar, PrimaryButton, Screen } from "../../chrome";
import { writeSave } from "../../campaign-store";
import { useDatabases } from "../../databases";
import { goBack } from "../../go-back";
import { scanAssets } from "../../images/scan-map";
import { cachedImage, useImageSnapshot } from "../../images/store";
import { routeCode } from "../../route-code";
import { openTable, type TableSession } from "../../table-session";

function picture(code: string): PictureSource | null {
  const cached = cachedImage(code);
  if (cached) return { uri: cached.uri };
  const bundled = scanAssets[code];
  return bundled ? bundled.moduleId : null;
}

// The store for an opened session. Each intent the reducer accepts is appended to the save and written at once, so a kill
// and relaunch replays the same game.
function storeFor<TRun>(session: Extract<TableSession, { ok: true }>, user: Parameters<typeof writeSave<TRun>>[0]): TableStore {
  let saved: Save = session.save;
  return createTableStore({
    ctx: session.ctx,
    game: session.game,
    roundSteps: session.roundSteps,
    onCommit: (intent) => {
      saved = record(saved, intent);
      writeSave(user, saved);
    },
  });
}

function Table({ session, store, saveId }: { session: Extract<TableSession, { ok: true }>; store: TableStore; saveId: string }) {
  const router = useRouter();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const images = useImageSnapshot();
  const legal = useStore(store, (state) => state.legal);
  const refusal = useStore(store, (state) => state.refusal);
  const canPass = legal.some((intent) => intent.type === "Pass");

  const nameOf = useCallback((code: string) => session.world.cards.get(code)?.name ?? code, [session]);
  const inactive = useCallback(() => false, []);
  const onInspect = useCallback(
    (cardId: string) => {
      const code = store.getState().game.cards[cardId]?.code;
      if (code) router.push({ pathname: "/card/[code]", params: { code } });
    },
    [router, store],
  );
  const onDrop = useCallback(
    (cardId: string, key: string) => {
      const { game, legal: now, dispatch, select, toggleCommit } = store.getState();
      const outcome = dropOutcome(game, session.ctx, now, cardId, targetFromKey(key));
      if (outcome.kind === "intent") dispatch(outcome.intent);
      else if (outcome.kind === "commit") toggleCommit(cardId);
      select(null);
    },
    [store, session],
  );
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
  };

  return (
    <Screen testID="table" scene="felt" inset={false}>
      <View className="px-6">
        <NavBar onBack={() => goBack(router, { pathname: "/path/[saveId]", params: { saveId } })} backTestID="table-back" backLabel="Path" />
      </View>
      <View className="min-h-0 flex-1" onLayout={onLayout}>
        {size ? (
          <TableCanvas
            store={store}
            width={size.width}
            height={size.height}
            picture={picture}
            pictureRevision={images.revision}
            nameOf={nameOf}
            inactive={inactive}
            onInspect={onInspect}
            onDrop={onDrop}
          />
        ) : null}
      </View>
      <View className="px-6 pb-safe pt-2">
        {refusal ? (
          <BodyText tone="danger" testID="table-refusal">
            {refusal}
          </BodyText>
        ) : null}
        <PrimaryButton label="Pass" testID="table-pass" disabled={!canPass} onPress={() => store.getState().dispatch({ type: "Pass" })} />
      </View>
    </Screen>
  );
}

export default function TableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string }>();
  const saveId = routeCode(params.saveId);
  const { catalog, user } = useDatabases();
  // Opened once per save: the store holds the game from here on, and each accepted intent is written to user.db.
  const session = useMemo(() => (saveId ? openTable(catalog, user, saveId) : null), [catalog, user, saveId]);
  const store = useMemo(() => (session?.ok ? storeFor(session, user) : null), [session, user]);

  if (!saveId || !session || !session.ok || !store) {
    const sentence =
      session?.ok === false && session.reason === "dropped"
        ? "The scenario in progress was dropped because the rules or the card data changed. Your log and decks are kept."
        : "No scenario is open.";
    return (
      <Screen testID="table" scene="plain">
        <NavBar onBack={() => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/")} backTestID="table-back" backLabel="Path" />
        <BodyText tone="muted" testID="table-closed">
          {sentence}
        </BodyText>
      </Screen>
    );
  }
  return <Table session={session} store={store} saveId={saveId} />;
}
