// Rules: rr.attachment-cards, rr.modifiers, rr.sentinel, rr.hit-points, rr.active-location, rr.step-3-2, rr.step-1-2, wor.guarded-x
// (data/rules/entries.json).
// The Wilds of Rhovanion player attachments, each printed line tested from the words on the card (lineSpec,
// test/harness/line-spec.ts): 18007:A:1, 18007:A:2, 18008:A:1, 18009:A:1, 18009:A:3, 18010:A:1, 18010:A:2, 18011:A:1, 18011:A:2,
// 18011:A:3 (the lines of data/cards/TWoR.json).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, withMode, type ScenarioState } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { playCost } from "../../rules/player/attach.ts";
import { settle } from "../../rules/engine/machine.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, hosts, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const DENETHOR = "01010";
const SNOWBOURN = "01016";
const SPEARMAN = "01029";
const BOWMAN = "132003";
const BARD = "18002";
const SENTRY = "18003";
const LOOKOUT = "18004";
const WARRIOR = "18005";
const HAUBERK = "18007";
const KING = "18008";
const BOW = "18009";
const MAP = "18010";
const NECKLACE = "18011";
// A treachery and a location of scenario 1's encounter deck, for the Necklace's guard.
const CRAWLING = "141041";
// Caught in a Web: an encounter treachery that attaches itself to a hero.
const WEB = "01080";
const GREEN_HILL = "141036";
const WALL = "wall";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, THEODRED, GIMLI, DENETHOR, SNOWBOURN, SPEARMAN, BOWMAN, BARD, SENTRY, LOOKOUT, WARRIOR, HAUBERK, KING, BOW, MAP, NECKLACE, CRAWLING, GREEN_HILL, WEB];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  // An enemy no attack of these tests can damage, so only a card's own damage lands on it.
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

describe("Hauberk of Mail (18007)", () => {
  // "Attach to a Dale or Warrior character. Limit 1 per character.": Bard (Dale hero), the Gondorian Spearman (Warrior ally) and the
  // other player's Spearman are offered; Aragorn, a plain ally and a Redwater Sentry that already wears a Hauberk are not.
  lineSpec("18007:A:1", "Hauberk of Mail: Attach to a Dale or Warrior character, limit 1 per character", (effects) => {
    const scene = table(effects, {
      seats: 2,
      heroes: [{ code: ARAGORN, seat: 0 }, { code: BARD, seat: 0 }, { code: PAL, seat: 1 }],
      allies: [{ code: SPEARMAN, seat: 0 }, { code: SPEARMAN, seat: 1 }, { code: SENTRY, seat: 0 }, { code: ALLY, seat: 0 }, { code: HAUBERK, seat: 0 }],
      hand: [{ code: HAUBERK, seat: 0 }],
    });
    const [worn, held] = scene.ids[HAUBERK] ?? [];
    const tab = attach(scene, [[worn ?? "", idsOf(scene, SENTRY)]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, BARD), ...(tab.ids[SPEARMAN] ?? [])].sort());
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: held ?? "", hostId: idsOf(tab, BARD), payments: payFor(tab.state, tab.ctx, held ?? "") }, tab.ctx);
    expect(run.state.cards[held ?? ""]?.host).toBe(idsOf(tab, BARD));
  });

  // "Attached character gets +1 Defense (and +1 hit point if attached character has the sentinel keyword).": on Bard +1 Defense
  // only; on the Gondorian Spearman (printed Sentinel) +1 Defense and +1 hit point.
  lineSpec("18007:A:2", "Hauberk of Mail: +1 Defense, and +1 hit point with sentinel", (effects) => {
    const scene = table(effects, { heroes: [{ code: BARD, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: HAUBERK, seat: 0 }, { code: HAUBERK, seat: 0 }] });
    const [first, second] = scene.ids[HAUBERK] ?? [];
    const tab = attach(scene, [[first ?? "", idsOf(scene, BARD)], [second ?? "", idsOf(scene, SPEARMAN)]]);
    expect(stat(tab.state, tab, idsOf(tab, BARD), "defense")).toBe(printed(tab, BARD, "defense") + 1);
    expect(stat(tab.state, tab, idsOf(tab, BARD), "hitPoints")).toBe(printed(tab, BARD, "health"));
    expect(stat(tab.state, tab, idsOf(tab, SPEARMAN), "defense")).toBe(printed(tab, SPEARMAN, "defense") + 1);
    expect(stat(tab.state, tab, idsOf(tab, SPEARMAN), "hitPoints")).toBe(printed(tab, SPEARMAN, "health") + 1);
  });

  // The Redwater Sentry gains Sentinel from its Armor (18003:A:2), and the +1 hit point that hangs on that keyword is in the state
  // the PlayCard intent returns.
  it("18007:A:2 Hauberk of Mail: +1 hit point on a Redwater Sentry, which gains Sentinel from it, as soon as it is played", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BARD, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SENTRY, seat: 0 }], hand: [{ code: HAUBERK, seat: 0 }] });
    const sentry = idsOf(tab, SENTRY);
    // Free on the Sentry (18003:A:1).
    const played = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, HAUBERK), hostId: sentry, payments: [] }, tab.ctx);
    expect(stat(played.state, tab, sentry, "hitPoints")).toBe(printed(tab, SENTRY, "health") + 1);
  });
});

describe("King of Dale (18008:A:1)", () => {
  // "Attach to a Dale or Esgaroth hero.": Bard son of Brand (Dale) and Bard the Bowman (Esgaroth) are offered; Aragorn and the Warrior
  // of Dale (a Dale ally, not a hero) are not.
  lineSpec("18008:A:1", "King of Dale: Attach to a Dale or Esgaroth hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: BARD, seat: 0 }, { code: BOWMAN, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: WARRIOR, seat: 0 }], hand: [{ code: KING, seat: 0 }] });
    const king = idsOf(tab, KING);
    expect(hosts(tab, king)).toEqual([idsOf(tab, BARD), idsOf(tab, BOWMAN)].sort());
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: king, hostId: idsOf(tab, BOWMAN), payments: payFor(tab.state, tab.ctx, king) }, tab.ctx);
    expect(run.state.cards[king]?.host).toBe(idsOf(tab, BOWMAN));
  });
});

describe("King of Dale (18008:A:2)", () => {
  // Bard holds King of Dale and Hauberk of Mail, and with `web` also Caught in a Web (an encounter treachery); the Warrior of Dale
  // (Tactics, cost 3) is in hand. King of Dale's Action is triggered.
  function kingTable(effects: readonly Effect[], web: boolean): { tab: Table; run: Run; warrior: string; printedCost: number } {
    const scene = table(effects, { heroes: [{ code: BARD, seat: 0 }], attached: [{ code: KING, host: BARD }, { code: HAUBERK, host: BARD }], hand: [{ code: WARRIOR, seat: 0 }] }, 1);
    const bard = idsOf(scene, BARD);
    const made = spawn(scene.state, WEB, { zone: "attached" });
    const state = web ? attachTo(updateCard(made.state, made.id, { face: "up", controller: null }), made.id, bard) : scene.state;
    const tab = { ...scene, state: syncConstants(state, scene.ctx) };
    expect(tab.state.cards[bard]?.attachments).toHaveLength(web ? 3 : 2);
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, KING), effectId: "18008:action:1" }, tab.ctx);
    return { tab, run, warrior: idsOf(tab, WARRIOR), printedCost: tab.ctx.cards.get(WARRIOR)?.cost ?? 0 };
  }

  // "Planning Action: Exhaust King of Dale to reduce the cost of the next Dale ally you play this phase by 1 for each different player
  // attachment on attached hero. That ally does not require a resource match.": 2 player attachments, so the Warrior of Dale costs 1
  // and Bard (Spirit) pays it.
  lineSpec("18008:A:2", "King of Dale: 1 less for each different player attachment on the hero, no resource match", (effects) => {
    const { tab, run, warrior, printedCost } = kingTable(effects, false);
    expect(playCost(tab.state, warrior, 0, tab.ctx)).toBe(printedCost);
    expect(run.state.cards[idsOf(tab, KING)]?.exhausted).toBe(true);
    expect(playCost(run.state, warrior, 0, tab.ctx)).toBe(printedCost - 2);
    const played = sendUnledgered(run, { type: "PlayCard", cardId: warrior, payments: [{ heroId: idsOf(tab, BARD), amount: printedCost - 2 }] }, tab.ctx);
    expect(played.state.cards[warrior]?.zone).toBe("play");
  });

  // Caught in a Web, an encounter card attached to Bard, is not counted: with King of Dale and Hauberk of Mail the Warrior of Dale costs 3 - 2 = 1.
  it("18008:A:2 King of Dale: an encounter attachment on the hero is not counted", () => {
    const { tab, run, warrior, printedCost } = kingTable(EFFECTS, true);
    expect(playCost(run.state, warrior, 0, tab.ctx)).toBe(printedCost - 2);
  });
});

describe("Bow of Yew (18009)", () => {
  // "Attach to a Dale or Warrior character.": Bard (Dale hero), Gimli and Théodred (Warrior heroes), the Warrior of Dale and the
  // Gondorian Spearman are offered; Aragorn and a plain ally are not.
  lineSpec("18009:A:1", "Bow of Yew: Attach to a Dale or Warrior character", (effects) => {
    const tab = table(effects, {
      heroes: [{ code: GIMLI, seat: 0 }, { code: BARD, seat: 0 }, { code: THEODRED, seat: 0 }, { code: ARAGORN, seat: 0 }],
      allies: [{ code: WARRIOR, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: ALLY, seat: 0 }],
      hand: [{ code: BOW, seat: 0 }],
    });
    const bow = idsOf(tab, BOW);
    expect(hosts(tab, bow)).toEqual([GIMLI, BARD, THEODRED, WARRIOR, SPEARMAN].map((code) => idsOf(tab, code)).sort());
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: bow, hostId: idsOf(tab, WARRIOR), payments: payFor(tab.state, tab.ctx, bow) }, tab.ctx);
    expect(run.state.cards[bow]?.host).toBe(idsOf(tab, WARRIOR));
  });

  const attacking = (state: ScenarioState): ScenarioState => ({ ...withMode(state, "playerAttacks"), window: { kind: "playerAttack" }, activeSeat: 0 });

  // "Response: After attached character is declared as an attacker, exhaust Bow of Yew to deal 1 damage to the defending enemy.":
  // the Warrior of Dale with the Bow attacks the Wall (Defense 9), so only the Bow's 1 damage lands; the Bow is exhausted.
  lineSpec("18009:A:3", "Bow of Yew: after the attached character is declared as an attacker, exhaust it to deal 1 damage to the defending enemy", (effects) => {
    const scene = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: WARRIOR, seat: 0 }, { code: BOW, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const bow = idsOf(scene, BOW);
    const wall = idsOf(scene, WALL);
    const tab = attach(scene, [[bow, idsOf(scene, WARRIOR)]]);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, WARRIOR)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("18009:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: bow, effectId: "18009:response:1" }, tab.ctx);
    expect(run.state.cards[wall]?.damage).toBe(1);
    expect(run.state.cards[bow]?.exhausted).toBe(true);
    // Gimli, who holds no Bow, declares no Response.
    const other = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, GIMLI)] }, tab.ctx);
    expect(triggers(other.state, tab)).not.toContain("18009:response:1");
  });
});

describe("Map of Rhovanion (18010)", () => {
  // "Attach to a Dale or Scout character. Limit 1 per character.": Bard (Dale) and the Snowbourn Scout (Scout) are offered; Aragorn,
  // the Gondorian Spearman and a North Realm Lookout that already holds a Map are not.
  lineSpec("18010:A:1", "Map of Rhovanion: Attach to a Dale or Scout character, limit 1 per character", (effects) => {
    const scene = table(effects, {
      heroes: [{ code: DENETHOR, seat: 0 }, { code: BARD, seat: 0 }, { code: ARAGORN, seat: 0 }],
      allies: [{ code: SNOWBOURN, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: LOOKOUT, seat: 0 }, { code: MAP, seat: 0 }],
      hand: [{ code: MAP, seat: 0 }],
    });
    const [held, inHand] = scene.ids[MAP] ?? [];
    const tab = attach(scene, [[held ?? "", idsOf(scene, LOOKOUT)]]);
    expect(hosts(tab, inHand ?? "")).toEqual([idsOf(tab, BARD), idsOf(tab, SNOWBOURN)].sort());
  });

  // "Response: After attached character commits to the quest, place 1 progress on the active location."
  lineSpec("18010:A:2", "Map of Rhovanion: after the attached character commits, place 1 progress on the active location", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: BARD, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: MAP, host: BARD }], active: GREEN_HILL });
    const map = idsOf(tab, MAP);
    const active = idsOf(tab, GREEN_HILL);
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, BARD)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("18010:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: map, effectId: "18010:response:1" }, tab.ctx);
    expect(run.state.cards[active]?.progress).toBe(1);
    // Denethor, who holds no Map, commits alone: no Response.
    const other = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    expect(triggers(other.state, tab)).not.toContain("18010:response:1");
    // With no active location there is nowhere to place the progress: no Response.
    const empty = table(effects, { start: "quest", heroes: [{ code: BARD, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: MAP, host: BARD }] });
    expect(triggers(sendUnledgered(begin(empty.state), { type: "Commit", cardIds: [idsOf(empty, BARD)] }, empty.ctx).state, empty)).not.toContain("18010:response:1");
  });
});

describe("Necklace of Girion (18011)", () => {
  // Played, the Necklace goes to the staging area's pseudo host and searches for its guard: the encounter deck holds a treachery
  // over the guard named.
  function guarded(effects: readonly Effect[], guard: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: NECKLACE, seat: 0 }], deck: [CRAWLING, guard] });
    const necklace = idsOf(tab, NECKLACE);
    const [hostId] = hosts(tab, necklace);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: necklace, hostId, payments: payFor(tab.state, tab.ctx, necklace) }, tab.ctx);
    return { tab, run };
  }

  // "Guarded (enemy or location).": cards come off the encounter deck until an enemy or location, which is added to the staging area
  // with the Necklace attached to it, out of play (wor.guarded-x); the treachery above it is discarded.
  lineSpec("18011:A:1", "Necklace of Girion: Guarded (enemy or location)", (effects) => {
    const { tab, run } = guarded(effects, GREEN_HILL);
    const necklace = idsOf(tab, NECKLACE);
    const location = idsOf(tab, GREEN_HILL);
    expect(run.state.cards[idsOf(tab, CRAWLING)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[location]?.zone).toBe("staging");
    expect(run.state.cards[location]?.attachments).toEqual([necklace]);
    expect(run.state.cards[necklace]?.zone).toBe("setAside");
    expect(run.state.cards[necklace]?.host).toBe(location);
  });

  // "Once free of encounters, its owner gains control of it and attaches it to an eligible card" (wor.guarded-x): the guarding enemy
  // is destroyed and the player attaches the Necklace. "Attach to a hero." makes the eligible cards the player's heroes, not the ally.
  lineSpec("18011:A:2", "Necklace of Girion: Attach to a hero, once free of encounters", (effects) => {
    const { tab, run: played } = guarded(effects, "f3");
    const necklace = idsOf(tab, NECKLACE);
    const enemy = idsOf(tab, "f3");
    expect(played.state.cards[necklace]?.host).toBe(enemy);
    let run = sendUnledgered(begin(placeDamage(played.state, enemy, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, ARAGORN), idsOf(tab, DENETHOR)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, DENETHOR) }, tab.ctx);
    expect(run.state.cards[necklace]?.host).toBe(idsOf(tab, DENETHOR));
    expect(run.state.cards[necklace]?.zone).toBe("play");
  });

  // "Attached hero gets +2 Willpower and collects an additional resource during the resource phase."
  lineSpec("18011:A:3", "Necklace of Girion: +2 Willpower and an additional resource in the resource phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: NECKLACE, host: ARAGORN }] }, 0);
    expect(stat(tab.state, tab, idsOf(tab, ARAGORN), "willpower")).toBe(printed(tab, ARAGORN, "willpower") + 2);
    expect(stat(tab.state, tab, idsOf(tab, DENETHOR), "willpower")).toBe(printed(tab, DENETHOR, "willpower"));
    const after = settle({ ...withMode(tab.state, "resourceGrant"), phase: "Resource", window: null }, tab.ctx, []);
    expect(after.cards[idsOf(tab, ARAGORN)]?.resources).toBe(2);
    expect(after.cards[idsOf(tab, DENETHOR)]?.resources).toBe(1);
  });
});
