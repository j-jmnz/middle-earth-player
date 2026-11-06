// The combat spotlight (docs/design-system-table.md, Spotlight), drawn by the full-screen layer
// (spotlight/layer.native.tsx) on its own canvas over the whole table. When an attack deals or blocks damage black fog closes in, the
// attacker (or a fan of attackers) and the target arc from their slots to the middle, large, side by side; the attacker draws back, charges
// and strikes with afterimages, the stage freezes for the hit stop and then shakes, flashes and sparks, and both go back (a destroyed
// target burns away instead). The plan (spotlight/plan.ts) says who stands where; the beats are arithmetic on one clock
// (spotlight/beats.ts) that the UI thread evaluates, so nothing draws or redraws unless it plays. The stage is the group that shakes and
// pushes in; the words and numbers (spotlight/hud.native.tsx) push in with it about the same pivot but do not shake. Every number is the engine's: it reads the clash,
// never works one out. The layer always draws with the dark theme's tokens.
import { Group, vec, type SkImage, type SkRuntimeEffect } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import type { BackImages, Fonts } from "../canvas/pieces.native.tsx";
import type { IconName } from "../../ui/icon-map.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { rgbOf, type Emitters } from "./atlas.ts";
import { darkAt, frameAt, punchAt, spotlightRun, windowOf, type Frame } from "./beats.ts";
import { BurnLayer } from "./burn.native.tsx";
import { FeetFog, FogDark } from "./fog.native.tsx";
import { Flash, Glint, Pool, RimGlow, Ring } from "./fx.native.tsx";
import { Chip, DamageNumber, Medallion, Note, Stamp } from "./hud.native.tsx";
import { Particles } from "./particles.native.tsx";
import { BurstToken, Corner, FlyingCard, StageCard, Tint, Trail, Veil } from "./pieces.native.tsx";
import type { ClashPlan, SpotlightPlan } from "./plan.ts";
import { SPOT } from "./shape.ts";
import type { SpotFonts } from "../canvas/table-fonts.native.ts";
import type { ThemeName } from "../../ui/theme.ts";
import type { TableTokens } from "../../ui/tokens.ts";

// The sparks leave the point of contact turned a little up from the target's side.
const SPARK_DIR = -0.3;

type Common = {
  images: ReadonlyMap<string, SkImage>;
  // The damage token art, the card backs, the table's faces and the spotlight's.
  damage: SkImage | null;
  backs: BackImages;
  fonts: Fonts;
  spotFonts: SpotFonts;
  // The particle sprite texture (spotlight/particles.native.tsx), and the burn shader, or null when it did not compile.
  texture: SharedValue<SkImage | null>;
  burn: SkRuntimeEffect | null;
  // The dark theme's tokens (the layer always draws with them), the screen's theme (it sets only how deep the flat dark is,
  // spotlight/fog.ts), and the UI scale (ui-scale.ts).
  t: TableTokens;
  theme: ThemeName;
  // Whether the black fog drifts (the Moving fog setting).
  drift: boolean;
  s: number;
  nameOf: (code: string) => string;
  sphereOf: (code: string) => IconName | null;
  k: number;
};

// Attack `index` of `total`, in its own window of the run: it draws only inside it, so the next one waits its turn (and swaps in as it leaves).
function ClashView({ plan, index, total, now, dark, punch, ...common }: Common & { plan: ClashPlan; index: number; total: number; now: SharedValue<number>; dark: SharedValue<number>; punch: SharedValue<number>; area: SpotlightPlan["area"] }) {
  const { k, images, damage, backs, fonts, nameOf, sphereOf, t, s, texture, burn, area } = common;
  const { pill, count, word, number, stamp, note } = common.spotFonts;
  const { stage, shape, clash } = plan;
  const run = windowOf(index, total, k);
  const local = useDerivedValue(() => now.get() - run.start);
  // Outside its window an attack is at rest: one frame, built once, so a hidden attack works nothing out (its particles included).
  const rest = frameAt(shape, -1, k, plan.seed);
  const frame = useDerivedValue((): Frame => {
    const at = local.get();
    return at >= 0 && at < run.length ? frameAt(shape, at, k, plan.seed) : rest;
  });
  const inWindow = useDerivedValue(() => (local.get() >= 0 && local.get() < run.length ? frame.get().fade : 0));
  // The camera pushes in (the run's `punchAt`) about the point the backdrop is lit around, and the stage shakes (Eiserloh's trauma, in
  // logical points) in it. The HUD takes the same push about the same pivot but not the shake, so the medallions stay on the card feet.
  const pivot = vec(area.width / 2, area.height * SPOT.centerY);
  const motion = useDerivedValue(() => {
    const f = frame.get();
    return [{ translateX: f.shakeX * s }, { translateY: f.shakeY * s }, { rotate: f.shakeTurn }, { scale: punch.get() }];
  });
  const camera = useDerivedValue(() => [{ scale: punch.get() }]);
  const moreOpacity = useDerivedValue(() => Math.min(1, frame.get().badgeA));
  const blocked = shape.damage === 0;
  const rim = plan.enemyAttack ? t.threat : t.accent;
  const front = stage.attackers[stage.attackers.length - 1] ?? stage.target;
  const burns = shape.destroyed && burn != null;
  const emitters: Emitters = {
    seed: plan.seed,
    burnMs: (shape.last ? MOTION.spotlightBurn : MOTION.spotlightSwap).ms,
    blocked,
    converge: { x: front.x + front.w / 2, y: front.y + front.h / 2, size: stage.cardH },
    hit: { x: stage.contact.x, y: stage.contact.y, size: stage.cardH, dir: blocked ? Math.PI : SPARK_DIR },
    ash: { x: stage.target.x + stage.target.w / 2, y: stage.target.y + stage.target.h / 2, size: stage.cardH, w: stage.target.w },
    rim: rgbOf(rim),
  };
  const card = (spot: ClashPlan["target"], rect: ClashPlan["stage"]["target"], faceDown = false) => (
    <StageCard spot={spot} rect={rect} image={images.get(spot.code) ?? null} name={nameOf(spot.code)} sphere={sphereOf(spot.code)} fonts={fonts} backs={backs} t={t} s={s} faceDown={faceDown} />
  );
  const flipBack = useDerivedValue(() => (frame.get().flipAngle < Math.PI / 2 ? 1 : 0));
  const flipFace = useDerivedValue(() => (frame.get().flipAngle < Math.PI / 2 ? 0 : 1));
  const targetBody = (
    <>
      {card(plan.target, stage.target)}
      {blocked ? null : <Tint rect={stage.target} frame={frame} t={t} />}
      {shape.destroyed && !burns ? <Veil rect={stage.target} frame={frame} t={t} /> : null}
      {count ? <Corner stage={stage} before={plan.before} after={plan.after} image={damage} font={count} frame={frame} t={t} s={s} /> : null}
    </>
  );
  // The feet bank spans the whole group, the turned shadow card at its left included.
  const feet = { left: Math.min(stage.shadow?.x ?? stage.target.x, stage.target.x, ...stage.attackers.map((rect) => rect.x)), right: stage.target.x + stage.target.w, feet: stage.target.y + stage.cardH, cardH: stage.cardH };
  const centre = (rect: ClashPlan["stage"]["target"]) => ({ cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 });
  const hit = centre(stage.target);
  return (
    <Group opacity={inWindow}>
      <Group transform={motion} origin={pivot}>
        {plan.shadow && stage.shadow ? (
          <FlyingCard spot={plan.shadow} rect={stage.shadow} turn={0} role="shadow" stage={stage} frame={frame} s={s}>
            <Group opacity={flipBack}>{card(plan.shadow, stage.shadow, true)}</Group>
            <Group opacity={flipFace}>
              {card(plan.shadow, stage.shadow)}
              <Glint rect={stage.shadow} frame={frame} />
            </Group>
          </FlyingCard>
        ) : null}
        <FlyingCard spot={plan.target} rect={stage.target} turn={0} role="target" stage={stage} frame={frame} fades={shape.destroyed && !burns} s={s}>
          {shape.destroyed && burn ? (
            <BurnLayer source={burn} rect={stage.target} seed={plan.seed} frame={frame}>
              {targetBody}
            </BurnLayer>
          ) : (
            targetBody
          )}
        </FlyingCard>
        <Trail rect={front} turn={stage.turns[stage.attackers.length - 1] ?? 0} stage={stage} shape={shape} now={local} k={k}>
          {card(plan.attackers[plan.attackers.length - 1] ?? plan.target, front)}
        </Trail>
        {plan.attackers.map((spot, at) => {
          const rect = stage.attackers[at] ?? stage.target;
          return (
            <FlyingCard key={spot.id} spot={spot} rect={rect} turn={stage.turns[at] ?? 0} role="attacker" stage={stage} frame={frame} s={s}>
              <RimGlow rect={rect} color={rim} frame={frame} s={s} />
              {card(spot, rect)}
            </FlyingCard>
          );
        })}
        <FeetFog at={feet} width={area.width} height={area.height} frame={frame} dark={dark} drift={common.drift} start={run.start} k={k} />
        <Particles texture={texture} frame={frame} dark={dark} emitters={emitters} />
        {Array.from({ length: shape.damage }, (_, n) => (
          <BurstToken key={n} stage={stage} index={n} count={shape.damage} now={local} k={k} place={shape} image={damage} t={t} s={s} />
        ))}
        <Ring x={stage.contact.x} y={stage.contact.y} cardH={stage.cardH} frame={frame} s={s} />
        <Flash cx={hit.cx} cy={hit.cy} cardH={stage.cardH} frame={frame} />
      </Group>
      <Group transform={camera} origin={pivot}>
        {pill ? <Medallion at={stage.badgeA} radius={stage.radius} icon="attack" color={rim} text={String(clash.attack)} font={pill} frame={frame} badge="badgeA" t={t} s={s} /> : null}
        {/* An undefended hero has no defense to show: the medallion stands under a defender or an enemy only. */}
        {pill && !clash.undefended ? <Medallion at={stage.badgeD} radius={stage.radius} icon="defense" color={t.accent} text={String(clash.defense)} font={pill} frame={frame} badge="badgeD" t={t} s={s} /> : null}
        {number && !blocked ? <DamageNumber at={stage.number} text={String(shape.damage)} font={number} destroyed={shape.destroyed} frame={frame} cardH={stage.cardH} t={t} s={s} /> : null}
        {stamp && (blocked || shape.destroyed) ? <Stamp at={stage.stamp} text={blocked ? "Blocked" : "Destroyed"} font={stamp} color={blocked ? t.accent : t.threat} frame={frame} t={t} s={s} /> : null}
        {word && stage.more ? <Chip at={stage.more} text={`+${plan.more}`} font={word} t={t} s={s} opacity={moreOpacity} /> : null}
      </Group>
      {note ? <Note at={stage.note} text={total > 1 ? `${index + 1} of ${total} · Tap to skip` : "Tap to skip"} font={note} t={t} s={s} opacity={dark} /> : null}
    </Group>
  );
}

/**
 * The spotlight on the layer's canvas while it plays: the dark (black fog closing in from the edges) and a pool of light over the whole screen, then each
 * attack in turn. `progress` is the 0..1 clock over the whole run at the motion scale `k`.
 */
export function Spotlight({ plan, progress, ...common }: Common & { plan: SpotlightPlan; progress: SharedValue<number> }) {
  const { k, t } = common;
  const { width, height } = plan.area;
  const { clashes } = plan;
  // Not `Math.max(1, …)`: the React Compiler fails to generate a call on a global's method here.
  const run = spotlightRun(clashes.length, k);
  const total = run > 1 ? run : 1;
  const now = useDerivedValue(() => progress.get() * total);
  const dark = useDerivedValue(() => darkAt(now.get(), k, clashes.length));
  const punch = useDerivedValue(() => punchAt(now.get(), k, clashes.length));
  const first = clashes[0]?.stage;
  return (
    <Group>
      <FogDark width={width} height={height} dark={dark} now={now} drift={common.drift} theme={common.theme} t={t} />
      {first ? <Pool cx={width / 2} cy={first.target.y + first.target.h / 2} cardH={first.cardH} dark={dark} t={t} /> : null}
      {clashes.map((clash, index) => (
        <ClashView key={`${plan.seq}:${index}`} plan={clash} index={index} total={clashes.length} now={now} dark={dark} punch={punch} area={plan.area} {...common} />
      ))}
    </Group>
  );
}
