// Rules: rr.action, rr.event-cards, rr.encounter-phase, rr.engaged, rr.lasting-effects, rr.delayed-effects, rr.ownership-and-control,
// rr.attachment-cards, rr.may (data/rules/entries.json).
// The Blood of Gondor events, each printed line tested from the words on the card (data/cards/BoG.json: data/printed holds no ledger for
// this pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): The Hammer-stroke 06111:A:1, Children
// of the Sea 06113:A:1, Well-Equipped 06116:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, enter, fillers, play, playerTable, printed, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const HAMMER = "06111";
const CHILDREN = "06113";
const WELL = "06116";
// Core Gimli (Tactics, Dwarf), Éowyn (Spirit), Glóin (Leadership, Dwarf), Denethor (Lore).
const GIMLI = "01004";
const GLOIN = "01003";
const EOWYN = "01007";
const DENETHOR = "01010";
// Lórien Guide (Silvan), Wandering Took (Hobbit), Veteran Axehand (Dwarf ally). Dwarven Axe: "Attach to a hero. Restricted.".
const GUIDE = "01044";
const TOOK = "01043";
const AXEHAND = "01028";
const AXE = "01041";
// Stand-ins: an enemy, a Noldor ally.
const WEAK = "weak";
const NOLDO = "noldo";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [HAMMER, CHILDREN, WELL, GIMLI, GLOIN, EOWYN, DENETHOR, GUIDE, TOOK, AXEHAND, AXE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 9 }));
  cards.set(NOLDO, definePrinted({ code: NOLDO, name: "Noldo", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Noldor"] }));
  base = { ...starter, cards };
});

const playable = (tab: Table, state: Table["state"], cardId: string) => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);

describe("The Hammer-stroke (06111:A:1)", () => {
  // Two players: a Weak in the staging area, one engaged with the other player and one engaged with the first player.
  const scene = (effects: readonly Effect[], start: Scene["start"]) =>
    table(effects, { seats: 2, start, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HAMMER, seat: 0 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 1 }, { code: WEAK, seat: 0 }] });

  // "Encounter Action: Engage each enemy in play.": in the encounter phase, the enemy in the staging area and the one engaged with the
  // other player both engage the first player.
  lineSpec("06111:A:1", "The Hammer-stroke: engage each enemy in play", (effects) => {
    const tab = scene(effects, "encounter");
    // Each player declines the optional engagement; the engagement checks engage nothing (engagement cost 50), and the window after
    // them opens.
    let checked = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    checked = sendUnledgered(checked, { type: "DeclineEngage" }, tab.ctx);
    expect(checked.state.phase).toBe("Encounter");
    const run = play(checked, tab, idsOf(tab, HAMMER));
    expect(run.state.cards[idsOf(tab, HAMMER)]?.zone).toBe("discard");
    for (const id of tab.ids[WEAK] ?? []) expect(run.state.cards[id]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  // "Encounter Action": not played in the planning phase.
  it("06111:A:1 The Hammer-stroke: not played outside the encounter phase", () => {
    const tab = scene(EFFECTS, "planning");
    expect(playable(tab, tab.state, idsOf(tab, HAMMER))).toBe(false);
  });

  // Every enemy in play is already engaged with you: engaging them changes nothing, so the card is not played (rr.triggered-ability).
  it("06111:A:1 The Hammer-stroke: not played when every enemy is engaged with you", () => {
    const tab = table(EFFECTS, { seats: 2, start: "encounter", heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HAMMER, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    run = sendUnledgered(run, { type: "DeclineEngage" }, tab.ctx);
    // No window opens for a card that can change nothing: the phase moves past the engagement checks and the Encounter action window.
    expect(run.state.phase).toBe("Combat");
    expect(playable(tab, run.state, idsOf(tab, HAMMER))).toBe(false);
  });
});

describe("Children of the Sea (06113:A:1)", () => {
  // Two players: the Lórien Guide (Silvan), the Noldo and the Wandering Took for the first, a Lórien Guide for the other.
  const scene = (effects: readonly Effect[]) =>
    table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: GUIDE, seat: 0 }, { code: NOLDO, seat: 0 }, { code: TOOK, seat: 0 }, { code: GUIDE, seat: 1 }], hand: [{ code: CHILDREN, seat: 0 }], playerDeck: [...fillers(PLAIN, 3), ...fillers(PLAIN, 3, 1)] });

  // "Action: Choose a Silvan or Noldor ally you control. That ally gets +2 Willpower until the end of the phase. At the end of the
  // phase, shuffle that ally into its owner's deck if it is still in play.": the Guide and the Noldo are offered (the Took and the
  // other player's Guide are not); the Noldo gets +2 Willpower, and when the planning phase ends it is in its owner's deck.
  lineSpec("06113:A:1", "Children of the Sea: +2 Willpower to a Silvan or Noldor ally, shuffled into the deck at the end of the phase", (effects) => {
    const tab = scene(effects);
    const [guide = ""] = tab.ids[GUIDE] ?? [];
    const noldo = idsOf(tab, NOLDO);
    let run = play(begin(tab.state), tab, idsOf(tab, CHILDREN));
    expect(choices(run.state, tab).sort()).toEqual([guide, noldo].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: noldo }, tab.ctx);
    expect(stat(run.state, tab, noldo, "willpower")).toBe(printed(tab, NOLDO, "willpower") + 2);
    const ended = enter(run.state, tab, "questCommit").state;
    expect(ended.cards[noldo]?.zone).toBe("deck");
    expect(ended.seats[0]?.deck).toContain(noldo);
    expect(ended.seats[0]?.deck).toHaveLength(4);
    expect(ended.cards[guide]?.zone).toBe("play");
  });

  // "if it is still in play": the chosen Guide is destroyed before the phase ends; it stays in the discard pile.
  it("06113:A:1 Children of the Sea: an ally no longer in play stays where it is", () => {
    const tab = scene(EFFECTS);
    const [guide = ""] = tab.ids[GUIDE] ?? [];
    let run = play(begin(tab.state), tab, idsOf(tab, CHILDREN));
    run = sendUnledgered(run, { type: "Choose", optionId: guide }, tab.ctx);
    const destroyed = placeDamage(run.state, guide, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(destroyed.cards[guide]?.zone).toBe("discard");
    const ended = enter(destroyed, tab, "questCommit").state;
    expect(ended.cards[guide]?.zone).toBe("discard");
    expect(ended.seats[0]?.deck).toHaveLength(3);
  });

  // No Silvan or Noldor ally you control (the other player's Guide is one): nothing to choose, so the card is not played.
  it("06113:A:1 Children of the Sea: not played with no Silvan or Noldor ally you control", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: TOOK, seat: 0 }, { code: GUIDE, seat: 1 }], hand: [{ code: CHILDREN, seat: 0 }] });
    expect(playable(tab, tab.state, idsOf(tab, CHILDREN))).toBe(false);
  });
});

describe("Well-Equipped (06116:A:1)", () => {
  // Two players: Gimli and the Pal for the first, Glóin (a Dwarf hero) for the other, the Veteran Axehand (a Dwarf ally); the first
  // player's deck holds `top` on top of 2 Plain cards.
  const scene = (effects: readonly Effect[], top: readonly string[]) =>
    table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 0 }, { code: GLOIN, seat: 1 }], allies: [{ code: AXEHAND, seat: 0 }], hand: [{ code: WELL, seat: 0 }], playerDeck: [...top.map((code) => ({ code, seat: 0 })), ...fillers(PLAIN, 2)] });

  // "Action: Discard the top 2 cards of your deck. You may attach 1 attachment card discarded by this effect to an eligible Dwarf
  // character in play.": the Dwarven Axe and an event are discarded; the Axe ("Attach to a hero") may go on Gimli or on the other player's
  // Glóin, not on the Axehand (an ally) nor on the Pal (not a Dwarf); it goes on Glóin.
  lineSpec("06116:A:1", "Well-Equipped: discard the top 2 and attach a discarded attachment to an eligible Dwarf character", (effects) => {
    const tab = scene(effects, [AXE, "card"]);
    const [axe, gloin, gimli] = [idsOf(tab, AXE), idsOf(tab, GLOIN), idsOf(tab, GIMLI)];
    const top = (tab.state.seats[0]?.deck ?? []).slice(0, 2);
    let run = play(begin(tab.state), tab, idsOf(tab, WELL));
    expect(top.map((id) => run.state.cards[id]?.zone)).toEqual(["discard", "discard"]);
    expect(choices(run.state, tab).sort()).toEqual(["attach", "decline"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "attach" }, tab.ctx);
    // The Axe is the lone attachment discarded, so the next question is its host.
    expect(choices(run.state, tab).sort()).toEqual([gimli, gloin].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: gloin }, tab.ctx);
    expect(run.state.cards[axe]).toMatchObject({ zone: "play", host: gloin });
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // "You may": declined, both cards stay in the discard pile.
  it("06116:A:1 Well-Equipped: declined, nothing is attached", () => {
    const tab = scene(EFFECTS, [AXE, "card"]);
    let run = play(begin(tab.state), tab, idsOf(tab, WELL));
    run = sendUnledgered(run, { type: "Choose", optionId: "decline" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, AXE)]?.zone).toBe("discard");
  });

  // No attachment among the 2 discarded cards: the cards are discarded and nothing is asked.
  it("06116:A:1 Well-Equipped: no attachment discarded, nothing to attach", () => {
    const tab = scene(EFFECTS, ["card", "card"]);
    const run = play(begin(tab.state), tab, idsOf(tab, WELL));
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.seats[0]?.discard ?? []).toEqual(expect.arrayContaining([idsOf(tab, WELL)]));
  });

  // An empty deck: nothing is discarded and nothing can be attached, so the card can change nothing and is not played.
  it("06116:A:1 Well-Equipped: not played with an empty deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: WELL, seat: 0 }] });
    expect(playable(tab, tab.state, idsOf(tab, WELL))).toBe(false);
  });
});
