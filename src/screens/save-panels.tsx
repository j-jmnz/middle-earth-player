import { Pressable, View } from "react-native";

import type { NextStep, PathNode } from "../campaign/path";
import { dropShadowOf, lapShadowOf, rowSurface } from "../play/surfaces";
import { withAlphaHex } from "../play/tokens";
import { useTheme } from "../play/theme";
import { useTableTokens } from "../play/use-table-tokens";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";
import { Portrait, type ArtCard } from "./art";
import { COVER } from "./art-crop";
import { HeroTile, type HeroFace } from "./hero-tile";
import { campaignRoad, type RoadState, type Walk } from "./campaign-road";
import { Chevron, Eyebrow, JourneyBar, Label, PrimaryButton, SecondaryButton, StepDiamond, TextButton, useAheadLine, useTitleShadow } from "./chrome";
import { usePalette } from "./palette-hook";
import { Text } from "../play/text";

// The campaign list's pieces for one playthrough (docs/design-system.md, Campaigns): the hero words over the current scenario's scene,
// the Continue panel (the campaign's road) under them, and a row for each other journey. Manage and Archived put KeepOrDelete
// (keep-or-delete.tsx) under the summary.

// One save as the list words it: campaign, seats and progress. Two playthroughs of one campaign differ only here, so every
// control on a save names it with this line.
// `path` is the campaign's scenarios as the path screen reads them.
export type SaveLine = { name: string; seats: string; done: number; total: number; next: NextStep; path: readonly PathNode[] };

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

// How far a fellowship painting laps over the one before it.
const OVERLAP = 10;

/**
 * The words over the current playthrough's scene: an overline with a short rule (Campaign and the seats), the campaign's name large,
 * and the fellowship as their paintings (`HeroTile`: the card's painting with its name and sphere, no ring), one row per seat, each
 * lapping a little over the right edge of the one before it and shadowing it. Hero titles carry a dark shadow on Dark; on Light the
 * words sit in a soft glow of the ground, so the overline reads over a dark scene.
 */
export function SaveHero({ line, seats }: { line: SaveLine; seats: readonly (readonly HeroFace[])[] }) {
  const t = useTableTokens();
  const palette = usePalette();
  const theme = useTheme();
  const { size, s, short } = useSizeClass();
  const shadow = useTitleShadow();
  const big = size === "compact" ? 38 : 60;
  const rows = seats.filter((seat) => seat.length > 0);
  // Two seats take two shorter, denser rows; a tight window (Large scale, a short phone) shorter tiles still, so the road's primary
  // stays on the first screen.
  const two = rows.length > 1;
  const tight = short || s > 1;
  const tile = (size === "compact" ? (two ? (tight ? 80 : 92) : tight ? 112 : 140) : two ? 130 : 180) * s;
  const slots = Math.max(3, ...rows.map((row) => row.length));
  const names = (row: readonly HeroFace[]) => row.map((hero) => hero.name).join(", ");
  const spoken = two ? rows.map((row, seat) => `Player ${seat + 1}: ${names(row)}`).join("; ") : names(rows[0] ?? []);
  return (
    <View>
      <View>
        {/* The glow is centred and reaches nothing at its box's edges, which stay inside the scroll's 8 pt bleed, so it has no edge. */}
        {theme === "light" ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: -8 * s, right: -8 * s, top: -28 * s, bottom: -24 * s, backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${withAlphaHex(palette.night, 0.78)} 0%, ${withAlphaHex(palette.night, 0.5)} 55%, ${withAlphaHex(palette.night, 0)} 100%)` }}
          />
        ) : null}
        <Eyebrow rule onArt>{`Campaign · ${line.seats}`}</Eyebrow>
        <Text testID="continue-campaign" accessibilityRole="header" className="mt-2 font-display text-bone" style={{ fontSize: big * s, lineHeight: big * 1.06 * s, ...shadow }}>
          {line.name}
        </Text>
      </View>
      {rows.length > 0 ? (
        <View className="mt-4" style={{ gap: 14 * s }} accessible accessibilityLabel={`Fellowship: ${spoken}`}>
          {rows.map((row, index) => (
            <View key={index} className="flex-row">
              {/* Each painting laps a little over the right edge of the one before it, so no hero's name (on its left) is covered, and
                  casts a shadow on it, so the row reads as cards laid one on another. */}
              {row.map((hero, at) => (
                <View key={`${hero.code}:${at}`} className="flex-1 flex-row" style={{ marginLeft: at === 0 ? 0 : -OVERLAP * s }}>
                  <HeroTile hero={hero} height={tile} crop={COVER} dense={two} shadow={at === 0 ? dropShadowOf(t, 10, 22, 0.8) : lapShadowOf(t)} />
                  {/* The lapping edge is lit, the way a panel's top is, so the stack reads apart over two dark paintings. */}
                  {at === 0 ? null : <View pointerEvents="none" className="absolute bottom-0 left-0 top-0 rounded-l-tile" style={{ width: 1.5 * s, backgroundColor: withAlphaHex(t.lit, 0.55) }} />}
                </View>
              ))}
              {/* A short row keeps its tiles the width of a full one. */}
              {Array.from({ length: slots - row.length }, (_, gap) => (
                <View key={`gap${gap}`} className="flex-1" style={{ marginLeft: -OVERLAP * s }} />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The road's line between two scenarios: solid where it has been walked, dashed ahead, nothing past either end. */
function RoadLine({ walk, height }: { walk: Walk; height?: number }) {
  const palette = usePalette();
  const ahead = useAheadLine();
  const size = height == null ? { flex: 1 } : { height };
  if (walk === "walked") return <View style={{ ...size, width: 2, backgroundColor: palette.accent }} />;
  if (walk === "ahead") return <View style={{ ...size, width: 0, borderLeftWidth: 2, borderStyle: "dashed", borderColor: ahead }} />;
  return <View style={size} />;
}

/** A scenario's stop on the road: the journey's step diamond, sized for the road. */
function RoadStop({ state }: { state: RoadState }) {
  const s = useUiScale();
  return (
    <View style={{ marginVertical: 3 * s }}>
      <StepDiamond state={state === "won" ? "done" : state === "here" ? "current" : "ahead"} size={state === "here" ? 13 : state === "won" ? 11 : 9} />
    </View>
  );
}

/**
 * The Continue panel under the hero words: the campaign's road on the ground, with no box round it. One stop per scenario in book
 * order on a line that is solid where walked: a won scenario's name with Won and its score; the one the next tap plays lit, with On
 * the table or Next over its name and the one tap that plays on (Resume goes straight to the table, Begin to the briefing); the rest
 * faint; the wins before the last fold into one line (campaign-road.ts). Once every scenario is won the road is all lit and Open path is the tap. Full
 * path and Campaign log are words at its foot.
 * While the Start block is open it holds the screen's one primary, so the next step is a plate here.
 */
export function ContinuePanel({ id, line, primary, onNext, onPath, onLog }: { id: string; line: SaveLine; primary: boolean; onNext: () => void; onPath: () => void; onLog: () => void }) {
  const { size, s } = useSizeClass();
  const { label, state } = nextWords(line.next);
  const spoken = `${label}${line.next.kind === "finished" ? "" : ` ${line.next.node.name}`}, ${describe(line)}`;
  const road = campaignRoad(line.path, line.next);
  const go = primary ? (
    <PrimaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  ) : (
    <SecondaryButton label={label} testID="continue" accessibilityLabel={spoken} onPress={onNext} />
  );
  // Outside a phone the primary keeps a plate's width rather than spanning the road's column.
  const plate = size === "compact" ? go : <View style={{ alignSelf: "flex-start", width: 320 * s }}>{go}</View>;
  const mark = (state: RoadState, into: Walk, out: Walk) => (
    <View className="items-center" style={{ width: 20 * s }}>
      <RoadLine walk={into} height={state === "here" ? 12 * s : undefined} />
      <RoadStop state={state} />
      <RoadLine walk={out} />
    </View>
  );
  const quietRow = (key: string, state: RoadState, into: Walk, out: Walk, name: string, tag: string | null, heard: string) => (
    <View key={key} className="flex-row" style={{ gap: 14 * s }} accessible accessibilityLabel={heard}>
      {mark(state, into, out)}
      <View className="min-w-0 flex-1 flex-row items-center justify-between gap-2" style={{ minHeight: 38 * s }}>
        <Text className={`min-w-0 flex-1 text-body ${state === "won" ? "text-muted" : "text-faint"}`} numberOfLines={1}>
          {name}
        </Text>
        {tag ? <Text className={`text-label ${state === "won" ? "text-ok" : "text-faint"}`}>{tag}</Text> : null}
      </View>
    </View>
  );
  const stops = road.stops.map((stop) => {
    if (stop.state !== "here") return quietRow(stop.node.id, stop.state, stop.into, stop.out, stop.node.name, stop.tag, stop.spoken);
    return (
      <View key={stop.node.id} className="flex-row" style={{ gap: 14 * s }}>
        {mark(stop.state, stop.into, stop.out)}
        <View className="min-w-0 flex-1" style={{ gap: 14 * s, paddingTop: 14 * s, paddingBottom: 18 * s }}>
          <View testID="continue-next" accessible accessibilityRole="header" accessibilityLabel={nextSummary(line.next)}>
            {/* A replayed won scenario keeps its score beside what the tap does. */}
            <Eyebrow tone="accent">{stop.tag ? `${state} · ${stop.tag}` : state}</Eyebrow>
            <Text className="mt-1 font-display text-bone" style={{ fontSize: 24 * s, lineHeight: 28 * s }}>
              {stop.node.name}
            </Text>
          </View>
          {plate}
        </View>
      </View>
    );
  });
  const { folded } = road;
  // The quiet words start where the road's names do: past the line's column, less the button's own inset.
  const words = { paddingLeft: (20 + 14 - 12) * s };
  return (
    <View testID={`save-${id}`}>
      {folded ? quietRow("won", "won", null, "walked", `${folded.count} won`, folded.score != null ? `Score ${folded.score}` : null, folded.spoken) : null}
      {stops}
      {line.next.kind === "finished" ? (
        <View style={{ gap: 12 * s, paddingTop: 12 * s }}>
          <Text testID="continue-next" accessibilityRole="header" className="text-body text-ok">
            {nextWords(line.next).name}
          </Text>
          {plate}
        </View>
      ) : null}
      <View className="flex-row" style={{ marginTop: 6 * s, gap: 8 * s, ...(line.next.kind === "finished" ? {} : words) }}>
        {line.next.kind !== "finished" ? <TextButton label="Full path" icon="oneRing" tone="accent" testID="continue-path" accessibilityLabel={`Path of ${describe(line)}`} onPress={onPath} /> : null}
        <TextButton label="Campaign log" icon="contract" tone="accent" testID="continue-log" accessibilityLabel={`Log of ${describe(line)}`} onPress={onLog} />
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
