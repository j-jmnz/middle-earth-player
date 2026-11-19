// The gauge of the combat spotlight's layer (spotlight.native.tsx; docs/design-system-table.md, Spotlight): the shields and hearts
// spotlight/gauge.ts lays out, on smoke in the middle of the stage under the result, drawn outside the shaking stage. It pops in with
// the read and comes forward during the count (the frame's `focus`, to 1 + `gaugeFocus`). In the count, one change at a time: each
// shield the attack reaches breaks at its step (ash, a red crack and a ring), then each absorbed point shows (a struck-out attack mark
// and a grey ring), then each heart the attack fills lights red as its damage token lands; the shields that held a blocked attack
// flare after the last step. `now` is ms into the attack, `place` its place among the attacks with its steps (beats.ts).
import { Circle, Group, Line, Path, Text, vec, type SkFont } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { IconName } from "../../ui/icon-map.ts";
import { tokenPopScale } from "../motion/token-fx.ts";
import { heldAt, stepAt, tokenLandAt, type Frame, type Place } from "./beats.ts";
import type { Gauge, GaugeAbsorbed, GaugeCount, GaugeHeart, GaugeShield } from "./gauge.ts";
import { Glyph, Halo, Smoke } from "./hud.native.tsx";
import { SPOT } from "./shape.ts";
import { withAlphaHex, type TableTokens } from "../../ui/tokens.ts";

// The colours the gauge adds to the tokens: a broken shield's ash and a heart lost before the attack (a dark ember).
const ASH = "#3A3634";
const EMBER = "#5A1E14";
// How long the ring of a breaking mark spreads and fades, ms at Normal (the motion scale passes through `k`).
const RING_MS = 260;

// The ring a mark gives off as it breaks: it spreads from the glyph and fades, `ringMs` from `at`.
function BreakRing({ x, cy, size, at, ringMs, now, color, s }: { x: number; cy: number; size: number; at: number; ringMs: number; now: SharedValue<number>; color: string; s: number }) {
  const r = useDerivedValue(() => size * (0.5 + 0.9 * Math.min(1, Math.max(0, (now.get() - at) / ringMs))));
  const opacity = useDerivedValue(() => {
    const u = (now.get() - at) / ringMs;
    return u > 0 && u < 1 ? 1 - u : 0;
  });
  return <Circle cx={x} cy={cy} r={r} color={color} style="stroke" strokeWidth={2 * s} opacity={opacity} />;
}

// A shield: standing in the accent, then at its step ash with a red crack and a ring if the attack breaks it; lit and bouncing once the
// steps are over if it held a blocked attack.
function Shield({ shield, cy, size, at, held, ringMs, now, frame, t, s }: { shield: GaugeShield; cy: number; size: number; at: number; held: number; ringMs: number; now: SharedValue<number>; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const { x, breaks, holds } = shield;
  const broken = useDerivedValue(() => (breaks && now.get() >= at ? 1 : 0));
  const standing = useDerivedValue(() => 1 - broken.get());
  const lit = useDerivedValue(() => (holds && now.get() >= held ? 1 : 0));
  const bounce = useDerivedValue(() => {
    const f = frame.get();
    return [{ scale: holds && f.badgeA > 0 ? f.badgeD / f.badgeA : 1 }];
  });
  const crack = `M ${x - 2 * s} ${cy - size / 2 + 3 * s} l ${4 * s} ${size * 0.35} l ${-5 * s} ${size * 0.15} l ${4 * s} ${size * 0.4}`;
  return (
    <Group transform={bounce} origin={vec(x, cy)}>
      <Group opacity={lit}>
        <Halo cx={x} cy={cy} r={size * 1.2} color={t.accent} strength={0.45} />
      </Group>
      <Group opacity={standing}>
        <Halo cx={x} cy={cy} r={size * 0.8} color={t.accent} strength={0.18} />
        <Glyph name="defense" cx={x} cy={cy} size={size} color={t.accent} />
      </Group>
      <Group opacity={broken}>
        <Glyph name="defense" cx={x} cy={cy} size={size} color={ASH} />
        <Path path={crack} color={t.threat} style="stroke" strokeWidth={1.4 * s} strokeCap="round" />
      </Group>
      {breaks ? <BreakRing x={x} cy={cy} size={size} at={at} ringMs={ringMs} now={now} color={t.threat} s={s} /> : null}
    </Group>
  );
}

// A point of the attack a card effect took away: nothing until its step, then a faint struck-out attack mark with a grey ring.
function Absorbed({ mark, cy, size, at, ringMs, now, t, s }: { mark: GaugeAbsorbed; cy: number; size: number; at: number; ringMs: number; now: SharedValue<number>; t: TableTokens; s: number }) {
  const { x } = mark;
  const shown = useDerivedValue(() => (now.get() >= at ? 1 : 0));
  return (
    <Group>
      <Group opacity={shown}>
        <Glyph name="attack" cx={x} cy={cy} size={size * 0.9} color={withAlphaHex(t.faint, 0.6)} />
        <Line p1={vec(x - size / 2 + 2 * s, cy + size / 2 - 2 * s)} p2={vec(x + size / 2 - 2 * s, cy - size / 2 + 2 * s)} color={t.faint} strokeWidth={2 * s} strokeCap="round" />
      </Group>
      <BreakRing x={x} cy={cy} size={size} at={at} ringMs={ringMs} now={now} color={t.faint} s={s} />
    </Group>
  );
}

// A heart: dark when it was lost before the attack, bone while whole, and for one the attack fills, faint until its damage token
// lands, then lit red with a glow, popping as the corner's count does.
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
// token lands, then "of" the most. Shields: the defense, which goes to ash at the first step if the attack broke any and glows once
// the steps are over if it held.
function Counted({ count, kind, cy, size, at, held, fonts, now, frame, t, s }: { count: GaugeCount; kind: "shield" | "heart"; cy: number; size: number; at: number; held: number; fonts: { number: SkFont; word: SkFont }; now: SharedValue<number>; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const { x, textX, before, after, max, breaks, holds } = count;
  const heart = kind === "heart";
  const changed = useDerivedValue(() => {
    const shown = heart ? frame.get().landed : breaks && now.get() >= at;
    return shown ? 1 : 0;
  });
  const still = useDerivedValue(() => 1 - changed.get());
  const glow = useDerivedValue(() => (holds && now.get() >= held ? 1 : 0));
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
 * The gauge (spotlight/gauge.ts) in the middle of the stage: the struck-out shield of an undefended hero, the shields, the absorbed
 * points, a faint dot, then the hearts, on smoke. It pops in with the attack value and grows during the count.
 */
export function GaugeView({ gauge, damage, place, now, k, fonts, frame, t, s }: { gauge: Gauge; damage: number; place: Place; now: SharedValue<number>; k: number; fonts: { number: SkFont; word: SkFont }; frame: SharedValue<Frame>; t: TableTokens; s: number }) {
  const opacity = useDerivedValue(() => Math.min(1, frame.get().badgeA));
  const transform = useDerivedValue(() => {
    const f = frame.get();
    return [{ scale: f.badgeA * (1 + SPOT.gaugeFocus * f.focus) }];
  });
  const { cx, cy, size, mark, steps } = gauge;
  const ringMs = RING_MS * k;
  const held = heldAt(k, place);
  const lands = gauge.hearts.map((heart) => (heart.token >= 0 ? tokenLandAt(heart.token, damage, k, place) : 0));
  const shieldAt = (step: number) => (step >= 0 ? stepAt(step, steps, k, place) : Number.POSITIVE_INFINITY);
  return (
    <Group transform={transform} origin={vec(cx, cy)} opacity={opacity}>
      <Smoke cx={cx} cy={cy} rx={gauge.width / 2 + 46 * s} ry={34 * s} t={t} />
      <Smoke cx={cx} cy={cy} rx={gauge.width / 2 + 30 * s} ry={28 * s} t={t} />
      <Smoke cx={cx} cy={cy} rx={gauge.width / 2 + 16 * s} ry={22 * s} t={t} />
      {mark != null ? (
        <Group opacity={0.7}>
          <Glyph name="defense" cx={mark} cy={cy} size={size} color={withAlphaHex(t.faint, 0.45)} />
          <Line p1={vec(mark - size / 2 + 2 * s, cy + size / 2 - 2 * s)} p2={vec(mark + size / 2 - 2 * s, cy - size / 2 + 2 * s)} color={t.threat} strokeWidth={2 * s} strokeCap="round" />
        </Group>
      ) : null}
      {gauge.shields.map((shield) => (
        <Shield key={shield.x} shield={shield} cy={cy} size={size} at={shieldAt(shield.step)} held={held} ringMs={ringMs} now={now} frame={frame} t={t} s={s} />
      ))}
      {gauge.shieldCount ? <Counted count={gauge.shieldCount} kind="shield" cy={cy} size={size} at={shieldAt(0)} held={held} fonts={fonts} now={now} frame={frame} t={t} s={s} /> : null}
      {gauge.absorbed.map((point) => (
        <Absorbed key={point.x} mark={point} cy={cy} size={size} at={shieldAt(point.step)} ringMs={ringMs} now={now} t={t} s={s} />
      ))}
      {gauge.dot != null ? <Circle cx={gauge.dot} cy={cy} r={1.6 * s} color={withAlphaHex(t.faint, 0.6)} /> : null}
      {gauge.hearts.map((heart, at) => (
        <Heart key={heart.x} heart={heart} cy={cy} size={size} land={lands[at] ?? 0} now={now} k={k} t={t} />
      ))}
      {gauge.heartCount ? <Counted count={gauge.heartCount} kind="heart" cy={cy} size={size} at={0} held={held} fonts={fonts} now={now} frame={frame} t={t} s={s} /> : null}
    </Group>
  );
}
