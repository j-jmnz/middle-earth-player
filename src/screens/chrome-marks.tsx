// The chrome's marks and status (docs/design-system.md, Components): chevrons, the accent corners of a framed card, the Ring, tags,
// journey and progress bars, the sphere mark. Views and text only; re-exported by chrome.tsx.
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
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color ?? palette.bone,
        transform:
          direction === "down"
            ? [{ translateY: -box * 0.2 }, { rotate: "-45deg" }]
            : [{ translateX: direction === "left" ? box * 0.2 : -box * 0.2 }, { rotate: direction === "left" ? "45deg" : "-135deg" }],
      }}
    />
  );
}

/** Four small accent diamonds on the corners of a framed thing: the current panel, the scenario to play, the fellowship chosen. */
export function Corners() {
  const palette = usePalette();
  const s = useUiScale();
  const out = -4 * s;
  const at = [
    { left: out, top: out },
    { right: out, top: out },
    { left: out, bottom: out },
    { right: out, bottom: out },
  ];
  return (
    <>
      {at.map((place, index) => (
        <View key={index} pointerEvents="none" importantForAccessibility="no" style={{ position: "absolute", width: 7 * s, height: 7 * s, backgroundColor: palette.accent, transform: [{ rotate: "45deg" }], ...place }} />
      ))}
    </>
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
  neutral: { fill: withAlphaHex(palette.bone, 0.06), edge: withAlphaHex(palette.bone, 0.1), text: palette.bone },
  accent: { fill: withAlphaHex(palette.accent, 0.14), edge: withAlphaHex(palette.accent, 0.38), text: palette.accentHigh },
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

/** A journey of steps as one segmented bar: accent for the steps done, a lit accent for the current one, night for the rest. */
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
                ? { backgroundColor: palette.accent }
                : state === "current"
                  ? { backgroundColor: palette.accentHigh, boxShadow: `0 0 8px ${withAlphaHex(palette.accent, 0.7)}` }
                  : { backgroundColor: palette.hairline }
            }
          />
        );
      })}
    </View>
  );
}

/** A count against a goal as a thin bar (47 of 50 cards). The words beside it say the numbers. */
export function ProgressBar({ value, max, tone = "accent" }: { value: number; max: number; tone?: "accent" | "danger" }) {
  const palette = usePalette();
  const share = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View className="h-1 overflow-hidden rounded-pill" style={{ backgroundColor: palette.hairline }} importantForAccessibility="no-hide-descendants">
      <View className="h-1 rounded-pill" style={{ width: `${Math.round(share * 100)}%`, backgroundColor: tone === "accent" ? palette.accent : palette.danger }} />
    </View>
  );
}

/** The sphere's printed icon beside the sphere word, tinted with the sphere token. Color is never the only signal. */
export function SphereMark({ sphere, size = 14 }: { sphere: MarkedSphere; size?: number }) {
  const s = useUiScale();
  return <GameIcon name={sphere} size={size * s} tint={SPHERE_TINT[sphere] ?? "faint"} />;
}
