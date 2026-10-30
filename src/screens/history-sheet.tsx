// The sheet a playthrough's or a game's ⋯ opens in History (docs/design-system.md, History): where it goes (a playthrough's path and
// log; a game's table or outcome, and Play again) and what keeps it or ends it (Archive or Restore, and Delete, asked twice in place).
// Each change is announced, refreshes the list and closes the sheet; a way out closes it and then goes.
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import type { RunRecord } from "../campaign/runs";
import { standaloneStatus, type ListedStandalone } from "../campaign/standalone";
import { scenarioName } from "./campaign-data";
import { archiveSave, deleteSave, restoreSave } from "./campaign-store";
import { PaperSheet, TextButton } from "./chrome";
import { useDatabases } from "./databases";
import type { LibrarySave } from "./history-read";
import { KeepOrDelete } from "./keep-or-delete";
import { pathHref } from "./scenario-links";
import { DELETE_SENTENCE, describe } from "./save-panels";
import { SheetModal } from "./sheet-modal";
import { archiveStandalone, deleteStandalone, restoreStandalone } from "./standalone-store";
import { gameCaption } from "./standalone-words";
import { recordUnclosedRun } from "./table-session";

/** What a sheet is opened on: a playthrough, or a game with the run it wrote (if any). */
export type RefTarget = { kind: "campaign"; ref: LibrarySave; archived: boolean } | { kind: "standalone"; game: ListedStandalone; run: RunRecord | null; archived: boolean };

const DELETE_GAME = "Delete this game? It is gone for good. Your decks stay.";

export function HistorySheet({ target, onClose, onChanged }: { target: RefTarget | null; onClose: () => void; onChanged: () => void }) {
  return (
    <SheetModal visible={target != null} onRequestClose={onClose} scrimLabel="Close actions">
      {/* Keyed by what it is for, so a delete that was asked is not carried to another one. */}
      {target ? <RefSheet key={target.kind === "campaign" ? target.ref.id : target.game.id} target={target} onClose={onClose} onChanged={onChanged} /> : null}
    </SheetModal>
  );
}

// What both sheets share: the confirm that Delete asks, a change that announces and refreshes and closes, and a way out.
function useRefActions(described: string, onClose: () => void, onChanged: () => void) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  // The button a screen reader was on goes away with each change, so each says what happened.
  function change(word: "Archived" | "Restored" | "Deleted", apply: () => void): void {
    apply();
    AccessibilityInfo.announceForAccessibility(`${word} ${described}`);
    onChanged();
    onClose();
  }
  function go(href: Href): void {
    onClose();
    router.push(href);
  }
  function askDelete(sentence: string): void {
    setConfirming(true);
    AccessibilityInfo.announceForAccessibility(sentence);
  }
  return { confirming, setConfirming, change, go, askDelete };
}

function RefSheet({ target, onClose, onChanged }: { target: RefTarget; onClose: () => void; onChanged: () => void }) {
  return target.kind === "campaign" ? <CampaignSheet target={target} onClose={onClose} onChanged={onChanged} /> : <GameSheet target={target} onClose={onClose} onChanged={onChanged} />;
}

function CampaignSheet({ target, onClose, onChanged }: { target: Extract<RefTarget, { kind: "campaign" }>; onClose: () => void; onChanged: () => void }) {
  const { catalog, user } = useDatabases();
  const { ref, archived } = target;
  const { id, line, save } = ref;
  const described = describe(line);
  const { confirming, setConfirming, change, go, askDelete } = useRefActions(described, onClose, onChanged);
  const keep = archived
    ? { label: "Restore" as const, onPress: () => change("Restored", () => restoreSave(user, id)) }
    : { label: "Archive" as const, onPress: () => change("Archived", () => archiveSave(user, id)) };
  function remove(): void {
    change("Deleted", () => {
      // An open scenario is a run that was never closed: it is recorded before the playthrough goes.
      if (save.active) recordUnclosedRun(catalog, user, id);
      deleteSave(user, id);
    });
  }
  return (
    <PaperSheet step={`${line.seats} · ${line.done} of ${line.total} completed`} title={line.name}>
      <View className="-mx-3 flex-row flex-wrap">
        <TextButton label="Open path" tone="ink" testID="ref-path" accessibilityLabel={`Path of ${described}`} onPress={() => go(pathHref(id))} />
        <TextButton label="Campaign log" tone="ink" testID="ref-log" accessibilityLabel={`Log of ${described}`} onPress={() => go({ pathname: "/log/[saveId]", params: { saveId: id } })} />
      </View>
      <KeepOrDelete paper id={id} described={described} sentence={DELETE_SENTENCE} keep={keep} confirming={confirming} onAskDelete={() => askDelete(DELETE_SENTENCE)} onDelete={remove} onKeep={() => setConfirming(false)} />
    </PaperSheet>
  );
}

function GameSheet({ target, onClose, onChanged }: { target: Extract<RefTarget, { kind: "standalone" }>; onClose: () => void; onChanged: () => void }) {
  const { user } = useDatabases();
  const { game, run, archived } = target;
  const scenario = scenarioName(game.scenarioId);
  const described = `${scenario}, ${gameCaption(game)}`;
  const playing = standaloneStatus(game) === "playing";
  const { confirming, setConfirming, change, go, askDelete } = useRefActions(described, onClose, onChanged);
  const keep = archived
    ? { label: "Restore" as const, onPress: () => change("Restored", () => restoreStandalone(user, game.id)) }
    : { label: "Archive" as const, onPress: () => change("Archived", () => archiveStandalone(user, game.id)) };
  return (
    <PaperSheet step={gameCaption(game)} title={scenario}>
      <View className="-mx-3 flex-row flex-wrap">
        {playing ? <TextButton label="Resume" tone="ink" testID="ref-resume" accessibilityLabel={`Resume ${described}`} onPress={() => go({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } })} /> : null}
        {!playing && run ? <TextButton label="Outcome" tone="ink" testID="ref-outcome" accessibilityLabel={`Outcome of ${described}`} onPress={() => go({ pathname: "/standalone/outcome/[gameId]", params: { gameId: game.id } })} /> : null}
        {!playing && game.loadout ? (
          <TextButton label="Play again" tone="ink" testID="ref-again" accessibilityLabel={`Play ${scenario} again`} onPress={() => go({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: game.scenarioId, from: game.id } })} />
        ) : null}
      </View>
      <KeepOrDelete paper id={game.id} described={described} sentence={DELETE_GAME} keep={keep} confirming={confirming} onAskDelete={() => askDelete(DELETE_GAME)} onDelete={() => change("Deleted", () => deleteStandalone(user, game.id))} onKeep={() => setConfirming(false)} />
    </PaperSheet>
  );
}
