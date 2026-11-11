// Rules: mec112.multiplayer-the-one-ring, rr.forced, rr.travel, rr.cannot, rr.search, rr.lasting-effects, rr.engaged, mec109.archery, rr.effects (data/rules/entries.json); ledger lines 144014:A:1, 144014:A:2, 144027:A:1, 144030:A:2, 144031:A:1, 144032:A:1,
// 144032:A:2, 144034:A:1, 144035:A:1, 144036:A:2, 144037:A:1, 144038:A:2, 144039:A:1, 144056:A:1, 144029:A:1, 144068:B:1, 144068:B:2. What a card-spec row cannot hold on Journey to the Cross-roads' own cards: a bar that is
// seen only in what is refused (the Cross-roads' travel, the Southward Road's cost, the Black Gate's Forced effect while Henneth Annûn is active, the search of the deck alone), the Harad enemies that arrive later in the round,
// the stacked Archery and the damage cap. Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts). The harad family's verbs are src/rules/families/harad/index.test.ts.
import { describe, expect, it } from "vitest";

import { archeryTotal } from "../../../rules/combat/combat.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents, legalTargets, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { restricted, travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { answer, idOf, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { reveal as revealRow } from "../../../../test/harness/card-spec.ts";

const ID = "journey-to-the-cross-roads";
const GATE = "144027";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const RING_BEARER = "141001";
const travelTargets = (state: ScenarioState, ctx: ReduceContext) => legalTargets({ ...state, window: { kind: "travel" } }, { type: "Travel" }, ctx);
const rest = (state: ScenarioState, ctx: ReduceContext): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, []);
const hasCard = (state: ScenarioState, code: string, zone: string): boolean => Object.values(state.cards).some((card) => card.code === code && card.zone === zone);

describe("Brace of Coneys", () => {
  it("144014:A:1 is played only by a player who controls the Ring-bearer", () => {
    const without = at({ phase: "Planning", hand: ["144014"] });
    const wanted = (made: ReturnType<typeof at>) => legalIntents({ ...made.state, window: { kind: "pass" } }, made.ctx).some((intent) => intent.type === "PlayCard" && "cardId" in intent && intent.cardId === idOf(made.state, "144014"));
    expect(wanted(without)).toBe(false);
    const made = at({ phase: "Planning", hand: ["144014"] });
    // The saga Frodo is not dealt by the scenario's data: a stand-in Ring-bearer hero is.
    made.cards.set(RING_BEARER, definePrinted({ code: RING_BEARER, name: "Ring-bearer", type: "hero", sphere: "fellowship", traits: ["Hobbit", "Ring-bearer"], threat: 8, willpower: 2, attack: 2, defense: 2, health: 6 }));
    const holder = spawn(made.state, RING_BEARER, { zone: "heroes", seat: 0 });
    expect(wanted({ ...made, state: holder.state })).toBe(true);
  });

  it("144014:A:2 offers the heal option only while a hero has damage, and the same option is not chosen twice", () => {
    const choice = (table: ReturnType<typeof at>, taken: readonly string[]) => {
      const offered: string[][] = [];
      resolveRecords(table.state, table.ctx, "144014", "action", undefined, (state) => {
        if (state.window?.kind !== "choose") return "";
        offered.push([...state.window.options]);
        return taken[offered.length - 1] ?? state.window.options[0] ?? "";
      });
      return offered;
    };
    const plain = at({ phase: "Planning", hand: ["144014"] });
    expect(choice(plain, ["draw", "threat"])[0]).toEqual(["resources", "draw", "threat"]);
    const damaged = { ...plain, state: updateCard(plain.state, plain.hero, { damage: 2 }) };
    const offered = choice(damaged, ["draw", "threat"]);
    expect(offered[0]).toEqual(["heal", "resources", "draw", "threat"]);
    expect(offered[1]).toEqual(["heal", "resources", "threat"]);
  });
});

describe("The Cross-roads", () => {
  it("144030:A:2 has 9 Threat less 1 for each card left in the Harad deck, never below 0", () => {
    const threatWith = (count: number) => {
      const made = at({ staging: ["144030"], piles: { haradDeck: Array.from({ length: count }, () => "144057") } });
      return modifiedStat(made.state, made.state.cards[idOf(made.state, "144030")]!, "threat", made.ctx.cards);
    };
    expect([threatWith(0), threatWith(4), threatWith(9), threatWith(12)]).toEqual([9, 5, 0, 0]);
  });

  it("144030:A:2 cannot be traveled to while a facedown card is left under it, nor before 20 progress is on stage 1B", () => {
    const states = (cards: readonly string[], progress: number) => {
      const made = at({ phase: "Travel", staging: ["144030"], progress, piles: { haradDeck: cards } });
      return travelTargets(made.state, made.ctx).includes(idOf(made.state, "144030"));
    };
    expect(states(["144057"], 20)).toBe(false);
    expect(states([], 19)).toBe(false);
    expect(states([], 20)).toBe(true);
    expect(states([], 25)).toBe(true);
  });

  it("144068:B:2 bars the stage while The Cross-roads is in play, and the win comes when it is explored", () => {
    const made = at({ staging: ["144030"], progress: 25 });
    expect(restricted(made.state, made.ctx, "advance").length).toBeGreaterThan(0);
    const gone = at({ progress: 25 });
    expect(restricted(gone.state, gone.ctx, "advance")).toHaveLength(0);
  });
});

describe("Henneth Annûn", () => {
  it("144031:A:1 skips the encounter phase and the combat phase while it is the active location, and not otherwise", () => {
    const active = at({ active: "144031" });
    expect(flagged(active.state, "table", "skipEncounter")).toBe(true);
    expect(flagged(active.state, "table", "skipCombat")).toBe(true);
    const other = at({ staging: ["144031"] });
    expect(flagged(other.state, "table", "skipEncounter")).toBe(false);
    expect(flagged(other.state, "table", "skipCombat")).toBe(false);
  });

  it("144031:A:1 ignores the Forced effects of The Black Gate and of stage 1B, not its loss line", () => {
    const layout = (active: boolean): Layout => ({ phase: "Planning", ...(active ? { active: "144031" } : {}), staging: [GATE, "144057"], piles: { haradDeck: ["144058"] }, under: [{ code: "144028", to: GATE }] });
    const row = (active: boolean, act: Parameters<typeof play>[1]["act"]) => play(ID, { line: "144031:A:1", layout: layout(active), act, expect: [] }, EFFECTS, false).run.state;
    const heard = row(false, { act: "endPhase" });
    expect(hasCard(heard, "144057", "under")).toBe(true);
    const ignored = row(true, { act: "endPhase" });
    expect(hasCard(ignored, "144057", "staging")).toBe(true);
    // Stage 1B's Forced effect at the beginning of the quest phase: the Harad deck's top card is revealed, unless Henneth Annûn is active.
    expect(hasCard(row(false, { act: "endPhase" }), "144058", "staging")).toBe(true);
    expect(hasCard(ignored, "144058", "haradDeck")).toBe(true);
    // The loss line still holds: the facedown cards under the Gate count to players + 3 while the location is active.
    const full = at({ active: "144031", staging: [GATE], under: [{ code: "144028", to: GATE }, { code: "144029", to: GATE }, { code: "144058", to: GATE }, { code: "144057", to: GATE }] });
    expect(holds(full.state, { kind: "facedownUnder", code: GATE, min: 3, players: true }, { actor: 0, sourceId: null, returned: 0 }, full.ctx)).toBe(true);
  });
});

describe("the travel costs", () => {
  it("144032:A:2 cannot be traveled to with no card left in the Harad deck, and is with one", () => {
    const targets = (cards: readonly string[]) => {
      const made = at({ phase: "Travel", staging: ["144032"], piles: { haradDeck: cards } });
      return { listed: travelTargets(made.state, made.ctx).includes(idOf(made.state, "144032")), unpayable: travelCostUnpayable(made.state, made.ctx, idOf(made.state, "144032")) };
    };
    expect(targets([])).toEqual({ listed: false, unpayable: true });
    expect(targets(["144057"])).toEqual({ listed: true, unpayable: false });
  });

  it("144032:A:1 lets each player engage an additional enemy while it is the active location", () => {
    const made = at({ seats: 2, active: "144032" });
    expect([0, 1].map((seat) => heldAmount(made.state, `seat:${seat}`, "extraOptionalEngage"))).toEqual([1, 1]);
    const off = at({ seats: 2, staging: ["144032"] });
    expect(heldAmount(off.state, "seat:0", "extraOptionalEngage")).toBe(0);
  });
});

describe("Ithilien Woods and Hills of Ithilien", () => {
  // A player engages the Man of Harad in the encounter phase: the active location's gained Forced effect hears it.
  const engage = (made: ReturnType<typeof at>) => {
    const target = idOf(made.state, "144028");
    return answer(send(start(made.state), { type: "Engage", enemyId: target }, made.ctx), made.ctx);
  };
  it("144034:A:1 readies a character the player controls after they engage a Harad enemy", () => {
    const made = at({ phase: "Encounter", threat: [40, 40], active: "144034", staging: ["144028"] });
    const tired = { ...made, state: updateCard(made.state, made.hero, { exhausted: true }) };
    const done = engage(tired).state;
    expect(done.cards[made.hero]?.exhausted).toBe(false);
    const plain = at({ phase: "Encounter", threat: [40, 40], staging: ["144028"] });
    const idle = engage({ ...plain, state: updateCard(plain.state, plain.hero, { exhausted: true }) }).state;
    expect(idle.cards[plain.hero]?.exhausted).toBe(true);
  });

  it("144035:A:1 deals 1 damage to a Harad enemy after a player engages it", () => {
    const made = at({ phase: "Encounter", threat: [40, 40], active: "144035", staging: ["144028"] });
    expect(engage(made).state.cards[idOf(made.state, "144028")]?.damage).toBe(1);
    const plain = at({ phase: "Encounter", threat: [40, 40], staging: ["144028"] });
    expect(engage(plain).state.cards[idOf(plain.state, "144028")]?.damage).toBe(0);
  });
});

describe("the Harad enemies that arrive later in the round", () => {
  it("144029:A:1 gives the +1 Attack and -10 engagement cost to a Harad enemy that arrives after Captain of Harad engaged, and not to another trait", () => {
    const made = at({ staging: ["144029"] });
    const forced = resolveRecords(made.state, made.ctx, "144029", "forced", idOf(made.state, "144029")).state;
    const arrived = spawn(spawn(forced, "144057", { zone: "staging" }).state, "f3", { zone: "staging" });
    const soldier = Object.values(arrived.state.cards).find((card) => card.code === "144057")!;
    expect(modifiedStat(arrived.state, soldier, "attack", made.ctx.cards)).toBe(5);
    expect(modifiedStat(arrived.state, soldier, "engagementCost", made.ctx.cards)).toBe(30);
    expect(modifiedStat(arrived.state, arrived.state.cards[arrived.id]!, "attack", made.ctx.cards)).toBe(1);
  });

  it("144039:A:1 stacks Archery 2 on the printed Archery of each Harad enemy in play, those that arrive later too", () => {
    const made = at({ staging: ["144028", "f3"] });
    const first = resolveRecords(made.state, made.ctx, "144039", "whenRevealed", undefined, () => "").state;
    expect(archeryTotal(first, made.ctx.cards)).toBe(3);
    const later = syncConstants(spawn(spawn(first, "144058", { zone: "staging" }).state, "144057", { zone: "staging" }).state, made.ctx);
    // The Man of Harad 1 + 2, the Archer 1 (X, one player) + 2, the Soldier none printed and 2: the f3 filler none.
    expect(archeryTotal(later, made.ctx.cards)).toBe(3 + 3 + 2);
  });
});

describe("the encounter cards that choose", () => {
  const cardIn = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)!;

  it("144037:A:1 searches the encounter deck alone: a Harad enemy in the discard pile is not offered", () => {
    const row = (layout: Layout) => play(ID, { line: "144037:A:1", layout: { engaged: ["f3"], ...layout }, act: revealRow("144037"), expect: [] }, EFFECTS, false);
    // Only the discard pile holds a Harad enemy: the player returns the engaged enemy (the one option, so no choice opens).
    const discarded = row({ deck: ["f0"], discard: ["144028"] }).run.state;
    expect(cardIn(discarded, "f3").zone).toBe("staging");
    expect(cardIn(discarded, "144028").zone).toBe("encounterDiscard");
    // With a Harad enemy in the deck the two options are offered, and the search leaves the deck's order alone.
    const made = at({ engaged: ["f3"], deck: ["f0", "144028", "144057"] });
    const offered = revealFromTop(made.state, made.ctx, "144037", []).state;
    expect(offered.window?.kind === "choose" ? offered.window.options : []).toEqual(["return", "search"]);
  });

  it("144037:A:1 offers the return only while an enemy is engaged with the player, and nothing when neither option can be taken", () => {
    const none = play(ID, { line: "144037:A:1", layout: { deck: ["f0"] }, act: revealRow("144037"), expect: [] }, EFFECTS, false).run.state;
    expect(none.window?.kind).not.toBe("choose");
    expect(none.seats[0]?.engaged).toEqual([]);
  });

  it("144036:A:2 offers the first option only with a Harad enemy engaged with you and the second only with a card left under The Cross-roads, nothing when neither", () => {
    const run = (layout: Layout) => {
      const made = at({ staging: [GATE], ...layout });
      return revealFromTop(made.state, made.ctx, "144036", []).state;
    };
    const neither = run({ engaged: ["f3"] });
    expect(neither.window?.kind).not.toBe("choose");
    expect(neither.cards[idOf(neither, "f3")]?.zone).toBe("engaged");
    const both = run({ engaged: ["144057"], piles: { haradDeck: ["144028"] } });
    expect(both.window?.kind === "choose" ? both.window.options : []).toEqual(["place", "reveal"]);
  });

  it("144038:A:2 offers the first option only while a Harad enemy is in the staging area", () => {
    const run = (staging: readonly string[]) => {
      const made = at({ staging: [GATE, ...staging], deck: ["f0", "f0"] });
      return revealFromTop(made.state, made.ctx, "144038", []).state;
    };
    expect(run(["f3"]).window?.kind).not.toBe("choose");
    const both = run(["f3", "144057"]);
    expect(both.window?.kind === "choose" ? both.window.options : []).toEqual(["place", "attack"]);
  });
});

describe("Oliphaunt", () => {
  it("144056:A:1 takes no more than 3 damage each round", () => {
    const made = at({ engaged: ["144056"] });
    const id = idOf(made.state, "144056");
    const hit = (state: ScenarioState, amount: number) => rest(runInstruction(state, { verb: "DamageCard", amount, target: "self" }, { seat: 0, sourceId: id }, made.ctx, []), made.ctx);
    const once = hit(made.state, 2);
    expect(once.cards[id]?.damage).toBe(2);
    expect(hit(once, 4).cards[id]?.damage).toBe(3);
  });
});

describe("the quest stage's Forced effect", () => {
  it("144068:B:1 reveals nothing at the beginning of the quest phase when the Harad deck is empty", () => {
    const run = play(ID, { line: "144068:B:1", layout: { phase: "Planning", piles: { haradDeck: [] } }, act: { act: "endPhase" }, expect: [] }, EFFECTS, false).run.state;
    expect(run.staging).toEqual([]);
  });
});

describe("the Harad deck's travel", () => {
  it("144030:A:2 travel is the end of a game: 20 progress and an empty deck bar nothing, so the location can be explored", () => {
    const made = at({ phase: "Travel", staging: ["144030"], progress: 20, piles: { haradDeck: [] } });
    expect(travelTargets(made.state, made.ctx)).toContain(idOf(made.state, "144030"));
  });
});
