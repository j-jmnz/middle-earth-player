// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.hit-points, rr.response, rr.action, rr.cost, rr.triggered-ability,
// rr.quest-phase, rr.step-3-4, rr.search (data/rules/entries.json).
// The Land of Sorrow attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Red Book of
// Westmarch 22110:A:1, A:2 and A:3, Song of Healing 22112:A:1 and A:2, Spare Pipe 22115:A:1, A:2 and A:3. The lines are the text of
// data/cards/TLoS.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered. The other cards are in
// the-land-of-sorrow.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, hosts, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const BOOK = "22110";
const HEALING = "22112";
const PIPE = "22115";
// Core Aragorn (Leadership), Éowyn (Spirit), Denethor (Lore); the Wandering Took (a Spirit Hobbit ally).
const ARAGORN = "01001";
const EOWYN = "01007";
const DENETHOR = "01010";
const TOOK = "01043";
// The Pal (a Leadership Hobbit hero) and a plain Leadership ally, from the scene kit.
const PAL = "pal";
const ALLY = "ally";
// A restricted attachment with no text; three events with no text; an enemy with engagement cost 50 (starter-scene.ts).
const GEAR = "gear";
const EV1 = "ev1";
const EV2 = "ev2";
const EV3 = "ev3";
const DEAR = "dear";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([BOOK, HEALING, PIPE, ARAGORN, EOWYN, DENETHOR, TOOK]))]);
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", sphere: "neutral", cost: 0, keywords: { restricted: true } }));
  for (const code of [EV1, EV2, EV3]) cards.set(code, definePrinted({ code, name: code, type: "event", sphere: "spirit", cost: 0 }));
  base = { ...starter, cards };
});

// Commits `commit` and passes until `stop` holds, the game asks a question, or the quest is over.
function quested(tab: Table, commit: readonly string[], stop: (run: Run) => boolean): Run {
  let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: commit }, tab.ctx);
  for (let guard = 0; guard < 20 && !stop(run) && run.state.window?.kind !== "choose" && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
  }
  return run;
}

describe("Red Book of Westmarch (22110:A:1, A:2, A:3)", () => {
  // "Attach to a Hobbit hero. Restricted.": the Pal (a Hobbit hero) is offered; Aragorn (not a Hobbit) and the Wandering Took (a Hobbit
  // ally) are not. Played on the Pal, it is attached to him.
  lineSpec("22110:A:1", "Attach to a Hobbit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: TOOK, seat: 0 }], hand: [{ code: BOOK, seat: 0 }] });
    const book = idsOf(tab, BOOK);
    expect(hosts(tab, book)).toEqual([idsOf(tab, PAL)]);
    expect(play(begin(tab.state), tab, book, idsOf(tab, PAL)).state.cards[book]?.host).toBe(idsOf(tab, PAL));
  });

  // "Restricted.": played on a Hobbit hero that holds two restricted Gears, the third restricted attachment makes one of the three go to
  // its owner's discard pile, the player's choice (rr.restricted).
  it("22110:A:1 played as a third restricted attachment, one of the three is discarded", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: GEAR, host: PAL }, { code: GEAR, host: PAL }], hand: [{ code: BOOK, seat: 0 }] });
    const [book, pal, [first = "", second = ""]] = [idsOf(tab, BOOK), idsOf(tab, PAL), tab.ids[GEAR] ?? []];
    let run = play(begin(tab.state), tab, book, pal);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([book, first, second].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx);
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(run.state.cards[pal]?.attachments.slice().sort()).toEqual([book, second].sort());
  });

  // The Pal holds the Book; the other player controls the Wandering Took and Aragorn.
  const bookTable = (effects: readonly Effect[], scene: Scene = {}): Table =>
    table(effects, { start: "quest", seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: ARAGORN, seat: 1 }], allies: [{ code: TOOK, seat: 1 }], attached: [{ code: BOOK, host: PAL }], deck: ["f0", "f0"], ...scene });

  // "While attached hero is committed to the quest, each Hobbit character gets +1 Willpower.": the Pal commits; he and the other
  // player's Wandering Took (a Hobbit that does not quest) get +1; Aragorn (no Hobbit) does not. Before the commit nobody has it.
  lineSpec("22110:A:2", "while the attached hero quests, each Hobbit character gets +1 Willpower", (effects) => {
    const tab = bookTable(effects);
    const [pal, took, aragorn] = [idsOf(tab, PAL), idsOf(tab, TOOK), idsOf(tab, ARAGORN)];
    expect(stat(tab.state, tab, pal, "willpower")).toBe(1);
    expect(stat(tab.state, tab, took, "willpower")).toBe(1);
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [pal] }, tab.ctx);
    expect(run.state.cards[pal]?.committed).toBe(true);
    expect(stat(run.state, tab, pal, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, took, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(2);
  });

  // "Response: After you quest successfully, exhaust Red Book of Westmarch to add 1 resource to attached hero's resource pool.": the Pal
  // (Willpower 2 with the Book) quests against an empty staging area; the Book exhausts and the Pal gets 1 resource.
  lineSpec("22110:A:3", "after you quest successfully, exhaust it to add 1 resource to the attached hero", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: PAL, seat: 0 }], attached: [{ code: BOOK, host: PAL }], deck: ["f0"] });
    const [pal, book] = [idsOf(tab, PAL), idsOf(tab, BOOK)];
    let run = quested(tab, [pal], (next) => triggers(next.state, tab).includes("22110:response:1"));
    expect(triggers(run.state, tab)).toContain("22110:response:1");
    const before = run.state.cards[pal]?.resources ?? 0;
    run = sendUnledgered(run, { type: "Trigger", cardId: book, effectId: "22110:response:1" }, tab.ctx);
    expect(run.state.cards[book]?.exhausted).toBe(true);
    expect(run.state.cards[pal]?.resources).toBe(before + 1);
  });

  // A failed quest (the Pal's 2 against the staging area's 3): no Response.
  it("22110:A:3 is not offered when the quest fails", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: PAL, seat: 0 }], attached: [{ code: BOOK, host: PAL }], staging: ["f3"], deck: ["f0"] });
    const run = quested(tab, [idsOf(tab, PAL)], (next) => triggers(next.state, tab).includes("22110:response:1"));
    expect(run.state.quested?.succeeded ?? []).not.toContain(0);
    expect(triggers(run.state, tab)).not.toContain("22110:response:1");
  });
});

describe("Song of Healing (22112:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero.": Aragorn (a hero) is offered; Denethor, who already holds one, and the plain ally are not.
  lineSpec("22112:A:1", "Attach to a hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], attached: [{ code: HEALING, host: DENETHOR }], hand: [{ code: HEALING, seat: 0 }] });
    const held = tab.ids[HEALING]?.[1] ?? "";
    expect(hosts(tab, held)).toEqual([idsOf(tab, ARAGORN)]);
    expect(play(begin(tab.state), tab, held, idsOf(tab, ARAGORN)).state.cards[held]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // Denethor holds the Song with `damage`; each seat's hand is `hands[seat]`.
  function song(effects: readonly Effect[], damage: number, hands: readonly (readonly string[])[], seats: 1 | 2 = 1): Table {
    const heroes = [{ code: DENETHOR, seat: 0 }, ...(seats === 2 ? [{ code: ARAGORN, seat: 1 }] : [])];
    const hand = hands.flatMap((codes, seat) => codes.map((code) => ({ code, seat })));
    const tab = table(effects, { seats, heroes, attached: [{ code: HEALING, host: DENETHOR }], hand });
    return { ...tab, state: syncConstants(updateCard(tab.state, idsOf(tab, DENETHOR), { damage }), tab.ctx) };
  }

  // "Action: Discard 1 card from your hand to heal 1 damage from attached hero.": two different cards in hand, so the player chooses
  // which goes; it is discarded, the other stays, and Denethor goes from 2 damage to 1.
  lineSpec("22112:A:2", "discard 1 card from your hand to heal 1 damage from the attached hero", (effects) => {
    const tab = song(effects, 2, [[EV1, EV2]]);
    const [denethor, ev1, ev2] = [idsOf(tab, DENETHOR), idsOf(tab, EV1), idsOf(tab, EV2)];
    expect(triggers(tab.state, tab)).toContain("22112:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, HEALING), effectId: "22112:action:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([ev1, ev2].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: ev1 }, tab.ctx);
    expect(run.state.cards[ev1]?.zone).toBe("discard");
    expect(run.state.seats[0]?.hand).toEqual([ev2]);
    expect(run.state.cards[denethor]?.damage).toBe(1);
  });

  // "Any player may trigger this effect.": the first player passes; the second player triggers it and discards from his own hand.
  lineSpec("22112:A:2", "another player may trigger it, discarding from his own hand", (effects) => {
    const tab = song(effects, 2, [[], [EV1]], 2);
    let run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    expect(triggers(run.state, tab)).toContain("22112:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, HEALING), effectId: "22112:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, EV1)]?.zone).toBe("discard");
    expect(run.state.seats[1]?.hand).toEqual([]);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.damage).toBe(1);
  });

  // The cost cannot be paid with an empty hand, and with no damage on the attached hero the heal changes nothing: not offered either way.
  it("22112:A:2 is not offered with an empty hand", () => {
    const tab = song(EFFECTS, 2, [[]]);
    expect(triggers(tab.state, tab)).not.toContain("22112:action:1");
  });

  it("22112:A:2 is not offered when the attached hero has no damage", () => {
    const tab = song(EFFECTS, 0, [[EV1]]);
    expect(triggers(tab.state, tab)).not.toContain("22112:action:1");
  });
});

describe("Spare Pipe (22115:A:1, A:2, A:3)", () => {
  // "Attach to a character.": Éowyn (a hero) and the plain ally are offered, the engaged enemy is not.
  it("22115:A:1 Attach to a character (the default attach rule, no record needed)", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], engaged: [{ code: DEAR, seat: 0 }], hand: [{ code: PIPE, seat: 0 }] });
    const pipe = idsOf(tab, PIPE);
    expect(hosts(tab, pipe)).toEqual([idsOf(tab, EOWYN), idsOf(tab, ALLY)].sort());
    expect(play(begin(tab.state), tab, pipe, idsOf(tab, ALLY)).state.cards[pipe]?.host).toBe(idsOf(tab, ALLY));
  });

  // "Attached character gets +1 hit point.": played on Éowyn through the intent; the ally keeps its hit points.
  lineSpec("22115:A:2", "attached character gets +1 hit point", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: PIPE, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, PIPE), idsOf(tab, EOWYN));
    expect(stat(run.state, tab, idsOf(tab, EOWYN), "hitPoints")).toBe(printed(tab, EOWYN, "health") + 1);
    expect(stat(run.state, tab, idsOf(tab, ALLY), "hitPoints")).toBe(printed(tab, ALLY, "health"));
  });

  // "Response: After you play Spare Pipe, search the top 5 cards of your deck for an event and add it to your hand. Shuffle your deck.":
  // two events in the top 5 and a third as the sixth card. The choice offers the two; the chosen one goes to the hand, the deck keeps
  // the rest and is shuffled.
  lineSpec("22115:A:3", "after it is played, an event of the top 5 goes to the hand and the deck is shuffled", (effects) => {
    const deck = [ALLY, EV1, ALLY, EV2, ALLY, EV3, ALLY].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], hand: [{ code: PIPE, seat: 0 }], playerDeck: deck });
    const pipe = idsOf(tab, PIPE);
    let run = play(begin(tab.state), tab, pipe, idsOf(tab, EOWYN));
    expect(triggers(run.state, tab)).toContain("22115:response:1");
    const cursor = run.state.seedCursor;
    run = sendUnledgered(run, { type: "Trigger", cardId: pipe, effectId: "22115:response:1" }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, EV1), idsOf(tab, EV2)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, EV2) }, tab.ctx);
    expect(run.state.seats[0]?.hand).toEqual([idsOf(tab, EV2)]);
    const left = run.state.seats[0]?.deck ?? [];
    expect(left).toHaveLength(6);
    expect(left).toContain(idsOf(tab, EV1));
    expect(left).toContain(idsOf(tab, EV3));
    expect(run.state.seedCursor).not.toBe(cursor);
  });
});
