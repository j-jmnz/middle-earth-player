// The sheet a playthrough's or a game's ⋯ opens in History (docs/design-system.md, History): the way out is its one primary (a
// playthrough's path; a game's table, outcome or Play again), the other ways out and what keeps it or ends it (Archive or Restore, and
// Delete, asked twice in place) are centred text buttons under it. Each change is announced, refreshes the list and closes the sheet;
// a way out closes it and then goes.
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { AccessibilityInfo, View } from "react-native";

import type { RunRecord } from "../campaign/runs";
import { standaloneStatus, type ListedStandalone } from "../campaign/standalone";
import { scenarioName } from "./campaign-data";
import { archiveSave, deleteSave, restoreSave } from "./campaign-store";
import { PaperSheet, PrimaryButton, TextButton } from "./chrome";
import { useDatabases } from "./databases";
import type { LibrarySave } from "./history-read";
import { KeepOrDelete } from "./keep-or-delete";
import { pathHref } from "./scenario-links";
import { DELETE_SENTENCE, describe } from "./save-line";
import { SheetModal } from "./sheet-modal";
import { archiveStandalone, deleteStandalone, restoreStandalone } from "./standalone-store";
import { gameCaption } from "./standalone-words";
import { recordUnclosedRun } from "./table-session";

/** What a sheet is opened on: a playthrough, or a game with the run it wrote (if any). */
export type RefTarget = { kind: "campaign"; ref: LibrarySave; archived: boolean } | { kind: "standalone"; game: ListedStandalone; run: RunRecord | null; archived: boolean };

const DELETE_GAME = "Delete this game? It is gone for good. Your decks stay.";

export function HistorySheet({ target, onClose, onChanged }: { target: RefTarget | null; onClose: () => void; onChanged: () => void }) {
  // The last target stays rendered while the sheet closes, so its fade does not show an empty scrim. Each opening is its own sheet, so a
  // delete that was asked is not carried to the next time.
  const [shown, setShown] = useState<{ target: RefTarget; opening: number } | null>(null);
  if (target && shown?.target !== target) setShown({ target, opening: (shown?.opening ?? 0) + 1 });
  return (
    <SheetModal visible={target != null} onRequestClose={onClose} scrimLabel="Close actions">
      {shown ? <RefSheet key={shown.opening} target={shown.target} onClose={onClose} onChanged={onChanged} /> : null}
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
      <PrimaryButton label="Open path" surface="paper" testID="ref-path" accessibilityLabel={`Path of ${described}`} onPress={() => go(pathHref(id))} />
      <View className="mt-2 flex-row justify-center">
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
  const table = () => go({ pathname: "/standalone/table/[gameId]", params: { gameId: game.id } });
  const outcome = () => go({ pathname: "/standalone/outcome/[gameId]", params: { gameId: game.id } });
  const again = () => go({ pathname: "/standalone/briefing/[scenarioId]", params: { scenarioId: game.scenarioId, from: game.id } });
  const playAgain = { label: "Play again", testID: "ref-again", accessibilityLabel: `Play ${scenario} again`, onPress: again };
  // The one primary is the way the game goes on: its table while it is playing, else its outcome, else dealing it again.
  const primary = playing
    ? { label: "Resume", testID: "ref-resume", accessibilityLabel: `Resume ${described}`, onPress: table }
    : run
      ? { label: "Outcome", testID: "ref-outcome", accessibilityLabel: `Outcome of ${described}`, onPress: outcome }
      : game.loadout
        ? playAgain
        : null;
  const second = !playing && run && game.loadout ? playAgain : null;
  return (
    <PaperSheet step={gameCaption(game)} title={scenario}>
      {primary ? <PrimaryButton label={primary.label} surface="paper" testID={primary.testID} accessibilityLabel={primary.accessibilityLabel} onPress={primary.onPress} /> : null}
      {second ? (
        <View className="mt-2 flex-row justify-center">
          <TextButton label={second.label} tone="ink" testID={second.testID} accessibilityLabel={second.accessibilityLabel} onPress={second.onPress} />
        </View>
      ) : null}
      <KeepOrDelete paper id={game.id} described={described} sentence={DELETE_GAME} keep={keep} confirming={confirming} onAskDelete={() => askDelete(DELETE_GAME)} onDelete={() => change("Deleted", () => deleteStandalone(user, game.id))} onKeep={() => setConfirming(false)} />
    </PaperSheet>
  );
}
