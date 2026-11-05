// Rules: emce.setup-roam-across-rhovanion, emce.indestructible, rr.objective-cards, rr.guarded, rr.forced, rr.travel, rr.engaged, rr.damage, rr.search, rr.cancel (data/rules/entries.json); ledger lines 19036:A:1 to 19046:A:1, 19052:A:2 to 19055:A:3.
// The encounter cards and the objectives of Roam Across Rhovanion on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { expireModifiers, flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import { notePlaced, progressRoom } from "../../../rules/families/south/locations.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { CODES, codesIn, finish, idOf, idsOf, legalIntents, loadRhovanionWorld, resolveRecords, rhovanionFight, rhovanionTable, send, start, type PlayerIntent, type RhovanionWorld, type Run } from "../../../../test/scenarios/roam-across-rhovanion/scene.ts";

let world: RhovanionWorld;
beforeAll(async () => {
  world = await loadRhovanionWorld();
}, 120_000);

type Layout = Parameters<typeof rhovanionTable>[1];
type Table = ReturnType<typeof rhovanionTable>;
// The option the card with this code stands for, among the cards a choice offers; or the named option.
const takes = (code: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === code || id === code) ?? state.window.options[0] ?? "") : "");
const optionNamed = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? "") : "");
const offered = (state: ScenarioState): string[] => (state.window?.kind === "choose" ? [...state.window.options] : []);
// The state after the settle sweeps have read it (a guard left play, a card became free).
const settled = (t: Table, state: ScenarioState): Run => {
  const steps: Run["steps"] = [];
  return { state: settle({ ...state, window: null, mode: "stopped" }, t.ctx, steps), steps };
};
const guard = (state: ScenarioState, guardCode: string, objectiveCode: string): ScenarioState => guardWith(state, idOf(state, guardCode), idOf(state, objectiveCode));
const leaves = (state: ScenarioState, code: string): ScenarioState => moveCard(state, idOf(state, code), { zone: "encounterDiscard" });
const threatOf = (state: ScenarioState, code: string): number => modifiedStat(state, state.cards[idOf(state, code)]!, "threat", world.cards);
const hasResources = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

describe("19052 Urdug and 19054 Tiny (objective allies)", () => {
  it("19052:A:2 free of encounters in the staging area, the first player gains control of Urdug; guarded, he waits", () => {
    const t = rhovanionTable(world, { staging: [CODES.urdug, CODES.sneakingOff] });
    const held = settled(t, guard(t.state, CODES.sneakingOff, CODES.urdug));
    expect(held.state.cards[idOf(held.state, CODES.urdug)]).toMatchObject({ zone: "staging", controller: null });
    const freed = settled(t, leaves(held.state, CODES.sneakingOff));
    expect(freed.state.cards[idOf(freed.state, CODES.urdug)]).toMatchObject({ zone: "play", controller: 0 });
  });

  it("19054:A:2 the first player gains control of Tiny once nothing guards him, and that is a claim (rr.objective-cards): the campaign card asks about trust", () => {
    const t = rhovanionTable(world, { staging: [CODES.tiny, CODES.greyMoorland], campaign: true, play: [CODES.urdug] });
    const held = settled(t, guard(t.state, CODES.greyMoorland, CODES.tiny));
    expect(held.state.cards[idOf(held.state, CODES.tiny)]?.zone).toBe("staging");
    expect(held.state.window?.kind).not.toBe("choose");
    const freed = settled(t, leaves(held.state, CODES.greyMoorland));
    expect(freed.state.cards[idOf(freed.state, CODES.tiny)]).toMatchObject({ zone: "play", controller: 0 });
    expect(offered(freed.state)).toEqual(["trust", "burden"]);
  });

  it("19054:A:2 with several players the first player gains control, and the token passes control with it", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.tiny] });
    const freed = settled(t, t.state);
    expect(freed.state.cards[idOf(freed.state, CODES.tiny)]).toMatchObject({ zone: "play", controller: 0 });
    const passed = settled(t, { ...freed.state, firstPlayer: 1 });
    expect(passed.state.cards[idOf(passed.state, CODES.tiny)]?.controller).toBe(1);
  });

  it("19054:A:3 after Tiny exhausts, the first player raises their threat by 2", () => {
    const t = rhovanionTable(world, { play: [CODES.tiny], threat: [28, 28] });
    const tiny = idOf(t.state, CODES.tiny);
    const run = resolveRecords(t.state, t.ctx, CODES.tiny, "forced", tiny);
    // The Forced effect answers an exhaust event; resolved by itself it raises the threat of the first player.
    expect(run.state.seats[0]?.threat).toBe(30);
  });

  it("19052:A:3 and 19054:A:4 the players lose the game when Urdug or Tiny is destroyed", () => {
    for (const code of [CODES.urdug, CODES.tiny]) {
      const t = rhovanionTable(world, { play: [code] });
      const hurt = updateCard(t.state, idOf(t.state, code), { damage: 99 });
      const run = settled(t, hurt);
      expect(run.state.lost, code).toBe(true);
    }
    // A destroyed hero is no loss.
    const t = rhovanionTable(world, { play: [CODES.urdug] });
    expect(settled(t, t.state).state.lost).toBeFalsy();
  });

  it("19052:A:1 Urdug is immune to player card effects", () => {
    expect(world.cards.get(CODES.urdug)?.keywords.immuneToPlayerCardEffects).toBe(true);
    expect(world.cards.get(CODES.tiny)?.keywords.immuneToPlayerCardEffects).toBe(true);
  });
});

describe("19053 Urdug and 19055 Tiny (enemy sides)", () => {
  it("emce.indestructible Urdug is indestructible: with as much damage as hit points he stays in play", () => {
    const t = rhovanionTable(world, { staging: [{ code: CODES.urdugEnemy, damage: 99 }] });
    const run = settled(t, t.state);
    expect(run.state.cards[idOf(run.state, CODES.urdugEnemy)]?.zone).toBe("staging");
  });

  it("19055:A:2 Urdug cannot take damage while Tiny is in play", () => {
    const t = rhovanionTable(world, { staging: [CODES.urdugEnemy, CODES.tinyEnemy] });
    expect(flagged(t.state, idOf(t.state, CODES.urdugEnemy), "cannotTakeDamage")).toBe(true);
    const alone = rhovanionTable(world, { staging: [CODES.urdugEnemy] });
    expect(flagged(alone.state, idOf(alone.state, CODES.urdugEnemy), "cannotTakeDamage")).toBe(false);
  });

  it("19055:A:3 after Urdug engages a player, Tiny engages that player", () => {
    for (const threat of [[28, 10], [10, 28]] as const) {
      const t = rhovanionTable(world, { seats: 2, phase: "Encounter", staging: [CODES.urdugEnemy, CODES.tinyEnemy], threat });
      let run = start(t.state);
      for (let guard = 0; guard < 4 && run.state.window?.kind === "optionalEngage"; guard += 1) run = send(run, { type: "DeclineEngage" }, t.ctx);
      // Urdug (engagement cost 15) engages the player whose threat reaches it; Tiny (50) engages the same player after him.
      const seat = threat[0] === 28 ? 0 : 1;
      expect(run.state.cards[idOf(run.state, CODES.urdugEnemy)], `threat ${threat}`).toMatchObject({ zone: "engaged", controller: seat });
      expect(run.state.cards[idOf(run.state, CODES.tinyEnemy)], `threat ${threat}`).toMatchObject({ zone: "engaged", controller: seat });
    }
  });

  // At the beginning of the quest phase an engaged Urdug attacks at once; the hero defends.
  const questAttack = (layout: Layout, tweak?: (state: ScenarioState) => ScenarioState): Run => {
    const t = rhovanionTable(world, { phase: "Planning", deck: ["f0", "f3", "f0"], engaged: [{ code: CODES.urdugEnemy, seat: 0 }, { code: CODES.tinyEnemy, seat: 0 }], ...layout });
    let run = send(start(tweak ? tweak(t.state) : t.state), { type: "Pass" }, t.ctx);
    for (let guard = 0; guard < 12 && run.state.phase === "Quest" && (run.state.pendingAttack != null || run.state.window?.kind === "defense" || run.state.window?.kind === "choose"); guard += 1) {
      const window = run.state.window;
      if (window?.kind === "defense") run = send(run, { type: "DeclareDefender", defenderId: t.hero }, t.ctx);
      else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, t.ctx);
      else {
        const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
        if (!pass) break;
        run = send(run, pass as PlayerIntent, t.ctx);
      }
    }
    return run;
  };
  const zoneOf = (run: Run, code: string): string | undefined => run.state.cards[idOf(run.state, code)]?.zone;

  it("19053:A:2 engaged, Urdug makes an immediate attack at the beginning of the quest phase; if it deals damage Urdug and Tiny return to the staging area", () => {
    const hurt = questAttack({});
    expect(hurt.steps.some((step) => step.kind === "attack")).toBe(true);
    expect(zoneOf(hurt, CODES.urdugEnemy)).toBe("staging");
    expect(zoneOf(hurt, CODES.tinyEnemy)).toBe("staging");
  });

  it("19053:A:2 an attack that deals no damage leaves Urdug and Tiny engaged", () => {
    const armored = questAttack({}, (state) => {
      const hero = Object.values(state.cards).find((card) => card.zone === "heroes" && card.controller === 0)!;
      return { ...state, modifiers: [...state.modifiers, { instanceId: hero.id, sourceId: hero.id, stat: "defense", amount: 10, until: "endOfRound" }] };
    });
    expect(armored.steps.some((step) => step.kind === "attack")).toBe(true);
    expect(zoneOf(armored, CODES.urdugEnemy)).toBe("engaged");
    expect(zoneOf(armored, CODES.tinyEnemy)).toBe("engaged");
  });

  it("19053:A:2 Urdug in the staging area does not attack", () => {
    const staged = questAttack({ engaged: [], staging: [CODES.urdugEnemy, CODES.tinyEnemy] });
    expect(staged.steps.some((step) => step.kind === "attack")).toBe(false);
  });
});

describe("19036 Durin's Key", () => {
  it("19036:A:1 free of encounters in the staging area, the first player attaches it to a hero they control (a claim)", () => {
    const t = rhovanionTable(world, { staging: [CODES.durinSKey, CODES.deepRavine], campaign: true, play: [CODES.urdug] });
    const held = settled(t, guard(t.state, CODES.deepRavine, CODES.durinSKey));
    expect(held.state.cards[idOf(held.state, CODES.durinSKey)]?.zone).toBe("staging");
    const freed = settled(t, leaves(held.state, CODES.deepRavine));
    // The first player chooses the hero (two heroes are offered).
    expect(freed.state.window?.kind).toBe("choose");
    const picked = finish(freed, t.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(t.hero2) ? t.hero2 : (state.window.options[0] ?? "")) : ""));
    const key = picked.state.cards[idOf(picked.state, CODES.durinSKey)]!;
    expect(key).toMatchObject({ zone: "attached", host: t.hero2, claimed: true, controller: 0 });
    // Claiming asked about trust (12184:B:1): the first option, trust, put a resource on Urdug.
    expect(hasResources(picked.state, CODES.urdug)).toBe(1);
  });

  it("19036:A:2 Action: exhaust it to give each location -1 Threat until the end of the phase", () => {
    const t = rhovanionTable(world, { staging: [CODES.greyMoorland, CODES.deepRavine], phase: "Quest" });
    const key = rhovanionTable(world, { staging: [CODES.greyMoorland, CODES.deepRavine], phase: "Quest", play: [] });
    expect(threatOf(key.state, CODES.greyMoorland)).toBe(world.cards.get(CODES.greyMoorland)?.threat);
    const run = resolveRecords(t.state, t.ctx, CODES.durinSKey, "action", undefined);
    expect(threatOf(run.state, CODES.greyMoorland)).toBe((world.cards.get(CODES.greyMoorland)?.threat ?? 0) - 1);
    expect(threatOf(run.state, CODES.deepRavine)).toBe((world.cards.get(CODES.deepRavine)?.threat ?? 0) - 1);
  });

  it("19036:A:3 at the beginning of the quest phase the player who controls it looks at the top 3 cards, reveals 1 and discards the rest; guarded, it does nothing", () => {
    const deck = ["f0", "f3", "treachery", "place", "f0"];
    const planning = (claimed: boolean): Table => {
      const t = rhovanionTable(world, { phase: "Planning", deck });
      const key = spawn(t.state, CODES.durinSKey, claimed ? { zone: "attached" } : { zone: "staging" });
      const held = claimed ? updateCard(attachTo(key.state, key.id, t.hero), key.id, { claimed: true, controller: 0, face: "up" }) : key.state;
      return { ...t, state: held };
    };
    const held = planning(true);
    let run = send(start(held.state), { type: "Pass" }, held.ctx);
    expect(run.state.window?.kind).toBe("look");
    run = finish(send(run, { type: "Pass" }, held.ctx), held.ctx, takes("f3"));
    // The one chosen is revealed (an enemy: added to the staging area), the other two looked at are discarded, the rest stay.
    expect(codesIn(run.state, "staging")).toContain("f3");
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0", "treachery"].sort());
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f0", "place"].sort());
    // Guarded in the staging area, nobody controls it: the quest phase begins without a look.
    const guarded = planning(false);
    const quiet = send(start(guarded.state), { type: "Pass" }, guarded.ctx);
    expect(quiet.state.window?.kind).not.toBe("look");
  });
});

describe("19037 Urdug's Horn", () => {
  it("19037:A:1 free of encounters in the staging area, the Horn is attached to Urdug, and that is a claim", () => {
    const t = rhovanionTable(world, { staging: [CODES.urdugSHorn, CODES.greyMountainGiant], play: [CODES.urdug], campaign: true });
    const held = settled(t, guard(t.state, CODES.greyMountainGiant, CODES.urdugSHorn));
    expect(held.state.cards[idOf(held.state, CODES.urdugSHorn)]?.zone).toBe("staging");
    const freed = settled(t, leaves(held.state, CODES.greyMountainGiant));
    const urdug = idOf(freed.state, CODES.urdug);
    expect(freed.state.cards[idOf(freed.state, CODES.urdugSHorn)]).toMatchObject({ zone: "attached", host: urdug, claimed: true });
    expect(offered(freed.state)).toEqual(["trust", "burden"]);
  });

  it("19037:A:2 when Urdug attacks as an ally, the top card of the encounter deck is discarded and its Threat added to his Attack until the end of the phase", () => {
    const t = rhovanionTable(world, { phase: "PlayerAttacks", engaged: [{ code: "mild", seat: 0 }], play: [CODES.urdug], deck: [CODES.greyMoorland, "f3"] });
    const urdug = idOf(t.state, CODES.urdug);
    const horn = spawn(t.state, CODES.urdugSHorn, { zone: "attached" });
    const held = updateCard(attachTo(horn.state, horn.id, urdug), horn.id, { claimed: true, controller: 0, face: "up" });
    const run = send(start(held), { type: "DeclareAttackers", enemyId: idOf(held, "mild"), attackerIds: [urdug] }, t.ctx);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([CODES.greyMoorland]);
    expect(modifiedStat(run.state, run.state.cards[urdug]!, "attack", world.cards)).toBe((world.cards.get(CODES.urdug)?.attack ?? 0) + (world.cards.get(CODES.greyMoorland)?.threat ?? 0));
  });

  it("19037:A:2 when Urdug attacks as an enemy the same holds", () => {
    const fought = rhovanionFight(world, "f0", CODES.urdugEnemy, { deck: ["f0", CODES.greyMoorland, "f3", "f3"] }, {
      tweak: (state) => {
        const horn = spawn(state, CODES.urdugSHorn, { zone: "attached" });
        return updateCard(attachTo(horn.state, horn.id, idOf(state, CODES.urdugEnemy)), horn.id, { claimed: true, controller: null, face: "up" });
      },
    });
    const urdug = fought.during.cards[idOf(fought.during, CODES.urdugEnemy)]!;
    expect(codesIn(fought.run.state, "encounterDiscard")).toContain(CODES.greyMoorland);
    expect(modifiedStat(fought.during, urdug, "attack", world.cards)).toBe((world.cards.get(CODES.urdugEnemy)?.attack ?? 0) + (world.cards.get(CODES.greyMoorland)?.threat ?? 0));
  });
});

describe("19038 Grey Mountain Giant", () => {
  it("19038:A:2 when it engages you, the top 5 cards of your deck are discarded and you assign damage among your characters equal to the allies discarded", () => {
    const t = rhovanionTable(world, { staging: [CODES.greyMountainGiant], deckOf: ["ally", "f0", "ally", "c0", "ally", "filler"], phase: "Encounter" });
    const giant = idOf(t.state, CODES.greyMountainGiant);
    const run = resolveRecords(t.state, t.ctx, CODES.greyMountainGiant, "forced", giant);
    expect(codesIn(run.state, "discard")).toHaveLength(5);
    const damage = [t.hero, t.hero2].map((id) => run.state.cards[id]?.damage ?? 0).reduce((sum, value) => sum + value, 0);
    expect(damage).toBe(codesIn(run.state, "discard").filter((code) => world.cards.get(code)?.type === "ally").length);
  });

  it("19038:A:1 cannot have attachments except objectives", () => {
    expect(world.cards.get(CODES.greyMountainGiant)).toMatchObject({ type: "enemy", health: 11 });
  });
});

describe("19039 Hunting Eagle", () => {
  it("19039:A:1 cannot be optionally engaged (Surge is a keyword)", () => {
    const t = rhovanionTable(world, { staging: [CODES.huntingEagle], phase: "Encounter" });
    expect(flagged(t.state, idOf(t.state, CODES.huntingEagle), "cannotBeOptionallyEngaged")).toBe(true);
    expect(world.cards.get(CODES.huntingEagle)?.keywords.surge).toBe(true);
  });

  it("19039:A:2 when the encounter phase begins, it engages the first player", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.huntingEagle], phase: "Encounter" });
    const run = resolveRecords(t.state, t.ctx, CODES.huntingEagle, "forced", idOf(t.state, CODES.huntingEagle));
    expect(run.state.cards[idOf(run.state, CODES.huntingEagle)]).toMatchObject({ zone: "engaged", controller: 0 });
    const second = rhovanionTable(world, { seats: 2, staging: [CODES.huntingEagle], phase: "Encounter" });
    const moved = resolveRecords({ ...second.state, firstPlayer: 1 }, second.ctx, CODES.huntingEagle, "forced", idOf(second.state, CODES.huntingEagle));
    expect(moved.state.cards[idOf(moved.state, CODES.huntingEagle)]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("19039:A:3 the Shadow gives the attacker +1 Attack, and +2 when it has the Creature trait", () => {
    const plain = rhovanionFight(world, CODES.huntingEagle, "mild");
    expect(modifiedStat(plain.during, plain.during.cards[idOf(plain.during, "mild")]!, "attack", world.cards)).toBe(3 + 1);
    const creature = rhovanionFight(world, CODES.huntingEagle, CODES.wilderlandBear);
    const bear = creature.during.cards[idOf(creature.during, CODES.wilderlandBear)]!;
    expect(modifiedStat(creature.during, bear, "attack", world.cards)).toBe((world.cards.get(CODES.wilderlandBear)?.attack ?? 0) + 2);
  });
});

describe("19040 Wilderland Bear", () => {
  it("19040:A:1 the first player chooses: the Bear makes an immediate attack against them, or each player discards a card from hand at random", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.wilderlandBear], hand: ["filler", "event"], deck: [] });
    const bear = idOf(t.state, CODES.wilderlandBear);
    const asked = resolveRecords(t.state, t.ctx, CODES.wilderlandBear, "whenRevealed", bear, optionNamed("discard"));
    expect(asked.state.seats.map((seat) => seat.hand.length)).toEqual([1, 1]);
    const attacked = resolveRecords(t.state, t.ctx, CODES.wilderlandBear, "whenRevealed", bear, optionNamed("attack"));
    expect(attacked.state.seats.map((seat) => seat.hand.length)).toEqual([2, 2]);
    expect(attacked.steps.some((step) => step.kind === "damage" || step.kind === "attack")).toBe(true);
  });
});

describe("19041 Grey Moorland", () => {
  it("19041:A:1 after it becomes the active location the discard pile is shuffled into the deck and cards are discarded until a treachery is, whose When Revealed effect resolves", () => {
    const t = rhovanionTable(world, { staging: [CODES.greyMoorland], deck: ["f0", "f3"], discard: [CODES.harshWeather, "f0"], phase: "Travel" });
    const run = resolveRecords(t.state, t.ctx, CODES.greyMoorland, "forced", idOf(t.state, CODES.greyMoorland), undefined, true);
    // Harsh Weather was shuffled into the deck, found and discarded; its When Revealed effect ran (the first option, exhaust, for every ready character).
    expect(codesIn(run.state, "encounterDiscard")).toContain(CODES.harshWeather);
    expect([...codesIn(run.state, "encounterDeck"), ...codesIn(run.state, "encounterDiscard")].sort()).toEqual(["f0", "f0", "f3", CODES.harshWeather].sort());
    expect(run.state.cards[t.hero]?.exhausted).toBe(true);
    // With no treachery to find, nothing is resolved and the deck keeps everything.
    const none = rhovanionTable(world, { staging: [CODES.greyMoorland], deck: ["f0"], discard: ["f3"], phase: "Travel" });
    const bare = resolveRecords(none.state, none.ctx, CODES.greyMoorland, "forced", idOf(none.state, CODES.greyMoorland), undefined, true);
    expect(bare.state.cards[none.hero]?.exhausted).toBe(false);
  });

  it("19041:A:2 the Shadow returns the attacking enemy to the staging area after the attack", () => {
    const fought = rhovanionFight(world, CODES.greyMoorland, "mild");
    expect(fought.run.state.cards[idOf(fought.run.state, "mild")]?.zone).toBe("staging");
  });
});

describe("19042 Deep Ravine", () => {
  it("19042:A:1 while it is in the staging area no more than 1 progress a round can be placed on the locations there, all together", () => {
    const t = rhovanionTable(world, { staging: [CODES.deepRavine, CODES.greyMoorland, CODES.slopesOfEredMithrin] });
    expect(flagged(t.state, idOf(t.state, CODES.greyMoorland), "progressCapShared")).toBe(true);
    const far = rhovanionTable(world, { staging: [CODES.greyMoorland] });
    expect(flagged(far.state, idOf(far.state, CODES.greyMoorland), "progressCapShared")).toBe(false);
  });

  it("19042:A:1 the second progress placed on the staging locations in a round is lost, even on another location; the next round it is 1 again", () => {
    const t = rhovanionTable(world, { stage: "19048", staging: [CODES.deepRavine, CODES.greyMoorland, CODES.slopesOfEredMithrin] });
    const [moorland, slopes] = [idOf(t.state, CODES.greyMoorland), idOf(t.state, CODES.slopesOfEredMithrin)];
    expect(progressRoom(t.state, moorland, world.cards)).toBe(1);
    const placed = notePlaced(updateCard(t.state, moorland, { progress: 1 }), moorland, 1);
    expect(progressRoom(placed, slopes, world.cards)).toBe(0);
    expect(progressRoom(placed, moorland, world.cards)).toBe(0);
    expect(progressRoom(expireModifiers(placed, ["endOfRound"]), slopes, world.cards)).toBe(1);
    // Without Deep Ravine in the staging area there is no cap.
    const free = rhovanionTable(world, { stage: "19048", staging: [CODES.greyMoorland, CODES.slopesOfEredMithrin] });
    expect(progressRoom(free.state, idOf(free.state, CODES.greyMoorland), world.cards)).toBeGreaterThan(1);
  });

  it("19042:A:2 Travel: the first player exhausts Urdug, or every player raises their threat by 2", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.deepRavine], play: [CODES.urdug], phase: "Travel", threat: [30, 31] });
    const exhaust = resolveRecords(t.state, t.ctx, CODES.deepRavine, "travel", idOf(t.state, CODES.deepRavine), optionNamed("exhaust"));
    expect(exhaust.state.cards[idOf(exhaust.state, CODES.urdug)]?.exhausted).toBe(true);
    expect(exhaust.state.seats.map((seat) => seat.threat)).toEqual([30, 31]);
    const raise = resolveRecords(t.state, t.ctx, CODES.deepRavine, "travel", idOf(t.state, CODES.deepRavine), optionNamed("threat"));
    expect(raise.state.seats.map((seat) => seat.threat)).toEqual([32, 33]);
    // Urdug exhausted or not in play: only the threat is offered.
    const tired = rhovanionTable(world, { staging: [CODES.deepRavine], phase: "Travel" });
    const started = resolveRecords(tired.state, tired.ctx, CODES.deepRavine, "travel", idOf(tired.state, CODES.deepRavine), (state) => {
      expect(offered(state)).toEqual(["threat"]);
      return "threat";
    });
    expect(started.state.seats[0]?.threat).toBe(30);
  });
});

describe("19043 Slopes of Ered Mithrin", () => {
  it("19043:A:2 after the players travel here the first player may ready a character they control", () => {
    const t = rhovanionTable(world, { phase: "Travel", staging: [CODES.slopesOfEredMithrin] });
    const tired = updateCard(t.state, t.hero, { exhausted: true });
    let run = send(start(tired), { type: "Travel", locationId: idOf(t.state, CODES.slopesOfEredMithrin) }, t.ctx);
    const trigger = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger");
    expect(trigger).toBeDefined();
    run = finish(send(run, trigger as PlayerIntent, t.ctx), t.ctx);
    expect(run.state.cards[t.hero]?.exhausted).toBe(false);
  });

  it("19043:A:3 the Shadow exhausts Urdug when the first player controls him", () => {
    const withUrdug = rhovanionFight(world, CODES.slopesOfEredMithrin, "mild", { play: [CODES.urdug] });
    expect(withUrdug.run.state.cards[idOf(withUrdug.run.state, CODES.urdug)]?.exhausted).toBe(true);
    // Urdug guarded in the staging area (the first player does not control him) is not exhausted.
    const guarded = rhovanionFight(world, CODES.slopesOfEredMithrin, "mild", { staging: [CODES.urdug, CODES.sneakingOff] }, { tweak: (state) => guard(state, CODES.sneakingOff, CODES.urdug) });
    expect(guarded.run.state.cards[idOf(guarded.run.state, CODES.urdug)]).toMatchObject({ zone: "staging", exhausted: false });
  });
});

describe("19044 Sneaking Off", () => {
  it("19044:A:1 the first player loses control of Urdug, who is attached to a location in the staging area as a guarded objective; Sneaking Off leaves the game", () => {
    const t = rhovanionTable(world, { staging: [CODES.sneakingOff, CODES.greyMoorland], play: [CODES.urdug] });
    const run = resolveRecords(t.state, t.ctx, CODES.sneakingOff, "whenRevealed", idOf(t.state, CODES.sneakingOff));
    const urdug = run.state.cards[idOf(run.state, CODES.urdug)]!;
    const moorland = idOf(run.state, CODES.greyMoorland);
    expect(urdug).toMatchObject({ zone: "staging", controller: null });
    expect(run.state.cards[moorland]).toMatchObject({ host: urdug.id, guard: true, zone: "staging" });
    expect(run.state.cards[idOf(run.state, CODES.sneakingOff)]?.zone).toBe("removed");
    expect(run.state.seats[0]?.play).not.toContain(urdug.id);
  });

  it("19044:A:1 the first player chooses the location", () => {
    const t = rhovanionTable(world, { staging: [CODES.sneakingOff, CODES.greyMoorland, CODES.deepRavine], play: [CODES.urdug] });
    const run = resolveRecords(t.state, t.ctx, CODES.sneakingOff, "whenRevealed", idOf(t.state, CODES.sneakingOff), takes(CODES.deepRavine));
    expect(run.state.cards[idOf(run.state, CODES.deepRavine)]?.guard).toBe(true);
    expect(run.state.cards[idOf(run.state, CODES.greyMoorland)]?.guard).toBeFalsy();
  });

  it("19044:A:1 with no location in the staging area, 5 is added to the total Threat in the staging area until the end of the phase", () => {
    const t = rhovanionTable(world, { staging: [CODES.sneakingOff], play: [CODES.urdug] });
    const before = stagingThreat(t.state, world.cards);
    const run = resolveRecords(t.state, t.ctx, CODES.sneakingOff, "whenRevealed", idOf(t.state, CODES.sneakingOff));
    expect(run.state.cards[idOf(run.state, CODES.urdug)]).toMatchObject({ zone: "play", controller: 0 });
    expect(stagingThreat(run.state, world.cards)).toBe(before - (world.cards.get(CODES.sneakingOff)?.threat ?? 0) + 5);
    expect(run.state.cards[idOf(run.state, CODES.sneakingOff)]?.zone).toBe("removed");
  });

  it("19044:A:1 without Urdug under the first player's control (already guarded), the Threat is added instead", () => {
    const t = rhovanionTable(world, { staging: [CODES.sneakingOff, CODES.urdug, CODES.greyMoorland] });
    const before = stagingThreat(t.state, world.cards);
    const run = resolveRecords(t.state, t.ctx, CODES.sneakingOff, "whenRevealed", idOf(t.state, CODES.sneakingOff));
    expect(stagingThreat(run.state, world.cards)).toBe(before + 5);
  });

  it("19044:A:1 freed again, Urdug returns to the first player (a claim)", () => {
    const t = rhovanionTable(world, { staging: [CODES.sneakingOff, CODES.greyMoorland], play: [CODES.urdug], campaign: true });
    const taken = resolveRecords(t.state, t.ctx, CODES.sneakingOff, "whenRevealed", idOf(t.state, CODES.sneakingOff));
    const freed = settled(t, leaves(taken.state, CODES.greyMoorland));
    expect(freed.state.cards[idOf(freed.state, CODES.urdug)]).toMatchObject({ zone: "play", controller: 0 });
  });
});

describe("19045 Harsh Weather", () => {
  it("19045:A:1 for each ready character a player controls they exhaust it or raise their threat by 1", () => {
    const t = rhovanionTable(world, { staging: [CODES.harshWeather] });
    const exhaust = resolveRecords(t.state, t.ctx, CODES.harshWeather, "whenRevealed", idOf(t.state, CODES.harshWeather), optionNamed("exhaust"));
    expect(exhaust.state.cards[t.hero]?.exhausted).toBe(true);
    expect(exhaust.state.cards[t.hero2]?.exhausted).toBe(true);
    expect(exhaust.state.seats[0]?.threat).toBe(28);
    const raise = resolveRecords(t.state, t.ctx, CODES.harshWeather, "whenRevealed", idOf(t.state, CODES.harshWeather), optionNamed("threat"));
    expect(raise.state.seats[0]?.threat).toBe(30);
    expect(raise.state.cards[t.hero]?.exhausted).toBe(false);
  });

  it("19045:A:1 each player is asked for their own characters", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.harshWeather] });
    const run = resolveRecords(t.state, t.ctx, CODES.harshWeather, "whenRevealed", idOf(t.state, CODES.harshWeather), optionNamed("threat"));
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([30, 29]);
  });

  it("19045:A:2 the Shadow gives the attacker +1 Attack; if the attack destroys a character, its player exhausts a character", () => {
    const hit = rhovanionFight(world, CODES.harshWeather, "mild");
    expect(modifiedStat(hit.during, hit.during.cards[idOf(hit.during, "mild")]!, "attack", world.cards)).toBe(3 + 1);
    // The refresh phase after the attack readies every card, so the other hero cannot ready: the exhaust the Shadow made is still there to read.
    const hold = (state: ScenarioState, hero: string): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: hero, sourceId: hero, stat: "cannotReady", amount: 1, until: "endOfRound" }] });
    const killed = rhovanionFight(world, CODES.harshWeather, "mild", {}, { tweak: (state, made) => hold(updateCard(state, made.hero, { damage: 5 }), made.hero2) });
    expect(killed.run.state.cards[killed.made.hero]?.zone).toBe("discard");
    expect(killed.run.state.cards[killed.made.hero2]?.exhausted).toBe(true);
    const spared = rhovanionFight(world, CODES.harshWeather, "mild", {}, { tweak: (state, made) => hold(state, made.hero2) });
    expect(spared.run.state.cards[spared.made.hero2]?.exhausted).toBe(false);
  });
});

describe("19046 Wild Creatures", () => {
  it("19046:A:1 each player chooses an enemy in the staging area and engages it", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.wildCreatures, "f0", "f3"] });
    const run = resolveRecords(t.state, t.ctx, CODES.wildCreatures, "whenRevealed", idOf(t.state, CODES.wildCreatures), takes("f3"));
    expect(run.state.cards[idOf(run.state, "f3")]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(run.state.cards[idOf(run.state, "f0")]).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("19046:A:1 if a player cannot engage an enemy, cards are discarded until a Creature enemy is, and it is added to the staging area", () => {
    const t = rhovanionTable(world, { seats: 2, staging: [CODES.wildCreatures, "f0"], deck: [CODES.harshWeather, "f3", CODES.wilderlandBear, "place"] });
    const run = resolveRecords(t.state, t.ctx, CODES.wildCreatures, "whenRevealed", idOf(t.state, CODES.wildCreatures));
    expect(run.state.cards[idOf(run.state, "f0")]?.zone).toBe("engaged");
    expect(codesIn(run.state, "staging")).toContain(CODES.wilderlandBear);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([CODES.harshWeather, "f3"].sort());
    // Every player engaged an enemy: nothing is discarded.
    const enough = rhovanionTable(world, { seats: 2, staging: [CODES.wildCreatures, "f0", "f3"], deck: [CODES.wilderlandBear] });
    const full = resolveRecords(enough.state, enough.ctx, CODES.wildCreatures, "whenRevealed", idOf(enough.state, CODES.wildCreatures));
    expect(codesIn(full.state, "encounterDeck")).toEqual([CODES.wilderlandBear]);
    expect(idsOf(full.state, CODES.wilderlandBear)).toHaveLength(1);
  });
});
