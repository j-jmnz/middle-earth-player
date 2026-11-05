import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../../rules/core/test-fixture.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";

import { sheetFor } from "../choice/sheets.ts";
import type { SheetNames } from "../choice/sheet-types.ts";
import { wilderlandAsk, wilderlandOptionLabel } from "./wilderland.ts";

// Rules: emce.treasure, rr.guarded (data/rules/entries.json). What the choice sheet says when the players look at random undiscovered treasures: each option is the treasure's title and
// its picture, and the sentence names the card that guards it.
const cards = cardMap([
  hero("frodo", "lore"),
  definePrinted({ code: "stage", name: "Stage", type: "quest" }),
  definePrinted({ code: "spawn", name: "Spawn", type: "enemy", threat: 2, engagementCost: 40, attack: 3, defense: 3, health: 9 }),
  definePrinted({ code: "hall", name: "Twilight Hall", type: "location", threat: 2, questPoints: 3 }),
  ...["a", "b", "c", "d"].map((code) => definePrinted({ code: `t${code}`, name: `Treasure ${code.toUpperCase()}`, type: "treasure", campaignKind: "treasure" })),
]);
const ctx = { effects: [], cards };
const ATTACH: Instruction = { verb: "AttachRandomTreasure" };
const names = (): SheetNames => ({ card: (id) => cards.get(id)?.name ?? id, facedown: (id) => id, line: () => null });
const words = { card: (id: string) => (id === "hall-id" ? "Twilight Hall" : id), code: (code: string) => cards.get(code)?.name ?? code, traits: () => [] };

function asked(): ScenarioState {
  let state: ScenarioState = { ...idleScenario(1), seed: 5 };
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  const guard = spawn(state, "hall", { zone: "staging" });
  return settle(pushEffectFrame(guard.state, { frame: "whenRevealed", sourceId: guard.id, actor: 0, peril: false, effectId: "hall:whenRevealed:1", instructions: [ATTACH], cancel: null, blockCancel: null }, []), ctx, []);
}

describe("the treasure choice", () => {
  it("names the guard in its sentence and asks for one of the treasures", () => {
    expect(wilderlandAsk(ATTACH, "hall-id", words)).toEqual({
      verb: "Choose",
      prompt: "Choose 1 of 3 random undiscovered treasures to attach as a guarded objective. Twilight Hall is attached to it, and the players cannot claim it until Twilight Hall is dealt with.",
    });
    // With no card to name, the sentence stands alone.
    expect(wilderlandAsk({ verb: "AttachRandomTreasure", count: 2 }, null, words)?.prompt).toBe("Choose 1 of 2 random undiscovered treasures to attach as a guarded objective.");
    expect(wilderlandAsk({ verb: "Draw" }, "hall-id", words)).toBeNull();
  });

  it("asks which looked-at Loot objective Discover attaches, naming the location", () => {
    expect(wilderlandAsk({ verb: "Discover", amount: 3 }, "hall-id", words)).toEqual({ verb: "Attach", prompt: "Discover: choose 1 Loot objective to attach to Twilight Hall as a guarded objective." });
    expect(wilderlandAsk({ verb: "Discover", amount: 3 }, null, words)?.prompt).toBe("Discover: choose 1 Loot objective to attach to the active location as a guarded objective.");
  });

  it("labels each option with the treasure's title, and no other instruction's", () => {
    expect(wilderlandOptionLabel(ATTACH, "ta", words)).toBe("Treasure A");
    expect(wilderlandOptionLabel({ verb: "Draw" }, "ta", words)).toBeNull();
  });

  it("shows the sheet three tiles titled by the treasure, each with its picture", () => {
    const state = asked();
    const sheet = sheetFor(state, ctx, legalIntents(state, ctx), names());
    if (sheet?.kind !== "pick") throw new Error("expected a pick sheet");
    expect(sheet.options).toHaveLength(3);
    expect(sheet.options.map((option) => option.label).every((label) => /^Treasure [A-D]$/.test(label))).toBe(true);
    expect(sheet.options.map((option) => option.code)).toEqual(sheet.options.map((option) => option.id));
    expect(sheet.note).toContain("Choose 1 of 3 random undiscovered treasures to attach as a guarded objective.");
  });
});

// Ruined Supplies (18025:A:2): each branch states the number it counts now, and the damage branch warns about an ally it destroys.
describe("a choice that counts allies", () => {
  const supplies = new Map(cards);
  for (const [code, health] of [["pony", 1], ["bear", 3]] as const) supplies.set(code, definePrinted({ code, name: code === "pony" ? "Pony" : "Bear", type: "ally", sphere: "neutral", cost: 1, willpower: 1, attack: 1, defense: 1, health }));
  const ally = { type: "ally", control: "you" } as const;
  const CHOOSE: Instruction = {
    verb: "Choose",
    who: "actor",
    options: [
      { id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: ally }, who: "actor" }] },
      { id: "damage", instructions: [{ verb: "DamageEach", amount: 1, pick: ally }] },
    ],
  };
  const reduce = { effects: [], cards: supplies };

  function offered(): ScenarioState {
    let state: ScenarioState = { ...idleScenario(1), seed: 5 };
    state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
    for (const code of ["pony", "bear", "bear"]) state = spawn(state, code, { zone: "play", seat: 0 }).state;
    const source = spawn(state, "hall", { zone: "staging" });
    return settle(pushEffectFrame(source.state, { frame: "whenRevealed", sourceId: source.id, actor: 0, peril: false, effectId: "hall:whenRevealed:1", instructions: [CHOOSE], cancel: null, blockCancel: null }, []), reduce, []);
  }

  it("states the threat raised and the damage dealt now, and warns before an ally is destroyed", () => {
    const state = offered();
    const sheet = sheetFor(state, reduce, legalIntents(state, reduce), { ...names(), card: (id) => supplies.get(state.cards[id]?.code ?? "")?.name ?? id });
    if (sheet?.kind !== "pick") throw new Error("expected a pick sheet");
    expect(sheet.options.map((option) => option.label)).toEqual(["Raise your threat by 3 (1 for each ally you control)", "Deal 1 damage to each ally you control (3)"]);
    expect(sheet.options.map((option) => option.caution)).toEqual([undefined, "Tap again: Pony is destroyed"]);
  });
});

// Turayn's Response, Weighed Down and Lost in the Wild: what the sheet asks.
describe("the Wilderland scenario's prompts", () => {
  it("says what Turayn's shield does", () => {
    const pick: Instruction = { verb: "Pick", pick: { type: "character", control: "any", other: true } };
    const shield: Instruction = { verb: "ModifyStat", stat: "damageShield", amount: 1, until: "endOfRound", target: "picked" };
    expect(wilderlandAsk(pick, "turayn-id", words, shield)?.prompt).toBe("Choose another character: the next time it would be dealt damage this round, cancel 1 of that damage.");
  });

  it("asks who gets Weighed Down in a tie only, and says when it discards itself", () => {
    const attach: Instruction = { verb: "AttachSelf", to: { kind: "hero", control: "mostAttachments" } };
    const facts = (options: readonly string[]) => ({ game: idleScenario(1), ctx, options });
    expect(wilderlandAsk(attach, "down", words, undefined, null, facts(["a", "b"]))?.prompt).toBe("Heroes are tied for the most attachments: choose who gets down. That hero is exhausted.");
    expect(wilderlandAsk(attach, "down", words, undefined, null, facts(["a"]))?.prompt).toBe("down attaches to a. That hero is exhausted.");
    let game: ScenarioState = idleScenario(1);
    game = spawn(game, "frodo", { zone: "heroes", seat: 0 }).state;
    const down = spawn(game, "hall", { zone: "attached" });
    const hosted = { ...down.state, cards: { ...down.state.cards, [down.id]: { ...down.state.cards[down.id]!, host: "hero-id" } } };
    const discard: Instruction = { verb: "Pick", pick: { type: "card", control: "any", attachedTo: "host", other: true } };
    const forced = { game: hosted, ctx, options: ["x"] };
    expect(wilderlandAsk(discard, down.id, { ...words, card: (id) => (id === down.id ? "Weighed Down" : "Frodo") }, { verb: "Discard", target: { kind: "picked" } }, null, forced)?.prompt).toBe("Weighed Down: choose an attachment to discard from Frodo.");
    const itself = { ...forced, options: ["x", down.id] };
    expect(wilderlandAsk(discard, down.id, { ...words, card: (id) => (id === down.id ? "Weighed Down" : "Frodo") }, { verb: "Discard", target: { kind: "picked" } }, null, itself)?.prompt).toContain("Weighed Down can discard itself");
  });

  it("names the number, the staging area and the owner when a hand goes under a location (18075:A:1), solo and two-handed", () => {
    const place: Instruction = { verb: "PlaceHandUnderLocation" };
    const withHand = (seats: 1 | 2) => {
      let game: ScenarioState = idleScenario(seats);
      game = spawn(game, "frodo", { zone: "hand", seat: 0 }).state;
      return spawn(game, "frodo", { zone: "hand", seat: 0 }).state;
    };
    expect(wilderlandAsk(place, null, words, undefined, null, { game: withHand(1), ctx, options: ["a", "b"] })?.prompt).toBe(
      "Choose a location in the staging area to put your hand under, 2 cards facedown. It gets +2 quest points, the cards return to your hand when it is explored, and they are discarded if the players advance.",
    );
    expect(wilderlandAsk(place, null, words, undefined, null, { game: withHand(2), ctx, options: ["a", "b"] })?.prompt).toContain("put Player 1's hand under");
  });

  it("names the hit points and the first player when the nemesis is a tie (18076:A:1)", () => {
    const nemesis: Instruction = { verb: "SearchNemesis" };
    let game: ScenarioState = idleScenario(2);
    const one = spawn(game, "spawn", { zone: "spidersDeck" }, "down");
    const two = spawn(one.state, "spawn", { zone: "spidersDeck" }, "down");
    expect(wilderlandAsk(nemesis, null, words, undefined, null, { game: two.state, ctx, options: [one.id, two.id] })?.prompt).toMatch(/^Player 1: 2 enemies are tied for the most hit points \(9\)/);
  });

  it("warns that playing a card discards the hand of the player Lost in the Wild goes to", () => {
    expect(wilderlandAsk({ verb: "AddSourceToHandOfMost" }, "hall-id", words)?.prompt).toContain("Playing a card then discards that player's whole hand");
  });

  it("counts the treasures drawn, and names the host noun of the character step", () => {
    const facts = (options: readonly string[]) => ({ game: idleScenario(1), ctx, options });
    expect(wilderlandAsk(ATTACH, null, words, undefined, null, facts(["ta", "tb"]))?.prompt).toBe("Choose 1 of 2 random undiscovered treasures to attach as a guarded objective.");
    expect(wilderlandAsk({ verb: "ClaimRandomTreasure" }, null, words, undefined, null, facts(["ta"]))).toEqual({ verb: "Choose", prompt: "Choose 1 of 1 random undiscovered treasures to attach to a character." });
    const pick: Instruction = { verb: "Pick", pick: { type: "card", control: "any", hostForPicked: true, who: "firstPlayer" } };
    expect(wilderlandAsk(pick, null, words, { verb: "AttachPicked" })).toEqual({ verb: "Attach", prompt: "Choose a character to attach it to." });
  });
});

