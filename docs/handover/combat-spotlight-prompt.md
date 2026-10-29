# Prompt: combat spotlight redesign (orchestrator)

Paste the block below into a new Claude Code session on branch `ccr-e84b3bf3-yie9hi`.

```text
You are the orchestrating agent for the combat spotlight redesign (user request, 2026-10-29). The plan is docs/plans/combat-spotlight-redesign.md. Read it in full, then CLAUDE.md, .cursor/rules/authority.mdc and the Spotlight paragraph of docs/design-system.md (search for "Spotlight (phase 24"). The plan's decisions are settled: a lone attack is about 2.2 s at Normal, the stage is always dark (Light theme too), a destroyed card burns away, and the cards are centered on the whole screen at 60% of its height. Do not reopen them.

You orchestrate; you don't write the feature yourself. Hand the work to agents:

1. Every agent that writes code is an `implementer` (or `general-purpose`) Agent call with model: "sonnet". No exceptions.
2. Run three implementer tasks one after another. Each must end with `pnpm test`, `pnpm lint` and `tsc --noEmit` green, then you commit and push (git push -u origin ccr-e84b3bf3-yie9hi):
   a. Pure layer: plan §2 (stage geometry), §3 (beats and MOTION tokens), §4 (spotlight-fx.ts, spotlight-particles.ts, spotlight-burn.ts) and every test in the plan's Verification list.
   b. Native layer: plan §1 (full-screen spotlight-layer.native.tsx and web stub, spotlight-handoff.ts, the table-view.tsx wiring, the stage area through buildPlan, the scrim reduced to a skip catcher) and §5 (the Skia pieces, Atlas particles, RuntimeEffect burn with its fallback, the HUD, the fonts).
   c. Docs: plan §6 (design-system.md Spotlight paragraph, beats table and Motion rows; the "no new motion" exception; the phase-24 superseded note; a STATUS.md section "Combat spotlight redesign, 2026-10-29 (user request)" with Built, Decided, Checked and Open).
   Give each implementer the sections it owns and the files the earlier tasks produced.
3. One review pass only. After task c, run `reviewer` once on the whole diff and `ux` once (src/play changed). Fix their real findings in one Sonnet implementer task. Then commit and push. Do not run the reviewers again.

Rules that hold throughout:
- Durations live only in MOTION (src/play/motion-tokens.ts).
- Every number on screen comes from the engine (clash.ts).
- src/play never imports src/screens.
- Never commit catalog.db, scans or PDFs.
- Keep the gate, skip, Back, haptic and banner-wait behaviour.
- Quick is ×0.6. Reduced motion, a screen reader and the setting turned off play no spotlight.
- This is a cloud session: no phone, simulator or Maestro. The device checks (the look on Android and iOS, low-end Android cost, the burn shader, Atlas blending) go under Open in STATUS.md and are never marked done.
- If the Skia RuntimeEffect burn or the Atlas particles cannot be made to type-check or test in Node, stop and ask the user. Do not drop an effect silently.
- Do not open a pull request unless the user asks.

Done when:
- all four tasks are committed and pushed to ccr-e84b3bf3-yie9hi;
- pnpm test, pnpm lint, tsc --noEmit and pnpm data:check are green;
- STATUS.md records what was built and what stays open.

Finish with a short report:
- what each task changed;
- the reviewer and ux findings and what was fixed;
- what stays open.
```
