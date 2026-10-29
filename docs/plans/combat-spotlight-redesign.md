# Combat spotlight redesign

## Context
The combat spotlight (phase 24) plays an attack large when it deals or blocks damage. Today it is drawn inside the table's Skia canvas (`src/play/spotlight.native.tsx`), so the cards sit at 42% of the *canvas* height (about 142 pt on an 844×390 phone), off-centre: left of the dock and under the top bar. The motion is small too: a 10 pt draw-back, an 80 ms hold, a 5 pt shake, small flying tokens and flat pills. It reads as underwhelming.

User request (2026-10-29): a full redesign. Bigger cards in the middle of the screen; modern, smooth and impactful; particles and effects; dark and gritty.

Answers to the clarifying questions:
- A lone attack runs about **2.2 s** at Normal.
- The stage is **always dark**, on the Light theme too.
- A destroyed target **burns away**.

**What stays.** All the engine numbers (`clash.ts`), the gate, skip, Back and banner-wait behaviour (`spotlight-gate.ts`, `use-spotlight.ts`), Quick at ×0.6, reduced motion, the screen reader and the setting turned off (none of these plays a spotlight), and the "one clock, pure worklet arithmetic, no idle loop" architecture.

## Game-feel rules applied (from the online research)
- **Anticipation.** A real wind-up before the strike: draw back, a charge glow, embers drawn toward the attacker. The wind-up promises the hit, so the payoff must be as big as the wind-up.
- **Hit-stop.** 100 ms, both cards frozen. A kill gets a longer stop (Sakurai's "boss stop"). The flash, the haptic and the stop all start on the same frame.
- **Shake (Eiserloh's trauma model).**
  - Only the stage shakes, never the HUD.
  - Offset = max × trauma² × smooth seeded noise, with trauma decaying linearly over 420 ms.
  - Starting trauma: 0.55 + 0.12 per damage, 1.0 on a kill, 0.35 when blocked.
  - Limits: 9 pt and 1.2°.
- **Impact flash.** Warm white over the target only (a radius of about 0.55 of the card height, well under 25% of the screen), peak opacity 0.7, one flash per attack. That stays under 2 flashes per second even at Quick (WCAG 2.3.1 allows 3), and is never saturated red.
- **Particles.**
  - Fixed budgets, additive blending, small sprites with short lives.
  - At most about 90 sprites, drawn in at most 4 `Atlas` draws.
  - No blur filters: every glow is a gradient.
- **Damage number.** Big and near the target. It pops in with an ease-out-back overshoot (to about 1.4, then a spring settle). Color carries meaning: threat red for damage, silver for Blocked, and its own treatment for a kill.
- **Staging.** The two cards fill about 60% of the screen under a heavy vignette and a pool of light. "Tap to skip" now also shows for a lone attack, since the run is longer.

## Approach

### 1. Full-screen layer (mounting)
- **New layer** `src/play/spotlight-layer.native.tsx`, with a web stub `spotlight-layer.tsx` that returns null (the `table-canvas(.native).tsx` pattern).
  - `src/screens/table-view.tsx` renders it right after `<TableLayers>`, before the banner, the preview and the menu.
  - It is always mounted and holds the fonts, token icons, backs, particle sprite texture (`useTexture`) and its own stage-size decodes.
  - It mounts a `<Canvas pointerEvents="none">` (not opaque, so it is a TextureView on Android and stacks correctly) only while a spotlight plays.
- **Handoff** `src/play/spotlight-handoff.ts`: a small vanilla zustand store `{ plan, progress, k, playing, tableImages }`.
  - `TableView` creates it once and passes it to `TableCanvas` and to the layer.
  - `TableCanvas` publishes it from a `useLayoutEffect` keyed on `[plan, playing, k]`.
  - Only the layer subscribes, so neither `TableView` nor the memoized canvas renders again.
  - The `progress` SharedValue is shared by both canvases.
- **Coordinates.** `buildPlan` takes a stage area `{ width, height, origin: { x: insets.left + canvasLayoutX, y: barBottom }, safe: insets }` through a new `TableCanvasProps.stageArea`, memoized in `table-view.tsx`.
  - `canvasLayoutX` comes from the wrapper's existing `onLayout`; it is non-zero when the quest scale shows.
  - `placeOf` adds `origin` to each slot rect.
  - `useSpotlight`'s `sameSize` check also compares the area.
- **What is removed.**
  - The night `RoundedRect` in `Spotlight` goes; the layer draws the backdrop.
  - `SpotlightScrim` (`spotlight-scrim.tsx`) loses its fill, fade and `lingers`. It stays only as the transparent press-in skip catcher over the bar and dock.
  - The canvas's hurry, `live` and `swallow` skip is unchanged.
- **Theme.** The layer always draws with `tableTokensByTheme.dark` (`src/play/tokens.ts`).

### 2. Stage geometry: `src/play/spotlight-stage.ts`, rewritten for the screen
- **Card height:** `h = min(round(0.60·H), 340)` (340 caps it on tablets). That is about 234 pt on a 390 pt phone, against 142 today. The width keeps the table card's aspect.
- **Shrinking:** the stage shrinks when the whole group is wider than the screen less the safe insets less 32 pt.
- **Card centres** are at 0.47·H.
- **Gap** between the cards: `max(28, 0.22w)`.
- **Fan:** up to 3 attackers, stepped 0.32w and turned 6° apart, then the `+n` chip.
- **Shadow card:** at 0.72 scale, bottom-aligned, 20 pt left of the fan.
- **Stat medallions** (r 26) straddle each card's foot.
- **Words and number:**
  - The damage number is Marcellus SC 64 at the target's centre.
  - "Blocked" and "Destroyed" stamp in Marcellus SC 34, turned −8°.
  - The note chip is in Barlow Bold 15 above the bottom safe inset.
  - The card height shrinks if a medallion would touch the chip.
- **Scaling:** lengths stay in logical points ×s, as `scaledStage` does today.
- **Decode size:** `use-spotlight-images.native.ts` moves into the layer and decodes at the target size × the 1.06 punch-in.

### 3. Beats: `src/play/motion-tokens.ts` and `src/play/spotlight-beats.ts`
- **One attack** (`SPOTLIGHT_BEATS`, 2200 ms; the `spotlight` long token becomes 2200):

| Beat | ms | Easing | What happens |
| --- | --- | --- | --- |
| `spotlightEnter` | 350 | outBack-ish / outCubic | The dark comes in; the cards arc from their slots to centre and overshoot slightly; embers start |
| `spotlightRead` | 300 | outCubic | The attack and defense medallions pop in; a shadow card does a real 3D flip (perspective + rotateY) with a glint sweep |
| `spotlightCharge` | 350 | outQuad | The attacker draws back and tilts; a rim glow builds (threat red for an enemy, silver for the players); embers converge on it; the camera pushes in 1.0 → 1.06 |
| `spotlightLunge` | 120 | inCubic | A fast strike with 3 fading afterimages (the same clock read at t − j·16 ms) |
| `spotlightStop` | 100 | – | Hit-stop with everything frozen; `tickImpact` plays; the flash peaks |
| `spotlightImpact` | 480 | linear | Shockwave ring, spark burst, trauma shake, knock-back and red tint on the target, damage number pop, tokens flying to the damage corner and its count popping. Blocked: silver deflection sparks, attacker recoil spring, defense medallion bounce, "Blocked" stamp |
| `spotlightReturn` | 500 | inCubic | Cards back to their slots, glow and embers fade, the dark lifts. A destroyed target instead **burns** (`spotlightBurn` 450, inQuad): a noise-threshold dissolve with an ember rim, ash rising and a "Destroyed" stamp |

- **Later attacks in one moment:** `spotlightSwap` 200 + `spotlightReadAgain` 100 + `spotlightChargeAgain` 200 + Lunge + Stop + Impact = 1200 ms (`SPOTLIGHT_AGAIN`). Only the last attack returns, so three attacks run 4600 ms at Normal and 2760 ms at Quick.
- **Sub-tokens:**
  - Flash and ring: `spotlightFlash` 160, `spotlightRing` 360.
  - Sparks and shake: `spotlightSparks` 450, `spotlightShake` 420.
  - Damage number: `spotlightNumberRise` 140 and `spotlightNumberSettle` spring(260, 0.5).
  - Tokens: `spotlightBurstStep` 90, `spotlightBurstFly` 220.
  - Words and recoil: `spotlightStamp` 160, `spotlightRecoil` spring(320, 0.5).
  - Flip: `spotlightFlip` 300, `spotlightGlint` 260, `spotlightTrailStep` 16.
- **Removed tokens:** Dim, Draw, Hold, DrawAgain, Fall, Scrim, BounceRise and BounceSettle.
- **Timing hooks:** `hitTime` points to `stopAt`, `leaveTime` to `retAt`, and every length goes through `length(token, k)`.
- **New `Frame` fields:** `dark`, `badgeA`/`badgeD`, `charge`, `punch`, `trail`, `flash`, `ring`, `sparkT`, `shakeX`/`shakeY`/`shakeTurn`, `number {scale, alpha, rise}`, `stamp`, `recoil`, `flipAngle`, `glint`, `dissolve`.
- **Spatial constants:** these move out of `SHAPE` into a new `spotlight-shape.ts` if `motion-tokens.ts` grows too large. Durations stay in `MOTION`.

### 4. Pure effect math (new, worklet, Vitest-testable)
- **`src/play/spotlight-fx.ts`:**
  - flash, ring and stamp curves;
  - the trauma shake: `T = max(0, T0 − u)`, offset `max·T²·n(t)`, where n is a sum of seeded sines;
  - the number pop, reusing `popScale` from `motion-curves.ts`;
  - the camera push-in.
- **`src/play/spotlight-particles.ts`:**
  - `hash(i, seed)` uses `Math.imul`.
  - `particleAt(kind, i, t, seed, at)` returns `{x, y, turn, scale, alpha}` in closed form, with no per-frame state.
  - The kinds:
    - `ember`: ambient drift; 24 sprites.
    - `converge`: the charge; 16.
    - `spark`: drag and gravity, streak turned along its velocity; 28.
    - `deflect`: a silver cone back toward the attacker; 18.
    - `ash`: spawns where the burn front passes; 36.
  - The seed is `seq·31 + index`, stored on `ClashPlan`.
- **`src/play/spotlight-burn.ts`:** the `burnField` value noise (2 octaves) in TS. The SkSL string is generated from the same constants, so the ash spawn order can be tested.

### 5. Native pieces (Skia; each file kept small)
- **`spotlight.native.tsx`:** the root, the shake/camera group (stage only; the HUD is outside it) and the clash windows.
- **`spotlight-pieces.native.tsx`:** the flying card (arc, punch, perspective flip), the afterimage trail, the damage corner and the flying tokens. `StageCard` and `CardBody` are reused from `canvas-pieces.native.tsx`.
- **`spotlight-fx.native.tsx`:**
  - full-screen dark and vignette in one radial gradient;
  - pool of light in `blendMode="screen"`;
  - rim glow as a gradient stroke, with no `BlurMask`;
  - the localized flash, the shockwave ring (a stroked circle) and the glint.
- **`spotlight-particles.native.tsx`:** `<Atlas>` emitters through `useRSXformBuffer` / `useColorBuffer` with `blendMode="plus"`, and one sprite texture built with `useTexture`.
- **`spotlight-burn.native.tsx`:** `Skia.RuntimeEffect.Make` as a `<RuntimeShader>` image filter on the target's layer (`uniform shader image`, a threshold uniform and an ember-rim band). If the effect fails to compile (null), it falls back to fade and drop.
- **`spotlight-hud.native.tsx`:** the attack and defense medallions (Marcellus SC numbers and the game icons from `CanvasIcon`), the damage number with a dark outline (`Outlined`), the stamps, the `+n` chip and the "n of m · Tap to skip" / "Tap to skip" note.
- **`table-fonts.native.ts`:** adds the number (64), stamp (34) and note (Barlow Bold 15) fonts to `SpotFonts`.

### 6. Docs
- **`docs/design-system.md`:**
  - Rewrite the Spotlight paragraph and its beats table, and the Motion table rows.
  - Amend "Carved Stone designs no new motion" to name this as a user-request exception (2026-10-29).
  - Record the always-dark stage and the flash and particle budgets.
- **`docs/phases/phase-24-combat-spotlight.md`:** add a "superseded by the 2026-10-29 redesign" note.
- **`docs/phases/STATUS.md`:** add a section "Combat spotlight redesign, 2026-10-29 (user request)" with Built, Decided, Checked and Open. The phone, Android low-end cost and Maestro checks stay **Open**, since a cloud session has no device.

## Notes for the orchestrating agent
- **You orchestrate; you don't write the feature yourself.** Read this plan, `CLAUDE.md`, `.cursor/rules/authority.mdc`, and the Spotlight section of `docs/design-system.md`. Then hand the work to agents.
- **Every implementer you spawn runs on Sonnet.** Pass `model: "sonnet"` on each `implementer` or `general-purpose` Agent call that writes code, so the agent's frontmatter does not win.
- **Split the work into three sequential implementer tasks, each ending green on `pnpm test`, `pnpm lint` and `tsc --noEmit`:**
  1. Pure layer: §2 stage, §3 beats and tokens, §4 fx, particles and burn, and their tests.
  2. Native layer: §1 mounting and handoff, §5 pieces, and the fonts.
  3. Docs: §6.

  Give each implementer the exact sections it owns and the files the earlier task produced.
- **One review pass only.** After task 3, run `reviewer` once on the whole diff and `ux` once, since `src/play` changes. Fix their real findings in a single follow-up implementer task (Sonnet). Do not re-run the reviewers after that.
- **Keep CLAUDE.md's rules.**
  - Durations live only in `MOTION`.
  - Every number on screen comes from the engine (`clash.ts`).
  - `src/play` never imports `src/screens`.
  - Don't commit `catalog.db`, scans or PDFs.
  - Phone, low-end Android and Maestro checks go under **Open** in `docs/phases/STATUS.md`, never marked done.
- **Stop and ask the user** if the Skia `RuntimeEffect` burn or `Atlas` particles can't be made to type-check or test in Node. Don't drop an effect silently.
- **Git.** Develop on `ccr-e84b3bf3-yie9hi`, commit after each green task with a clear message, and push with `git push -u origin ccr-e84b3bf3-yie9hi`. Don't open a PR unless the user asks.

## Verification
- **Checks:** `pnpm test`, `pnpm lint`, `tsc --noEmit` and `pnpm data:check` (unaffected, but CI runs it).
- **Rewritten tests:**
  - `motion-tokens.test.ts`: beats sum to 2200 and 1200, Quick is 1320, every token is ≤ 500 except `spotlight`, the burst fits inside the impact.
  - `spotlight-beats.test.ts`:
    - the hit-stop is frozen for 100 ms;
    - the trauma envelope stays ≤ max·T0², never increases, and reaches 0;
    - Quick at 0.6t equals Normal at t for every field;
    - the trail shows only during the lunge;
    - the dissolve runs only when the target is destroyed;
    - one flash per attack.
  - `spotlight-plan.test.ts`: the 0.6·H height and the 340 cap, the stage centred on the screen and inside the safe area, the origin offset applied, the fan, the shadow card and narrow-screen shrinking.
  - `scale-budgets.test.ts`: the new `stageOf` signature.
- **New tests:**
  - `spotlight-particles.test.ts`: deterministic for a seed, alpha 0 outside a particle's life, sparks start at the contact point, converge reaches the attacker, counts within budget.
  - `spotlight-burn.test.ts`: the field stays in [0, 1], and ash spawns in the order of the burn front.
- **Unchanged and still green:** `spotlight-gate.test.ts`, `clash.test.ts`, `back.test.ts`, `stops.test.ts`.
- **Visual check:** the web build has no canvas. The real look needs a phone or dev build (`pnpm android` / `pnpm android:usb --device`): play scenario 1 to an enemy attack, a blocked attack, a hero kill and a three-attack moment, at Normal and Quick, in Dark and Light, and tap to skip mid-run. This stays Open in STATUS.md from a cloud session.
