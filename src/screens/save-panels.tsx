import { Pressable, View } from "react-native";

import type { NextStep, PathNode } from "../campaign/path";
import { GameIcon } from "../play/game-icon";
import type { IconName } from "../play/icon-map";
import { rowSurface } from "../play/surfaces";
import { withAlphaHex } from "../play/tokens";
import { useTableTokens } from "../play/use-table-tokens";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";
import { Portrait, type ArtCard } from "./art";
import { Chevron, Eyebrow, JourneyBar, Label, PrimaryButton, SecondaryButton, useTitleShadow } from "./chrome";
import { usePalette } from "./palette-hook";
import { Text } from "../play/text";

// The campaign list's pieces for one playthrough (docs/design-system.md, Campaigns): the hero words over the current scenario's scene,
// the Continue panel (the campaign's road) under them, and a row for each other journey. Manage and Archived put KeepOrDelete
// (keep-or-delete.tsx) under the summary.

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
// `path` is the campaign's scenarios as the path screen reads them and `score` the campaign total (lower is better).
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep; path: readonly PathNode[]; score: number };

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

// The next step's name, its button and the tag over it on the road: the scenario on the table, the one to play next, or none left.
function nextWords(next: NextStep): { name: string; label: string; state: string } {
  if (next.kind === "resume") return { name: next.node.name, label: "Resume", state: "On the table" };
  if (next.kind === "begin") return { name: next.node.name, label: "Begin", state: "Next" };
  return { name: "Every scenario is won", label: "Open path", state: "Completed" };
}

/**
 * The words over the current playthrough's scene: an overline with a short rule (Campaign and the seats), the campaign's name large,
 * and the fellowship's faces in their sphere rings with their names. Hero titles carry a dark shadow on Dark.
 */
export function SaveHero({ line, heroes }: { line: SaveLine; heroes: readonly PartyHero[] }) {
  const palette = usePalette();
  const { size, s } = useSizeClass();
  const shadow = useTitleShadow();
  const big = size === "compact" ? 38 : 60;
  const names = heroes.map((hero) => hero.name).join(", ");
  return (
    <View>
      <Eyebrow rule onArt>{`Campaign · ${line.seats}`}</Eyebrow>
      <Text testID="continue-campaign" accessibilityRole="header" className="mt-2 font-display text-bone" style={{ fontSize: big * s, lineHeight: big * 1.06 * s, ...shadow }}>
        {line.name}
      </Text>
      {heroes.length > 0 ? (
        <View className="mt-3 flex-row items-center" style={{ gap: 12 * s }} accessible accessibilityLabel={`Fellowship: ${names}`}>
          <View className="flex-row">
            {heroes.map((hero, index) => (
              <View key={`${hero.card.code}:${index}`} style={{ marginLeft: index === 0 ? 0 : -8 * s, borderRadius: 999, borderWidth: 2, borderColor: palette.night }}>
                <Portrait card={hero.card} size={40} tint={hero.tint} />
              </View>
            ))}
          </View>
          <Text className="min-w-0 flex-1 text-body text-muted" numberOfLines={2}>
            {names}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// How the road reaches a scenario: won, the one the next tap plays, or still ahead.
type RoadState = "won" | "here" | "ahead";

/** The road's line between two scenarios: solid where it has been walked, dashed ahead, nothing past either end. */
function RoadLine({ walk, height }: { walk: "walked" | "ahead" | null; height?: number }) {
  const palette = usePalette();
  const size = height == null ? { flex: 1 } : { height };
  if (walk === "walked") return <View style={{ ...size, width: 2, backgroundColor: palette.accent }} />;
  if (walk === "ahead") return <View style={{ ...size, width: 0, borderLeftWidth: 2, borderStyle: "dashed", borderColor: palette.hairline }} />;
  return <View style={size} />;
}

/** A scenario's stop on the road: a filled diamond when won, an outlined one with a glow for the one to play, a small dark one ahead. */
function RoadStop({ state }: { state: RoadState }) {
  const palette = usePalette();
  const s = useUiScale();
  const size = (state === "here" ? 13 : state === "won" ? 11 : 9) * s;
  return (
    <View
      style={{
        width: size,
        height: size,
        marginVertical: 3 * s,
        transform: [{ rotate: "45deg" }],
        backgroundColor: state === "won" ? palette.accent : state === "here" ? palette.night : palette.raised,
        ...(state === "won" ? {} : { borderWidth: state === "here" ? 2 : 1.5, borderColor: state === "here" ? palette.accentHigh : withAlphaHex(palette.faint, 0.7) }),
        ...(state === "here" ? { boxShadow: `0 0 12px ${withAlphaHex(palette.glow, 0.65)}` } : {}),
      }}
    />
  );
}

/** One of the two quiet buttons under the road: its printed icon and its word in the accent, no plate. */
function FootButton({ label, icon, testID, accessibilityLabel, onPress }: { label: string; icon: IconName; testID: string; accessibilityLabel: string; onPress: () => void }) {
  const palette = usePalette();
  const s = useUiScale();
  return (
    <Pressable testID={testID} collapsable={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {({ pressed }) => (
        <View className="min-h-touch flex-row items-center gap-2 rounded-tile px-2" style={pressed ? { backgroundColor: palette.pressed } : undefined}>
          <GameIcon name={icon} size={16 * s} tint="accent" />
          <Text className="font-display" style={{ fontSize: 15 * s, lineHeight: 19 * s, letterSpacing: 1 * s, color: palette.accent }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The Continue panel under the hero words: the campaign's road on the ground, with no box round it. One stop per scenario in book
 * order on a line that is solid where walked: a won scenario's name with Won and its score; the one the next tap plays lit, with On
 * the table or Next over its name and the one tap that plays on (Resume goes straight to the table, Begin to the briefing); the rest
 * faint. Once every scenario is won the road is all lit and Open path is the tap. Full path and Campaign log are words at its foot.
 * While the Start block is open it holds the screen's one primary, so the next step is a plate here.
 */
export function ContinuePanel({ id, line, primary, onNext, onPath, onLog }: { id: string; line: SaveLine; primary: boolean; onNext: () => void; onPath: () => void; onLog: () => void }) {
  const { s } = useSizeClass();
  const { label, state } = nextWords(line.next);
  const spoken = `${label}${line.next.kind === "finished" ? "" : ` ${line.next.node.name}`}, ${describe(line)}`;
  const here = line.next.kind === "finished" ? null : line.next.node.id;
  const stateOf = (node: PathNode): RoadState => (node.id === here ? "here" : node.status === "completed" ? "won" : "ahead");
  // The line into a stop is walked once the road has reached that stop.
  const walkInto = (index: number) => (index === 0 ? null : stateOf(line.path[index]!) === "ahead" ? "ahead" : "walked");
  const walkOut = (index: number) => (index === line.path.length - 1 ? null : walkInto(index + 1));
  const go = primary ? (
    <PrimaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  ) : (
    <SecondaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  );
  const stops = line.path.map((node, index) => {
    const road = stateOf(node);
    const mark = (
      <View className="items-center" style={{ width: 20 * s }}>
        <RoadLine walk={walkInto(index)} height={road === "here" ? 20 * s : undefined} />
        <RoadStop state={road} />
        <RoadLine walk={walkOut(index)} />
      </View>
    );
    if (road === "here") {
      return (
        <View key={node.id} className="flex-row" style={{ gap: 14 * s }}>
          {mark}
          <View className="min-w-0 flex-1" style={{ gap: 14 * s, paddingTop: 14 * s, paddingBottom: 18 * s }}>
            <View testID="continue-next" accessible accessibilityRole="header" accessibilityLabel={nextSummary(line.next)}>
              <Eyebrow tone="accent">{state}</Eyebrow>
              <Text className="mt-1 font-display text-bone" style={{ fontSize: 24 * s, lineHeight: 28 * s }}>
                {node.name}
              </Text>
            </View>
            {go}
          </View>
        </View>
      );
    }
    const won = road === "won";
    return (
      <View
        key={node.id}
        className="flex-row"
        style={{ gap: 14 * s }}
        accessible
        accessibilityLabel={`${node.name}, ${won ? `won${node.score != null ? `, score ${node.score}` : ""}` : "not reached"}`}
      >
        {mark}
        <View className="min-w-0 flex-1 flex-row items-center justify-between gap-2" style={{ minHeight: 38 * s }}>
          <Text className={`min-w-0 flex-1 text-body ${won ? "text-muted" : "text-faint"}`} numberOfLines={1}>
            {node.name}
          </Text>
          {won ? <Text className="text-label text-ok">{node.score != null ? `Won · ${node.score}` : "Won"}</Text> : null}
        </View>
      </View>
    );
  });
  return (
    <View testID={`save-${id}`}>
      {stops}
      {line.next.kind === "finished" ? (
        <View style={{ gap: 12 * s, paddingTop: 12 * s }}>
          <Text testID="continue-next" accessibilityRole="header" className="text-body text-ok">
            {nextWords(line.next).name}
          </Text>
          {go}
        </View>
      ) : null}
      <View className="flex-row" style={{ marginTop: 6 * s, gap: 8 * s }}>
        {line.next.kind !== "finished" ? <FootButton label="Full path" icon="oneRing" testID="continue-path" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} /> : null}
        <FootButton label="Campaign log" icon="contract" testID="continue-log" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
      </View>
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
