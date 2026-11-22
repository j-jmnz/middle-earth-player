// Rules: rr.attachment-cards, rr.hit-points, rr.restricted, rr.active-location, rr.explored, rr.step-3-4, rr.action,
// rr.response, rr.limits, rr.unique-cards, wor.guarded-x (data/rules/entries.json).
// The Withered Heath attachments, written from their card text (data/cards/TWH.json; data/printed holds no ledger for these cards yet):
// Squire's Helm 19003:A:1 to A:3, Woodmen's Clearing 19006:A:1 and A:2, Grey Cloak 19009:A:1 and A:2, The Arkenstone 19010:A:1 to A:4.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents, legalTargets, type ReduceContext } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const HELM = "19003";
const CLEARING = "19006";
const CLOAK = "19009";
const ARKENSTONE = "19010";
// Dúnhere: a Spirit hero that is not a Scout. Snowbourn Scout: a Leadership Scout ally. Lórien Guide: a Spirit Scout ally.
const DUNHERE = "01009";
const SNOWBOURN = "01016";
const GUIDE = "01044";
// A treachery and a location of scenario 1's encounter deck, for the Arkenstone's guard.
const CRAWLING = "141041";
const GREEN_HILL = "141036";
const ALLY = "ally";
const PAL = "pal";
// A unique Lore hero that is neither Spirit nor a Scout; a unique ally; a unique enemy that engages at the threat of 8 (the Cheap enemy
// of the starter scene engages too, at 2).
const SAGE = "sage";
const CHAMPION = "champion";
const CHEAP = "cheap";
const CHIEF = "chief";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([HELM, CLEARING, CLOAK, ARKENSTONE, DUNHERE, SNOWBOURN, GUIDE, CRAWLING, GREEN_HILL]))]);
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", isUnique: true, threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(CHAMPION, definePrinted({ code: CHAMPION, name: "Champion", type: "ally", sphere: "leadership", cost: 2, isUnique: true, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(CHIEF, definePrinted({ code: CHIEF, name: "Chief", type: "enemy", isUnique: true, threat: 1, engagementCost: 3, attack: 2, defense: 1, health: 6 }));
  base = { ...starter, cards };
});

function hosts(tab: Table, cardId: string): string[] {
  return [...legalTargets(tab.state, { type: "PlayCard", cardId }, tab.ctx)].sort();
}

// Attaches cards the scene put in play to the hosts named, then brings the constants up to date.
function attach(tab: Table, pairs: readonly (readonly [string, string])[]): Table {
  let state = tab.state;
  for (const [id, host] of pairs) state = attachTo(state, id, host);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

// Passes the open action and response windows until the game asks for something else.
function passAll(run: Run, ctx: ReduceContext): Run {
  let next = run;
  const open = (state: ScenarioState) => (state.window?.kind === "frameAction" || state.window?.kind === "response" || state.window?.kind === "optionalEngage") && legalIntents(state, ctx).some((intent) => intent.type === "Pass");
  for (let guard = 0; guard < 30 && open(next.state); guard += 1) next = sendUnledgered(next, { type: "Pass" }, ctx);
  return next;
}

const printed = (tab: Table, code: string, which: "health" | "willpower"): number => tab.ctx.cards.get(code)?.[which] ?? 0;

describe("Squire's Helm (19003)", () => {
  // "Attach to an ally. Restricted. Limit 1 per ally.": the Snowbourn Scout and the Champion; not the heroes, nor the ally that wears
  // a Helm already.
  for (const line of ["19003:A:1", "19003:A:2"]) {
    lineSpec(line, "goes on an ally, one per ally, and not on a hero", (effects) => {
      const scene = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }, { code: CHAMPION, seat: 0 }, { code: ALLY, seat: 0 }, { code: HELM, seat: 0 }], hand: [{ code: HELM, seat: 0 }] });
      const [worn, held] = scene.ids[HELM] ?? [];
      const tab = attach(scene, [[worn ?? "", idsOf(scene, ALLY)]]);
      expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, SNOWBOURN), idsOf(tab, CHAMPION)].sort());
    });
  }

  // "Attached ally gets +2 hit points.": played on the Champion, it has 2 more hit points; the other ally keeps its own.
  lineSpec("19003:A:3", "the attached ally gets +2 hit points", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }], allies: [{ code: CHAMPION, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HELM, seat: 0 }] });
    const helm = idsOf(tab, HELM);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: helm, hostId: idsOf(tab, CHAMPION), payments: payFor(tab.state, tab.ctx, helm) }, tab.ctx);
    expect(stat(run.state, tab, idsOf(tab, CHAMPION), "hitPoints")).toBe(printed(tab, CHAMPION, "health") + 2);
    expect(stat(run.state, tab, idsOf(tab, ALLY), "hitPoints")).toBe(printed(tab, ALLY, "health"));
  });
});

describe("Woodmen's Clearing (19006)", () => {
  // "Attach to a location. Limit 1 per location.": the staged Green Hill Country; not the active one, which has a Clearing already, nor
  // a character.
  lineSpec("19006:A:1", "goes on a location, one per location, and not on a character", (effects) => {
    const scene = table(effects, { heroes: [{ code: SAGE, seat: 0 }], allies: [{ code: ALLY, seat: 0 }, { code: CLEARING, seat: 0 }], staging: [GREEN_HILL], active: GREEN_HILL, hand: [{ code: CLEARING, seat: 0 }] });
    const [staged, active] = scene.ids[GREEN_HILL] ?? [];
    const [held, inHand] = scene.ids[CLEARING] ?? [];
    const tab = attach(scene, [[held ?? "", active ?? ""]]);
    expect(hosts(tab, inHand ?? "")).toEqual([staged ?? ""]);
  });

  // "Response: When attached location leaves play as an explored location, the first player reduces his threat by 3.": the active
  // location with the Clearing is explored by the quest; the first player (the second seat) lowers its threat by 3, the Clearing's own
  // player does not.
  lineSpec("19006:A:2", "the first player lowers his threat by 3 when the location is explored", (effects) => {
    const scene = table(effects, { seats: 2, start: "quest", heroes: [{ code: SAGE, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: CLEARING, seat: 0 }], active: GREEN_HILL });
    const location = idsOf(scene, GREEN_HILL);
    const tab = attach({ ...scene, state: { ...updateCard(scene.state, location, { progress: 2 }), firstPlayer: 1 } }, [[idsOf(scene, CLEARING), location]]);
    const threats = tab.state.seats.map((seat) => seat.threat);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, SAGE)] }, tab.ctx);
    for (let guard = 0; guard < 20 && !triggers(run.state, tab).includes("19006:response:1") && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    }
    expect(run.state.cards[location]?.zone).not.toBe("activeLocation");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, CLEARING), effectId: "19006:response:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: choices(run.state, tab)[0] ?? "" }, tab.ctx);
    expect(run.state.seats[1]?.threat).toBe((threats[1] ?? 0) - 3);
    expect(run.state.seats[0]?.threat).toBe(threats[0]);
  });
});

describe("Grey Cloak (19009)", () => {
  // "Attach to a Spirit or Scout character. Limit 1 per character.": Dúnhere (Spirit), the Snowbourn Scout (Scout) and the Lórien Guide
  // (both); not the Sage (Lore) or the plain ally, nor a second Spirit ally that wears a Cloak already.
  lineSpec("19009:A:1", "goes on a Spirit or a Scout character, one per character", (effects) => {
    const scene = table(effects, { heroes: [{ code: DUNHERE, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }, { code: GUIDE, seat: 0 }, { code: GUIDE, seat: 0 }, { code: ALLY, seat: 0 }, { code: CLOAK, seat: 0 }], hand: [{ code: CLOAK, seat: 0 }] });
    const [worn, held] = scene.ids[CLOAK] ?? [];
    const [guide, cloaked] = scene.ids[GUIDE] ?? [];
    const tab = attach(scene, [[worn ?? "", cloaked ?? ""]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, DUNHERE), idsOf(tab, SNOWBOURN), guide ?? ""].sort());
  });

  // The encounter phase opens with the Cheap enemy (engagement cost 2, under the threat of 8) and the unique Chief in the staging area;
  // Dúnhere wears the Cloak. The player declines the optional engagement, and the action window before the engagement checks is open.
  function scene(effects: readonly Effect[], staging: readonly string[] = [CHEAP, CHIEF]): { tab: Table; run: Run } {
    const tab = table(effects, { start: "encounter", heroes: [{ code: DUNHERE, seat: 0 }, { code: SAGE, seat: 0 }], attached: [{ code: CLOAK, host: DUNHERE }], staging });
    return { tab, run: sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx) };
  }

  // "Encounter Action: Exhaust attached character and discard Grey Cloak to choose a non-unique enemy in the staging area. That enemy
  // does not make engagement checks against you this phase.": the Cheap enemy is the only choice (the Chief is unique); Dúnhere exhausts,
  // the Cloak is discarded, and the engagement checks engage the Chief and leave the Cheap enemy in the staging area.
  lineSpec("19009:A:2", "exhausts the character and discards the Cloak, and the chosen enemy makes no engagement check this phase", (effects) => {
    const { tab, run: open } = scene(effects);
    const [cheap, chief, dunhere, cloak] = [idsOf(tab, CHEAP), idsOf(tab, CHIEF), idsOf(tab, DUNHERE), idsOf(tab, CLOAK)];
    let run = sendUnledgered(open, { type: "Trigger", cardId: cloak, effectId: "19009:action:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).toEqual([cheap]);
      run = sendUnledgered(run, { type: "Choose", optionId: cheap }, tab.ctx);
    }
    expect(run.state.cards[dunhere]?.exhausted).toBe(true);
    expect(run.state.cards[cloak]?.zone).toBe("discard");
    run = passAll(run, tab.ctx);
    expect(run.state.cards[chief]?.zone).toBe("engaged");
    expect(run.state.cards[cheap]?.zone).toBe("staging");
  });

  // Without it, both enemies engage; and the Encounter Action is not offered in the planning phase, nor with only a unique enemy staged.
  it("19009:A:2 is an Encounter Action, and needs a non-unique enemy in the staging area", () => {
    const { tab, run } = scene(EFFECTS);
    expect(triggers(run.state, tab)).toContain("19009:action:1");
    expect(passAll(run, tab.ctx).state.cards[idsOf(tab, CHEAP)]?.zone).toBe("engaged");
    expect(triggers(table(EFFECTS, { heroes: [{ code: DUNHERE, seat: 0 }], attached: [{ code: CLOAK, host: DUNHERE }], staging: [CHEAP] }).state, tab)).not.toContain("19009:action:1");
    const unique = scene(EFFECTS, [CHIEF]);
    expect(triggers(unique.run.state, unique.tab)).not.toContain("19009:action:1");
  });
});

describe("The Arkenstone (19010:A:1, A:2)", () => {
  // Played, the Arkenstone goes to the staging area's pseudo host and searches for its guard: the encounter deck holds a treachery over
  // the guard named.
  function guarded(effects: readonly Effect[], guard: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: ARKENSTONE, seat: 0 }], deck: [CRAWLING, guard] });
    const stone = idsOf(tab, ARKENSTONE);
    const [hostId] = hosts(tab, stone);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: stone, hostId, payments: payFor(tab.state, tab.ctx, stone) }, tab.ctx);
    return { tab, run };
  }

  // "Guarded (enemy or location).": cards come off the encounter deck until a location, which is added to the staging area with the
  // Arkenstone attached to it, out of play (wor.guarded-x); the treachery above it is discarded.
  lineSpec("19010:A:1", "is guarded by the first enemy or location of the encounter deck", (effects) => {
    const { tab, run } = guarded(effects, GREEN_HILL);
    const stone = idsOf(tab, ARKENSTONE);
    const location = idsOf(tab, GREEN_HILL);
    expect(run.state.cards[idsOf(tab, CRAWLING)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[location]?.zone).toBe("staging");
    expect(run.state.cards[location]?.attachments).toEqual([stone]);
    expect(run.state.cards[stone]?.host).toBe(location);
  });

  // "Attach to a hero.": once its guarding enemy is destroyed, the player attaches it to one of the heroes, not to the ally.
  lineSpec("19010:A:2", "once free of encounters, goes on a hero of the player's choice", (effects) => {
    const { tab, run: played } = guarded(effects, "f3");
    const stone = idsOf(tab, ARKENSTONE);
    const enemy = idsOf(tab, "f3");
    expect(played.state.cards[stone]?.host).toBe(enemy);
    let run = sendUnledgered(begin(placeDamage(played.state, enemy, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, PAL), idsOf(tab, SAGE)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, SAGE) }, tab.ctx);
    expect(run.state.cards[stone]).toMatchObject({ host: idsOf(tab, SAGE), zone: "play", controller: 0 });
  });
});

describe("The Arkenstone (19010:A:3, A:4)", () => {
  // Two players: the first holds the Arkenstone on the Pal (not unique), the Champion (unique) and a plain ally; the second has the Sage
  // (a unique hero) and a Champion of its own.
  function scene(effects: readonly Effect[]): Table {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SAGE, seat: 1 }], allies: [{ code: CHAMPION, seat: 0 }, { code: ALLY, seat: 0 }, { code: CHAMPION, seat: 1 }], attached: [{ code: ARKENSTONE, host: PAL }] });
    return tab;
  }

  // "Each unique character you control gains +1 Willpower.": the first player's Champion; not the Pal or the plain ally, which are not
  // unique, nor the second player's unique Sage and Champion.
  lineSpec("19010:A:3", "each unique character you control gets +1 Willpower", (effects) => {
    const tab = scene(effects);
    const [mine, theirs] = tab.ids[CHAMPION] ?? [];
    expect(stat(tab.state, tab, mine ?? "", "willpower")).toBe(printed(tab, CHAMPION, "willpower") + 1);
    expect(stat(tab.state, tab, idsOf(tab, ALLY), "willpower")).toBe(printed(tab, ALLY, "willpower"));
    expect(stat(tab.state, tab, theirs ?? "", "willpower")).toBe(printed(tab, CHAMPION, "willpower"));
    expect(stat(tab.state, tab, idsOf(tab, SAGE), "willpower")).toBe(printed(tab, SAGE, "willpower"));
  });

  // "Action: Reduce your threat by 2 to attach The Arkenstone to a hero controlled by another player and raise that player's threat by 2.
  // (Limit once per round.)": the first player's threat falls by 2, the Arkenstone goes on the Sage under the second player's control
  // (rr.attachment-cards), whose threat rises by 2 and whose unique characters then get the Willpower; it is not offered again this round.
  lineSpec("19010:A:4", "lowers your threat by 2 to give it to another player's hero and raise that player's threat by 2, once a round", (effects) => {
    const tab = scene(effects);
    const stone = idsOf(tab, ARKENSTONE);
    const [mine, theirs] = tab.ids[CHAMPION] ?? [];
    const threats = tab.state.seats.map((seat) => seat.threat);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: stone, effectId: "19010:action:1" }, tab.ctx);
    if (run.state.window?.kind === "choose") run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, SAGE) }, tab.ctx);
    expect(run.state.seats[0]?.threat).toBe((threats[0] ?? 0) - 2);
    expect(run.state.seats[1]?.threat).toBe((threats[1] ?? 0) + 2);
    expect(run.state.cards[stone]).toMatchObject({ host: idsOf(tab, SAGE), controller: 1 });
    expect(stat(run.state, tab, theirs ?? "", "willpower")).toBe(printed(tab, CHAMPION, "willpower") + 1);
    expect(stat(run.state, tab, mine ?? "", "willpower")).toBe(printed(tab, CHAMPION, "willpower"));
    expect(triggers({ ...run.state, activeSeat: 1 }, tab)).not.toContain("19010:action:1");
    // The next round the second player may give it back (the round ends and the next one begins).
    const next = settle({ ...withMode(run.state, "endRound"), window: null }, tab.ctx, []);
    expect(triggers({ ...withMode(next, "planning"), window: { kind: "pass" }, activeSeat: 1 }, tab)).toContain("19010:action:1");
  });

  // In a one-player game there is no hero of another player: the Action is not offered, and no threat is paid for nothing.
  it("19010:A:4 is not offered without another player's hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }, { code: SAGE, seat: 0 }], attached: [{ code: ARKENSTONE, host: PAL }] });
    expect(triggers(tab.state, tab)).not.toContain("19010:action:1");
  });
});
