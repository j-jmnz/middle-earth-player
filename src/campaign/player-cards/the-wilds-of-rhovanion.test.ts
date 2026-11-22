// Rules: rr.modifiers, rr.resource-match, rr.sentinel, rr.ranged, rr.attachment-cards, rr.step-3-2 (data/rules/entries.json).
// The Wilds of Rhovanion heroes and allies, each printed line tested from the words on the card (lineSpec,
// test/harness/line-spec.ts): 18001:A:1, 18002:A:1, 18003:A:1, 18003:A:2, 18004:A:1, 18005:A:1, 18005:A:2, 18006:A:1 (the lines of
// data/cards/TWoR.json; the events are in the-wilds-of-rhovanion-events.test.ts, the attachments in
// the-wilds-of-rhovanion-attachments.test.ts).
import { beforeAll, describe, expect } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { hasKeyword, modifiedStat } from "../../rules/core/keywords.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { playCost } from "../../rules/player/attach.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext } from "../../rules/engine/reduce.ts";
import { fund, payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, buildTable, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";

const ARAGORN = "01001";
const GIMLI = "01004";
const DENETHOR = "01010";
const STEWARD = "01026";
const SPEARMAN = "01029";
const PLATE = "01040";
const BRAND = "18001";
const BARD = "18002";
const SENTRY = "18003";
const LOOKOUT = "18004";
const WARRIOR = "18005";
const TRADER = "18006";
const HAUBERK = "18007";
const BOW = "18009";
const MAP = "18010";
// Warrior Sword: a Tactics Weapon of cost 1 for a Tactics or Warrior character.
const SWORD = "19089";
const NECKLACE = "18011";
const GREEN_HILL = "141036";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, GIMLI, DENETHOR, SPEARMAN, STEWARD, PLATE, BRAND, BARD, SENTRY, LOOKOUT, WARRIOR, TRADER, HAUBERK, BOW, MAP, SWORD, NECKLACE, GREEN_HILL];
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted(codes))]) };
});

function table(effects: readonly Effect[], scene: Scene, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene, effects });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

// Attaches cards the scene put in play to the hosts named (the scene attaches only to heroes), then brings the constants up to date.
function attach(tab: Table, pairs: readonly (readonly [string, string])[]): Table {
  let state = tab.state;
  for (const [id, host] of pairs) state = attachTo(state, id, host);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

// The Wilds of Rhovanion cards have no scan-read ledger yet (data/printed), so the harness's cause check (scene.ts send) refuses
// their steps: these tests send through the reducer directly, as the Beechbone tests do (src/campaign/starter/tactics.test.ts).
function step(run: Run, intent: PlayerIntent, ctx: ReduceContext): Run {
  const result = expectOk(reduce(run.state, intent, ctx));
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

function stat(state: ScenarioState, tab: Table, id: string, which: "attack" | "defense" | "hitPoints" | "willpower"): number {
  const card = state.cards[id];
  if (!card) throw new Error(`no card ${id}`);
  return modifiedStat(state, card, which, tab.ctx.cards);
}

function printed(tab: Table, code: string, which: "attack" | "defense" | "health" | "willpower"): number {
  return tab.ctx.cards.get(code)?.[which] ?? 0;
}

function choices(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

describe("Brand son of Bain (18001:A:1)", () => {
  // "Each Dale character you control with a player attachment gets +1 Willpower.": Bard (Dale, Hauberk) and a Warrior of Dale (Dale,
  // Bow) get it; Brand and a Warrior of Dale without an attachment, Aragorn (not Dale) with Citadel Plate, and the other player's
  // Warrior of Dale with a Bow do not.
  lineSpec("18001:A:1", "Brand son of Bain: each Dale character you control with a player attachment gets +1 Willpower", (effects) => {
    const scene = table(effects, {
      seats: 2,
      heroes: [{ code: BRAND, seat: 0 }, { code: BARD, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }],
      attached: [{ code: HAUBERK, host: BARD }, { code: PLATE, host: ARAGORN }],
      allies: [{ code: WARRIOR, seat: 0 }, { code: WARRIOR, seat: 0 }, { code: WARRIOR, seat: 1 }, { code: BOW, seat: 0 }, { code: BOW, seat: 1 }],
    });
    const [armed, bare, theirs] = scene.ids[WARRIOR] ?? [];
    const [mine, other] = scene.ids[BOW] ?? [];
    const tab = attach(scene, [[mine ?? "", armed ?? ""], [other ?? "", theirs ?? ""]]);
    const willpower = (id: string) => stat(tab.state, tab, id, "willpower");
    expect(willpower(idsOf(tab, BARD))).toBe(printed(tab, BARD, "willpower") + 1);
    expect(willpower(armed ?? "")).toBe(printed(tab, WARRIOR, "willpower") + 1);
    expect(willpower(idsOf(tab, BRAND))).toBe(printed(tab, BRAND, "willpower"));
    expect(willpower(bare ?? "")).toBe(printed(tab, WARRIOR, "willpower"));
    expect(willpower(idsOf(tab, ARAGORN))).toBe(printed(tab, ARAGORN, "willpower"));
    expect(willpower(theirs ?? "")).toBe(printed(tab, WARRIOR, "willpower"));
  });
});

describe("Bard son of Brand (18002:A:1)", () => {
  // "While playing an Item attachment, Bard son of Brand is considered to have the printed Leadership, Lore, and Tactics icons.": Bard
  // (Spirit) alone pays for Hauberk of Mail (Leadership Item) and Map of Rhovanion (Lore Item) on himself and for Warrior Sword
  // (Tactics Item) on the Gondorian Spearman (a Warrior); not for Steward of Gondor (a Leadership Title) nor for a Leadership ally.
  lineSpec("18002:A:1", "Bard son of Brand: Leadership, Lore and Tactics icons while playing an Item attachment", (effects) => {
    const tab = table(effects, { heroes: [{ code: BARD, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: HAUBERK, seat: 0 }, { code: MAP, seat: 0 }, { code: SWORD, seat: 0 }, { code: STEWARD, seat: 0 }, { code: ALLY, seat: 0 }] });
    const bard = idsOf(tab, BARD);
    const play = (code: string, amount: number, hostId?: string): PlayerIntent => ({ type: "PlayCard", cardId: idsOf(tab, code), ...(hostId ? { hostId } : {}), payments: [{ heroId: bard, amount }] });
    for (const code of [HAUBERK, MAP]) expect(refusal(tab.state, play(code, 1, bard), tab.ctx)).toBeNull();
    expect(refusal(tab.state, play(SWORD, 1, idsOf(tab, SPEARMAN)), tab.ctx)).toBeNull();
    const run = step(begin(tab.state), play(HAUBERK, 1, bard), tab.ctx);
    expect(run.state.cards[idsOf(tab, HAUBERK)]?.host).toBe(bard);
    expect(refusal(tab.state, play(STEWARD, 2, bard), tab.ctx)).toBe("No hero matches that card's sphere");
    expect(refusal(tab.state, play(ALLY, 1), tab.ctx)).toBe("No hero matches that card's sphere");
  });
});

describe("Redwater Sentry (18003)", () => {
  // "Reduce the cost to play Armor attachments on Redwater Sentry by 1.": Hauberk of Mail (Armor, cost 1) costs 0 onto the Sentry and
  // 1 onto Brand; Map of Rhovanion (an Item, not Armor) costs 1 onto the Sentry.
  lineSpec("18003:A:1", "Redwater Sentry: Armor attachments cost 1 less to play on it", (effects) => {
    const tab = table(effects, { heroes: [{ code: BRAND, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SENTRY, seat: 0 }], hand: [{ code: HAUBERK, seat: 0 }, { code: MAP, seat: 0 }] }, 1);
    const [sentry, brand, hauberk, map] = [idsOf(tab, SENTRY), idsOf(tab, BRAND), idsOf(tab, HAUBERK), idsOf(tab, MAP)];
    expect(playCost(tab.state, hauberk, 0, tab.ctx, sentry)).toBe(0);
    expect(playCost(tab.state, hauberk, 0, tab.ctx, brand)).toBe(1);
    expect(playCost(tab.state, map, 0, tab.ctx, sentry)).toBe(1);
    const run = step(begin(tab.state), { type: "PlayCard", cardId: hauberk, hostId: sentry, payments: [] }, tab.ctx);
    expect(run.state.cards[hauberk]?.host).toBe(sentry);
    expect(run.state.cards[brand]?.resources).toBe(1);
  });

  // "Redwater Sentry gets +1 Defense and gains Sentinel while it has an Armor attachment.": with Hauberk of Mail (Armor, +1 Defense
  // of its own) it has its printed Defense +2 and Sentinel; with Map of Rhovanion (not Armor) its printed Defense and no Sentinel.
  lineSpec("18003:A:2", "Redwater Sentry: +1 Defense and Sentinel while it has an Armor attachment", (effects) => {
    const scene = table(effects, { heroes: [{ code: BRAND, seat: 0 }], allies: [{ code: SENTRY, seat: 0 }, { code: SENTRY, seat: 0 }, { code: HAUBERK, seat: 0 }, { code: MAP, seat: 0 }] });
    const [armored, mapped] = scene.ids[SENTRY] ?? [];
    const tab = attach(scene, [[idsOf(scene, HAUBERK), armored ?? ""], [idsOf(scene, MAP), mapped ?? ""]]);
    expect(stat(tab.state, tab, armored ?? "", "defense")).toBe(printed(tab, SENTRY, "defense") + 2);
    expect(hasKeyword(tab.state, armored ?? "", "sentinel", tab.ctx.cards)).toBe(true);
    expect(stat(tab.state, tab, mapped ?? "", "defense")).toBe(printed(tab, SENTRY, "defense"));
    expect(hasKeyword(tab.state, mapped ?? "", "sentinel", tab.ctx.cards)).toBe(false);
  });
});

describe("North Realm Lookout (18004:A:1)", () => {
  // "North Realm Lookout gets +1 Willpower and does not exhaust to quest while it has an Item attachment": with Map of Rhovanion it has
  // its printed Willpower +1 and stays ready when it commits; without one it has its printed Willpower and exhausts.
  lineSpec("18004:A:1", "North Realm Lookout: +1 Willpower and does not exhaust to quest while it has an Item attachment", (effects) => {
    const scene = table(effects, { start: "quest", heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: LOOKOUT, seat: 0 }, { code: LOOKOUT, seat: 0 }, { code: MAP, seat: 0 }] });
    const [held, bare] = scene.ids[LOOKOUT] ?? [];
    const tab = attach(scene, [[idsOf(scene, MAP), held ?? ""]]);
    expect(stat(tab.state, tab, held ?? "", "willpower")).toBe(printed(tab, LOOKOUT, "willpower") + 1);
    expect(stat(tab.state, tab, bare ?? "", "willpower")).toBe(printed(tab, LOOKOUT, "willpower"));
    const run = step(begin(tab.state), { type: "Commit", cardIds: [held ?? "", bare ?? ""] }, tab.ctx);
    expect(run.state.cards[held ?? ""]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[bare ?? ""]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Warrior of Dale (18005)", () => {
  // "Reduce the cost to play Weapon attachments on Warrior of Dale by 1.": Warrior Sword (Weapon, cost 1) costs 0 onto the Warrior of
  // Dale and 1 onto Gimli; Hauberk of Mail (Armor, not a Weapon) costs 1 onto the Warrior of Dale.
  lineSpec("18005:A:1", "Warrior of Dale: Weapon attachments cost 1 less to play on it", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: BRAND, seat: 0 }], allies: [{ code: WARRIOR, seat: 0 }], hand: [{ code: SWORD, seat: 0 }, { code: HAUBERK, seat: 0 }] }, 1);
    const [warrior, gimli, sword, hauberk] = [idsOf(tab, WARRIOR), idsOf(tab, GIMLI), idsOf(tab, SWORD), idsOf(tab, HAUBERK)];
    expect(playCost(tab.state, sword, 0, tab.ctx, warrior)).toBe(0);
    expect(playCost(tab.state, sword, 0, tab.ctx, gimli)).toBe(1);
    expect(playCost(tab.state, hauberk, 0, tab.ctx, warrior)).toBe(1);
    const run = step(begin(tab.state), { type: "PlayCard", cardId: sword, hostId: warrior, payments: [] }, tab.ctx);
    expect(run.state.cards[sword]?.host).toBe(warrior);
    expect(run.state.cards[gimli]?.resources).toBe(1);
  });

  // "Warrior of Dale gets +1 Attack and gains ranged while it has a Weapon attachment.": with Bow of Yew it has its printed Attack +1
  // and Ranged; with Hauberk of Mail (not a Weapon) its printed Attack and no Ranged.
  lineSpec("18005:A:2", "Warrior of Dale: +1 Attack and ranged while it has a Weapon attachment", (effects) => {
    const scene = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: WARRIOR, seat: 0 }, { code: WARRIOR, seat: 0 }, { code: BOW, seat: 0 }, { code: HAUBERK, seat: 0 }] });
    const [armed, armored] = scene.ids[WARRIOR] ?? [];
    const tab = attach(scene, [[idsOf(scene, BOW), armed ?? ""], [idsOf(scene, HAUBERK), armored ?? ""]]);
    expect(stat(tab.state, tab, armed ?? "", "attack")).toBe(printed(tab, WARRIOR, "attack") + 1);
    expect(hasKeyword(tab.state, armed ?? "", "ranged", tab.ctx.cards)).toBe(true);
    expect(stat(tab.state, tab, armored ?? "", "attack")).toBe(printed(tab, WARRIOR, "attack"));
    expect(hasKeyword(tab.state, armored ?? "", "ranged", tab.ctx.cards)).toBe(false);
  });
});

describe("Long Lake Trader (18006:A:1)", () => {
  // "Action: Exhaust Long Lake Trader to move an Item attachment from a character you control to another eligible character.": the two
  // Maps of Rhovanion (Items) are offered, Steward of Gondor (a Title) is not; the Map on Bard may go to a Dale or Scout character
  // without a Map: the Trader or the North Realm Lookout, not Bard (its own host), Brand (who has a Map) or Aragorn (neither).
  lineSpec("18006:A:1", "Long Lake Trader: exhaust to move an Item attachment to another eligible character", (effects) => {
    const scene = table(effects, {
      heroes: [{ code: BARD, seat: 0 }, { code: BRAND, seat: 0 }, { code: ARAGORN, seat: 0 }],
      attached: [{ code: MAP, host: BARD }, { code: MAP, host: BRAND }, { code: STEWARD, host: ARAGORN }],
      allies: [{ code: TRADER, seat: 0 }, { code: LOOKOUT, seat: 0 }],
    });
    const tab = { ...scene, state: syncConstants(scene.state, scene.ctx) };
    const [onBard, onBrand] = tab.ids[MAP] ?? [];
    const trader = idsOf(tab, TRADER);
    const lookout = idsOf(tab, LOOKOUT);
    let run = step(begin(tab.state), { type: "Trigger", cardId: trader, effectId: "18006:action:1" }, tab.ctx);
    expect(run.state.cards[trader]?.exhausted).toBe(true);
    expect(choices(run.state, tab).sort()).toEqual([onBard ?? "", onBrand ?? ""].sort());
    run = step(run, { type: "Choose", optionId: onBard ?? "" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([trader, lookout].sort());
    run = step(run, { type: "Choose", optionId: lookout }, tab.ctx);
    expect(run.state.cards[onBard ?? ""]?.host).toBe(lookout);
    expect(run.state.cards[lookout]?.attachments).toEqual([onBard]);
    expect(run.state.cards[idsOf(tab, BARD)]?.attachments).toEqual([]);
  });

  // "to another eligible character": with Bard holding the only Map and the Trader the only other Dale or Scout character, the Map
  // may go to the Trader and not back onto Bard (a reading judge's finding, which this pins).
  lineSpec("18006:A:1", "Long Lake Trader: the Item goes to another character, not back onto its own host", (effects) => {
    const tab = table(effects, { heroes: [{ code: BARD, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: MAP, host: BARD }], allies: [{ code: TRADER, seat: 0 }] });
    const map = idsOf(tab, MAP);
    const trader = idsOf(tab, TRADER);
    // One Item and one eligible character: the engine makes both picks itself, so the move it made is what shows the reading.
    const run = step(begin(tab.state), { type: "Trigger", cardId: trader, effectId: "18006:action:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[map]?.host).toBe(trader);
    expect(run.state.cards[idsOf(tab, BARD)]?.attachments).toEqual([]);
  });

  // "from a character you control": the player's only Item is Necklace of Girion, guarded out of play on a location in the staging
  // area (wor.guarded-x). It is under the player's control but on no character, so the Action has nothing to move (a reading judge's
  // finding, which this pins).
  lineSpec("18006:A:1", "Long Lake Trader: an Item the player controls that is on no character is not offered", (effects) => {
    const tab = table(effects, { heroes: [{ code: BARD, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: TRADER, seat: 0 }, { code: LOOKOUT, seat: 0 }, { code: MAP, seat: 0 }], hand: [{ code: NECKLACE, seat: 0 }], deck: [GREEN_HILL] });
    const necklace = idsOf(tab, NECKLACE);
    const [hostId] = legalTargets(tab.state, { type: "PlayCard", cardId: necklace }, tab.ctx);
    const guarded = step(begin(tab.state), { type: "PlayCard", cardId: necklace, hostId, payments: payFor(tab.state, tab.ctx, necklace) }, tab.ctx);
    expect(guarded.state.cards[necklace]).toMatchObject({ zone: "setAside", host: idsOf(tab, GREEN_HILL), controller: 0 });
    expect(refusal(guarded.state, { type: "Trigger", cardId: idsOf(tab, TRADER), effectId: "18006:action:1" }, tab.ctx)).toBe("That effect cannot be triggered");
    // With a Map on the Lookout the Action is offered: the Map is the one Item it takes (the engine picks it itself) and the
    // Necklace stays on its guard.
    const withMap = attach({ ...tab, state: guarded.state }, [[idsOf(tab, MAP), idsOf(tab, LOOKOUT)]]);
    const run = step(begin(withMap.state), { type: "Trigger", cardId: idsOf(tab, TRADER), effectId: "18006:action:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, BARD), idsOf(tab, TRADER)].sort());
    expect(run.state.cards[necklace]).toMatchObject({ zone: "setAside", host: idsOf(tab, GREEN_HILL) });
  });
});
