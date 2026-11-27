// Rules: rr.response, rr.action, rr.cost, rr.limits, rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.gains,
// rr.traits, rr.unique-cards, rr.printed, rr.play-restrictions-and-permissions, rr.engaged, rr.optional-engagement, rr.ready, rr.doomed-x,
// rr.discard-pile-and-victory-display, rr.staging-area, rr.triggered-ability, emce.side-quests (data/rules/entries.json).
// The Race Across Harad player cards, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Thurindir
// 17028:A:1, Kahliel's Tribesman 17029:A:1, Steed of the North 17030:A:1 and A:2, Mighty Warrior 17031:A:1 to A:3, Proud Hunters 17032:A:1
// and A:2, Backtrack 17034:A:1, Explore Secret Ways 17036:A:1 and A:2, Steward of Orthanc 17037:A:1. The lines are the text of
// data/cards/RAH.json (the ledger lines in data/printed are read from the scans).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted, printedOf } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Run, type Scene, type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { attacking, canPlay, choices, endRound, fillers, hosts, passAll, play, playCode, playerTableFor, printed, stat, triggers } from "../../../test/harness/player-table.ts";

const THURINDIR = "17028";
const TRIBESMAN = "17029";
const STEED = "17030";
const MIGHTY = "17031";
const HUNTERS = "17032";
const BACKTRACK = "17034";
const SECRET = "17036";
const STEWARD = "17037";
// Orthanc Guard (Leadership ally): "Response: After you raise your threat from the Doomed keyword, ready Orthanc Guard."
const ORTHANC_GUARD = "07004";
// Player side quests: Delay the Enemy (Tactics), Keep Watch (Tactics). Vigilant Guard: "Attach to a Warrior character."
const DELAY = "10058";
const KEEP = "17059";
const GUARD = "12113";
// Ever Vigilant (core, Leadership event, cost 1): "Action: Choose an exhausted ally. Ready that ally."
const VIGILANT = "01020";
// Core cards: Aragorn (Leadership; Dúnedain, Noble, Ranger), Gimli (Tactics; Dwarf, Noble, Warrior), Denethor (Lore; Gondor, Noble),
// Beravor (Lore; Dúnedain, Ranger), Son of Arnor (a Dúnedain ally).
const ARAGORN = "01001";
const GIMLI = "01004";
const DENETHOR = "01010";
const BERAVOR = "01012";
const SON = "01015";
// Heroes with no text: a Leadership Harad one, a Tactics one with no trait, a Lore Ranger one, a Spirit one; the Pal (scene.ts) is a Leadership Hobbit.
const HARAD = "harad";
const BRAWLER = "brawler";
const RANGER = "ranger";
const SEER = "seer";
const PAL = "pal";
const ALLY = "ally";
const CARD = "card";
// A Harad ally and a non-unique Ranger ally with no text.
const HARAD_ALLY = "harad-ally";
const RANGER_ALLY = "ranger-ally";
// Enemies: the Frail (threat 3, 1 hit point) dies to any attack; the Far is never engaged by a check; the Hard takes no damage.
const FRAIL = "frail";
const FAR = "far";
// Locations: two copies of the Loc and the Mark, each threat 2.
const LOC = "loc";
const MARK = "mark";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [THURINDIR, TRIBESMAN, STEED, MIGHTY, HUNTERS, BACKTRACK, SECRET, STEWARD, DELAY, KEEP, GUARD, VIGILANT, ARAGORN, GIMLI, DENETHOR, BERAVOR, SON, ORTHANC_GUARD];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(HARAD, definePrinted({ code: HARAD, name: "Haradrim", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Harad"] }));
  cards.set(BRAWLER, definePrinted({ code: BRAWLER, name: "Brawler", type: "hero", sphere: "tactics", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4 }));
  cards.set(RANGER, definePrinted({ code: RANGER, name: "Ranger", type: "hero", sphere: "lore", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4, traits: ["Ranger"] }));
  cards.set(SEER, definePrinted({ code: SEER, name: "Seer", type: "hero", sphere: "spirit", threat: 9, willpower: 1, attack: 1, defense: 1, health: 4 }));
  cards.set(HARAD_ALLY, definePrinted({ code: HARAD_ALLY, name: "Harad Ally", type: "ally", sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Harad"] }));
  cards.set(RANGER_ALLY, definePrinted({ code: RANGER_ALLY, name: "Ranger Ally", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Ranger"] }));
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 3, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(FAR, definePrinted({ code: FAR, name: "Far", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 9 }));
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 2, questPoints: 9 }));
  cards.set(MARK, definePrinted({ code: MARK, name: "Mark", type: "location", threat: 2, questPoints: 9 }));
  base = { ...starter, cards };
});

describe("Thurindir (17028:A:1)", () => {
  // "Thurindir gets +1 Willpower for each side quest in the victory display.": Delay the Enemy and Keep Watch are there, and the Loc (a
  // location, not a side quest) is too: Willpower 2 + 2.
  lineSpec("17028:A:1", "Thurindir: +1 Willpower for each side quest in the victory display", (effects) => {
    const tab = table(effects, { heroes: [{ code: THURINDIR, seat: 0 }], victory: [DELAY, KEEP, LOC] });
    expect(stat(tab.state, tab, idsOf(tab, THURINDIR), "willpower")).toBe(printed(tab, THURINDIR, "willpower") + 2);
  });

  // With no side quest in the victory display he has his printed Willpower.
  it("17028:A:1 Thurindir: no bonus with no side quest in the victory display", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THURINDIR, seat: 0 }], victory: [LOC] });
    expect(stat(tab.state, tab, idsOf(tab, THURINDIR), "willpower")).toBe(printed(tab, THURINDIR, "willpower"));
  });
});

describe("Kahliel's Tribesman (17029:A:1)", () => {
  // Two players: the Haradrim hero and the Tribesman (both Harad) and the Pal for the first; a Harad ally for the second.
  const tribe = (effects: readonly Effect[], scene: Scene = {}): Table =>
    table(effects, { seats: 2, heroes: [{ code: HARAD, seat: 0 }, { code: PAL, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: TRIBESMAN, seat: 0 }, { code: HARAD_ALLY, seat: 1 }], ...scene });

  // "Action: Exhaust Kahliel's Tribesman to choose another Harad character. That character gets +1 Willpower, +1 Attack, and +1 Defense
  // until the end of the phase.": the Haradrim and the other player's Harad ally are offered, the Tribesman and the Pal are not; the
  // Haradrim gets +1 to each until the planning phase ends, and the Tribesman is exhausted.
  lineSpec("17029:A:1", "Kahliel's Tribesman: exhaust him to give another Harad character +1 Willpower, Attack and Defense until the end of the phase", (effects) => {
    const tab = tribe(effects);
    const [tribesman, harad] = [idsOf(tab, TRIBESMAN), idsOf(tab, HARAD)];
    expect(triggers(tab.state, tab)).toContain("17029:action:1");
    let run = send(begin(tab.state), { type: "Trigger", cardId: tribesman, effectId: "17029:action:1" }, tab.ctx);
    expect(run.state.cards[tribesman]?.exhausted).toBe(true);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([harad, idsOf(tab, HARAD_ALLY)].sort());
    run = send(run, { type: "Choose", optionId: harad }, tab.ctx);
    for (const which of ["willpower", "attack", "defense"] as const) {
      expect(stat(run.state, tab, harad, which)).toBe(printed(tab, HARAD, which) + 1);
      expect(stat(withMode(run.state, "questCommit"), tab, harad, which)).toBe(printed(tab, HARAD, which));
    }
  });

  // An exhausted Tribesman cannot pay the cost: the Action is not offered.
  it("17029:A:1 Kahliel's Tribesman: not offered while he is exhausted", () => {
    const tab = tribe(EFFECTS);
    expect(triggers(updateCard(tab.state, idsOf(tab, TRIBESMAN), { exhausted: true }), tab)).not.toContain("17029:action:1");
  });
});

describe("Steed of the North (17030:A:1, A:2)", () => {
  // "Attach to a Dunedain or Ranger hero. Restricted.": Aragorn (Dúnedain) and the Ranger hero are offered; Gimli and Son of Arnor (a
  // Dúnedain ally) are not.
  lineSpec("17030:A:1", "Steed of the North: attach to a Dúnedain or Ranger hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: RANGER, seat: 0 }, { code: GIMLI, seat: 0 }], allies: [{ code: SON, seat: 0 }], hand: [{ code: STEED, seat: 0 }] });
    const steed = idsOf(tab, STEED);
    expect(hosts(tab, steed)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, RANGER)].sort());
    expect(play(begin(tab.state), tab, steed, idsOf(tab, RANGER)).state.cards[steed]?.host).toBe(idsOf(tab, RANGER));
  });

  // The encounter phase opens on the optional engagement; Beravor holds the Steed, exhausted when `tired`.
  function engaged(effects: readonly Effect[], tired: boolean): { tab: Table; run: Run } {
    const scene = table(effects, { start: "encounter", heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: STEED, host: BERAVOR }], staging: [FAR] });
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, BERAVOR), { exhausted: tired }) };
    return { tab, run: send(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, FAR) }, tab.ctx) };
  }

  // "Response: After you engage an enemy, exhaust Steed of the North to ready attached hero.": Beravor is readied, the Steed exhausted.
  lineSpec("17030:A:2", "Steed of the North: after you engage an enemy, exhaust it to ready the attached hero", (effects) => {
    const { tab, run: engagedRun } = engaged(effects, true);
    expect(engagedRun.state.cards[idsOf(tab, FAR)]?.zone).toBe("engaged");
    expect(triggers(engagedRun.state, tab)).toContain("17030:response:1");
    const run = send(engagedRun, { type: "Trigger", cardId: idsOf(tab, STEED), effectId: "17030:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, STEED)]?.exhausted).toBe(true);
  });

  // Beravor is ready: the Ready would change nothing, so it is not offered (rr.triggered-ability).
  it("17030:A:2 Steed of the North: not offered while the attached hero is ready", () => {
    const { tab, run } = engaged(EFFECTS, false);
    expect(run.state.cards[idsOf(tab, FAR)]?.zone).toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("17030:response:1");
  });
});

describe("Mighty Warrior (17031:A:1, A:2, A:3)", () => {
  // Mighty Warrior (two copies) and Vigilant Guard in hand; Denethor and Beravor (not Warriors) and an ally; Gimli pays.
  const warrior = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [...fillers(MIGHTY, 2), { code: GUARD, seat: 0 }], playerDeck: fillers(CARD, 3) });

  // "Attach to a hero. Limit 1 per hero.": the three heroes are offered and the ally is not; once it is on Denethor, the second copy is
  // offered on Gimli and Beravor only.
  lineSpec("17031:A:1", "Mighty Warrior: attach to a hero, limit 1 per hero", (effects) => {
    const tab = warrior(effects);
    const [first = "", second = ""] = tab.ids[MIGHTY] ?? [];
    const [gimli, denethor, beravor] = [idsOf(tab, GIMLI), idsOf(tab, DENETHOR), idsOf(tab, BERAVOR)];
    expect(hosts(tab, first)).toEqual([gimli, denethor, beravor].sort());
    const run = passAll(play(begin(tab.state), tab, first, denethor), tab.ctx, { responses: true });
    expect(run.state.cards[first]?.host).toBe(denethor);
    expect(hosts(tab, second, run.state)).toEqual([gimli, beravor].sort());
  });

  // "Attached hero gains the Warrior trait.": Vigilant Guard ("Attach to a Warrior character.") may go on Gimli only; once Mighty Warrior is
  // played on Denethor, on Denethor too.
  lineSpec("17031:A:2", "Mighty Warrior: the attached hero gains the Warrior trait", (effects) => {
    const tab = warrior(effects);
    const [gimli, denethor, guard] = [idsOf(tab, GIMLI), idsOf(tab, DENETHOR), idsOf(tab, GUARD)];
    expect(hosts(tab, guard)).toEqual([gimli]);
    const run = passAll(play(begin(tab.state), tab, idsOf(tab, MIGHTY), denethor), tab.ctx, { responses: true });
    expect(hosts(tab, guard, run.state)).toEqual([gimli, denethor].sort());
  });

  // "Response: After you play Mighty Warrior from your hand, draw a card.": played on Beravor, a card is drawn.
  lineSpec("17031:A:3", "Mighty Warrior: after you play it from your hand, draw a card", (effects) => {
    const tab = warrior(effects);
    let run = play(begin(tab.state), tab, idsOf(tab, MIGHTY), idsOf(tab, BERAVOR));
    const hand = run.state.seats[0]?.hand.length ?? 0;
    expect(triggers(run.state, tab)).toContain("17031:response:1");
    run = send(run, { type: "Trigger", cardId: idsOf(tab, MIGHTY), effectId: "17031:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(hand + 1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });
});

describe("Proud Hunters (17032:A:1, A:2)", () => {
  // `heroes` for the first player; the Frail (printed threat 3) is engaged with him and `attacker` destroys it. Proud Hunters is in hand.
  function destroyed(effects: readonly Effect[], heroes: readonly string[], attacker: string, allies: readonly string[] = []): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: heroes.map((code) => ({ code, seat: 0 })), allies: allies.map((code) => ({ code, seat: 0 })), hand: [{ code: HUNTERS, seat: 0 }], engaged: [{ code: FRAIL, seat: 0 }] }, 0);
    const run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, attacker)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, FRAIL)]?.zone).not.toBe("engaged");
    return { tab, run };
  }

  // "Play only if you control a unique character with the Noble trait and another unique character with the Ranger trait.": Gimli (Noble)
  // and Beravor (Ranger) let it be played; Gimli and the Brawler do not, nor Aragorn (Noble and Ranger, but one character) with the
  // Brawler, nor Gimli with a non-unique Ranger ally.
  lineSpec("17032:A:1", "Proud Hunters: played only with a unique Noble character and another unique Ranger character", (effects) => {
    const both = destroyed(effects, [GIMLI, BERAVOR], GIMLI);
    expect(triggers(both.run.state, both.tab)).toContain("17032:response:1");
    for (const [heroes, allies] of [[[GIMLI, BRAWLER], []], [[ARAGORN, BRAWLER], []], [[GIMLI, BRAWLER], [RANGER_ALLY]]] as const) {
      const { tab, run } = destroyed(effects, heroes, BRAWLER, allies);
      expect(triggers(run.state, tab)).not.toContain("17032:response:1");
    }
  });

  // "Response: After a hero you control participates in an attack that destroys an enemy, add X resources to that hero's pool. X is the
  // just destroyed enemy's printed Threat.": Gimli destroys the Frail and gets 3 resources.
  lineSpec("17032:A:2", "Proud Hunters: the hero who destroyed an enemy gets resources equal to its printed Threat", (effects) => {
    const { tab, run: killed } = destroyed(effects, [GIMLI, BERAVOR], GIMLI);
    const [gimli, hunters] = [idsOf(tab, GIMLI), idsOf(tab, HUNTERS)];
    expect(triggers(killed.state, tab)).toContain("17032:response:1");
    const run = send(killed, { type: "Trigger", cardId: hunters, effectId: "17032:response:1", payments: payFor(killed.state, tab.ctx, hunters) }, tab.ctx);
    expect(run.state.cards[hunters]?.zone).toBe("discard");
    expect(run.state.cards[gimli]?.resources).toBe(3);
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.resources).toBe(0);
  });

  // "a hero you control participates": an ally alone destroys the Frail, and no hero gets anything: the Response is not offered.
  it("17032:A:2 Proud Hunters: not offered when only an ally attacked", () => {
    const { tab, run } = destroyed(EFFECTS, [GIMLI, BERAVOR], ALLY, [ALLY]);
    expect(triggers(run.state, tab)).not.toContain("17032:response:1");
  });
});

describe("Backtrack (17034:A:1)", () => {
  // The quest card holds 2 progress and the Loc is in the staging area; the Seer (Spirit) pays. With `keywords` the quest card is read
  // with the Battle keyword added.
  const back = (effects: readonly Effect[], keywords: boolean): Table => {
    const tab = table(effects, { heroes: [{ code: SEER, seat: 0 }], hand: [{ code: BACKTRACK, seat: 0 }], staging: [LOC], progress: 2 });
    if (!keywords) return tab;
    const stage = tab.state.questStage ? tab.state.cards[tab.state.questStage]?.code ?? "" : "";
    const cards = new Map(tab.ctx.cards);
    const card = printedOf(cards, stage);
    cards.set(stage, { ...card, keywords: { ...card.keywords, battle: true } });
    return { ...tab, ctx: { ...tab.ctx, cards } };
  };

  // "Play only if the main quest has no keywords.": with the scenario's quest card (no keywords) it may be played; with the same card given
  // the Battle keyword it may not.
  lineSpec("17034:A:1", "Backtrack: played only if the main quest has no keywords", (effects) => {
    const plain = back(effects, false);
    expect(canPlay(plain.state, plain, idsOf(plain, BACKTRACK))).toBe(true);
    const keyworded = back(effects, true);
    expect(canPlay(keyworded.state, keyworded, idsOf(keyworded, BACKTRACK))).toBe(false);
  });
});

describe("Explore Secret Ways (17036:A:1, A:2)", () => {
  // "Limit 1 copy of Explore Secret Ways in the victory display.": one copy is there; the second is played into the staging area and, once
  // it holds its 6 progress, is defeated and goes to its owner's discard pile, not the victory display.
  lineSpec("17036:A:1", "Explore Secret Ways: a second copy defeated goes to the discard pile, not the victory display", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], victory: [SECRET], hand: [{ code: SECRET, seat: 0 }] });
    // The copy in hand is placed first, then the one in the victory display.
    const [second = "", first = ""] = tab.ids[SECRET] ?? [];
    expect(tab.state.cards[first]?.zone).toBe("victory");
    const played = playCode(tab, SECRET);
    expect(played.state.cards[second]?.zone).toBe("staging");
    const run = send(begin(updateCard(played.state, second, { progress: 6 })), { type: "Pass" }, tab.ctx);
    expect(run.state.victory).toEqual([first]);
    expect(run.state.cards[second]?.zone).toBe("discard");
  });

  // "While this side quest is in the victory display, each location in the staging area with the same title as the active location does not
  // contribute its Threat to the total Threat of the staging area.": the Loc is active; of the staging area's Loc (2), Mark (2) and Far
  // (1), the Loc gives nothing: 3. With the side quest in hand, not in the victory display, the total is 5.
  lineSpec("17036:A:2", "Explore Secret Ways: in the victory display, a staging location with the active location's title gives no Threat", (effects) => {
    const shown = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], victory: [SECRET], active: LOC, staging: [LOC, MARK, FAR] });
    expect(stagingThreat(shown.state, shown.ctx.cards)).toBe(2 + 1);
    const held = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }], hand: [{ code: SECRET, seat: 0 }], active: LOC, staging: [LOC, MARK, FAR] });
    expect(stagingThreat(held.state, held.ctx.cards)).toBe(2 + 2 + 1);
  });
});

describe("Steward of Orthanc (17037:A:1)", () => {
  // Two players; `stewards` Stewards and an exhausted ally for the first player, three Ever Vigilant ("Action: Choose an exhausted ally.
  // Ready that ally.") in his hand.
  function steward(effects: readonly Effect[], stewards: number, deck = 3): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: PAL, seat: 1 }], allies: [...fillers(STEWARD, stewards), { code: ALLY, seat: 0 }], hand: fillers(VIGILANT, 3), playerDeck: fillers(CARD, deck) });
    return { ...tab, state: tired(tab.state, tab) };
  }
  const tired = (state: ScenarioState, tab: Table): ScenarioState => updateCard(state, idsOf(tab, ALLY), { exhausted: true });

  // "Response: When you play an event, give it Doomed 1 to draw a card. You cannot trigger this ability if you have already triggered the
  // ability of a Steward of Orthanc this round.": the first event is played; each player's threat rises by 1 (Doomed 1) and a card is
  // drawn. The second event that round offers neither Steward; the third, played the next round, offers them again.
  lineSpec("17037:A:1", "Steward of Orthanc: give a played event Doomed 1 to draw a card, once per round for all Stewards", (effects) => {
    const tab = steward(effects, 2);
    const [first = "", other = ""] = tab.ids[STEWARD] ?? [];
    const [one = "", two = "", three = ""] = tab.ids[VIGILANT] ?? [];
    const offered = (run: Run): string[] => legalIntents(run.state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" && intent.effectId === "17037:response:1" ? [intent.cardId] : []));
    let run = play(begin(tab.state), tab, one);
    expect(offered(run).sort()).toEqual([first, other].sort());
    run = send(run, { type: "Trigger", cardId: first, effectId: "17037:response:1" }, tab.ctx);
    // The event then resolves: the ally is readied.
    expect(run.state.cards[idsOf(tab, ALLY)]?.exhausted).toBe(false);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    expect(run.state.seats[1]?.threat).toBe(6 + 1);
    expect(run.state.seats[0]?.hand).toEqual([two, three, tab.ids[CARD]?.[0]]);
    run = play(begin(tired(run.state, tab)), tab, two);
    expect(run.state.cards[two]?.zone).toBe("discard");
    expect(offered(run)).toEqual([]);
    const next = endRound(run.state, tab).state;
    const planning = tired({ ...withMode(next, "planning"), window: { kind: "pass" as const }, activeSeat: 0, planningSeat: 0 }, tab);
    expect(planning.round).toBe(tab.state.round + 1);
    expect(offered(play(begin(planning), tab, three)).sort()).toEqual([first, other].sort());
  });

  // "give it Doomed 1": the raise is a Doomed raise, so a card that answers a threat raise from the Doomed keyword answers it: the exhausted Orthanc Guard is offered
  // its Response (rr.doomed-x) and readies.
  lineSpec("17037:A:1", "Steward of Orthanc: the threat raise it gives is a raise from the Doomed keyword", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: STEWARD, seat: 0 }, { code: ORTHANC_GUARD, seat: 0 }, { code: ALLY, seat: 0 }], hand: fillers(VIGILANT, 1), playerDeck: fillers(CARD, 3) });
    const [guard, ally] = [idsOf(scene, ORTHANC_GUARD), idsOf(scene, ALLY)];
    const tab = { ...scene, state: updateCard(updateCard(scene.state, guard, { exhausted: true }), ally, { exhausted: true }) };
    let run = play(begin(tab.state), tab, idsOf(tab, VIGILANT));
    run = send(run, { type: "Trigger", cardId: idsOf(tab, STEWARD), effectId: "17037:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe(8 + 1);
    expect(triggers(run.state, tab)).toContain("07004:response:1");
    run = send(run, { type: "Trigger", cardId: guard, effectId: "07004:response:1" }, tab.ctx);
    expect(run.state.cards[guard]?.exhausted).toBe(false);
  });

  // With the deck empty nothing can be drawn: the Response is not offered, and the event is not made Doomed for nothing (rr.triggered-ability).
  it("17037:A:1 Steward of Orthanc: not offered with an empty deck", () => {
    const tab = steward(EFFECTS, 1, 0);
    const run = play(begin(tab.state), tab, tab.ids[VIGILANT]?.[0] ?? "");
    expect(triggers(run.state, tab)).not.toContain("17037:response:1");
  });
});
