// The chrome's marks and status (docs/design-system.md, Components): chevrons, the Ring, the gear, tags, the journey track and the
// progress bar, the sphere mark. Views and text only; re-exported by chrome.tsx.
import type { ReactNode } from "react";
import { View } from "react-native";

import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import { SPHERE_TINT } from "../play/icon-map";
import { accentSurface } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { useUiScale } from "../play/ui-scale";
import { withAlphaHex } from "../play/tokens";
import { palettes, type Palette } from "./palette.js";
import type { MarkedSphere } from "./sphere-mark";
import { Text } from "../play/text";

/** A chevron drawn as views (no printed icon fits), pointing left for Back, right for a row that opens, down for a fold that is open. */
export function Chevron({ direction = "left", color, size = 10 }: { direction?: "left" | "right" | "down"; color?: string; size?: number }) {
  const palette = usePalette();
  const s = useUiScale();
  const box = size * s;
  return (
    <View
      importantForAccessibility="no"
      style={{
        width: box,
        height: box,
        borderLeftWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: color ?? palette.accent,
        transform:
          direction === "down"
            ? [{ translateY: -box * 0.2 }, { rotate: "-45deg" }]
            : [{ translateX: direction === "left" ? box * 0.2 : -box * 0.2 }, { rotate: direction === "left" ? "45deg" : "-135deg" }],
      }}
    />
  );
}

/** The Ring. Current node, app mark, completion. Never decorative filler. */
export function RingMark({ size = 18, state = "current" }: { size?: number; state?: "current" | "done" | "locked" }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const box = size * s;
  if (state === "done") {
    return <View style={{ width: box, height: box, borderRadius: box / 2, ...accentSurface(false, t) }} />;
  }
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box / 2,
        borderWidth: state === "locked" ? 1.5 : Math.max(2, box / 9),
        borderColor: state === "locked" ? palette.hairline : palette.accent,
      }}
    />
  );
}

/** A magnifying glass drawn as views (no printed icon fits), for a search field. */
export function Magnifier({ color }: { color: string }) {
  const s = useUiScale();
  return (
    <View importantForAccessibility="no" style={{ width: 16 * s, height: 16 * s }}>
      <View style={{ position: "absolute", left: 0, top: 0, width: 12 * s, height: 12 * s, borderRadius: 6 * s, borderWidth: 1.75, borderColor: color }} />
      <View style={{ position: "absolute", left: 10 * s, top: 11 * s, width: 6 * s, height: 1.75, borderRadius: 1, backgroundColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

/**
 * A gear drawn as views (the game icon font has none), for the Settings tab: a ring with eight teeth around it, open in the middle,
 * so it takes the dock's fill in either theme. `color` is the tab's tint.
 */
export function GearMark({ color, size = 22 }: { color: string; size?: number }) {
  const s = useUiScale();
  const box = size * s;
  const ring = box * 0.58;
  const tooth = box * 0.17;
  const length = box * 0.24;
  return (
    <View importantForAccessibility="no" style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <View key={angle} style={{ position: "absolute", width: tooth, height: length, borderRadius: 1, backgroundColor: color, transform: [{ rotate: `${angle}deg` }, { translateY: -(ring / 2 + length * 0.1) }] }} />
      ))}
      <View style={{ position: "absolute", width: ring, height: ring, borderRadius: ring / 2, borderWidth: box * 0.14, borderColor: color }} />
    </View>
  );
}

const chipTonesOf = (palette: Palette) => ({
  neutral: { fill: withAlphaHex(palette.bone, 0.07), text: palette.muted },
  accent: { fill: withAlphaHex(palette.accent, 0.14), text: palette.accentHigh },
  danger: { fill: withAlphaHex(palette.threat, 0.18), text: palette.danger },
  ok: { fill: withAlphaHex(palette.ok, 0.14), text: palette.ok },
  faint: { fill: withAlphaHex(palette.bone, 0.03), text: palette.faint },
});
// Built once per theme, not per Chip.
const chipTones = { dark: chipTonesOf(palettes.dark), light: chipTonesOf(palettes.light) };
const chipTonesFor = (palette: Palette) => (palette === palettes.light ? chipTones.light : chipTones.dark);

/** A small tag: a status, a reward, a rule, a stage. A tinted wash with no edge, words always; colour is never the only signal. */
export function Chip({ label, tone = "neutral", leading, testID, onArt = false }: { label: string; tone?: keyof typeof chipTones.dark; leading?: ReactNode; testID?: string; onArt?: boolean }) {
  const palette = usePalette();
  const look = chipTonesFor(palette)[tone];
  // Over a picture the tag sits on the ground first, so its words read over a bright sky.
  return (
    <View className="h-6 flex-row items-center gap-1.5 rounded-chip px-2" style={{ backgroundColor: onArt ? withAlphaHex(palette.night, 0.72) : look.fill }}>
      {leading}
      <Text testID={testID} numberOfLines={1} className="text-label" style={{ color: look.text }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A journey of steps as a track (the Continue panel): a filled diamond for each step done joined by a solid line, the current step as
 * a larger outlined diamond with a glow, then a dashed line for what remains. The words beside it say the numbers.
 */
export function JourneyBar({ total, done, current = done < total, testID }: { total: number; done: number; current?: boolean; testID?: string }) {
  const palette = usePalette();
  const s = useUiScale();
  const diamond = (size: number, filled: boolean, glow: boolean) => (
    <View
      style={{
        width: size * s,
        height: size * s,
        transform: [{ rotate: "45deg" }],
        backgroundColor: filled ? palette.accent : palette.night,
        borderWidth: filled ? 0 : 2,
        borderColor: palette.accentHigh,
        ...(glow ? { boxShadow: `0 0 10px ${withAlphaHex(palette.glow, 0.6)}` } : {}),
      }}
    />
  );
  const line = (solid: boolean, key: string) => (
    <View key={key} className="flex-1" style={solid ? { height: 2, backgroundColor: palette.accent } : { height: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: palette.hairline }} />
  );
  const steps: ReactNode[] = [];
  for (let index = 0; index < total; index++) {
    const state = index < done ? "done" : index === done && current ? "current" : "locked";
    if (state === "done") steps.push(<View key={`d${index}`}>{diamond(9, true, false)}</View>);
    if (state === "current") steps.push(<View key={`c${index}`}>{diamond(12, false, true)}</View>);
    if (index < total - 1) steps.push(line(index + 1 <= done, `l${index}`));
  }
  return (
    <View testID={testID} className="min-h-4 flex-row items-center gap-1" importantForAccessibility="no-hide-descendants">
      {steps}
    </View>
  );
}

/** A count against a goal as a thin bar (47 of 50 cards). The words beside it say the numbers. */
export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "danger" }) {
  const palette = usePalette();
  const share = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View className="overflow-hidden rounded-pill" style={{ height: 3, backgroundColor: withAlphaHex(palette.bone, 0.08) }} importantForAccessibility="no-hide-descendants">
      <View className="rounded-pill" style={{ height: 3, width: `${Math.round(share * 100)}%`, backgroundColor: tone === "accent" ? palette.accent : palette.danger }} />
    </View>
  );
}

/** The sphere's printed icon beside the sphere word, tinted with the sphere token. Color is never the only signal. */
export function SphereMark({ sphere, size = 14 }: { sphere: MarkedSphere; size?: number }) {
  const s = useUiScale();
  return <GameIcon name={sphere} size={size * s} tint={SPHERE_TINT[sphere] ?? "faint"} />;
}
