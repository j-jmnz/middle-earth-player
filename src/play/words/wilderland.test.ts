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
import { isFreedTreasureClaim, wilderlandAsk, wilderlandBranchWords, wilderlandChooseNote, wilderlandOptionLabel } from "./wilderland.ts";

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
    const withHands = (seats: 1 | 2, counts: readonly number[]) => {
      let game: ScenarioState = idleScenario(seats);
      counts.forEach((count, seat) => {
        for (let index = 0; index < count; index += 1) game = spawn(game, "frodo", { zone: "hand", seat }).state;
      });
      return game;
    };
    expect(wilderlandAsk(place, null, words, undefined, null, { game: withHands(1, [2]), ctx, options: ["a", "b"] })).toEqual({
      verb: "Choose",
      prompt: "Put your 2 cards facedown under a location in the staging area. It gets +2 quest points, the cards return to your hand when it is explored, and are discarded if the players advance.",
    });
    // Player 2's window is open: the sentence leads with Player 2 and her 9 cards, not the first player's 1.
    const two: ScenarioState = { ...withHands(2, [1, 9]), window: { kind: "choose", seat: 1, options: ["a", "b"] } };
    const asks = wilderlandAsk(place, null, words, undefined, null, { game: two, ctx, options: ["a", "b"] });
    expect(asks?.prompt).toMatch(/^Player 2: put your 9 cards facedown under a location in the staging area\. It gets \+9 quest points/);
    expect(asks?.prompt).not.toContain("Player 1");
    expect(asks?.owned).toBe(true);
    const one: ScenarioState = { ...withHands(2, [1, 9]), window: { kind: "choose", seat: 0, options: ["a", "b"] } };
    expect(wilderlandAsk(place, null, words, undefined, null, { game: one, ctx, options: ["a"] })?.prompt).toMatch(/^Player 1: put your 1 card facedown .* the card returns to your hand/);
  });

  it("names the hit points, leading with the first player two-handed and with nothing solo (18076:A:1)", () => {
    const nemesis: Instruction = { verb: "SearchNemesis" };
    const tied = (seats: 1 | 2) => {
      const one = spawn(idleScenario(seats), "spawn", { zone: "spidersDeck" }, "down");
      const two = spawn(one.state, "spawn", { zone: "spidersDeck" }, "down");
      return { game: two.state, options: [one.id, two.id] };
    };
    const { game, options } = tied(2);
    const asks = wilderlandAsk(nemesis, null, words, undefined, null, { game, ctx, options });
    expect(asks?.prompt).toMatch(/^Player 1: 2 enemies are tied for the most hit points \(9\)/);
    expect(asks?.owned).toBe(true);
    const solo = tied(1);
    const alone = wilderlandAsk(nemesis, null, words, undefined, null, { game: solo.game, ctx, options: solo.options });
    expect(alone?.prompt).toMatch(/^2 enemies are tied for the most hit points \(9\)/);
    expect(alone?.owned).toBeUndefined();
  });

  it("names the player and what frees the hero when a hero is carried away (18074:A:1)", () => {
    const pick: Instruction = { verb: "Pick", pick: { type: "hero", control: "you" } };
    const next: Instruction = { verb: "DiscardUntil", pick: { type: "enemy", control: "any" }, to: "staging" } as unknown as Instruction;
    const two: ScenarioState = { ...idleScenario(2), window: { kind: "choose", seat: 1, options: ["h"] } };
    const asks = wilderlandAsk(pick, null, words, next, null, { game: two, ctx, options: ["h"] });
    expect(asks?.prompt).toMatch(/^Player 2: choose 1 hero you control to be carried away\./);
    expect(asks?.prompt).toContain("guards it facedown until that enemy leaves play, then the hero returns exhausted");
    expect(asks?.prompt).not.toContain("holds it");
    expect(asks?.owned).toBe(true);
    const solo = wilderlandAsk(pick, null, words, next, null, { game: idleScenario(1), ctx, options: ["h"] });
    expect(solo?.prompt).toMatch(/^Choose 1 hero you control to be carried away\./);
  });

  it("offers Twilight Hall's search with the card, where it enters and how many treasures it will guard (12168:A:2)", () => {
    const offer: Extract<Instruction, { verb: "Choose" }> = {
      verb: "Choose",
      who: "actor",
      options: [
        { id: "search", instructions: [{ verb: "SearchMove", code: "hall", to: "staging", remember: true }, { verb: "AttachRandomTreasure", to: "picked" }] },
        { id: "decline", instructions: [] },
      ],
    };
    const game = idleScenario(1);
    expect(wilderlandChooseNote(offer, game, ctx, words)).toBe("Search the encounter deck for Twilight Hall? It enters the staging area guarding 1 of 3 random undiscovered treasures.");
    expect(wilderlandBranchWords(offer, "search", words)).toBe("Search for Twilight Hall");
    expect(wilderlandBranchWords(offer, "decline", words)).toBe("Don't search: no treasure this scenario");
    const few = spawn(spawn(spawn(game, "ta", { zone: "setAside" }).state, "tb", { zone: "setAside" }).state, "tc", { zone: "setAside" }).state;
    expect(wilderlandChooseNote(offer, few, ctx, words)).toBe("Search the encounter deck for Twilight Hall? It enters the staging area guarding the 1 random undiscovered treasure.");
    expect(wilderlandChooseNote({ verb: "Choose", who: "actor", options: [{ id: "a", instructions: [] }, { id: "b", instructions: [] }] }, game, ctx, words)).toBeNull();
  });

  it("names the picked guard of a treasure draw, not the stage that ran it, and the guard that left play when the treasure is claimed", () => {
    const draw: Instruction = { verb: "AttachRandomTreasure", to: "picked" };
    const asks = wilderlandAsk(draw, "stage-id", words, undefined, "hall-id", { game: idleScenario(1), ctx, options: ["ta", "tb", "tc"] });
    expect(asks?.prompt).toBe("Choose 1 of 3 random undiscovered treasures to attach as a guarded objective. Twilight Hall is attached to it, and the players cannot claim it until Twilight Hall is dealt with.");
    const treasure = spawn(idleScenario(1), "ta", { zone: "setAside" });
    const claim: Instruction = { verb: "Pick", pick: { type: "card", control: "any", hostForPicked: true, who: "firstPlayer" } };
    const withRecord = { effects: [{ id: "12168:campaignSetup:1", cardCode: "12168", lines: ["12168:A:2"], timing: "campaignSetup", instructions: [{ verb: "SearchGuardForTreasure", code: "hall" }] }], cards } as unknown as typeof ctx;
    const claimed = wilderlandAsk(claim, treasure.id, { ...words, card: () => "Treasure A" }, { verb: "AttachPicked" }, treasure.id, { game: treasure.state, ctx: withRecord, options: ["h"] });
    expect(claimed?.prompt).toBe("Twilight Hall has left play: Treasure A is free of encounters and the players claim it. Choose a character to carry it.");
    expect(isFreedTreasureClaim(treasure.state, ctx, treasure.id, treasure.id)).toBe(true);
    expect(isFreedTreasureClaim(treasure.state, ctx, treasure.id, null)).toBe(false);
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


// Rules: emce.caves-deck, emce.guarded-x (data/rules/entries.json); ledger lines 18043:A:3, 18045:A:2, 18047:A:1, 18048:A:1, 18055:A:2, 18058:A:2, 18080:A:1, 18080:B:2. The choices of The King's Quest.
describe("The King's Quest's choices", () => {
  it("words the Caves look, the Dragon search and the Dragon attachment", () => {
    expect(wilderlandAsk({ verb: "ArrangeCaves", count: 2 }, null, words)?.prompt).toBe("Look at the top 2 cards of the Caves deck: choose the one that stays on top. The other goes to the bottom.");
    expect(wilderlandAsk({ verb: "AttachSearched", type: "treachery", trait: "Dragon", to: "Fire-drake" }, null, words)?.prompt).toBe("Choose a Dragon treachery from the encounter deck or its discard pile to attach to Fire-drake.");
    expect(wilderlandAsk({ verb: "AttachSelf", to: { kind: "enemy", trait: "Dragon" } }, "hall-id", words)?.prompt).toBe("Choose a Dragon enemy to attach Twilight Hall to.");
    expect(wilderlandAsk({ verb: "AttachSelf", to: { kind: "enemy", trait: "Nazgûl" } }, "hall-id", words)).toBeNull();
    expect(wilderlandOptionLabel({ verb: "ArrangeCaves", count: 2 }, "hall-id", words)).toBe("Twilight Hall");
  });

  it("words the picks before the verbs that use them", () => {
    const pick = (spec: Extract<Instruction, { verb: "Pick" }>["pick"]): Instruction => ({ verb: "Pick", pick: spec });
    expect(wilderlandAsk(pick({ type: "card", control: "you", from: "hand" }), null, words, { verb: "GuardPickedAttachment", types: ["location"] })?.prompt).toContain("Artifact attachment in your hand");
    expect(wilderlandAsk(pick({ type: "enemy", control: "any", stagingOnly: true, highestAttack: true }), null, words, { verb: "AttackFromStaging", who: "firstPlayer" })?.prompt).toContain("tied for the highest Attack");
    expect(wilderlandAsk(pick({ type: "hero", control: "any", committed: true }), "hall-id", words, { verb: "AttachSelfToPicked" })?.prompt).toBe("Choose a questing hero of any player to attach Twilight Hall to. It is removed from the quest.");
  });

  it("words the branches that replace a location from the Caves deck and cancel an attack", () => {
    const choose: Extract<Instruction, { verb: "Choose" }> = { verb: "Choose", who: "firstPlayer", options: [{ id: "replace", instructions: [{ verb: "ReplaceFromCaves" }] }, { id: "cancel", instructions: [{ verb: "CancelStrike" }] }] };
    expect(wilderlandBranchWords(choose, "replace", words)).toBe("Discard it and replace it with the top card of the Caves deck");
    expect(wilderlandBranchWords(choose, "cancel", words)).toBe("Cancel the attack: it deals no damage");
  });
});

// Rules: emce.caves-deck, emce.guarded-x (data/rules/entries.json); ledger lines 18043:A:3, 18044:A:1, 18045:A:2, 18047:A:1, 18049:A:2, 18049:A:3, 18057:A:2, 18060:A:1, 18061:A:1, 18064:A:1, 18078:B:1, 18080:B:2, 12172:A:2, 12173:A:2.
// The choices of The King's Quest that a player decides for their own cards or numbers: two-handed they lead with "Player N:" and say `owned`, solo they have no lead; a branch states the number the table holds now.
describe("The King's Quest's seat-by-seat choices and numbers", () => {
  const table = (seats: 1 | 2, code: string): { facts: { game: ScenarioState; ctx: typeof ctx; options: readonly string[] }; source: string } => {
    const base = spawn({ ...idleScenario(seats), seed: 5 }, "hall", { zone: "staging" });
    const state: ScenarioState = { ...base.state, cards: { ...base.state.cards, [base.id]: { ...base.state.cards[base.id]!, code } } };
    return { facts: { game: state, ctx, options: [] }, source: base.id };
  };
  const pick = (spec: Extract<Instruction, { verb: "Pick" }>["pick"]): Instruction => ({ verb: "Pick", pick: spec });

  it("leads with the player and marks the sentence owned two-handed, and has no lead solo", () => {
    const two = table(2, "18044");
    const solo = table(1, "18044");
    const discard = pick({ type: "card", control: "you", from: "discard" });
    expect(wilderlandAsk(discard, two.source, words, { verb: "MovePicked", to: "hand" }, null, two.facts)).toEqual({ verb: "Take", prompt: "Player 1: choose a card from your discard pile to return to your hand.", owned: true });
    expect(wilderlandAsk(discard, solo.source, words, { verb: "MovePicked", to: "hand" }, null, solo.facts)).toEqual({ verb: "Take", prompt: "Choose a card from your discard pile to return to your hand." });
  });

  it("words each player's own cards: the Lost Armory search, the resource, the questing character, the ally, the attachment", () => {
    const asks = (code: string, spec: Extract<Instruction, { verb: "Pick" }>["pick"]) => {
      const t = table(2, code);
      return wilderlandAsk(pick(spec), t.source, words, undefined, null, t.facts)?.prompt;
    };
    expect(asks("18060", { type: "card", control: "you", from: "deck", cardType: "attachment", traits: ["Weapon", "Armor"] })).toBe("Player 1: search your deck: choose a Weapon or Armor attachment to put into your hand. Your deck is then shuffled.");
    expect(asks("18061", { type: "hero", control: "you" })).toBe("Player 1: choose a hero you control to add 1 resource to.");
    expect(asks("18057", { type: "character", control: "you", committed: true })).toBe("Player 1: choose a questing character you control to discard.");
    expect(asks("18057", { type: "ally", control: "you" })).toBe("Player 1: choose an ally you control to discard.");
    expect(asks("18049", { type: "attachment", control: "you" })).toBe("Player 1: choose an attachment you control to discard.");
  });

  it("states the number of cards Stone-troll's excess damage discards, and the damage a player still assigns", () => {
    const t = table(2, "18049");
    const withX: ScenarioState = { ...t.facts.game, stack: [{ id: "f1", frame: "forced", sourceId: t.source, actor: 0, peril: false, effectId: "18049:forced:1", instructions: [], cancel: null, blockCancel: null, step: 0, data: { kind: "effect", x: 2, queue: [], picked: [], wait: null } } as never] };
    expect(wilderlandAsk({ verb: "DiscardFromHand", amount: { excessOf: "subject" } }, t.source, words, undefined, null, { ...t.facts, game: withX })?.prompt).toBe("Player 1: choose 2 cards from your hand to discard, one at a time (1 for each point of excess damage).");
    const cavern = table(2, "18064");
    expect(wilderlandAsk({ verb: "AssignDamage", amount: 3, pick: { type: "character", control: "you" }, left: 2, of: 3 }, cavern.source, { ...words, card: () => "Crumbling Cavern" }, undefined, null, cavern.facts)).toMatchObject({ prompt: "Crumbling Cavern (Player 1): assign 1 damage to a character you control (2 of 3 left).", owned: true });
  });

  it("states the numbers of the branches now: the victory display's locations, the printed Threat, the attackers", () => {
    const threat: Extract<Instruction, { verb: "Choose" }> = { verb: "Choose", who: "firstPlayer", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "location", control: "any", from: "victory" } }, who: "eachSeat" }] }, { id: "printed", instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "picked", printed: true }, who: "eachSeat" }] }, { id: "remove", instructions: [{ verb: "RemoveProgressFromQuest", amount: { count: { type: "character", control: "any", participating: true } } }] }, { id: "add", instructions: [{ verb: "MoveEncounterCard", card: "picked", to: "staging" }] }, { id: "immune", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "endOfPhase", holders: { type: "card", control: "any", playerCard: false } }] }] };
    expect(wilderlandBranchWords(threat, "threat", words, { counted: { threat: 3 } })).toBe("Each player raises their threat by 3 (1 for each location in the victory display)");
    expect(wilderlandBranchWords(threat, "printed", words, { counted: { printed: 2 }, placing: "Dark Tunnel" })).toBe("Each player raises their threat by 2 (the printed Threat of Dark Tunnel)");
    expect(wilderlandBranchWords(threat, "remove", words, { counted: { remove: 2 } })).toBe("Remove 2 progress from the quest (1 for each attacker)");
    expect(wilderlandBranchWords(threat, "add", words, { placing: "Dark Tunnel" })).toBe("Add Dark Tunnel to the staging area");
    expect(wilderlandBranchWords(threat, "immune", words)).toBe("All encounter cards are immune to player card effects until the end of the phase");
  });
});
