// Rules: rr.play-restrictions-and-permissions, rr.action, rr.search, rr.the-word-choose, rr.then, rr.resources (data/rules/entries.json).
// The Flight of the Stormcaller events, written from their card text (data/cards/FotS.json; data/printed holds no ledger for this pack yet):
// Vanish from Sight 12011:A:1, Heed the Dream 12009:A:1.
import { beforeAll, describe, expect } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { choices, playerTableFor, playRefusal, sendUnledgered } from "../../../test/harness/player-table.ts";

const HEED = "12009";
const VANISH = "12011";
// Core heroes: Aragorn and Glóin (Leadership), Beravor (Lore), Éowyn (Spirit).
const ARAGORN = "01001";
const GLOIN = "01003";
const EOWYN = "01007";
const BERAVOR = "01012";
const PAL = "pal";
const CARD = "card";
// A card that marks the one the search should find.
const MARK = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([HEED, VANISH, ARAGORN, GLOIN, EOWYN, BERAVOR]))]);
  base = { ...starter, cards };
});

describe("Vanish from Sight (12011:A:1)", () => {
  // "Play only if you control 2 or fewer heroes."
  lineSpec("12011:A:1", "is played with 2 heroes and not with 3", (effects) => {
    const two = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: VANISH, seat: 0 }] });
    expect(playRefusal(two.state, two, VANISH)).toBeNull();
    const three = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: GLOIN, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: VANISH, seat: 0 }] });
    expect(playRefusal(three.state, three, VANISH)).not.toBeNull();
  });
});

describe("Heed the Dream (12009:A:1)", () => {
  // "Action: Choose a player. That player searches the top 5 cards of his deck for a card, adds it to his hand, and shuffles his deck. Then, the
  // players as a group may spend 3 Leadership resources to have that player search his deck for another card, add it to his hand, and shuffle his
  // deck." Beravor (Lore) plays it; the other player is chosen. Their deck: 4 cards, a marked card fifth, a marked card sixth.
  function heed(effects: readonly Effect[]): { tab: Table; run: Run; fifth: string; sixth: string } {
    const deck = [CARD, CARD, CARD, CARD, MARK, MARK].map((code) => ({ code, seat: 1 }));
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HEED, seat: 0 }], playerDeck: deck }, 2);
    const [fifth, sixth] = tab.ids[MARK] ?? [];
    const heedId = idsOf(tab, HEED);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: heedId, payments: payFor(tab.state, tab.ctx, heedId) }, tab.ctx);
    expect(choices(run.state, tab)).toContain("seat:1");
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    // The top 5 only: the sixth card is no choice.
    expect(choices(run.state, tab)).toContain(fifth);
    expect(choices(run.state, tab)).not.toContain(sixth);
    run = sendUnledgered(run, { type: "Choose", optionId: fifth ?? "" }, tab.ctx);
    return { tab, run, fifth: fifth ?? "", sixth: sixth ?? "" };
  }

  lineSpec("12009:A:1", "the chosen player takes a card of their top 5, then another of the whole deck for 3 Leadership resources", (effects) => {
    const { tab, run: searched, fifth, sixth } = heed(effects);
    expect(searched.state.seats[1]?.hand).toEqual([fifth]);
    // Nothing goes to the hand of the player who played it (the event itself waits there while it resolves).
    expect(searched.state.seats[0]?.hand).toEqual([idsOf(tab, HEED)]);
    expect(choices(searched.state, tab).sort()).toEqual(["decline", "spend"]);
    let run = sendUnledgered(searched, { type: "Choose", optionId: "spend" }, tab.ctx);
    // The 3 Leadership resources: Aragorn holds 2, the other player's Pal (Leadership) holds 2.
    for (let guard = 0; guard < 6 && run.state.window?.kind === "choose" && !choices(run.state, tab).includes(sixth); guard += 1) {
      const offered = choices(run.state, tab);
      const aragorn = idsOf(tab, ARAGORN);
      run = sendUnledgered(run, { type: "Choose", optionId: offered.includes(aragorn) && (run.state.cards[aragorn]?.resources ?? 0) > 0 ? aragorn : (offered[0] ?? "") }, tab.ctx);
    }
    run = sendUnledgered(run, { type: "Choose", optionId: sixth }, tab.ctx);
    expect([...(run.state.seats[1]?.hand ?? [])].sort()).toEqual([fifth, sixth].sort());
    expect(run.state.seats[1]?.deck).toHaveLength(4);
    const spent = (run.state.cards[idsOf(tab, ARAGORN)]?.resources ?? 0) + (run.state.cards[idsOf(tab, PAL)]?.resources ?? 0);
    expect(spent).toBe(4 - 3);
    expect(run.state.cards[idsOf(tab, HEED)]?.zone).toBe("discard");
    // Beravor (Lore) paid the card's cost and nothing more.
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.resources).toBe(2 - 1);
  });

  lineSpec("12009:A:1", "the group may decline the 3 resources, and only one card is taken", (effects) => {
    const { tab, run: searched, fifth } = heed(effects);
    const run = sendUnledgered(searched, { type: "Choose", optionId: "decline" }, tab.ctx);
    expect(run.state.seats[1]?.hand).toEqual([fifth]);
    expect(run.state.seats[1]?.deck).toHaveLength(5);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(2);
  });

  // rr.then: the text after "Then" resolves only if the search before it resolved in full. The chosen player's deck is empty, so no card is
  // found, and the 3 Leadership resources are not asked for.
  lineSpec("12009:A:1", "does not offer the second search when the first one found no card", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HEED, seat: 0 }], playerDeck: [{ code: CARD, seat: 0 }] }, 2);
    const heedId = idsOf(tab, HEED);
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: heedId, payments: payFor(tab.state, tab.ctx, heedId) }, tab.ctx);
    run = sendUnledgered(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(choices(run.state, tab)).not.toContain("spend");
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(2);
  });
});
