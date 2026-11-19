// The words and numbers of the combat spotlight's layer (spotlight.native.tsx; docs/design-system-table.md, Spotlight), drawn outside the
// shaking, pushed-in stage so they stay still: the attack value, the gauge of shields and hearts under the target, the caption line, the
// damage number, the "+n" and the note. None has an outline or a plate: each stands on a patch of black smoke (a radial gradient, no
// edge), and light marks what changed (a glow is a gradient, no blur filter). Every number is the engine's (clash.ts, gauge.ts); each piece
// reads the attack's frame (spotlight/beats.ts) through a derived value. The stage is in screen points already times the UI scale.
import { Circle, Group, Line, Path, RadialGradient, Text, vec, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { CanvasIcon } from "../canvas/pieces.native.tsx";
import type { IconName } from "../../ui/icon-map.ts";
import { tokenPopScale } from "../motion/token-fx.ts";
import { tokenLandAt, type Frame, type Place } from "./beats.ts";
import { resultLook } from "./fx.ts";
import type { Gauge, GaugeCount, GaugeHeart, GaugeShield } from "./gauge.ts";
import { SPOT } from "./shape.ts";
import type { Stage } from "./stage.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";

// The colours the gauge adds to the tokens: a broken shield's ash and a heart lost before the attack (a dark ember).
const ASH = "#3A3634";
const EMBER = "#5A1E14";

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

// An icon of `size` centred on a point (CanvasIcon takes its top-left corner).
function Glyph({ name, cx, cy, size, color }: { name: IconName; cx: number; cy: number; size: number; color: string }) {
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

// A shield of the gauge: standing in the accent until the attack strikes, then ash with a red crack if it broke, or lit and bouncing
// if it held a blocked attack.
function Shield({ shield, cy, size, frame, t, s }: { shield: GaugeShield; cy: number; size: number; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const { x, breaks, holds } = shield;
  const broken = useDerivedValue(() => (breaks && frame.get().struck ? 1 : 0));
  const standing = useDerivedValue(() => 1 - broken.get());
  const lit = useDerivedValue(() => (holds && frame.get().struck ? 1 : 0));
  const bounce = useDerivedValue(() => {
    const f = frame.get();
    return [{ scale: holds && f.badgeA > 0 ? f.badgeD / f.badgeA : 1 }];
  });
  const crack = `M ${x - 2 * s} ${cy - size / 2 + 3 * s} l ${4 * s} ${size * 0.35} l ${-5 * s} ${size * 0.15} l ${4 * s} ${size * 0.4}`;
  return (
    <Group transform={bounce} origin={vec(x, cy)}>
      <Group opacity={lit}>
        <Halo cx={x} cy={cy} r={size * 1.1} color={t.accent} strength={0.4} />
      </Group>
      <Group opacity={standing}>
        <Halo cx={x} cy={cy} r={size * 0.8} color={t.accent} strength={0.18} />
        <Glyph name="defense" cx={x} cy={cy} size={size} color={t.accent} />
      </Group>
      <Group opacity={broken}>
        <Glyph name="defense" cx={x} cy={cy} size={size} color={ASH} />
        <Path path={crack} color={t.threat} style="stroke" strokeWidth={1.4 * s} strokeCap="round" />
      </Group>
    </Group>
  );
}

// A heart of the gauge: dark when it was lost before the attack, bone while whole, and for one the attack fills, bone and faint
// until its damage token lands, then lit red with a glow, popping as the corner's count does.
function Heart({ heart, cy, size, land, now, k, t }: { heart: GaugeHeart; cy: number; size: number; land: number; now: SharedValue<number>; k: number; t: TableTokens }) {
  const { x, was } = heart;
  const lit = useDerivedValue(() => (was === "fresh" && now.get() >= land ? 1 : 0));
  const unlit = useDerivedValue(() => 1 - lit.get());
  const pop = useDerivedValue(() => [{ scale: lit.get() > 0 ? tokenPopScale(now.get() - land, k) : 1 }]);
  if (was === "lost") return <Glyph name="hitPoints" cx={x} cy={cy} size={size} color={EMBER} />;
  if (was === "whole") return <Glyph name="hitPoints" cx={x} cy={cy} size={size} color={withAlphaHex(t.bone, 0.82)} />;
  return (
    <Group>
      <Group opacity={unlit}>
        <Glyph name="hitPoints" cx={x} cy={cy} size={size} color={withAlphaHex(t.bone, 0.82)} />
      </Group>
      <Group opacity={lit} transform={pop} origin={vec(x, cy)}>
        <Halo cx={x} cy={cy} r={size * 1.2} color={t.threat} strength={0.5} />
        <Glyph name="hitPoints" cx={x} cy={cy} size={size} color={t.threat} />
      </Group>
    </Group>
  );
}

// A row shown as one glyph and a count. Hearts: the hit points left, which turn to the new count (and the heart lights) as the last
// token lands, then "of" the most. Shields: the defense, which goes to ash if the attack broke any and glows if it held.
function Counted({ count, kind, cy, size, fonts, frame, t, s }: { count: GaugeCount; kind: "shield" | "heart"; cy: number; size: number; fonts: { number: SkFont; word: SkFont }; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const { x, textX, before, after, max, breaks, holds } = count;
  const heart = kind === "heart";
  const changed = useDerivedValue(() => {
    const f = frame.get();
    const shown = heart ? f.landed : breaks && f.struck;
    return shown ? 1 : 0;
  });
  const still = useDerivedValue(() => 1 - changed.get());
  const glow = useDerivedValue(() => (holds && frame.get().struck ? 1 : 0));
  const name: IconName = heart ? "hitPoints" : "defense";
  const calm = heart ? withAlphaHex(t.bone, 0.82) : t.accent;
  const hit = heart ? t.threat : ASH;
  const baseline = cy + fonts.number.getSize() * 0.36;
  const tail = heart ? `of ${max}` : "";
  return (
    <Group>
      <Group opacity={glow}>
        <Halo cx={x} cy={cy} r={size * 1.1} color={t.accent} strength={0.4} />
      </Group>
      <Group opacity={still}>
        <Glyph name={name} cx={x} cy={cy} size={size} color={calm} />
        <Text x={textX} y={baseline} text={String(before)} font={fonts.number} color={t.bone} />
        <Text x={textX + fonts.number.getTextWidth(String(before)) + 4 * s} y={baseline} text={tail} font={fonts.word} color={t.faint} />
      </Group>
      <Group opacity={changed}>
        {heart ? <Halo cx={x} cy={cy} r={size * 1.2} color={t.threat} strength={0.5} /> : null}
        <Glyph name={name} cx={x} cy={cy} size={size} color={hit} />
        <Text x={textX} y={baseline} text={String(after)} font={fonts.number} color={t.bone} />
        <Text x={textX + fonts.number.getTextWidth(String(after)) + 4 * s} y={baseline} text={tail} font={fonts.word} color={t.faint} />
      </Group>
    </Group>
  );
}

/**
 * The gauge under the target (spotlight/gauge.ts): the struck-out shield of an undefended hero, the shields, a faint dot, then the
 * hearts, on smoke straddling the card's foot. It pops in with the attack value. `now` is ms into the attack and `place` its place
 * among the attacks, so each heart the attack fills lights as its token lands (beats.ts, tokenLandAt).
 */
export function GaugeView({ gauge, damage, place, now, k, fonts, frame, t, s }: { gauge: Gauge; damage: number; place: Place; now: SharedValue<number>; k: number; fonts: { number: SkFont; word: SkFont }; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => Math.min(1, frame.get().badgeA));
  const transform = useDerivedValue(() => [{ scale: frame.get().badgeA }]);
  const { cx, cy, size, mark } = gauge;
  const lands = gauge.hearts.map((heart) => (heart.token >= 0 ? tokenLandAt(heart.token, damage, k, place) : 0));
  const markSize = size;
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={opacity}>
      <Smoke cx={cx} cy={cy} rx={gauge.width / 2 + 46 * s} ry={34 * s} t={t} />
      {mark != null ? (
        <Group opacity={0.7}>
          <Glyph name="defense" cx={mark} cy={cy} size={markSize} color={withAlphaHex(t.faint, 0.45)} />
          <Line p1={vec(mark - markSize / 2 + 2 * s, cy + markSize / 2 - 2 * s)} p2={vec(mark + markSize / 2 - 2 * s, cy - markSize / 2 + 2 * s)} color={t.threat} strokeWidth={2 * s} strokeCap="round" />
        </Group>
      ) : null}
      {gauge.shields.map((shield) => (
        <Shield key={shield.x} shield={shield} cy={cy} size={size} frame={frame} t={t} s={s} />
      ))}
      {gauge.shieldCount ? <Counted count={gauge.shieldCount} kind="shield" cy={cy} size={size} fonts={fonts} frame={frame} t={t} s={s} /> : null}
      {gauge.dot != null ? <Circle cx={gauge.dot} cy={cy} r={1.6 * s} color={withAlphaHex(t.faint, 0.6)} /> : null}
      {gauge.hearts.map((heart, at) => (
        <Heart key={heart.x} heart={heart} cy={cy} size={size} land={lands[at] ?? 0} now={now} k={k} t={t} />
      ))}
      {gauge.heartCount ? <Counted count={gauge.heartCount} kind="heart" cy={cy} size={size} fonts={fonts} frame={frame} t={t} s={s} /> : null}
    </Group>
  );
}

/**
 * The caption line under the gauge: the dock's words (the attack icon and number, "against", the defense icon and number; an
 * undefended hero reads "undefended"), then the result word in its colour and glow ("1 damage", "Blocked", "Destroyed"), which
 * comes in at the impact when the attack was blocked and as the last token lands otherwise. It keeps inside the screen's right edge.
 */
export function Caption({ at, attack, defense, undefended, rim, result, fonts, frame, t, s }: {
  at: Stage["caption"];
  attack: number;
  defense: number;
  undefended: boolean;
  rim: string;
  result: { text: string; color: string };
  fonts: { number: SkFont; word: SkFont; result: SkFont };
  frame: SharedValue<Frame>;
  t: TableTokens;
  s: number;
}) {
  const opacity = useDerivedValue(() => Math.min(1, frame.get().badgeA));
  const resultOpacity = useDerivedValue(() => resultLook(frame.get().result).alpha);
  const icon = 16 * s;
  const gap = 4 * s;
  const space = 8 * s;
  const middle = undefended ? "undefended" : "against";
  const atkText = String(attack);
  const defText = String(defense);
  const atkW = icon + gap + fonts.number.getTextWidth(atkText);
  const midW = fonts.word.getTextWidth(middle);
  const defW = undefended ? 0 : icon + gap + fonts.number.getTextWidth(defText);
  const dotW = fonts.word.getTextWidth("·");
  const resW = fonts.result.getTextWidth(result.text);
  const defPart = undefended ? 0 : defW + space;
  const width = atkW + space + midW + space + defPart + dotW + space + resW;
  const cx = Math.min(at.cx, at.right - width / 2);
  const left = cx - width / 2;
  const numberY = at.cy + fonts.number.getSize() * 0.36;
  const wordY = at.cy + fonts.word.getSize() * 0.36;
  const midX = left + atkW + space;
  const defX = midX + midW + space;
  const dotX = defX + defPart;
  const resX = dotX + dotW + space;
  const resultScale = useDerivedValue(() => [{ scale: resultLook(frame.get().result).scale }]);
  return (
    <Group opacity={opacity}>
      <Smoke cx={cx} cy={at.cy - 2 * s} rx={width / 2 + 40 * s} ry={22 * s} strength={0.85} t={t} />
      <Glyph name="attack" cx={left + icon / 2} cy={at.cy - 1 * s} size={icon} color={rim} />
      <Text x={left + icon + gap} y={numberY} text={atkText} font={fonts.number} color={t.bone} />
      <Text x={midX} y={wordY} text={middle} font={fonts.word} color={t.muted} />
      {undefended ? null : (
        <Group>
          <Glyph name="defense" cx={defX + icon / 2} cy={at.cy - 1 * s} size={icon} color={t.accent} />
          <Text x={defX + icon + gap} y={numberY} text={defText} font={fonts.number} color={t.bone} />
        </Group>
      )}
      <Group opacity={resultOpacity}>
        <Text x={dotX} y={wordY} text="·" font={fonts.word} color={t.faint} />
      </Group>
      <Group opacity={resultOpacity} transform={resultScale} origin={vec(resX + resW / 2, at.cy)}>
        <Group transform={[{ scaleY: 0.45 }]} origin={vec(resX + resW / 2, at.cy)}>
          <Halo cx={resX + resW / 2} cy={at.cy} r={resW / 2 + 18 * s} color={result.color} strength={0.28} />
        </Group>
        <Text x={resX} y={at.cy + fonts.result.getSize() * 0.36} text={result.text} font={fonts.result} color={result.color} />
      </Group>
    </Group>
  );
}

/** The damage number over the target ("−1"): it pops in to 1.4 and settles, rises, and fades, in threat red (gold for a kill), on smoke with its own glow. */
export function DamageNumber({ at, text, font, destroyed, frame, cardH, t, s }: { at: { cx: number; cy: number }; text: string; font: SkFont; destroyed: boolean; frame: SharedValue<Frame>; cardH: number; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => frame.get().number.alpha);
  const transform = useDerivedValue(() => [{ translateY: -frame.get().number.rise * SPOT.numberRise * cardH }, { scale: frame.get().number.scale }]);
  const color = destroyed ? t.fellowship : t.threat;
  const width = font.getTextWidth(text);
  return (
    <Group transform={transform} origin={vec(at.cx, at.cy)} opacity={opacity}>
      <Smoke cx={at.cx} cy={at.cy} rx={width / 2 + 34 * s} ry={font.getSize() * 0.8} strength={0.6} t={t} />
      <Halo cx={at.cx} cy={at.cy} r={width / 2 + 16 * s} color={color} strength={0.3} />
      <Text x={at.cx - width / 2} y={at.cy + font.getSize() * 0.35} text={text} font={font} color={color} />
    </Group>
  );
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
