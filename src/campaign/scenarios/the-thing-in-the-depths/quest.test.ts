// Rules: dcce.stormcaller-and-the-thing, dcce.setup-the-thing-in-the-depths, dcce.stormcaller-elite, dcce.grapple, rr.travel, rr.quest-advancement, rr.winning-the-game (data/rules/entries.json). The three quest stages of The
// Thing in the Depths on a table of plain-number heroes and the Campaign Expansion's cards (test/scenarios/the-thing-in-the-depths/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { holds } from "../../../rules/interpret/conditions.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { grappledWith, heldByLapsedStage } from "../../../rules/families/grapple/values.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { questRoom } from "../../../rules/families/caves/progress.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, codesIn, depthsTable, finish, idOf, idsOf, loadDepthsWorld, resolveRecords, send, start, type DepthsLayout, type DepthsWorld } from "../../../../test/scenarios/the-thing-in-the-depths/scene.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const make = (layout: DepthsLayout = {}) => depthsTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const zone = (state: ScenarioState, code: string, at = 0) => cardOf(state, code, at)?.zone;

describe("Take the Ship! (12039)", () => {
  it("shuffles the encounter deck in its Setup; the piles set Helm of the Stormcaller and an Umbar Raider in the staging area and wait with the rest set aside (A:1)", () => {
    const records = world.definition.setup.map((instruction) => ("code" in instruction ? instruction.code : null));
    // The Setup deals the set aside cards and the staging area; the encounter deck the quest card's Setup shuffles is built of The Stormcaller and Corsair Raiders only.
    expect(records).toContain(CODES.helm);
    expect(records).toContain(CODES.umbar);
    expect(records).toContain(CODES.sahir);
    expect(records).toContain(CODES.naasiyah);
    expect(records).toContain(CODES.thing);
    expect(records.filter((code) => code === CODES.eye)).toHaveLength(2);
    const setup = world.cards.get("12039");
    expect(setup?.type).toBe("quest");
  });

  it("gives Captain Sahír and Na'asiyah indestructible, so damage up to their hit points does not destroy them (B:1)", () => {
    const made = make({ engaged: [{ code: CODES.naasiyah, seat: 0, damage: 9 }, { code: CODES.sahir, seat: 0, damage: 9 }] });
    const settled = settle(made.state, made.ctx, []);
    expect(cardOf(settled, CODES.naasiyah)?.zone).toBe("engaged");
    expect(cardOf(settled, CODES.sahir)?.zone).toBe("engaged");
    const other = make({ stage: "12041", engaged: [{ code: "mild", seat: 0, damage: 99 }] });
    expect(zone(settle(other.state, other.ctx, []), "mild")).not.toBe("engaged");
  });

  it("adds a resource to each of Captain Sahír and Na'asiyah at the end of the round while neither is in play, and to neither once one is (B:2)", () => {
    const effect = world.definition && make().ctx.effects.find((item) => item.id === "12039:forced:1")!;
    expect(effect.trigger).toBe("endOfRound");
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const away = make({ setAside: [CODES.sahir, CODES.naasiyah], phase: "Refresh" });
    expect(holds(away.state, effect.condition!, scope, away.ctx)).toBe(true);
    const run = resolveRecords(away.state, away.ctx, "12039", "forced", idOf(away.state, "12039"));
    expect(run.state.cards[idsOf(run.state, CODES.sahir)[0] ?? ""]?.resources).toBe(1);
    expect(run.state.cards[idsOf(run.state, CODES.naasiyah)[0] ?? ""]?.resources).toBe(1);
    const here = make({ setAside: [CODES.sahir], engaged: [CODES.naasiyah] });
    expect(holds(here.state, effect.condition!, scope, here.ctx)).toBe(false);
  });

  it("keeps the resources a set-aside card holds when it enters play (12039:B:2, 12042:A:3)", () => {
    const made = make({ setAside: [CODES.sahir, CODES.naasiyah] });
    const sahir = idOf(made.state, CODES.sahir);
    const loaded = { ...made.state, cards: { ...made.state.cards, [sahir]: { ...made.state.cards[sahir]!, resources: 3 } } };
    const run = resolveRecords(loaded, made.ctx, CODES.helm, "forced", undefined);
    expect(run.state.cards[sahir]?.resources).toBe(3);
  });

  it("lets no progress be placed on the stage until Helm of the Stormcaller is in the victory display (B:3)", () => {
    const blocked = make({ staging: [CODES.helm] });
    expect(questRoom(blocked.state)).toBe(0);
    const open = make({ victory: [CODES.helm] });
    expect(questRoom(open.state)).toBeGreaterThan(0);
  });
});

describe("Helm of the Stormcaller (12042)", () => {
  it("gets +1 quest point for each resource on a Raider enemy in play (A:2)", () => {
    const made = make({ staging: [CODES.helm, { code: "raider", resources: 2 }], engaged: [{ code: "raider", seat: 0, resources: 1 }, { code: "creature", seat: 0, resources: 5 }] });
    const helm = cardOf(made.state, CODES.helm)!;
    expect(modifiedStat(made.state, helm, "questPoints", made.ctx.cards)).toBe(1 + 3);
  });

  it("adds Na'asiyah and then Captain Sahír to the staging area when it becomes the active location, where they engage the last and the first player (A:3, 11076:A:1, 11078:A:1)", () => {
    const made = make({ seats: 2, staging: [CODES.helm], setAside: [CODES.sahir, CODES.naasiyah] });
    const run = resolveRecords(made.state, made.ctx, CODES.helm, "forced", idOf(made.state, CODES.helm));
    expect(cardOf(run.state, CODES.sahir)).toMatchObject({ zone: "engaged", controller: 0 });
    expect(cardOf(run.state, CODES.naasiyah)).toMatchObject({ zone: "engaged", controller: 1 });
  });
});

describe("Change of Plans (12040)", () => {
  const reveal = (layout: DepthsLayout = {}) => {
    const made = make({ stage: "12040", setAside: [CODES.thing, ...(layout.setAside ?? [])], ...layout });
    return { made, run: resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040")) };
  };

  it("flips Captain Sahír and Na'asiyah to their objective sides without tokens: the first player takes him and the last player her (B:1)", () => {
    const made = make({ seats: 2, stage: "12040", setAside: [CODES.thing], engaged: [{ code: CODES.sahir, seat: 0, damage: 3, resources: 4 }, { code: CODES.naasiyah, seat: 1, damage: 2, resources: 2 }] });
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
    const sahir = cardOf(run.state, CODES.sahirAlly);
    const naasiyah = cardOf(run.state, CODES.naasiyahAlly);
    expect(sahir).toMatchObject({ zone: "play", controller: 0, damage: 0, resources: 0 });
    expect(naasiyah).toMatchObject({ zone: "play", controller: 1, damage: 0, resources: 0 });
    expect(idsOf(run.state, CODES.sahir)).toEqual([]);
  });

  it("keeps an Elite enemy that stage 1B made indestructible alive until it flips, though the stage left play with damage on it equal to its hit points (12039:B:1, 12040:B:1)", () => {
    const made = make({ stage: "12040", setAside: [CODES.thing], engaged: [{ code: CODES.naasiyah, seat: 0, damage: 4 }] });
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
    expect(cardOf(run.state, CODES.naasiyahAlly)).toMatchObject({ zone: "play", damage: 0 });
  });

  it("holds only the Stormcaller Elite enemies the lapsed stage made indestructible: an ordinary enemy at lethal damage during a stage's When Revealed is destroyed at once (rr.destroy)", () => {
    const made = make({ stage: "12040", setAside: [CODES.thing], engaged: [{ code: CODES.naasiyah, seat: 0, damage: 4 }, { code: "creature", seat: 0, damage: 3 }] });
    const stage = idOf(made.state, "12040");
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === "12040" && effect.timing === "whenRevealed");
    const pushed = pushCardEffects(made.state, "whenRevealed", stage, 0, false, effects, made.ctx, []);
    expect(heldByLapsedStage(pushed, idOf(pushed, CODES.naasiyah), made.ctx)).toBe(true);
    expect(heldByLapsedStage(pushed, idOf(pushed, "creature"), made.ctx)).toBe(false);
    // The same two enemies with another stage's When Revealed open: nothing is held.
    const other = make({ stage: "12041", engaged: [{ code: CODES.naasiyah, seat: 0, damage: 4 }] });
    const otherPushed = pushCardEffects(other.state, "whenRevealed", idOf(other.state, "12041"), 0, false, other.ctx.effects.filter((effect) => effect.cardCode === "12041" && effect.timing === "whenRevealed"), other.ctx, []);
    expect(heldByLapsedStage(otherPushed, idOf(otherPushed, CODES.naasiyah), other.ctx)).toBe(false);
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", stage);
    expect(cardOf(run.state, "creature")?.zone).toBe("encounterDiscard");
    expect(cardOf(run.state, CODES.naasiyahAlly)).toMatchObject({ zone: "play", damage: 0 });
  });

  it("removes every Corsair Raiders card from the game: the encounter deck, the discard pile, the staging area, the engagement areas and the shadow cards (B:1)", () => {
    const raiders = world.cards.get(CODES.umbar)?.encounterSet;
    expect(raiders).toBe("Corsair Raiders");
    const made = make({ stage: "12040", setAside: [CODES.thing], deck: [CODES.umbar, "f0"], discard: [CODES.hardened], staging: [CODES.infiltrator], engaged: [{ code: CODES.raidLeader, seat: 0 }] });
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
    for (const code of [CODES.umbar, CODES.hardened, CODES.infiltrator, CODES.raidLeader]) expect(zone(run.state, code), code).toBe("removed");
  });

  it("adds The Thing in the Depths to the staging area, shuffles the discard pile and the set aside Thing set into the encounter deck, and advances to stage 3 (B:1)", () => {
    // Stage 3's When Revealed resolves at once and discards from the deck, so the cards are counted wherever they are now.
    const made = make({ stage: "12040", setAside: [CODES.thing, CODES.eye, CODES.thrashing, CODES.crushing, CODES.seaSerpent, CODES.comeTogether], discard: ["f3"], deck: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
    expect(zone(run.state, CODES.thing)).toBe("staging");
    const out = ["encounterDeck", "encounterDiscard", "staging", "grappled"].flatMap((where) => codesIn(run.state, where));
    for (const code of [CODES.eye, CODES.thrashing, CODES.crushing, "f0", "f3"]) expect(out, code).toContain(code);
    expect(codesIn(run.state, "setAside").filter((code) => code !== "12039" && code !== "12040")).toEqual([CODES.comeTogether, CODES.seaSerpent].sort());
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("12041");
  });

  it("takes The Thing in the Depths by title: the original in a standalone game as well as the reprint in the campaign", () => {
    const made = make({ stage: "12040", setAside: [CODES.thingOriginal] });
    const run = resolveRecords(made.state, made.ctx, "12040", "whenRevealed", idOf(made.state, "12040"));
    expect(zone(run.state, CODES.thingOriginal)).toBe("staging");
  });

  it("reveals nothing: a table with the Elite out of play and nothing to remove still advances", () => {
    const { run } = reveal({ setAside: [] });
    expect(run.state.cards[run.state.questStage ?? ""]?.code).toBe("12041");
  });
});

describe("Defend the Ship! (12041)", () => {
  it("discards cards until 1 more Tentacle enemy than there are players is discarded and attaches each to a location; with 2 players that is 3 arms (A:1)", () => {
    const deck = [CODES.thrashing, "f0", CODES.crushing, CODES.giant, CODES.grasping];
    for (const [seats, arms] of [[1, 2], [2, 3]] as const) {
      const made = make({ seats, stage: "12041", staging: [CODES.cargoHold, CODES.forecastle], deck });
      const run = resolveRecords(made.state, made.ctx, "12041", "whenRevealed", idOf(made.state, "12041"));
      const grappled = Object.values(run.state.cards).filter((card) => card.zone === "grappled");
      expect(grappled, `${seats} players`).toHaveLength(arms);
      expect(grappled.every((card) => card.face === "down" && card.controller == null)).toBe(true);
      // The enemy cards in the deck below the last arm are not discarded.
      expect(run.state.encounterDeck.length).toBe(deck.length - (seats === 1 ? 3 : 4));
    }
  });

  it("stops when the encounter deck runs out (A:1)", () => {
    const made = make({ seats: 2, stage: "12041", staging: [CODES.cargoHold], deck: [CODES.thrashing] });
    const run = resolveRecords(made.state, made.ctx, "12041", "whenRevealed", idOf(made.state, "12041"));
    expect(Object.values(run.state.cards).filter((card) => card.zone === "grappled")).toHaveLength(1);
    expect(run.state.failure).toBeNull();
  });

  it("lets the players travel to a location in the staging area while another is active, and returns the active location to the staging area (B:1)", () => {
    const made = make({ stage: "12041", phase: "Travel", staging: [CODES.cargoHold, CODES.crewQuarters], active: CODES.weatherDeck });
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Travel")).toBe(true);
    const crew = idOf(made.state, CODES.crewQuarters);
    const run = finish(send(start(made.state), { type: "Travel", locationId: crew }, made.ctx), made.ctx);
    expect(run.state.activeLocation).toBe(crew);
    expect(zone(run.state, CODES.weatherDeck)).toBe("staging");
    // Stage 1 does not allow it.
    const first = make({ phase: "Travel", staging: [CODES.cargoHold], active: CODES.weatherDeck });
    expect(legalIntents(first.state, first.ctx).some((intent) => intent.type === "Travel")).toBe(false);
  });

  const endOfRound = (made: ReturnType<typeof make>): ScenarioState => settle({ ...made.state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, []);
  const arms = (count: number) => Array.from({ length: count }, () => [CODES.thrashing, CODES.quarterDeck] as const);

  it("loses the game at the end of the round when the total Threat of any one Ship location is 9 or higher, its grappled enemies' Threat included (B:2)", () => {
    // Quarter Deck prints 4 Threat; each enemy grappled with it adds 2.
    const nine = make({ stage: "12041", staging: [CODES.quarterDeck], grappled: arms(3) });
    expect(modifiedStat(nine.state, cardOf(nine.state, CODES.quarterDeck)!, "threat", nine.ctx.cards)).toBe(10);
    const lost = endOfRound(nine);
    expect(lost.lost).toBe(true);
    expect(lost.lossReason).toContain("The Stormcaller was destroyed");
    const eight = endOfRound(make({ stage: "12041", staging: [CODES.quarterDeck], grappled: arms(2) }));
    expect(eight.lost).toBe(false);
  });

  it("counts the Threat of one location, not of the staging area, and only of a Ship location (B:2)", () => {
    const spread = make({ stage: "12041", staging: [CODES.quarterDeck, CODES.forecastle, "place"], grappled: [[CODES.thrashing, CODES.quarterDeck], [CODES.thrashing, CODES.forecastle], [CODES.thrashing, "place"]] });
    expect(endOfRound(spread).lost).toBe(false);
    const aboard = make({ stage: "12041", staging: ["place"], grappled: Array.from({ length: 4 }, () => [CODES.thrashing, "place"] as const) });
    expect(modifiedStat(aboard.state, cardOf(aboard.state, "place")!, "threat", aboard.ctx.cards)).toBe(10);
    expect(endOfRound(aboard).lost).toBe(false);
  });

  it("does not lose the game on stage 1, which prints no such line", () => {
    const first = make({ staging: [CODES.quarterDeck], grappled: arms(4) });
    expect(endOfRound(first).lost).toBe(false);
  });

  it("wins the game when The Thing in the Depths is destroyed, by the Threat of the Creature enemy that was destroyed (B:3, 12049:A:4)", () => {
    const made = make({ stage: "12041", phase: "PlayerAttacks", staging: [{ code: CODES.thingOriginal, damage: 9 }], engaged: [{ code: "creature", seat: 0, damage: 2 }] });
    expect(made.state.stageCleared).not.toBe(true);
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, "creature"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(zone(run.state, "creature")).not.toBe("engaged");
    expect(cardOf(run.state, CODES.thingOriginal)?.zone).toBe("victory");
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
  });

  it("does not win the game while The Thing in the Depths stands: a Creature that is destroyed deals only its own Threat", () => {
    const made = make({ stage: "12041", phase: "PlayerAttacks", staging: [{ code: CODES.thingOriginal, damage: 2 }], engaged: [{ code: "creature", seat: 0, damage: 2 }] });
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, "creature"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(cardOf(run.state, CODES.thingOriginal)).toMatchObject({ zone: "staging", damage: 4 });
    expect(run.state.stageCleared).not.toBe(true);
  });
});

describe("a stage with no quest points", () => {
  it("is not won by the first progress it takes: Change of Plans and Defend the Ship! print none", () => {
    expect(world.cards.get("12040")?.questPoints).toBeNull();
    expect(world.cards.get("12041")?.questPoints).toBeNull();
    expect(grappledWith(make().state, "x")).toEqual([]);
  });
});
