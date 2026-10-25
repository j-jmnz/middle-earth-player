import { Text, View } from "react-native";

import type { NextStep } from "../campaign/path";
import { BodyText, Eyebrow, Label, Panel, PrimaryButton, RingMark, TextButton } from "./chrome";

// The campaign list's panels for one playthrough: its summary line and the Continue panel on top. Manage and Archived put
// KeepOrDelete (keep-or-delete.tsx) under the summary.

function ProgressLine({ done, total }: { done: number; total: number }) {
  return (
    <View className="mt-3 flex-row items-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <RingMark key={index} size={12} state={index < done ? "done" : index === done ? "current" : "locked"} />
      ))}
    </View>
  );
}

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep };

export function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

export function SaveSummary({ line, eyebrow, archived = false }: { line: SaveLine; eyebrow: boolean; archived?: boolean }) {
  return (
    <>
      {eyebrow ? <Eyebrow>Current</Eyebrow> : null}
      <Text className={`mt-1 font-display text-title ${archived ? "text-muted" : "text-bone"}`}>{line.name}</Text>
      <Label>{`${line.seats} · ${line.done} of ${line.total} completed`}</Label>
      <ProgressLine done={line.done} total={line.total} />
    </>
  );
}

// The sentence over the next step's button (the scenario on the table, the one to play next, or none left) and the button.
function nextWords(next: NextStep): { sentence: string; label: string } {
  if (next.kind === "resume") return { sentence: `On the table: ${next.node.name}`, label: "Resume" };
  if (next.kind === "begin") return { sentence: `Next: ${next.node.name}`, label: "Begin" };
  return { sentence: "Every scenario is won", label: "Open path" };
}

// The playthrough written last, on top of the list: what is next and the one tap that does it. Resume goes straight to the
// table, Begin to the briefing, and a finished campaign to its path. Path and Log sit under it. While the Start block is
// open it holds the screen's one primary, so the next step is a gold text button here instead.
export function ContinuePanel({
  id,
  line,
  eyebrow,
  primary,
  onNext,
  onPath,
  onLog,
}: {
  id: string;
  line: SaveLine;
  eyebrow: boolean;
  primary: boolean;
  onNext: () => void;
  onPath: () => void;
  onLog: () => void;
}) {
  const { sentence, label } = nextWords(line.next);
  const spoken = `${label}${line.next.kind === "finished" ? "" : ` ${line.next.node.name}`}, ${describe(line)}`;
  return (
    <View testID={`save-${id}`}>
      <Panel current>
        <SaveSummary line={line} eyebrow={eyebrow} />
        <BodyText testID="continue-next" className="mt-4">
          {sentence}
        </BodyText>
        {primary ? (
          <View className="mt-3">
            <PrimaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
          </View>
        ) : null}
        <View className="-mx-3 mt-2 flex-row">
          {!primary ? <TextButton label={label} testID="continue" tone="gold" accessibilityLabel={spoken} onPress={onNext} /> : null}
          {line.next.kind !== "finished" ? (
            <TextButton label="Path" testID="continue-path" tone="gold" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} />
          ) : null}
          <TextButton label="Log" testID="continue-log" tone="gold" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
        </View>
      </Panel>
    </View>
  );
}

export const DELETE_SENTENCE = "Delete this playthrough? Its log, pool and any open scenario are gone for good. Your decks stay.";
