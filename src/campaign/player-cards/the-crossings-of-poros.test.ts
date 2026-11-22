// Rules: rr.attachment-cards, rr.restricted, rr.action, rr.limits, rr.cost, rr.response, rr.enters-play, rr.resources, rr.victory,
// rr.engaged, rr.staging-area, rr.lasting-effects, rr.destroy, rr.ready, rr.triggered-ability, rr.deckbuilding (data/rules/entries.json).
// The Crossings of Poros characters and attachments, written from their card text (data/cards/CoP.json; data/printed holds no ledger for
// this pack, so every intent goes through sendUnledgered): Quickbeam 17135:A:1 and A:2, Halfast Gamgee 17136:A:1 and A:2, Beorning
// Guardian 17138:A:1, Followed 17139:A:1 to A:3, Emyn Arnen Ranger 17141:A:1, Magic Ring 17143:A:1 and A:2. The events are in
// the-crossings-of-poros-events.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal } from "../../catalog/deck-save.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode } from "../../rules/core/state.ts";
import { playCost } from "../../rules/player/attach.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, deckSaveFacts, enter, fillers, hosts, packRow, play, playerTable, questing, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const QUICKBEAM = "17135";
const HALFAST = "17136";
const GUARDIAN = "17138";
const FOLLOWED = "17139";
const RANGER = "17141";
const RING = "17143";
// Core Aragorn (Leadership), Legolas (Tactics), Éowyn (Spirit), Beravor (Lore). Citadel Plate: "Attach to a hero. Restricted."
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const PLATE = "01040";
// The kit's Pal: a Leadership hero. Ally: a Leadership ally with no traits.
const PAL = "pal";
const ALLY = "ally";
// A Trap attachment, player and encounter side quests.
const SNARE = "snare";
const SIDE = "side";
const ENC_SIDE = "enc-side";
// Prey: an enemy of printed Threat 2 that 3 damage destroys. Wall: one no attack of these tests destroys. Locations of 9 quest points.
const PREY = "prey";
const WALL = "wall";
const LOC = "loc";
const LOC2 = "loc2";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([QUICKBEAM, HALFAST, GUARDIAN, FOLLOWED, RANGER, RING, ARAGORN, LEGOLAS, EOWYN, BERAVOR, PLATE]))]);
  cards.set(SNARE, definePrinted({ code: SNARE, name: "Snare", type: "attachment", cost: 0, traits: ["Trap"] }));
  cards.set(SIDE, definePrinted({ code: SIDE, name: "Side", type: "player-side-quest", questPoints: 4 }));
  cards.set(ENC_SIDE, definePrinted({ code: ENC_SIDE, name: "Encounter side", type: "encounter-side-quest", questPoints: 4 }));
  cards.set(PREY, definePrinted({ code: PREY, name: "Prey", type: "enemy", threat: 2, engagementCost: 40, attack: 1, defense: 0, health: 3 }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 2, engagementCost: 40, attack: 1, defense: 3, health: 9 }));
  cards.set(LOC, definePrinted({ code: LOC, name: "Loc", type: "location", threat: 0, questPoints: 9 }));
  cards.set(LOC2, definePrinted({ code: LOC2, name: "Loc2", type: "location", threat: 1, questPoints: 9 }));
  base = { ...starter, cards };
});

describe("Quickbeam (17135:A:1, A:2)", () => {
  // "Cannot have restricted attachments.": Citadel Plate (Restricted) may go on Legolas, not on Quickbeam.
  lineSpec("17135:A:1", "Quickbeam: cannot have restricted attachments", (effects) => {
    const tab = table(effects, { heroes: [{ code: QUICKBEAM, seat: 0 }, { code: LEGOLAS, seat: 0 }], hand: [{ code: PLATE, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, PLATE))).toEqual([idsOf(tab, LEGOLAS)]);
  });

  // An exhausted Quickbeam with no damage.
  function exhausted(effects: readonly Effect[]) {
    const tab = table(effects, { heroes: [{ code: QUICKBEAM, seat: 0 }] });
    const quickbeam = idsOf(tab, QUICKBEAM);
    return { tab: { ...tab, state: updateCard(tab.state, quickbeam, { exhausted: true }) }, quickbeam };
  }

  // "Action: Deal 2 damage to Quickbeam to ready him. (Limit once per phase.)": he takes 2 damage and is ready; exhausted again in the same
  // phase, the Action is not offered; in the next phase it is.
  lineSpec("17135:A:2", "Quickbeam: deal 2 damage to him to ready him, once per phase", (effects) => {
    const { tab, quickbeam } = exhausted(effects);
    expect(triggers(tab.state, tab)).toContain("17135:action:1");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: quickbeam, effectId: "17135:action:1" }, tab.ctx);
    expect(run.state.cards[quickbeam]).toMatchObject({ damage: 2, exhausted: false });
    const again = updateCard(run.state, quickbeam, { exhausted: true });
    expect(triggers(again, tab)).not.toContain("17135:action:1");
    expect(triggers(questing(withMode(again, "questCommit")), tab)).toContain("17135:action:1");
  });

  // A ready Quickbeam: readying him changes nothing, so the Action is not offered and he takes no damage.
  it("17135:A:2 Quickbeam: not offered while he is ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: QUICKBEAM, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("17135:action:1");
  });
});

describe("Halfast Gamgee (17136:A:1, A:2)", () => {
  // Halfast in hand, the Pal (Leadership) to pay, the cards given in the victory display.
  const halfast = (effects: readonly Effect[], victory: readonly string[], seats: 1 | 2 = 1) =>
    table(effects, { seats, heroes: [{ code: PAL, seat: 0 }, ...(seats === 2 ? [{ code: ARAGORN, seat: 1 }] : [])], hand: [{ code: HALFAST, seat: 0 }], victory });

  // "Reduce the cost to play Halfast Gamgee by 1 for each side quest in the victory display.": a player side quest and an encounter side
  // quest make his cost 1 (printed 3); a location in the victory display does not count.
  lineSpec("17136:A:1", "Halfast Gamgee: 1 less for each side quest in the victory display", (effects) => {
    const two = halfast(effects, [SIDE, ENC_SIDE, LOC]);
    expect(playCost(two.state, idsOf(two, HALFAST), 0, two.ctx)).toBe(1);
    const none = halfast(effects, [LOC]);
    expect(playCost(none.state, idsOf(none, HALFAST), 0, none.ctx)).toBe(3);
    const run = sendUnledgered(begin(two.state), { type: "PlayCard", cardId: idsOf(two, HALFAST), payments: [{ heroId: idsOf(two, PAL), amount: 1 }] }, two.ctx);
    expect(run.state.cards[idsOf(two, HALFAST)]?.zone).toBe("play");
  });

  // "Response: After Halfast Gamgee enters play, add 1 resource to a hero's resource pool.": both players' heroes are offered; the other
  // player's Aragorn gets 1 resource.
  lineSpec("17136:A:2", "Halfast Gamgee: after he enters play, 1 resource to a hero", (effects) => {
    const tab = halfast(effects, [], 2);
    const [card, aragorn] = [idsOf(tab, HALFAST), idsOf(tab, ARAGORN)];
    let run = play(begin(tab.state), tab, card);
    expect(triggers(run.state, tab)).toContain("17136:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: card, effectId: "17136:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([aragorn, idsOf(tab, PAL)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: aragorn }, tab.ctx);
    expect(run.state.cards[aragorn]?.resources).toBe(6 + 1);
  });
});

describe("Beorning Guardian (17138:A:1)", () => {
  // The Guardian (Attack 3) and Legolas attack the enemy engaged with the player; Loc is the active location, Loc2 (printed Threat 1) is
  // in the staging area.
  function guardian(effects: readonly Effect[], enemy: string, attackers: "guardian" | "legolas") {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: GUARDIAN, seat: 0 }], engaged: [{ code: enemy, seat: 0 }], active: LOC, staging: [LOC2] });
    const [card, legolas] = [idsOf(tab, GUARDIAN), idsOf(tab, LEGOLAS)];
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, enemy), attackerIds: [attackers === "guardian" ? card : legolas] }, tab.ctx);
    return { tab, run, card, enemy: idsOf(tab, enemy) };
  }

  // "Response: After Beorning Guardian participates in an attack that destroys an enemy, discard Beorning Guardian to place X progress on
  // a location, where X is the destroyed enemy's printed Threat.": the Guardian's attack destroys the Prey (printed Threat 2); both
  // locations are offered, the Guardian is discarded and the location in the staging area gets 2 progress.
  lineSpec("17138:A:1", "Beorning Guardian: after his attack destroys an enemy, discard him to place its printed Threat in progress", (effects) => {
    const { tab, run: attack, card, enemy } = guardian(effects, PREY, "guardian");
    expect(attack.state.cards[enemy]?.zone).not.toBe("engaged");
    expect(triggers(attack.state, tab)).toContain("17138:response:1");
    let run = sendUnledgered(attack, { type: "Trigger", cardId: card, effectId: "17138:response:1" }, tab.ctx);
    expect(run.state.cards[card]?.zone).toBe("discard");
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, LOC), idsOf(tab, LOC2)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, LOC2) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, LOC2)]?.progress).toBe(2);
    expect(run.state.cards[idsOf(tab, LOC)]?.progress).toBe(0);
  });

  // The attack does not destroy the Wall: no Response.
  it("17138:A:1 Beorning Guardian: not offered when the attack destroys no enemy", () => {
    const { tab, run } = guardian(EFFECTS, WALL, "guardian");
    expect(triggers(run.state, tab)).not.toContain("17138:response:1");
  });

  // Legolas alone destroys the Prey: the Guardian did not participate, so no Response.
  it("17138:A:1 Beorning Guardian: not offered when he did not participate in the attack", () => {
    const { tab, run, enemy } = guardian(EFFECTS, PREY, "legolas");
    expect(run.state.cards[enemy]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("17138:response:1");
  });
});

describe("Followed (17139:A:1, A:2, A:3)", () => {
  // Legolas (Tactics) pays; the Prey (printed Threat 2) and the Wall (printed Threat 2) are in the staging area.
  function followed(effects: readonly Effect[], seats: 1 | 2 = 1) {
    const tab = table(effects, { seats, heroes: [{ code: LEGOLAS, seat: 0 }, ...(seats === 2 ? [{ code: PAL, seat: 1 }] : [])], hand: [{ code: FOLLOWED, seat: 0 }], staging: [PREY, WALL] });
    const card = idsOf(tab, FOLLOWED);
    return { tab, card, prey: idsOf(tab, PREY), run: play(begin(tab.state), tab, card, "seat:0") };
  }
  // The optional engagement of the encounter phase: `seat` engages the enemy.
  const engage = (tab: Table, state: Table["state"], enemy: string, seat = 0) => {
    const run = enter(state, tab, "optionalEngage");
    return sendUnledgered({ ...run, state: { ...run.state, activeSeat: seat } }, { type: "Engage", enemyId: enemy }, tab.ctx);
  };

  // "Play into your play area unattached.": the only place offered is the player's play area (no hero), and the card lies there, attached
  // to nothing.
  lineSpec("17139:A:1", "Followed: played into your play area unattached", (effects) => {
    const { tab, card, run } = followed(effects);
    expect(hosts(tab, card)).toEqual(["seat:0"]);
    expect(run.state.cards[card]).toMatchObject({ zone: "play", host: null, controller: 0 });
  });

  // "While unattached, attach to the next eligible enemy that engages you.": the Prey engages the player and Followed attaches to it.
  lineSpec("17139:A:2", "Followed: attaches to the next enemy that engages you", (effects) => {
    const { tab, card, prey, run } = followed(effects);
    const engaged = engage(tab, run.state, prey);
    expect(engaged.state.cards[prey]?.zone).toBe("engaged");
    expect(engaged.state.cards[card]?.host).toBe(prey);
  });

  // An enemy that engages the other player does not take it.
  it("17139:A:2 Followed: does not attach to an enemy that engages another player", () => {
    const { tab, card, prey, run } = followed(EFFECTS, 2);
    const engaged = engage(tab, run.state, prey, 1);
    expect(engaged.state.cards[prey]?.zone).toBe("engaged");
    expect(engaged.state.cards[card]?.host).toBeNull();
  });

  // "While attached enemy is engaged with you, reduce the total Threat in the staging area by X, where X is attached enemy's printed
  // Threat.": the Prey engaged with Followed attached, the Wall (Threat 2) left in the staging area counts 2 - 2 = 0.
  lineSpec("17139:A:3", "Followed: the total Threat in the staging area is reduced by the attached enemy's printed Threat", (effects) => {
    const { tab, card, prey, run } = followed(effects);
    const engaged = engage(tab, run.state, prey);
    expect(engaged.state.cards[card]?.host).toBe(prey);
    expect(stagingThreat(engaged.state, tab.ctx.cards)).toBe(0);
  });
});

describe("Emyn Arnen Ranger (17141:A:1)", () => {
  // The Ranger quests; a Prey with a Snare (a Trap) is in the staging area, another Prey with a Snare is engaged with the player, the Wall
  // (no Trap) is in the staging area.
  function ranger(effects: readonly Effect[], traps = true) {
    const scene = table(effects, { start: "quest", heroes: [{ code: BERAVOR, seat: 0 }], allies: [{ code: RANGER, seat: 0 }, ...(traps ? [{ code: SNARE, seat: 0 }, { code: SNARE, seat: 0 }] : [])], staging: [PREY, WALL], engaged: [{ code: PREY, seat: 0 }], deck: ["f0", "f0"] });
    const [staged = "", engaged = ""] = scene.ids[PREY] ?? [];
    const [first = "", second = ""] = scene.ids[SNARE] ?? [];
    const tab = traps ? attach(scene, [[first, staged], [second, engaged]]) : scene;
    const card = idsOf(tab, RANGER);
    return { tab, card, staged, engaged, run: sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [card] }, tab.ctx) };
  }

  // "Response: After Emyn Arnen Ranger commits to the quest, choose an enemy with a Trap attachment. Until the end of the phase, Emyn Arnen
  // Ranger gets +X Willpower, where X is the chosen enemy's printed Threat.": the two enemies with a Snare are offered, the Wall is not;
  // the Ranger (Willpower 0) gets +2 until the quest phase ends.
  lineSpec("17141:A:1", "Emyn Arnen Ranger: after he commits, +X Willpower until the end of the phase, X a trapped enemy's printed Threat", (effects) => {
    const { tab, card, staged, engaged, run: committed } = ranger(effects);
    expect(triggers(committed.state, tab)).toContain("17141:response:1");
    let run = sendUnledgered(committed, { type: "Trigger", cardId: card, effectId: "17141:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([engaged, staged].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: engaged }, tab.ctx);
    expect(stat(run.state, tab, card, "willpower")).toBe(2);
    expect(stat(withMode(run.state, "travel"), tab, card, "willpower")).toBe(0);
  });

  // No enemy with a Trap attachment: no Response.
  it("17141:A:1 Emyn Arnen Ranger: not offered with no enemy with a Trap attachment", () => {
    const { tab, run } = ranger(EFFECTS, false);
    expect(triggers(run.state, tab)).not.toContain("17141:response:1");
  });
});

describe("Magic Ring (17143:A:1, A:2)", () => {
  // "Attach to a hero. Limit 1 per hero and 1 per deck.": both heroes are offered, the ally is not; once a Ring is on Aragorn the second is
  // offered only Éowyn.
  lineSpec("17143:A:1", "Magic Ring: Attach to a hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: fillers(RING, 2) });
    const [first = "", second = ""] = tab.ids[RING] ?? [];
    const [aragorn, eowyn] = [idsOf(tab, ARAGORN), idsOf(tab, EOWYN)];
    expect(hosts(tab, first)).toEqual([aragorn, eowyn].sort());
    const run = play(begin(tab.state), tab, first, aragorn);
    expect(run.state.cards[first]?.host).toBe(aragorn);
    expect(hosts(tab, second, run.state)).toEqual([eowyn]);
  });

  // "1 per deck": a deck of one Magic Ring saves, one of two is refused.
  it("17143:A:1 Magic Ring: 1 per deck", () => {
    const row = packRow("CoP", RING);
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: RING, count: 1 }], deckSaveFacts(row))).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: RING, count: 2 }], deckSaveFacts(row))).toMatchObject({ cardCode: RING });
  });

  // Aragorn with the Ring, damaged and exhausted as asked.
  function ring(effects: readonly Effect[], damage: number, exhausted: boolean) {
    const scene = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], attached: [{ code: RING, host: ARAGORN }] });
    const aragorn = idsOf(scene, ARAGORN);
    const tab = { ...scene, state: updateCard(scene.state, aragorn, { damage, exhausted }) };
    return { tab, aragorn, card: idsOf(tab, RING), run: sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, RING), effectId: "17143:action:1" }, tab.ctx) };
  }

  // "Action: Exhaust Magic Ring and raise your threat by 1 to (choose 1): heal 1 damage from attached hero, add 1 resource to attached
  // hero's pool, or ready attached hero.": a damaged, exhausted Aragorn is offered the three; each choice does only its own part, and each
  // time the Ring is exhausted and the threat goes from 8 to 9.
  lineSpec("17143:A:2", "Magic Ring: exhaust it and raise your threat by 1 to heal 1, add 1 resource or ready the hero", (effects) => {
    for (const [option, expected] of [["heal", { damage: 1, resources: 6, exhausted: true }], ["resource", { damage: 2, resources: 7, exhausted: true }], ["ready", { damage: 2, resources: 6, exhausted: false }]] as const) {
      const { tab, aragorn, card, run: triggered } = ring(effects, 2, true);
      expect(choices(triggered.state, tab).sort()).toEqual(["heal", "ready", "resource"]);
      const run = sendUnledgered(triggered, { type: "Choose", optionId: option }, tab.ctx);
      expect(run.state.cards[aragorn]).toMatchObject(expected);
      expect(run.state.cards[card]?.exhausted).toBe(true);
      expect(run.state.seats[0]?.threat).toBe(9);
    }
  });

  // An undamaged, ready Aragorn: heal and ready change nothing, so only the resource is left and the engine takes it.
  it("17143:A:2 Magic Ring: with no damage and the hero ready, only the resource", () => {
    const { aragorn, run } = ring(EFFECTS, 0, false);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[aragorn]?.resources).toBe(7);
  });
});
