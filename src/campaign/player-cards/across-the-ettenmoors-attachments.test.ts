// Rules: rr.attachment-cards, rr.location-cards, rr.explored, rr.first-player, rr.response, rr.restricted, rr.quest-phase, rr.active-location,
// rr.cost (data/rules/entries.json).
// The Across the Ettenmoors attachments, written from their card text (data/cards/AtE.json; data/printed holds no ledger for this pack, so
// every intent goes through sendUnledgered): Ranger Provisions 10055:A:1 and A:2, Steed of Imladris 10059:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { attach, fillers, hosts, passAll, play, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const PROVISIONS = "10055";
const STEED = "10059";
// Core heroes: Aragorn (Leadership), Legolas (Tactics, Silvan), Éowyn (Spirit, Rohan). Erestor: a Lore Noldor hero. Trollshaw Scout: a
// Noldor ally.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const ERESTOR = "10084";
const SCOUT = "04104";
const LOC = "loc";
const SMALL = "small";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([PROVISIONS, STEED, ARAGORN, LEGOLAS, EOWYN, ERESTOR, SCOUT]))]);
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 0, questPoints: 9 }));
  cards.set(SMALL, definePrinted({ code: SMALL, name: "Small", type: "location", threat: 0, questPoints: 1 }));
  base = { ...starter, cards };
});

describe("Ranger Provisions (10055:A:1, A:2)", () => {
  // "Attach to a location. Limit 1 per location.": the active location and a location in the staging area are offered, Aragorn is not;
  // once a copy is on the active location, only the other location is offered for the second copy. Aragorn (Leadership) pays 1.
  lineSpec("10055:A:1", "Ranger Provisions: Attach to a location, 1 per location", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], active: LOC, staging: [LOC], hand: [{ code: PROVISIONS, seat: 0 }, { code: PROVISIONS, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[PROVISIONS] ?? [];
    const [staged = "", active = ""] = tab.ids[LOC] ?? [];
    expect(hosts(tab, first)).toEqual([active, staged].sort());
    const run = play(begin(tab.state), tab, first, active);
    expect(run.state.cards[first]?.host).toBe(active);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(6 - 1);
    expect(hosts(tab, second, run.state)).toEqual([staged]);
  });

  // Two players; the second controls the Provisions on the active location (`small`, 1 quest point, or one of 9). The first player
  // commits Aragorn; the quest succeeds and its progress goes to the active location.
  function provisions(effects: readonly Effect[], active: string): { tab: Table; provisions: string; location: string } {
    const scene = table(effects, { seats: 2, start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: PROVISIONS, seat: 1 }], active, deck: ["f0", "f0"] }, 0);
    const location = idsOf(scene, active);
    return { tab: attach(scene, [[idsOf(scene, PROVISIONS), location]]), provisions: idsOf(scene, PROVISIONS), location };
  }
  const quested = (tab: Table) => {
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, ARAGORN)] }, tab.ctx);
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    // The second player commits nothing.
    return sendUnledgered(run, { type: "Pass" }, tab.ctx);
  };

  // "Response: After attached location is explored, the first player adds 1 resource to each of his heroes' resource pools.": the quest
  // explores the location; its controller (the second player) triggers the Response, and each of the first player's heroes gets 1
  // resource. The second player's hero gets none.
  lineSpec("10055:A:2", "Ranger Provisions: after its location is explored, each of the first player's heroes gets 1 resource", (effects) => {
    const { tab, provisions: card, location } = provisions(effects, SMALL);
    let run = quested(tab);
    run = passAll(run, tab.ctx);
    expect(run.state.cards[location]?.zone).toBe("encounterDiscard");
    expect(run.state.window).toEqual({ kind: "response", seat: 1 });
    expect(triggers(run.state, tab)).toContain("10055:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "10055:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(1);
    expect(run.state.cards[idsOf(tab, LEGOLAS)]?.resources).toBe(1);
    expect(run.state.cards[idsOf(tab, PAL)]?.resources).toBe(0);
  });

  // The location is not explored (1 progress of 9): no Response.
  it("10055:A:2 Ranger Provisions: not offered while its location is not explored", () => {
    const { tab, location } = provisions(EFFECTS, LOC);
    const run = passAll(quested(tab), tab.ctx);
    expect(run.state.cards[location]?.zone).toBe("activeLocation");
    for (const seat of [0, 1]) expect(triggers({ ...run.state, activeSeat: seat }, tab)).not.toContain("10055:response:1");
  });
});

describe("Steed of Imladris (10059:A:1, A:2)", () => {
  // "Attach to a Spirit or Noldor hero. Restricted.": Éowyn (Spirit) and Erestor (Noldor) are offered; Legolas (neither) and the Trollshaw
  // Scout (a Noldor ally) are not. It has the restricted keyword. Éowyn (Spirit) pays.
  lineSpec("10059:A:1", "Steed of Imladris: Attach to a Spirit or Noldor hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ERESTOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: SCOUT, seat: 0 }], hand: [{ code: STEED, seat: 0 }] });
    const steed = idsOf(tab, STEED);
    expect(hosts(tab, steed)).toEqual([idsOf(tab, EOWYN), idsOf(tab, ERESTOR)].sort());
    const run = play(begin(tab.state), tab, steed, idsOf(tab, ERESTOR));
    expect(run.state.cards[steed]?.host).toBe(idsOf(tab, ERESTOR));
    expect(hasKeyword(run.state, steed, "restricted", tab.ctx.cards)).toBe(true);
  });

  // Éowyn with the Steed, Legolas beside her, `hand` cards in hand, the active location given (or none).
  function steed(effects: readonly Effect[], hand: number, active?: string): Table {
    return table(effects, { start: "quest", heroes: [{ code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: STEED, host: EOWYN }], hand: fillers(CARD, hand), ...(active ? { active } : {}), deck: ["f0", "f0"] });
  }

  // "Response: After attached hero commits to a quest, discard a card from your hand to place 2 progress on the active location.": Éowyn
  // commits; the card in hand is discarded and the active location gets 2 progress, before the quest resolves.
  lineSpec("10059:A:2", "Steed of Imladris: after the hero commits, discard a card to place 2 progress on the active location", (effects) => {
    const tab = steed(effects, 1, LOC);
    const [location, card] = [idsOf(tab, LOC), idsOf(tab, CARD)];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EOWYN)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("10059:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, STEED), effectId: "10059:response:1" }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("discard");
    expect(run.state.cards[location]?.progress).toBe(2);
  });

  // Legolas commits, not the attached hero: no Response.
  it("10059:A:2 Steed of Imladris: not offered when another hero commits", () => {
    const tab = steed(EFFECTS, 1, LOC);
    expect(triggers(sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, LEGOLAS)] }, tab.ctx).state, tab)).not.toContain("10059:response:1");
  });

  // No card in hand (the cost) or no active location (no effect): not offered.
  it("10059:A:2 Steed of Imladris: not offered with an empty hand or with no active location", () => {
    for (const tab of [steed(EFFECTS, 0, LOC), steed(EFFECTS, 1)]) {
      expect(triggers(sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, EOWYN)] }, tab.ctx).state, tab)).not.toContain("10059:response:1");
    }
  });
});
