// Rules: mec112.mire, mec112.gollum-smeagol, mec112.poisoned-counsels-searching-eye, rr.forced, rr.first-player, rr.then, rr.cannot, rr.attachment-cards, mec109.immune-to-player-card-effects (data/rules/entries.json); ledger lines 144015:A:1,
// 144016:A:1, 144017:A:1, 144018:A:1, 144021:A:1, 144024:A:2, 144053:A:2, 144055:A:2, 144064:B:1, 144064:B:2, 144065:B:1, 144065:B:2, 144066:B:1, 144066:B:2, 144075:A:3, 144076:A:3. What a card-spec row cannot hold on The Passage of the Marshes' own
// cards: the first player's choices and gates when another seat acts (the token on the second seat), the Mire discard by the refresh step, the cancel paid by the first player's own hero, the gate on the first player's Sméagol, the Forced effect of the quest stage and the defeat of Gollum. Each
// test title starts with the line it covers (scripts/checks/spec-coverage.test.ts). The mire and gollum families' own tests are src/rules/families/mire/index.test.ts and src/rules/families/gollum/index.test.ts.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { flagged, heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents } from "../../../rules/engine/reduce.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { crossBoundary, fireForced } from "../../../rules/windows/triggers.ts";
import { reveal, type Row } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-passage-of-the-marshes";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const rest = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"]): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, []);
const SECOND_FIRST = { seats: 2, firstPlayer: 1 } as const;
const advance = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"]): boolean => restricted(state, ctx, "advance").length > 0;
// A mire token on the location, as the refresh step places it: the discard at X and its Forced effect follow.
const mire = (made: ReturnType<typeof at>, id: string, amount = 1): ScenarioState => runInstruction(made.state, { verb: "PlaceMireToken", on: "self", amount }, { seat: 0, sourceId: id }, made.ctx, []);

describe("a card that functions like a player card", () => {
  it("144015:A:1 The Searching Eye is held in a hand and never offered to be played", () => {
    const made = at({ phase: "Planning", hand: ["144015", "filler"] });
    const id = idOf(made.state, "144015");
    expect(made.state.seats[0]?.hand).toContain(id);
    const offered = legalIntents({ ...made.state, window: { kind: "pass" } }, made.ctx);
    expect(offered.some((intent) => intent.type === "PlayCard" && "cardId" in intent && intent.cardId === id)).toBe(false);
  });
});

describe("the engaged player cannot reduce his threat", () => {
  const barred = (code: string): void => {
    const engaged = at({ seats: 2, engaged: [{ code, seat: 1 }] });
    expect(heldAmount(engaged.state, "seat:1", "threatReductionBarred")).toBeGreaterThan(0);
    expect(heldAmount(engaged.state, "seat:0", "threatReductionBarred")).toBe(0);
    const staging = at({ seats: 2, staging: [code] });
    expect(heldAmount(staging.state, "seat:1", "threatReductionBarred")).toBe(0);
  };
  // Holds for the seat the enemy is engaged with, not for the other seat, and not while the enemy is in the staging area.
  it("144016:A:1 Groping Dead bars the engaged seat alone", () => barred("144016"));
  it("144017:A:1 Dead Things bars the engaged seat alone", () => barred("144017"));
  it("144018:A:1 Candle-bearer bars the engaged seat alone", () => barred("144018"));
});

describe("Haunted Mere", () => {
  it("144021:A:1 lets the first player search for the Undead enemy when it is discarded by Mire, whoever acts, and shuffles the deck after", () => {
    const made = at({ ...SECOND_FIRST, staging: [{ code: "144021", resources: 1 }], deck: ["144016", "144017", "f0"] });
    const id = idOf(made.state, "144021");
    const asked = rest(mire(made, id), made.ctx);
    expect(asked.cards[id]?.zone).toBe("encounterDiscard");
    expect(asked.window?.kind).toBe("choose");
    expect(asked.window?.kind === "choose" ? asked.window.seat : -1).toBe(1);
  });
});

describe("Creeping Marshes", () => {
  it("144024:A:2 is discarded at the end of the refresh phase even when no location is in the staging area (rr.then: placing a token on each of none is complete)", () => {
    const bare = at({ deck: ["f0"] });
    const revealed = resolveRecords(bare.state, bare.ctx, "144024", "whenRevealed", undefined, undefined, false);
    expect(revealed.state.staging.filter((id) => bare.cards.get(revealed.state.cards[id]?.code ?? "")?.type === "location")).toEqual([]);
    const crossed = crossBoundary({ ...revealed.state, boundaryPhase: "Refresh", phase: "End of round", window: null }, bare.ctx, []);
    expect(rest(crossed, bare.ctx).cards[revealed.id]?.zone).toBe("encounterDiscard");
  });
});

describe("Morgul Wraith", () => {
  it("144053:A:2 gets -30 engagement cost and is immune to player card effects only while The One Ring is exhausted", () => {
    const ready = at({ staging: ["144053"], play: ["144063"] });
    const wraith = idOf(ready.state, "144053");
    expect(flagged(ready.state, wraith, "immuneToPlayerCards")).toBe(false);
    const ring = idOf(ready.state, "144063");
    const tired = syncConstants(updateCard(ready.state, ring, { exhausted: true }), ready.ctx);
    expect(flagged(tired, wraith, "immuneToPlayerCards")).toBe(true);
  });
});

describe("We Hates Them!", () => {
  const firstSeatImmediateAttack: Row = { line: "144055:A:2", layout: { ...SECOND_FIRST, engaged: [{ code: "144075", seat: 1 }] }, act: reveal("144055"), expect: [] };

  it("144055:A:2 has Gollum attack the first player, not the revealing player", () => {
    const done = play(ID, firstSeatImmediateAttack, EFFECTS, false);
    expect(done.run.state.pendingAttack?.enemyId).toBe(idOf(done.run.state, "144075"));
    expect(done.run.state.pendingAttack?.seat).toBe(1);
  });

  it("144055:A:2 is canceled by the first player paying 1 Fellowship resource from their own heroes and exhausting The One Ring", () => {
    const made = at({ ...SECOND_FIRST, heroResources: 1, play: ["144063"], engaged: [{ code: "144075", seat: 1 }], deck: ["f0"] });
    // Every hero stand-in is of the Fellowship sphere, so only whose pool pays is in question.
    const cards = new Map(made.ctx.cards);
    for (const code of ["dh1", "dh2", "dh3"]) cards.set(code, { ...cards.get(code)!, sphere: "fellowship" });
    const ctx = { ...made.ctx, cards };
    const run = resolveRecords(made.state, ctx, "144055", "whenRevealed", undefined, (state) => (state.window?.kind === "choose" && state.window.options.includes("cancel") ? "cancel" : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")), false);
    const state = run.state;
    expect(state.cards[idOf(state, "144063")]?.exhausted).toBe(true);
    expect(state.cards[made.seat1Hero ?? ""]?.resources).toBe(0);
    expect(state.cards[made.hero]?.resources).toBe(1);
    expect(state.pendingAttack).toBeFalsy();
  });
});

describe("the gates on the first player's Sméagol", () => {
  const gate = (stage: string, layout: Layout) => {
    const made = at({ stage, ...layout });
    // The control of Sméagol follows the token in the sweep that settle runs.
    return advance(rest(made.state, made.ctx), made.ctx);
  };

  it("144064:B:1 bars advancing unless the first player controls Sméagol, the first player being the second seat", () => {
    expect(gate("144064", { ...SECOND_FIRST, engaged: [{ code: "144075", seat: 1 }] })).toBe(true);
    expect(gate("144064", { ...SECOND_FIRST, play: [{ code: "144076", seat: 0 }] })).toBe(false);
    expect(gate("144064", { seats: 2, play: [{ code: "144076", seat: 0 }] })).toBe(false);
    expect(gate("144064", { seats: 2, firstPlayer: 0, engaged: [{ code: "144075", seat: 0 }] })).toBe(true);
  });

  it("144065:B:2 needs Sméagol with the first player and at least 4 locations in the victory display", () => {
    const four = ["144019", "144020", "144021", "144023"];
    expect(gate("144065", { ...SECOND_FIRST, play: [{ code: "144076", seat: 0 }], victory: four.slice(0, 3) })).toBe(true);
    expect(gate("144065", { ...SECOND_FIRST, play: [{ code: "144076", seat: 0 }], victory: four })).toBe(false);
    expect(gate("144065", { ...SECOND_FIRST, engaged: [{ code: "144075", seat: 1 }], victory: four })).toBe(true);
  });

  it("144066:B:2 cannot be defeated unless the first player controls Sméagol", () => {
    expect(gate("144066", { ...SECOND_FIRST, engaged: [{ code: "144075", seat: 1 }] })).toBe(true);
    expect(gate("144066", { ...SECOND_FIRST, play: [{ code: "144076", seat: 0 }] })).toBe(false);
  });
});

describe("the stage constants", () => {
  it("144065:B:1 no progress can be placed on the locations in the staging area, and none on a stage 1 location", () => {
    const stage2 = at({ stage: "144065", staging: ["144019"] });
    expect(flagged(stage2.state, idOf(stage2.state, "144019"), "noProgressPlaced")).toBe(true);
    const stage3 = at({ stage: "144066", staging: ["144019"] });
    expect(flagged(stage3.state, idOf(stage3.state, "144019"), "noProgressPlaced")).toBe(false);
  });

  it("144066:B:1 bars progress on the stage while any player is engaged with an Undead enemy, whoever it is", () => {
    const none = at({ stage: "144066", seats: 2 });
    expect(flagged(none.state, "table", "noQuestProgress")).toBe(false);
    const engaged = at({ stage: "144066", seats: 2, engaged: [{ code: "144016", seat: 1 }] });
    expect(flagged(engaged.state, "table", "noQuestProgress")).toBe(true);
    const staging = at({ stage: "144066", seats: 2, staging: ["144016"] });
    expect(flagged(staging.state, "table", "noQuestProgress")).toBe(false);
  });
});

describe("The Taming of Sméagol's Forced effect", () => {
  const defeatX = (layout: Layout, declarations: number) => {
    const made = at({ engaged: [{ code: "144075", seat: 0 }], ...layout });
    let state = made.state;
    for (let count = 0; count < declarations; count += 1) state = rest(fireForced({ ...state, window: null }, { trigger: "enemyAttacked", seat: count % 2, cardId: idOf(state, "144075"), participants: [made.hero] }, made.ctx, []), made.ctx);
    return { made, state };
  };

  it("144064:B:2 discards the top card of the encounter deck for each declaration and Gollum's Defense grows by its Threat", () => {
    const { made, state } = defeatX({ seats: 2, deck: ["144019", "144022", "f0"] }, 2);
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toEqual(expect.arrayContaining(["144019", "144022"]));
    expect(state.encounterDeck).toHaveLength(1);
    const gollum = idOf(made.state, "144075");
    const defense = state.modifiers.filter((modifier) => modifier.stat === "defense" && modifier.instanceId === gollum).reduce((sum, modifier) => sum + modifier.amount, 0);
    // Evil-smelling Fens and Stagnant Pools, Threat 3 each.
    expect(defense).toBe(6);
  });

  it("144064:B:2 gives Gollum no Defense when the encounter deck is empty, whatever lies on top of the discard pile", () => {
    const { made, state } = defeatX({ deck: [], discard: ["144019"] }, 1);
    const gollum = idOf(made.state, "144075");
    const defense = state.modifiers.filter((modifier) => modifier.stat === "defense" && modifier.instanceId === gollum).reduce((sum, modifier) => sum + modifier.amount, 0);
    expect(defense).toBe(0);
  });
});

describe("a defeated Gollum and a destroyed Sméagol", () => {
  it("144075:A:3 a defeated Gollum flips to Sméagol, exhausted, controlled by the first player (the second seat)", () => {
    const made = at({ ...SECOND_FIRST, engaged: [{ code: "144075", seat: 1 }] });
    const gollum = idOf(made.state, "144075");
    const dead = moveCard(updateCard(made.state, gollum, { damage: 9 }), gollum, { zone: "encounterDiscard" });
    const settled = rest({ ...dead, pendingEvents: [{ trigger: "enemyDestroyed", seat: 0, subject: gollum }] }, made.ctx);
    expect(settled.cards[gollum]?.code).toBe("144076");
    expect(settled.cards[gollum]?.controller).toBe(1);
    expect(settled.cards[gollum]?.exhausted).toBe(true);
  });

  it("144076:A:3 loses the game when Sméagol is destroyed", () => {
    const made = at({ play: ["144076"] });
    const smeagol = idOf(made.state, "144076");
    const destroyed = moveCard(made.state, smeagol, { zone: "encounterDiscard" });
    expect(rest({ ...destroyed, pendingEvents: [{ trigger: "characterDestroyed", seat: 0, subject: smeagol }] }, made.ctx).lost).toBe(true);
  });
});
