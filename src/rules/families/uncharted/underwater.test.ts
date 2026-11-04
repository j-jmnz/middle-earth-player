// Rules: dcce.grotto-deck, dcce.stormcaller-elite, rr.play-and-put-into-play, rr.cannot (data/rules/entries.json). The Underwater sides and the mechanics the rest of The Drowned
// Ruins' lines need (ledger lines 12092:B:1, 12093:A:1, 12093:B:1, 12095:A:2, 12098:A:1, 12099:A:2, 12101:A:2, 12102:A:1, 12102:A:2, 12103:A:2, 12106:A:1), on the Drowned Ruins' table (test/scenarios/the-drowned-ruins/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { faceProblems } from "../../../../test/harness/face-check.ts";
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { CODES, finish, idOf, idsOf, loadRuinsWorld, resolveRecords, ruinsFight, ruinsTable, send, start, type RuinsLayout, type RuinsWorld } from "../../../../test/scenarios/the-drowned-ruins/scene.ts";
import { definePrinted } from "../../core/printed.ts";
import { settle } from "../../engine/machine.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { costReduction } from "../../player/cost-rules.ts";
import { flagged, readyBarred, updateCard } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { attachTo } from "../../core/zones.ts";
import { playBlocked } from "../sidequests/contract.ts";

let world: RuinsWorld;
beforeAll(async () => {
  world = await loadRuinsWorld();
  addStandIns(world.cards, ["undead", "raider"]);
  world.cards.set("creature", definePrinted({ code: "creature", name: "creature", type: "enemy", traits: ["Creature"], engagementCost: 50, threat: 1, attack: 1, defense: 1, health: 3 }));
  world.cards.set("att", definePrinted({ code: "att", name: "att", type: "attachment", sphere: "neutral", cost: 0 }));
});
const make = (layout: RuinsLayout = {}) => ruinsTable(world, { phase: "Quest", ...layout });
const SHRINE = { code: "12094", back: "12095", pile: "setAside" as const };
const UNDERWATER_ACTIVE: RuinsLayout["sided"] = [{ code: "12101", back: "12098", zone: "activeLocation" }];
const GROTTO_ACTIVE: RuinsLayout["sided"] = [{ code: "12098", back: "12101", zone: "activeLocation" }];

function run(made: ReturnType<typeof make>, instruction: Parameters<typeof runInstruction>[1], source?: string) {
  const steps: Parameters<typeof runInstruction>[4] = [];
  const next = runInstruction({ ...made.state, window: null }, instruction, { seat: 0, sourceId: source ?? made.state.questStage }, made.ctx, steps);
  return { state: settle(syncConstants(next, made.ctx), made.ctx, steps), steps };
}

describe("Sahír's Betrayal (12093:A:1)", () => {
  it("makes the set aside Shrine the active location, flips Sahír to his enemy side faceup, lets him attack the first player, then removes him from the game", () => {
    const made = make({ stage: "12093", doubleSided: [SHRINE], setAside: ["12094"], play: [CODES.captainSahir], deck: ["f0", "undead", "f0"] });
    const done = resolveRecords(made.state, made.ctx, "12093", "whenRevealed", made.state.questStage ?? undefined, undefined, false);
    // Sahír, flipped, attacks before he leaves: the defense window is open and he is still in the staging area, faceup.
    expect(done.state.window).toMatchObject({ kind: "defense", seat: 0 });
    const sahir = done.state.cards[done.state.window?.kind === "defense" ? done.state.window.enemyId : ""]!;
    expect(sahir).toMatchObject({ code: "11076", zone: "staging", face: "up", resources: 0 });
    expect(faceProblems(done.state)).toEqual([]);
    expect(done.state.cards[idOf(done.state, "12094")]).toMatchObject({ zone: "activeLocation", face: "up" });
    // The rest of the line follows the attack, as printed: no Undead enemy has been searched out yet.
    expect(done.state.staging.map((id) => done.state.cards[id]?.code)).not.toContain("undead");
    const over = send(done, { type: "Undefended", heroId: made.hero }, made.ctx);
    const after = finish(over, made.ctx).state;
    expect(after.cards[sahir.id]?.zone).toBe("removed");
    // Then the Undead enemy the search found joins the staging area faceup.
    expect(after.staging.map((id) => after.cards[id]?.code)).toContain("undead");
    expect(after.cards[made.hero]!.damage + after.cards[made.hero2]!.damage).toBeGreaterThan(0);
    expect(faceProblems(after)).toEqual([]);
  });
});

describe("Black Key on Captain Sahír (11183:A:2, 12093:A:1)", () => {
  it("gives Sahír +1 Attack as an objective ally, and not as the enemy he flips to", () => {
    const made = make({ stage: "12093", doubleSided: [SHRINE], setAside: ["12094"], play: [CODES.captainSahir, CODES.blackKey] });
    const sahir = idOf(made.state, CODES.captainSahir);
    const attack = (state: ScenarioState, id: string) => modifiedStat(state, state.cards[id]!, "attack", made.ctx.cards);
    const attached = syncConstants(attachTo(made.state, idOf(made.state, CODES.blackKey), sahir), made.ctx);
    expect(attack(attached, sahir)).toBe(attack(syncConstants(made.state, made.ctx), sahir) + 1);
    const done = resolveRecords(attached, made.ctx, "12093", "whenRevealed", attached.questStage ?? undefined, undefined, false);
    const enemy = done.state.cards[done.state.window?.kind === "defense" ? done.state.window.enemyId : ""]!;
    expect(enemy).toMatchObject({ code: "11076", zone: "staging" });
    expect(done.state.cards[idOf(done.state, CODES.blackKey)]?.host).toBe(enemy.id);
    expect(attack(done.state, enemy.id)).toBe(made.ctx.cards.get("11076")?.attack);
  });
});

describe("the Grotto cards stay faceup", () => {
  it("adds from the Grotto deck, flips and travels without a facedown card in the staging area or the active location (12092:A:1, 12108:A:1, 12098:A:2)", () => {
    const pairs = [{ code: "12098", back: "12101", pile: "grottoDeck" as const }, { code: "12099", back: "12102", pile: "grottoDeck" as const }, { code: "12100", back: "12103", pile: "grottoDeck" as const }];
    const made = make({ doubleSided: pairs });
    const added = resolveRecords(made.state, made.ctx, "12092", "setup", idOf(made.state, "12092"));
    expect(added.state.staging.length).toBe(2);
    expect(faceProblems(added.state)).toEqual([]);
    const flipped = resolveRecords(added.state, made.ctx, "12108", "whenRevealed");
    expect(flipped.state.staging.length).toBe(4);
    expect(faceProblems(flipped.state)).toEqual([]);
    const one = flipped.state.staging.find((id) => made.ctx.cards.get(flipped.state.cards[id]?.code ?? "")?.traits.includes("Underwater"))!;
    const back = run({ ...made, state: flipped.state }, { verb: "FlipDoubleSided" }, one).state;
    expect(faceProblems(back)).toEqual([]);
    const active = updateCard({ ...back, activeLocation: one, staging: back.staging.filter((id) => id !== one) }, one, { zone: "activeLocation" });
    expect(faceProblems(active)).toEqual([]);
  });
});

describe("players cannot play attachments or allies (12092:B:1, 12093:B:1)", () => {
  it("bars every player from playing an ally while an Underwater location is active, but not from putting one into play (rr.play-and-put-into-play)", () => {
    for (const stage of ["12092", "12093"] as const) {
      const made = make({ seats: 2, stage, hand: ["ally"], sided: UNDERWATER_ACTIVE });
      const [first, second] = idsOf(made.state, "ally");
      expect(playBlocked(made.state, first!, 0, made.ctx)).toBe(true);
      expect(playBlocked(made.state, second!, 1, made.ctx)).toBe(true);
      expect(playBlocked(made.state, second!, 1, made.ctx, true)).toBe(false);
      const grotto = make({ seats: 2, stage, hand: ["ally"], sided: GROTTO_ACTIVE });
      expect(playBlocked(grotto.state, idsOf(grotto.state, "ally")[1]!, 1, grotto.ctx)).toBe(false);
    }
  });
});

describe("Undersea Grotto (12098:A:1)", () => {
  it("makes the first ally any player plays each round cost 1 less, whoever plays it", () => {
    const made = make({ seats: 2, hand: ["ally"], sided: GROTTO_ACTIVE });
    const [first, second] = idsOf(made.state, "ally");
    expect(costReduction(made.state, second!, 1, made.ctx).amount).toBe(1);
    expect(costReduction(made.state, first!, 0, made.ctx).amount).toBe(1);
    const played = { ...made.state, played: [{ id: first!, code: "ally", seat: 0, round: made.state.round }] };
    expect(costReduction(played, second!, 1, made.ctx).amount).toBe(0);
    const other = make({ seats: 2, hand: ["ally"], sided: UNDERWATER_ACTIVE });
    expect(costReduction(other.state, idsOf(other.state, "ally")[1]!, 1, other.ctx).amount).toBe(0);
  });
});

describe("Cursed Caverns (12099:A:2)", () => {
  it("lets a player raise threat by 2 to draw the bottom card of their deck, a real draw", () => {
    const made = make({ deckOf: ["f0", "f3", "place"] });
    const drawn = run(made, { verb: "Draw", from: "bottom" });
    expect(drawn.state.seats[0]?.hand.map((id) => drawn.state.cards[id]?.code)).toEqual(["place"]);
    expect(drawn.steps.filter((step) => step.kind === "draw")).toHaveLength(1);
    const top = run(made, { verb: "Draw" });
    expect(top.state.seats[0]?.hand.map((id) => top.state.cards[id]?.code)).toEqual(["f0"]);
    const record = resolveRecords(made.state, made.ctx, "12099", "response", made.state.questStage ?? undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("draw") ? "draw" : "") : ""));
    expect(record.state.seats[0]?.hand.map((id) => record.state.cards[id]?.code)).toEqual(["place"]);
    expect(record.state.seats[0]?.threat).toBe(30);
  });
});

describe("the most resources on one card (the City of Corsairs' X, 12161:A:1, phase 48)", () => {
  it("is the highest count on one Raider enemy, not the sum", () => {
    const made = make({ staging: [{ code: "raider", resources: 2 }, { code: "raider", resources: 5 }, { code: "f0", resources: 9 }] });
    const raider = { type: "enemy", control: "any", staging: true, trait: "Raider" } as const;
    const scope = frameScope(made.state, 0, null);
    expect(resolveAmount(made.state, { resourcesOn: raider }, scope, made.ctx)).toBe(7);
    expect(resolveAmount(made.state, { resourcesOn: raider, max: true }, scope, made.ctx)).toBe(5);
    expect(resolveAmount(make().state, { resourcesOn: raider, max: true }, frameScope(make().state, 0, null), made.ctx)).toBe(0);
  });
});

describe("Into the Abyss (12106:A:1)", () => {
  const reveal = (hand: readonly string[], choice: string) => {
    const made = make({ deck: ["12106", "f0", "f0"], hand });
    let current = send(start(made.state), { type: "Commit", cardIds: [made.hero] }, made.ctx);
    current = send(current, { type: "Pass" }, made.ctx);
    current = finish(current, made.ctx, (state) => (state.window?.kind === "choose" && state.window.options.includes(choice) ? choice : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
    return current.state;
  };

  it("discards each card in hand that is not of the chosen type, and surges when none was discarded", () => {
    const some = reveal(["ally", "event", "event"], "event");
    expect(some.seats[0]?.hand.map((id) => some.cards[id]?.code)).toEqual(["event", "event"]);
    expect(some.seats[0]?.discard.map((id) => some.cards[id]?.code)).toEqual(["ally"]);
    // A discard means no surge: Into the Abyss alone is revealed.
    expect(some.staging.filter((id) => some.cards[id]?.code === "f0")).toHaveLength(0);
    const none = reveal(["event"], "event");
    expect(none.seats[0]?.discard).toEqual([]);
    expect(none.staging.filter((id) => none.cards[id]?.code === "f0")).toHaveLength(1);
  });
});

describe("Into the Abyss, Shadow (12106:A:2)", () => {
  // The shadow card asks the first player which Creature to bring: it runs in a frame, as a shadow that searches does.
  const fight = (sided: RuinsLayout["sided"]) => ruinsFight(world, "12106", "raider", { sided, deck: ["12106", "creature", "f0"] }, { undefended: true }).run.state;

  it("brings a Creature enemy from the encounter deck into the staging area when the attack is made with an Underwater location active, and does nothing otherwise", () => {
    const underwater = fight(UNDERWATER_ACTIVE);
    expect(underwater.failure).toBeNull();
    expect(underwater.staging.map((id) => underwater.cards[id]?.code)).toContain("creature");
    const grotto = fight(GROTTO_ACTIVE);
    expect(grotto.failure).toBeNull();
    expect(grotto.staging.map((id) => grotto.cards[id]?.code)).not.toContain("creature");
  });
});

describe("Twisting Hollow (12102:A:1)", () => {
  const tired = (zone: "activeLocation" | "staging", phase: RuinsLayout["phase"] = "Quest") => {
    const made = make({ phase, sided: [{ code: "12102", back: "12099", zone }] });
    return { made, state: updateCard(made.state, made.hero, { exhausted: true }) };
  };

  it("bars a card effect from readying a character while it is active, but not the refresh phase", () => {
    const active = tired("activeLocation");
    expect(readyBarred(active.state, active.made.hero)).toBe(true);
    // A card effect that readies every character leaves the exhausted hero exhausted...
    const effect = run({ ...active.made, state: active.state }, { verb: "Ready", target: "allCharacters" });
    expect(effect.state.cards[active.made.hero]?.exhausted).toBe(true);
    // ...while with the location in the staging area the same effect readies it.
    const idle = tired("staging");
    expect(readyBarred(idle.state, idle.made.hero)).toBe(false);
    expect(run({ ...idle.made, state: idle.state }, { verb: "Ready", target: "allCharacters" }).state.cards[idle.made.hero]?.exhausted).toBe(false);
    // The refresh phase readies it with the location active (a rule, not a card effect).
    const refresh = tired("activeLocation", "Refresh");
    expect(refresh.state.cards[refresh.made.hero]?.exhausted).toBe(true);
    const refreshed = settle(refresh.state, refresh.made.ctx, []);
    expect(refreshed.cards[refresh.made.hero]?.exhausted).toBe(false);
  });
});

describe("the Underwater sides' Forced effects at the end of the quest phase", () => {
  const forced = (code: string, back: string, layout: RuinsLayout = {}, pick?: (state: ScenarioState) => string) => {
    const made = make({ sided: [{ code, back, zone: "activeLocation" }], ...layout });
    const source = Object.values(made.state.cards).find((card) => card.zone === "activeLocation")!;
    const run = resolveRecords(made.state, made.ctx, code, "forced", source.id, pick);
    return { made, source, state: run.state };
  };

  it("Shrine to Morgoth raises each player's threat by 5 (12095:A:2)", () => {
    const { state } = forced("12095", "12094", { seats: 2 });
    expect(state.seats.map((seat) => seat.threat)).toEqual([33, 33]);
  });

  it("Dark Abyss deals 1 damage to each character, then the first player may flip it (12101:A:2)", () => {
    const flip = forced("12101", "12098", {}, (state) => (state.window?.kind === "choose" ? "flip" : ""));
    expect(flip.state.cards[flip.made.hero]?.damage).toBe(1);
    expect(flip.state.cards[flip.source.id]?.code).toBe("12098");
    const stay = forced("12101", "12098", {}, (state) => (state.window?.kind === "choose" ? "stay" : ""));
    expect(stay.state.cards[stay.source.id]?.code).toBe("12101");
  });

  it("Twisting Hollow makes each player discard a character (12102:A:2)", () => {
    const { state, made } = forced("12102", "12099", {}, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("stay") ? "stay" : (state.window.options[0] ?? "")) : ""));
    expect([made.hero, made.hero2].filter((id) => state.cards[id]?.zone !== "heroes")).toHaveLength(1);
  });

  it("Sunken Temple discards 1 resource from each hero's pool and each objective ally (12103:A:2)", () => {
    const { state, made } = forced("12103", "12100", { play: [CODES.captainSahir] }, (state) => (state.window?.kind === "choose" ? "stay" : ""));
    expect(state.cards[made.hero]?.resources ?? 0).toBe(0);
    const withTokens = make({ sided: [{ code: "12103", back: "12100", zone: "activeLocation" }], play: [CODES.captainSahir] });
    const hero = updateCard(updateCard(withTokens.state, withTokens.hero, { resources: 3 }), idOf(withTokens.state, CODES.captainSahir), { resources: 2 });
    const source = Object.values(hero.cards).find((card) => card.zone === "activeLocation")!;
    const done = resolveRecords(hero, withTokens.ctx, "12103", "forced", source.id, (current) => (current.window?.kind === "choose" ? "stay" : "")).state;
    expect(done.cards[withTokens.hero]?.resources).toBe(2);
    expect(done.cards[idOf(done, CODES.captainSahir)]?.resources).toBe(1);
  });

  it("Sunken Temple blanks attachments and Dark Abyss bars characters from attacking, only while active (12103:A:1, 12101:A:1)", () => {
    const attached = (zone: "activeLocation" | "staging") => {
      const table = make({ sided: [{ code: "12103", back: "12100", zone }], play: ["att"] });
      return { table, state: syncConstants(attachTo(table.state, idOf(table.state, "att"), table.hero), table.ctx) };
    };
    const temple = attached("activeLocation");
    expect(flagged(temple.state, idOf(temple.state, "att"), "blankText")).toBe(true);
    const idle = attached("staging");
    expect(flagged(idle.state, idOf(idle.state, "att"), "blankText")).toBe(false);
    const abyss = make({ sided: [{ code: "12101", back: "12098", zone: "activeLocation" }] });
    expect(flagged(abyss.state, abyss.hero, "cannotAttack")).toBe(true);
    const idleAbyss = make({ sided: [{ code: "12101", back: "12098", zone: "staging" }] });
    expect(flagged(idleAbyss.state, idleAbyss.hero, "cannotAttack")).toBe(false);
  });
});
