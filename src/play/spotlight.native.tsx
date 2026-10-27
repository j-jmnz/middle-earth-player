// The combat spotlight (docs/design-system.md, Table, Spotlight; phase 24): a top layer on the table's Skia canvas. When an attack
// deals or blocks damage, the table dims, the attacker (or a fan of attackers) and the target fly from their slots to the middle,
// enlarged, side by side; the attacker draws back and strikes, the target shakes and the damage tokens fly to its corner, and both
// go back. The canvas holds the pictures; the plan (spotlight-plan.ts) says who stands where; the beats are arithmetic on one clock
// (spotlight-beats.ts) that the UI thread evaluates, so the canvas draws only while it plays, with no idle loop and no timer.
// Every number is the engine's: it reads the clash, never works one out. Colors are the table's tokens.
import { Group, RoundedRect, useFont, type SkImage } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { BackImages, Fonts, TokenImages } from "./canvas-pieces.native.tsx";
import type { IconName } from "./icon-map.ts";
import { SHAPE } from "./motion-tokens.ts";
import { beatsAt, frameAt, scrimAt, type Frame } from "./spotlight-beats.ts";
import { BurstToken, Corner, FlyingCard, Pill, StageCard, Veil, Word } from "./spotlight-pieces.native.tsx";
import type { ClashPlan, SpotlightPlan } from "./spotlight-plan.ts";
import { tableTokens as t } from "./tokens.ts";

const MARCELLUS = require("../../assets/fonts/Marcellus-Regular.ttf") as number;
const PILL_SIZE = 26;
const COUNT_SIZE = 20;
const WORD_SIZE = 15;

type Common = {
  images: ReadonlyMap<string, SkImage>;
  tokens: TokenImages;
  backs: BackImages;
  fonts: Fonts;
  nameOf: (code: string) => string;
  sphereOf: (code: string) => IconName | null;
  k: number;
};

// One attack, `start` ms into the run: it draws only inside its own window, so the next one waits its turn.
function ClashView({ plan, start, run, now, ...common }: Common & { plan: ClashPlan; start: number; run: number; now: SharedValue<number> }) {
  const { k, images, tokens, backs, fonts, nameOf, sphereOf } = common;
  const pill = useFont(MARCELLUS, PILL_SIZE);
  const count = useFont(MARCELLUS, COUNT_SIZE);
  const word = useFont(MARCELLUS, WORD_SIZE);
  const { stage, shape, clash } = plan;
  const local = useDerivedValue(() => now.get() - start);
  const frame = useDerivedValue((): Frame => frameAt(shape, local.get(), k));
  const inWindow = useDerivedValue(() => (local.get() >= 0 && local.get() < run ? 1 : 0));
  const picture = (spot: { code: string }) => images.get(spot.code) ?? null;
  const card = (spot: ClashPlan["target"], rect: ClashPlan["stage"]["target"], faceDown = false) => (
    <StageCard spot={spot} rect={rect} image={picture(spot)} name={nameOf(spot.code)} sphere={sphereOf(spot.code)} fonts={fonts} backs={backs} faceDown={faceDown} />
  );
  const flipBack = useDerivedValue(() => (frame.get().flip < 0.5 ? 1 : 0));
  const flipFace = useDerivedValue(() => (frame.get().flip < 0.5 ? 0 : 1));
  const wordOpacity = useDerivedValue(() => frame.get().word);
  const moreOpacity = useDerivedValue(() => frame.get().pills);
  const attackColor = plan.enemyAttack ? t.threat : t.gold;
  const blocked = shape.damage === 0;
  return (
    <Group opacity={inWindow}>
      {plan.shadow && stage.shadow ? (
        <FlyingCard spot={plan.shadow} rect={stage.shadow} turn={0} role="shadow" frame={frame}>
          <Group opacity={flipBack}>{card(plan.shadow, stage.shadow, true)}</Group>
          <Group opacity={flipFace}>{card(plan.shadow, stage.shadow)}</Group>
        </FlyingCard>
      ) : null}
      <FlyingCard spot={plan.target} rect={stage.target} turn={0} role="target" frame={frame}>
        {card(plan.target, stage.target)}
        <Veil rect={stage.target} frame={frame} />
        {count ? <Corner stage={stage} before={plan.before} after={plan.after} image={tokens.damage} font={count} frame={frame} /> : null}
      </FlyingCard>
      {plan.attackers.map((spot, index) => {
        const rect = stage.attackers[index] ?? stage.target;
        return (
          <FlyingCard key={spot.id} spot={spot} rect={rect} turn={stage.turns[index] ?? 0} role="attacker" frame={frame}>
            {card(spot, rect)}
          </FlyingCard>
        );
      })}
      {Array.from({ length: shape.damage }, (_, index) => (
        <BurstToken key={index} stage={stage} index={index} count={shape.damage} now={local} k={k} image={tokens.damage} />
      ))}
      {pill ? <Pill at={stage.attackPill} icon="attack" color={attackColor} text={String(clash.attack)} font={pill} frame={frame} /> : null}
      {/* An undefended hero has no defense to show: the pill stands under a defender or an enemy only. */}
      {pill && !clash.undefended ? <Pill at={stage.targetPill} icon="defense" color={t.gold} text={String(clash.defense)} font={pill} frame={frame} bounce={blocked} /> : null}
      {word && blocked ? <Word at={stage.word} text="Blocked" font={word} opacity={wordOpacity} /> : null}
      {word && stage.more ? <Word at={stage.more} text={`+${plan.more}`} font={word} opacity={moreOpacity} /> : null}
    </Group>
  );
}

/**
 * The layer over the table while the spotlight plays: the night over the canvas (65%), then each attack in turn. `progress` is the
 * 0..1 clock over the whole run at the motion scale `k`.
 */
export function Spotlight({ plan, progress, width, height, ...common }: Common & { plan: SpotlightPlan; progress: SharedValue<number>; width: number; height: number }) {
  const { k } = common;
  const run = beatsAt(k).end;
  const total = Math.max(1, Math.ceil(plan.span * k));
  const now = useDerivedValue(() => progress.get() * total);
  const night = useDerivedValue(() => SHAPE.spotlightNight * scrimAt(now.get(), k, plan.clashes.length));
  return (
    <Group>
      <RoundedRect x={0} y={0} width={width} height={height} r={0} color={t.night} opacity={night} />
      {plan.clashes.map((clash, index) => (
        <ClashView key={`${plan.seq}:${index}`} plan={clash} start={index * run} run={run} now={now} {...common} />
      ))}
    </Group>
  );
}
