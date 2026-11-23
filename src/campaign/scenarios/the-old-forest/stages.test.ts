// Rules: rr.quest-advancement, rr.quest-cards-quest-deck, rr.play-and-put-into-play, rr.victory, rr.active-location, rr.optional-engagement, rr.travel (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-old-forest.md (The Old Forest, Line readings).
import { describe, expect, it } from "vitest";

import { forestStart, forestWorld } from "../../../../test/scenarios/the-old-forest/game.ts";
import { finish, first, idOf, legalIntents, legalTargets, opening, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { playLimitBars } from "../../../rules/families/wilderland/rounds.ts";
import { reduce, startScenario, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";

// What The Old Forest's quest does that a spec row cannot show: the opening, the stage 2s coming and going in the quest deck, the one trigger a successful quest raises, the seeded switch of locations, the play limit and the victory read from X.
const STAGE_2 = ["147002", "147003", "147004", "147005"];
const FOREST = "147016";
const table = (layout: Layout = {}) => tableFromLayout("the-old-forest", layout);
// The game after the first seat keeps its opening hand and the players answer the Setup's search (the first location offered): the quest card's side B has resolved before the round's first phase.
const kept = (input: Parameters<typeof startScenario>[0], ctx: Parameters<typeof startScenario>[1]) => {
  let state = expectOk(reduce(startScenario(input, ctx), { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
};

describe("The Old Forest quest", () => {
  it("147001:B:1 resolves as the Setup ends: a stage 2 is the quest, the three others wait in the quest deck, each player drew 1 more card", async () => {
    const { ctx } = await forestWorld();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = kept(forestStart(1, seed, "Normal"), ctx);
      const stage = state.cards[state.questStage ?? ""];
      expect(STAGE_2, `seed ${seed}`).toContain(stage?.code);
      expect(state.questDeck.map((id) => state.cards[id]?.code).filter((code) => STAGE_2.includes(code ?? ""))).toHaveLength(3);
      expect(state.questDeck.map((id) => state.cards[id]?.code)).toContain("147006");
      expect(Object.values(state.cards).find((card) => card.code === "147001")?.zone).toBe("setAside");
      // The Setup's 6 cards, the 1 card of stage 1B and the Resource phase's draw.
      expect(state.seats[0]?.hand.length).toBe(8);
      expect(state.staging.map((id) => state.cards[id]?.code)).toHaveLength(1);
      expect(state.staging.filter((id) => state.cards[id]?.code === "147007" || state.cards[id]?.code === "147011")).toHaveLength(0);
    }
  });

  it("147001:B:1 the seed decides the stage 2, and the same seed the same one", async () => {
    const { ctx } = await forestWorld();
    const pick = (seed: number) => {
      const state = kept(forestStart(1, seed, "Normal"), ctx);
      return state.cards[state.questStage ?? ""]?.code;
    };
    expect(pick(3)).toBe(pick(3));
    expect(new Set(Array.from({ length: 16 }, (_, seed) => pick(seed + 1))).size).toBeGreaterThan(1);
  });

  it("147002:B:2 with fewer than X Victory points the quest goes to a different stage 2A, never the same, and the stage left returns to the quest deck with no progress and no attachments", () => {
    const left = new Set<string>();
    for (let seed = 1; seed <= 24; seed += 1) {
      const made = table({ seed, stage: "147002", phase: "Quest", victory: ["147013"], progress: 0, deck: ["f0", "f0", "f0"], attached: [{ code: "attachment", to: "147002" }] });
      const done = send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
      const finished = drain(done, made.ctx);
      const code = finished.state.cards[finished.state.questStage ?? ""]?.code ?? "";
      left.add(code);
      expect(code, `seed ${seed}`).not.toBe("147002");
      expect(STAGE_2).toContain(code);
      const old = finished.state.cards[idOf(finished.state, "147002")];
      expect(old?.zone).toBe("questDeck");
      expect(old?.progress).toBe(0);
      expect(old?.attachments).toEqual([]);
      expect(finished.state.cards[idOf(finished.state, "attachment")]?.zone).not.toBe("attached");
      expect(finished.state.cards[finished.state.questStage ?? ""]?.progress).toBe(0);
    }
    expect([...left].sort()).toEqual(["147003", "147004", "147005"]);
  });

  it("147002:B:2 raises its Forced effect once for a quest that placed progress on the active location and on the stage", () => {
    const made = table({ stage: "147002", phase: "Quest", victory: ["147013", "147016", "147014"], active: "place", deck: ["f0", "f0", "f0"] });
    const done = drain(send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
    // 4 willpower against no Threat: 2 progress explores the place, 2 go on the stage; 5 Victory points for 1 player send the quest to stage 3A, once.
    expect(done.steps.filter((step) => step.kind === "progress" && step.amount > 0)).toHaveLength(2);
    expect(done.state.cards[done.state.questStage ?? ""]?.code).toBe("147006");
    expect(done.steps.filter((step) => step.kind === "advance")).toHaveLength(1);
  });

  it("147003:B:2 the X test is decided once, before the advance: Victory exactly at X, and 3A's Swaying Without Wind returns a location from the victory display, the quest stays on stage 3", () => {
    // 2 players: X is 10, the victory display holds 3 + 2 + 1 + 2 + 2 points (Wall of Trees scores the 2 players).
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const t = table({ seed, seats: 2, stage: "147003", victory: ["147011", "147013", "147014", "147016", "147015"], setAside: ["147007"], deck: ["147017", "f0", "f0"] });
      const total = t.state.victory.reduce((sum, id) => sum + victoryPointsOf(t.state, id, t.cards), 0);
      expect(total).toBe(10);
      const run = resolveRecords(t.state, t.ctx, "147003", "forced", first(t.state, "147003"));
      const staged = run.state.cards[run.state.questStage ?? ""]?.code;
      expect(staged, `seed ${seed}`).toBe("147006");
      // Swaying Without Wind was revealed by 3A and returned a location: the display is now below X.
      expect(run.state.victory.reduce((sum, id) => sum + victoryPointsOf(run.state, id, t.cards), 0), `seed ${seed}`).toBeLessThan(10);
    }
  });

  it("147002:B:2 a successful quest that places no progress does not raise the Forced effect, though the display holds X", () => {
    const made = table({ stage: "147002", phase: "Quest", victory: ["147013", "147016", "147014"], deck: ["f0", "f0", "f0"] });
    // Nothing takes the progress (no active location, and the stage takes none): the quest succeeds with 0 placed.
    const barred = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: "table", sourceId: "table", stat: "noQuestProgress" as const, amount: 1, until: "endOfPhase" as const }] };
    const done = drain(send(start(barred), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
    expect(done.steps.some((step) => step.kind === "quest" && step.willpower > step.threat)).toBe(true);
    expect(done.steps.some((step) => step.kind === "progress" && step.amount > 0)).toBe(false);
    expect(done.state.cards[done.state.questStage ?? ""]?.code).toBe("147002");
    expect(done.steps.filter((step) => step.kind === "advance")).toHaveLength(0);
  });

  it("147002:B:2 a quest that does not succeed leaves the stage where it is", () => {
    const made = table({ stage: "147002", phase: "Quest", victory: ["147013", "147016", "147014"], staging: ["f3", "f3", "f3", "f3", "f3"], deck: ["f0", "f0", "f0"] });
    const done = drain(send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
    expect(done.state.cards[done.state.questStage ?? ""]?.code).toBe("147002");
  });
});

// Passes every window until the quest has resolved and its effects are done (the phase after the quest, or the end).
function drain(run: ReturnType<typeof start>, ctx: ReturnType<typeof table>["ctx"]) {
  let current = run;
  for (let guard = 0; guard < 40 && current.state.phase === "Quest"; guard += 1) {
    const intents = legalIntents(current.state, ctx);
    const next = intents.find((intent) => intent.type === "Pass") ?? intents.find((intent) => intent.type === "Choose");
    if (!next) break;
    current = send(current, next, ctx);
  }
  return current;
}

describe("The Wicked Willow (147006:B:2)", () => {
  it("147006:B:2 defeating the stage wins the game, with Withywindle gone from play", () => {
    const made = table({ stage: "147006", progress: 17, phase: "Quest", deck: ["f0", "f0", "f0"] });
    const done = drain(send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
    expect(done.state.stageCleared).toBe(true);
    expect(done.state.lost).toBeFalsy();
  });
});

describe("Long Trailer (147008:A:1)", () => {
  it("147008:A:1 each Long Trailer in the staging area attacks the first player after the active location is explored, and none attacks when it is not", () => {
    const attackers = (layout: Layout) => {
      const made = table({ stage: "147002", phase: "Quest", deck: ["f0", "f0", "f0"], ...layout });
      const done = drain(send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
      return done.steps.flatMap((step) => (step.kind === "attack" ? [done.state.cards[step.enemyId]?.code] : []));
    };
    // 4 willpower against the one Long Trailer's 2 Threat leaves 2 progress, which explores the place (2 quest points); Strange Woods (3 quest points) is not explored.
    expect(attackers({ active: "place", staging: ["147008"] })).toEqual(["147008"]);
    expect(attackers({ active: "147014", staging: ["147008"] })).toEqual([]);
  });
});

describe("LimitPlaysPerRound (147016:A:1)", () => {
  const made = (layout: Layout = {}) => table({ phase: "Planning", heroResources: 4, hand: ["ally", "ally", "event"], staging: [FOREST], ...layout });
  const play = (t: ReturnType<typeof made>, cardId: string) => send({ state: t.state, steps: [] }, { type: "PlayCard", cardId, payments: [{ heroId: t.hero, amount: t.cards.get(t.state.cards[cardId]?.code ?? "")?.cost ?? 0 }] }, t.ctx).state;
  const playable = (state: ReturnType<typeof made>["state"], ctx: ReturnType<typeof made>["ctx"]) => legalIntents(state, ctx).filter((intent) => intent.type === "PlayCard").length;

  it("147016:A:1 a player who played a card cannot play another this round, ally or event, in the phase or the next", () => {
    const t = made();
    expect(playable(t.state, t.ctx)).toBeGreaterThan(1);
    const played = play(t, legalIntents(t.state, t.ctx).find((intent) => intent.type === "PlayCard")?.cardId ?? "");
    expect(playable(played, t.ctx)).toBe(0);
    // The plays are counted for the round, whichever phase it is in.
    expect(playable({ ...played, phase: "Quest" }, t.ctx)).toBe(0);
  });

  it("147016:A:1 holds only while Oppressive Forest is in the staging area", () => {
    const t = made({ staging: [], discard: [FOREST] });
    const played = play(t, legalIntents(t.state, t.ctx).find((intent) => intent.type === "PlayCard")?.cardId ?? "");
    expect(playable(played, t.ctx)).toBeGreaterThan(0);
  });

  it("147016:A:1 a card put into play is not played and does not count", () => {
    const t = made({ hand: ["ally", "ally"] });
    const [inHand] = t.state.seats[0]?.hand ?? [];
    const put = runInstruction(t.state, { verb: "PutIntoPlay", card: "self" }, { seat: 0, sourceId: inHand }, t.ctx, []);
    expect(put.cards[inHand ?? ""]?.zone).toBe("play");
    expect(playable(put, t.ctx)).toBeGreaterThan(0);
  });

  it("147016:A:1 each player has his own count", () => {
    const t = made({ seats: 2, hand: ["ally"] });
    const mine = first(t.state, "ally");
    const played = play(t, mine);
    expect(played.cards[mine]?.zone).toBe("play");
    // The second seat has played nothing: its own card is not barred.
    const other = (played.seats[1]?.hand ?? [])[0] ?? "";
    expect(playLimitBars({ ...played, activeSeat: 1 }, other, t.ctx, {})).toBe(false);
    expect(playLimitBars({ ...played, activeSeat: 0 }, other, t.ctx, {})).toBe(true);
  });
});

describe("The switch of locations (147020:A:2)", () => {
  const switched = (seed: number, layout: Layout) => {
    const t = table({ seed, ...layout });
    const run = resolveRecords(t.state, t.ctx, "147020", "whenRevealed", undefined);
    return run.state;
  };

  it("147020:A:2 any location of the staging area may take the active location's place, chosen with the seed, and the old one returns to the staging area keeping its progress", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 16; seed += 1) {
      const state = switched(seed, { active: "place", staging: ["147012", "147013", "147014", "147016"], deck: [] });
      const active = state.cards[state.activeLocation ?? ""]?.code ?? "";
      seen.add(active);
      expect(["147012", "147013", "147014", "147016"]).toContain(active);
      expect(state.cards[idOf(state, "place")]?.zone).toBe("staging");
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(switched(5, { active: "place", staging: ["147012", "147013"] }).activeLocation).toBe(switched(5, { active: "place", staging: ["147012", "147013"] }).activeLocation);
  });

  it("147020:A:2 a unique active location stays, and with no location in the staging area nothing is switched", () => {
    const unique = switched(1, { active: "147011", staging: ["147012"] });
    expect(unique.cards[idOf(unique, "147011")]?.zone).toBe("activeLocation");
    const none = switched(1, { active: "place", staging: ["f0"] });
    expect(none.cards[idOf(none, "place")]?.zone).toBe("activeLocation");
  });
});

describe("Victory X (147015:A:1)", () => {
  it("147015:A:1 Wall of Trees scores the number of players in the victory display, and nothing outside it", () => {
    const t = table({ seats: 2, victory: ["147015", "147013"], staging: ["147015"] });
    const wall = t.state.victory.find((id) => t.state.cards[id]?.code === "147015") ?? "";
    expect(victoryPointsOf(t.state, wall, t.cards)).toBe(2);
    expect(t.state.victory.reduce((sum, id) => sum + victoryPointsOf(t.state, id, t.cards), 0)).toBe(4);
    const solo = table({ victory: ["147015"] });
    expect(victoryPointsOf(solo.state, solo.state.victory[0] ?? "", solo.cards)).toBe(1);
  });

  it("147007:A:2 Old Man Willow's attack discards Wall of Trees and the defending player raises his threat by its Victory points, read before it leaves the display", () => {
    const t = table({ seats: 2, victory: ["147015"], stage: "147006", staging: ["147007"], deck: ["f0", "f0", "f0"] });
    const hearing = resolveRecords(t.state, t.ctx, "147007", "forced", first(t.state, "147007"));
    expect(hearing.state.cards[idOf(hearing.state, "147015")]?.zone).toBe("encounterDiscard");
    expect(hearing.state.seats[0]?.threat).toBe((t.state.seats[0]?.threat ?? 0) + 2);
  });
});

describe("Old Man Willow's attacks (147007:A:2)", () => {
  it("147007:A:2 on two seats he attacks each player in turn, and each defending player, not the first player, raises his threat by the Victory points of the location his attack discarded", () => {
    for (const seed of [1, 2, 3, 4]) {
      const t = table({ seed, seats: 2, phase: "Combat", stage: "147006", staging: ["147007"], victory: ["147013", "147016"], deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
      let run = start(t.state);
      const before = [t.state.seats[0]?.threat ?? 0, t.state.seats[1]?.threat ?? 0];
      const defenders: number[] = [];
      for (let guard = 0; guard < 60 && run.state.phase === "Combat"; guard += 1) {
        const window = run.state.window;
        if (window?.kind === "defense") {
          defenders.push(run.state.activeSeat);
          run = send(run, { type: "Undefended", heroId: run.state.seats[run.state.activeSeat]?.heroes[0] ?? "" }, t.ctx);
        } else if (window?.kind === "choose") run = finish(run, t.ctx);
        else {
          const next = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
          if (!next) break;
          run = send(run, next, t.ctx);
        }
      }
      // Both attacks were made, one on each seat, and the display held two locations (2 Victory points each): each defender raised his own threat by 2, and the Refresh phase that follows raised each by 1.
      expect(defenders, `seed ${seed}`).toEqual([0, 1]);
      expect(run.state.victory, `seed ${seed}`).toHaveLength(0);
      expect(run.state.seats[0]?.threat, `seed ${seed}`).toBe(before[0]! + 3);
      expect(run.state.seats[1]?.threat, `seed ${seed}`).toBe(before[1]! + 3);
    }
  });
});

describe("Travel and engagement lines", () => {
  it("147012:A:2 with no active location the players may travel only to Misleading Path", () => {
    const t = table({ phase: "Travel", staging: ["147012", "place"] });
    expect(legalTargets(t.state, { type: "Travel" }, t.ctx).map((id) => t.state.cards[id]?.code)).toEqual(["147012"]);
  });

  it("147012:A:2 with Misleading Path out of the staging area the players may travel to any location", () => {
    const t = table({ phase: "Travel", staging: ["147013", "place"] });
    expect(legalTargets(t.state, { type: "Travel" }, t.ctx)).toHaveLength(2);
  });

  it("147013:A:1 after a player optionally engages an enemy he raises his threat by the enemy's Attack", () => {
    const t = table({ phase: "Encounter", staging: ["147013", "f3"], deck: [] });
    const engaged = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, "f3") }, t.ctx);
    expect(engaged.state.seats[0]?.threat).toBe((t.state.seats[0]?.threat ?? 0) + 1);
  });
});

describe("Tom Bombadil (147022:A:1)", () => {
  // Reveals Tom, optionally takes him out of play first, and plays the round to its end.
  const throughRound = (leaves: boolean) => {
    const t = table({ deck: ["f0", "f0", "f0", "f0", "f0"], discard: ["f0", "f0"] });
    const revealed = resolveRecords(t.state, t.ctx, "147022", "whenRevealed", undefined);
    const tom = revealed.id;
    let run = { state: { ...revealed.state, ...opening("Quest") }, steps: revealed.steps };
    if (leaves) run = { ...run, state: moveCard(run.state, tom, { zone: "encounterDiscard" }) };
    for (let guard = 0; guard < 80 && run.state.round < 1; guard += 1) {
      if (run.state.window?.kind === "choose") {
        run = finish(run, t.ctx);
        continue;
      }
      const next = legalIntents(run.state, t.ctx).find((intent) => ["Pass", "DeclineAttack", "DeclineEngage", "DeclineTravel"].includes(intent.type));
      if (!next) break;
      run = send(run, next as PlayerIntent, t.ctx);
    }
    return { state: run.state, tom };
  };

  it("147022:A:1 Tom is discarded at the end of the round and the encounter discard pile, Tom in it, is shuffled into the encounter deck", () => {
    const { state, tom } = throughRound(false);
    expect(state.encounterDiscard).toHaveLength(0);
    expect(state.encounterDeck).toContain(tom);
    // 5 cards less the quest phase's reveal, the 2 in the discard pile and Tom.
    expect(state.encounterDeck).toHaveLength(7);
  });

  it("147022:A:1 Tom already out of play when the round ends: nothing is discarded, so the discard pile is not shuffled into the deck", () => {
    const { state, tom } = throughRound(true);
    expect(state.encounterDiscard).toContain(tom);
    expect(state.encounterDiscard).toHaveLength(3);
    expect(state.encounterDeck).toHaveLength(4);
  });
});

describe("Song of Sleep (147019:A:2)", () => {
  it("147019:A:2 with no questing hero, or only heroes that already carry a Song of Sleep, it attaches to none and is discarded as a treachery", () => {
    const none = table({ deck: ["f0", "f0", "f0"] });
    const noneRun = revealFromTop(none.state, none.ctx, "147019", []);
    const afterNone = finish({ state: noneRun.state, steps: [] }, none.ctx).state;
    expect(afterNone.cards[noneRun.id]?.zone).not.toBe("attached");
    expect(Object.values(afterNone.cards).some((card) => card.host != null && card.code === "147019")).toBe(false);
    const carrying = table({ committed: ["dh1", "dh2"], attached: [{ code: "147019", to: "dh1" }, { code: "147019", to: "dh2" }], deck: ["f0", "f0", "f0"] });
    const spent = revealFromTop(carrying.state, carrying.ctx, "147019", []);
    const afterCarrying = finish({ state: spent.state, steps: [] }, carrying.ctx).state;
    expect(afterCarrying.cards[spent.id]?.zone).not.toBe("attached");
    expect(Object.values(afterCarrying.cards).filter((card) => card.host != null && card.code === "147019")).toHaveLength(2);
  });
});
