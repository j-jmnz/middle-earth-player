import { Pressable, View } from "react-native";

import type { NextStep } from "../campaign/path";
import { rowSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { useSizeClass } from "../play/use-size-class";
import { Portrait, type ArtCard } from "./art";
import { Chevron, Eyebrow, JourneyBar, Label, Panel, PrimaryButton, SecondaryButton, useTitleShadow } from "./chrome";
import { usePalette } from "./palette-hook";
import { Text } from "../play/text";

// The campaign list's pieces for one playthrough (docs/design-system.md, Campaigns): the hero words over the current scenario's scene,
// the Continue panel under them, and a row for each other journey. Manage and Archived put KeepOrDelete (keep-or-delete.tsx) under the
// summary.

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep };

/** A hero of the fellowship as the panels show it: the face, the name, and the sphere colour of its ring (none for a neutral hero). */
export type PartyHero = { card: ArtCard; name: string; tint?: string };

export function describe(line: SaveLine): string {
  return `${line.name}, ${line.seats}, ${line.done} of ${line.total} completed`;
}

/** The campaign's name, its seats and progress in words, and the journey track: a playthrough being managed or archived. */
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

// The next step's name and its button: the scenario on the table, the one to play next, or none left.
function nextWords(next: NextStep): { name: string; label: string; state: string } {
  if (next.kind === "resume") return { name: next.node.name, label: "Resume", state: "On the table" };
  if (next.kind === "begin") return { name: next.node.name, label: "Begin", state: "Next" };
  return { name: "Every scenario is won", label: "Open path", state: "Completed" };
}

/**
 * The words over the current playthrough's scene: an overline with a short rule (the campaign, and which scenario of how many), the
 * next scenario's name large, and a line of what is known about the playthrough. Hero titles carry a dark shadow on Dark.
 */
export function SaveHero({ line, party }: { line: SaveLine; party: string | null }) {
  const { size, s } = useSizeClass();
  const shadow = useTitleShadow();
  const { name, state } = nextWords(line.next);
  const number = line.next.kind === "finished" ? null : line.next.node.number;
  const big = size === "compact" ? 42 : size === "medium" ? 62 : 64;
  return (
    <View>
      <Eyebrow rule>{number ? `${line.name} · ${number} of ${line.total}` : `${line.name} · ${state}`}</Eyebrow>
      <Text
        testID="continue-next"
        accessibilityRole="header"
        className="mt-2 font-display text-bone"
        style={{ fontSize: big * s, lineHeight: (size === "compact" ? 42 : 62) * s, ...shadow }}
      >
        {name}
      </Text>
      <Text className="mt-2 text-body text-muted" style={size === "compact" ? undefined : { fontSize: 17 * s, lineHeight: 24 * s }}>
        {[line.seats, line.next.kind === "resume" ? "On the table" : null, party].filter((part): part is string => part != null).join(" · ")}
      </Text>
    </View>
  );
}

/** A hero's face in its sphere's ring with the name beside it: the fellowship in the Continue panel. */
function HeroChip({ hero, full }: { hero: PartyHero; full: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <Portrait card={hero.card} size={34} tint={hero.tint} />
      <Text className="text-label text-bone" numberOfLines={full ? 2 : 1} style={full ? { maxWidth: 70 } : undefined}>
        {full ? hero.name : (hero.name.split(" ")[0] ?? hero.name)}
      </Text>
    </View>
  );
}

/**
 * The Continue panel under the hero words: the fellowship's faces, the journey track and its count, and the one tap that plays on
 * (Begin, Resume, or Open path once every scenario is won) with Path and Log as square icon plates beside it. Resume goes straight to
 * the table, Begin to the briefing. While the Start block is open it holds the screen's one primary, so the next step is a plate here.
 * `wide` lays it in one row (a tablet in landscape): faces and track on the left, the buttons on the right.
 */
export function ContinuePanel({
  id,
  line,
  primary,
  heroes,
  onNext,
  onPath,
  onLog,
  wide = false,
}: {
  id: string;
  line: SaveLine;
  primary: boolean;
  // The fellowship's heroes, when the campaign has recorded them or a loadout names them.
  heroes: readonly PartyHero[];
  onNext: () => void;
  onPath: () => void;
  onLog: () => void;
  wide?: boolean;
}) {
  const { s } = useSizeClass();
  const { label } = nextWords(line.next);
  const spoken = `${label}${line.next.kind === "finished" ? "" : ` ${line.next.node.name}`}, ${describe(line)}`;
  const faces =
    heroes.length > 0 ? (
      <View className="flex-row flex-wrap items-center" style={{ gap: (wide ? 16 : 12) * s }} accessible accessibilityLabel={`Fellowship: ${heroes.map((hero) => hero.name).join(", ")}`}>
        {heroes.map((hero, index) => (
          <HeroChip key={`${hero.card.code}:${index}`} hero={hero} full={wide} />
        ))}
      </View>
    ) : null;
  const track = (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <JourneyBar total={line.total} done={line.done} current={line.next.kind !== "finished"} />
      </View>
      <Label>{`${line.done} of ${line.total}`}</Label>
    </View>
  );
  const go = primary ? (
    <PrimaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  ) : (
    <SecondaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  );
  const plates = (
    <>
      {line.next.kind !== "finished" ? <SecondaryButton label="Path" icon="oneRing" iconOnly testID="continue-path" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} /> : null}
      <SecondaryButton label="Log" icon="contract" iconOnly testID="continue-log" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
    </>
  );
  return (
    <View testID={`save-${id}`}>
      <Panel>
        {wide ? (
          <View className="flex-row items-center" style={{ gap: 20 * s }}>
            <View className="min-w-0 flex-1" style={{ gap: 14 * s }}>
              {faces}
              {track}
            </View>
            <View className="flex-row items-center" style={{ gap: 10 * s }}>
              {plates}
              <View style={{ width: 180 * s }}>{go}</View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 14 * s }}>
            {faces}
            {track}
            <View className="flex-row" style={{ gap: 10 * s }}>
              <View className="flex-1">{go}</View>
              {plates}
            </View>
          </View>
        )}
      </Panel>
    </View>
  );
}

/** Another open playthrough: one 62 pt row that opens its path, with the fellowship's first face, its name and what is next. */
export function SaveRow({ id, line, lead, onPress }: { id: string; line: SaveLine; lead: PartyHero | null; onPress: () => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const { s } = useSizeClass();
  const next = nextSummary(line.next);
  return (
    <Pressable testID={`save-${id}`} collapsable={false} accessibilityRole="button" accessibilityLabel={`Open ${describe(line)}`} onPress={onPress}>
      {({ pressed }) => (
        <View className="flex-row items-center gap-3 rounded-tile px-3" style={{ minHeight: 62 * s, ...rowSurface(pressed, t) }}>
          {lead ? <Portrait card={lead.card} size={36} tint={lead.tint} glow={false} /> : null}
          <View className="min-w-0 flex-1">
            <Text className="font-display text-heading text-bone" numberOfLines={1}>
              {line.name}
            </Text>
            <Text className="text-label text-muted" numberOfLines={1}>{`${line.seats} · ${next}`}</Text>
          </View>
          <Chevron direction="right" color={palette.faint} size={8} />
        </View>
      )}
    </Pressable>
  );
}

export const DELETE_SENTENCE = "Delete this playthrough? Its log, pool and any open scenario are gone for good. Your decks stay.";
