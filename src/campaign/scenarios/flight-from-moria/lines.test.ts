// Rules: rr.forced, rr.shadow-effects, rr.combat-phase, rr.search, rr.victory, rr.immune-to-player-card-effects, dwd.the-nameless-fear, dwd.bypassing-a-quest-card, dwd.creating-the-quest-deck, dwd.encounter-card-actions, faq.additional-attacks (data/rules/entries.json); ledger lines 901203:B:1, 901202:B:2, 03073:B:1, 03073:B:2, 03070:B:1, 901201:A:2, 901205:A:2, 901207:A:1, 901208:A:1, 901209:A:3, 03027:A:1, 03029:A:2, 03076:B:1.
// Flight from Moria's records that need more than one row: Blocked by Flame's attacks in a played combat phase, the progress cap of a round, Narrow Paths' Willpower and first progress, what a bypass does to the stage and the deck, the Nightmare shuffle, Swarming Goblins and Shadowed Corridor
// over several bypasses and players, Dismay and Fear's total, The Nameless Fear's immunity, the Tools and Shadow of Fear, and the lines whose row would pass without the record (what a record leaves alone).
import { describe, expect, it } from "vitest";

import type { PickSpec } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { expireModifiers, updateCard } from "../../../rules/core/state.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { questRoom, noteQuestPlaced } from "../../../rules/families/caves/progress.ts";
import { committedWillpower } from "../../../rules/quest/quest.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { announce, answer, attack, committed, count, defend, endPhase, endRound, progressOn, reveal, resolve, rowProblems, threat, zone, type Act, type Row } from "../../../../test/harness/card-spec.ts";
import { idOf, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("flight-from-moria", layout);
const holds = (row: Row) => expect(rowProblems("flight-from-moria", row, EFFECTS)).toEqual([]);
const BYPASS: readonly Act[] = [announce("endOfPhase", undefined, { phase: "Combat" }), answer("bypass")];
const played = (layout: Layout, act: Act | readonly Act[]) => play("flight-from-moria", { line: "", layout, act, expect: [] }, EFFECTS, false);
const FEAR = { staging: ["03025"], victory: ["03042"] } as const;

describe("901203:B:1 Blocked by Flame", () => {
  it("901203:B:1 The Nameless Fear attacks each player in turn from the staging area at the start of the combat phase, each attack dealt a new shadow card, the earlier one discarded", () => {
    const made = table({ stage: "901203", seats: 2, phase: "Encounter", staging: ["03025"], victory: ["03042"], engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "f0", "f0", "f0", "f0"] });
    let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    const seen: { attacker: string | undefined; seat: number; deck: number; discarded: number }[] = [];
    for (let guard = 0; guard < 60 && !run.state.lost; guard += 1) {
      const window = run.state.window;
      if (window?.kind === "defense") {
        const attacker = run.state.cards[run.state.pendingAttack?.enemyId ?? ""]?.code;
        seen.push({ attacker, seat: window.seat, deck: run.state.encounterDeck.length, discarded: run.state.encounterDiscard.length });
        // The first player's hero dh2 defends The Nameless Fear's attack (the defender window of an attack from the staging area); every other attack is undefended.
        const defends = attacker === "03025" && window.seat === 0;
        run = send(run, defends ? { type: "DeclareDefender", defenderId: made.hero2 } : { type: "Undefended", heroId: run.state.seats[window.seat]!.heroes[0]! }, made.ctx);
        continue;
      }
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass || (run.state.phase !== "Combat" && run.state.phase !== "Encounter")) break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
    // The Nameless Fear's attacks come first, one on each player in turn order, each dealt a shadow card of its own and the earlier one discarded before the next is dealt; then the Goblin engaged with the first player attacks.
    expect(seen.map((one) => `${one.attacker}:${one.seat}`)).toEqual(["03025:0", "03025:1", "f3:0"]);
    expect(seen.map((one) => one.deck)).toEqual([4, 3, 2]);
    expect(seen.map((one) => one.discarded)).toEqual([0, 1, 1]);
    // X is 3: dh2 (Defense 2) took 1 of the first attack, the second put 3 damage undefended on the second player's hero, and the Goblin's 1 went undefended to dh1.
    expect(run.state.cards[made.hero2]?.damage).toBe(1);
    expect(run.state.cards[made.hero]?.damage).toBe(1);
    expect(run.state.cards[made.seat1Hero ?? ""]?.damage).toBe(3);
  });
});

describe("901202:B:2 Pursued by Shadow's progress cap", () => {
  it("901202:B:2 is 1 progress a round, not 1 in all: the next round has room again", () => {
    const made = tableFromLayout("flight-from-moria", { stage: "901202" });
    expect(questRoom(made.state)).toBe(1);
    const placed = noteQuestPlaced(made.state, 1);
    expect(questRoom(placed)).toBe(0);
    expect(questRoom(expireModifiers(placed, ["endOfRound"]))).toBe(1);
  });
});

describe("03073:B:1 Narrow Paths' Willpower", () => {
  it("03073:B:1 counts only the chosen character: a character that commits after the choice, or was not questing, adds nothing until the end of the round", () => {
    const made = tableFromLayout("flight-from-moria", { stage: "03073", committed: ["dh1", "dh2"], play: ["ally"] });
    const done = played({ stage: "03073", committed: ["dh1", "dh2"], play: ["ally"] }, [resolve("03073", "whenRevealed"), answer("dh1")]);
    expect(committedWillpower(done.run.state, made.cards)).toBe(2);
    const ally = idOf(done.run.state, "ally");
    expect(committedWillpower(updateCard(done.run.state, ally, { committed: true }), made.cards)).toBe(2);
    // The round ends: every character counts again.
    expect(committedWillpower(expireModifiers(updateCard(done.run.state, ally, { committed: true }), ["endOfRound"]), made.cards)).toBe(2 + 2 + 1);
  });
});

describe("03073:B:2 Narrow Paths' first progress", () => {
  const progressed = (progress: number, amount: number) => played({ stage: "03073", progress, seed: 1, deck: ["f0", "f3", "place", "treachery", "03029"] }, announce("progressPlaced", "03073", { amount }));
  const deckOf = (done: ReturnType<typeof progressed>) => done.run.state.encounterDeck.map((id) => done.run.state.cards[id]?.code).filter((code) => code !== "03029");

  it("03073:B:2 fires when the placement is the stage's first (X is the amount just placed) and the deck is shuffled afterwards", () => {
    const done = progressed(3, 3);
    expect(done.run.state.cards[idOf(done.run.state, "03029")]?.zone).toBe("staging");
    // The deck holds the same cards in another order than when nothing searched it.
    expect(deckOf(done)).not.toEqual(deckOf(progressed(3, 1)));
    expect([...deckOf(done)].sort()).toEqual([...deckOf(progressed(3, 1))].sort());
  });

  it("03073:B:2 does not fire for a later progress: the stage held tokens already", () => {
    const done = progressed(3, 1);
    expect(done.run.state.cards[idOf(done.run.state, "03029")]?.zone).toBe("encounterDeck");
  });

  it("03073:B:2 finds nothing when the Tools are attached to a hero already", () => {
    const done = played({ stage: "03073", progress: 1, attached: [{ code: "03029", to: "dh1" }], deck: ["f0"] }, announce("progressPlaced", "03073", { amount: 1 }));
    expect(done.run.state.cards[idOf(done.run.state, "03029")]).toMatchObject({ host: idOf(done.run.state, "dh1") });
    expect(done.run.state.staging).not.toContain(idOf(done.run.state, "03029"));
  });
});

describe("bypassing a stage (03070:B:2, 901201:A:2)", () => {
  it("03070:B:2 the stage goes to the bottom of the quest deck side A up with its progress removed and the top stage is revealed side A; it is not in the victory display", () => {
    const done = played({ stage: "03070", progress: 2, phase: "Combat" }, BYPASS);
    const state = done.run.state;
    const old = state.cards[idOf(state, "03070")]!;
    expect(old).toMatchObject({ zone: "questDeck", face: "A", progress: 0 });
    expect(state.questDeck.at(-1)).toBe(old.id);
    expect(state.cards[state.questStage ?? ""]).toMatchObject({ face: "A", zone: "questStage" });
    expect(state.cards[state.questStage ?? ""]?.code).toBe("03071");
    expect(state.victory).not.toContain(old.id);
  });

  it("901201:A:2 with the Nightmare setup card the stage is shuffled into the quest deck first and the top is revealed: it can come straight back, and no stage is lost", () => {
    const layout: Layout = { stage: "03072", progress: 2, phase: "Combat", nightmare: "901201" };
    // Seed 8 deals the bypassed stage back as the new current quest, seed 1 another one: the shuffle decides.
    const back = played({ ...layout, seed: 8 }, BYPASS).run.state;
    expect(back.cards[back.questStage ?? ""]).toMatchObject({ code: "03072", face: "A", progress: 0 });
    const other = played({ ...layout, seed: 1 }, BYPASS).run.state;
    expect(other.cards[other.questStage ?? ""]?.code).toBe("03073");
    for (const state of [back, other]) expect([state.questStage, ...state.questDeck].map((id) => state.cards[id ?? ""]?.code).sort()).toEqual(["03072", "03073", "03074", "03075", "03076"]);
    // Without the card the top stage is revealed whatever the seed, and the stage goes to the bottom.
    const plain = played({ ...layout, nightmare: undefined, seed: 8 }, BYPASS).run.state;
    expect(plain.cards[plain.questStage ?? ""]?.code).toBe("03073");
    expect(plain.cards[plain.questDeck.at(-1) ?? ""]?.code).toBe("03072");
  });

  it("901201:A:2 in a played combat phase the first player's answer at its end bypasses and the stage leaves with no progress", () => {
    holds({ line: "901201:A:2", layout: { stage: "03075", progress: 2, phase: "Combat", nightmare: "901201", seed: 4 }, act: endRound, expect: [progressOn("03075", 0), count("03075", "questStage", 0), count("03075", "questDeck", 1)] });
  });
});

describe("901205:A:2 Swarming Goblins", () => {
  it("901205:A:2 hears every bypass: two bypasses in a row bring two Goblin Spearmen", () => {
    holds({ line: "901205:A:2", layout: { stage: "03070", progress: 2, phase: "Combat", engaged: ["901205"], discard: ["03031", "03031"] }, act: [...BYPASS, announce("stagingStepBegins"), ...BYPASS], expect: count("03031", "engaged", 2) });
  });

  it("901205:A:2 only while engaged: a copy in the staging area hears nothing", () => {
    holds({ line: "901205:A:2", layout: { stage: "03070", progress: 2, phase: "Combat", staging: ["901205"], discard: ["03031"] }, act: BYPASS, expect: count("03031", "engaged", 0) });
  });
});

describe("901207:A:1 Shadowed Corridor", () => {
  it("901207:A:1 each player pays 2 threat for each copy in play when the first player bypasses, a cost paid before the stage goes", () => {
    // 28 + 2 copies x 2 + 1 for the refresh phase's raise.
    holds({ line: "901207:A:1", layout: { stage: "03072", progress: 2, phase: "Combat", seats: 2, staging: ["901207", "901207"] }, act: BYPASS, expect: [threat(33, 0), threat(33, 1)] });
  });

  it("901207:A:1 with the first player staying nobody pays", () => {
    holds({ line: "901207:A:1", layout: { stage: "03072", progress: 2, phase: "Combat", staging: ["901207"] }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("stay")], expect: [threat(29), progressOn("03072", 2)] });
  });
});

describe("901208:A:1 Dismay and Fear's total", () => {
  it("901208:A:1 the first player takes characters of any player one at a time and stops once the Willpower removed is at least the Threat: dh3 then dh1 is 4 of 3", () => {
    holds({ line: "901208:A:1", layout: { ...FEAR, seats: 2, committed: ["dh1", "dh2", "dh3"], deck: ["f0"] }, act: [reveal("901208"), answer("dh3"), answer("dh1")], expect: [committed("dh3", false), committed("dh1", false), committed("dh2", true)] });
  });

  it("901208:A:1 removes every questing character when the Threat is more than their Willpower together", () => {
    holds({ line: "901208:A:1", layout: { staging: ["03025"], victory: ["03042", "03072"], committed: ["dh1", "dh2"], deck: ["f0"] }, act: reveal("901208"), expect: [committed("dh1", false), committed("dh2", false)] });
  });

  it("901208:A:1 removes nobody with The Nameless Fear's Threat at 0", () => {
    holds({ line: "901208:A:1", layout: { staging: ["03025"], committed: ["dh1", "dh2"], deck: ["f0"] }, act: reveal("901208"), expect: [committed("dh1", true), committed("dh2", true)] });
  });
});

describe("901209:A:3 An Evil Fortune's Shadow", () => {
  it("901209:A:3 stays out of the victory display when the attack destroys no character", () => {
    holds({ line: "901209:A:3", layout: {}, act: [attack("f0", { shadow: "901209" }), defend("dh1")], expect: [count("901209", "victory", 0), zone("901209", "shadow")] });
  });

  it("901209:A:3 it is the shadow card that goes to the victory display, not the attacking enemy", () => {
    holds({ line: "901209:A:3", layout: { play: ["ally"] }, act: [attack("03030", { shadow: "901209" }), defend("ally")], expect: [count("03030", "victory", 0)] });
  });
});

describe("03025 The Nameless Fear's immunity (FAQ 1.47)", () => {
  it("03025:A:2 player card effects cannot choose it, quest and encounter card effects can", () => {
    const made = tableFromLayout("flight-from-moria", { stage: "901203", staging: ["03025"], play: ["ally"] });
    const spec: PickSpec = { type: "enemy", control: "any", staging: true, names: ["The Nameless Fear"] };
    const fear = idOf(made.state, "03025");
    expect(pickCandidates(made.state, spec, 0, [], idOf(made.state, "ally"), made.ctx)).not.toContain(fear);
    expect(pickCandidates(made.state, spec, 0, [], idOf(made.state, "901203"), made.ctx)).toContain(fear);
  });
});

describe("the Tools and Shadow of Fear (03029:A:2, 03076:B:1, 03027:A:1)", () => {
  // The refresh phase opens with no window: the players' action window is the pass window.
  const offered = (done: ReturnType<typeof played>, code: string) => legalIntents({ ...done.run.state, window: { kind: "pass" } }, done.table.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(done.run.state, code));

  it("03029:A:2 is offered while a ready hero can exhaust, and not when Shadow of Fear holds every hero", () => {
    expect(offered(played({ staging: ["03029"] }, []), "03029")).toBe(true);
    expect(offered(played({ staging: ["03029"], attached: [{ code: "03027", to: "dh1" }] }, []), "03029")).toBe(true);
    expect(offered(played({ staging: ["03029"], attached: [{ code: "03027", to: "dh1" }, { code: "03027", to: "dh2" }] }, []), "03029")).toBe(false);
  });

  it("03076:B:1 is offered to the hero with the Tools only while it can exhaust: Shadow of Fear on it stops the Action", () => {
    const layout: Layout = { stage: "03076", phase: "Refresh", attached: [{ code: "03029", to: "dh1" }] };
    expect(offered(played(layout, []), "03076")).toBe(true);
    expect(offered(played({ ...layout, attached: [...(layout.attached ?? []), { code: "03027", to: "dh1" }] }, []), "03076")).toBe(false);
  });

  it("03076:B:1 puts no progress on the stage unpaid: a hero that cannot exhaust adds nothing", () => {
    const done = played({ stage: "03076", phase: "Refresh", attached: [{ code: "03029", to: "dh1" }, { code: "03027", to: "dh1" }] }, resolve("03076", "action"));
    expect(done.run.state.cards[idOf(done.run.state, "03076")]?.progress).toBe(0);
  });

  it("03076:B:1 with the Nightmare setup card the Action is used once a round, even when the hero readies in between", () => {
    const layout: Layout = { stage: "03076", phase: "Refresh", nightmare: "901201", attached: [{ code: "03029", to: "dh1" }] };
    const first = played(layout, resolve("03076", "action"));
    expect(first.run.state.cards[idOf(first.run.state, "03076")]?.progress).toBe(1);
    const readied: Run = { ...first.run, state: updateCard(first.run.state, idOf(first.run.state, "dh1"), { exhausted: false }) };
    expect(offered({ ...first, run: readied }, "03076")).toBe(false);
    // Without the setup card the readied hero can use it again.
    const plain = played({ ...layout, nightmare: undefined }, resolve("03076", "action"));
    const again: Run = { ...plain.run, state: updateCard(plain.run.state, idOf(plain.run.state, "dh1"), { exhausted: false }) };
    expect(offered({ ...plain, run: again }, "03076")).toBe(true);
  });

  it("03027:A:1 with no hero of the first player free of Shadow of Fear it is discarded", () => {
    holds({ line: "03027:A:1", layout: { attached: [{ code: "03027", to: "dh1" }, { code: "03027", to: "dh2" }], deck: ["f0"] }, act: reveal("03027"), expect: count("03027", "encounterDiscard", 1) });
  });
});

describe("the stage 2 records in a played phase (03070:B:1, 03071:B:1)", () => {
  it("03070:B:1 Heading Down returns Heading Up from the victory display when the quest phase ends", () => {
    holds({ line: "03070:B:1", layout: { stage: "03070", victory: ["03071"] }, act: endPhase, expect: [count("03071", "victory", 0), count("03071", "questDeck", 2)] });
  });

  it("03071:B:1 Heading Up returns Heading Down likewise, and a stage defeated in that phase has left play and hears nothing", () => {
    holds({ line: "03071:B:1", layout: { stage: "03071", victory: ["03070"] }, act: endPhase, expect: [count("03070", "victory", 0), count("03070", "questDeck", 1)] });
  });
});
