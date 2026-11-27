// Rules: rr.action, rr.cost, rr.limits, rr.response, rr.in-play-and-out-of-play, rr.play-and-put-into-play, rr.ownership-and-control,
// rr.then, rr.sentinel, rr.printed, rr.triggered-ability (data/rules/entries.json).
// The Blood of Gondor heroes and allies, each printed line tested from the words on the card (data/cards/BoG.json: the lines are the ledger lines in data/printed, read from the scans): Caldara 06107:A:1, Squire
// of the Citadel 06108:A:1, Guthlaf 06110:A:1 and A:2, Emery 06112:A:1, Anborn 06114:A:1. The attachments are in
// the-blood-of-gondor-attachments.test.ts, the events in the-blood-of-gondor-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { hasKeyword, placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { choices, discarded, fillers, play, playerTableFor, triggers } from "../../../test/harness/player-table.ts";

const CALDARA = "06107";
const SQUIRE = "06108";
const GUTHLAF = "06110";
const EMERY = "06112";
const ANBORN = "06114";
const STAKES = "06115";
// Core heroes: Aragorn (Leadership, Dúnedain), Théodred (Leadership, Rohan), Gimli (Tactics), Éowyn (Spirit, Rohan), Eleanor (Spirit,
// Gondor), Dúnhere (Spirit, Rohan), Denethor (Lore, Gondor).
const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const EOWYN = "01007";
const ELEANOR = "01008";
const DUNHERE = "01009";
const DENETHOR = "01010";
// Spirit allies: Wandering Took, Lórien Guide, Northern Tracker. Snowbourn Scout: a Leadership ally. Forest Snare: a Trap attachment.
const TOOK = "01043";
const GUIDE = "01044";
const TRACKER = "01045";
const SNOWBOURN = "01016";
const SNARE = "01069";
// Stand-ins: a Spirit event and a Lore event for the deck, an attachment with no sphere.
const SPIRIT_CARD = "spirit-card";
const LORE_CARD = "lore-card";
const PAL = "pal";
const PLAIN = "plain";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [CALDARA, SQUIRE, GUTHLAF, EMERY, ANBORN, STAKES, ARAGORN, THEODRED, GIMLI, EOWYN, ELEANOR, DUNHERE, DENETHOR, TOOK, GUIDE, TRACKER, SNOWBOURN, SNARE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(SPIRIT_CARD, definePrinted({ code: SPIRIT_CARD, name: "Spirit Card", type: "event", sphere: "spirit", cost: 9 }));
  cards.set(LORE_CARD, definePrinted({ code: LORE_CARD, name: "Lore Card", type: "event", sphere: "lore", cost: 9 }));
  base = { ...starter, cards };
});

describe("Caldara (06107:A:1)", () => {
  // Caldara with `others` as her other heroes; the Wandering Took, the Lórien Guide, the Northern Tracker (Spirit allies) and the Snowbourn
  // Scout (Leadership) in the discard pile.
  function scene(effects: readonly Effect[], others: readonly { code: string; seat: number }[], seats: 1 | 2 = 1) {
    const start = table(effects, { seats, heroes: [{ code: CALDARA, seat: 0 }, ...others] });
    return discarded(start, [[TOOK, 0], [GUIDE, 0], [TRACKER, 0], [SNOWBOURN, 0]]);
  }

  // "Action: Discard Caldara to put 1 Spirit ally from your discard pile into play for each other hero you control with a printed Spirit
  // resource icon.": Éowyn and Eleanor are 2 such heroes (Denethor, Lore, is not); Caldara is discarded, two Spirit allies are put into
  // play, the third stays, and the Snowbourn Scout is never offered.
  lineSpec("06107:A:1", "Caldara: discard her to put a Spirit ally into play for each other Spirit hero", (effects) => {
    const { tab, ids: [took = "", guide = "", tracker = "", scout = ""] } = scene(effects, [{ code: EOWYN, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: DENETHOR, seat: 0 }]);
    const caldara = idsOf(tab, CALDARA);
    let run = send(begin(tab.state), { type: "Trigger", cardId: caldara, effectId: "06107:action:1" }, tab.ctx);
    expect(run.state.cards[caldara]?.zone).toBe("discard");
    expect(choices(run.state, tab).sort()).toEqual([took, guide, tracker].sort());
    run = send(run, { type: "Choose", optionId: took }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([guide, tracker].sort());
    run = send(run, { type: "Choose", optionId: tracker }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[took]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[tracker]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[guide]?.zone).toBe("discard");
    expect(run.state.cards[scout]?.zone).toBe("discard");
  });

  // "each other hero you control": the other player's Spirit hero is not counted, so one ally comes into play for Éowyn alone.
  it("06107:A:1 Caldara: another player's Spirit hero is not counted", () => {
    const { tab, ids: [took = "", guide = "", tracker = ""] } = scene(EFFECTS, [{ code: EOWYN, seat: 0 }, { code: DUNHERE, seat: 1 }], 2);
    let run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, CALDARA), effectId: "06107:action:1" }, tab.ctx);
    run = send(run, { type: "Choose", optionId: guide }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[guide]?.zone).toBe("play");
    expect([took, tracker].map((id) => run.state.cards[id]?.zone)).toEqual(["discard", "discard"]);
  });

  // No other hero with a printed Spirit icon: the Action would put nothing into play, so it is not offered and Caldara stays
  // (rr.triggered-ability, rr.cost).
  it("06107:A:1 Caldara: not offered with no other Spirit hero", () => {
    const { tab } = scene(EFFECTS, [{ code: DENETHOR, seat: 0 }]);
    expect(triggers(tab.state, tab)).not.toContain("06107:action:1");
  });
});

describe("Squire of the Citadel (06108:A:1)", () => {
  // "Response: After Squire of the Citadel leaves play, add 1 resource to a Gondor hero's resource pool.": the Squire is destroyed; of
  // Denethor and the other player's Eleanor (Gondor heroes; Gimli is not), Eleanor gets the resource.
  lineSpec("06108:A:1", "Squire of the Citadel: after it leaves play, 1 resource to a Gondor hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: GIMLI, seat: 0 }, { code: ELEANOR, seat: 1 }], allies: [{ code: SQUIRE, seat: 0 }] });
    const [squire, eleanor] = [idsOf(tab, SQUIRE), idsOf(tab, ELEANOR)];
    let run = send(begin(placeDamage(tab.state, squire, 1, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[squire]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("06108:response:1");
    run = send(run, { type: "Trigger", cardId: squire, effectId: "06108:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, DENETHOR), eleanor].sort());
    run = send(run, { type: "Choose", optionId: eleanor }, tab.ctx);
    expect(run.state.cards[eleanor]?.resources).toBe(6 + 1);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.resources).toBe(6);
  });

  // No Gondor hero in play: nothing to choose, so the Response is not offered.
  it("06108:A:1 Squire of the Citadel: not offered with no Gondor hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: SQUIRE, seat: 0 }] });
    const squire = idsOf(tab, SQUIRE);
    const run = send(begin(placeDamage(tab.state, squire, 1, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[squire]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).not.toContain("06108:response:1");
  });
});

describe("Guthlaf (06110:A:1, A:2)", () => {
  // "If there is at least 1 Rohan hero in play, lower the cost to play Guthlaf by 1.": 2 with Théodred, 3 with Gimli alone.
  lineSpec("06110:A:1", "Guthlaf: costs 1 less with a Rohan hero in play", (effects) => {
    const rohan = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: THEODRED, seat: 0 }], hand: [{ code: GUTHLAF, seat: 0 }] });
    expect(playCost(rohan.state, idsOf(rohan, GUTHLAF), 0, rohan.ctx)).toBe(2);
    const none = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: GUTHLAF, seat: 0 }] });
    expect(playCost(none.state, idsOf(none, GUTHLAF), 0, none.ctx)).toBe(3);
  });

  // "in play": a Rohan hero of the other player lowers it too.
  it("06110:A:1 Guthlaf: another player's Rohan hero lowers the cost", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: EOWYN, seat: 1 }], hand: [{ code: GUTHLAF, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, GUTHLAF), 0, tab.ctx)).toBe(2);
  });

  // "If there is at least 1 Gondor hero in play, Guthlaf gains sentinel.": played from the hand with the other player's Denethor in play,
  // Guthlaf has sentinel in the state that intent returns.
  lineSpec("06110:A:2", "Guthlaf: gains sentinel with a Gondor hero in play", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: DENETHOR, seat: 1 }], hand: [{ code: GUTHLAF, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, GUTHLAF));
    expect(run.state.cards[idsOf(tab, GUTHLAF)]?.zone).toBe("play");
    expect(hasKeyword(run.state, idsOf(tab, GUTHLAF), "sentinel", tab.ctx.cards)).toBe(true);
  });

  it("06110:A:2 Guthlaf: no sentinel with no Gondor hero in play", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }, { code: THEODRED, seat: 0 }], hand: [{ code: GUTHLAF, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, GUTHLAF));
    expect(hasKeyword(run.state, idsOf(tab, GUTHLAF), "sentinel", tab.ctx.cards)).toBe(false);
  });
});

describe("Emery (06112:A:1)", () => {
  // Two players; Emery in the first player's hand, `top` the top 3 cards of their deck and 2 Plain cards under them.
  function scene(effects: readonly Effect[], top: readonly string[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: EMERY, seat: 0 }], playerDeck: [...top.map((code) => ({ code, seat: 0 })), ...fillers(PLAIN, 2)] });
  }

  // "Action: Discard the top 3 card of your deck to put Emery into play from your hand, under any player's control.": the top 3 (Spirit
  // and sphereless) are discarded, Emery comes into play under the other player's control and stays there.
  lineSpec("06112:A:1", "Emery: discard the top 3 to put him into play under any player's control", (effects) => {
    const tab = scene(effects, [SPIRIT_CARD, PLAIN, SPIRIT_CARD]);
    const emery = idsOf(tab, EMERY);
    const top = (tab.state.seats[0]?.deck ?? []).slice(0, 3);
    let run = send(begin(tab.state), { type: "Trigger", cardId: emery, effectId: "06112:action:1" }, tab.ctx);
    expect(choices(run.state, tab)).toEqual(["seat:0", "seat:1"]);
    run = send(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(top.map((id) => run.state.cards[id]?.zone)).toEqual(["discard", "discard", "discard"]);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.cards[emery]).toMatchObject({ zone: "play", controller: 1 });
  });

  // "Then, if any of the discarded cards have the Tactics, Lore or Leadership sphere, discard Emery.": a Lore card among the 3, and Emery
  // goes to the discard pile.
  it("06112:A:1 Emery: discarded when a discarded card is Lore", () => {
    const tab = scene(EFFECTS, [SPIRIT_CARD, LORE_CARD, PLAIN]);
    const emery = idsOf(tab, EMERY);
    let run = send(begin(tab.state), { type: "Trigger", cardId: emery, effectId: "06112:action:1" }, tab.ctx);
    run = send(run, { type: "Choose", optionId: "seat:1" }, tab.ctx);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.state.cards[emery]?.zone).toBe("discard");
  });

  // Fewer than 3 cards in the deck: the cost cannot be paid, and the Action is not offered.
  it("06112:A:1 Emery: not offered with fewer than 3 cards in the deck", () => {
    for (const size of [0, 1, 2]) {
      const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: EMERY, seat: 0 }], playerDeck: fillers(PLAIN, size) });
      expect(triggers(tab.state, tab), `deck of ${size}`).not.toContain("06112:action:1");
    }
    const full = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: EMERY, seat: 0 }], playerDeck: fillers(PLAIN, 3) });
    expect(triggers(full.state, full)).toContain("06112:action:1");
  });
});

describe("Anborn (06114:A:1)", () => {
  // "Action: Exhaust Anborn to return 1 Trap card from your discard pile to your hand.": Forest Snare and Poisoned Stakes (Traps) are
  // offered, the Plain attachment is not; Anborn exhausts and the Snare goes to the hand.
  lineSpec("06114:A:1", "Anborn: exhaust him to return a Trap card from the discard pile to the hand", (effects) => {
    const start = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: ANBORN, seat: 0 }] });
    const { tab, ids: [snare = "", stakes = "", plain = ""] } = discarded(start, [[SNARE, 0], [STAKES, 0], [PLAIN, 0]]);
    const anborn = idsOf(tab, ANBORN);
    let run = send(begin(tab.state), { type: "Trigger", cardId: anborn, effectId: "06114:action:1" }, tab.ctx);
    expect(run.state.cards[anborn]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([snare, stakes].sort());
    run = send(run, { type: "Choose", optionId: snare }, tab.ctx);
    expect(run.state.cards[snare]?.zone).toBe("hand");
    expect(run.state.cards[stakes]?.zone).toBe("discard");
    expect(run.state.cards[plain]?.zone).toBe("discard");
  });

  // No Trap card in the discard pile (and one in the other player's): nothing to return, so the Action is not offered.
  it("06114:A:1 Anborn: not offered with no Trap card in your discard pile", () => {
    const start = table(EFFECTS, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ANBORN, seat: 0 }] });
    const { tab } = discarded(start, [[PLAIN, 0], [SNARE, 1]]);
    expect(triggers(tab.state, tab)).not.toContain("06114:action:1");
  });
});
