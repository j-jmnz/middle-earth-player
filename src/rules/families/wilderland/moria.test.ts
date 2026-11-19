// Rules: dwd.creating-the-quest-deck, dwd.bypassing-a-quest-card, dwd.immune-to-ranged-damage, dwd.the-nameless-fear, rr.cancel, rr.victory, rr.player-elimination (data/rules/entries.json); ledger lines 03070:A:1, 03070:B:1, 03026:A:1, 03074:B:1, 03075:B:2, 03075:B:3, 03025:A:3, 03027:A:1, 03042:A:1, 03073:B:1, 03028:A:1, 901201:A:2, 901202:B:1, 901207:A:1, 901209:A:3.
// The quest-deck verbs, flags and amounts Flight from Moria adds, on the family's fixture table: stages 2 that arrive side A and flip as the staging step begins (FlipCurrentQuest `resolve`), RevealNewStage, ChooseStageToFlip, ShuffleStageFromVictory,
// DiscardTopEliminating, the bypass cost and shuffle, and the flags cannotExhaust, immuneToRangedDamage and ignoresWillpower.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { effectsOfCard } from "../misc/text.ts";
import { attackStrength, canAttack, canDefend } from "../../combat/combat.ts";
import { committedWillpower } from "../../quest/quest.ts";
import { orderedNext } from "../quest/order.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { exhaustCard } from "../../interpret/player-verbs.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { hears } from "../../windows/listen.ts";
import { run as runWilderland } from "./index.ts";
import { bypassStage } from "./gundabad.ts";
import { codesOf, CARDS, deal, record, table } from "./fixture.ts";

const cards = new Map([
  ...CARDS,
  ["sa", definePrinted({ code: "sa", name: "Search for an Exit", type: "quest", questPoints: 5, victory: 1 })],
  ["sb", definePrinted({ code: "sb", name: "Search for an Exit", type: "quest", questPoints: 3, victory: 2 })],
  ["sc", definePrinted({ code: "sc", name: "Search for an Exit", type: "quest", victory: 2 })],
  ["fear", definePrinted({ code: "fear", name: "The Nameless Fear", type: "enemy", engagementCost: 50, health: 27, victory: 0 })],
  ["troll", definePrinted({ code: "troll", name: "Great Cave-troll", type: "enemy", threat: 2, engagementCost: 40, attack: 3, defense: 1, health: 30, victory: 3 })],
  ["archer", definePrinted({ code: "archer", name: "Ranged Elf", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 2, defense: 1, health: 3, keywords: { ranged: true } })],
]);
const FLIP: Effect = record("sa:forced:1", "sa", "forced", [{ verb: "FlipCurrentQuest", resolve: true }], { trigger: "stagingStepBegins" });
const REVEAL_A: Effect = { id: "sa:whenRevealed:1", cardCode: "sa", lines: ["sa:A:2"], timing: "whenRevealed", instructions: [{ verb: "GainSurge" }] };
const REVEAL_B: Effect = { id: "sa:whenRevealed:2", cardCode: "sa", lines: ["sa:B:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDeck" }] };
const ctxOf = (effects: readonly Effect[]) => ({ effects, cards });
const focus = (sourceId: string | null = null, chosen?: string) => ({ seat: 0, sourceId, ...(chosen ? { chosen } : {}) });

// A table whose quest is a deck of stages 2: `sa` current (side A or B), `sb` and `sc` in the quest deck.
function deckTable(face: "A" | "B" = "A", seats: 1 | 2 = 1): { state: ScenarioState; current: string; deck: string[] } {
  const base = table(seats);
  const stage = Object.values(base.cards).find((card) => card.zone === "questStage")!;
  let state = updateCard(base, stage.id, { code: "sa", face });
  state = { ...state, stages: [{ code: "sa", deck: true }, { code: "sb", deck: true }, { code: "sc", deck: true }] };
  const dealt = deal(state, ["sb", "sc"], { zone: "questDeck" });
  return { state: dealt.state, current: stage.id, deck: dealt.ids };
}

describe("FlipCurrentQuest resolve (03070:A:1; dwd.creating-the-quest-deck)", () => {
  it("shows side B and resolves the When Revealed of side B only: side A's resolved as the stage arrived", () => {
    const { state, current } = deckTable("A");
    const ctx = ctxOf([REVEAL_A, REVEAL_B]);
    const next = runWilderland(state, { verb: "FlipCurrentQuest", resolve: true }, focus(current), ctx, [])!;
    expect(next.cards[current]?.face).toBe("B");
    expect(next.stack.map((frame) => (frame.data.kind === "effect" ? frame.data.effectId : ""))).toEqual(["sa:whenRevealed:2"]);
  });

  it("changes nothing for a stage that shows side B already", () => {
    const { state, current } = deckTable("B");
    const next = runWilderland(state, { verb: "FlipCurrentQuest", resolve: true }, focus(current), ctxOf([REVEAL_B]), [])!;
    expect(next).toBe(state);
  });

  it("a stage that arrives by advancing resolves its side A's When Revealed only, and the side B's records are not heard until it flips", () => {
    const { state, current } = deckTable("A");
    const ctx = ctxOf([REVEAL_A, REVEAL_B, FLIP]);
    const steps = [{ kind: "advance" as const, cardId: current }];
    const next = afterProgress(state, 0, ctx, steps);
    expect(next.stack.map((frame) => (frame.data.kind === "effect" ? frame.data.effectId : ""))).toEqual(["sa:whenRevealed:1"]);
    // The flip is a record of side A: it is heard while the stage shows side A.
    expect(effectsOfCard(state, ctx, state.cards[current]!).map((effect) => effect.id)).toContain("sa:forced:1");
  });
});

describe("RevealNewStage (03026:A:1, 03075:B:3)", () => {
  it("shuffled in: the current stage goes into the quest deck with no progress and the top stage is revealed side A; nothing hears a defeat", () => {
    const { state, current } = deckTable("B");
    const progressed = updateCard(state, current, { progress: 2 });
    const next = runWilderland(progressed, { verb: "RevealNewStage" }, focus(), ctxOf([REVEAL_A]), [])!;
    const nowCurrent = next.cards[next.questStage ?? ""]!;
    expect([nowCurrent.code, ...codesOf(next, next.questDeck)].sort()).toEqual(["sa", "sb", "sc"]);
    expect(nowCurrent.face).toBe("A");
    expect(next.cards[current]).toMatchObject({ progress: 0, face: "A" });
    expect(next.stageLeft?.bypassed).toBe(true);
    expect(next.seedCursor).toBeGreaterThan(progressed.seedCursor);
  });

  it("at the bottom (`bottom`): the next stage is revealed, the one left is last in the deck", () => {
    const { state, current, deck } = deckTable("B");
    const next = runWilderland(state, { verb: "RevealNewStage", bottom: true }, focus(), ctxOf([]), [])!;
    expect(next.questStage).toBe(deck[0]);
    expect(next.questDeck).toEqual([deck[1], current]);
    expect(next.cards[deck[0]!]?.face).toBe("A");
  });

  it("at the bottom with no other stage in the deck: nothing happens", () => {
    const { state } = deckTable("B");
    const empty = { ...state, questDeck: [] };
    expect(runWilderland(empty, { verb: "RevealNewStage", bottom: true }, focus(), ctxOf([]), [])).toBe(empty);
  });
});

describe("ChooseStageToFlip (03074:B:1)", () => {
  it("the chosen stage becomes the current quest flipped at once, its side B's When Revealed resolving; the other goes to the bottom; the stage replaced is set aside", () => {
    const { state, current, deck } = deckTable("B");
    const next = runWilderland(state, { verb: "ChooseStageToFlip", count: 2 }, focus(current, deck[1]), ctxOf([{ ...REVEAL_B, cardCode: "sc", id: "sc:whenRevealed:1", lines: ["sc:B:1"] }]), [])!;
    expect(next.questStage).toBe(deck[1]);
    expect(next.cards[deck[1]!]?.face).toBe("B");
    expect(next.questDeck).toEqual([deck[0]]);
    expect(next.cards[current]).toMatchObject({ zone: "setAside", face: "A", progress: 0 });
    expect(next.stack.map((frame) => (frame.data.kind === "effect" ? frame.data.effectId : ""))).toEqual(["sc:whenRevealed:1"]);
  });

  it("a deck of one stage is taken without asking", () => {
    const { state, current, deck } = deckTable("B");
    const one = { ...state, questDeck: [deck[0]!] };
    const next = runWilderland(one, { verb: "ChooseStageToFlip", count: 2 }, focus(current), ctxOf([]), [])!;
    expect(next.questStage).toBe(deck[0]);
    expect(next.questDeck).toEqual([]);
  });

  it("with no stage in the deck nothing happens", () => {
    const { state, current } = deckTable("B");
    const empty = { ...state, questDeck: [] };
    expect(runWilderland(empty, { verb: "ChooseStageToFlip", count: 2 }, focus(current), ctxOf([]), [])).toBe(empty);
  });
});

describe("ShuffleStageFromVictory (03070:B:1)", () => {
  it("the stage leaves the victory display for the quest deck, side A up, and the deck is shuffled", () => {
    const { state, deck } = deckTable("B");
    const inDisplay = moveCard(state, deck[0]!, { zone: "victory" });
    expect(inDisplay.victory).toContain(deck[0]);
    const next = runWilderland(inDisplay, { verb: "ShuffleStageFromVictory", code: "sb" }, focus(), ctxOf([]), [])!;
    expect(next.victory).not.toContain(deck[0]);
    expect(codesOf(next, next.questDeck).sort()).toEqual(["sb", "sc"]);
    expect(next.cards[deck[0]!]).toMatchObject({ zone: "questDeck", face: "A" });
    expect(next.seedCursor).toBeGreaterThan(inDisplay.seedCursor);
  });

  it("nothing happens when the stage is not in the victory display", () => {
    const { state } = deckTable("B");
    expect(runWilderland(state, { verb: "ShuffleStageFromVictory", code: "sb" }, focus(), ctxOf([]), [])).toBe(state);
  });
});

describe("DiscardTopEliminating (03075:B:2)", () => {
  it("each player in order discards the top card; a treachery eliminates the player who discarded it before the next discards", () => {
    const base = deckTable("B", 2).state;
    const { state } = deal(base, ["mist", "ec1", "orc"], { zone: "encounterDeck" });
    const steps: never[] = [];
    const next = runWilderland(state, { verb: "DiscardTopEliminating", type: "treachery" }, focus(), ctxOf([]), steps)!;
    expect(next.seats[0]?.eliminated).toBe(true);
    expect(next.seats[1]?.eliminated).not.toBe(true);
    expect(codesOf(next, next.encounterDiscard)).toEqual(["mist", "ec1"]);
    expect(next.encounterDeck).toHaveLength(1);
  });
});

describe("bypassing (901201:A:2, 901207:A:1; dwd.bypassing-a-quest-card)", () => {
  const withTable = (state: ScenarioState, stat: "bypassThreat" | "bypassShuffles", amount: number): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat, amount, until: "endOfRound" }] });

  it("goes to the bottom of the quest deck with the top stage revealed side A, as before", () => {
    const { state, current, deck } = deckTable("B");
    const next = bypassStage(state, focus(current), ctxOf([]), []);
    expect(next.questStage).toBe(deck[0]);
    expect(next.questDeck).toEqual([deck[1], current]);
  });

  it("each player pays the threat each copy of a card that charges for it adds up to, before the stage is bypassed", () => {
    const { state, current } = deckTable("B", 2);
    const charged = withTable(withTable(state, "bypassThreat", 2), "bypassThreat", 2);
    const before = charged.seats.map((seat) => seat.threat);
    const next = bypassStage(charged, focus(current), ctxOf([]), []);
    expect(next.seats[0]?.threat).toBe((before[0] ?? 0) + 4);
    expect(next.seats[1]?.threat).toBe((before[1] ?? 0) + 4);
    expect(next.questStage).not.toBe(current);
  });

  it("a raise that eliminates a player does not stop the bypass", () => {
    const { state, current } = deckTable("B", 2);
    const high = { ...state, seats: state.seats.map((seat, index) => (index === 0 ? { ...seat, threat: 49 } : seat)) as unknown as ScenarioState["seats"] };
    const next = bypassStage(withTable(high, "bypassThreat", 2), focus(current), ctxOf([]), []);
    expect(next.seats[0]?.eliminated).toBe(true);
    expect(next.questStage).not.toBe(current);
  });

  it("with the Nightmare setup card in play the stage is shuffled into the deck and the top of it revealed (it can come straight back)", () => {
    const { state, current } = deckTable("B");
    const next = bypassStage(withTable(state, "bypassShuffles", 1), focus(current), ctxOf([]), []);
    expect([next.cards[next.questStage ?? ""]?.code, ...codesOf(next, next.questDeck)].sort()).toEqual(["sa", "sb", "sc"]);
    expect(next.seedCursor).toBeGreaterThan(state.seedCursor);
    expect(next.cards[current]?.face).toBe("A");
  });

  it("is not offered with no other stage in the quest deck", () => {
    const { state, current } = deckTable("B");
    const empty = { ...state, questDeck: [] };
    expect(bypassStage(empty, focus(current), ctxOf([]), [])).toBe(empty);
  });

  it("tells the Forced effects that hear a bypass, once for each player, the first player's first", () => {
    const { state, current } = deckTable("B", 2);
    const enemy = spawn(state, "orc", { zone: "engaged", seat: 1 });
    const hears: Effect = { id: "orc:forced:1", cardCode: "orc", lines: ["orc:A:1"], timing: "forced", trigger: "stageBypassed", eventSeat: "you", instructions: [{ verb: "ShuffleEncounterDeck" }] };
    const next = bypassStage(enemy.state, focus(current), ctxOf([hears]), []);
    // Only the copy engaged with a player hears the event of that player's seat.
    expect(next.stack.filter((frame) => frame.data.kind === "effect" && frame.data.effectId === "orc:forced:1")).toHaveLength(1);
  });
});

describe("stage order: Flight from Moria's quest deck has no stage 3 (dwd.creating-the-quest-deck)", () => {
  it("every stage leads to the top of the deck and the last one defeated wins", () => {
    const { state } = deckTable("B");
    expect(orderedNext(state, "sa")).toEqual({ kind: "next", id: state.questDeck[0] });
    expect(orderedNext({ ...state, questDeck: [] }, "sa")).toEqual({ kind: "end" });
  });
});

describe("cannotExhaust (03027:A:1)", () => {
  const flaggedHero = () => {
    const base = deckTable("B").state;
    const hero = base.seats[0]!.heroes[0]!;
    return { state: { ...base, modifiers: [...base.modifiers, { instanceId: hero, sourceId: hero, stat: "cannotExhaust" as const, amount: 1, until: "endOfRound" as const }] }, hero };
  };

  it("the hero cannot attack or defend, unless it stays ready doing it (committing is read by the legal intents: the Shadow of Fear spec rows)", () => {
    const { state, hero } = flaggedHero();
    const enemy = spawn(state, "orc", { zone: "engaged", seat: 0 });
    const combat = { ...enemy.state, phase: "Combat" as const };
    expect(canAttack(combat, 0, hero, enemy.id, cards)).toBe(false);
    expect(canDefend(combat, 0, hero, cards)).toBe(false);
    const free = { ...combat, modifiers: [...combat.modifiers, { instanceId: hero, sourceId: hero, stat: "noExhaustAttack" as const, amount: 1, until: "endOfRound" as const }] };
    expect(canAttack(free, 0, hero, enemy.id, cards)).toBe(true);
  });

  it("an effect that exhausts it does nothing, and the flag is not set on other characters", () => {
    const { state, hero } = flaggedHero();
    expect(exhaustCard(state, hero)).toBe(state);
    const other = deckTable("B").state;
    expect(exhaustCard(other, other.seats[0]!.heroes[0]!).cards[other.seats[0]!.heroes[0]!]?.exhausted).toBe(true);
    expect(flagged(state, hero, "cannotExhaust")).toBe(true);
  });
});

describe("immuneToRangedDamage (03042:A:1; dwd.immune-to-ranged-damage)", () => {
  it("a character that takes part in the attack through the ranged keyword deals no damage; one that attacks it as its own enemy does", () => {
    const base = deckTable("B", 2).state;
    const troll = spawn(base, "troll", { zone: "engaged", seat: 1 });
    const flaggedTroll = { ...troll.state, modifiers: [...troll.state.modifiers, { instanceId: troll.id, sourceId: troll.id, stat: "immuneToRangedDamage" as const, amount: 1, until: "endOfRound" as const }] };
    const own = flaggedTroll.seats[1]!.heroes[0]!;
    const ranged = flaggedTroll.seats[0]!.heroes[0]!;
    const strike = { seat: 1, enemyId: troll.id, attackerIds: [own, ranged], back: null };
    const striking = { ...flaggedTroll, pendingStrike: strike } as unknown as ScenarioState;
    const withBoth = attackStrength(striking, [own, ranged], troll.id, cards);
    const ownOnly = attackStrength(striking, [own], troll.id, cards);
    expect(withBoth).toBe(ownOnly);
    // Without the flag both count.
    const plain = { ...striking, modifiers: [] } as ScenarioState;
    expect(attackStrength(plain, [own, ranged], troll.id, cards)).toBeGreaterThan(ownOnly);
  });
});

describe("ignoresWillpower and countsWillpower (03073:B:1)", () => {
  it("while the table holds ignoresWillpower only the characters holding countsWillpower add their Willpower to the quest", () => {
    const base = deckTable("B", 2).state;
    const heroes = [base.seats[0]!.heroes[0]!, base.seats[1]!.heroes[0]!];
    let state = base;
    for (const hero of heroes) state = updateCard(state, hero, { committed: true });
    const both = committedWillpower(state, cards);
    expect(both).toBeGreaterThan(0);
    const ignoring = { ...state, modifiers: [{ instanceId: "table", sourceId: "table", stat: "ignoresWillpower" as const, amount: 1, until: "endOfRound" as const }] };
    expect(committedWillpower(ignoring, cards)).toBe(0);
    const chosen = { ...ignoring, modifiers: [...ignoring.modifiers, { instanceId: heroes[0]!, sourceId: "table", stat: "countsWillpower" as const, amount: 1, until: "endOfRound" as const }] };
    expect(committedWillpower(chosen, cards)).toBe(committedWillpower(updateCard(base, heroes[0]!, { committed: true }), cards));
  });
});

describe("the victory points amount and the table flag condition (03025:A:3, 901201:A:3)", () => {
  it("amount victoryPoints is the Victory printed on the cards of the victory display, read live", () => {
    const { state, deck } = deckTable("B");
    const ctx = ctxOf([]);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    expect(resolveAmount(state, { victoryPoints: true }, scope, ctx)).toBe(0);
    const shown = moveCard(moveCard(state, deck[0]!, { zone: "victory" }), deck[1]!, { zone: "victory" });
    expect(resolveAmount(shown, { victoryPoints: true }, scope, ctx)).toBe(4);
  });

  it("the flag condition reads a flag the table holds", () => {
    const { state } = deckTable("B");
    const ctx = ctxOf([]);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const condition = { kind: "flag" as const, stat: "refreshOnce", holder: "table" as const };
    expect(holds(state, condition, scope, ctx)).toBe(false);
    const flaggedTable = { ...state, modifiers: [{ instanceId: "table", sourceId: "table", stat: "refreshOnce" as const, amount: 1, until: "endOfRound" as const }] };
    expect(holds(flaggedTable, condition, scope, ctx)).toBe(true);
  });
});

describe("DamageCard uncancelable (03028:A:1)", () => {
  it("the damage dealt event it queues is not heard by an ability that cancels damage, though one that does something else is", () => {
    const { state } = deckTable("B");
    const hero = state.seats[0]!.heroes[0]!;
    const cancel: Effect = { id: "x:response:1", cardCode: "x", lines: ["x:A:1"], timing: "response", trigger: "damageDealt", instructions: [{ verb: "CancelDamage", amount: 1 }] };
    const other: Effect = { id: "x:response:2", cardCode: "x", lines: ["x:A:2"], timing: "response", trigger: "damageDealt", instructions: [{ verb: "ShuffleEncounterDeck" }] };
    const ctx = ctxOf([cancel, other]);
    const listener = spawn(state, "frodo", { zone: "heroes", seat: 0 });
    const source = spawn(listener.state, "mist", { zone: "staging" });
    const framed = pushEffectFrame(source.state, { frame: "ResolveEffect", sourceId: source.id, actor: 0, peril: false, effectId: "mist:whenRevealed:1", instructions: [], picked: [hero], cancel: null, blockCancel: null }, []);
    const deal = (uncancelable: boolean) => runInstruction(framed, { verb: "DamageCard", amount: 2, ...(uncancelable ? { uncancelable: true as const } : {}) }, { seat: 0, sourceId: source.id }, ctx, []);
    const marked = deal(true).pendingEvents?.find((event) => event.trigger === "damageDealt");
    const plain = deal(false).pendingEvents?.find((event) => event.trigger === "damageDealt");
    expect(marked?.uncancelable).toBe(true);
    expect(plain?.uncancelable).toBeUndefined();
    expect(hears(framed, cancel, framed.cards[hero]!, marked!, ctx)).toBe(false);
    expect(hears(framed, other, framed.cards[hero]!, marked!, ctx)).toBe(true);
    expect(hears(framed, cancel, framed.cards[hero]!, plain!, ctx)).toBe(true);
  });
});

describe("ResolveWhenRevealedOf name (901202:B:1)", () => {
  it("resolves the When Revealed of each card with that title the effect discarded, in the order discarded", () => {
    const { state } = deckTable("B");
    const dealt = deal(state, ["mist", "orc", "mist"], { zone: "encounterDeck" });
    const framed = pushEffectFrame(dealt.state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "sa:forced:2", instructions: [], cancel: null, blockCancel: null }, []);
    const effect: Effect = { id: "mist:whenRevealed:1", cardCode: "mist", lines: ["mist:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDeck" }] };
    const discarded = runInstruction(framed, { verb: "DiscardEncounterTop", count: 3 }, focus(), ctxOf([effect]), []);
    const next = runInstruction(discarded, { verb: "ResolveWhenRevealedOf", of: "looked", name: "Mist" }, focus(), ctxOf([effect]), []);
    const sources = next.stack.filter((frame) => frame.data.kind === "effect" && frame.data.effectId === "mist:whenRevealed:1").map((frame) => frame.cardId);
    // The last pushed resolves first: the first discarded is on top.
    expect(sources).toEqual([dealt.ids[2], dealt.ids[0]]);
  });
});
