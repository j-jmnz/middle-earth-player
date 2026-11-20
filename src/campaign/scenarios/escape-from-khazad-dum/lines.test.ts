// Rules: rr.explored, rr.forced, rr.travel, rr.damage, rr.engaged, rr.guarded, rr.lasting-effects, rr.blank, rr.defending-player, rr.reveal, docs/brief.md (Escape from Khazad-dûm) (data/rules/entries.json).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): a bar that must not hold for good, a modifier a seat or the table holds, an attack whose damage lands on the stage, a card that leaves play, a choice no row can refuse.
import { describe, expect, it } from "vitest";

import { destroyCard, modifiedStat } from "../../../rules/core/keywords.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { textBlank } from "../../../rules/families/attachments/hold.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalTargets } from "../../../rules/engine/reduce.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { finish, idOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// The quest cards a Quick-build game keeps: 1A, one stage 2 and one stage 3 (the Setup of 51301), so a stage number is the printed one.
const realStages = (stage: string | undefined): string[] => (stage != null && ["51307", "51308", "51309"].includes(stage) ? ["51301", "51303", stage] : ["51301", ["51303", "51304", "51305"].includes(stage ?? "") ? (stage as string) : "51303", "51307"]);
const table = (layout: Layout) => tableFromLayout("escape-from-khazad-dum", { stages: realStages(layout.stage), ...layout });
const modifiersOf = (state: ScenarioState, stat: string): number => state.modifiers.filter((modifier) => modifier.stat === stat).length;

describe("Dark Pit holds the stage only until it has flipped", () => {
  it("51301:B:2 a Dark Pit that left play with no flip waiting does not hold the stage for good", () => {
    for (const layout of [{ discard: ["51310"] }, { setAside: ["51310"] }, { victory: ["51310"] }] as const) {
      const made = table({ stage: "51301", ...layout });
      expect(restricted(made.state, made.ctx, "advance"), JSON.stringify(layout)).toHaveLength(0);
    }
  });

  it("51301:B:2 the explored Dark Pit holds the stage while its explored event waits for the Forced effect, and not after the flip", () => {
    const made = table({ stage: "51301", discard: ["51310"] });
    const id = idOf(made.state, "51310");
    const waiting = { ...made.state, pendingEvents: [{ trigger: "locationExplored" as const, seat: null, subject: id }] };
    expect(restricted(waiting, made.ctx, "advance")).toHaveLength(1);
    const flipped = table({ stage: "51301", setAside: ["51311"] });
    expect(restricted(flipped.state, flipped.ctx, "advance")).toHaveLength(0);
  });
});

describe("the stage 2 and 3 cards' own flags", () => {
  it("51303:B:2 an enemy with no resource is not immune to player card effects, and the stage takes progress", () => {
    const made = table({ stage: "51303", staging: ["51318"] });
    expect(flagged(made.state, idOf(made.state, "51318"), "immuneToPlayerCards")).toBe(false);
    expect(flagged(made.state, idOf(made.state, "51303"), "noProgressPlaced")).toBe(false);
  });

  it("51309:B:1 no player's threat is reduced by a player card effect while this stage is current, and not on another stage 3 card", () => {
    expect(modifiersOf(table({ stage: "51309" }).state, "noThreatReduction")).toBe(1);
    expect(modifiersOf(table({ stage: "51307" }).state, "noThreatReduction")).toBe(0);
  });

  it("51308:B:2 Durin's Bane takes no more damage each round than the progress tokens on the stage, and none with no progress", () => {
    const withProgress = (progress: number) => {
      const made = table({ stage: "51308", staging: ["51311"], progress });
      const mine = made.state.modifiers.filter((modifier) => modifier.instanceId === idOf(made.state, "51311"));
      return { cap: mine.find((modifier) => modifier.stat === "damageCap")?.amount ?? 0, none: mine.some((modifier) => modifier.stat === "cannotTakeDamage") };
    };
    expect(withProgress(0).none).toBe(true);
    expect(withProgress(3)).toEqual({ cap: 3, none: false });
  });

  it("51308:A:1 with two players Durin's Bane engages the first player before the 3A steps, which still find it: it cannot take damage and attacks at once", () => {
    const made = table({ stage: "51308", seats: 2, setAside: ["51311"], deck: ["f0", "f0"], phase: "Quest" });
    const run = resolveRecords(made.state, made.ctx, "51308", "whenRevealed", idOf(made.state, "51308"));
    const bane = idOf(made.state, "51311");
    expect(run.state.cards[bane]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(flagged(run.state, bane, "cannotTakeDamage")).toBe(true);
    expect(run.state.pendingAttack ? run.state.cards[run.state.pendingAttack.enemyId]?.code : null).toBe("51311");
  });
});

describe("Durin's Bane's attacks on the stage (51307:B:2, 51307:B:3)", () => {
  const forced = (layout: Layout) => {
    const made = table({ stage: "51307", staging: ["51311"], deck: ["f0", "f0"], phase: "Quest", ...layout });
    const steps: EngineStep[] = [];
    const fired = settle(fireForced({ ...made.state, window: null }, { trigger: "beginningOfPhase", seat: 0, phase: "Quest" }, made.ctx, steps), made.ctx, steps);
    return { made, fired, steps };
  };

  it("51307:B:2 at the beginning of the quest phase it attacks the first player, and an undefended attack puts its damage on the stage, none on a hero", () => {
    const { made, fired, steps } = forced({});
    expect(fired.pendingAttack ? fired.cards[fired.pendingAttack.enemyId]?.code : null).toBe("51311");
    const run = finish(send({ state: fired, steps }, { type: "Undefended" }, made.ctx), made.ctx);
    expect(run.state.cards[made.state.questStage ?? ""]?.damage).toBe(8);
    expect(run.state.seats[0]?.heroes.every((hero) => run.state.cards[hero]?.damage === 0)).toBe(true);
  });

  it("51307:B:2 a defended attack puts on the stage the damage beyond what the defender needed to be destroyed", () => {
    const { made, fired, steps } = forced({ play: ["ally"] });
    const ally = idOf(made.state, "ally");
    const run = finish(send({ state: fired, steps }, { type: "DeclareDefender", defenderId: ally }, made.ctx), made.ctx);
    const card = made.state.cards[ally] as never;
    const left = 8 - modifiedStat(made.state, card, "defense", made.cards) - modifiedStat(made.state, card, "hitPoints", made.cards);
    expect(run.state.cards[made.state.questStage ?? ""]?.damage).toBe(left);
  });

  it("51307:B:3 the players lose when the stage holds damage equal to its quest points", () => {
    const made = table({ stage: "51307", staging: ["51311"], deck: ["f0", "f0"], phase: "Quest" });
    const stage = made.state.questStage ?? "";
    const marked = updateCard(made.state, stage, { damage: 5 });
    const steps: EngineStep[] = [];
    const fired = settle(fireForced({ ...marked, window: null }, { trigger: "beginningOfPhase", seat: 0, phase: "Quest" }, made.ctx, steps), made.ctx, steps);
    const run = finish(send({ state: fired, steps }, { type: "Undefended" }, made.ctx), made.ctx);
    expect(run.state.lost).toBe(true);
  });
});

describe("the encounter cards' table-wide and held effects", () => {
  it("51317:A:1 Forced: at the end of the combat phase an exhausted attached hero reveals 1 encounter card, and a ready one does not", () => {
    const reveal = (exhausted: boolean) => {
      const made = table({ phase: "Combat", attached: [{ code: "51317", to: "dh1" }], deck: ["f3", "f0"] });
      const state = updateCard(made.state, idOf(made.state, "dh1"), { exhausted });
      const steps: EngineStep[] = [];
      const fired = settle(fireForced({ ...state, window: null }, { trigger: "endOfPhase", seat: 0, phase: "Combat" }, made.ctx, steps), made.ctx, steps);
      return fired.cards[idOf(made.state, "f3")]?.zone;
    };
    expect(reveal(true)).toBe("staging");
    expect(reveal(false)).toBe("encounterDeck");
  });

  it("51324:A:1 no character can be declared as a defender against Rock Adder", () => {
    const made = table({ engaged: ["51324"], phase: "Combat" });
    const attacking = { ...made.state, pendingAttack: { enemyId: idOf(made.state, "51324"), seat: 0 } };
    expect(legalTargets(attacking, { type: "DeclareDefender" }, made.ctx)).toEqual([]);
  });

  it("51325:A:1 with Bottomless Chasm in the staging area the players may travel to it and to no other location", () => {
    const made = table({ phase: "Travel", staging: ["51325", "place"] });
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx).map((id) => made.state.cards[id]?.code)).toEqual(["51325"]);
  });

  it("51328:A:1 with an empty encounter deck nothing is discarded, X is 0 and no threat is raised, whatever lies in the discard pile", () => {
    const made = table({ staging: ["51328"], threat: [30, 30], discard: ["51330"] });
    const run = resolveRecords(made.state, made.ctx, "51328", "travel", idOf(made.state, "51328"));
    expect(run.state.seats[0]?.threat).toBe(30);
  });

  it("51329:A:1 each character's text box is blank, a character that enters play later this round too", () => {
    const made = table({ play: ["ally"] });
    const run = resolveRecords(made.state, made.ctx, "51329", "whenRevealed", undefined);
    expect([idOf(made.state, "dh1"), idOf(made.state, "ally")].map((id) => textBlank(run.state, id, made.cards))).toEqual([true, true]);
    const later = spawn(run.state, "ally", { zone: "play", seat: 0 });
    expect(textBlank(later.state, later.id, made.cards)).toBe(true);
  });

  it("51335:A:1 no character is readied by a player card effect this round, one that enters later too", () => {
    const made = table({});
    const run = resolveRecords(made.state, made.ctx, "51335", "whenRevealed", undefined);
    expect(modifiersOf(run.state, "cannotReadyByPlayerCard")).toBe(1);
  });

  it("51337:A:1 while in the staging area no player's threat is reduced by more than 1 each round", () => {
    expect(modifiersOf(table({ staging: ["51337"] }).state, "threatReductionCap")).toBe(1);
    expect(modifiersOf(table({}).state, "threatReductionCap")).toBe(0);
  });

  it("51351:A:1 the card under it is discarded to its owner's discard pile, not returned to the hand, when it leaves play", () => {
    const made = table({ staging: ["51351"], deckOf: ["c3", "filler"] });
    const enemy = idOf(made.state, "51351");
    const guarded = resolveRecords(made.state, made.ctx, "51351", "forced", enemy);
    const card = idOf(made.state, "c3");
    expect(guarded.state.cards[card]).toMatchObject({ zone: "under", host: enemy, face: "up" });
    expect(modifiedStat(guarded.state, guarded.state.cards[enemy] as never, "threat", made.cards)).toBe(4);
    const gone = settle(destroyCard({ ...guarded.state, window: null }, enemy, made.cards, [], true), made.ctx, []);
    expect(gone.cards[card]?.zone).toBe("discard");
    expect(gone.seats[0]?.discard).toContain(card);
    expect(gone.seats[0]?.hand).not.toContain(card);
  });
});
