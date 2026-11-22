// Rules: rr.ranged, rr.modifiers, rr.lasting-effects, rr.resource-match, rr.cost, rr.response, rr.action, rr.play-and-put-into-play, rr.enters-play
// (data/rules/entries.json).
// The On the Doorstep heroes, allies and event, written from their card text (data/cards/OtD.json; data/printed holds no ledger for this
// box yet): Bilbo Baggins 132001:A:3, Bard the Bowman 132003:A:2, Óin 132004:A:1, Glóin 132006:A:1, Bifur 132007:A:1, Dwalin 132008:A:2,
// To me! O my kinsfolk! 132012:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { playCost } from "../../rules/player/attach.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const BILBO = "132001";
const BARD = "132003";
const OIN = "132004";
const GLOIN = "132006";
const BIFUR = "132007";
const DWALIN = "132008";
const KINSFOLK = "132012";
// Gondorian Spearman: a Tactics ally of cost 2, to test a Tactics icon.
const SPEARMAN = "01029";
// A Dwarf hero and a Dwarf ally with no text, Leadership so they pay for the Leadership cards.
const DWARF_HERO = "dwarf-hero";
const DWARF = "dwarf";
const ALLY = "ally";
const PAL = "pal";
// A Lore hero that is not a Dwarf, to pay for Bifur.
const SAGE = "sage";
// An enemy no attack of these tests destroys.
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([BILBO, BARD, OIN, GLOIN, BIFUR, DWALIN, KINSFOLK, SPEARMAN]))]);
  cards.set(DWARF_HERO, definePrinted({ code: DWARF_HERO, name: "Dwarf Lord", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Dwarf"] }));
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 3, health: 9 }));
  base = { ...starter, cards };
});

function play(run: Run, tab: Table, cardId: string): Run {
  return sendUnledgered(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId) }, tab.ctx);
}

// `count` Dwarf allies with no text in play for the first seat.
const dwarves = (count: number) => Array.from({ length: count }, () => ({ code: DWARF, seat: 0 }));

// A card of the first seat put in its discard pile.
function discarded(tab: Table, code: string): { tab: Table; id: string } {
  const made = spawn(tab.state, code, { zone: "discard", seat: 0 });
  return { tab: { ...tab, state: made.state }, id: made.id };
}

describe("Bilbo Baggins (132001:A:3)", () => {
  // "If Bilbo Baggins leaves play, the players have lost the game.": Bilbo is destroyed while another hero is still in play, and the
  // game is lost; the other hero destroyed instead loses nothing.
  lineSpec("132001:A:3", "the players lose when he leaves play, and not when another hero does", (effects) => {
    const tab = table(effects, { heroes: [{ code: BILBO, seat: 0 }, { code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }] });
    const killed = (id: string) => sendUnledgered(begin(placeDamage(tab.state, id, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    const other = killed(idsOf(tab, DWARF_HERO));
    expect(other.state.cards[idsOf(tab, DWARF_HERO)]?.zone).toBe("discard");
    expect(other.state.lost).toBe(false);
    const run = killed(idsOf(tab, BILBO));
    expect(run.state.cards[idsOf(tab, BILBO)]?.zone).not.toBe("heroes");
    expect(run.state.lost).toBe(true);
  });
});

describe("Bard the Bowman (132003:A:2)", () => {
  // "When Bard the Bowman makes a ranged attack, the enemy he attacks gets -2 Defense until the end of the phase.": Bard attacks the Wall
  // engaged with the other player (a ranged attack, rr.ranged), and the Wall has -2 Defense until the combat phase ends.
  lineSpec("132003:A:2", "the enemy engaged with another player that he attacks gets -2 Defense until the end of the phase", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: BARD, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WALL, seat: 1 }] });
    const wall = idsOf(tab, WALL);
    const defense = stat(tab.state, tab, wall, "defense");
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, BARD)] }, tab.ctx);
    expect(stat(run.state, tab, wall, "defense")).toBe(defense - 2);
    expect(stat(withMode(run.state, "refresh"), tab, wall, "defense")).toBe(defense);
  });

  // An attack on an enemy engaged with Bard's own player is not a ranged attack (rr.ranged): the enemy keeps its Defense.
  it("132003:A:2 does not lower the Defense of an enemy engaged with his own player", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BARD, seat: 0 }, { code: PAL, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const wall = idsOf(tab, WALL);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, BARD)] }, tab.ctx);
    expect(stat(run.state, tab, wall, "defense")).toBe(stat(tab.state, tab, wall, "defense"));
  });
});

describe("Óin (132004:A:1)", () => {
  // "While you control at least 5 Dwarf characters, Óin gets +1 Attack and gains the Tactics resource icon.": Óin, a Dwarf hero and two
  // Dwarf allies are 4; the fifth, played from the hand, brings the bonus in the state that intent returns. Óin then pays for the
  // Gondorian Spearman (Tactics) on his own.
  lineSpec("132004:A:1", "+1 Attack and the Tactics icon once the fifth Dwarf character is played", (effects) => {
    const tab = table(effects, { heroes: [{ code: OIN, seat: 0 }, { code: DWARF_HERO, seat: 0 }], allies: dwarves(2), hand: [{ code: DWARF, seat: 0 }, { code: SPEARMAN, seat: 0 }] });
    const oin = idsOf(tab, OIN);
    const attack = tab.ctx.cards.get(OIN)?.attack ?? 0;
    const spearman = idsOf(tab, SPEARMAN);
    const byOin = { type: "PlayCard", cardId: spearman, payments: [{ heroId: oin, amount: 2 }] } as const;
    expect(stat(tab.state, tab, oin, "attack")).toBe(attack);
    expect(refusal(tab.state, byOin, tab.ctx)).not.toBeNull();
    const fifth = tab.ids[DWARF]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    const run = play(begin(tab.state), tab, fifth);
    expect(stat(run.state, tab, oin, "attack")).toBe(attack + 1);
    expect(refusal(run.state, byOin, tab.ctx)).toBeNull();
  });

  // "you control": the other player's Dwarf characters are not counted.
  it("132004:A:1 does not count another player's Dwarf characters", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: OIN, seat: 0 }, { code: DWARF_HERO, seat: 0 }, { code: DWARF_HERO, seat: 1 }], allies: [...dwarves(1), { code: DWARF, seat: 1 }, { code: DWARF, seat: 1 }] });
    expect(stat(tab.state, tab, idsOf(tab, OIN), "attack")).toBe(tab.ctx.cards.get(OIN)?.attack ?? 0);
  });
});

describe("Glóin and Bifur (132006:A:1, 132007:A:1)", () => {
  // Glóin or Bifur in hand, with a Dwarf hero, a hero that is not a Dwarf (Leadership for Glóin, Lore for Bifur) and `allies` Dwarf
  // allies in play: 3 allies make him the fifth Dwarf character.
  function scene(effects: readonly Effect[], code: string, allies: number): Table {
    return table(effects, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: code === BIFUR ? SAGE : PAL, seat: 0 }], allies: dwarves(allies), hand: [{ code, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }, { code: "card", seat: 0 }] });
  }

  // "While you control at least 5 Dwarf characters, Glóin gains: "Response: After you play Glóin from your hand, choose a hero. Add 2
  // resources to that hero's resource pool."": Glóin is the fifth Dwarf (the Dwarf hero and 3 allies); the chosen hero (the Pal, not a
  // Dwarf) gets 2 resources.
  lineSpec("132006:A:1", "Glóin: after he is played as the fifth Dwarf, 2 resources to the chosen hero", (effects) => {
    const tab = scene(effects, GLOIN, 3);
    const pal = idsOf(tab, PAL);
    let run = play(begin(tab.state), tab, idsOf(tab, GLOIN));
    const before = run.state.cards[pal]?.resources ?? 0;
    expect(triggers(run.state, tab)).toContain("132006:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, GLOIN), effectId: "132006:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, DWARF_HERO), pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[pal]?.resources).toBe(before + 2);
  });

  // With 4 Dwarf characters (Glóin the fourth) the Response is not gained.
  it("132006:A:1 Glóin: no Response as the fourth Dwarf", () => {
    const tab = scene(EFFECTS, GLOIN, 2);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, GLOIN)).state, tab)).not.toContain("132006:response:1");
  });

  // "... Bifur gains: "Response: After you play Bifur from your hand, draw 2 cards."": the fifth Dwarf, so 2 cards are drawn.
  lineSpec("132007:A:1", "Bifur: after he is played as the fifth Dwarf, draw 2 cards", (effects) => {
    const tab = scene(effects, BIFUR, 3);
    let run = play(begin(tab.state), tab, idsOf(tab, BIFUR));
    const hand = run.state.seats[0]?.hand.length ?? 0;
    expect(triggers(run.state, tab)).toContain("132007:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, BIFUR), effectId: "132007:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(hand + 2);
    expect(run.state.seats[0]?.deck).toHaveLength(1);
  });

  it("132007:A:1 Bifur: no Response as the fourth Dwarf", () => {
    const tab = scene(EFFECTS, BIFUR, 2);
    expect(triggers(play(begin(tab.state), tab, idsOf(tab, BIFUR)).state, tab)).not.toContain("132007:response:1");
  });

  // "After you play ... from your hand": Glóin put into play from the discard pile by To me! O my kinsfolk! is not played, so neither
  // Response is offered, though he is the fifth Dwarf.
  it("132006:A:1 132007:A:1 no Response when put into play from the discard pile", () => {
    for (const [code, effect] of [[GLOIN, "132006:response:1"], [BIFUR, "132007:response:1"]] as const) {
      const scene = table(EFFECTS, { heroes: [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }, { code: SAGE, seat: 0 }], allies: dwarves(3), hand: [{ code: KINSFOLK, seat: 0 }] });
      const { tab, id } = discarded(scene, code);
      let run = play(begin(tab.state), tab, idsOf(tab, KINSFOLK));
      if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: id }, tab.ctx);
      expect(run.state.cards[id]?.zone).toBe("play");
      expect(triggers(run.state, tab)).not.toContain(effect);
    }
  });
});

describe("Dwalin (132008:A:2)", () => {
  // "While you control at least 5 Dwarf characters, lower the cost to play Dwalin by 2.": with a Dwarf hero and 4 Dwarf allies he costs
  // 1, with 3 his printed 3 (Dwalin in hand is not a character you control).
  lineSpec("132008:A:2", "costs 2 less with 5 Dwarf characters, his printed cost with 4", (effects) => {
    const printed = tab0(effects, 3);
    const dwalin = idsOf(printed, DWALIN);
    expect(playCost(printed.state, dwalin, 0, printed.ctx)).toBe(3);
    const five = tab0(effects, 4);
    expect(playCost(five.state, idsOf(five, DWALIN), 0, five.ctx)).toBe(1);
    const run = sendUnledgered(begin(five.state), { type: "PlayCard", cardId: idsOf(five, DWALIN), payments: [{ heroId: idsOf(five, OIN), amount: 1 }] }, five.ctx);
    expect(run.state.cards[idsOf(five, DWALIN)]?.zone).toBe("play");
  });

  // Óin (Spirit) pays for Dwalin.
  function tab0(effects: readonly Effect[], allies: number): Table {
    return table(effects, { heroes: [{ code: OIN, seat: 0 }], allies: dwarves(allies), hand: [{ code: DWALIN, seat: 0 }] });
  }
});

describe("To me! O my kinsfolk! (132012:A:1)", () => {
  // The Dwarf hero and the Pal (or the Pal alone and a Dwarf ally in play, `dwarf` false), and Glóin, a plain ally and the Dwarf ally
  // in the discard pile.
  function scene(effects: readonly Effect[], dwarf: boolean): { tab: Table; gloin: string; plain: string; other: string } {
    const heroes = dwarf ? [{ code: DWARF_HERO, seat: 0 }, { code: PAL, seat: 0 }] : [{ code: PAL, seat: 0 }];
    const start = table(effects, { heroes, allies: dwarf ? [] : dwarves(1), hand: [{ code: KINSFOLK, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }] });
    const gloin = discarded(start, GLOIN);
    const plain = discarded(gloin.tab, ALLY);
    const other = discarded(plain.tab, DWARF);
    return { tab: other.tab, gloin: gloin.id, plain: plain.id, other: other.id };
  }

  // "Action: If you control at least 1 Dwarf hero, put a Dwarf ally from your discard pile into play under your control. Put that ally
  // on the bottom of your deck at the end of the phase.": the Dwarf allies are offered and the plain ally is not; Glóin comes into play
  // under the player's control, and at the end of the planning phase goes to the bottom of the deck.
  lineSpec("132012:A:1", "puts a Dwarf ally from the discard pile into play, and on the bottom of the deck at the end of the phase", (effects) => {
    const { tab, gloin, plain, other } = scene(effects, true);
    let run = play(begin(tab.state), tab, idsOf(tab, KINSFOLK));
    expect(choices(run.state, tab).sort()).toEqual([gloin, other].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gloin }, tab.ctx);
    expect(run.state.cards[gloin]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[plain]?.zone).toBe("discard");
    expect(run.state.cards[other]?.zone).toBe("discard");
    const ended = settle({ ...withMode(run.state, "questCommit"), window: null }, tab.ctx, []);
    expect(ended.cards[gloin]?.zone).toBe("deck");
    expect(ended.seats[0]?.deck.at(-1)).toBe(gloin);
    expect(ended.seats[0]?.deck).toHaveLength(3);
  });

  // A Dwarf ally in play is not a Dwarf hero.
  it("132012:A:1 is not played without a Dwarf hero", () => {
    const { tab } = scene(EFFECTS, false);
    expect(legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, KINSFOLK))).toBe(false);
  });
});
