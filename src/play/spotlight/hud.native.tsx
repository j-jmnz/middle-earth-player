// The words and numbers of the combat spotlight's layer (spotlight.native.tsx; docs/design-system-table.md, Spotlight), drawn outside the
// shaking, pushed-in stage so they stay still: the attack value at the attackers' feet, the matchup line and the result in the middle
// of the stage, the veil that dims the cards during the count, the "+n" and the note. The gauge of shields and hearts is
// spotlight/gauge.native.tsx. None has an outline or a plate: each stands on a patch of black smoke (a radial gradient, no edge), and
// light marks what changed (a glow is a gradient, no blur filter). Every number is the engine's (clash.ts); each piece reads the
// attack's frame (spotlight/beats.ts) through a derived value. The stage is in screen points already times the UI scale.
import { Circle, Group, Rect, RadialGradient, Text, vec, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { CanvasIcon } from "../canvas/pieces.native.tsx";
import type { IconName } from "../../ui/icon-map.ts";
import type { Frame } from "./beats.ts";
import { SPOT } from "./shape.ts";
import type { Stage } from "./stage.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";

/** A patch of black smoke behind a readout: a night radial gradient stretched to an ellipse, dense in the middle and gone at its edge. */
export function Smoke({ cx, cy, rx, ry, strength, t }: { cx: number; cy: number; rx: number; ry: number; strength?: number; t: TableTokens }) {
  const a = strength ?? 1;
  return (
    <Group transform={[{ scaleY: ry / rx }]} origin={vec(cx, cy)}>
      <Circle cx={cx} cy={cy} r={rx}>
        <RadialGradient c={vec(cx, cy)} r={rx} colors={[withAlphaHex(t.night, 0.92 * a), withAlphaHex(t.night, 0.7 * a), withAlphaHex(t.night, 0)]} positions={[0, 0.55, 1]} />
      </Circle>
    </Group>
  );
}

/** A soft glow of `color` around a point: the light behind a glyph or a word. */
export function Halo({ cx, cy, r, color, strength }: { cx: number; cy: number; r: number; color: string; strength: number }) {
  return (
    <Circle cx={cx} cy={cy} r={r}>
      <RadialGradient c={vec(cx, cy)} r={r} colors={[withAlphaHex(color, strength), withAlphaHex(color, 0)]} />
    </Circle>
  );
}

/** An icon of `size` centred on a point (CanvasIcon takes its top-left corner). */
export function Glyph({ name, cx, cy, size, color }: { name: IconName; cx: number; cy: number; size: number; color: string }) {
  return <CanvasIcon name={name} x={cx - size / 2} y={cy - size / 2} size={size} color={color} />;
}

/** The attack value under the attackers' feet: the attack icon in its glow beside the number, on smoke. It pops in with the read. */
export function AttackValue({ at, color, text, font, frame, t, s }: { at: { cx: number; cy: number }; color: string; text: string; font: SkFont; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => Math.min(1, frame.get().badgeA));
  const transform = useDerivedValue(() => [{ scale: frame.get().badgeA }]);
  const icon = SPOT.attackIcon * s;
  const gap = 6 * s;
  const width = icon + gap + font.getTextWidth(text);
  const left = at.cx - width / 2;
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <Smoke cx={at.cx} cy={at.cy} rx={width / 2 + 34 * s} ry={30 * s} t={t} />
      <Halo cx={left + icon / 2} cy={at.cy} r={icon} color={color} strength={0.45} />
      <Glyph name="attack" cx={left + icon / 2} cy={at.cy} size={icon} color={color} />
      <Text x={left + icon + gap} y={at.cy + font.getSize() * 0.36} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/**
 * The matchup line in the middle of the stage before the hit: the attack icon and number, "against", the defense icon and number
 * ("undefended" for an undefended hero, with no defense). It comes in over the read and fades over the lunge, which goes through it.
 */
export function Matchup({ at, attack, defense, undefended, rim, fonts, frame, t, s }: { at: Stage["focus"]; attack: number; defense: number; undefended: boolean; rim: string; fonts: { number: SkFont; word: SkFont }; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => frame.get().matchup);
  const icon = 28 * s;
  const gap = 6 * s;
  const space = 14 * s;
  const word = undefended ? "undefended" : "against";
  const atkText = String(attack);
  const defText = String(defense);
  const atkW = icon + gap + fonts.number.getTextWidth(atkText);
  const wordW = fonts.word.getTextWidth(word);
  const defW = undefended ? 0 : icon + gap + fonts.number.getTextWidth(defText);
  const defPart = undefended ? 0 : space + defW;
  const width = atkW + space + wordW + defPart;
  const left = at.cx - width / 2;
  const numberY = at.cy + fonts.number.getSize() * 0.36;
  const wordX = left + atkW + space;
  const defX = wordX + wordW + space;
  return (
    <Group opacity={opacity}>
      <Smoke cx={at.cx} cy={at.cy} rx={width / 2 + 50 * s} ry={34 * s} t={t} />
      <Glyph name="attack" cx={left + icon / 2} cy={at.cy} size={icon} color={rim} />
      <Text x={left + icon + gap} y={numberY} text={atkText} font={fonts.number} color={t.bone} />
      <Text x={wordX} y={at.cy + fonts.word.getSize() * 0.36} text={word} font={fonts.word} color={t.muted} />
      {undefended ? null : (
        <Group>
          <Glyph name="defense" cx={defX + icon / 2} cy={at.cy} size={icon} color={t.accent} />
          <Text x={defX + icon + gap} y={numberY} text={defText} font={fonts.number} color={t.bone} />
        </Group>
      )}
    </Group>
  );
}

/**
 * The result in the middle of the stage after the count: "−1" or "Destroyed" in threat red, "Blocked" in the accent, on smoke with its
 * own glow. It pops in as the last token lands (or as the shields that held flare) and stays until the cards go back.
 */
export function Result({ at, text, color, font, frame, t, s }: { at: Stage["focus"]; text: string; color: string; font: SkFont; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => frame.get().result.alpha);
  const transform = useDerivedValue(() => [{ scale: frame.get().result.scale }]);
  const width = font.getTextWidth(text);
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <Smoke cx={at.cx} cy={at.cy} rx={width / 2 + 60 * s} ry={font.getSize() * 1.1} t={t} />
      <Group transform={[{ scaleY: 0.5 }]} origin={vec(at.cx, at.cy)}>
        <Halo cx={at.cx} cy={at.cy} r={width / 2 + 30 * s} color={color} strength={0.32} />
      </Group>
      <Text x={at.cx - width / 2} y={at.cy + font.getSize() * 0.36} text={text} font={font} color={color} />
    </Group>
  );
}

/** The night veil that dims the stage under the gauge during the count (`focusVeil` at the full focus), so the eye has only the gauge. */
export function FocusVeil({ width, height, frame, t }: { width: number; height: number; frame: SharedValue<Frame>; t: TableTokens }) {
  const opacity = useDerivedValue(() => SPOT.focusVeil * frame.get().focus);
  return <Rect x={0} y={0} width={width} height={height} color={t.night} opacity={opacity} />;
}

/** A word on smoke ("+2" for the attackers past the fan), centered at `at`. */
export function Chip({ at, text, font, opacity, t, s }: { at: { cx: number; cy: number }; text: string; font: SkFont; opacity: SharedValue<number>; t: TableTokens; s: number }) {
  const width = font.getTextWidth(text);
  return (
    <Group opacity={opacity}>
      <Smoke cx={at.cx} cy={at.cy} rx={width / 2 + 18 * s} ry={font.getSize()} t={t} />
      <Text x={at.cx - width / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={t.bone} />
    </Group>
  );
}

/** The note under the top inset: a dot for each attack (lit up to this one), then "Tap to skip", on smoke. */
export function Note({ at, index, total, font, opacity, t, s }: { at: Stage["note"]; index: number; total: number; font: SkFont; opacity: SharedValue<number>; t: TableTokens; s: number }) {
  const label = "Tap to skip";
  const step = 13 * s;
  const dots = total > 1 ? total : 0;
  const dotsW = dots > 0 ? (dots - 1) * step + 12 * s : 0;
  const width = dotsW + font.getTextWidth(label);
  const left = at.cx - width / 2;
  return (
    <Group opacity={opacity}>
      <Smoke cx={at.cx} cy={at.cy} rx={width / 2 + 50 * s} ry={at.h * 0.75} strength={0.8} t={t} />
      {Array.from({ length: dots }, (_, n) => (
        <Circle key={n} cx={left + 3 * s + n * step} cy={at.cy} r={3.2 * s} color={n <= index ? withAlphaHex(t.bone, 0.9) : withAlphaHex(t.faint, 0.35)} />
      ))}
      <Text x={left + dotsW} y={at.cy + font.getSize() * 0.35} text={label} font={font} color={t.faint} />
    </Group>
  );
}
