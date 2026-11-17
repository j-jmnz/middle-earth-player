// Rules: rr.damage, rr.forced, rr.cancel (data/rules/entries.json); ledger line 900704:A:1.
// DamageOncePerRound on a table of The Hills of Emyn Muil: Brambles and Thorns deals 1 damage to a character that commits, once a round however many copies are in play, and a copy whose damage a shield prevented leaves the character undealt.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import type { GameEvent } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { fireForced } from "../../windows/triggers.ts";
import { finish, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// Every character commits to the quest: the Forced effects that hear it resolve.
function commits(layout: Layout, shielded = false) {
  const made = tableFromLayout("the-hills-of-emyn-muil", { phase: "Quest", ...layout });
  const hero = made.hero;
  const shield = shielded ? [{ instanceId: hero, sourceId: hero, stat: "damageShield" as const, amount: 1, until: "endOfRound" as const }] : [];
  const event = { trigger: "committed", seat: 0, cardId: hero } as GameEvent;
  const steps: EngineStep[] = [];
  const state = finish({ state: settle(fireForced({ ...made.state, modifiers: [...made.state.modifiers, ...shield], window: null }, event, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
  return { state, hero: state.cards[hero] };
}

describe("900704:A:1 Brambles and Thorns", () => {
  it("900704:A:1 deals the committing character 1 damage, from a copy in the staging area or the active location", () => {
    expect(commits({ staging: ["900704"] }).hero?.damage).toBe(1);
    expect(commits({ active: "900704" }).hero?.damage).toBe(1);
  });

  it("900704:A:1 deals it once a round however many copies are in play", () => {
    expect(commits({ staging: ["900704", "900704"], active: "900704" }).hero?.damage).toBe(1);
  });

  it("900704:A:1 marks the character for the round only once the damage is dealt, so a copy after a prevented damage deals it", () => {
    expect(commits({ staging: ["900704"] }, true).hero?.damage).toBe(0);
    expect(commits({ staging: ["900704", "900704"] }, true).hero?.damage).toBe(1);
    expect(commits({ staging: ["900704"] }).state.modifiers.filter((modifier) => modifier.stat === "damagedByTitle")).toHaveLength(1);
  });
});
