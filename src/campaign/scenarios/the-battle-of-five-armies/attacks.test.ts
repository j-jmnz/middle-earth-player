// Rules: rr.engaged, rr.attacks-outside-the-combat-phase, rr.cancel, rr.reveal (data/rules/entries.json); ledger lines 132064:A:1, 132064:A:2, 132065:A:1, 132065:A:2
// The immediate attacks and the Shadow cards of Hatred Rekindled and Goblins are Upon You!. Each test starts its title with the line id.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { countMatching } from "../../../rules/interpret/pick.ts";
import { fightEnemy, first, legalIntents, resolveRecords, revealedTop, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-battle-of-five-armies";
const [S1, , , , S5] = ["132075", "132076", "132077", "132078", "132079"] as const;
const table = (layout: Layout = {}) => tableFromLayout(ID, { stage: S1, ...layout });

describe("The attacks (132064:A:1, 132064:A:2)", () => {
  it("132064:A:1 each enemy engaged with a player attacks at once, and no shadow card is dealt for it", () => {
    const made = table({ staging: ["132064"], engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "f0", "f0"], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, "132064", "whenRevealed", first(made.state, "132064"));
    expect(run.state.pendingAttack?.enemyId).toBe(first(made.state, "f3"));
    // An attack was made, so the card gains no surge: nothing is revealed from the deck.
    expect(run.state.encounterDeck).toHaveLength(3);
  });

  it("132064:A:1 at stage 5 Bolg, considered engaged with the first player in the staging area, makes an immediate attack on him, with no shadow card", () => {
    for (const seats of [1, 2] as const) {
      const made = table({ seats, stage: S5, staging: ["132053", "132064"], deck: ["f0", "f0", "f0"], phase: "Encounter" });
      const run = resolveRecords(made.state, made.ctx, "132064", "whenRevealed", first(made.state, "132064"));
      expect(run.state.pendingAttack?.enemyId).toBe(first(made.state, "132053"));
      expect(run.state.pendingAttack?.seat).toBe(made.state.firstPlayer);
      expect(run.state.cards[first(run.state, "132053")]?.zone).toBe("staging");
      expect(run.state.encounterDeck).toHaveLength(3);
    }
  });

  it("132064:A:1 before stage 5 Bolg is engaged with nobody, so with no engaged enemy the card gains surge", () => {
    const made = table({ stage: S1, staging: ["132053", "132064"], deck: ["f0", "f0", "f0"], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, "132064", "whenRevealed", first(made.state, "132064"));
    expect(run.state.pendingAttack).toBeNull();
  });

  it("132064:A:1 with no enemy engaged with a player the card gains surge: the next encounter card is revealed", () => {
    const made = table({ staging: [], deck: ["132064", "f0", "f3"] });
    const state = revealedTop(made, "132064");
    expect(state.staging.some((id) => state.cards[id]?.code === "f0")).toBe(true);
  });

  it("132064:A:2 Shadow: the attacking enemy makes an additional attack at once", () => {
    const damage = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "132055", {});
      return fought.run.state.cards[fought.made.hero]?.damage ?? 0;
    };
    // The hero that defended the first attack is exhausted, so the additional attack is undefended: Attack 3 on top of the 1 damage of the first.
    expect(damage("132064") - damage("f0")).toBe(3);
  });
});

describe("Goblins are Upon You! (132065:A:1, 132065:A:2)", () => {
  // A Response on a card in play that cancels the When Revealed effects of the card just revealed; true when it is offered for the revealed card.
  const cancels: Effect = { id: "blade:response:9", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const offered = (revealed: string): boolean => {
    const made = table({ deck: ["f0", "f0"] });
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, cancels], cards: new Map([...made.ctx.cards, ["blade", definePrinted({ code: "blade", name: "Blade", type: "attachment" })]]) };
    const blade = spawn(made.state, "blade", { zone: "play", seat: 0 });
    const held = attachTo(blade.state, blade.id, made.hero);
    const revealing = revealFromTop(held, ctx, revealed, []);
    return legalIntents(revealing.state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === blade.id);
  };

  it("132065:A:1 its When Revealed effect cannot be canceled, as one of another card can", () => {
    expect(offered("132058")).toBe(true);
    expect(offered("132065")).toBe(false);
  });

  it("132065:A:1 each player searches the encounter deck and discard pile for a Goblin enemy and engages it", () => {
    const made = table({ deck: ["f0", "132055", "f0"], discard: ["132056"], staging: ["132065"] });
    const run = resolveRecords(made.state, made.ctx, "132065", "whenRevealed", first(made.state, "132065"));
    const engaged = Object.values(run.state.cards).filter((card) => card.zone === "engaged").map((card) => card.code);
    expect(engaged).toHaveLength(1);
    expect(["132055", "132056"]).toContain(engaged[0]);
  });

  it("132065:A:2 Shadow: the attacking enemy gets +1 Attack for each Goblin enemy engaged with the defending player", () => {
    const attackOf = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "f3", { engaged: [{ code: "f3", seat: 0 }, { code: "132055", seat: 0 }, { code: "132056", seat: 0 }] });
      return modifiedStat(fought.during, fought.during.cards[first(fought.during, "f3")]!, "attack", fought.ctx.cards);
    };
    expect(attackOf("132065") - attackOf("f0")).toBe(2);
  });

  it("132065:A:2 at stage 5 Bolg, a Goblin considered engaged with the first player, is one of the Goblin enemies engaged with him and not with the other player", () => {
    const made = table({ seats: 2, stage: S5, staging: ["132053"], engaged: [{ code: "132055", seat: 0 }] });
    const synced = syncConstants(made.state, made.ctx);
    const goblins = { type: "enemy", control: "any", engaged: "you", trait: "Goblin" } as const;
    expect(countMatching(synced, goblins, 0, null, made.ctx)).toBe(2);
    expect(countMatching(synced, goblins, 1, null, made.ctx)).toBe(0);
    const before = syncConstants(table({ seats: 2, stage: S1, staging: ["132053"], engaged: [{ code: "132055", seat: 0 }] }).state, made.ctx);
    expect(countMatching(before, goblins, 0, null, made.ctx)).toBe(1);
  });
});
