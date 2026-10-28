import { Pressable, Text, View } from "react-native";

import type { NextStep } from "../campaign/path";
import { tileSurface } from "../play/surfaces";
import { PortraitRow, SceneCard, type ArtCard } from "./art";
import { Chevron, Chip, Eyebrow, JourneyBar, Label, PrimaryButton, SecondaryButton } from "./chrome";
import { palette } from "./palette.js";

// The campaign list's panels for one playthrough: its summary and the Continue card on top. Manage and Archived put
// KeepOrDelete (keep-or-delete.tsx) under the summary.

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep };

export function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

/** The campaign's name, its seats and progress in words, and the journey bar. */
export function SaveSummary({ line, eyebrow, archived = false }: { line: SaveLine; eyebrow: boolean; archived?: boolean }) {
  return (
    <>
      {eyebrow ? <Eyebrow>Current</Eyebrow> : null}
      <Text className={`mt-1 font-display text-title ${archived ? "text-muted" : "text-bone"}`}>{line.name}</Text>
      <Label>{`${line.seats} · ${line.done} of ${line.total} completed`}</Label>
      <View className="mt-3">
        <JourneyBar total={line.total} done={line.done} current={line.next.kind !== "finished"} />
      </View>
    </>
  );
}

/** "Next: A Knife in the Dark", "On the table: ...", or "Every scenario is won": the next step in one phrase (a row, a folded header). */
export function nextSummary(next: NextStep): string {
  return next.kind === "finished" ? "Every scenario is won" : `${next.kind === "resume" ? "On the table" : "Next"}: ${next.node.name}`;
}

// The sentence of the next step (the scenario on the table, the one to play next, or none left), its lead-in, and the button.
function nextWords(next: NextStep): { lead: string; name: string; label: string } {
  if (next.kind === "resume") return { lead: "On the table: ", name: next.node.name, label: "Resume" };
  if (next.kind === "begin") return { lead: "Next: ", name: next.node.name, label: "Begin" };
  return { lead: "", name: "Every scenario is won", label: "Open path" };
}

const ART_HEIGHT = 196;

/**
 * The playthrough written last, on top of the list, framed in gold: the next scenario's scene, its name, the fellowship that
 * plays it, the journey so far, and the one tap that does it. Resume goes straight to the table, Begin to the briefing, and a
 * finished campaign to its path. Path and Log sit under it. While the Start block is open it holds the screen's one primary,
 * so the next step is a plate here instead.
 */
export function ContinuePanel({
  id,
  line,
  eyebrow,
  primary,
  heroes,
  party,
  onNext,
  onPath,
  onLog,
}: {
  id: string;
  line: SaveLine;
  eyebrow: boolean;
  primary: boolean;
  // The fellowship's heroes, when the campaign has recorded them or a loadout names them; their names in words.
  heroes: readonly ArtCard[];
  party: string | null;
  onNext: () => void;
  onPath: () => void;
  onLog: () => void;
}) {
  const { lead, name, label } = nextWords(line.next);
  const spoken = `${label}${line.next.kind === "finished" ? "" : ` ${line.next.node.name}`}, ${describe(line)}`;
  const scenarioId = line.next.kind === "finished" ? null : line.next.node.id;
  const number = line.next.kind === "finished" ? null : line.next.node.number;
  return (
    <View testID={`save-${id}`}>
      <SceneCard
        scenarioId={scenarioId}
        sceneHeight={ART_HEIGHT}
        pullUp={44}
        hero
        over={
          <View className="absolute left-4 right-4 top-3 flex-row items-center justify-between">
            <Chip label={line.seats} onArt />
            {number ? <Chip tone="gold" onArt label={`Scenario ${number} of ${line.total}`} /> : <Chip tone="gold" onArt label="Completed" />}
          </View>
        }
      >
        <View className="px-5 pb-5">
          <View className="flex-row items-center gap-2">
            <Eyebrow>{line.name}</Eyebrow>
            {eyebrow ? <Chip tone="faint" label="Current" /> : null}
          </View>
          <Text testID="continue-next" className="mt-1.5 font-display text-title text-bone">
            {lead ? <Text className="text-heading text-moon">{lead}</Text> : null}
            {name}
          </Text>
          {heroes.length > 0 ? (
            <View className="mt-3 flex-row items-center gap-3">
              <PortraitRow heroes={heroes} size={38} />
              {party ? (
                <Text className="flex-1 text-label text-bone" numberOfLines={2}>
                  {party}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View className="mt-4">
            <JourneyBar total={line.total} done={line.done} current={line.next.kind !== "finished"} />
            <View className="mt-1.5 flex-row justify-between">
              <Label>Journey</Label>
              <Label>{`${line.done} of ${line.total} completed`}</Label>
            </View>
          </View>
          {primary ? (
            <View className="mt-4">
              <PrimaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
            </View>
          ) : null}
          <View className="mt-2.5 flex-row gap-2.5">
            {!primary ? (
              <View className="flex-1">
                <SecondaryButton label={label} testID="continue" tone="gold" compact accessibilityLabel={spoken} onPress={onNext} />
              </View>
            ) : null}
            {line.next.kind !== "finished" ? (
              <View className="flex-1">
                <SecondaryButton label="Path" icon="oneRing" testID="continue-path" compact accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} />
              </View>
            ) : null}
            <View className="flex-1">
              <SecondaryButton label="Log" icon="lore" testID="continue-log" compact accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
            </View>
          </View>
        </View>
      </SceneCard>
    </View>
  );
}

/** Another open playthrough: one row that opens its path, with the fellowship's first face, what is next and the journey. */
export function SaveRow({ id, line, lead, onPress }: { id: string; line: SaveLine; lead: ArtCard | null; onPress: () => void }) {
  const next = nextSummary(line.next);
  return (
    <Pressable testID={`save-${id}`} collapsable={false} accessibilityRole="button" accessibilityLabel={`Open ${describe(line)}`} onPress={onPress}>
      {({ pressed }) => (
        <View className="flex-row items-center gap-3.5 rounded-card px-4 py-3.5" style={tileSurface(pressed)}>
          {lead ? <PortraitRow heroes={[lead]} size={44} /> : null}
          <View className="flex-1">
            <Text className="font-display text-heading text-bone" numberOfLines={1}>
              {line.name}
            </Text>
            <Text className="text-label text-muted" numberOfLines={1}>{`${line.seats} · ${next}`}</Text>
            <View className="mt-2">
              <JourneyBar total={line.total} done={line.done} current={line.next.kind !== "finished"} />
            </View>
          </View>
          <Chevron direction="right" color={palette.faint} size={8} />
        </View>
      )}
    </Pressable>
  );
}

export const DELETE_SENTENCE = "Delete this playthrough? Its log, pool and any open scenario are gone for good. Your decks stay.";
