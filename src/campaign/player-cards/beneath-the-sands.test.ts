// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.cancel, rr.cost, rr.traits, rr.drawing-cards, rr.unique-cards,
// rr.play-restrictions-and-permissions, rr.deckbuilding, rr.discard-pile-and-victory-display, rr.limits, rr.lasting-effects, rr.staging,
// rr.triggered-ability (data/rules/entries.json).
// The Beneath the Sands player cards, each line tested from the words on the card: Haradrim Spear 17056:A:2 and A:3, Hunting Party
// 17057:A:1, The Red Arrow 17058:A:1 and A:2, Keep Watch 17059:A:1, Fireside Song 17061:A:1, Dúnedain Lookout 17062:A:1, Doughty Ranger
// 17063:A:1 and A:2. The lines are the text of data/cards/BtS.json (data/printed holds no entry for this pack), so every intent goes through
// sendUnledgered. The Lookout cancels the When Revealed of Goblin Follower (03035).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, deckSaveFacts, fillers, hosts, packRow, passAll, play, playCode, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SPEAR = "17056";
const HUNTING = "17057";
const ARROW = "17058";
const KEEP = "17059";
const FIRESIDE = "17061";
const LOOKOUT = "17062";
const DOUGHTY = "17063";
// Wingfoot (The Nîn-in-Eilph): "Attach to a Ranger hero."
const WINGFOOT = "08092";
// Kahliel (Leadership Harad hero), Hirgon (Tactics Gondor Scout, unique), Elfhelm (Leadership Rohan Scout Warrior, unique), the Rider of
// Rohan (a Scout ally, not unique), Song of Kings (a Song attachment for a hero), Sam (a Leadership Hobbit hero).
const KAHLIEL = "17001";
const HIRGON = "17055";
const ELFHELM = "12057";
const RIDER = "17060";
const KINGS = "02010";
const SAM = "141002";
// Core: Legolas (Tactics Silvan Warrior, unique), Éowyn (Spirit Rohan), Denethor (Lore Gondor), Guard of the Citadel (a Gondor ally).
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const GUARD = "01013";
const PAL = "pal";
// Goblin Follower: an enemy, "When Revealed: Goblin Follower engages the last player."; Tragic Discovery: a treachery, "When Revealed:
// Raise each player's threat by the Threat of the active location."
const FOLLOWER = "03035";
const TRAGIC = "09058";
// A Hobbit ally; an enemy (not unique) that no attack of these tests destroys.
const HOBBIT = "hobbit";
const WALL = "wall";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [SPEAR, HUNTING, ARROW, KEEP, FIRESIDE, LOOKOUT, DOUGHTY, WINGFOOT, KAHLIEL, HIRGON, ELFHELM, RIDER, KINGS, SAM, LEGOLAS, EOWYN, DENETHOR, GUARD, FOLLOWER, TRAGIC];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(HOBBIT, definePrinted({ code: HOBBIT, name: "Hobbit", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Hobbit"] }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 50, attack: 1, defense: 0, health: 20 }));
  base = { ...starter, cards };
});

describe("Haradrim Spear (17056:A:2, A:3)", () => {
  // Kahliel (Attack 2) and the Pal; the Wall is engaged with the player and Kahliel holds the Spear.
  const speared = (effects: readonly Effect[]) => table(effects, { heroes: [{ code: KAHLIEL, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
  const strikes = (run: Run, from = 0) => run.steps.slice(from).flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step.attack] : []));

  // "Attached character gets +1 Attack.": played on Kahliel, his Attack is 2 + 1; the Pal's stays.
  lineSpec("17056:A:2", "Haradrim Spear: the attached character gets +1 Attack", (effects) => {
    const tab = speared(effects);
    const run = play(begin(tab.state), tab, idsOf(tab, SPEAR), idsOf(tab, KAHLIEL));
    expect(stat(run.state, tab, idsOf(tab, KAHLIEL), "attack")).toBe(printed(tab, KAHLIEL, "attack") + 1);
    expect(stat(run.state, tab, idsOf(tab, PAL), "attack")).toBe(printed(tab, PAL, "attack"));
  });

  // "Response: After attached character is declared as an attacker, it gets +3 Attack for this attack. After this attack resolves, discard
  // Haradrim Spear.": Kahliel attacks the Wall and strikes with 2 + 1 + 3; once the attack resolves, the Spear is in the discard pile and
  // his Attack is his printed 2.
  lineSpec("17056:A:3", "Haradrim Spear: +3 Attack for the attack, then the Spear is discarded", (effects) => {
    const tab = speared(effects);
    const [kahliel, spear] = [idsOf(tab, KAHLIEL), idsOf(tab, SPEAR)];
    const played = play(begin(tab.state), tab, spear, kahliel);
    let run = sendUnledgered(begin(attacking(played.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [kahliel] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("17056:response:1");
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: spear, effectId: "17056:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(strikes(run)).toEqual([printed(tab, KAHLIEL, "attack") + 1 + 3]);
    expect(run.state.cards[spear]?.zone).toBe("discard");
    expect(stat(run.state, tab, kahliel, "attack")).toBe(printed(tab, KAHLIEL, "attack"));
  });

  // Without the Response the Spear stays and the attack is 2 + 1.
  it("17056:A:3 Haradrim Spear: not used, the Spear stays", () => {
    const tab = speared(EFFECTS);
    const [kahliel, spear] = [idsOf(tab, KAHLIEL), idsOf(tab, SPEAR)];
    const played = play(begin(tab.state), tab, spear, kahliel);
    let run = sendUnledgered(begin(attacking(played.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [kahliel] }, tab.ctx);
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    expect(strikes(run)).toEqual([printed(tab, KAHLIEL, "attack") + 1]);
    expect(run.state.cards[spear]?.host).toBe(kahliel);
  });
});

describe("Hunting Party (17057:A:1)", () => {
  // The quest phase with `heroes`: the first commits, the player is done committing, and the staging step begins. The Wall (not unique) is in the staging area and
  // Hunting Party in hand.
  function committed(effects: readonly Effect[], heroes: readonly string[], allies: readonly string[] = []): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: heroes.map((code) => ({ code, seat: 0 })), allies: allies.map((code) => ({ code, seat: 0 })), hand: [{ code: HUNTING, seat: 0 }], staging: [WALL], deck: ["f0", "f0"] });
    const run = sendUnledgered(sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, heroes[0] ?? "")] }, tab.ctx), { type: "Pass" }, tab.ctx);
    return { tab, run };
  }

  // "Play only if you control a unique character with the Warrior trait and another unique character with the Scout trait.": Elfhelm
  // (unique, Warrior and Scout) and the Pal: no other unique Scout or Warrior, so it cannot be played.
  lineSpec("17057:A:1", "Hunting Party: not played with one unique Warrior Scout alone", (effects) => {
    const { tab, run } = committed(effects, [ELFHELM, PAL]);
    expect(triggers(run.state, tab)).not.toContain("17057:response:1");
  });

  // Elfhelm (the Warrior) and Hirgon (another unique Scout): it is offered.
  it("17057:A:1 Hunting Party: played with a unique Warrior and another unique Scout", () => {
    const { tab, run } = committed(EFFECTS, [ELFHELM, HIRGON]);
    expect(triggers(run.state, tab)).toContain("17057:response:1");
  });

  // Legolas (a unique Warrior) and the Rider of Rohan (a Scout, not unique): it is not offered.
  it("17057:A:1 Hunting Party: a Scout that is not unique does not count", () => {
    const { tab, run } = committed(EFFECTS, [LEGOLAS, PAL], [RIDER]);
    expect(triggers(run.state, tab)).not.toContain("17057:response:1");
  });
});

describe("The Red Arrow (17058:A:1, A:2)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/BtS.json), which the DeckLimit record restates.
  it("17058:A:1 The Red Arrow: a deck holds at most 1 copy", () => {
    const row = packRow("BtS", ARROW);
    expect(row?.deckLimit).toBe(1);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: ARROW, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: ARROW, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: ARROW });
  });

  // "Attach to a Gondor hero.": Hirgon (who pays) and Denethor (Gondor heroes) are offered; Legolas and the Guard of the Citadel (a Gondor
  // ally) are not.
  lineSpec("17058:A:1", "The Red Arrow: Attach to a Gondor hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: HIRGON, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: ARROW, seat: 0 }] });
    const arrow = idsOf(tab, ARROW);
    expect(hosts(tab, arrow)).toEqual([idsOf(tab, HIRGON), idsOf(tab, DENETHOR)].sort());
    expect(play(begin(tab.state), tab, arrow, idsOf(tab, DENETHOR)).state.cards[arrow]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Attached hero gets +1 Willpower.": played on Denethor, +1; Hirgon's stays.
  lineSpec("17058:A:2", "The Red Arrow: the attached hero gets +1 Willpower", (effects) => {
    const tab = table(effects, { heroes: [{ code: HIRGON, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: ARROW, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, ARROW), idsOf(tab, DENETHOR));
    expect(stat(run.state, tab, idsOf(tab, DENETHOR), "willpower")).toBe(printed(tab, DENETHOR, "willpower") + 1);
    expect(stat(run.state, tab, idsOf(tab, HIRGON), "willpower")).toBe(printed(tab, HIRGON, "willpower"));
  });
});

describe("Keep Watch (17059:A:1)", () => {
  // "Limit 1 copy of Keep Watch in the victory display.": one copy is in the victory display; Legolas plays the second into the staging
  // area, and once it holds its 6 progress it is defeated and goes to its owner's discard pile, not to the victory display.
  lineSpec("17059:A:1", "Keep Watch: a second copy defeated goes to the discard pile, not the victory display", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], victory: [KEEP], hand: [{ code: KEEP, seat: 0 }] });
    // The copy in hand is placed first, then the one in the victory display.
    const [second = "", first = ""] = tab.ids[KEEP] ?? [];
    expect(tab.state.cards[first]?.zone).toBe("victory");
    const played = playCode(tab, KEEP);
    expect(played.state.cards[second]?.zone).toBe("staging");
    const run = sendUnledgered(begin(updateCard(played.state, second, { progress: 6 })), { type: "Pass" }, tab.ctx);
    expect(run.state.victory).toEqual([first]);
    expect(run.state.cards[second]?.zone).toBe("discard");
  });
});

describe("Fireside Song (17061:A:1)", () => {
  // "Attach to a Hobbit hero. Limit 1 per hero.": the Pal and Sam (Hobbit heroes) are offered; Éowyn (who pays) and the Hobbit ally are
  // not; with a Fireside Song on the Pal, a second one is offered only for Sam.
  lineSpec("17061:A:1", "Fireside Song: Attach to a Hobbit hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SAM, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: HOBBIT, seat: 0 }], hand: [{ code: FIRESIDE, seat: 0 }, { code: FIRESIDE, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[FIRESIDE] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, PAL), idsOf(tab, SAM)].sort());
    const run = play(begin(tab.state), tab, first, idsOf(tab, PAL));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, SAM)]);
  });

  // "Attached hero gets +1 Willpower for each Song attached to it.": on Sam it counts itself, +1; on the Pal, who holds Song of Kings, +2.
  lineSpec("17061:A:1", "Fireside Song: +1 Willpower for each Song on the hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SAM, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: KINGS, host: PAL }], hand: [{ code: FIRESIDE, seat: 0 }, { code: FIRESIDE, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[FIRESIDE] ?? [];
    let run = play(begin(tab.state), tab, first, idsOf(tab, SAM));
    expect(stat(run.state, tab, idsOf(tab, SAM), "willpower")).toBe(printed(tab, SAM, "willpower") + 1);
    run = play(run, tab, second, idsOf(tab, PAL));
    expect(stat(run.state, tab, idsOf(tab, PAL), "willpower")).toBe(printed(tab, PAL, "willpower") + 2);
  });
});

describe("Dúnedain Lookout (17062:A:1)", () => {
  // The Pal quests with the Lookout in play and is done committing; the encounter deck's top card, `top`, is revealed in the staging step.
  function revealed(effects: readonly Effect[], top: string): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: PAL, seat: 0 }], allies: [{ code: LOOKOUT, seat: 0 }], deck: [top, "f0"] });
    const run = sendUnledgered(sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx), { type: "Pass" }, tab.ctx);
    return { tab, run };
  }

  // "Response: Discard Dúnedain Lookout to cancel the 'When Revealed' effects of an enemy just revealed from the encounter deck.": Goblin
  // Follower is revealed; the Lookout is discarded and the Follower stays in the staging area instead of engaging the player.
  lineSpec("17062:A:1", "Dúnedain Lookout: discard it to cancel the When Revealed effects of an enemy just revealed", (effects) => {
    const { tab, run: pending } = revealed(effects, FOLLOWER);
    const lookout = idsOf(tab, LOOKOUT);
    expect(triggers(pending.state, tab)).toContain("17062:response:1");
    const run = sendUnledgered(pending, { type: "Trigger", cardId: lookout, effectId: "17062:response:1" }, tab.ctx);
    expect(run.state.cards[lookout]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, FOLLOWER)]?.zone).toBe("staging");
  });

  // Not used: the When Revealed resolves and the Follower engages the player.
  it("17062:A:1 Dúnedain Lookout: the When Revealed effect resolves when it is not used", () => {
    const { tab, run: pending } = revealed(EFFECTS, FOLLOWER);
    const run = sendUnledgered(pending, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, FOLLOWER)]?.zone).toBe("engaged");
    expect(run.state.cards[idsOf(tab, LOOKOUT)]?.zone).toBe("play");
  });

  // "an enemy": the When Revealed of a treachery is not offered.
  it("17062:A:1 Dúnedain Lookout: not offered for a treachery", () => {
    const { tab, run } = revealed(EFFECTS, TRAGIC);
    expect(run.state.cards[idsOf(tab, TRAGIC)]?.zone).not.toBe("encounterDeck");
    expect(triggers(run.state, tab)).not.toContain("17062:response:1");
  });
});

describe("Doughty Ranger (17063:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero. Attached hero gains the Ranger trait.": Denethor (who pays) and Éowyn are offered, the Guard is
  // not. Played on Denethor, he is a Ranger: Wingfoot ("Attach to a Ranger hero") may go on him, and a second Doughty Ranger only on Éowyn.
  lineSpec("17063:A:1", "Doughty Ranger: Attach to a hero, limit 1 per hero, and the hero gains the Ranger trait", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: DOUGHTY, seat: 0 }, { code: DOUGHTY, seat: 0 }, { code: WINGFOOT, seat: 0 }], playerDeck: fillers("card", 3) });
    const [denethor, eowyn, wingfoot] = [idsOf(tab, DENETHOR), idsOf(tab, EOWYN), idsOf(tab, WINGFOOT)];
    const [first = "", second = ""] = tab.ids[DOUGHTY] ?? [];
    expect(hosts(tab, first)).toEqual([denethor, eowyn].sort());
    expect(hosts(tab, wingfoot)).toEqual([]);
    const run = passAll(play(begin(tab.state), tab, first, denethor), tab.ctx, { responses: true });
    expect(hosts(tab, wingfoot, run.state)).toEqual([denethor]);
    expect(hosts(tab, second, run.state)).toEqual([eowyn]);
  });

  // "Response: After you play Doughty Ranger from your hand, draw a card.": 1 of the 3 cards is drawn.
  lineSpec("17063:A:2", "Doughty Ranger: after you play it from your hand, draw a card", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: DOUGHTY, seat: 0 }], playerDeck: fillers("card", 3) });
    const ranger = idsOf(tab, DOUGHTY);
    let run = play(begin(tab.state), tab, ranger, idsOf(tab, DENETHOR));
    const hand = run.state.seats[0]?.hand.length ?? 0;
    expect(triggers(run.state, tab)).toContain("17063:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: ranger, effectId: "17063:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(hand + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // An empty deck: the draw can change nothing, so the Response is not offered (rr.triggered-ability).
  it("17063:A:2 Doughty Ranger: not offered with an empty deck", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: DOUGHTY, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, DOUGHTY), idsOf(tab, DENETHOR));
    expect(run.state.seats[0]?.deck).toHaveLength(0);
    expect(triggers(run.state, tab)).not.toContain("17063:response:1");
  });
});
