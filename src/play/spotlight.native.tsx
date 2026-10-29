// The combat spotlight (docs/design-system.md, Table, Spotlight; phase 24): a top layer on the table's Skia canvas. When an attack
// deals or blocks damage, the table dims, the attacker (or a fan of attackers) and the target fly from their slots to the middle,
// enlarged, side by side; the attacker draws back and strikes, the target shakes and the damage tokens fly to its corner, and both
// go back. The canvas holds the pictures; the plan (spotlight-plan.ts) says who stands where; the beats are arithmetic on one clock
// (spotlight-beats.ts) that the UI thread evaluates, so the canvas draws only while it plays, with no idle loop and no timer.
// Every number is the engine's: it reads the clash, never works one out. Colors are the table's tokens.
import { Group, RoundedRect, type SkImage } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { BackImages, Fonts, TokenImages } from "./canvas-pieces.native.tsx";
import type { IconName } from "./icon-map.ts";
import { darkAt, frameAt, spotlightRun, windowOf, type Frame } from "./spotlight-beats.ts";
import { SPOT } from "./spotlight-shape.ts";
import { BurstToken, Chip, Corner, FlyingCard, Pill, StageCard, Veil, Word } from "./spotlight-pieces.native.tsx";
import type { ClashPlan, SpotlightPlan } from "./spotlight-plan.ts";
import type { SpotFonts } from "./table-fonts.native.ts";
import type { TableTokens } from "./tokens.ts";

type Common = {
  images: ReadonlyMap<string, SkImage>;
  tokens: TokenImages;
  backs: BackImages;
  fonts: Fonts;
  spotFonts: SpotFonts;
  // The theme's tokens, and the UI scale (ui-scale.ts), from the canvas root.
  t: TableTokens;
  s: number;
  nameOf: (code: string) => string;
  sphereOf: (code: string) => IconName | null;
  k: number;
};

// Attack `index` of `total`, in its own window of the run: it draws only inside it, so the next one waits its turn (and swaps in as it leaves).
function ClashView({ plan, index, total, now, ...common }: Common & { plan: ClashPlan; index: number; total: number; now: SharedValue<number> }) {
  const { k, images, tokens, backs, fonts, nameOf, sphereOf, t, s } = common;
  const { pill, count, word } = common.spotFonts;
  const { stage, shape, clash } = plan;
  const run = windowOf(index, total, k);
  const local = useDerivedValue(() => now.get() - run.start);
  const frame = useDerivedValue((): Frame => frameAt(shape, local.get(), k, plan.seed));
  const inWindow = useDerivedValue(() => (local.get() >= 0 && local.get() < run.length ? frame.get().fade : 0));
  const picture = (spot: { code: string }) => images.get(spot.code) ?? null;
  const card = (spot: ClashPlan["target"], rect: ClashPlan["stage"]["target"], faceDown = false) => (
    <StageCard spot={spot} rect={rect} image={picture(spot)} name={nameOf(spot.code)} sphere={sphereOf(spot.code)} fonts={fonts} backs={backs} t={t} s={s} faceDown={faceDown} />
  );
  const flipBack = useDerivedValue(() => (frame.get().flipAngle < Math.PI / 2 ? 1 : 0));
  const flipFace = useDerivedValue(() => (frame.get().flipAngle < Math.PI / 2 ? 0 : 1));
  const wordOpacity = useDerivedValue(() => frame.get().stamp);
  const moreOpacity = useDerivedValue(() => Math.min(1, frame.get().badgeA));
  const attackColor = plan.enemyAttack ? t.threat : t.accent;
  const blocked = shape.damage === 0;
  return (
    <Group opacity={inWindow}>
      {plan.shadow && stage.shadow ? (
        <FlyingCard spot={plan.shadow} rect={stage.shadow} turn={0} role="shadow" stage={stage} frame={frame}>
          <Group opacity={flipBack}>{card(plan.shadow, stage.shadow, true)}</Group>
          <Group opacity={flipFace}>{card(plan.shadow, stage.shadow)}</Group>
        </FlyingCard>
      ) : null}
      <FlyingCard spot={plan.target} rect={stage.target} turn={0} role="target" stage={stage} frame={frame}>
        {card(plan.target, stage.target)}
        <Veil rect={stage.target} frame={frame} t={t} s={s} />
        {count ? <Corner stage={stage} before={plan.before} after={plan.after} image={tokens.damage} font={count} frame={frame} t={t} s={s} /> : null}
      </FlyingCard>
      {plan.attackers.map((spot, at) => {
        const rect = stage.attackers[at] ?? stage.target;
        return (
          <FlyingCard key={spot.id} spot={spot} rect={rect} turn={stage.turns[at] ?? 0} role="attacker" stage={stage} frame={frame}>
            {card(spot, rect)}
          </FlyingCard>
        );
      })}
      {Array.from({ length: shape.damage }, (_, n) => (
        <BurstToken key={n} stage={stage} index={n} count={shape.damage} now={local} k={k} place={shape} image={tokens.damage} t={t} s={s} />
      ))}
      {pill ? <Pill at={stage.badgeA} icon="attack" color={attackColor} text={String(clash.attack)} font={pill} frame={frame} t={t} s={s} badge="badgeA" /> : null}
      {/* An undefended hero has no defense to show: the pill stands under a defender or an enemy only. */}
      {pill && !clash.undefended ? <Pill at={stage.badgeD} icon="defense" color={t.accent} text={String(clash.defense)} font={pill} frame={frame} t={t} s={s} badge="badgeD" /> : null}
      {word && blocked ? <Word at={stage.stamp} text="Blocked" font={word} t={t} opacity={wordOpacity} /> : null}
      {word && stage.more ? <Chip at={stage.more} text={`+${plan.more}`} font={word} t={t} s={s} opacity={moreOpacity} /> : null}
      {word && total > 1 ? <Word at={stage.note} text={`${index + 1} of ${total} · Tap to skip`} font={word} t={t} color={t.muted} opacity={moreOpacity} /> : null}
    </Group>
  );
}

/**
 * The layer over the table while the spotlight plays: the night over the canvas (65%), then each attack in turn. `progress` is the
 * 0..1 clock over the whole run at the motion scale `k`.
 */
export function Spotlight({ plan, progress, width, height, ...common }: Common & { plan: SpotlightPlan; progress: SharedValue<number>; width: number; height: number }) {
  const { k } = common;
  const total = Math.max(1, spotlightRun(plan.clashes.length, k));
  const now = useDerivedValue(() => progress.get() * total);
  const night = useDerivedValue(() => SPOT.dark * darkAt(now.get(), k, plan.clashes.length));
  return (
    <Group>
      <RoundedRect x={0} y={0} width={width} height={height} r={0} color={common.t.night} opacity={night} />
      {plan.clashes.map((clash, index) => (
        <ClashView key={`${plan.seq}:${index}`} plan={clash} index={index} total={plan.clashes.length} now={now} {...common} />
      ))}
    </Group>
  );
}
