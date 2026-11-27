// Rules: rr.action, rr.cost, rr.play-restrictions-and-permissions, rr.unique-cards, rr.traits, rr.ready, rr.attachment-cards,
// rr.encounter-deck, rr.removed-from-game, rr.shadow-effects, rr.defending-player, rr.planning-phase, rr.triggered-ability
// (data/rules/entries.json).
// The Crossings of Poros events, written from their card text (data/cards/CoP.json; the ledger lines in data/printed are read from the scans): Bulwark of the West 17137:A:1, Flight to the Sea 17140:A:1 and A:2, The Dam Bursts 17142:A:1 and
// A:2, Wind from the Sea 17144:A:1 and A:3.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, updateCards } from "../../rules/core/state.ts";
import { setAsideEncounterCards } from "../../rules/families/sidequests/encounter.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Scene, type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { canPlay, choices, combat, fillers, passAll, play, playerTableFor } from "../../../test/harness/player-table.ts";

const QUICKBEAM = "17135";
const HALFAST = "17136";
const BULWARK = "17137";
const FLIGHT = "17140";
const DAM = "17142";
const WIND = "17144";
// Core Aragorn (Leadership), Legolas (Tactics, Silvan), Éowyn (Spirit), Beravor (Lore).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
// The kit's Pal: a Leadership Hobbit hero that is not unique. Ally: a Leadership ally with no traits. Plain: an attachment with no traits.
const PAL = "pal";
const ALLY = "ally";
const PLAIN = "plain";
const CARD = "card";
// An Ent ally that is not unique; a player and an encounter Condition attachment.
const ENT = "ent";
const COND = "cond";
const ENC_COND = "enc-cond";
// Wall: an enemy no attack of these tests destroys.
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([QUICKBEAM, HALFAST, BULWARK, FLIGHT, DAM, WIND, ARAGORN, LEGOLAS, EOWYN, BERAVOR]))]);
  cards.set(ENT, definePrinted({ code: ENT, name: "Ent", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 6, traits: ["Ent"] }));
  cards.set(COND, definePrinted({ code: COND, name: "Cond", type: "attachment", cost: 0, traits: ["Condition"] }));
  cards.set(ENC_COND, definePrinted({ code: ENC_COND, name: "Encounter cond", type: "attachment", traits: ["Condition"], backType: "encounter" }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 2, engagementCost: 40, attack: 1, defense: 3, health: 9 }));
  base = { ...starter, cards };
});

describe("Bulwark of the West (17137:A:1)", () => {
  // Two players: Aragorn (Leadership) pays; the first player has two allies, the second one; a Condition attachment is on Aragorn and
  // another on the Pal, a plain attachment on Aragorn.
  function bulwark(effects: readonly Effect[], conditions = true) {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: ALLY, seat: 0 }, { code: ALLY, seat: 1 }], hand: [{ code: BULWARK, seat: 0 }], attached: [...(conditions ? [{ code: COND, host: ARAGORN }, { code: COND, host: PAL }] : []), { code: PLAIN, host: ARAGORN }] });
    return { tab, allies: tab.ids[ALLY] ?? [], conditions: tab.ids[COND] ?? [], card: idsOf(tab, BULWARK) };
  }

  // "Action: Discard an ally you control to choose and discard a Condition attachment.": the first player's allies are offered (not the
  // other player's); the chosen one is discarded; both Condition attachments are offered, the plain one is not, and the one on the other
  // player's Pal is discarded.
  lineSpec("17137:A:1", "Bulwark of the West: discard an ally you control to discard a Condition attachment", (effects) => {
    const { tab, allies: [first = "", second = "", theirs = ""], conditions: [mine = "", condition = ""], card } = bulwark(effects);
    let run = play(begin(tab.state), tab, card);
    expect(choices(run.state, tab).sort()).toEqual([first, second].sort());
    run = send(run, { type: "Choose", optionId: first }, tab.ctx);
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(run.state.cards[second]?.zone).toBe("play");
    expect(run.state.cards[theirs]?.zone).toBe("play");
    expect(choices(run.state, tab).sort()).toEqual([mine, condition].sort());
    run = send(run, { type: "Choose", optionId: condition }, tab.ctx);
    expect(run.state.cards[condition]?.zone).toBe("discard");
    expect(run.state.cards[mine]?.zone).not.toBe("discard");
    expect(run.state.cards[idsOf(tab, PLAIN)]?.zone).not.toBe("discard");
  });

  // An encounter Condition attachment on Aragorn (no player controls it) is a Condition attachment too: the event is played and discards it.
  it("17137:A:1 Bulwark of the West: discards an encounter Condition attachment", () => {
    const scene = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: BULWARK, seat: 0 }], attached: [{ code: ENC_COND, host: ARAGORN }] });
    const condition = idsOf(scene, ENC_COND);
    const tab = { ...scene, state: updateCard(scene.state, condition, { controller: null }) };
    expect(canPlay(tab.state, tab, idsOf(tab, BULWARK))).toBe(true);
    const run = play(begin(tab.state), tab, idsOf(tab, BULWARK));
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("discard");
    expect(run.state.cards[condition]?.zone).toBe("encounterDiscard");
  });

  // No ally you control (the other player's does not count), or no Condition attachment: the event is not played.
  it("17137:A:1 Bulwark of the West: not played without an ally you control or without a Condition attachment", () => {
    const noAlly = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 1 }], hand: [{ code: BULWARK, seat: 0 }], attached: [{ code: COND, host: ARAGORN }] });
    expect(canPlay(noAlly.state, noAlly, idsOf(noAlly, BULWARK))).toBe(false);
    const { tab, card } = bulwark(EFFECTS, false);
    expect(canPlay(tab.state, tab, card)).toBe(false);
  });
});

describe("Flight to the Sea (17140:A:1)", () => {
  // Éowyn (Spirit) pays; Legolas (Silvan) or Aragorn beside her; Wind from the Sea set aside; four cards in the encounter deck.
  const flight = (effects: readonly Effect[], other: string, start: Scene["start"] = "planning") =>
    table(effects, { start, heroes: [{ code: EOWYN, seat: 0 }, { code: other, seat: 0 }], hand: [{ code: FLIGHT, seat: 0 }], setAside: [WIND], deck: ["f0", "f0", "f0", "f0"] });

  // "Play only if you control a Noldor or Silvan hero.": with Legolas it is played; with Aragorn it is not.
  lineSpec("17140:A:1", "Flight to the Sea: played only with a Noldor or Silvan hero", (effects) => {
    const without = flight(effects, ARAGORN);
    expect(canPlay(without.state, without, idsOf(without, FLIGHT))).toBe(false);
    const tab = flight(effects, LEGOLAS);
    expect(canPlay(tab.state, tab, idsOf(tab, FLIGHT))).toBe(true);
  });

  // "Planning Action: Shuffle a set aside Wind from the Sea into the encounter deck. Then, remove Flight to the Sea from the game.": Wind
  // from the Sea lies in the encounter deck, neither on top nor at the bottom, and the event is removed from the game.
  it("17140:A:2 Flight to the Sea: shuffles the set-aside Wind from the Sea into the encounter deck, then is removed from the game", () => {
    const tab = flight(EFFECTS, LEGOLAS);
    const [card, wind] = [idsOf(tab, FLIGHT), idsOf(tab, WIND)];
    const run = play(begin(tab.state), tab, card);
    expect(run.state.cards[wind]?.zone).toBe("encounterDeck");
    const at = run.state.encounterDeck.indexOf(wind);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(run.state.encounterDeck.length - 1);
    expect(run.state.cards[card]?.zone).toBe("removed");
  });

  // "Planning Action": not in the quest phase.
  it("17140:A:2 Flight to the Sea: not played outside the planning phase", () => {
    const tab = flight(EFFECTS, LEGOLAS, "quest");
    expect(canPlay(tab.state, tab, idsOf(tab, FLIGHT))).toBe(false);
  });
});

describe("The Dam Bursts (17142:A:1, A:2)", () => {
  // Beravor (Lore) pays; Quickbeam (a unique Ent hero), damaged and exhausted so that the Action has an Ent to ready, and `hobbit`
  // (Halfast, a unique Hobbit ally, or the Pal, a Hobbit hero that is not unique).
  function dam(effects: readonly Effect[], hobbit: string, ents = 0): Table {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: QUICKBEAM, seat: 0 }, ...(hobbit === PAL ? [{ code: PAL, seat: 0 }] : [])], allies: [...(hobbit === HALFAST ? [{ code: HALFAST, seat: 0 }] : []), ...fillers(ENT, ents)], hand: [{ code: DAM, seat: 0 }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, QUICKBEAM), { exhausted: true, damage: 1 }) };
  }

  // "Play only if you control a unique character with the Ent trait and another unique character with the Hobbit trait.": with Halfast it
  // is played; with the Pal (not unique) it is not.
  lineSpec("17142:A:1", "The Dam Bursts: played only with a unique Ent and another unique Hobbit", (effects) => {
    const pal = dam(effects, PAL);
    expect(canPlay(pal.state, pal, idsOf(pal, DAM))).toBe(false);
    const tab = dam(effects, HALFAST);
    expect(canPlay(tab.state, tab, idsOf(tab, DAM))).toBe(true);
  });

  // "Action: Ready each damaged Ent character you control.": Quickbeam and an Ent ally, damaged and exhausted, are readied; an Ent ally
  // exhausted with no damage and Halfast (damaged, not an Ent) stay exhausted.
  lineSpec("17142:A:2", "The Dam Bursts: ready each damaged Ent character you control", (effects) => {
    const scene = dam(effects, HALFAST, 2);
    const [quickbeam, halfast] = [idsOf(scene, QUICKBEAM), idsOf(scene, HALFAST)];
    const [hurt = "", whole = ""] = scene.ids[ENT] ?? [];
    const state = updateCards(scene.state, [[hurt, { exhausted: true, damage: 1 }], [whole, { exhausted: true }], [halfast, { exhausted: true, damage: 1 }]]);
    const tab = { ...scene, state };
    const run = play(begin(state), tab, idsOf(tab, DAM));
    expect([quickbeam, hurt, whole, halfast].map((id) => run.state.cards[id]?.exhausted)).toEqual([false, false, true, true]);
  });
});

describe("Wind from the Sea (17144:A:1, A:3)", () => {
  // "Encounter.": at the Setup the card is set aside from its player's deck, still that player's card.
  lineSpec("17144:A:1", "Wind from the Sea: the Encounter keyword sets it aside from the player's deck", (effects) => {
    const tab = table(effects, { playerDeck: [{ code: WIND, seat: 0 }, { code: CARD, seat: 0 }] });
    const state = setAsideEncounterCards(tab.state, 0, tab.ctx);
    expect(state.cards[idsOf(tab, WIND)]).toMatchObject({ zone: "setAside", owner: 0 });
    expect(state.cards[idsOf(tab, CARD)]?.zone).toBe("deck");
  });

  // "Shadow: Ready the defending character": two Walls attack; Wind from the Sea is the shadow card of one, an enemy card with no shadow
  // effect that of the other. Aragorn defends the Wind's Wall first (and is exhausted), the shadow readies him, and he is ready for the
  // second attack.
  lineSpec("17144:A:3", "Wind from the Sea: as a shadow card, ready the defending character", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }], engaged: [{ code: WALL, seat: 0 }, { code: WALL, seat: 0 }], deck: ["f0", WIND] });
    const [aragorn, wind] = [idsOf(tab, ARAGORN), idsOf(tab, WIND)];
    let run = passAll(combat(tab.state, tab), tab.ctx);
    const shadowed = (tab.ids[WALL] ?? []).find((id) => run.state.cards[id]?.shadowId === wind) ?? "";
    expect(run.state.cards[shadowed]?.shadowId).toBe(wind);
    expect(run.state.window?.kind).toBe("chooseEnemy");
    run = passAll(send(run, { type: "ChooseEnemy", enemyId: shadowed }, tab.ctx), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", enemyId: shadowed });
    run = passAll(send(run, { type: "DeclareDefender", defenderId: aragorn }, tab.ctx), tab.ctx);
    expect(run.steps.some((step) => step.kind === "strike" && step.enemyId === shadowed && step.targetId === aragorn)).toBe(true);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.cards[aragorn]?.exhausted).toBe(false);
  });
});
