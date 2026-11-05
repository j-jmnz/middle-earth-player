// Rules: emce.boon-allies, emce.dragon-signs, rr.first-player, rr.travel (data/rules/entries.json); ledger lines 12175:B:1, 12176:A:4, 12180:A:1, 19019:A:3, 19020:A:2, 19022:B:1, 19024:B:1.
// The Withered Heath's choices on the live sheet: each record opens a real window (the effect frame the engine builds, not a hand-made instruction), and the sheet says the number, the side of the table and the player (Choice tray).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { CODES, heathTable, idOf, loadHeathWorld, send, type HeathWorld } from "../../../test/scenarios/the-withered-heath/scene.ts";

import { sheetFor } from "./sheets.ts";

let world: HeathWorld;
beforeAll(async () => {
  world = await loadHeathWorld();
}, 120_000);

type Table = ReturnType<typeof heathTable>;
const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState) => ({ card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: (id: string) => id });
const ACCOLADES = [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer];

// The record's frame is pushed and settled until the engine opens its window: the live state the sheet is built from.
function opened(t: Table, state: ScenarioState, code: string, timing: Effect["timing"], source: string, frame: "whenRevealed" | "forced" | "travel" = "forced", only?: string): ScenarioState {
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing && (only == null || effect.id === only)).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(state, frame, source, state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}

const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};
const labels = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => option.label);
const pass = (t: Table, state: ScenarioState): ScenarioState => send({ state, steps: [] }, { type: "Pass" }, t.ctx).state;
const take = (t: Table, state: ScenarioState, optionId: string): ScenarioState => send({ state, steps: [] }, { type: "Choose", optionId }, t.ctx).state;

describe("the Accolade boon a stage defeated offers (12175:B:1)", () => {
  const offer = (seats: 1 | 2, stage: "19023" | "19024" | "19025", boon: number) => {
    const t = heathTable(world, { seats, campaign: true, stage, setAside: ACCOLADES });
    const only = `12175:forced:${boon}`;
    return { t, state: opened(t, t.state, CODES.campaignCard, "forced", idOf(t.state, CODES.campaignCard), "forced", only) };
  };

  it("two-handed, leads with the player and states the stage, the cost of declining and where the boon goes", () => {
    const { t, state } = offer(2, "19023", 1);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Player 1: attach Master of the Hunt to one of your heroes\? It is the reward for defeating stage 1, you control no Accolade boon, and it joins your Campaign Pool on that hero if you win\./);
    expect(sheet.note).not.toContain("Player 1 chooses");
    expect(labels(sheet)).toEqual(["Attach Master of the Hunt to one of your heroes", "Decline Master of the Hunt: Player 2 is offered it next"]);
  });

  it("the decline row says the next seat that controls no Accolade boon is offered it, and 'not offered again' for the last such seat", () => {
    const { t, state } = offer(2, "19023", 1);
    expect(labels(sheetOf(t, state)).at(-1)).toBe("Decline Master of the Hunt: Player 2 is offered it next");
    // Player 2 already carries another Accolade boon: Player 1's decline is the last offer.
    const unbroken = spawn(t.state, CODES.unbroken, { zone: "play", seat: 1 });
    const held = attachTo(unbroken.state, unbroken.id, t.seat1Hero ?? "");
    const lone = opened(t, held, CODES.campaignCard, "forced", idOf(held, CODES.campaignCard), "forced", "12175:forced:1");
    expect(labels(sheetOf(t, lone)).at(-1)).toBe("Decline Master of the Hunt: it is not offered again");
    // The first player token on Player 2: the first offer is Player 2's, and Player 1 is offered it next.
    const flipped = { ...t.state, firstPlayer: 1 };
    const turned = opened(t, flipped, CODES.campaignCard, "forced", idOf(flipped, CODES.campaignCard), "forced", "12175:forced:1");
    const sheet = sheetOf(t, turned);
    expect(sheet.note).toMatch(/^Player 2: attach Master of the Hunt/);
    expect(labels(sheet).at(-1)).toBe("Decline Master of the Hunt: Player 1 is offered it next");
    // Declining as the first seat, the second seat is asked, and nobody follows it.
    const second = sheetOf(t, take(t, state, "decline"));
    expect(second.note).toMatch(/^Player 2: attach Master of the Hunt/);
    expect(labels(second).at(-1)).toBe("Decline Master of the Hunt: it is not offered again");
  });

  it("solo, has no lead; the last stage is the defeat of Cold-Drake", () => {
    const { t, state } = offer(1, "19025", 4);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Attach Dragon-slayer to one of your heroes\? It is the reward for defeating Cold-Drake, /);
    expect(sheet.note).not.toMatch(/Player 1/);
    expect(labels(sheet)).toEqual(["Attach Dragon-slayer to one of your heroes", "Decline Dragon-slayer: it is not offered again"]);
  });

  it("names the stage of each boon, and the hero it goes on is the player's own", () => {
    for (const [boon, stage, code, name] of [[2, "19023", CODES.unbroken, "Unbroken"], [3, "19024", CODES.theSteadfast, "The Steadfast"]] as const) {
      const { t, state } = offer(2, stage, boon);
      expect(sheetOf(t, state).note).toContain(`attach ${name} to one of your heroes? It is the reward for defeating stage ${boon},`);
      const hero = sheetOf(t, take(t, state, "attach"));
      expect(hero.note).toMatch(new RegExp(`^Player 1: choose one of your heroes to carry ${name}\\. It joins your Campaign Pool on that hero if you win\\.`));
      expect(hero.note).not.toContain("Player 1 chooses");
      expect(code).toBe(ACCOLADES[boon - 1]);
    }
  });
});

describe("Master of the Hunt (12176:A:4)", () => {
  const response = (seats: 1 | 2) => {
    const t = heathTable(world, { seats, play: [CODES.masterOfTheHunt], deckOf: ["filler", "filler", "event", "ally", "filler"] });
    const boon = idOf(t.state, CODES.masterOfTheHunt);
    const worn = { ...t, state: attachTo(t.state, boon, t.hero) };
    return { t: worn, state: opened(worn, worn.state, CODES.masterOfTheHunt, "response", boon, "forced", "12176:response:1") };
  };

  it("two-handed, the player is chosen, then that player keeps 1 card on top and orders the rest for the bottom", () => {
    const { t, state } = response(2);
    const pick = sheetOf(t, state);
    expect(pick.note).toMatch(/^Player 1: choose a player to look at the top 3 cards of their deck\. They put 1 of them on top of their deck and the rest on the bottom, in any order\./);
    expect(labels(pick)).toEqual(["Player 1", "Player 2"]);
    const picked = take(t, state, pick.options[0]!.id);
    // The look names the player whose deck it is, and says the cards are moved next.
    expect(picked.window?.kind).toBe("look");
    const look = sheetOf(t, picked);
    expect(look.note).toBe("Player 1: the top 3 cards of your deck. You keep 1 on top and put the rest on the bottom next.");
    expect(look.note).not.toContain("Nothing moves");
    const looking = pass(t, picked);
    const keep = sheetOf(t, looking);
    expect(labels(keep).every((label) => label.startsWith("Keep on top: "))).toBe(true);
    expect(keep.note).toMatch(/^Player 1: choose the card that stays on top of your deck\. The other 2 go to the bottom, in the order you choose next\./);
    expect(keep.note).not.toContain("Player 1 chooses");
    const next = sheetOf(t, take(t, looking, keep.options[0]!.id));
    expect(next.note).toMatch(/^Player 1: choose the next card to place under the rest of your deck, below the ones already placed \(2 left\)\./);
    expect(next.note).not.toContain("highest first");
    expect(labels(next).every((label) => label.startsWith("To bottom: "))).toBe(true);

  });

  it("solo, has no lead and no player to choose", () => {
    const { t, state } = response(1);
    const looking = state.window?.kind === "look" ? pass(t, state) : state;
    const keep = sheetOf(t, looking);
    expect(keep.note).toMatch(/^Choose the card that stays on top of your deck\. The other 2 go to the bottom, in the order you choose next\./);
    expect(keep.note).not.toMatch(/Player/);
  });
});

describe("The Canny Huntsman (12180:A:1)", () => {
  const song = (seats: 1 | 2) => {
    const t = heathTable(world, { seats, hand: [CODES.theCannyHuntsman], deck: ["f0", "f3", "place", "treachery", "f0", "f3"], phase: "Quest" });
    return { t, state: pass(t, opened(t, t.state, CODES.theCannyHuntsman, "action", idOf(t.state, CODES.theCannyHuntsman))) };
  };

  it("two-handed, leads with the player and says the cards chosen go to the bottom, in order, and Done puts the rest on top", () => {
    const { t, state } = song(2);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toMatch(/^Player 1: choose the cards that go to the bottom of the encounter deck, from the top 5 you looked at, one at a time: each is placed under the rest\. Done puts the rest back on top, in the order you choose next\./);
    expect(sheet.note).not.toContain("Player 1 chooses");
    expect(sheet.note).not.toContain("in any order");
    expect(sheet.note).not.toContain("so far");
    expect(labels(sheet).at(-1)).toBe("Done: the rest stay on top");
    expect(labels(sheet).slice(0, -1).every((label) => label.startsWith("To bottom: "))).toBe(true);
    // Each card chosen is counted in the note.
    const one = take(t, state, sheet.options[0]!.id);
    expect(one.window?.kind).toBe("choose");
    expect(sheetOf(t, one).note).toContain("1 to the bottom so far.");
    expect(sheetOf(t, take(t, one, sheetOf(t, one).options[0]!.id)).note).toContain("2 to the bottom so far.");
  });

  it("solo, has no lead; the cards left on top are ordered next", () => {
    const { t, state } = song(1);
    expect(sheetOf(t, state).note).toMatch(/^Choose the cards that go to the bottom of the encounter deck, from the top 5 you looked at/);
    const done = sheetOf(t, state).options.at(-1)!;
    const arranging = take(t, state, done.id);
    expect(arranging.window?.kind).toBe("choose");
    expect(sheetOf(t, arranging).note).toMatch(/^Choose the card to put on top of the encounter deck; the others follow in the order you choose \(\d+ left to place\)\./);
  });
});

describe("High Falls (19019:A:3) and Heavy Snow (19020:A:2)", () => {
  it("High Falls: the first player assigns the damage one point at a time among any player's characters, with the number left", () => {
    for (const [seats, lead] of [[2, "Player 1: assign"], [1, "Assign"]] as const) {
      const t = heathTable(world, { seats, phase: "Travel", staging: [CODES.highFalls, CODES.lostArmory, CODES.ancientTreasury] });
      const falls = idOf(t.state, CODES.highFalls);
      const state = opened(t, t.state, CODES.highFalls, "travel", falls, "travel");
      const sheet = sheetOf(t, state);
      expect(sheet.note).toContain(`${lead} 1 damage to a character in play (3 of 3 left).`);
      expect(sheet.note).not.toContain("chooses");
      const second = sheetOf(t, take(t, state, sheet.options[0]!.id));
      expect(second.note).toContain(`${lead} 1 damage to a character in play (2 of 3 left).`);
    }
  });

  it("Heavy Snow: the first player chooses one ready character in play, any player's, and says what the round does", () => {
    const t = heathTable(world, { seats: 2, staging: [CODES.heavySnow] });
    const snow = idOf(t.state, CODES.heavySnow);
    const sheet = sheetOf(t, opened(t, t.state, CODES.heavySnow, "whenRevealed", snow, "whenRevealed"));
    expect(sheet.note).toMatch(/^Player 1: choose a ready character in play to exhaust, any player's\. No player card effect can ready a character until the end of the round\./);
    expect(sheet.note).not.toContain("Player 1 chooses");
    expect(sheet.options).toHaveLength(3);
    const solo = heathTable(world, { staging: [CODES.heavySnow] });
    const soloSheet = sheetOf(solo, opened(solo, solo.state, CODES.heavySnow, "whenRevealed", idOf(solo.state, CODES.heavySnow), "whenRevealed"));
    expect(soloSheet.note).toMatch(/^Choose a ready character in play to exhaust, any player's\./);
  });
});

describe("the look at the top 3 cards of the encounter deck (19022:B:1, 19024:B:1)", () => {
  it("states the number looked at and that the others are discarded first, with the player two-handed", () => {
    for (const [stage, id] of [["19022", "19022:forced:1"], ["19024", "19024:forced:1"]] as const) {
      const t = heathTable(world, { seats: 2, stage, deck: ["f0", "f3", "treachery", "place"] });
      const looking = opened(t, t.state, t.state.cards[t.state.questStage ?? ""]?.code ?? "", "forced", t.state.questStage ?? "", "forced", id);
      expect(looking.window?.kind).toBe("look");
      const sheet = sheetOf(t, pass(t, looking));
      expect(sheet.note).toMatch(/^Player 1: choose 1 of the 3 cards you looked at to reveal\. The others are discarded first\./);
      expect(sheet.note).not.toContain("Player 1 chooses");
    }
  });
});

describe("Unbroken (12177:A:4) and Rhyme of the Slayer (12183:A:1)", () => {
  it("Unbroken: the player discards a card from their own hand, and the hero that carries it heals", () => {
    for (const [seats, lead] of [[2, "Player 1: choose"], [1, "Choose"]] as const) {
      const t = heathTable(world, { seats, play: [CODES.unbroken], hand: ["filler", "event"] });
      const boon = idOf(t.state, CODES.unbroken);
      const worn = { ...t, state: attachTo(t.state, boon, t.hero) };
      const sheet = sheetOf(worn, opened(worn, worn.state, CODES.unbroken, "action", boon, "forced", "12177:action:1"));
      expect(sheet.note).toContain(`${lead} 1 card from your hand to discard. ${nameOf(worn.state.cards[worn.hero]?.code ?? "")}, the hero with Unbroken, heals 1 damage.`);
      expect(sheet.note).not.toContain("chooses");
    }
  });

  it("Rhyme of the Slayer: any enemy gets -4 Attack, and the +4 against it is told only when a hero carries Dragon-slayer", () => {
    const t = heathTable(world, { seats: 2, phase: "Combat", staging: ["f3", "f0"], hand: [CODES.rhymeOfTheSlayer] });
    const bare = sheetOf(t, opened(t, t.state, CODES.rhymeOfTheSlayer, "action", idOf(t.state, CODES.rhymeOfTheSlayer)));
    expect(bare.note).toContain("Player 1: choose an enemy: it gets -4 Attack until the end of the phase.");
    expect(bare.note).not.toContain("staging area");
    expect(bare.note).not.toContain("+4");
    const slayer = spawn(t.state, CODES.dragonSlayer, { zone: "play", seat: 0 });
    const armed = { ...t, state: attachTo(slayer.state, slayer.id, t.hero) };
    const sheet = sheetOf(armed, opened(armed, armed.state, CODES.rhymeOfTheSlayer, "action", idOf(armed.state, CODES.rhymeOfTheSlayer)));
    expect(sheet.note).toContain("Player 1: choose an enemy: it gets -4 Attack until the end of the phase, and the hero with Dragon-slayer gets +4 Attack against it.");
  });
});

describe("Deadly Cold (19021:A:1)", () => {
  const cold = (seats: 1 | 2, layout: Parameters<typeof heathTable>[1] = {}) => {
    const t = heathTable(world, { seats, staging: [CODES.deadlyCold], ...layout });
    const state = opened(t, t.state, CODES.deadlyCold, "whenRevealed", idOf(t.state, CODES.deadlyCold), "whenRevealed");
    return { t, state };
  };

  it("names the character on both rows, counts the player's ready characters, and leads with the player two-handed", () => {
    const { t, state } = cold(2);
    const first = sheetOf(t, state);
    const hero = (id: string) => nameOf(state.cards[id]?.code ?? "");
    expect(first.note).toMatch(new RegExp(`^Player 1: exhaust ${hero(t.hero)}, or deal it 1 damage\\? \\(1 of 2\\)`));
    expect(labels(first)).toEqual([`Exhaust ${hero(t.hero)}`, `Deal ${hero(t.hero)} 1 damage`]);
    const second = sheetOf(t, take(t, state, "exhaust"));
    expect(second.note).toMatch(new RegExp(`^Player 1: exhaust ${hero(t.hero2)}, or deal it 1 damage\\? \\(2 of 2\\)`));
    // The next player's count starts again, with their own characters.
    const other = sheetOf(t, take(t, take(t, state, "exhaust"), "exhaust"));
    expect(other.note).toMatch(new RegExp(`^Player 2: exhaust ${hero(t.seat1Hero ?? "")}, or deal it 1 damage\\? \\(1 of 1\\)`));
    expect(other.note).not.toContain("chooses");
  });

  it("solo has no lead", () => {
    const { t, state } = cold(1);
    expect(sheetOf(t, state).note).toMatch(/^Exhaust \S+, or deal it 1 damage\? \(1 of 2\)/);
  });

  it("the damage row warns when the damage destroys the character, and the exhaust row never does", () => {
    const { t, state } = cold(1);
    const hurt = updateCard(state, t.hero, { damage: (world.cards.get(state.cards[t.hero]?.code ?? "")?.health ?? 0) - 1 });
    const sheet = sheetOf(t, hurt);
    const rows = Object.fromEntries(sheet.options.map((option) => [option.label.startsWith("Exhaust") ? "exhaust" : "damage", option]));
    expect(rows.exhaust?.caution).toBeUndefined();
    expect(rows.damage?.caution).toMatch(/^Tap again: .+ (falls and the game is lost|is destroyed)$/);
    expect(sheetOf(t, state).options.every((option) => option.caution === undefined)).toBe(true);
  });
});
