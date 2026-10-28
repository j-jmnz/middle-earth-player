// The chrome's marks and status (docs/design-system.md, Components): chevrons, the gold corners of a framed card, the Ring, tags,
// journey and progress bars, the sphere mark. Views and text only; re-exported by chrome.tsx.
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import { SPHERE_TINT } from "../play/icon-map";
import { goldSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { withAlphaHex } from "../play/tokens";
import { palettes, type Palette } from "./palette.js";
import type { MarkedSphere } from "./sphere-mark";

/** A chevron drawn as views (no printed icon fits), pointing left for Back, right for a row that opens, down for a fold that is open. */
export function Chevron({ direction = "left", color, size = 10 }: { direction?: "left" | "right" | "down"; color?: string; size?: number }) {
  const palette = usePalette();
  return (
    <View
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color ?? palette.bone,
        transform:
          direction === "down"
            ? [{ translateY: -size * 0.2 }, { rotate: "-45deg" }]
            : [{ translateX: direction === "left" ? size * 0.2 : -size * 0.2 }, { rotate: direction === "left" ? "45deg" : "-135deg" }],
      }}
    />
  );
}

/** Four small gold diamonds on the corners of a framed thing: the current panel, the scenario to play, the fellowship chosen. */
export function Corners() {
  const palette = usePalette();
  const at = [
    { left: -4, top: -4 },
    { right: -4, top: -4 },
    { left: -4, bottom: -4 },
    { right: -4, bottom: -4 },
  ];
  return (
    <>
      {at.map((place, index) => (
        <View key={index} pointerEvents="none" importantForAccessibility="no" style={{ position: "absolute", width: 7, height: 7, backgroundColor: palette.gold, transform: [{ rotate: "45deg" }], ...place }} />
      ))}
    </>
  );
}

/** The Ring. Current node, app mark, completion. Never decorative filler. */
export function RingMark({ size = 18, state = "current" }: { size?: number; state?: "current" | "done" | "locked" }) {
  const palette = usePalette();
  const t = useTableTokens();
  if (state === "done") {
    return <View style={{ width: size, height: size, borderRadius: size / 2, ...goldSurface(false, t) }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: state === "locked" ? 1.5 : Math.max(2, size / 9),
        borderColor: state === "locked" ? palette.hairline : palette.gold,
      }}
    />
  );
}

/** A magnifying glass drawn as views (no printed icon fits), for a search field. */
export function Magnifier({ color }: { color: string }) {
  return (
    <View importantForAccessibility="no" style={{ width: 16, height: 16 }}>
      <View style={{ position: "absolute", left: 0, top: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 1.75, borderColor: color }} />
      <View style={{ position: "absolute", left: 10, top: 11, width: 6, height: 1.75, borderRadius: 1, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

const chipTonesOf = (palette: Palette) => ({
  neutral: { fill: withAlphaHex(palette.bone, 0.06), edge: withAlphaHex(palette.bone, 0.1), text: palette.bone },
  gold: { fill: withAlphaHex(palette.gold, 0.14), edge: withAlphaHex(palette.gold, 0.38), text: palette.goldHigh },
  danger: { fill: withAlphaHex(palette.threat, 0.16), edge: withAlphaHex(palette.threat, 0.45), text: palette.danger },
  ok: { fill: withAlphaHex(palette.ok, 0.12), edge: withAlphaHex(palette.ok, 0.35), text: palette.ok },
  faint: { fill: "transparent", edge: palette.hairline, text: palette.faint },
});
// Built once per theme, not per Chip.
const chipTones = { dark: chipTonesOf(palettes.dark), light: chipTonesOf(palettes.light) };
const chipTonesFor = (palette: Palette) => (palette === palettes.light ? chipTones.light : chipTones.dark);

/** A small tag: a status, a reward, a rule. Words always, a mark beside them at most; colour is never the only signal. */
export function Chip({ label, tone = "neutral", leading, testID, onArt = false }: { label: string; tone?: keyof typeof chipTones.dark; leading?: ReactNode; testID?: string; onArt?: boolean }) {
  const palette = usePalette();
  const look = chipTonesFor(palette)[tone];
  // Over a picture the tag sits on night first, so its words read over a bright sky.
  return (
    <View className="h-7 flex-row items-center gap-1.5 rounded-chip px-2.5" style={{ backgroundColor: onArt ? withAlphaHex(palette.night, 0.72) : look.fill, borderWidth: 1, borderColor: look.edge }}>
      {leading}
      <Text testID={testID} numberOfLines={1} className="text-label font-semibold" style={{ color: look.text }}>
        {label}
      </Text>
    </View>
  );
}

/** A journey of steps as one segmented bar: gold for the steps done, a lit gold for the current one, night for the rest. */
export function JourneyBar({ total, done, current = done < total, testID }: { total: number; done: number; current?: boolean; testID?: string }) {
  const palette = usePalette();
  return (
    <View testID={testID} className="flex-row gap-1" importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, index) => {
        const state = index < done ? "done" : index === done && current ? "current" : "locked";
        return (
          <View
            key={index}
            className="h-1 flex-1 rounded-pill"
            style={
              state === "done"
                ? { backgroundColor: palette.gold }
                : state === "current"
                  ? { backgroundColor: palette.goldHigh, boxShadow: `0 0 8px ${withAlphaHex(palette.gold, 0.7)}` }
                  : { backgroundColor: palette.hairline }
            }
          />
        );
      })}
    </View>
  );
}

/** A count against a goal as a thin bar (47 of 50 cards). The words beside it say the numbers. */
export function ProgressBar({ value, max, tone = "gold" }: { value: number; max: number; tone?: "gold" | "danger" }) {
  const palette = usePalette();
  const share = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View className="h-1 overflow-hidden rounded-pill" style={{ backgroundColor: palette.hairline }} importantForAccessibility="no-hide-descendants">
      <View className="h-1 rounded-pill" style={{ width: `${Math.round(share * 100)}%`, backgroundColor: tone === "gold" ? palette.gold : palette.danger }} />
    </View>
  );
}

/** The sphere's printed icon beside the sphere word, tinted with the sphere token. Color is never the only signal. */
export function SphereMark({ sphere, size = 14 }: { sphere: MarkedSphere; size?: number }) {
  return <GameIcon name={sphere} size={size} tint={SPHERE_TINT[sphere] ?? "faint"} />;
}
