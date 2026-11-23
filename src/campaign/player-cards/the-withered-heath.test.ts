// Rules: rr.action, rr.response, rr.play-and-put-into-play, rr.enters-play, rr.search, rr.modifiers, rr.lasting-effects, rr.step-6-4-1,
// rr.step-6-8-2 (data/rules/entries.json).
// The Withered Heath allies and event, written from their card text (data/cards/TWH.json; data/printed holds no ledger for these cards
// yet): Beorning Skin-changer 19004:A:1, Beorn's Rage 19005:A:1, Long Lake Fisherman 19008:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode } from "../../rules/core/state.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { attacking, combat, discarded, passAll, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SKIN_CHANGER = "19004";
const RAGE = "19005";
const FISHERMAN = "19008";
// Giant Bear: a Beorning ally of printed cost 5.
const BEAR = "19061";
// A Beorning ally of printed cost 3 with no text; an ally of cost 4 that is not a Beorning; a card of printed cost 2.
const GUARDIAN = "guardian";
const BRUTE = "brute";
const TWO = "two";
// A Tactics hero and a Spirit hero with no text, to pay.
const TACTICIAN = "tactician";
const SPIRIT = "spirit-hero";
const ALLY = "ally";
// An enemy whose Attack and Defense can be read: engaged, it attacks; it survives every attack here.
const BRUTISH = "brutish";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SKIN_CHANGER, RAGE, FISHERMAN, BEAR]))]);
  cards.set(GUARDIAN, definePrinted({ code: GUARDIAN, name: "Guardian", type: "ally", sphere: "tactics", cost: 3, traits: ["Beorning"], willpower: 1, attack: 2, defense: 2, health: 3 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "ally", sphere: "tactics", cost: 4, willpower: 1, attack: 2, defense: 2, health: 3 }));
  cards.set(TWO, definePrinted({ code: TWO, name: "Two", type: "event", sphere: "spirit", cost: 2 }));
  cards.set(TACTICIAN, definePrinted({ code: TACTICIAN, name: "Tactician", type: "hero", sphere: "tactics", threat: 9, willpower: 1, attack: 2, defense: 2, health: 4 }));
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 9, willpower: 2, attack: 1, defense: 1, health: 4 }));
  cards.set(BRUTISH, definePrinted({ code: BRUTISH, name: "Brutish", type: "enemy", threat: 1, engagementCost: 40, attack: 4, defense: 3, health: 20 }));
  base = { ...starter, cards };
});

describe("Beorning Skin-changer (19004:A:1)", () => {
  // The Skin-changer in play; in hand Giant Bear (Beorning, cost 5), a second Skin-changer (Beorning, cost 2) and the Brute (cost 4, not a
  // Beorning); in the discard pile the Guardian (Beorning, cost 3) and another Brute.
  function scene(effects: readonly Effect[]): { tab: Table; guardian: string; brute: string } {
    const start = table(effects, { heroes: [{ code: TACTICIAN, seat: 0 }], allies: [{ code: SKIN_CHANGER, seat: 0 }], hand: [{ code: BEAR, seat: 0 }, { code: SKIN_CHANGER, seat: 0 }, { code: BRUTE, seat: 0 }], engaged: [{ code: BRUTISH, seat: 0 }] });
    const { tab, ids: [guardian = "", brute = ""] } = discarded(start, [[GUARDIAN, 0], [BRUTE, 0]]);
    return { tab, guardian, brute };
  }
  const changer = (tab: Table) => tab.ids[SKIN_CHANGER]?.find((id) => tab.state.cards[id]?.zone === "play") ?? "";

  // "Combat Action: Choose a Beorning ally with printed cost 3 or more in your hand or discard pile. Discard Beorning Skin-changer to put
  // that ally into play.": from the hand only Giant Bear is offered; the Skin-changer is discarded and the Bear comes into play.
  lineSpec("19004:A:1", "discards itself to put a Beorning ally of cost 3 or more from the hand into play", (effects) => {
    const { tab } = scene(effects);
    const skin = changer(tab);
    const bear = idsOf(tab, BEAR);
    let run = combat(tab.state, tab);
    expect(triggers(run.state, tab)).toContain("19004:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: skin, effectId: "19004:action:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[skin]?.zone).toBe("discard");
    expect(run.state.cards[bear]).toMatchObject({ zone: "play", controller: 0 });
  });

  // "... or discard pile": the Guardian (cost 3) from the discard pile; the Brute there is not a Beorning and stays.
  lineSpec("19004:A:1", "discards itself to put a Beorning ally of cost 3 or more from the discard pile into play", (effects) => {
    const { tab, guardian, brute } = scene(effects);
    const skin = changer(tab);
    let run = combat(tab.state, tab);
    expect(triggers(run.state, tab)).toContain("19004:action:2");
    run = sendUnledgered(run, { type: "Trigger", cardId: skin, effectId: "19004:action:2" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[skin]?.zone).toBe("discard");
    expect(run.state.cards[guardian]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[brute]?.zone).toBe("discard");
  });

  // "Combat Action": not in the planning phase; and with only a Beorning of cost 2 and the Brute to choose, it is not offered (the
  // Skin-changer is not discarded for nothing).
  it("19004:A:1 is offered only in the combat phase, with a Beorning ally of cost 3 or more to choose", () => {
    const { tab } = scene(EFFECTS);
    expect(triggers(tab.state, tab).filter((id) => id.startsWith("19004:"))).toEqual([]);
    const none = table(EFFECTS, { heroes: [{ code: TACTICIAN, seat: 0 }], allies: [{ code: SKIN_CHANGER, seat: 0 }], hand: [{ code: SKIN_CHANGER, seat: 0 }, { code: BRUTE, seat: 0 }], engaged: [{ code: BRUTISH, seat: 0 }] });
    expect(triggers(combat(none.state, none).state, none).filter((id) => id.startsWith("19004:"))).toEqual([]);
  });
});

describe("Beorn's Rage (19005:A:1)", () => {
  function scene(effects: readonly Effect[]): Table {
    return table(effects, { heroes: [{ code: TACTICIAN, seat: 0 }], allies: [{ code: SKIN_CHANGER, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: RAGE, seat: 0 }], engaged: [{ code: BRUTISH, seat: 0 }] });
  }
  const printed = (tab: Table, which: "attack" | "defense") => tab.ctx.cards.get(BRUTISH)?.[which] ?? 0;

  // "Response: After a Beorning character is declared as an attacker ... against an enemy, that enemy gets -2 Attack and -2 Defense until
  // the end of the phase.": the Skin-changer attacks the Brutish enemy; Beorn's Rage is paid and the enemy has -2 Attack and -2 Defense
  // until the combat phase ends.
  lineSpec("19005:A:1", "after a Beorning attacker is declared, the enemy gets -2 Attack and -2 Defense until the end of the phase", (effects) => {
    const tab = scene(effects);
    const enemy = idsOf(tab, BRUTISH);
    const rage = idsOf(tab, RAGE);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: enemy, attackerIds: [idsOf(tab, SKIN_CHANGER)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("19005:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: rage, effectId: "19005:response:1", payments: payFor(run.state, tab.ctx, rage) }, tab.ctx);
    expect(stat(run.state, tab, enemy, "attack")).toBe(printed(tab, "attack") - 2);
    expect(stat(run.state, tab, enemy, "defense")).toBe(printed(tab, "defense") - 2);
    expect(run.state.cards[rage]?.zone).toBe("discard");
    const later = withMode(run.state, "refresh");
    expect(stat(later, tab, enemy, "attack")).toBe(printed(tab, "attack"));
    expect(stat(later, tab, enemy, "defense")).toBe(printed(tab, "defense"));
  });

  // "... or defender ...": the Skin-changer defends the enemy's attack.
  lineSpec("19005:A:1", "after a Beorning defender is declared, the enemy gets -2 Attack and -2 Defense", (effects) => {
    const tab = scene(effects);
    const enemy = idsOf(tab, BRUTISH);
    const rage = idsOf(tab, RAGE);
    let run = passAll(combat(tab.state, tab), tab.ctx, { responses: true });
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, SKIN_CHANGER) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("19005:response:2");
    run = sendUnledgered(run, { type: "Trigger", cardId: rage, effectId: "19005:response:2", payments: payFor(run.state, tab.ctx, rage) }, tab.ctx);
    expect(stat(run.state, tab, enemy, "attack")).toBe(printed(tab, "attack") - 2);
    expect(stat(run.state, tab, enemy, "defense")).toBe(printed(tab, "defense") - 2);
  });

  // A character that is not a Beorning, attacking or defending, gives no Response.
  it("19005:A:1 is not offered for a character that is not a Beorning", () => {
    const tab = scene(EFFECTS);
    const enemy = idsOf(tab, BRUTISH);
    const attack = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: enemy, attackerIds: [idsOf(tab, ALLY)] }, tab.ctx);
    expect(triggers(attack.state, tab).filter((id) => id.startsWith("19005:"))).toEqual([]);
    const defense = sendUnledgered(passAll(combat(tab.state, tab), tab.ctx, { responses: true }), { type: "DeclareDefender", defenderId: idsOf(tab, ALLY) }, tab.ctx);
    expect(triggers(defense.state, tab).filter((id) => id.startsWith("19005:"))).toEqual([]);
  });
});

describe("Long Lake Fisherman (19008:A:1)", () => {
  // "Response: After Long Lake Fisherman enters play, name a number. Then, search the top 5 cards of your deck for a card whose printed
  // cost is equal to that number and add it to your hand. Shuffle your deck.": the player names 2; of the top 5 (costs 0, 1, 2, 0, 1) only
  // the card of cost 2 is offered (not the one of cost 2 sixth); it goes to the hand and the deck is shuffled.
  lineSpec("19008:A:1", "names a number and takes a card of that printed cost from the top 5 cards, then shuffles", (effects) => {
    const deck = ["card", ALLY, TWO, "card", ALLY, TWO].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: SPIRIT, seat: 0 }], hand: [{ code: FISHERMAN, seat: 0 }], playerDeck: deck });
    const fisherman = idsOf(tab, FISHERMAN);
    const [two, sixth] = tab.ids[TWO] ?? [];
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: fisherman, payments: payFor(tab.state, tab.ctx, fisherman) }, tab.ctx);
    const cursor = run.state.seedCursor;
    expect(triggers(run.state, tab)).toContain("19008:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: fisherman, effectId: "19008:response:1" }, tab.ctx);
    // The number is named among 0 to 6 (the options x0 to x6).
    run = sendUnledgered(run, { type: "Choose", optionId: "x2" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[two ?? ""]?.zone).toBe("hand");
    expect(run.state.cards[sixth ?? ""]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(5);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});
