// The campaign path's road (docs/design-system.md, Campaign path): one round stop per scenario, zig-zagging down the page, joined by
// segments drawn from centre to centre. A won stop has a lit ring and a solid lit segment behind it; the scenario to play is larger,
// ringed twice and glowing; a locked one is greyed under a veil, its segment dashed. Under each stop its name and a tag in small
// capitals: Won · score, Next, Locked, Coming soon (a scenario the app cannot deal yet: faint under the veil, not pressable). The stops are laid out here (`roadLayout`), the screen decides what a tap does.
import { Pressable, View } from "react-native";

import type { PathNode } from "../../campaign/path";
import { SceneArt } from "../art/art";
import { useAheadLine } from "../kit/chrome";
import { usePalette } from "../kit/palette-hook";
import { withAlphaHex } from "../../ui/tokens";
import { useUiScale } from "../../ui/ui-scale";
import { Text } from "../../ui/text";

const TAG = { completed: "Won", current: "Next", locked: "Locked", soon: "Coming soon" } as const;

/** Where the stops sit across the road, as fractions of its width: two columns on a phone, a wandering line on a wide screen. */
const NARROW = [0.27, 0.73];
const WIDE = [0.16, 0.4, 0.62, 0.78, 0.44, 0.18, 0.5, 0.82];

export type RoadStop = { node: PathNode; x: number; y: number; size: number };

/**
 * The stops' centres and sizes on a road `width` wide: `stop` and `current` are the diameters (72 and 104 on a phone). Each stop sits a
 * little over half its height plus its label below the last, so stops in alternating columns overlap vertically and the road reads as
 * one path. Returns the stops and the road's height.
 */
export function roadLayout(nodes: readonly PathNode[], width: number, stop: number, current: number, label: number, wide: boolean): { stops: RoadStop[]; height: number } {
  const columns = wide ? WIDE : NARROW;
  const stops: RoadStop[] = [];
  let top = 0;
  nodes.forEach((node, index) => {
    const size = node.status === "current" ? current : stop;
    const x = columns[index % columns.length]! * width;
    stops.push({ node, x, y: top + size / 2, size });
    top += (size + label) * (wide ? 0.55 : 0.62);
  });
  const last = stops[stops.length - 1];
  return { stops, height: last ? last.y + last.size / 2 + label : 0 };
}

/** A straight segment from one centre to another: solid and lit when the road has been walked, dashed otherwise. */
function Segment({ from, to, walked }: { from: RoadStop; to: RoadStop; walked: boolean }) {
  const palette = usePalette();
  const ahead = useAheadLine();
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - 1,
        width: length,
        height: 0,
        borderTopWidth: 2,
        borderStyle: walked ? "solid" : "dashed",
        borderColor: walked ? palette.accent : ahead,
        transform: [{ rotate: `${angle}deg` }],
        ...(walked ? { boxShadow: `0 0 8px ${withAlphaHex(palette.glow, 0.55)}` } : {}),
      }}
    />
  );
}

function stopRing(status: PathNode["status"], night: string, accent: string, high: string, line: string, glow: string): string {
  if (status === "completed") return `0 0 0 2px ${accent}, 0 0 0 5px ${night}`;
  if (status === "current") return `0 0 0 2px ${high}, 0 0 0 6px ${night}, 0 0 0 7px ${line}, 0 0 40px ${withAlphaHex(glow, 0.5)}`;
  return `0 0 0 1px ${line}`;
}

/**
 * The road: segments under the stops, each stop a round crop of its scenario's scene with its name and tag under it. `onStop` is the
 * tap on a stop (undefined for one that does nothing); `picked` rings the stop whose summary is open.
 */
export function Road({ stops, height, width, label, onStop, scores, go = null }: {
  stops: readonly RoadStop[];
  height: number;
  width: number;
  label: number;
  onStop: (node: PathNode) => (() => void) | undefined;
  scores: ReadonlyMap<string, string>;
  // The stop a tap begins or resumes the game from (the open scenario, else the next one), and what the tap does: the path has no
  // Begin or Resume button (user request, 2026-10-29), so this stop is `begin` to the flows and says its action to a screen reader.
  go?: { id: string; action: string } | null;
}) {
  const palette = usePalette();
  const s = useUiScale();
  return (
    <View style={{ width, height }} testID="path-road">
      {stops.slice(1).map((stop, index) => (
        <Segment key={`seg-${stop.node.id}`} from={stops[index]!} to={stop} walked={stops[index]!.node.status === "completed" && stop.node.status !== "locked" && stop.node.status !== "soon"} />
      ))}
      {stops.map((stop) => {
        const { node, size } = stop;
        const press = onStop(node);
        const tag = node.status === "completed" ? `${TAG.completed}${scores.get(node.id) ? ` · ${scores.get(node.id)}` : ""}` : TAG[node.status];
        const tone = node.status === "completed" ? palette.ok : node.status === "current" ? palette.accentHigh : palette.faint;
        const labelWidth = Math.min(width * 0.46, 200 * s);
        return (
          <View key={node.id} testID={`node-${node.id}`} style={{ position: "absolute", left: stop.x - labelWidth / 2, top: stop.y - size / 2, width: labelWidth, alignItems: "center" }}>
            <Pressable
              accessibilityRole={press ? "button" : undefined}
              accessibilityLabel={`${node.name}, ${tag}`}
              accessibilityHint={go?.id === node.id ? go.action : undefined}
              disabled={!press}
              onPress={press}
              testID={go?.id === node.id ? "begin" : `stop-${node.id}`}
            >
              <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: palette.raised, boxShadow: stopRing(node.status, palette.night, palette.accent, palette.accentHigh, palette.accentLine, palette.glow) }}>
                <SceneArt scenarioId={node.id} width={size} height={size} />
                {node.status === "locked" || node.status === "soon" ? <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: withAlphaHex(palette.night, 0.62) }} /> : null}
              </View>
            </Pressable>
            <View importantForAccessibility="no-hide-descendants" style={{ minHeight: label, alignItems: "center", paddingTop: 8 * s }}>
              <Text className="text-center font-display" style={{ fontSize: 15 * s, lineHeight: 18 * s, color: node.status === "locked" || node.status === "soon" ? palette.faint : palette.bone }} numberOfLines={2}>
                {node.name}
              </Text>
              <Text testID={`node-${node.id}-status`} className="mt-1 font-bold uppercase" style={{ fontSize: 11 * s, lineHeight: 14 * s, letterSpacing: 1.6 * s, color: tone }}>
                {tag}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
