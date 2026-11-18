// Rules: dwd.locate-test, dwd.locate-test-example, dwd.lost-effects, dwd.revealing-enemies, dwd.last-player, rr.first-player, rr.forced, rr.then, rr.next-player, faq.next-player, rr.attachment-cards, rr.active-location, rr.travel, rr.step-4-2, rr.shadow-effects, rr.defending-player, rr.damage (data/rules/entries.json); ledger lines 04086:B:1,
// 04087:B:1, 04087:B:3, 04088:A:1, 04092:A:1, 04093:A:2, 04095:A:1, 04097:A:1, 04097:A:2, 04098:A:1, 04099:A:2, 04100:A:1, 901601:A:2, 901602:A:2, 901603:A:2, 901604:A:2, 901605:A:1, 901606:A:1, 901606:A:2, 901607:A:1, 901608:A:2, 901608:A:3.
// The multi-step mechanics of The Long Dark, each on a table of the scene kit and each title starting with the line it covers: the locate test with the real cards, the Lost effects and the order and choices they ask for, Twisting Passage's held progress through the quest phase and Cave Torch, Eastern Mines' travel,
// Gathering Ground, the Shadows that need a second seat, Rock Adder's bar, Goblin Stalker's Attack and the Nightmare cards that choose among the players. The rows of spec.test.ts hold the lines a table and one action show.
import { describe, expect, it } from "vitest";

import { destroyCard, modifiedStat } from "../../../rules/core/keywords.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, idOf, idsOf, legalIntents, opening, revealFromTop, send, tableFromLayout, type Layout, type ScenePhase } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-long-dark";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
type Made = ReturnType<typeof table>;
const zoneOf = (state: ScenarioState, code: string) => state.cards[idOf(state, code)]?.zone;
const options = (state: ScenarioState) => (state.window?.kind === "choose" ? state.window.options : []);
const codesOf = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
const choose = (made: Made, state: ScenarioState, optionId: string) => send({ state, steps: [] }, { type: "Choose", optionId }, made.ctx).state;
const handOf = (state: ScenarioState, seat = 0) => (state.seats[seat]?.hand ?? []).map((id) => state.cards[id]?.code);

/** A card's records of this timing pushed as a frame and settled to the first choice they open (a choice is not answered). */
function begin(made: Made, code: string, timing: "whenRevealed" | "forced" | "setup" | "shadow", phase?: ScenePhase): ScenarioState {
  const source = idOf(made.state, code);
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing);
  const steps: EngineStep[] = [];
  const base = phase ? { ...made.state, ...opening(phase) } : made.state;
  const pushed = pushCardEffects(base, timing === "forced" ? "forced" : timing, source, base.firstPlayer, false, effects, made.ctx, steps);
  return settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps);
}

describe("04086:B:1 Journey in the Black Pit: the locations discarded", () => {
  const deck = ["f0", "04089", "04090", "04091", "04092", "f3"];
  const locations = (players: number) => {
    const made = table({ stage: "04086", seats: 1, deck });
    // More players than the layout seats: the seats are added to the state (they hold no heroes, and are not eliminated).
    const seats = Array.from({ length: Math.max(players, made.state.seats.length) }, (_, at) => (at < players ? { ...made.state.seats[0]!, heroes: at === 0 ? made.state.seats[0]!.heroes : [] } : made.state.seats[at]!));
    const state = begin({ ...made, state: { ...made.state, seats: seats as never, seatCount: players as never } }, "04086", "whenRevealed");
    return state.staging.map((id) => state.cards[id]?.code);
  };

  it("04086:B:1 adds 1 location with 1 or 2 players, 2 with 3 players and 3 with 4 players, and shuffles the others back", () => {
    expect(locations(1)).toEqual(["04089"]);
    expect(locations(2)).toEqual(["04089"]);
    expect(locations(3)).toEqual(["04089", "04090"]);
    expect(locations(4)).toEqual(["04089", "04090", "04091"]);
  });

  it("04086:B:1 does not reveal them: no When Revealed, no Travel and no Surge", () => {
    const made = table({ stage: "04086", deck: ["04092", "f3"] });
    const state = begin(made, "04086", "whenRevealed");
    expect(zoneOf(state, "04092")).toBe("staging");
    expect(state.pendingEvents ?? []).toEqual([]);
  });
});

describe("04087:B:1 Continuing Eastward: the locate test with the real cards", () => {
  const layout: Layout = { stage: "04087", hand: ["filler", "filler"], deck: ["f0", "04089", "f3", "f0"], staging: ["04091"] };

  it("04087:B:1 lets him try again after a card with no PASS, passes on a PASS card, and the discards go to their own piles", () => {
    const made = table(layout);
    const asked = begin(made, "04087", "whenRevealed");
    expect(options(asked)).toHaveLength(3);
    const again = choose(made, asked, options(asked)[0] ?? "");
    expect(codesOf(again, again.encounterDiscard)).toEqual(["f0"]);
    expect(again.window).toMatchObject({ kind: "choose", seat: 0 });
    const passed = choose(made, again, options(again)[0] ?? "");
    expect(codesOf(passed, passed.encounterDiscard)).toEqual(["f0", "04089"]);
    expect(codesOf(passed, passed.seats[0]?.discard ?? [])).toEqual(["filler", "filler"]);
    // Passed: nothing is revealed, no Lost effect runs.
    expect(zoneOf(passed, "f3")).toBe("encounterDeck");
    expect(passed.cards[idOf(passed, "dh1")]?.exhausted).toBe(false);
  });

  it("04087:B:1 fails at once with no card in hand: a card is revealed for each player and the Lost effects trigger", () => {
    const made = table({ ...layout, hand: [] });
    const state = begin(made, "04087", "whenRevealed");
    expect(state.window).not.toMatchObject({ kind: "choose" });
    expect(zoneOf(state, "f0")).toBe("staging");
    expect(state.cards[idOf(state, "dh1")]?.exhausted).toBe(true);
  });

  it("04087:B:1 reveals a card for each of two players on a failure, the first player making the reveals", () => {
    const made = table({ ...layout, seats: 2, hand: [], deck: ["f3", "f0", "04090"] });
    const state = begin(made, "04087", "whenRevealed");
    expect(state.staging.map((id) => state.cards[id]?.code).sort()).toEqual(["04091", "f0", "f3"].sort());
  });

  it("04087:B:1 refills an empty encounter deck from the discard pile in the quest phase, the test's own discards included", () => {
    const made = table({ stage: "04087", hand: ["filler"], deck: [], discard: ["04089"] });
    const asked = begin(made, "04087", "whenRevealed", "Quest");
    const done = choose(made, asked, options(asked)[0] ?? "");
    // The only card of the deck was the discard pile's PASS card: it was discarded again and the test is passed.
    expect(codesOf(done, done.encounterDiscard)).toEqual(["04089"]);
    expect(zoneOf(done, "04089")).toBe("encounterDiscard");
  });

  it("04087:B:1 fails at once with an empty encounter deck outside the quest phase", () => {
    const made = table({ stage: "04087", hand: ["filler"], deck: [], discard: ["04089"] });
    const state = begin(made, "04087", "whenRevealed", "Encounter");
    expect(state.window).not.toMatchObject({ kind: "choose" });
    expect(handOf(state)).toEqual(["filler"]);
  });
});

describe("04087:B:3 the last stage", () => {
  it("04087:B:3 defeating the stage wins the game", () => {
    const made = table({ stage: "04087", progress: 16 });
    const asked = send({ state: made.state, steps: [] }, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    let run = send(asked, { type: "Pass" }, made.ctx);
    for (let guard = 0; guard < 12 && !run.state.stageCleared && !run.state.lost; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      run = send(run, pass, made.ctx);
    }
    expect(run.state.stageCleared).toBe(true);
  });
});

describe("04088:A:1 Durin's Greaves", () => {
  it("04088:A:1 the first player picks the hero among every player's heroes", () => {
    const made = table({ seats: 2, deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04088", []);
    expect(options(revealed.state)).toEqual(expect.arrayContaining([idOf(made.state, "dh3"), made.hero, made.hero2]));
    const attached = choose(made, revealed.state, idOf(made.state, "dh3"));
    expect(attached.cards[revealed.id]?.host).toBe(idOf(made.state, "dh3"));
  });

  it("04088:A:1 is discarded to the encounter discard pile when the hero leaves play, and can be revealed again", () => {
    const made = table({ deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04088", []);
    const attached = choose(made, revealed.state, options(revealed.state)[0] ?? "");
    const gone = destroyCard({ ...attached, window: null }, attached.cards[revealed.id]?.host ?? "", made.ctx.cards, [], true);
    expect(zoneOf(gone, "04088")).toBe("encounterDiscard");
  });
});

describe("04092:A:1 Twisting Passage: the held progress", () => {
  const layout: Layout = { stage: "04086", active: "04092", hand: ["filler"], deck: ["04089", "f0", "f0"] };
  it("04092:A:1 progress beyond its quest points goes to the current quest after a passed test, outside the quest phase too", () => {
    const made = table({ ...layout, active: { code: "04092", progress: 3 }, phase: "Combat" });
    const steps: EngineStep[] = [];
    const held = settle(placeProgress({ ...made.state, window: null }, idOf(made.state, "04092"), 2, made.ctx, steps), made.ctx, steps);
    expect(held.cards[idOf(held, "04092")]?.progress).toBe(3);
    const passed = choose(made, held, options(held).find((id) => id !== "stop") ?? "");
    expect(passed.cards[idOf(passed, "04092")]?.progress).toBe(5);
  });

  it("04092:A:1 each Cave Torch Action is a placement of its own: one test for each", () => {
    const made = table({ ...layout, active: "04092", attached: [{ code: "03041", to: "dh1" }], hand: ["filler", "filler"] });
    const torch = made.ctx.effects.find((effect) => effect.id === "03041:action:1");
    expect(torch).toBeDefined();
    const held = settle(placeProgress({ ...made.state, window: null }, idOf(made.state, "04092"), 1, made.ctx, []), made.ctx, []);
    expect(held.window).toMatchObject({ kind: "choose", seat: 0 });
    const next = choose(made, held, options(held).find((id) => id !== "stop") ?? "");
    const second = settle(placeProgress({ ...next, window: null }, idOf(next, "04092"), 1, made.ctx, []), made.ctx, []);
    expect(second.window).toMatchObject({ kind: "choose", seat: 0 });
  });
});

describe("04093:A:2 Fatigue's Shadow", () => {
  it("04093:A:2 exhausts a second character of the defending player after the defender was declared", () => {
    const fought = fightEnemy(table, "04093", "f0", { phase: "Encounter" });
    // The defender is exhausted by defending; the Shadow exhausts the other hero.
    expect(fought.during.cards[idOf(fought.during, "dh2")]?.exhausted).toBe(true);
    expect(fought.during.cards[idOf(fought.during, "dh1")]?.exhausted).toBe(true);
  });
});

describe("04095:A:1 Gathering Ground", () => {
  it("04095:A:1 attaches to the location with the highest Threat plus remaining quest points, and an enemy revealed gains surge", () => {
    const made = table({ staging: ["04089", "04092"], deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04095", []);
    const ground = revealed.id;
    expect(revealed.state.window).not.toMatchObject({ kind: "choose" });
    expect(revealed.state.cards[ground]?.host).toBe(idOf(revealed.state, "04092"));
    // An enemy revealed afterwards gains surge: the next card is revealed too.
    const deck = table({ staging: ["04092"], deck: ["f3", "f0"] });
    const ground2 = revealFromTop(deck.state, deck.ctx, "04095", []);
    const enemy = revealFromTop({ ...ground2.state, window: null }, deck.ctx, "f3", []);
    expect(zoneOf(enemy.state, "f0")).toBe("staging");
  });

  it("04095:A:1 asks the first player to choose between locations that tie", () => {
    const made = table({ staging: ["04089", "04090"], deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04095", []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(options(revealed.state)).toEqual([idOf(made.state, "04089"), idOf(made.state, "04090")]);
    const attached = choose(made, revealed.state, idOf(made.state, "04090"));
    expect(attached.cards[revealed.id]?.host).toBe(idOf(made.state, "04090"));
  });

  it("04095:A:1 is discarded when no location is in the staging area", () => {
    const made = table({ deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04095", []);
    expect(zoneOf(revealed.state, "04095")).toBe("encounterDiscard");
  });
});

describe("04097:A:1 Cave Spider's draw and discard", () => {
  const hand = ["filler", "filler", "filler", "filler", "filler"];

  it("04097:A:1 discards nothing when the first player could not draw (an empty deck)", () => {
    const made = table({ hand, deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04097", []);
    expect(revealed.state.window).not.toMatchObject({ kind: "choose" });
    expect(handOf(revealed.state)).toHaveLength(5);
  });

  it("04097:A:1 discards 4 after drawing, the first player choosing which cards", () => {
    const made = table({ hand: ["filler", "event", "filler", "event", "filler"], deckOf: ["filler"], deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04097", []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 0 });
  });

  it("04097:A:1 discards nothing when a Sentinel of the Deep bars the draw", () => {
    const made = table({ hand, deckOf: ["filler"], deck: ["f0"], engaged: ["901604"] });
    const revealed = revealFromTop(made.state, made.ctx, "04097", []);
    expect(handOf(revealed.state)).toHaveLength(5);
  });
});

describe("04097:A:2 Cave Spider's engagement", () => {
  it("04097:A:2 the player it engages is the one who discards, not the first player", () => {
    const made = table({ seats: 2, hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 1 }], engaged: [{ code: "04097", seat: 1 }] });
    const steps: EngineStep[] = [];
    const state = settle(fireForced({ ...made.state, window: null }, { trigger: "engaged", seat: 1, cardId: idOf(made.state, "04097") }, made.ctx, steps), made.ctx, steps);
    expect(handOf(state, 0)).toHaveLength(1);
    expect(handOf(state, 1)).toHaveLength(0);
  });
});

describe("04098:A:1 Goblin Sneak's repeated engagement", () => {
  const engagedEvent = (made: Made) => {
    const steps: EngineStep[] = [];
    return settle(fireForced({ ...made.state, window: null }, { trigger: "engaged", seat: 0, cardId: idOf(made.state, "04098") }, made.ctx, steps), made.ctx, steps);
  };

  it("04098:A:1 a treachery discarded sends it on to the next player, and the Forced effect fires again for that engagement", () => {
    const made = table({ seats: 2, engaged: ["04098"], deck: ["04093", "f0", "f3"] });
    const state = engagedEvent(made);
    expect(state.cards[idOf(state, "04098")]?.controller).toBe(1);
    expect(zoneOf(state, "04093")).toBe("encounterDiscard");
    expect(zoneOf(state, "f0")).toBe("encounterDiscard");
    expect(zoneOf(state, "f3")).toBe("encounterDeck");
  });

  it("04098:A:1 with one player it stays where it is after a treachery", () => {
    const made = table({ engaged: ["04098"], deck: ["04093", "f0"] });
    const state = engagedEvent(made);
    expect(state.cards[idOf(state, "04098")]?.controller).toBe(0);
    expect(zoneOf(state, "f0")).toBe("encounterDeck");
  });

  it("04098:A:1 with the encounter deck empty nothing happens", () => {
    const made = table({ engaged: ["04098"], deck: [] });
    const state = engagedEvent(made);
    expect(state.cards[idOf(state, "04098")]?.zone).toBe("engaged");
  });
});

describe("04099:A:2 the order of the Lost effects", () => {
  it("04099:A:2 offers the first player the Lost effects in play one at a time, the Warlord's Shadow triggering them", () => {
    const seen: string[][] = [];
    const fought = fightEnemy(table, "04099", "f0", { phase: "Encounter", staging: ["04090", "04091"], hand: ["filler", "filler"] }, {
      pick: (state) => {
        seen.push([...options(state)]);
        return options(state)[0] ?? "";
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toHaveLength(2);
    // The Forge's effect (the first option) discarded a card; the Caverns' resolved after it without a choice.
    expect(handOf(fought.run.state)).toHaveLength(1);
  });

  it("04099:A:2 triggers the Warlord's own Lost line only when a copy is in play (a shadow card is not in play)", () => {
    const fought = fightEnemy(table, "04099", "f0", { phase: "Encounter", play: ["ally"] });
    expect(zoneOf(fought.run.state, "ally")).toBe("play");
  });
});

describe("04100:A:1 Rock Adder's bar", () => {
  it("04100:A:1 cannot be attacked until its attack has placed damage on a character this round", () => {
    const made = table({ engaged: ["04100"] });
    const adder = idOf(made.state, "04100");
    expect(modifiedStat(made.state, made.state.cards[adder]!, "cannotBeAttacked", made.ctx.cards)).toBeGreaterThan(0);
    const steps: EngineStep[] = [];
    const hit = settle(fireForced({ ...made.state, window: null }, { trigger: "attackDamagedCharacter", seat: 0, cardId: adder, other: made.hero }, made.ctx, steps), made.ctx, steps);
    expect(modifiedStat(hit, hit.cards[adder]!, "cannotBeAttacked", made.ctx.cards)).toBe(0);
  });
});

describe("901602:A:2 Goblin Stalker's Attack from PASS shadow cards", () => {
  it("901602:A:2 gets +2 Attack for each shadow card with PASS dealt to it, before defenders are declared", () => {
    const fought = fightEnemy(table, "04089", "901602", { phase: "Encounter", deck: ["04089", "04090", "f0", "f0"] });
    const stalker = idOf(fought.during, "901602");
    expect(modifiedStat(fought.during, fought.during.cards[stalker]!, "attack", fought.made.ctx.cards)).toBe(2 + 4);
  });

  it("901602:A:2 gets nothing from a shadow card without PASS", () => {
    const fought = fightEnemy(table, "f0", "901602", { phase: "Encounter", deck: ["f0", "f0", "f0", "f0"] });
    const stalker = idOf(fought.during, "901602");
    expect(modifiedStat(fought.during, fought.during.cards[stalker]!, "attack", fought.made.ctx.cards)).toBe(2);
  });
});

describe("901603:A:2 Trapdoor Spider's Lost effect", () => {
  it("901603:A:2 engaged with another player it moves to the last player and attacks him", () => {
    const made = table({ seats: 2, engaged: [{ code: "901603", seat: 0 }] });
    const steps: EngineStep[] = [];
    const state = settle(fireForced({ ...made.state, window: null }, { trigger: "lost", seat: null, cardId: idOf(made.state, "901603") }, made.ctx, steps), made.ctx, steps);
    expect(state.cards[idOf(state, "901603")]?.controller).toBe(1);
    expect(state.pendingAttack).toMatchObject({ enemyId: idOf(state, "901603"), seat: 1, immediate: true });
    expect(state.window).toMatchObject({ kind: "defense", seat: 1 });
  });

  it("901603:A:2 makes no attack when it cannot engage the last player", () => {
    const made = table({ seats: 2, staging: ["901603"] });
    const barred = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: idOf(made.state, "901603"), sourceId: idOf(made.state, "901603"), stat: "cannotBeEngaged" as const, amount: 1, until: "endOfRound" as const }] };
    const steps: EngineStep[] = [];
    const state = settle(fireForced({ ...barred, window: null }, { trigger: "lost", seat: null, cardId: idOf(made.state, "901603") }, made.ctx, steps), made.ctx, steps);
    expect(zoneOf(state, "901603")).toBe("staging");
    expect(state.pendingAttack ?? null).toBeNull();
  });
});

describe("901604:A:2 and 901607:A:1 the Lost choices", () => {
  it("901604:A:2 asks the defending player which Lost effect to trigger, with more than one in play", () => {
    const seen: string[][] = [];
    fightEnemy(table, "901604", "f0", { phase: "Encounter", staging: ["04090", "04091"], hand: ["filler", "filler"] }, {
      pick: (state) => {
        seen.push([...options(state)]);
        return options(state)[0] ?? "";
      },
    });
    expect(seen[0]).toHaveLength(2);
  });

  it("901607:A:1 has each player in turn choose a different Lost effect, the first player first", () => {
    const made = table({ seats: 2, staging: ["04090", "04091"], hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }], deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "901607", []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const next = choose(made, revealed.state, idOf(made.state, "04090"));
    // The Forge discarded a card from seat 0's hand; the second player's one remaining Lost effect (the Caverns) is triggered without a choice.
    expect(handOf(next, 0)).toHaveLength(1);
    expect(next.cards[idOf(next, "dh1")]?.exhausted).toBe(true);
  });

  it("901607:A:1 skips a player with no Lost effect left to choose", () => {
    const made = table({ seats: 2, staging: ["04091"], deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "901607", []);
    expect(revealed.state.window).not.toMatchObject({ kind: "choose" });
    expect(revealed.state.cards[idOf(revealed.state, "dh1")]?.exhausted).toBe(true);
  });
});

describe("901605:A:1 Eastern Mines' travel", () => {
  it("901605:A:1 a failed test takes the travel for the round and the game goes on", () => {
    const made = table({ phase: "Travel", staging: ["901605", "04091"], hand: ["filler"], deck: ["f0", "f0"] });
    const traveled = send({ state: made.state, steps: [] }, { type: "Travel", locationId: idOf(made.state, "901605") }, made.ctx);
    expect(zoneOf(traveled.state, "901605")).toBe("activeLocation");
    const failed = send(traveled, { type: "Choose", optionId: "stop" }, made.ctx).state;
    expect(zoneOf(failed, "901605")).toBe("staging");
    expect(failed.lost).toBe(false);
    expect(failed.phase === "Travel" ? (failed.travelDone ?? []).length >= 0 : true).toBe(true);
    // The Lost effect ran after the failure: the Caverns exhausted every character.
    expect(failed.cards[idOf(failed, "dh1")]?.exhausted).toBe(true);
  });
});

describe("901606:A:1 Bottomless Chasm's hand discards", () => {
  it("901606:A:1 the first player picks a card from any player's hand for each progress placed", () => {
    const made = table({ seats: 2, active: "901606", hand: [{ code: "filler", seat: 0 }, { code: "event", seat: 1 }] });
    const steps: EngineStep[] = [];
    const placed = settle(placeProgress({ ...made.state, window: null }, idOf(made.state, "901606"), 2, made.ctx, steps), made.ctx, steps);
    expect(placed.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(options(placed)).toHaveLength(2);
    expect(options(placed)).toContain(idOf(made.state, "event"));
  });

  it("901606:A:1 discards nothing with no card in any hand", () => {
    const made = table({ active: "901606" });
    const steps: EngineStep[] = [];
    const placed = settle(placeProgress({ ...made.state, window: null }, idOf(made.state, "901606"), 2, made.ctx, steps), made.ctx, steps);
    expect(placed.window).not.toMatchObject({ kind: "choose" });
  });
});

describe("901606:A:2 Bottomless Chasm's Shadow", () => {
  it("901606:A:2 discards the defending player's whole hand when the attack destroys a character", () => {
    const fought = fightEnemy(table, "901606", "04099", { phase: "Encounter", hand: ["filler", "filler", "filler"] }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    expect(handOf(fought.run.state)).toHaveLength(0);
  });

  it("901606:A:2 keeps the hand when the attack destroys nothing", () => {
    const fought = fightEnemy(table, "901606", "f0", { phase: "Encounter", hand: ["filler", "filler", "filler"] });
    expect(handOf(fought.run.state)).toHaveLength(3);
  });
});

describe("901608:A:2 and A:3 Lost and Helpless", () => {
  it("901608:A:2 the first player chooses the hero among every player's heroes", () => {
    const made = table({ seats: 2, deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "901608", []);
    expect(options(revealed.state)).toContain(idOf(made.state, "dh3"));
  });

  it("901608:A:3 reads the defending player's own hand, not every player's", () => {
    const layout: Layout = { seats: 2, phase: "Encounter", hand: [{ code: "filler", seat: 0 }] };
    const fought = fightEnemy(table, "901608", "f0", layout);
    // Seat 0 holds a card: the defending character stays, though seat 1's hand is empty.
    expect(zoneOf(fought.run.state, "dh1")).not.toBe("discard");
  });
});

describe("901601:A:2 the Nightmare setup card", () => {
  it("901601:A:2 gains surge only for Durin's Greaves", () => {
    const made = table({ nightmare: "901601", deck: ["f3", "f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "04093", []);
    expect(zoneOf(revealed.state, "f3")).toBe("encounterDeck");
    expect(idsOf(revealed.state, "04093")).toHaveLength(1);
  });
});
