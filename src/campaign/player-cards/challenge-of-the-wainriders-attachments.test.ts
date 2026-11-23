// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.action, rr.doomed-x, rr.search, rr.lasting-effects (data/rules/entries.json).
// The Challenge of the Wainriders attachments, written from their card text (data/cards/CotW.json; data/printed holds no ledger for this
// pack, so the lines are the text of data/cards and every intent goes through sendUnledgered): Power of Command 22055:A:1 and A:2, Golden
// Belt 22060:A:1 and A:2, Saruman's Staff 22063:A:1 and A:2. The heroes, allies, events and contract are in
// challenge-of-the-wainriders.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { choices, enter, hosts, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SARUMAN = "22054";
const COMMAND = "22055";
const BELT = "22060";
const STAFF = "22063";
// The One Ring (a Master attachment); Strength and Courage (another Master attachment). Waters of Nimrodel (Lore, Doomed 3); Defiant
// Challenge (Spirit, Doomed 2). Legolas (Tactics), Beravor (Lore). Citadel Plate and Dwarven Axe: restricted Tactics attachments for a hero.
const ONE_RING = "21001";
const COURAGE = "22033";
const WATERS = "08145";
const DEFIANT = "22089";
const LEGOLAS = "01005";
const BERAVOR = "01012";
const PLATE = "01040";
const AXE = "01041";
const ALLY = "ally";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SARUMAN, COMMAND, BELT, STAFF, ONE_RING, COURAGE, WATERS, DEFIANT, LEGOLAS, BERAVOR, PLATE, AXE]))]);
  base = { ...starter, cards };
});

describe("Power of Command (22055:A:1, A:2)", () => {
  // "Attach to the hero with The One Ring." and "Limit 1 per hero.": the Pal holds The One Ring and is offered; Beravor and an ally are
  // not. Once it holds a Power of Command, a second one has no host.
  lineSpec("22055:A:1", "Power of Command: Attach to the hero with The One Ring, one per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], attached: [{ code: ONE_RING, host: PAL }], hand: [{ code: COMMAND, seat: 0 }, { code: COMMAND, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[COMMAND] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, PAL)]);
    const run = play(begin(tab.state), tab, first, idsOf(tab, PAL));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, PAL));
    expect(hosts(tab, second, run.state)).toEqual([]);
  });

  // "Attach to the hero with The One Ring": Beravor holds Strength and Courage, a Master attachment, and not The One Ring. (Only a built
  // table reaches this: every Master attachment prints the same host rule.)
  lineSpec("22055:A:1", "Power of Command: a hero with another Master attachment and no One Ring is not a host", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: BERAVOR, seat: 0 }], attached: [{ code: ONE_RING, host: PAL }, { code: COURAGE, host: BERAVOR }], hand: [{ code: COMMAND, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, COMMAND))).toEqual([idsOf(tab, PAL)]);
  });

  // "Attached hero gets +1 Willpower.": played on the Pal, his Willpower is 1 + 1.
  lineSpec("22055:A:2", "Power of Command: attached hero gets +1 Willpower", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }], attached: [{ code: ONE_RING, host: PAL }], hand: [{ code: COMMAND, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, COMMAND), idsOf(tab, PAL));
    expect(stat(run.state, tab, idsOf(tab, PAL), "willpower")).toBe(printed(tab, PAL, "willpower") + 1);
  });
});

describe("Golden Belt (22060:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero.": Legolas and Beravor are offered, the ally is not; once Legolas holds a Belt, the second goes to
  // Beravor only.
  lineSpec("22060:A:1", "Golden Belt: Attach to a hero, one per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: BELT, seat: 0 }, { code: BELT, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[BELT] ?? [];
    expect(hosts(tab, first)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, BERAVOR)].sort());
    const run = play(begin(tab.state), tab, first, idsOf(tab, LEGOLAS));
    expect(run.state.cards[first]?.host).toBe(idsOf(tab, LEGOLAS));
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, BERAVOR)]);
  });

  // Legolas with Citadel Plate and a Dwarven Axe (two restricted attachments), with the Belt when `belt`; another Axe in hand.
  const armed = (effects: readonly Effect[], belt: boolean) =>
    table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: BERAVOR, seat: 0 }], attached: [{ code: PLATE, host: LEGOLAS }, { code: AXE, host: LEGOLAS }, ...(belt ? [{ code: BELT, host: LEGOLAS }] : [])], hand: [{ code: AXE, seat: 0 }] });

  // "Attached hero can have 1 additional restricted attachment.": with the Belt, a third restricted attachment, the Axe from the hand, is
  // played on Legolas and all three stay; without it, he is not offered for the Axe.
  lineSpec("22060:A:2", "Golden Belt: attached hero can have 1 additional restricted attachment", (effects) => {
    const tab = armed(effects, true);
    const legolas = idsOf(tab, LEGOLAS);
    const axe = tab.ids[AXE]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    expect(hosts(tab, axe)).toContain(legolas);
    const run = play(begin(tab.state), tab, axe, legolas);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[legolas]?.attachments).toHaveLength(4);
    for (const id of [...(tab.ids[AXE] ?? []), idsOf(tab, PLATE)]) expect(run.state.cards[id]?.host).toBe(legolas);
  });

  // Without the Belt a third restricted attachment is still played, and one of the three must go to the discard pile (rr.restricted): the
  // player is asked which, among the Plate and the two Axes, and the one chosen is discarded.
  it("22060:A:2 Golden Belt: without it a third restricted attachment sends one to the discard pile", () => {
    const tab = armed(EFFECTS, false);
    const legolas = idsOf(tab, LEGOLAS);
    const axe = tab.ids[AXE]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    let run = play(begin(tab.state), tab, axe, legolas);
    expect(choices(run.state, tab).sort()).toEqual([...(tab.ids[AXE] ?? []), idsOf(tab, PLATE)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, PLATE) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, PLATE)]?.zone).toBe("discard");
    expect(run.state.cards[legolas]?.attachments).toHaveLength(2);
  });

  // With the Belt, a fourth restricted attachment sends one to the discard pile: the Belt gives 1 more, not any number. Legolas has the
  // Plate, an Axe and the Belt, and plays an Axe (the third) and a Plate (the fourth) from the hand.
  it("22060:A:2 Golden Belt: a fourth restricted attachment sends one to the discard pile", () => {
    const tab = table(EFFECTS, { heroes: [{ code: LEGOLAS, seat: 0 }], attached: [{ code: PLATE, host: LEGOLAS }, { code: AXE, host: LEGOLAS }, { code: BELT, host: LEGOLAS }], hand: [{ code: AXE, seat: 0 }, { code: PLATE, seat: 0 }] }, 9);
    const legolas = idsOf(tab, LEGOLAS);
    const [worn = "", held = ""] = tab.ids[PLATE] ?? [];
    const axe = tab.ids[AXE]?.find((id) => tab.state.cards[id]?.zone === "hand") ?? "";
    let run = play(begin(tab.state), tab, axe, legolas);
    expect(run.state.window?.kind).not.toBe("choose");
    run = play(run, tab, held, legolas);
    expect(choices(run.state, tab).sort()).toEqual([...(tab.ids[AXE] ?? []), worn, held].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: worn }, tab.ctx);
    expect(run.state.cards[worn]?.zone).toBe("discard");
    expect(run.state.cards[legolas]?.attachments).toHaveLength(4);
  });
});

describe("Saruman's Staff (22063:A:1, A:2)", () => {
  // "Attach to Saruman. Restricted.": Saruman is offered, Beravor and the ally are not.
  lineSpec("22063:A:1", "Saruman's Staff: Attach to Saruman", (effects) => {
    const tab = table(effects, { heroes: [{ code: SARUMAN, seat: 0 }, { code: BERAVOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: STAFF, seat: 0 }] });
    const staff = idsOf(tab, STAFF);
    expect(hosts(tab, staff)).toEqual([idsOf(tab, SARUMAN)]);
    expect(play(begin(tab.state), tab, staff, idsOf(tab, SARUMAN)).state.cards[staff]?.host).toBe(idsOf(tab, SARUMAN));
  });

  // Saruman holds the Staff; two Waters of Nimrodel in hand and a damaged ally for them to heal; the deck holds a plain card, Defiant
  // Challenge, three plain cards, a second Defiant Challenge (the sixth card) and a plain card.
  function staffed(effects: readonly Effect[]): Table {
    const deck = [CARD, DEFIANT, CARD, CARD, CARD, DEFIANT, CARD].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: SARUMAN, seat: 0 }], attached: [{ code: STAFF, host: SARUMAN }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: WATERS, seat: 0 }, { code: WATERS, seat: 0 }], playerDeck: deck }, 9);
    return { ...tab, state: updateCard(tab.state, idsOf(tab, ALLY), { damage: 1 }) };
  }

  // The Staff's Action, answered with `option`.
  function used(tab: Table, option: string): Run {
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, STAFF), effectId: "22063:action:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, STAFF)]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual(["doomed", "search"]);
    return sendUnledgered(run, { type: "Choose", optionId: option }, tab.ctx);
  }

  // "Action: Exhaust Saruman's Staff to (choose one): Reduce the X value of the next Doomed X event you play this phase by 2": the first
  // Waters of Nimrodel raises the threat by 3 - 2, the second by its full 3.
  lineSpec("22063:A:2", "Saruman's Staff: exhaust it to reduce the X of the next Doomed X event this phase by 2", (effects) => {
    const tab = staffed(effects);
    const [first = "", second = ""] = tab.ids[WATERS] ?? [];
    const threat = tab.state.seats[0]?.threat ?? 0;
    let run = play(used(tab, "doomed"), tab, first);
    expect(run.state.seats[0]?.threat).toBe(threat + 1);
    run = { ...run, state: updateCard(run.state, idsOf(tab, ALLY), { damage: 1 }) };
    run = play(run, tab, second);
    expect(run.state.seats[0]?.threat).toBe(threat + 1 + 3);
  });

  // "this phase": used in the planning phase and no Doomed event played, the reduction is gone in the quest phase: the Waters played there
  // (an Action event) raises the threat by 3.
  it("22063:A:2 Saruman's Staff: the reduction ends with the phase", () => {
    const tab = staffed(EFFECTS);
    const quest = enter(used(tab, "doomed").state, tab, "questCommit");
    const threat = quest.state.seats[0]?.threat ?? 0;
    const run = play(quest, tab, tab.ids[WATERS]?.[0] ?? "");
    expect(run.state.seats[0]?.threat).toBe(threat + 3);
  });

  // "or search the top 5 cards of your deck for a Doomed event and add it to your hand. Shuffle your deck.": the Defiant Challenge among the
  // top 5 is found and the one sixth is not; it goes to the hand, and the rest of the deck is shuffled (its order changes).
  lineSpec("22063:A:2", "Saruman's Staff: exhaust it to search the top 5 cards for a Doomed event, then shuffle", (effects) => {
    const tab = staffed(effects);
    const [near = "", far = ""] = tab.ids[DEFIANT] ?? [];
    const rest = (tab.state.seats[0]?.deck ?? []).filter((id) => id !== near);
    const run = used(tab, "search");
    // The near Defiant Challenge is the only Doomed event of the top 5: no choice is asked.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[near]?.zone).toBe("hand");
    expect(run.state.cards[far]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(rest.length);
    expect(run.state.seats[0]?.deck).not.toEqual(rest);
  });

  // The Staff exhausted: its cost cannot be paid.
  it("22063:A:2 Saruman's Staff: not offered while it is exhausted", () => {
    const tab = staffed(EFFECTS);
    expect(triggers(updateCard(tab.state, idsOf(tab, STAFF), { exhausted: true }), tab)).not.toContain("22063:action:1");
  });
});
