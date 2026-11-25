// Rules: rr.response, rr.staging (data/rules/entries.json); ledger lines 06102:A:2, 06102:A:3.
// Ruined Square: "Response: After an enemy is destroyed, place 1 progress token on Ruined Square" hears every enemy, engaged or in the staging area, and "Forced: After a character leaves play while a player controls Ruined Square, return it to the staging area". Built on real moments:
// Thalin's damage to an enemy as it is revealed, an attack that destroys a hero.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { idOf, legalIntents, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, cardOf, drive, opened, table } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

const THALIN = "01006";
const MORIA_BATS = "04127";
const EOWYN = "01007";
const VANGUARD = "05058";

lineSpec("06102:A:2", "Response: places 1 progress on it after Thalin destroys an enemy in the staging area as it is revealed", (effects) => {
  const made = table({ phase: "Quest", staging: [CODES.square], heroes: [{ code: THALIN, seat: 0 }], committed: [THALIN], deck: [MORIA_BATS, "f0", "f0"] }, effects, [THALIN, MORIA_BATS]);
  const run = send(opened(made), { type: "Pass" }, made.ctx);
  const response = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "06102:response:1");
  expect(response).toBeDefined();
  expect(cardOf(run.state, MORIA_BATS)?.zone).toBe("encounterDiscard");
  expect(cardOf(send(run, response as PlayerIntent, made.ctx).state, CODES.square)?.progress).toBe(1);
});

/** The Orc Vanguard engaged with the first player attacks undefended and destroys Éowyn (3 hit points), with Ruined Square in the zone the layout puts it in. */
function kill(square: { active: { code: string; progress: number } } | { staging: readonly { code: string; progress: number }[] }, effects: readonly Effect[]) {
  const made = table({ phase: "Quest", ...square, committed: ["dh1", "dh2"], heroes: [{ code: EOWYN, seat: 0 }], engaged: [{ code: VANGUARD, seat: 0 }], deck: ["f0", "f0", "f0"] }, effects, [EOWYN, VANGUARD]);
  const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
  const before = run.state;
  const done = drive(made, send(run, { type: "Undefended", heroId: idOf(run.state, EOWYN) }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
  return { before, done: done.state };
}

lineSpec("06102:A:3", "Forced: returns to the staging area, with no progress, after an undefended attack destroys a hero while the first player controls it, and not while it lies in the staging area", (effects) => {
  const { before, done } = kill({ active: { code: CODES.square, progress: 1 } }, effects);
  expect(cardOf(before, CODES.square)).toMatchObject({ zone: "play", controller: 0 });
  expect(cardOf(done, EOWYN)?.zone).toBe("discard");
  expect(cardOf(done, CODES.square)).toMatchObject({ zone: "staging", progress: 0, controller: null });
  // In the staging area nobody controls it: it stays, with its progress.
  const staged = kill({ staging: [{ code: CODES.square, progress: 1 }] }, effects);
  expect(cardOf(staged.done, EOWYN)?.zone).toBe("discard");
  expect(cardOf(staged.done, CODES.square)).toMatchObject({ zone: "staging", progress: 1 });
});
