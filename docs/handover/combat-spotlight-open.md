# Handover: the combat spotlight's open points

The combat spotlight redesign (user request, 2026-10-29) is built, reviewed and merged to `main`. Every check a cloud session can run is green: `pnpm test`, `pnpm lint`, `tsc --noEmit` and `pnpm data:check`. Nothing native has been seen: a cloud session has no phone, simulator or Maestro, and the web build has no canvas. What is left needs a device. This file says what to look at, where the code is, and what to change if a check fails.

Read first: `docs/plans/combat-spotlight-redesign.md` (the plan), `docs/design-system.md` (Table, **Spotlight**, and the Motion table), and `docs/phases/STATUS.md`, section "Combat spotlight redesign, 2026-10-29 (user request)" (Built, Decided, Checked, Open). The plan's decisions are settled and are not reopened by a device check: a lone attack runs about 2.2 s at Normal, the stage is always dark (Light theme too), a destroyed target burns away, and the cards are centered on the whole screen at 60% of its height.

## Setting up

- `pnpm android` (or `pnpm android:usb --device` when the phone cannot reach Metro over the network) and `pnpm ios`. Both run `catalog:build`, `booklets:pack` and `scans:pack` first; the pictures need `pnpm data:sync scans pictures` once (CLAUDE.md, Data).
- Table settings: Animation speed (Normal, Quick), Theme (Dark, Light), Combat spotlight on, Reduce motion on Follow system with the phone's setting off.
- Scenario 1 reaches each case below within a few rounds. The Maestro save fixtures in `src/campaign/fixtures/` open mid-game; `scripts/e2e-fixtures.ts` can park a new one at a combat moment.

The cases to play, each at Normal and at Quick, in Dark and in Light:
1. An enemy attacks a defender and deals damage.
2. A defender blocks all of it ("Blocked").
3. An enemy attacks an undefended hero (no defense medallion).
4. An attack destroys its target (the burn, the 160 ms kill stop, the "Destroyed" stamp).
5. A moment with three attacks ("2 of 3 · Tap to skip", the swaps, only the last returns).
6. The players attack an enemy with a fan of attackers, and a shadow card turned face up.

## The open points

Each point: what to check, where the code is, and the likely fix if it fails. Record the result in STATUS.md's section (move a point out of Open only when it was seen on a device; say which phone).

### 1. The look on Android and iOS
- Check: the cards fill the middle of the screen, the medallions straddle the card feet, the damage number pops at the target's center, the stamps and the note chip read, nothing runs under the notch or the home indicator, and the top bar and the dock column show dimmed under the stage.
- Code: geometry `src/play/spotlight-stage.ts` and `spotlight-shape.ts` (`SPOT`); drawing `spotlight.native.tsx`, `spotlight-pieces.native.tsx`, `spotlight-hud.native.tsx`.
- If off: change shares in `SPOT`, never durations outside `MOTION` (`src/play/motion-tokens.ts`). `spotlight-plan.test.ts` holds the geometry; update it with the change.

### 2. The Light theme reads dark
- Check: on Light the stage must read as the same dark stage as on Dark, not a grey veil over the bright table. The ux review worked out about 69% night in the middle over Light's felt, which may read grey-brown.
- Code: `SPOT.dark` (0.88) in `spotlight-shape.ts`, `MIDDLE` (0.78) in `spotlight-fx.native.tsx` (`Backdrop`).
- If grey: raise the backdrop on Light only (for example a middle of 0.92 and a most of 0.95). The layer then needs the screen's theme passed in for that alone; it keeps drawing with the Dark tokens.

### 3. Cost on a low-end Android
- Check: a steady frame rate through a three-attack moment and through a burn on the cheapest Android phone at hand (the full-screen canvas over the table canvas, 90 sprites in three `Atlas` draws, the shader). Use the performance monitor or `adb shell dumpsys gfxinfo`.
- Code: `spotlight-particles.native.tsx`, `spotlight-atlas.ts`. A sprite is still worked out twice per slot per frame (once for the transform buffer, once for the color buffer, lines 45 and 55); sharing it was left because it depends on the order the two mappers run in.
- If it drops frames: first share the sprite between the two buffers, then lower the counts in `PARTICLE_COUNT` (`spotlight-particles.ts`; its tests keep the budget). Do not drop an effect without asking the user.

### 4. The burn shader
- Check: on each GPU the destroyed target dissolves from its foot with an ember rim while ash rises where the front passes, and it lines up with the card (not offset or scaled). The rectangle uniform is in local stage points, since Skia's runtime-shader image filter follows the canvas transform.
- Code: `spotlight-burn.native.tsx` (`Skia.RuntimeEffect.Make(BURN_SKSL)`, line 17) and `spotlight-burn.ts` (the SkSL and its TypeScript twin, checked in CanvasKit by `spotlight-burn.test.ts`).
- Fallback: when `Make` returns null the target fades, drops 12 pt and darkens instead. To see it, force `effect = null` locally once; do not commit that.
- If it is offset: log the uniforms and the card's rect from the layer and compare; the fix is in what `BurnLayer` passes, not in the SkSL.

### 5. `Atlas` additive blending
- Check: embers, sparks, deflection sparks and ash glow and add up (`blendMode="plus"`, `colorBlendMode="modulate"`), with no black squares around sprites and no color shifts between Android and iOS.
- Code: `spotlight-particles.native.tsx` (line 61, and `useSpriteTexture` built with `useTexture`).
- If squares show: the sprite texture's alpha is not premultiplied the way `plus` expects; fix the texture, not the blend.

### 6. The shadow card's flip, the glint and the afterimages
- Check: the shadow card turns over in 3D (perspective plus `rotateY`), a glint sweeps it, and three fading afterimages follow the front attacker during the lunge only.
- Code: `spotlight-card.ts` (`flipTurn`, `cardTransform` with `CARD.depth`), `spotlight-pieces.native.tsx` (`Trail`), `spotlight-fx.native.tsx` (glint).

### 7. Stacking on Android
- Check: the spotlight canvas (not opaque, so a TextureView) sits over the table canvas, the top bar and the dock, and under the banner, the preview and the menu. The first frames of the dark coming in are not dropped while the canvas mounts.
- Code: `spotlight-layer.native.tsx` (line 44) and its place right after `<TableLayers>` in `src/screens/table-view.tsx`.

### 8. Tap to skip, Back, the haptic and the banner
- Check, mid-run: a tap on the canvas, a press on the top bar and on the dock each skip every attack of the moment at once, and nothing under them reacts; Android Back skips first; one medium impact haptic at each hit stop; the banner enters only when the spotlight ends or is skipped. Reduce motion, a screen reader and the setting off play none, and the banner shows at once.
- Code: unchanged by the redesign: `spotlight-gate.ts`, `use-spotlight.ts`, `spotlight-scrim.tsx` (now only the press-in catcher).

### 9. Fit on a notched narrow phone and a tablet
- Check: a phone with a notch in landscape (uneven side insets) and an iPad: the card height caps at 340 pt and the group stays inside the safe area.

### 10. Maestro
- No flow plays an attack. Write one in `.maestro/` that opens a fixture parked just before an attack, waits for the spotlight, taps to skip and checks the banner and the damage count. Run it on both platforms.

## Taste items the review left alone

These are not defects; raise them with the user only if the device look supports them: the return's easing (the dark lifts linearly while the cards ease in cubic), the ring and sparks starting after the stop rather than on its first frame, the spark direction, the `+n` chip over the first attacker's cost, and the skip as a hard cut from the dark.

## Prompt for the device session

Paste into a Claude Code session on a machine with a phone attached (not a cloud session):

```text
Work through docs/handover/combat-spotlight-open.md on a device. Read it, CLAUDE.md and .cursor/rules/authority.mdc first. Play each case it lists on Android and iOS, at Normal and Quick, in Dark and Light, and go through open points 1 to 10 in order. Do not reopen the plan's settled decisions. For each point, record what was seen and on which phone in docs/phases/STATUS.md (section "Combat spotlight redesign, 2026-10-29 (user request)"), moving it out of Open only when seen. Fix what fails with the smallest change the point names; durations live only in MOTION, every number on screen comes from the engine, src/play never imports src/screens. Ask before dropping or weakening any effect. pnpm test, pnpm lint, tsc --noEmit and pnpm data:check stay green; commit and push on a new branch, and do not open a pull request unless asked.
```
