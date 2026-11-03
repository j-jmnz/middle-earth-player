// Rules: rr.limits, rr.resource-match, rr.action, rr.campaign-pool, rr.campaign-log (data/rules/entries.json). The four Adaptation boons of The Oath (41044 to
// 41047, ledger data/printed/mirkwood-paths.json) and the once-per-campaign limit: "Limit once per campaign. Record in Campaign Log when used."
// The tests run the records on a table of plain-number heroes (scripts/oath-scene.ts), with the boon attached to the first hero.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { legalIntents } from "../rules/engine/legal.ts";
import { heroPays } from "../rules/player/payments.ts";
import type { PlayerIntent } from "../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { loadOathWorld, oathTable, settleChoices, type OathLayout, type OathWorld } from "../../scripts/oath-scene.ts";
import { first, send, start } from "../../scripts/past-scene.ts";

let world: OathWorld;

beforeAll(async () => {
  world = await loadOathWorld();
});

function make(layout: OathLayout = {}) {
  const made = oathTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;
const offerOf = (made: Table, state: ScenarioState, code: string) => legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && state.cards[intent.cardId]?.code === code) as PlayerIntent | undefined;
const use = (made: Table, state: ScenarioState, code: string, payments: { heroId: string; amount: number }[] = []) => {
  const offer = offerOf(made, state, code);
  if (offer?.type !== "Trigger") throw new Error(`${code} is not offered`);
  return settleChoices(send(start(state), payments.length > 0 ? { ...offer, payments } : offer, made.ctx), made.ctx);
};

describe("the Adaptations' resource icons (41044:A:2 to 41047:A:2)", () => {
  it("give the attached hero the icon of its sphere, and no other hero", () => {
    for (const [code, sphere] of [["41044", "lore"], ["41045", "tactics"], ["41046", "spirit"], ["41047", "leadership"]] as const) {
      const made = make({ attachments: [code] });
      expect(heroPays(made.state, made.hero, sphere, made.ctx), code).toBe(true);
      expect(heroPays(made.state, made.hero2, sphere === "tactics" ? "lore" : sphere, made.ctx), code).toBe(false);
    }
    expect(heroPays(make().state, make().hero, "lore", make().ctx)).toBe(false);
  });
});

describe("The Fervor of Lore (41044:A:3)", () => {
  it("discards 3 cards from the hand to heal all damage from a hero, and records the use in the Campaign Log", () => {
    const made = make({ attachments: ["41044"], hand: ["filler", "ally", "blade", "filler"], damage: [["dh1", 4]] });
    expect(offerOf(made, made.state, "41044")).toBeDefined();
    const done = use(made, made.state, "41044");
    expect(done.state.cards[made.hero]?.damage).toBe(0);
    expect(done.state.seats[0].hand).toHaveLength(1);
    expect(done.state.seats[0].discard).toHaveLength(3);
    expect(done.state.campaignFacts?.usedOnce).toEqual(["41044"]);
    expect(causeProblems(done.steps)).toEqual([]);
    // Used: not offered again in this game, even with cards in hand and damage on a hero.
    const again = updateCard({ ...done.state, window: { kind: "pass" } }, made.hero, { damage: 3 });
    expect(offerOf(made, again, "41044")).toBeUndefined();
  });

  it("is not offered with fewer than 3 cards in hand, or with no damaged hero", () => {
    expect(offerOf(make({ attachments: ["41044"], hand: ["filler", "ally"], damage: [["dh1", 4]] }), make({ attachments: ["41044"], hand: ["filler", "ally"], damage: [["dh1", 4]] }).state, "41044")).toBeUndefined();
    const calm = make({ attachments: ["41044"], hand: ["filler", "ally", "blade"] });
    expect(offerOf(calm, calm.state, "41044")).toBeUndefined();
  });

  it("is not offered when the Campaign Log already records it as used, whichever scenario used it", () => {
    const made = make({ attachments: ["41044"], hand: ["filler", "ally", "blade"], damage: [["dh1", 4]], facts: { usedOnce: ["41044"] } });
    expect(offerOf(made, made.state, "41044")).toBeUndefined();
    // Another Adaptation's use does not block it.
    const other = make({ attachments: ["41044"], hand: ["filler", "ally", "blade"], damage: [["dh1", 4]], facts: { usedOnce: ["41045"] } });
    expect(offerOf(other, other.state, "41044")).toBeDefined();
  });
});

describe("The Might of Tactics (41045:A:3)", () => {
  it("deals 1 damage to the attached hero to deal 3 damage to an enemy engaged with the player, once per campaign", () => {
    const made = make({ attachments: ["41045"], engaged: [{ code: "grunt", seat: 0 }] });
    const done = use(made, made.state, "41045");
    expect(done.state.cards[made.hero]?.damage).toBe(1);
    expect(done.state.cards[first(done.state, "grunt")]?.damage).toBe(3);
    expect(done.state.campaignFacts?.usedOnce).toEqual(["41045"]);
    expect(offerOf(made, { ...done.state, window: { kind: "pass" } }, "41045")).toBeUndefined();
  });

  it("is not offered with no enemy engaged with the player", () => {
    const made = make({ attachments: ["41045"], staging: ["grunt"] });
    expect(offerOf(made, made.state, "41045")).toBeUndefined();
  });
});

describe("The Power of Spirit (41046:A:3)", () => {
  it("exhausts the attached hero to place 3 progress on a location, once per campaign", () => {
    const made = make({ attachments: ["41046"], staging: ["place"] });
    const done = use(made, made.state, "41046");
    expect(done.state.cards[made.hero]?.exhausted).toBe(true);
    expect(done.state.cards[first(done.state, "place")]?.progress).toBe(2);
    expect(done.state.campaignFacts?.usedOnce).toEqual(["41046"]);
  });

  it("is not offered with the hero exhausted or with no location in play", () => {
    const tired = make({ attachments: ["41046"], staging: ["place"] });
    expect(offerOf(tired, updateCard(tired.state, tired.hero, { exhausted: true }), "41046")).toBeUndefined();
    const none = make({ attachments: ["41046"] });
    expect(offerOf(none, none.state, "41046")).toBeUndefined();
  });
});

describe("The Secret of Leadership (41047:A:3)", () => {
  it("spends 1 resource from the attached hero's pool to ready a hero, once per campaign", () => {
    const base = make({ attachments: ["41047"], resources: 2 });
    const tired = updateCard(base.state, base.hero2, { exhausted: true });
    const done = use(base, tired, "41047", [{ heroId: base.hero, amount: 1 }]);
    expect(done.state.cards[base.hero]?.resources).toBe(1);
    expect(done.state.cards[base.hero2]?.exhausted).toBe(false);
    expect(done.state.campaignFacts?.usedOnce).toEqual(["41047"]);
  });

  it("is not offered without a resource on the attached hero or without an exhausted hero", () => {
    const poor = make({ attachments: ["41047"], resources: 0 });
    expect(offerOf(poor, updateCard(poor.state, poor.hero2, { exhausted: true }), "41047")).toBeUndefined();
    const rested = make({ attachments: ["41047"], resources: 2 });
    expect(offerOf(rested, rested.state, "41047")).toBeUndefined();
  });
});
