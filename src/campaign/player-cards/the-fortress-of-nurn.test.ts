// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.ranged, rr.sentinel, rr.action, rr.response, rr.play-restrictions-and-permissions,
// rr.planning-phase, rr.step-3-4, rr.ready, rr.deckbuilding, rr.triggered-ability (data/rules/entries.json).
// The Fortress of Nurn player cards, written from their card text (data/cards/TFoN.json; data/printed holds no ledger for this pack, so
// the lines are the text of data/cards and every intent goes through sendUnledgered): Shining Shield 22138:A:1 and A:3, Knowledge of the
// Enemy 22139:A:1, Haleth 22140:A:1 (its failed quest; the rest is in the-fate-of-numenor.test.ts), Woodman Lore 22141:A:1, Westfold
// Lancer 22142:A:1, Tireless Thoroughbred 22143:A:2, Misty Mountain Journeyman 22144:A:1, Thorongil 22146:A:1, Bond of Friendship
// 22147:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckRulesOf } from "../../catalog/deck-rules.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withThreat } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, enter, hosts, packRow, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SHIELD = "22138";
const KNOWLEDGE = "22139";
const HALETH = "22140";
const WOODMAN_LORE = "22141";
const LANCER = "22142";
const THOROUGHBRED = "22143";
const JOURNEYMAN = "22144";
const THORONGIL = "22146";
const BOND = "22147";
// Aragorn (Fellowship sphere) and Bilbo Baggins (Baggins sphere).
const FELLOWSHIP_ARAGORN = "145001";
const BAGGINS_BILBO = "131001";
// Cards with no text: heroes of each sphere, Noble, Warrior and Woodman characters, a player attachment and an encounter card to put on
// a location, locations, enemies (non-unique and unique, Threat 0).
const LEAD = "lead";
const TAC = "tac";
const SPI = "spi";
const LORE = "lore";
const NOBLE_HERO = "noble-hero";
const NOBLE_ALLY = "noble-ally";
const WARRIOR_HERO = "warrior-hero";
const WARRIOR_ALLY = "warrior-ally";
const WOOD_HERO = "wood-hero";
const WOOD_ALLY = "wood-ally";
const WOOD_SCOUT = "wood-scout";
const SNARE = "snare";
const CONDITION = "condition";
const LOCATIONS = ["marsh", "hill", "fen", "bog"] as const;
const GRUNT = "grunt";
const BRUTE = "brute";
const BOSS = "boss";
const ALLY = "ally";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);
type Sphere = "leadership" | "tactics" | "lore" | "spirit";
const hero = (code: string, sphere: Sphere, traits: string[] = []) => definePrinted({ code, name: code, type: "hero", sphere, threat: 8, willpower: 1, attack: 1, defense: 1, health: 5, traits });
const ally = (code: string, sphere: Sphere, traits: string[]) => definePrinted({ code, name: code, type: "ally", sphere, cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits });

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SHIELD, KNOWLEDGE, HALETH, WOODMAN_LORE, LANCER, THOROUGHBRED, JOURNEYMAN, THORONGIL, BOND, FELLOWSHIP_ARAGORN, BAGGINS_BILBO]))]);
  const made = [
    hero(LEAD, "leadership"), hero(TAC, "tactics"), hero(SPI, "spirit"), hero(LORE, "lore"), hero(NOBLE_HERO, "leadership", ["Noble"]), hero(WARRIOR_HERO, "tactics", ["Warrior"]), hero(WOOD_HERO, "lore", ["Woodman"]),
    ally(NOBLE_ALLY, "leadership", ["Noble"]), ally(WARRIOR_ALLY, "tactics", ["Warrior"]), ally(WOOD_ALLY, "lore", ["Woodman"]), ally(WOOD_SCOUT, "lore", ["Woodman", "Scout"]),
  ];
  for (const card of made) cards.set(card.code, card);
  cards.set(SNARE, definePrinted({ code: SNARE, name: "Snare", type: "attachment", sphere: "lore", cost: 0 }));
  cards.set(CONDITION, definePrinted({ code: CONDITION, name: "Condition", type: "treachery", traits: ["Condition"] }));
  for (const code of LOCATIONS) cards.set(code, definePrinted({ code, name: code, type: "location", threat: 0, questPoints: 9 }));
  for (const [code, isUnique] of [[GRUNT, false], [BRUTE, false], [BOSS, true]] as const) cards.set(code, definePrinted({ code, name: code, type: "enemy", threat: 0, engagementCost: 50, attack: 1, defense: 0, health: 9, isUnique }));
  base = { ...starter, cards };
});

describe("Shining Shield (22138:A:1, A:3)", () => {
  // "Attach to a Noble hero. Limit 1 per hero.": the Noble hero is offered, the Leadership hero and the Noble ally are not; once the hero
  // holds a Shield, a second one has no host.
  lineSpec("22138:A:1", "Shining Shield: Attach to a Noble hero, one per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: NOBLE_HERO, seat: 0 }, { code: LEAD, seat: 0 }], allies: [{ code: NOBLE_ALLY, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }, { code: SHIELD, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[SHIELD] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, NOBLE_HERO)]);
    const run = play(begin(tab.state), tab, first, idsOf(tab, NOBLE_HERO));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, NOBLE_HERO));
    expect(hosts(tab, second, run.state)).toEqual([]);
  });

  // The Noble hero with the Shield for `seat`, the first seat's threat `threat` and the second's 6: the hero's Defense.
  function defense(effects: readonly Effect[], threat: number, seat = 0): number {
    const tab = table(effects, { seats: 2, heroes: [{ code: NOBLE_HERO, seat }, { code: LEAD, seat: 1 - seat }], allies: [{ code: SHIELD, seat }] });
    const shielded = attach(tab, [[idsOf(tab, SHIELD), idsOf(tab, NOBLE_HERO)]]);
    return stat(syncConstants(withThreat(shielded.state, 0, threat), tab.ctx), tab, idsOf(tab, NOBLE_HERO), "defense");
  }

  // "Attached hero gets +1 Defense (+2 Defense instead if your threat is 40 or higher).": Defense 2 at threat 39, 3 at threat 40.
  lineSpec("22138:A:3", "Shining Shield: +1 Defense, +2 instead at threat 40 or higher", (effects) => {
    expect(defense(effects, 39)).toBe(1 + 1);
    expect(defense(effects, 40)).toBe(1 + 2);
  });

  // "your threat": the second player's Shield reads that player's threat (6), not the first player's 45.
  it("22138:A:3 Shining Shield: reads its controller's threat", () => {
    expect(defense(EFFECTS, 45, 1)).toBe(1 + 1);
  });
});

describe("Knowledge of the Enemy (22139:A:1)", () => {
  // Two enemies engaged with the first player, one with the second; two copies in the first player's hand.
  function knowledge(effects: readonly Effect[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }, { code: SPI, seat: 1 }], engaged: [{ code: GRUNT, seat: 0 }, { code: BRUTE, seat: 0 }, { code: BOSS, seat: 1 }], hand: [{ code: KNOWLEDGE, seat: 0 }, { code: KNOWLEDGE, seat: 0 }] });
  }
  const playable = (tab: Table, state: Table["state"], id: string) => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);

  // "Planning Action: Choose a hero you control. Add 1 resource to its resource pool for each enemy engaged with you. You can only play 1
  // Knowledge of the Enemy each round.": the first player's two heroes are offered; the Tactics hero gets 2 (two enemies engaged with
  // him, not the other player's); the second copy cannot be played this round.
  it("22139:A:1 Knowledge of the Enemy: 1 resource for each enemy engaged with you, one copy a round", () => {
    const tab = knowledge(EFFECTS);
    const [first = "", second = ""] = tab.ids[KNOWLEDGE] ?? [];
    let run = play(begin(tab.state), tab, first);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, LEAD), idsOf(tab, TAC)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, TAC) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, TAC)]?.resources).toBe(6 + 2);
    expect(run.state.cards[idsOf(tab, LEAD)]?.resources).toBe(6);
    expect(playable(tab, run.state, second)).toBe(false);
  });

  // "Planning Action": not in the quest phase.
  it("22139:A:1 Knowledge of the Enemy: not played outside the planning phase", () => {
    const tab = knowledge(EFFECTS);
    expect(playable(tab, tab.state, tab.ids[KNOWLEDGE]?.[0] ?? "")).toBe(true);
    expect(playable(tab, enter(tab.state, tab, "questCommit").state, tab.ids[KNOWLEDGE]?.[0] ?? "")).toBe(false);
  });

  // rr.triggered-ability: with no enemy engaged with you it adds 0 resources and changes nothing.
  it("22139:A:1 Knowledge of the Enemy: not played when no enemy is engaged with you", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: SPI, seat: 1 }], engaged: [{ code: BOSS, seat: 1 }], hand: [{ code: KNOWLEDGE, seat: 0 }] });
    expect(playable(tab, tab.state, idsOf(tab, KNOWLEDGE))).toBe(false);
  });
});

// The kit lacks this: commits `cardIds` and passes every window (Pass) until `effectId` is offered or the quest phase is over.
function quest(tab: Table, cardIds: readonly string[], effectId: string) {
  let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds }, tab.ctx);
  for (let guard = 0; guard < 20 && run.state.phase === "Quest" && !triggers(run.state, tab).includes(effectId) && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
  }
  return run;
}

describe("Haleth (22140:A:1)", () => {
  // "After Haleth quests successfully": Haleth (Willpower 2) quests alone against Threat 3; the quest fails and no Response is offered.
  it("22140:A:1 Haleth: no Response when the quest fails", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: LEAD, seat: 0 }], allies: [{ code: HALETH, seat: 0 }], staging: ["f3"], deck: ["f0", "f0"], playerDeck: [{ code: SNARE, seat: 0 }, { code: CARD, seat: 0 }] });
    const run = quest(tab, [idsOf(tab, HALETH)], "22140:response:1");
    expect(run.state.phase).not.toBe("Quest");
    expect(run.state.quested).toMatchObject({ committed: [idsOf(tab, HALETH)], succeeded: [] });
    expect(triggers(run.state, tab)).not.toContain("22140:response:1");
    expect(run.state.cards[idsOf(tab, SNARE)]?.zone).toBe("deck");
  });
});

describe("Woodman Lore (22141:A:1)", () => {
  // "Action: Ready up to X Woodman characters you control, where X is the number of locations with player card attachments.": of four
  // locations, two hold a player attachment (one in the staging area, the active one), one an encounter card and one nothing: X is 2.
  // The three exhausted Woodman characters of the first player are offered (not his exhausted ally that is no Woodman, nor the second
  // player's Woodman); two are readied and the third stays exhausted.
  it("22141:A:1 Woodman Lore: readies up to X Woodman characters you control, X the locations with player card attachments", () => {
    const [marsh, hill, fen, bog] = LOCATIONS;
    const scene = table(EFFECTS, { seats: 2, heroes: [{ code: WOOD_HERO, seat: 0 }, { code: LORE, seat: 1 }], allies: [{ code: WOOD_ALLY, seat: 0 }, { code: WOOD_SCOUT, seat: 0 }, { code: ALLY, seat: 0 }, { code: WOOD_ALLY, seat: 1 }, { code: SNARE, seat: 0 }, { code: SNARE, seat: 0 }], staging: [marsh, fen, bog, CONDITION], active: hill, hand: [{ code: WOODMAN_LORE, seat: 0 }] });
    const [snareA = "", snareB = ""] = scene.ids[SNARE] ?? [];
    const tab = attach(scene, [[snareA, idsOf(scene, marsh)], [snareB, idsOf(scene, hill)], [idsOf(scene, CONDITION), idsOf(scene, bog)]]);
    const [woodHero, woodAlly, woodScout, plain, theirs] = [idsOf(tab, WOOD_HERO), idsOf(tab, WOOD_ALLY), idsOf(tab, WOOD_SCOUT), idsOf(tab, ALLY), tab.ids[WOOD_ALLY]?.[1] ?? ""];
    let state = tab.state;
    for (const id of [woodHero, woodAlly, woodScout, plain, theirs]) state = updateCard(state, id, { exhausted: true });
    let run = play(begin(state), tab, idsOf(tab, WOODMAN_LORE));
    expect(choices(run.state, tab).sort()).toEqual(["ready", "stop"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([woodHero, woodAlly, woodScout].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: woodAlly }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "ready" }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: woodHero }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect([woodHero, woodAlly, woodScout, plain, theirs].map((id) => run.state.cards[id]?.exhausted)).toEqual([false, false, true, true, true]);
    expect(run.state.cards[fen]?.attachments ?? []).toEqual([]);
  });
});

describe("Westfold Lancer (22142:A:1)", () => {
  // The Lancer (Willpower 2) quests alone; `staging` in the staging area (every enemy Threat 0), a non-unique enemy engaged; the
  // encounter deck reveals a location of Threat 0.
  function lancer(effects: readonly Effect[], staging: readonly string[]) {
    const tab = table(effects, { start: "quest", heroes: [{ code: TAC, seat: 0 }], allies: [{ code: LANCER, seat: 0 }], staging, engaged: [{ code: GRUNT, seat: 0 }], deck: ["marsh", "marsh"] });
    return { tab, run: quest(tab, [idsOf(tab, LANCER)], "22142:response:1") };
  }

  // "Response: After Westfold Lancer quests successfully, discard it to choose a non-unique enemy in the staging area. Deal 2 damage to the
  // chosen enemy.": the two non-unique enemies in the staging area are offered (not the unique one, nor the engaged one); the chosen one
  // takes 2 damage and the Lancer is in the discard pile.
  it("22142:A:1 Westfold Lancer: after it quests successfully, discard it to deal 2 damage to a non-unique enemy in the staging area", () => {
    const { tab, run } = lancer(EFFECTS, [GRUNT, BRUTE, BOSS]);
    const [staged = "", engaged = ""] = tab.ids[GRUNT] ?? [];
    expect(run.state.window?.kind).toBe("response");
    expect(triggers(run.state, tab)).toContain("22142:response:1");
    let next = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, LANCER), effectId: "22142:response:1" }, tab.ctx);
    expect(next.state.cards[idsOf(tab, LANCER)]?.zone).toBe("discard");
    expect(choices(next.state, tab).sort()).toEqual([staged, idsOf(tab, BRUTE)].sort());
    next = sendUnledgered(next, { type: "Choose", optionId: idsOf(tab, BRUTE) }, tab.ctx);
    expect([idsOf(tab, BRUTE), staged, idsOf(tab, BOSS), engaged].map((id) => next.state.cards[id]?.damage)).toEqual([2, 0, 0, 0]);
  });

  // A unique enemy alone in the staging area cannot be chosen: the Response is not offered, so the Lancer is not discarded for nothing.
  it("22142:A:1 Westfold Lancer: no Response when no non-unique enemy is in the staging area", () => {
    const { tab, run } = lancer(EFFECTS, [BOSS]);
    // The quest succeeded: the phase is over and the stage holds progress.
    expect(run.state.phase).not.toBe("Quest");
    expect(Object.values(run.state.cards).find((card) => card.zone === "questStage")?.progress).toBeGreaterThan(0);
    expect(triggers(run.state, tab)).not.toContain("22142:response:1");
  });
});

describe("Tireless Thoroughbred (22143:A:2)", () => {
  // "Attach to a Warrior character. Restricted. Attached character gains ranged and sentinel.": the Warrior hero and the Warrior ally are
  // offered, the Tactics hero is not; the Warrior hero it is played on has ranged and sentinel in the state that play returns.
  lineSpec("22143:A:2", "Tireless Thoroughbred: Attach to a Warrior character, who gains ranged and sentinel", (effects) => {
    const tab = table(effects, { heroes: [{ code: WARRIOR_HERO, seat: 0 }, { code: TAC, seat: 0 }], allies: [{ code: WARRIOR_ALLY, seat: 0 }], hand: [{ code: THOROUGHBRED, seat: 0 }] });
    const [horse, warrior] = [idsOf(tab, THOROUGHBRED), idsOf(tab, WARRIOR_HERO)];
    expect(hosts(tab, horse)).toEqual([warrior, idsOf(tab, WARRIOR_ALLY)].sort());
    expect(hasKeyword(tab.state, warrior, "ranged", tab.ctx.cards)).toBe(false);
    const run = play(begin(tab.state), tab, horse, warrior);
    expect(run.state.cards[horse]?.host).toBe(warrior);
    expect(hasKeyword(run.state, warrior, "ranged", tab.ctx.cards)).toBe(true);
    expect(hasKeyword(run.state, warrior, "sentinel", tab.ctx.cards)).toBe(true);
    expect(hasKeyword(run.state, idsOf(tab, TAC), "ranged", tab.ctx.cards)).toBe(false);
  });
});

describe("Misty Mountain Journeyman (22144:A:1)", () => {
  // Is the Journeyman in the first player's hand offered for play, with `engaged` engaged?
  function playable(effects: readonly Effect[], engaged: readonly { code: string; seat: number }[]): boolean {
    const tab = table(effects, { seats: 2, heroes: [{ code: SPI, seat: 0 }, { code: LEAD, seat: 1 }], engaged, hand: [{ code: JOURNEYMAN, seat: 0 }] });
    return legalIntents(tab.state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idsOf(tab, JOURNEYMAN));
  }

  // "You cannot play Misty Mountain Journeyman from your hand unless you are engaged with an enemy.": not offered with no enemy engaged,
  // offered with one engaged with the first player.
  lineSpec("22144:A:1", "Misty Mountain Journeyman: played from the hand only while you are engaged with an enemy", (effects) => {
    expect(playable(effects, [])).toBe(false);
    expect(playable(effects, [{ code: GRUNT, seat: 0 }])).toBe(true);
  });

  // "you are engaged": an enemy engaged with the other player does not allow it.
  it("22144:A:1 Misty Mountain Journeyman: an enemy engaged with another player does not count", () => {
    expect(playable(EFFECTS, [{ code: GRUNT, seat: 1 }])).toBe(false);
  });
});

describe("Thorongil (22146:A:1)", () => {
  // "Attach to a non-Fellowship, non-Baggins hero you control.": the first player's Leadership and Tactics heroes are offered; his
  // Fellowship Aragorn and Baggins Bilbo, the second player's hero and an ally are not.
  lineSpec("22146:A:1", "Thorongil: Attach to a non-Fellowship, non-Baggins hero you control", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEAD, seat: 0 }, { code: TAC, seat: 0 }, { code: FELLOWSHIP_ARAGORN, seat: 0 }, { code: BAGGINS_BILBO, seat: 0 }, { code: LORE, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: THORONGIL, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, THORONGIL))).toEqual([idsOf(tab, LEAD), idsOf(tab, TAC)].sort());
  });
});

describe("Bond of Friendship (22147:A:1, A:2)", () => {
  // The deck-save facts: the contract, five heroes (h1 to h4 of the four spheres, h5 a second Leadership hero) and 25 titles of each
  // sphere and neutral ("leadership-0" ...), each with a deck limit of 3.
  const SPHERES = ["leadership", "lore", "spirit", "tactics", "neutral"] as const;
  const facts = (): Map<string, DeckSaveCard> => {
    const row = packRow("TFoN", BOND);
    const fact = (name: string, typeCode: string, sphereCode: string | null, deckLimit: number | null): DeckSaveCard => ({ name, typeCode, sphereCode, deckLimit, deckLegal: true, traits: null });
    const all = new Map<string, DeckSaveCard>([[BOND, fact(row?.name ?? "", row?.type ?? "", row?.sphere ?? null, row?.deckLimit ?? null)]]);
    for (const [index, sphere] of ["leadership", "lore", "spirit", "tactics", "leadership"].entries()) all.set(`h${index + 1}`, fact(`Hero ${index + 1}`, "hero", sphere, null));
    for (const sphere of SPHERES) for (let index = 0; index < 25; index += 1) all.set(`${sphere}-${index}`, fact(`${sphere} ${index}`, "event", sphere, 3));
    return all;
  };
  // A deck of `counts[sphere]` cards of each sphere, 2 copies of each title (a last single copy for an odd count), and the contract.
  const deck = (counts: Partial<Record<(typeof SPHERES)[number], number>>) => [
    { code: BOND, count: 1 },
    ...SPHERES.flatMap((sphere) => {
      const count = counts[sphere] ?? 0;
      return Array.from({ length: Math.ceil(count / 2) }, (_, index) => ({ code: `${sphere}-${index}`, count: Math.min(2, count - index * 2) }));
    }),
  ];
  const legal = { leadership: 10, lore: 10, spirit: 10, tactics: 10, neutral: 10 };
  const heroes = ["h1", "h2", "h3"];

  // "Your deck must be exactly 50 players cards and include exactly 10 cards from each of these four spheres: Leadership, Lore, Spirit, and
  // Tactics. You cannot include more than 2 copies of any card by title in your deck.": 10 of each sphere and 10 neutral saves; 51 cards,
  // 9 Leadership and 11 neutral, and a title of 3 copies are each refused (and each saves without the contract's rules).
  lineSpec("22147:A:1", "Bond of Friendship: exactly 50 cards, 10 of each sphere, at most 2 copies of a title", (effects) => {
    const rules = deckRulesOf(effects, [BOND]);
    const triple = [...deck({ ...legal, neutral: 0 }), { code: "neutral-0", count: 3 }, { code: "neutral-1", count: 3 }, { code: "neutral-2", count: 2 }, { code: "neutral-3", count: 2 }];
    const wrong = [deck({ ...legal, neutral: 11 }), deck({ ...legal, leadership: 9, neutral: 11 }), triple];
    expect(deckSaveRefusal(heroes, deck(legal), facts(), [], rules)).toBeNull();
    for (const cards of wrong) {
      expect(deckSaveRefusal(heroes, cards, facts())).toBeNull();
      expect(deckSaveRefusal(heroes, cards, facts(), [], rules)).not.toBeNull();
    }
  });

  // "When choosing your starting heroes, you may choose 4 heroes instead of 3. Each of your heroes must belong to a different sphere.": 4
  // heroes of the four spheres save; 4 with two Leadership heroes, and 3 with two Leadership heroes, are refused.
  lineSpec("22147:A:2", "Bond of Friendship: 4 starting heroes, each of a different sphere", (effects) => {
    const rules = deckRulesOf(effects, [BOND]);
    expect(deckSaveRefusal(["h1", "h2", "h3", "h4"], deck(legal), facts(), [], rules)).toBeNull();
    expect(deckSaveRefusal(["h1", "h2", "h3", "h5"], deck(legal), facts(), [], rules)).not.toBeNull();
    expect(deckSaveRefusal(["h1", "h2", "h5"], deck(legal), facts(), [], rules)).not.toBeNull();
  });
});
