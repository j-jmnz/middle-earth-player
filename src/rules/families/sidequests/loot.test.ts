// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.explored, rr.setup (data/rules/entries.json). The Rules Reference has no contract
// span; the reading of The Burglar's Turn (22024) is documented in sidequests/loot.ts.
import { describe, expect, it } from "vitest";

import { RECORDS as COSTS } from "../../../effects/authored/families/costs.ts";
import { RECORDS as QUEST } from "../../../effects/authored/families/quest.ts";
import { RECORDS } from "../../../effects/authored/families/sidequests.ts";
import { deckRulesOf } from "../../../catalog/deck-rules.ts";
import { codes, fixtureDefinition } from "../../core/test-fixture.ts";
import { destroyCard, modifiedStat } from "../../core/keywords.ts";
import { definePrinted } from "../../core/printed.ts";
import { reduce, startScenario } from "../../engine/reduce.ts";
import { matchesPick } from "../../interpret/pick.ts";
import { playCost } from "../../player/attach.ts";
import { queueEvent } from "../../windows/queue.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { put, run, send, SIDE_CARDS, synced } from "./fixture.ts";
import { lootUnder } from "./loot.ts";

const LOOT = ["rblade", "rblade", "rblade"];
const filler = codes("f", 20);
const TRAVELER = "19059";
const HUNTER = "19087";
const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const), [TRAVELER, definePrinted({ code: TRAVELER, name: "Forest Road Traveler", type: "ally", sphere: "spirit", cost: 2, willpower: 1, attack: 1, defense: 1, health: 2 })] as const, [HUNTER, definePrinted({ code: HUNTER, name: "Mirkwood Hunter", type: "ally", sphere: "tactics", cost: 4, willpower: 1, attack: 3, defense: 1, health: 3 })] as const]);
const ctx = { effects: [...RECORDS, ...QUEST.filter((record) => record.cardCode === TRAVELER), ...COSTS.filter((record) => record.cardCode === HUNTER)], cards };

function started(): ScenarioState {
  const opening = startScenario(
    { seatCount: 1, seed: 7, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["22024", ...filler], loot: LOOT }], encounterDeck: [], questDeck: ["stage"] },
    ctx,
  );
  // Hero and contract Setup resolve once the opening hands are kept.
  const kept = reduce(opening, { type: "Keep" }, ctx);
  return kept.ok ? kept.state : opening;
}

describe("The Burglar's Turn (22024)", () => {
  it("side A forbids attachments in the deck (22024:A:1)", () => {
    const record = RECORDS.find((entry) => entry.id === "22024:constant:1");
    expect(record).toBeDefined();
    expect(deckRulesOf([record!], ["22024"]).some((rule) => rule.kind === "noCards")).toBe(true);
  });

  it("Setup builds the loot deck out of play and flips the contract (22024:A:2)", () => {
    const state = started();
    const contract = Object.values(state.cards).find((card) => card.code === "22024");
    expect(contract?.face).toBe("B");
    expect(state.lootDecks?.[0]).toHaveLength(LOOT.length);
    for (const id of state.lootDecks?.[0] ?? []) expect(state.cards[id]).toMatchObject({ zone: "setAside", owner: 0, controller: 0 });
  });

  it("travelling to a location attaches the top loot card to it, and it counts for the quest points (22024:B:1, B:2)", () => {
    const made = put(started(), "forest-road", "play");
    const loc = made.id;
    const active: ScenarioState = updateCard({ ...made.state, activeLocation: loc }, loc, { zone: "activeLocation" });
    const before = synced(active, ctx);
    const traveled = synced(run(queueEvent(before, { trigger: "traveled", seat: 0, subject: loc }), ctx), ctx);
    const under = lootUnder(traveled, loc);
    expect(under).toHaveLength(1);
    expect(traveled.cards[under[0] ?? ""]).toMatchObject({ zone: "under", face: "up", controller: 0 });
    expect(traveled.lootDecks?.[0]).toHaveLength(LOOT.length - 1);
    const base = modifiedStat(before, before.cards[loc]!, "questPoints", cards);
    expect(modifiedStat(traveled, traveled.cards[loc]!, "questPoints", cards)).toBe(base + 1);
  });

  it("exploring the location offers each guarded attachment: into play or the hand (22024:B:3)", () => {
    const made = put(started(), "forest-road", "play");
    const loc = made.id;
    const active: ScenarioState = updateCard({ ...made.state, activeLocation: loc }, loc, { zone: "activeLocation" });
    const traveled = synced(run(queueEvent(synced(active, ctx), { trigger: "traveled", seat: 0, subject: loc }), ctx), ctx);
    const loot = lootUnder(traveled, loc)[0] ?? "";
    const explored = run(queueEvent(traveled, { trigger: "activeExplored", seat: null, subject: loc }), ctx);
    expect(explored.window?.kind).toBe("choose");
    const answered = send(explored, { type: "Choose", optionId: "hand" }, ctx);
    expect(answered.cards[loot]?.zone).toBe("hand");
  });

  // "Forest Road Traveler gets +1 Willpower, +1 Attack, and +1 Defense for each attachment on the active location." (19059:A:1), "a
  // location ... with a player card attachment" (19034:A:1) and "draw 1 card for each attachment on it" (19026:A:2) read the loot
  // as the contract does: an attachment attached to the location (22024:B:1). So does "Reduce the cost to play Mirkwood Hunter by 1
  // for each attachment on the active location." (19087:A:2).
  it("the loot on a location is an attachment on it for the cards that count or ask for one (22024:B:2, 19059:A:1)", () => {
    const made = put(started(), "forest-road", "play");
    const loc = made.id;
    const ally = put(made.state, TRAVELER, "play");
    const hunter = put(updateCard(ally.state, ally.id, { owner: 0, controller: 0 }), HUNTER, "hand");
    const active: ScenarioState = updateCard({ ...updateCard(hunter.state, hunter.id, { owner: 0, controller: 0 }), activeLocation: loc }, loc, { zone: "activeLocation" });
    const before = synced(active, ctx);
    const stats = (state: ScenarioState) => (["willpower", "attack", "defense"] as const).map((which) => modifiedStat(state, state.cards[ally.id]!, which, cards));
    const withAttachment = { type: "location", control: "any", hasAttachment: { playerCard: true } } as const;
    const at = { seat: 0, sourceId: ally.id };
    expect(stats(before)).toEqual([1, 1, 1]);
    expect(matchesPick(before, loc, withAttachment, at, ctx)).toBe(false);
    expect(playCost(before, hunter.id, 0, ctx)).toBe(4);
    const traveled = synced(run(queueEvent(before, { trigger: "traveled", seat: 0, subject: loc }), ctx), ctx);
    expect(stats(traveled)).toEqual([2, 2, 2]);
    expect(matchesPick(traveled, loc, withAttachment, at, ctx)).toBe(true);
    expect(playCost(traveled, hunter.id, 0, ctx)).toBe(3);
    // The explored location tells the cards that hear it how many attachments it had, the loot with them.
    const explored = destroyCard(traveled, loc, cards, [], true);
    expect(explored.pendingEvents?.find((event) => event.trigger === "activeExplored")).toMatchObject({ subject: loc, amount: 1 });
  });
});
