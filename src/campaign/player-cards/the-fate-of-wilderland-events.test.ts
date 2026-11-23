// Rules: rr.action, rr.search, rr.play-and-put-into-play, rr.the-letter-x, rr.resource-match, rr.unique-cards, wor.guarded-x
// (data/rules/entries.json).
// The Fate of Wilderland events, each printed line tested from the words on the card (data/cards/TFoW.json: data/printed holds no
// ledger entry for these cards, so the lines are the text of data/cards): The King's Return 19147:A:1, The Great Hunt 19149:A:1 and
// A:2, Gwaihir's Debt 19151:A:1 and A:2, Reforged 19153:A:1.
import { beforeAll, describe, expect } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, discarded, endRound, play, playerTableFor, sendUnledgered } from "../../../test/harness/player-table.ts";

const ARAGORN = "01001";
const GIMLI = "01004";
const EOWYN = "01007";
const DENETHOR = "01010";
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const BLADE = "01039";
const PLATE = "01040";
const HORN = "01042";
const GANDALF = "01073";
const LANDROVAL = "02053";
const NECKLACE = "18011";
// A treachery and a location of scenario 1's encounter deck, for the Mithril Shirt's guard.
const CRAWLING = "141041";
const GREEN_HILL = "141036";
const RADAGAST = "19145";
const RETURN = "19147";
const HUNT = "19149";
const DEBT = "19151";
const SHIRT = "19152";
const REFORGED = "19153";
// Stand-ins with no text: a Tactics Creature Eagle ally, a non-Item attachment of cost 1, a unique enemy and a plain one.
const HAWK = "hawk";
const RELIC = "relic";
const CHIEF = "chief";
const BRUTE = "brute";
const CHEAP = "cheap";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, GIMLI, EOWYN, DENETHOR, GLORFINDEL, BERAVOR, BLADE, PLATE, HORN, GANDALF, LANDROVAL, NECKLACE, CRAWLING, GREEN_HILL, RADAGAST, RETURN, HUNT, DEBT, SHIRT, REFORGED];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(HAWK, definePrinted({ code: HAWK, name: "Hawk", type: "ally", traits: ["Creature", "Eagle"], sphere: "tactics", cost: 2, willpower: 1, attack: 1, defense: 1, health: 1 }));
  cards.set(RELIC, definePrinted({ code: RELIC, name: "Relic", type: "attachment", traits: ["Title"], sphere: "spirit", cost: 1 }));
  cards.set(CHIEF, definePrinted({ code: CHIEF, name: "Chief", type: "enemy", isUnique: true, threat: 1, engagementCost: 40, attack: 1, defense: 1, health: 3 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 3, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

function playable(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));
}

describe("The King's Return (19147:A:1)", () => {
  // "Action: Search your deck for a Guarded attachment and put it into play. Shuffle your deck.": the Mithril Shirt (Guarded) is a
  // choice and Citadel Plate is not; put into play, it resolves its guard (wor.guarded-x): the location from the encounter deck goes to
  // the staging area with the Shirt attached.
  lineSpec("19147:A:1", "The King's Return: a Guarded attachment from your deck into play, then shuffle", (effects) => {
    const deck = [{ code: PLATE, seat: 0 }, { code: "card", seat: 0 }, { code: SHIRT, seat: 0 }, { code: NECKLACE, seat: 0 }];
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: RETURN, seat: 0 }], playerDeck: deck, deck: [CRAWLING, GREEN_HILL] });
    const [shirt, location] = [idsOf(tab, SHIRT), idsOf(tab, GREEN_HILL)];
    const cursor = tab.state.seedCursor;
    let run = play(begin(tab.state), tab, idsOf(tab, RETURN));
    expect(choices(run.state, tab).sort()).toEqual([shirt, idsOf(tab, NECKLACE)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: shirt }, tab.ctx);
    expect(run.state.cards[location]?.zone).toBe("staging");
    expect(run.state.cards[shirt]?.host).toBe(location);
    expect(run.state.cards[idsOf(tab, PLATE)]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(3);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("The Great Hunt (19149)", () => {
  const hunt = (effects: readonly Effect[]): Table => table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: GLORFINDEL, seat: 0 }, { code: BERAVOR, seat: 0 }], staging: [BRUTE, CHIEF], engaged: [{ code: CHEAP, seat: 0 }], hand: [{ code: HUNT, seat: 0 }] });

  // "You must use resources from 3 different heroes' pools to pay for this card.": 3 resources from 2 heroes are refused, 1 from each
  // of 3 heroes are taken.
  lineSpec("19149:A:1", "The Great Hunt: paid from 3 different heroes' pools", (effects) => {
    const tab = hunt(effects);
    const run = combat(tab.state, tab);
    const [denethor, glorfindel, beravor] = [DENETHOR, GLORFINDEL, BERAVOR].map((code) => idsOf(tab, code));
    const card = idsOf(tab, HUNT);
    expect(refusal(run.state, { type: "PlayCard", cardId: card, payments: [{ heroId: denethor ?? "", amount: 2 }, { heroId: glorfindel ?? "", amount: 1 }] }, tab.ctx)).not.toBeNull();
    const paid = sendUnledgered(run, { type: "PlayCard", cardId: card, payments: [denethor, glorfindel, beravor].map((heroId) => ({ heroId: heroId ?? "", amount: 1 })) }, tab.ctx);
    expect([denethor, glorfindel, beravor].map((id) => paid.state.cards[id ?? ""]?.resources)).toEqual([5, 5, 5]);
  });

  // "Combat Action: Choose and discard a non-unique enemy in the staging area.": the Brute is the one choice; the unique Chief and the
  // enemy engaged with the player are not. The card is not played in the planning phase.
  lineSpec("19149:A:2", "The Great Hunt: discard a non-unique enemy in the staging area, in the combat phase", (effects) => {
    const tab = hunt(effects);
    expect(playable(tab.state, tab)).not.toContain(idsOf(tab, HUNT));
    const payments = [DENETHOR, GLORFINDEL, BERAVOR].map((code) => ({ heroId: idsOf(tab, code), amount: 1 }));
    let run = sendUnledgered(combat(tab.state, tab), { type: "PlayCard", cardId: idsOf(tab, HUNT), payments }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, BRUTE)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idsOf(tab, CHIEF)]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, CHEAP)]?.zone).toBe("engaged");
  });
});

describe("Gwaihir's Debt (19151)", () => {
  // "Play only if you control a unique character with the Istari trait and another unique character with the Eagle trait.": Gandalf
  // (unique Istari) and Landroval (unique Eagle) allow it; Gandalf with the Hawk (a non-unique Eagle), or Landroval alone, do not.
  lineSpec("19151:A:1", "Gwaihir's Debt: played only with a unique Istari and a unique Eagle character", (effects) => {
    const can = (allies: readonly string[]): boolean => {
      const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: allies.map((code) => ({ code, seat: 0 })), hand: [{ code: DEBT, seat: 0 }] });
      return playable(tab.state, tab).includes(idsOf(tab, DEBT));
    };
    expect(can([GANDALF, LANDROVAL])).toBe(true);
    expect(can([GANDALF, HAWK])).toBe(false);
    expect(can([LANDROVAL])).toBe(false);
  });

  // "Action: Search the top 5 cards of your deck for an Eagle or Istari ally and put it into play. Shuffle your deck. At the end of the
  // round, if that ally is still in play, return it to your hand.": Radagast (Istari hero) and Landroval in play; the deck holds the Hawk
  // (Eagle) second, a plain ally third, Gandalf (Istari) fourth and a second Hawk sixth.
  lineSpec("19151:A:2", "Gwaihir's Debt: an Eagle or Istari ally from the top 5 into play, back to the hand at the end of the round", (effects) => {
    const deck = [{ code: "card", seat: 0 }, { code: HAWK, seat: 0 }, { code: ALLY, seat: 0 }, { code: GANDALF, seat: 0 }, { code: "card", seat: 0 }, { code: HAWK, seat: 0 }];
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: RADAGAST, seat: 0 }], allies: [{ code: LANDROVAL, seat: 0 }], hand: [{ code: DEBT, seat: 0 }], playerDeck: deck });
    const [hawk, deeper] = tab.ids[HAWK] ?? [];
    const gandalf = idsOf(tab, GANDALF);
    const cursor = tab.state.seedCursor;
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, DEBT), payments: [{ heroId: idsOf(tab, GIMLI), amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([hawk, gandalf].sort());
    expect(choices(run.state, tab)).not.toContain(deeper);
    run = sendUnledgered(run, { type: "Choose", optionId: hawk ?? "" }, tab.ctx);
    expect(run.state.cards[hawk ?? ""]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.seats[0]?.deck).toHaveLength(5);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
    expect(endRound(run.state, tab).state.cards[hawk ?? ""]?.zone).toBe("hand");
  });
});

describe("Reforged (19153:A:1)", () => {
  // "Action: Choose an Item attachment with a printed cost of X in any player's discard pile and play that attachment for no cost. (The
  // chosen attachment can belong to any sphere of influence.)": X is 1. Horn of Gondor (Tactics Item, cost 1) in your discard pile and
  // Blade of Gondolin (Tactics Item, cost 1) in the other player's are choices; Citadel Plate (Item, cost 4) and the Relic (cost 1, not
  // an Item) are not. Éowyn (Spirit) pays the 1 and nothing more for the Blade.
  lineSpec("19153:A:1", "Reforged: play an Item attachment of printed cost X from any discard pile for no cost", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: REFORGED, seat: 0 }] }, 1);
    const { tab, ids } = discarded(scene, [[HORN, 0], [PLATE, 0], [RELIC, 0], [BLADE, 1]]);
    const [horn, , , blade] = ids;
    const eowyn = idsOf(tab, EOWYN);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, REFORGED), payments: [{ heroId: eowyn, amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([horn, blade].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: blade ?? "" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = sendUnledgered(run, { type: "Choose", optionId: eowyn }, tab.ctx);
    expect(run.state.cards[blade ?? ""]).toMatchObject({ zone: "play", host: eowyn });
    expect(run.state.cards[eowyn]?.resources).toBe(0);
  });
});
