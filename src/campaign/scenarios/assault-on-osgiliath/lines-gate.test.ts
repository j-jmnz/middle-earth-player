// Rules: rr.then, rr.action, rr.search, faq.reveal-and-add, ats.losing-control-of-locations (data/rules/entries.json); ledger line 06096:A:1.
// West Gate: "Action: If there is no active location, search the encounter deck and discard pile for an Osgiliath location, reveal it and add it to the staging area. Then, make West Gate the active location. Shuffle the encounter deck."
// The text before "Then" must be resolved in full before the rest is (rr.then): a search that finds no Osgiliath location leaves West Gate where it is. Built on the real Action, in the planning phase and from a location the first player controls.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { idOf, legalIntents, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, cardOf, drive, opened, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";

const ACTION = "06096:action:1";
const actionOf = (made: { state: Parameters<typeof legalIntents>[0]; ctx: Parameters<typeof legalIntents>[1] }) => legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === ACTION);

/** West Gate in the staging area, no active location: the Action is used in the planning phase until an active location exists (or the phase is over). */
function used(deck: readonly string[], discard: readonly string[], effects: readonly Effect[]) {
  const made = table({ phase: "Planning", staging: [CODES.westGate], deck, discard }, effects);
  const trigger = actionOf(made);
  expect(trigger).toBeDefined();
  return { made, run: drive(made, send(opened(made), trigger as PlayerIntent, made.ctx), (state) => state.activeLocation != null || state.phase !== "Planning") };
}

lineSpec("06096:A:1", "reveals the Osgiliath location the search finds, in the encounter deck or its discard pile, adds it to the staging area and makes West Gate the active location", (effects) => {
  const deck = used(["f0", CODES.harbor, "f0"], [], effects);
  expect(deck.run.state.activeLocation).toBe(idOf(deck.run.state, CODES.westGate));
  expect(where(deck.run.state, CODES.harbor)).toBe("staging");
  const pile = used(["f0", "f0"], [CODES.harbor], effects);
  expect(where(pile.run.state, CODES.harbor)).toBe("staging");
  expect(pile.run.state.activeLocation).toBe(idOf(pile.run.state, CODES.westGate));
});

lineSpec("06096:A:1", "does not make West Gate the active location when the search finds no Osgiliath location (rr.then), and shuffles the deck all the same", (effects) => {
  const { made, run } = used(["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0"], [], effects);
  expect(run.state.activeLocation).toBeNull();
  expect(where(run.state, CODES.westGate)).toBe("staging");
  expect(run.state.encounterDeck).not.toEqual(made.state.encounterDeck);
  expect([...run.state.encounterDeck].sort()).toEqual([...made.state.encounterDeck].sort());
});

lineSpec("06096:A:1", "is used from West Gate while the first player controls it: it leaves his play area, so he loses control", (effects) => {
  // The quest phase explores West Gate (Ancient Harbor stays in the staging area: with no Osgiliath location left the players would win at the end of the round); the next planning phase is the first window where an Action is offered again.
  const made = table({ phase: "Quest", active: { code: CODES.westGate, progress: 4 }, committed: ["dh1", "dh2"], staging: [CODES.harbor], deck: ["f0", "f0", "f0", CODES.eastQuarter, "f0", "f0"] }, effects);
  const quested = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Planning" && state.window?.kind === "pass");
  expect(cardOf(quested.state, CODES.westGate)).toMatchObject({ zone: "play", controller: 0 });
  const trigger = actionOf({ state: quested.state, ctx: made.ctx });
  expect(trigger).toBeDefined();
  const run = drive(made, send(quested, trigger as PlayerIntent, made.ctx), (state) => state.activeLocation != null);
  expect(cardOf(run.state, CODES.westGate)).toMatchObject({ zone: "activeLocation", progress: 0, controller: null });
  expect(run.state.modifiers.some((modifier) => modifier.stat === "controlSeat")).toBe(false);
});
