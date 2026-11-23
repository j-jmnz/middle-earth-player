// Rules: rr.play-restrictions-and-permissions, rr.action, rr.search, rr.step-6-5, rr.unique-cards, rr.quest-phase, rr.ready, rr.modifiers, rr.lasting-effects (data/rules/entries.json).
// The Treason of Saruman events, written from their printed lines (data/printed): Entmoot 143011:A:1 and A:2, Helm! Helm! 143012:A:1 and A:2,
// The Three Hunters 143013:A:1 and A:2.
import { beforeAll, describe, expect } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { withMode, type ScenarioState } from "../../rules/core/state.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, playerTableFor, playRefusal, stat } from "../../../test/harness/player-table.ts";

const ARAGORN = "143001";
const THEODEN = "143002";
const TREEBEARD = "143003";
const QUICKBEAM = "143006";
const HAMA = "143007";
const ENT_DRAUGHT = "143009";
const ENTMOOT = "143011";
const HELM = "143012";
const HUNTERS = "143013";
// Core Aragorn: a Leadership Aragorn, not the Fellowship one. Éowyn: a Spirit Rohan hero.
const CORE_ARAGORN = "01001";
const EOWYN = "01007";
const GIMLI = "01004";
const ORI = "131004";
const WEAK = "weak";
const BOSS = "boss";
const TOUGH = "tough";
// A Fellowship hero that is not Aragorn: something else pays for The Three Hunters.
const FELLOW = "fellow";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ARAGORN, THEODEN, TREEBEARD, QUICKBEAM, HAMA, ENT_DRAUGHT, ENTMOOT, HELM, HUNTERS, CORE_ARAGORN, EOWYN, GIMLI, ORI]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 3 }));
  cards.set(BOSS, definePrinted({ code: BOSS, name: "Boss", type: "enemy", isUnique: true, threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 3 }));
  cards.set(TOUGH, definePrinted({ code: TOUGH, name: "Tough", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 20 }));
  cards.set(FELLOW, definePrinted({ code: FELLOW, name: "Fellow", type: "hero", sphere: "fellowship", threat: 0, willpower: 1, attack: 1, defense: 1, health: 3 }));
  base = { ...starter, cards };
});

function playIn(state: ScenarioState, tab: Table, code: string): Run {
  const card = idsOf(tab, code);
  return send(begin(state), { type: "PlayCard", cardId: card, payments: payFor(state, tab.ctx, card) }, tab.ctx);
}

describe("Entmoot (143011:A:1, A:2)", () => {
  // "Play only if you control at least 1 Ent character."
  lineSpec("143011:A:1", "is played only while you control an Ent character", (effects) => {
    const ents = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }], hand: [{ code: ENTMOOT, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }] });
    expect(playRefusal(ents.state, ents, ENTMOOT)).toBeNull();
    const none = table(effects, { heroes: [{ code: ORI, seat: 0 }], hand: [{ code: ENTMOOT, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }] });
    expect(playRefusal(none.state, none, ENTMOOT)).not.toBeNull();
  });

  // "Action: Search the top 5 cards of your deck for any number of Ent cards and add them to your hand. Shuffle the other cards back into your deck."
  lineSpec("143011:A:2", "takes the Ent cards the player picks among the top 5, and only those", (effects) => {
    // Top 5: Quickbeam, a card, Ent Draught, a card, Quickbeam; a sixth, Ent Draught, lies below them.
    const deck = [QUICKBEAM, "card", ENT_DRAUGHT, "card", QUICKBEAM, ENT_DRAUGHT].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: TREEBEARD, seat: 0 }], hand: [{ code: ENTMOOT, seat: 0 }], playerDeck: deck });
    const top = tab.state.seats[0]?.deck.slice(0, 5) ?? [];
    const sixth = tab.state.seats[0]?.deck[5] ?? "";
    const ents = top.filter((id) => tab.state.cards[id]?.code !== "card");
    let run = playIn(tab.state, tab, ENTMOOT);
    // One question for each Ent card among the top 5: take the first two, leave the last ("any number").
    const answers = ["take", "take", "leave"];
    for (let guard = 0; guard < 6 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: answers.shift() ?? "leave" }, tab.ctx);
    expect(answers).toEqual([]);
    const hand = run.state.seats[0]?.hand ?? [];
    expect(hand.filter((id) => ents.includes(id))).toHaveLength(2);
    expect(hand).not.toContain(sixth);
    expect(run.state.seats[0]?.deck).toHaveLength(4);
    expect(run.state.seats[0]?.deck).toContain(sixth);
  });
});

describe("Helm! Helm! (143012:A:1, A:2)", () => {
  // The players attack: Théoden is declared against the Tough enemy, and the action window inside his attack is open (the resolving enemy attacks step is complete).
  function afterEnemyAttacks(tab: Table): Run {
    const run = send(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, TOUGH), attackerIds: [idsOf(tab, THEODEN)] }, tab.ctx);
    expect(run.state.window?.kind).toBe("frameAction");
    return run;
  }

  // "Play only after the resolving enemy attacks step is complete."
  lineSpec("143012:A:1", "is not played before the enemy attacks are resolved, and is after", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], allies: [{ code: HAMA, seat: 0 }], hand: [{ code: HELM, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }, { code: WEAK, seat: 0 }] });
    // The action window before the enemies attack (6.2), Háma's Combat Action keeping it open.
    const before = combat(tab.state, tab);
    expect(before.state.window?.kind).toBe("frameAction");
    expect(playRefusal(before.state, tab, HELM)).not.toBeNull();
    expect(playRefusal(afterEnemyAttacks(tab).state, tab, HELM)).toBeNull();
  });

  // "Combat Action: Exhaust and discard a Rohan ally you control to choose and discard a non-unique enemy engaged with you."
  lineSpec("143012:A:2", "discards a Rohan ally of yours to discard a non-unique enemy engaged with you", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODEN, seat: 0 }], allies: [{ code: HAMA, seat: 0 }], hand: [{ code: HELM, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }, { code: WEAK, seat: 0 }, { code: BOSS, seat: 0 }] });
    const [hama, weak, boss] = [idsOf(tab, HAMA), idsOf(tab, WEAK), idsOf(tab, BOSS)];
    let run = playIn(afterEnemyAttacks(tab).state, tab, HELM);
    // The only Rohan ally is discarded as the cost, so the one choice is the enemy; the unique enemy is not offered.
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).not.toContain(hama);
    expect(choices(run.state, tab)).toContain(weak);
    expect(choices(run.state, tab)).not.toContain(boss);
    run = send(run, { type: "Choose", optionId: weak }, tab.ctx);
    expect(run.state.cards[hama]?.zone).toBe("discard");
    expect(run.state.cards[weak]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[boss]?.zone).toBe("engaged");
  });

  lineSpec("143012:A:2", "is not played without a ready Rohan ally of yours", (effects) => {
    const noAlly = table(effects, { heroes: [{ code: THEODEN, seat: 0 }, { code: EOWYN, seat: 0 }], hand: [{ code: HELM, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }, { code: WEAK, seat: 0 }] });
    expect(playRefusal(afterEnemyAttacks(noAlly).state, noAlly, HELM)).not.toBeNull();
    const ally = table(effects, { heroes: [{ code: THEODEN, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: HAMA, seat: 0 }], hand: [{ code: HELM, seat: 0 }], engaged: [{ code: TOUGH, seat: 0 }, { code: WEAK, seat: 0 }] });
    expect(playRefusal(afterEnemyAttacks(ally).state, ally, HELM)).toBeNull();
  });
});

describe("The Three Hunters (143013:A:1, A:2)", () => {
  // The quest phase after the heroes commit and the staging is done: the window after staging (3.3), where a Quest Action is played.
  function questing(effects: readonly Effect[], heroes: readonly string[]): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: HUNTERS, seat: 0 }], deck: ["f0", "f0", "f0"] });
    let run = send(begin(tab.state), { type: "Commit", cardIds: heroes.map((code) => idsOf(tab, code)) }, tab.ctx);
    for (let guard = 0; guard < 5 && run.state.window?.kind !== "frameAction" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) run = send(run, { type: "Pass" }, tab.ctx);
    return { tab, run };
  }

  // "Play only if you control Fellowship Aragorn."
  lineSpec("143013:A:1", "is played only while you control the Fellowship Aragorn", (effects) => {
    const fellowship = questing(effects, [ARAGORN, THEODEN, TREEBEARD]);
    expect(playRefusal(fellowship.run.state, fellowship.tab, HUNTERS)).toBeNull();
    // Core Aragorn is a Leadership hero, not the Fellowship Aragorn; the Fellow pays for the card.
    const core = questing(effects, [FELLOW, CORE_ARAGORN, THEODEN]);
    expect(playRefusal(core.run.state, core.tab, HUNTERS)).not.toBeNull();
  });

  // "Quest Action: Choose 3 heroes committed to the quest. Ready those heroes. Until the end of the round, each of the chosen heroes gets +1 Willpower, +1 Attack, and +1 Defense."
  lineSpec("143013:A:2", "readies 3 committed heroes and gives each +1 Willpower, +1 Attack and +1 Defense until the end of the round", (effects) => {
    const heroes = [ARAGORN, THEODEN, TREEBEARD, EOWYN];
    const { tab, run: committed } = questing(effects, heroes);
    const ids = heroes.map((code) => idsOf(tab, code));
    const before = ids.map((id) => [stat(committed.state, tab, id, "willpower"), stat(committed.state, tab, id, "attack"), stat(committed.state, tab, id, "defense")]);
    let run = playIn(committed.state, tab, HUNTERS);
    // Aragorn, Théoden and Treebeard are chosen; Éowyn stays exhausted.
    for (const id of ids.slice(0, 3)) {
      expect(run.state.window?.kind).toBe("choose");
      expect(choices(run.state, tab)).toContain(id);
      run = send(run, { type: "Choose", optionId: id }, tab.ctx);
    }
    ids.forEach((id, index) => {
      const bonus = index < 3 ? 1 : 0;
      expect(run.state.cards[id]?.exhausted).toBe(index >= 3);
      expect([stat(run.state, tab, id, "willpower"), stat(run.state, tab, id, "attack"), stat(run.state, tab, id, "defense")]).toEqual(before[index]?.map((value) => value + bonus));
    });
    // The quest phase ends: the bonus lasts to the end of the round.
    const later = begin(settle({ ...withMode(run.state, "travel"), window: null }, tab.ctx, []));
    expect(later.state.phase).toBe("Travel");
    expect(stat(later.state, tab, ids[0] ?? "", "attack")).toBe((before[0]?.[1] ?? 0) + 1);
    const next = begin(settle({ ...withMode(later.state, "beginRound"), window: null }, tab.ctx, []));
    expect(stat(next.state, tab, ids[0] ?? "", "attack")).toBe(before[0]?.[1]);
  });
});
