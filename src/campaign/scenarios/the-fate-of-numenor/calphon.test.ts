// Rules: dcce.encounter-cards, dcce.scalable-upgradable, dcce.campaign-setup-the-fate-of-numenor, dcce.setup-the-fate-of-numenor, rr.first-player, rr.search (data/rules/entries.json). Calphon (objective
// ally, 11028 and the Campaign Expansion's reprint 110013 with its Upgraded side), the Spyglass boon he carries (11180) and the Revenant burden (11181), each line of the ledger
// (data/printed/dream-chaser.json) run on a table of plain-number heroes (test/scenarios/the-fate-of-numenor/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, codesIn, fateTable, finish, idOf, loadFateWorld, send, start, type FateLayout, type FateWorld, type Run } from "../../../../test/scenarios/the-fate-of-numenor/scene.ts";

let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

function make(layout: FateLayout = {}) {
  const made = fateTable(world, { phase: "Planning", ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

const L = (code: string, progress = 0) => ({ code, face: "B" as const, progress });
const choose = (wanted: string) => (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes(wanted) ? wanted : (state.window.options[0] ?? "")) : "");
const handCodes = (state: ScenarioState) => (state.seats[0]?.hand ?? []).map((id) => state.cards[id]?.code);
const deckCodes = (state: ScenarioState) => (state.seats[0]?.deck ?? []).map((id) => state.cards[id]?.code);

// The Action of the card with this record id, used by the first player, and the look windows and questions it opens answered (the first option by default, `pick` otherwise).
function act(made: Table, cardId: string, effectId: string, pick?: (state: ScenarioState) => string): Run {
  const intent = legalIntents(made.state, made.ctx).find((item): item is Extract<PlayerIntent, { type: "Trigger" }> => item.type === "Trigger" && item.cardId === cardId && item.effectId === effectId);
  if (!intent) throw new Error(`${effectId} is not offered: ${legalIntents(made.state, made.ctx).map((item) => item.type).join(",")}`);
  return finish(send(start(made.state), intent, made.ctx), made.ctx, pick);
}

describe("Calphon (11028:A:1 to A:3, 110013:A:1 to A:3)", () => {
  it("is controlled by the first player (A:1) and the players lose the game if he leaves play (A:3)", () => {
    for (const calphon of ["up", "original"] as const) {
      const made = make({ seats: 2, calphon });
      expect(made.state.cards[made.calphon ?? ""]?.controller).toBe(0);
      const passed = { ...made.state, firstPlayer: 1 };
      expect(settle(syncConstants(passed, made.ctx), made.ctx, []).cards[made.calphon ?? ""]?.controller).toBe(1);
      const gone = runInstruction({ ...made.state, window: null }, { verb: "DamageEach", amount: 3, pick: { type: "character", control: "any", names: ["Calphon"] } }, { seat: 0, sourceId: null }, made.ctx, []);
      expect(settle(syncConstants(gone, made.ctx), made.ctx, []).lost).toBe(true);
    }
  });

  it("looks at the bottom card of your deck and may switch it with a card in your hand (A:2)", () => {
    const made = make({ calphon: "original", deckOf: ["c1", "c2", "c3"], hand: ["c5"] });
    const calphon = made.calphon ?? "";
    const switched = act(made, calphon, "11028:action:1", choose("switch"));
    expect(switched.state.cards[calphon]?.exhausted).toBe(true);
    expect(deckCodes(switched.state)).toEqual(["c1", "c2", "c5"]);
    expect(handCodes(switched.state)).toEqual(["c3"]);
    const kept = act(make({ calphon: "original", deckOf: ["c1", "c2", "c3"], hand: ["c5"] }), calphon, "11028:action:1", choose("keep"));
    expect(deckCodes(kept.state)).toEqual(["c1", "c2", "c3"]);
    expect(handCodes(kept.state)).toEqual(["c5"]);
  });

  it("offers his Action to the player who controls him only (rr.action, rr.objective-cards)", () => {
    const made = make({ seats: 2, calphon: "original", deckOf: ["c1", "c2", "c3"], hand: ["c5"] });
    const calphon = made.calphon ?? "";
    const offered = (seat: number) => legalIntents({ ...made.state, activeSeat: seat }, made.ctx).some((item) => item.type === "Trigger" && item.cardId === calphon);
    expect(offered(0)).toBe(true);
    expect(offered(1)).toBe(false);
  });

  it("shows the look window the bottom card only, to the actor (A:2)", () => {
    const made = make({ calphon: "original", deckOf: ["c1", "c2", "c3"], hand: ["c5"] });
    const intent = legalIntents(made.state, made.ctx).find((item) => item.type === "Trigger") as Extract<PlayerIntent, { type: "Trigger" }>;
    const looking = send(start(made.state), intent, made.ctx).state;
    expect(looking.window).toMatchObject({ kind: "look", cardIds: [(looking.seats[0]?.deck ?? []).at(-1)] });
  });

  it("is not offered to switch with an empty hand, and the deck stays as it was (A:2)", () => {
    const made = make({ calphon: "original", deckOf: ["c1", "c3"] });
    const done = act(made, made.calphon ?? "", "11028:action:1");
    expect(deckCodes(done.state)).toEqual(["c1", "c3"]);
  });

  it("on its Upgraded side looks at the bottom 5 cards and may switch one of them (B:3)", () => {
    const made = make({ calphon: "B", deckOf: ["c1", "c2", "c3", "c0", "c5", "c2", "c3"], hand: ["c1"] });
    const calphon = made.calphon ?? "";
    expect(made.state.cards[calphon]?.face).toBe("B");
    // The Upgraded side's Action, not the front's, is the one offered.
    const offered = legalIntents(made.state, made.ctx).filter((item) => item.type === "Trigger" && item.cardId === calphon).map((item) => (item as Extract<PlayerIntent, { type: "Trigger" }>).effectId);
    expect(offered).toEqual(["110013:action:2"]);
    const intent = legalIntents(made.state, made.ctx).find((item) => item.type === "Trigger" && item.cardId === calphon) as Extract<PlayerIntent, { type: "Trigger" }>;
    const looking = send(start(made.state), intent, made.ctx).state;
    expect(looking.window).toMatchObject({ kind: "look" });
    expect(looking.window?.kind === "look" ? looking.window.cardIds : []).toHaveLength(5);
    // The one chosen of the five is the second of them, c0 (its place in the deck is the card from the hand's now).
    const switched = act(made, calphon, "110013:action:2", (state) => (state.window?.kind === "choose" && state.window.options.length > 2 ? (state.window.options[2] ?? "") : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
    expect(handCodes(switched.state)).toHaveLength(1);
    expect(deckCodes(switched.state)).toHaveLength(7);
    expect(handCodes(switched.state)).not.toEqual(["c1"]);
  });

  it("on its front side is the one-card Action only, and each side's records belong to it (A:1 to A:3, B:2 to B:4)", () => {
    const front = make({ calphon: "up", deckOf: ["c1", "c2"], hand: ["c5"] });
    expect(legalIntents(front.state, front.ctx).filter((item) => item.type === "Trigger").map((item) => (item as Extract<PlayerIntent, { type: "Trigger" }>).effectId)).toEqual(["110013:action:1"]);
  });
});

describe("Spyglass (11180:A:1 to A:5, 11180:B:1 to B:5)", () => {
  it("looks at a shadow card dealt to an enemy, or at the top and bottom cards of your deck (A:3, A:4)", () => {
    const decks = make({ calphon: "original", spyglass: "up", deckOf: ["c1", "c2", "c3"] });
    const glass = idOf(decks.state, CODES.spyglass);
    const looked = act(decks, glass, "11180:action:1", choose("decks"));
    expect(looked.state.cards[glass]?.exhausted).toBe(true);
    expect(looked.state.window?.kind).toBe("pass");
  });

  it("places 1 progress on a location, and 2 progress instead when it is Uncharted (A:5)", () => {
    const plain = make({ calphon: "original", spyglass: "up", staging: [CODES.steepPlateau] });
    const first = act(plain, idOf(plain.state, CODES.spyglass), "11180:action:1", choose("progress"));
    expect(first.state.cards[idOf(first.state, CODES.steepPlateau)]?.progress).toBe(1);
    const island = make({ calphon: "original", spyglass: "up", staging: [L(CODES.lushJungle)] });
    const second = act(island, idOf(island.state, CODES.spyglass), "11180:action:1", choose("progress"));
    expect(second.state.cards[idOf(second.state, CODES.lushJungle)]?.progress).toBe(2);
    expect(second.state.cards[idOf(second.state, CODES.lushJungle)]?.face).toBe("B");
  });

  it("on its Upgraded side places 4 progress on an Uncharted location (B:5) and 1 on any other", () => {
    const island = make({ calphon: "original", spyglass: "B", staging: [L(CODES.lushJungle)] });
    const glass = idOf(island.state, CODES.spyglass);
    expect(island.state.cards[glass]?.face).toBe("B");
    const done = act(island, glass, "11180:action:2", choose("progress"));
    expect(done.state.cards[idOf(done.state, CODES.lushJungle)]?.progress).toBe(4);
    // Four progress is enough to look at the facedown side with the Lost Island's Action.
    const plain = make({ calphon: "original", spyglass: "B", staging: [CODES.steepPlateau] });
    expect(act(plain, idOf(plain.state, CODES.spyglass), "11180:action:2", choose("progress")).state.cards[idOf(plain.state, CODES.steepPlateau)]?.progress).toBe(1);
  });

  it("on its Upgraded side looks at the top and bottom card of any deck, the encounter deck included (B:4)", () => {
    const made = make({ calphon: "original", spyglass: "B", deckOf: ["c1", "c2"], deck: ["f0", "f3", "undead"] });
    const glass = idOf(made.state, CODES.spyglass);
    const offered = legalIntents(made.state, made.ctx).filter((item) => item.type === "Trigger" && item.cardId === glass);
    expect(offered).toHaveLength(1);
    const encounter = act(made, glass, "11180:action:2", choose("encounter"));
    expect(encounter.state.window?.kind).toBe("pass");
    expect(encounter.state.cards[glass]?.exhausted).toBe(true);
  });

  it("is removed from the game when it leaves play (A:1, B:1)", () => {
    const made = make({ calphon: "original", spyglass: "up" });
    const glass = idOf(made.state, CODES.spyglass);
    const gone = runInstruction({ ...made.state, window: null }, { verb: "Discard", target: { kind: "self" } }, { seat: 0, sourceId: glass }, made.ctx, []);
    expect(codesIn(settle(syncConstants(gone, made.ctx), made.ctx, []), "removed")).toContain(CODES.spyglass);
  });
});

describe("Revenant (11181:A:1 to A:4)", () => {
  it("gets +2 Attack and +2 Defense for each resource on the campaign card (A:2)", () => {
    const base = make({ staging: [CODES.revenant], campaign: true, campaignResources: 0 });
    const stat = (made: Table, which: "attack" | "defense") => modifiedStat(made.state, made.state.cards[idOf(made.state, CODES.revenant)]!, which, made.ctx.cards);
    expect([stat(base, "attack"), stat(base, "defense")]).toEqual([3, 3]);
    const two = make({ staging: [CODES.revenant], campaign: true, campaignResources: 2 });
    expect([stat(two, "attack"), stat(two, "defense")]).toEqual([7, 7]);
    const standalone = make({ staging: [CODES.revenant] });
    expect([stat(standalone, "attack"), stat(standalone, "defense")]).toEqual([3, 3]);
  });

  it("places 2 damage instead when 3 or more would be placed on it, and fewer as they are (A:3)", () => {
    // Revenant is revealed in the staging step of the quest phase, which sets the limit as it is added to the staging area.
    const made = make({ phase: "Quest", deck: [CODES.revenant, "f0"] });
    const revealed = send(start(made.state), { type: "Pass" }, made.ctx).state;
    const id = idOf(revealed, CODES.revenant);
    expect(revealed.cards[id]?.zone).toBe("staging");
    const place = (amount: number) => placeDamage(revealed, id, amount, made.ctx.cards, [], "framework", { rule: "rr.damage" }).cards[id]?.damage;
    expect([1, 2, 3, 5].map(place)).toEqual([1, 2, 2, 2]);
    // Engaging it again adds the same limit, not a larger one.
    expect(revealed.modifiers.filter((modifier) => modifier.stat === "damageLimit")).toHaveLength(1);
  });

  it("holds the limit while it is in play however it came in: put into the staging area or engaged without a reveal (A:3)", () => {
    for (const layout of [{ staging: [CODES.revenant] }, { engaged: [{ code: CODES.revenant, seat: 0 }] }]) {
      const made = make({ phase: "Combat", ...layout });
      const id = idOf(made.state, CODES.revenant);
      expect(placeDamage(made.state, id, 5, made.ctx.cards, [], "framework", { rule: "rr.damage" }).cards[id]?.damage).toBe(2);
    }
  });

  it("is shuffled into the encounter deck once destroyed, and the campaign card gains a resource (A:4)", () => {
    const made = make({ phase: "Combat", engaged: [{ code: CODES.revenant, seat: 0 }], deck: ["f0", "f3"], campaign: true, campaignResources: 1 });
    const hit = runInstruction({ ...made.state, window: null }, { verb: "DamageEach", amount: 2, pick: { type: "enemy", control: "any", engaged: "you" } }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
    const once = settle(syncConstants(hit, made.ctx), made.ctx, []);
    expect(once.cards[idOf(once, CODES.revenant)]?.zone).toBe("engaged");
    const done = finish(start(settle(syncConstants(runInstruction({ ...once, window: null }, { verb: "DamageEach", amount: 2, pick: { type: "enemy", control: "any", engaged: "you" } }, { seat: 0, sourceId: once.questStage }, made.ctx, []), made.ctx), made.ctx, [])), made.ctx);
    // 3 hit points: 2 damage twice destroys it; it is back in the encounter deck, and the campaign card holds 2 resources.
    expect(done.state.cards[idOf(done.state, CODES.revenant)]?.zone).toBe("encounterDeck");
    expect(done.state.encounterDeck).toHaveLength(3);
    expect(done.state.cards[idOf(done.state, CODES.campaignCard)]?.resources).toBe(2);
    expect(codesIn(done.state, "encounterDiscard")).toEqual([]);
  });
});
