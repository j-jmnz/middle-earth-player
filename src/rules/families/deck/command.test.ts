// Rules: dcce.scalable-upgradable, dcce.campaign-setup-the-drowned-ruins, rr.campaign-pool, rr.the-word-choose, rr.search, rr.play-and-put-into-play, rr.in-play-and-out-of-play (data/rules/entries.json).
// The four Command events the campaign card of The Drowned Ruins lets each player take into hand (11201 to 11204, A:1 to A:5): "Action: Add Command to the victory display to choose up to X options, where X is its
// level". The Choose `upTo` that takes the options one at a time (families/deck/choose.ts), the options' Each and nested Choose, the filters `hasAttachment.names` and `maxCost` as an amount, the encounter deck's
// looked cards, and Reattach of a picked attachment, on the Drowned Ruins table (test/scenarios/the-drowned-ruins/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { CODES, HERO, loadRuinsWorld, ruinsTable, type RuinsLayout, type RuinsWorld, finish, idOf, idsOf, send, start } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { syncConstants } from "../../interpret/constants.ts";

const SPYGLASS = "11180";
const BLESSING = CODES.cirdanSBlessing;
let world: RuinsWorld;

beforeAll(async () => {
  world = await loadRuinsWorld();
  for (const [code, card] of await loadPrinted([SPYGLASS])) world.cards.set(code, card);
});

type Sphere = "leadership" | "tactics" | "spirit" | "lore";
const SPHERE_OF: Readonly<Record<string, Sphere>> = { [CODES.command]: "leadership", [CODES.command11202]: "lore", [CODES.command11203]: "spirit", [CODES.command11204]: "tactics" };

// A table whose first hero pays for the Command in hand: its sphere is the card's. `level` is the card's boxes in the Campaign Log; `chosen` the copies the Setup chose.
function table(code: string, level: number, layout: RuinsLayout = {}, chosen: readonly string[] = []) {
  const hero = world.cards.get(HERO)!;
  const made = ruinsTable({ ...world, cards: new Map(world.cards).set(HERO, { ...hero, sphere: SPHERE_OF[code] ?? "tactics" }) }, { phase: "Combat", hand: [code], ...layout });
  let state: ScenarioState = { ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [code]: level } } };
  if (chosen.length > 0) state = { ...state, chosenAtSetup: chosen.map((chosenCode) => ({ code: chosenCode, seat: 0 })) };
  state = updateCard(state, made.hero, { resources: 3 });
  return { ...made, state: syncConstants(state, made.ctx), card: idOf(state, code) };
}

// A Cirdan's Blessing a player controls, attached to a character.
function blessed(state: ScenarioState, host: string): { state: ScenarioState; id: string } {
  const spawned = spawn(state, BLESSING, { zone: "play", seat: 0 });
  return { state: attachTo(spawned.state, spawned.id, host), id: spawned.id };
}

const play = (made: ReturnType<typeof table>) => send(start(made.state), { type: "PlayCard", cardId: made.card, payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
const options = (state: ScenarioState): string[] => (state.window?.kind === "choose" ? [...state.window.options] : []);
// Answers each window with the next entry of the script: an option id, a card id, or a function of the state.
function script(...answers: readonly (string | ((state: ScenarioState) => string))[]) {
  let at = 0;
  return (state: ScenarioState): string => {
    // A question with one card to choose from is answered by the engine: an answer the window does not offer was for such a question and is skipped.
    let chosen = "done";
    while (at < answers.length) {
      const next = answers[at];
      at += 1;
      const candidate = typeof next === "function" ? next(state) : (next ?? "done");
      if (options(state).includes(candidate)) {
        chosen = candidate;
        break;
      }
    }
    return options(state).includes(chosen) ? chosen : (options(state)[0] ?? "");
  };
}
const stat = (state: ScenarioState, id: string, which: "attack" | "defense" | "willpower") => modifiedStat(state, state.cards[id]!, which, world.cards);

describe("Command: choose up to X options (A:1)", () => {
  it("offers each option once, with done, until X options are taken or the player stops", () => {
    const made = table(CODES.command, 2, { staging: [CODES.seaScorpion] });
    const asked = play(made);
    expect(options(asked.state)).toEqual(["defense", "enemyDefense", "done"]);
    // A hero gets +2 Defense: the hero is picked, then the choice is asked again without the option taken.
    const first = send(asked, { type: "Choose", optionId: "defense" }, made.ctx);
    const picked = send(first, { type: "Choose", optionId: made.hero }, made.ctx);
    expect(options(picked.state)).toEqual(["enemyDefense", "done"]);
    expect(stat(picked.state, made.hero, "defense")).toBe(4);
    const done = send(picked, { type: "Choose", optionId: "done" }, made.ctx);
    expect(done.state.cards[made.card]?.zone).toBe("victory");
  });

  it("asks no more once X options are taken", () => {
    const made = table(CODES.command, 1, { staging: [CODES.seaScorpion] });
    const run = finish(play(made), made.ctx, script("defense", made.hero));
    expect(run.state.cards[made.card]?.zone).toBe("victory");
    expect(stat(run.state, made.hero, "defense")).toBe(4);
    expect(run.state.window?.kind).not.toBe("choose");
  });

  it("goes to the victory display with no option when X is 0, and counts the copies of its own name the Setup chose, not a Cirdan's Blessing (11200:A:3)", () => {
    const zero = table(CODES.command, 0);
    const none = play(zero);
    expect(none.state.window?.kind).not.toBe("choose");
    expect(none.state.cards[zero.card]?.zone).toBe("victory");
    // The Setup chose a Blessing (earned at the Resolution): it is not a copy of Command, so X stays 0.
    const blessed = table(CODES.command, 0, {}, [BLESSING]);
    expect(play(blessed).state.window?.kind).not.toBe("choose");
    // The Setup chose this Command: X is plus 1.
    const chosen = table(CODES.command, 0, {}, [CODES.command, BLESSING]);
    expect(options(play(chosen).state)).toEqual(["defense", "done"]);
    const two = table(CODES.command, 1, { staging: [CODES.seaScorpion] }, [CODES.command, CODES.command11204]);
    const first = send(send(play(two), { type: "Choose", optionId: "defense" }, two.ctx), { type: "Choose", optionId: two.hero }, two.ctx);
    // X = 1 + 2 copies of Command: the player is asked again.
    expect(options(first.state)).toContain("done");
  });
});

describe("Command (Leadership) 11201 (A:2 to A:5)", () => {
  it("gives an enemy -2 Defense until the end of the round (A:3)", () => {
    const made = table(CODES.command, 1, { staging: [CODES.seaScorpion] });
    const enemy = idOf(made.state, CODES.seaScorpion);
    const before = stat(made.state, enemy, "defense");
    const run = finish(play(made), made.ctx, script("enemyDefense", enemy));
    expect(stat(run.state, enemy, "defense")).toBe(Math.max(0, before - 2));
  });

  it("readies a character with Cirdan's Blessing on it, and only such a character (A:4)", () => {
    const made = table(CODES.command, 1);
    expect(options(play(made).state)).not.toContain("ready");
    const blessing = blessed(made.state, made.hero2);
    let state = blessing.state;
    state = syncConstants(updateCard(updateCard(state, made.hero2, { exhausted: true }), made.hero, { exhausted: true }), made.ctx);
    const asked = play({ ...made, state });
    expect(options(asked.state)).toContain("ready");
    const run = finish(asked, made.ctx, script("ready"));
    expect(run.state.cards[made.hero2]?.exhausted).toBe(false);
    expect(run.state.cards[made.hero]?.exhausted).toBe(true);
  });

  it("puts an ally with cost X or less from the discard pile into play and discards it at the end of the phase (A:5)", () => {
    const made = table(CODES.command, 1);
    let state = spawn(made.state, "ally", { zone: "discard", seat: 0 }).state;
    state = spawn(state, "c3", { zone: "discard", seat: 0 }).state;
    const asked = play({ ...made, state: syncConstants(state, made.ctx) });
    expect(options(asked.state)).toContain("ally");
    const run = finish(asked, made.ctx, script("ally", (current) => (current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "")));
    const ally = idOf(run.state, "ally");
    expect(run.state.cards[ally]?.zone).toBe("play");
    // It is discarded at the end of the phase.
    expect(run.state.delayed.some((entry) => JSON.stringify(entry).includes(ally))).toBe(true);
    // The cost X is the level: an ally of cost 1 qualifies at level 1, and a costlier card is not offered.
    expect(run.state.cards[idOf(run.state, "c3")]?.zone).toBe("discard");
  });

  it("does not put an ally dearer than X into play: X is the copies the Setup chose when the card has no level (A:5)", () => {
    const made = table(CODES.command, 0, {}, [CODES.command]);
    const state = spawn(spawn(made.state, "c3", { zone: "discard", seat: 0 }).state, "ally", { zone: "discard", seat: 0 }).state;
    const run = finish(play({ ...made, state: syncConstants(state, made.ctx) }), made.ctx, script("ally"));
    expect(run.state.cards[idOf(run.state, "ally")]?.zone).toBe("play");
    expect(run.state.cards[idOf(run.state, "c3")]?.zone).toBe("discard");
  });
});

describe("Command (Lore) 11202 (A:2 to A:5)", () => {
  it("removes X resources from a non-unique enemy (A:2)", () => {
    const made = table(CODES.command11202, 2, { staging: [{ code: CODES.seaScorpion, resources: 5 }] });
    const enemy = idOf(made.state, CODES.seaScorpion);
    const run = finish(play(made), made.ctx, script("resources", enemy));
    expect(run.state.cards[enemy]?.resources).toBe(3);
  });

  it("adds 2 resources to each Cirdan's Blessing (A:3)", () => {
    const made = table(CODES.command11202, 1);
    let state = made.state;
    for (const host of [made.hero, made.hero2]) state = blessed(state, host).state;
    const run = finish(play({ ...made, state: syncConstants(state, made.ctx) }), made.ctx, script("blessings"));
    expect(idsOf(run.state, BLESSING).map((id) => run.state.cards[id]?.resources)).toEqual([2, 2]);
  });

  it("adds the bottom card of the deck to the hand (A:4)", () => {
    const made = table(CODES.command11202, 1, { deckOf: ["f0", "f3"] });
    const bottom = (made.state.seats[0]?.deck ?? []).at(-1)!;
    const run = finish(play(made), made.ctx, script("bottom"));
    expect(run.state.seats[0]?.hand).toContain(bottom);
    expect(run.state.seats[0]?.deck).not.toContain(bottom);
  });

  it("looks at the top 10 cards of the encounter deck, discards any number of them and shuffles it (A:5)", () => {
    const made = table(CODES.command11202, 1, { deck: ["f0", "f3", "treachery", "place"] });
    const asked = play(made);
    const looked = send(asked, { type: "Choose", optionId: "encounter" }, made.ctx);
    expect(looked.state.window?.kind).toBe("look");
    const choosing = send(looked, { type: "Pass" }, made.ctx);
    // Cards of every title are offered once, with done.
    expect(options(choosing.state).filter((id) => id !== "done").length).toBe(4);
    const discarded = options(choosing.state)[0]!;
    const one = send(choosing, { type: "Choose", optionId: discarded }, made.ctx);
    const run = finish(one, made.ctx, script("done"));
    expect(run.state.cards[discarded]?.zone).toBe("encounterDiscard");
    expect(run.state.encounterDeck.length).toBe(3);
    expect(run.state.seed === made.state.seed && run.state.seedCursor === made.state.seedCursor).toBe(false);
  });
});

describe("Command (Spirit) 11203 (A:2 to A:5)", () => {
  it("gives a hero +2 Willpower until the end of the round (A:2)", () => {
    const made = table(CODES.command11203, 1);
    const run = finish(play(made), made.ctx, script("willpower", made.hero2));
    expect(stat(run.state, made.hero2, "willpower")).toBe(stat(made.state, made.hero2, "willpower") + 2);
  });

  it("lets each character with Cirdan's Blessing on it quest without exhausting this round (A:3)", () => {
    const made = table(CODES.command11203, 1);
    const state = syncConstants(blessed(made.state, made.hero2).state, made.ctx);
    const run = finish(play({ ...made, state }), made.ctx, script("noExhaust"));
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noExhaustQuest" && modifier.instanceId === made.hero2)).toBe(true);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noExhaustQuest" && modifier.instanceId === made.hero)).toBe(false);
  });

  it("places 2 progress on a non-unique location (A:4)", () => {
    const made = table(CODES.command11203, 1, { staging: ["place"] });
    const place = idOf(made.state, "place");
    const run = finish(play(made), made.ctx, script("progress", place));
    expect(run.state.cards[place]?.progress).toBe(2);
  });

  it("puts Spyglass into play attached to a hero from the hand, the deck or the discard pile (A:5)", () => {
    for (const from of ["hand", "deck", "discard"] as const) {
      const made = table(CODES.command11203, 1);
      const state = spawn(made.state, SPYGLASS, { zone: from, seat: 0 }, from === "deck" ? "down" : "up").state;
      const asked = play({ ...made, state: syncConstants(state, made.ctx) });
      const run = finish(asked, made.ctx, script("spyglass", `spyglass${from.charAt(0).toUpperCase()}${from.slice(1)}`, made.hero2));
      const glass = idOf(run.state, SPYGLASS);
      expect(run.state.cards[glass], `${from} ${JSON.stringify(run.state.window)}`).toMatchObject({ zone: "play", host: made.hero2 });
    }
  });

  it("offers Spyglass only when a copy is out of play", () => {
    const made = table(CODES.command11203, 1);
    expect(options(play(made).state)).not.toContain("spyglass");
  });
});

describe("Command (Tactics) 11204 (A:2 to A:5)", () => {
  it("gives a hero +2 Attack and an enemy -2 Attack until the end of the round (A:2, A:3)", () => {
    const made = table(CODES.command11204, 2, { staging: [CODES.seaScorpion] });
    const enemy = idOf(made.state, CODES.seaScorpion);
    const before = stat(made.state, enemy, "attack");
    const run = finish(play(made), made.ctx, script("attack", made.hero, "enemyAttack", enemy));
    expect(stat(run.state, made.hero, "attack")).toBe(stat(made.state, made.hero, "attack") + 2);
    expect(stat(run.state, enemy, "attack")).toBe(Math.max(0, before - 2));
  });

  it("deals 2 damage to an enemy, which the player may then engage (A:4)", () => {
    const engaged = table(CODES.command11204, 1, { staging: [CODES.seaScorpion] });
    const enemy = idOf(engaged.state, CODES.seaScorpion);
    const run = finish(play(engaged), engaged.ctx, script("damage", enemy, "engageIt"));
    expect(run.state.cards[enemy]).toMatchObject({ damage: 2, zone: "engaged" });
    const left = finish(play(engaged), engaged.ctx, script("damage", enemy, "noEngage"));
    expect(left.state.cards[enemy]).toMatchObject({ damage: 2, zone: "staging" });
  });

  it("readies an attachment, which the player may then move to an eligible character (A:5)", () => {
    const made = table(CODES.command11204, 1);
    const blessing = blessed(made.state, made.hero);
    const state = syncConstants(updateCard(blessing.state, blessing.id, { exhausted: true }), made.ctx);
    const run = finish(play({ ...made, state }), made.ctx, script("attachment", blessing.id, "moveIt", made.hero2));
    expect(run.state.cards[blessing.id]).toMatchObject({ exhausted: false, host: made.hero2 });
    const stays = finish(play({ ...made, state }), made.ctx, script("attachment", blessing.id, "stayPut"));
    expect(stays.state.cards[blessing.id]).toMatchObject({ exhausted: false, host: made.hero });
  });
});
