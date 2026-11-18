// Rules: dwd.doors-of-durin, dwd.regenerate, rr.active-location, rr.travel, rr.reveal, rr.search, rr.first-player, rr.encounter-deck, rr.shadow-effects, rr.attachment-cards, rr.destroy, rr.damage (data/rules/entries.json); ledger lines 04065:A:1, 04065:A:2, 04066:A:1, 04068:A:1, 04069:A:1, 04072:A:2,
// 04073:A:1, 04074:A:1, 04075:A:1, 901502:A:1, 901503:A:1, 901504:A:1, 901506:A:1, 901506:A:2, 901507:A:1, 901507:A:2, 901508:A:2.
// The new verbs, flags and conditions of The Watcher in the Water, each on a table of the scene kit: the progress sent to the quest, the Travel costs, the discard check of the Tentacles and what follows it, the Tentacle attachments, Hideous Depths' look and Pulled Under.
import { describe, expect, it } from "vitest";

import { destroyCard, modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { lookAtTop } from "../../../rules/families/encounter/moves.ts";
import { finish, fightEnemy, idOf, idsOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-watcher-in-the-water";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);

describe("04065:A:1 Doors of Durin sends its progress to the quest", () => {
  it("04065:A:1 progress a card effect places on it goes on the current quest stage and never explores it", () => {
    const made = table({ stage: "04064", active: "04065" });
    const doors = idOf(made.state, "04065");
    const stage = made.state.questStage ?? "";
    const done = { state: placeProgress(made.state, doors, 2, made.ctx, []) };
    expect(done.state.cards[stage]?.progress).toBe(2);
    expect(done.state.cards[doors]?.progress ?? 0).toBe(0);
    expect(done.state.cards[doors]?.zone).toBe("activeLocation");
  });

  it("04065:A:1 progress on another location stays there", () => {
    const made = table({ stage: "04064", active: "04067" });
    const swamp = idOf(made.state, "04067");
    const done = { state: placeProgress(made.state, swamp, 1, made.ctx, []) };
    expect(done.state.cards[swamp]?.progress).toBe(1);
    expect(done.state.cards[made.state.questStage ?? ""]?.progress ?? 0).toBe(0);
  });
});

describe("04066:A:1 Stair Falls needs two ready characters", () => {
  it("04066:A:1 cannot be traveled to with fewer than 2 ready characters, and can with 2", () => {
    const made = table({ phase: "Travel", staging: ["04066"] });
    const place = idOf(made.state, "04066");
    const heroes = made.state.seats[0]?.heroes ?? [];
    // The table's first player has two hero stand-ins: both ready pay for it, one exhausted cannot.
    expect(travelCostUnpayable(made.state, made.ctx, place)).toBe(false);
    const hurt = updateCard(made.state, heroes[0] ?? "", { exhausted: true });
    expect(travelCostUnpayable(hurt, made.ctx, place)).toBe(true);
    // An ally is a character too.
    const ally = table({ phase: "Travel", staging: ["04066"], play: [{ code: "ally" }] });
    const tired = updateCard(ally.state, ally.state.seats[0]?.heroes[0] ?? "", { exhausted: true });
    expect(travelCostUnpayable(tired, ally.ctx, idOf(tired, "04066"))).toBe(false);
  });
});

/** The combat phase until the defense window opens for the enemy engaged with the first seat (the deck: `deck`, the first card its shadow). */
function toDefense(enemy: string, deck: readonly string[], layout: Layout = {}) {
  const made = table({ phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck, ...layout });
  let run: Run = send(start(syncConstants(made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    if (run.state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (run.state.window?.kind === "look") {
      run = send(run, { type: "Pass" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return { made, run };
}

describe("04075:A:1 Striking Tentacle", () => {
  it("04075:A:1 an attack is considered undefended when the discarded card has a shadow effect", () => {
    const { run } = toDefense("04075", ["f0", "04066", "f0", "f0"]);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.undefended).toBe(true);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toContain("04066");
  });

  it("04075:A:1 an attack is considered undefended when the discarded card is a Tentacle enemy", () => {
    const { run } = toDefense("04075", ["f0", "04073", "f0", "f0"]);
    expect(run.state.pendingAttack?.undefended).toBe(true);
  });

  it("04075:A:1 the attack is defended as usual when the discarded card is neither", () => {
    const { run } = toDefense("04075", ["f0", "f0", "f0", "f0"]);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.undefended ?? false).toBe(false);
  });
});

/** The first hero attacks the enemy engaged with him, the deck above holding the cards the Tentacle's Forced effect discards. */
function attackIt(enemy: string, deck: readonly string[], layout: Layout = {}) {
  const made = table({ phase: "PlayerAttacks", engaged: [{ code: enemy }], deck, ...layout });
  const state = syncConstants(made.state, made.ctx);
  const target = Object.values(state.cards).find((card) => card.code === enemy && card.zone === "engaged")?.id ?? "";
  const run = finish(send(start(state), { type: "DeclareAttackers", enemyId: target, attackerIds: [made.hero] }, made.ctx), made.ctx);
  return { made, run, enemy: target };
}

describe("04073:A:1 Grasping Tentacle", () => {
  it("04073:A:1 attaches to the attacking character on a match, the attack deals it no damage and the character's Attack and Defense are 0", () => {
    const { made, run, enemy } = attackIt("04073", ["04066", "f0", "f0"]);
    const card = run.state.cards[enemy];
    expect(card?.zone).toBe("attached");
    expect(card?.host).toBe(made.hero);
    expect(card?.asAttachment).toBe("discard");
    expect(card?.damage).toBe(0);
    expect(modifiedStat(run.state, run.state.cards[made.hero]!, "attack", made.cards)).toBe(0);
    expect(modifiedStat(run.state, run.state.cards[made.hero]!, "defense", made.cards)).toBe(0);
    expect(run.state.cards[made.hero]?.exhausted).toBe(true);
  });

  it("04073:A:1 is no enemy while it lies there: the Watcher may be optionally engaged again (04072:A:2)", () => {
    const { made, run, enemy } = attackIt("04073", ["04066", "f0", "f0"], { staging: ["04072"] });
    const watcher = idOf(run.state, "04072");
    expect(run.state.cards[enemy]?.zone).toBe("attached");
    expect(flagged(syncConstants(run.state, made.ctx), watcher, "cannotBeOptionallyEngaged")).toBe(false);
    // Before the attach, with the Tentacle engaged, it cannot.
    const before = table({ phase: "Encounter", engaged: [{ code: "04073" }], staging: ["04072"] });
    expect(flagged(syncConstants(before.state, before.ctx), idOf(before.state, "04072"), "cannotBeOptionallyEngaged")).toBe(true);
  });

  it("04073:A:1 is discarded to the encounter discard pile when its host leaves play", () => {
    const { made, run, enemy } = attackIt("04073", ["04066", "f0", "f0"]);
    const gone = destroyCard(run.state, made.hero, made.cards, []);
    expect(gone.cards[enemy]?.zone).toBe("encounterDiscard");
    expect(gone.cards[enemy]?.asAttachment).toBeUndefined();
  });

  it("04073:A:1 does nothing when the discarded card has no shadow effect and is no Tentacle enemy: the attack goes on", () => {
    const { run, enemy } = attackIt("04073", ["f0", "f0", "f0"]);
    expect(run.state.cards[enemy]?.zone).toBe("engaged");
    expect(run.state.cards[enemy]?.damage).toBeGreaterThan(0);
  });
});

describe("04074:A:1 Thrashing Tentacle", () => {
  it("04074:A:1 deals the damage of the attack to a character an attacking player controls, ignoring defense, and takes none itself", () => {
    const { made, run, enemy } = attackIt("04074", ["04066", "f0", "f0"]);
    expect(run.state.cards[enemy]?.damage).toBe(0);
    expect(run.state.cards[enemy]?.zone).toBe("engaged");
    const heroes = made.state.seats[0]?.heroes ?? [];
    const hit = heroes.filter((id) => (run.state.cards[id]?.damage ?? 0) > 0);
    expect(hit).toHaveLength(1);
    expect(run.state.cards[hit[0] ?? ""]?.damage).toBe(2);
  });

  it("04074:A:1 takes the damage of the attack as usual with no match", () => {
    const { run, enemy } = attackIt("04074", ["f0", "f0", "f0"]);
    expect(run.state.cards[enemy]?.damage).toBe(2);
  });
});

const enemiesIn = (state: ScenarioState, zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.code);

describe("04069:A:1 Stagnant Creek", () => {
  it("04069:A:1 adds a discarded Tentacle enemy to the staging area (not revealed) and raises each player's threat by 5", () => {
    const made = table({ staging: ["04069"], deck: ["04073", "f0"], threat: [20, 20], seats: 2 });
    const done = resolveRecords(made.state, made.ctx, "04069", "whenRevealed", idOf(made.state, "04069"));
    expect(enemiesIn(done.state, "staging")).toContain("04073");
    expect(done.state.seats[0]?.threat).toBe(25);
    expect(done.state.seats[1]?.threat).toBe(25);
  });

  it("04069:A:1 leaves any other discarded card in the discard pile and the threat alone", () => {
    const made = table({ staging: ["04069"], deck: ["04066", "f0"], threat: [20, 20], seats: 2 });
    const done = resolveRecords(made.state, made.ctx, "04069", "whenRevealed", idOf(made.state, "04069"));
    expect(enemiesIn(done.state, "encounterDiscard")).toContain("04066");
    expect(done.state.seats[0]?.threat).toBe(20);
  });
});

describe("04065:A:2 Doors of Durin's first letter", () => {
  /** The Action resolves with `discarded` the codes the first player discards from his hand; the top card of the deck is `top`. */
  function action(discarded: readonly string[], top: string) {
    const made = table({ stage: "04064", active: "04065", deck: [top, "f0"], hand: ["filler", "event"], setAside: [] });
    const doors = idOf(made.state, "04065");
    const names = new Map<string, string>(discarded.map((code) => [code, code]));
    // Each player may discard any number of cards: the first player picks the cards in `discarded`, then stops.
    let pickedAt = 0;
    const pick = (state: ScenarioState) => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      const wanted = [...names.keys()][pickedAt];
      const option = options.find((id) => state.cards[id]?.code === wanted);
      if (option) {
        pickedAt += 1;
        return option;
      }
      return "done";
    };
    return { made, done: resolveRecords(made.state, made.ctx, "04065", "action", doors, pick), doors };
  }

  it("04065:A:2 goes to the victory display when the top card's title starts with a discarded card's first letter", () => {
    // "filler" and "f0" are stand-ins whose titles are their codes: the letter f matches.
    const { done, doors } = action(["filler"], "f0");
    expect(done.state.cards[doors]?.zone).toBe("victory");
  });

  it("04065:A:2 stays when no letter matches", () => {
    const { done, doors } = action(["filler"], "04066");
    expect(done.state.cards[doors]?.zone).toBe("activeLocation");
    expect(enemiesIn(done.state, "encounterDiscard")).toContain("04066");
  });

  it("04065:A:2 discards nothing and matches nothing when no card is discarded from the hands", () => {
    const { done, doors } = action([], "f0");
    expect(done.state.cards[doors]?.zone).toBe("activeLocation");
    expect(enemiesIn(done.state, "encounterDiscard")).toContain("f0");
  });
});

describe("901507:A:1 Pulled Under", () => {
  it("901507:A:1 deals 3 damage to each character with a Tentacle attachment, and only to them", () => {
    const made = table({ staging: ["901507"], attached: [{ code: "040076", to: "dh1" }], deck: ["f0"] });
    const [first, second] = made.state.seats[0]?.heroes ?? [];
    const done = resolveRecords(made.state, made.ctx, "901507", "whenRevealed", idOf(made.state, "901507"));
    expect(done.state.cards[first ?? ""]?.damage).toBe(3);
    expect(done.state.cards[second ?? ""]?.damage).toBe(0);
  });

  it("901507:A:1 gains surge when no character was damaged (none has a Tentacle attachment)", () => {
    const made = table({ phase: "Quest", deck: ["901507", "f3", "f3"], threat: [20, 20] });
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, "901507", steps);
    const settled = finish({ state: revealed.state, steps }, made.ctx);
    // Surge reveals the next card too: the stand-in enemy came into the staging area.
    expect(enemiesIn(settled.state, "staging")).toContain("f3");
  });

  it("901507:A:1 gains no surge when a character was damaged", () => {
    const made = table({ phase: "Quest", deck: ["901507", "f3", "f3"], attached: [{ code: "040076", to: "dh1" }] });
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, "901507", steps);
    const settled = finish({ state: revealed.state, steps }, made.ctx);
    expect(enemiesIn(settled.state, "staging")).not.toContain("f3");
  });

  it("901507:A:2 discards the defending character that has a Tentacle attachment", () => {
    const { run, made } = shadowAttack("901507", { attached: [{ code: "901503", to: "dh1" }] });
    expect(run.state.cards[made.hero]?.zone).toBe("discard");
  });

  it("901507:A:2 leaves a defending character without a Tentacle attachment", () => {
    const { run, made } = shadowAttack("901507", {});
    expect(run.state.cards[made.hero]?.zone).toBe("heroes");
  });
});

/** An enemy attacks the first hero, who defends, with `shadow` dealt to it. */
function shadowAttack(shadow: string, layout: Layout) {
  const fought = fightEnemy(table, shadow, "f3", layout);
  return { run: fought.run, made: fought.made };
}

describe("901506:A:1 and A:2 Hideous Depths", () => {
  it("901506:A:1 a look at the encounter deck is announced to the cards in play", () => {
    const made = table({ staging: ["901506"], deck: ["f0", "f3", "f0"] });
    const steps: EngineStep[] = [];
    const looked = lookAtTop(made.state, { verb: "LookAtTop", count: 2 }, 0, made.ctx, null, steps);
    expect(looked.pendingEvents?.some((event) => event.trigger === "lookedAtEncounterDeck")).toBe(true);
    // No card in the game hears it: nothing is announced.
    const quiet = table({ staging: ["04066"], deck: ["f0", "f3", "f0"] });
    expect(lookAtTop(quiet.state, { verb: "LookAtTop", count: 2 }, 0, quiet.ctx, null, steps).pendingEvents?.length ?? 0).toBe(0);
  });

  it("901506:A:2 the cost reveals the topmost Tentacle enemy of the discard pile, and cannot be paid with none", () => {
    const none = table({ phase: "Travel", staging: ["901506"], discard: ["f0", "04066"] });
    expect(travelCostUnpayable(none.state, none.ctx, idOf(none.state, "901506"))).toBe(true);
    const some = table({ phase: "Travel", staging: ["901506"], discard: ["04073", "f0", "04074"] });
    const depths = idOf(some.state, "901506");
    expect(travelCostUnpayable(some.state, some.ctx, depths)).toBe(false);
    const done = resolveRecords(some.state, some.ctx, "901506", "travel", depths);
    // The topmost (the last put there) is the Thrashing Tentacle.
    expect(enemiesIn(done.state, "staging")).toContain("04074");
    expect(enemiesIn(done.state, "encounterDiscard")).toContain("04073");
  });
});

describe("901508:A:2 Rippling From Beneath", () => {
  it("901508:A:2 shuffles X Tentacle enemies of the discard pile into the deck and heals The Watcher X damage", () => {
    const made = table({ seats: 2, staging: ["901508", { code: "04072", damage: 5 }], discard: ["04073", "04074", "04075", "f0"], deck: ["f3"], threat: [20, 20] });
    const done = resolveRecords(made.state, made.ctx, "901508", "whenRevealed", idOf(made.state, "901508"));
    const inDeck = done.state.encounterDeck.map((id) => done.state.cards[id]?.code);
    expect(inDeck.filter((code) => ["04073", "04074", "04075"].includes(code ?? ""))).toHaveLength(2);
    expect(enemiesIn(done.state, "encounterDiscard")).toContain("f0");
    expect(done.state.cards[idOf(done.state, "04072")]?.damage).toBe(3);
  });

  it("901508:A:2 shuffles all of them when there are fewer, and heals nothing with The Watcher out of play", () => {
    const made = table({ seats: 2, staging: ["901508"], discard: ["04073"], deck: ["f3"] });
    const done = resolveRecords(made.state, made.ctx, "901508", "whenRevealed", idOf(made.state, "901508"));
    expect(done.state.encounterDeck.map((id) => done.state.cards[id]?.code)).toContain("04073");
  });
});
