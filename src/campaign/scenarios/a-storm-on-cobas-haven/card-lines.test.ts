// Rules: rr.guarded, rr.objective-cards, rr.ownership-and-control, rr.attachment-cards, rr.travel, dcce.heading, dcce.sailing-tests, dcce.ship-enemies, dcce.ship-objectives, dcce.corsair-deck,
// dcce.encounter-cards (data/rules/entries.json).
// Lines: 12126:A:2, 12127:A:2, 12134:A:3, 12135:A:1, 12135:A:2, 12136:A:1, 12136:A:2, 12137:A:1, 12137:A:2, 12124:A:3, 12124:A:4, 12128:A:1, 12129:A:1, 11210:A:5. The A Storm on Cobas Haven cards whose
// lines no test named, each read from its printed line on a table built from a layout (tableFromLayout: the stand-in heroes dh1 and dh2, 2/2/2) and each run again with the records of its line removed
// (test/harness/card-spec.ts, withoutLine), where it must not hold. The heading is set on the table as the Heading card would show it.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { legalAttackEnemies } from "../../../rules/combat/combat.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { GameEvent, ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";
import { legalTargets } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import type { Heading } from "../../../rules/families/sea/types.ts";
import { performSailing } from "../../../rules/families/sea/sailing.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { withoutLine } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, revealFromTop, send, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";

const ID = "a-storm-on-cobas-haven";
const TOWERS = { seaWard: "12134", gull: "12135", beacon: "12136", heron: "12137" } as const;
const FLAGSHIP = "12124";
const SHIP = "110138"; // Duskbringer, a ship-objective
const without = (line: string): readonly Effect[] => withoutLine(EFFECTS, line);

// The table of the layout, with the Heading card showing `heading` (none: the game has no Heading card).
function table(layout: Layout = {}, effects: readonly Effect[] = EFFECTS, heading?: Heading): LayoutTable {
  const made = tableFromLayout(ID, layout, { effects });
  if (!heading) return made;
  return { ...made, state: syncConstants({ ...made.state, sea: { heading, headingCard: null, routes: {} } }, made.ctx) };
}

// The card is revealed from the top of the encounter deck, and what it opens is answered by `pick` (the first option by default).
function reveal(made: LayoutTable, code: string, pick?: (state: ScenarioState) => string): Run & { id: string } {
  const steps: EngineStep[] = [];
  const shown = revealFromTop(made.state, made.ctx, code, steps);
  return { ...finish({ state: shown.state, steps }, made.ctx, pick), id: shown.id };
}

// The engine announces the event to the Forced effects, and what they start resolves; the round stops where it is (resolveRecords, test/harness/scene-kit.ts).
function announce(made: LayoutTable, event: GameEvent): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle({ ...fireForced({ ...made.state, window: null }, event, made.ctx, steps), mode: "stopped" }, made.ctx, steps), steps }, made.ctx).state;
}

// The response windows a reveal leaves open are passed (Lanwyn's Response to a card with surge), and the choices answered by `pick`.
function passOut(run: Run, made: LayoutTable, pick?: (state: ScenarioState) => string): Run {
  let current = run;
  for (let guard = 0; guard < 20 && current.state.window?.kind === "response"; guard += 1) current = finish(send(current, { type: "Pass" }, made.ctx), made.ctx, pick);
  return current;
}

describe("the ships that cannot have attachments (12126, 12127)", () => {
  // "Cannot have attachments."
  for (const [code, line] of [["12126", "12126:A:2"], ["12127", "12127:A:2"]] as const) {
    it(`${line} neither a player attachment nor Taking on Water attaches to it`, () => {
      const made = table({ staging: [code] });
      const ship = idOf(made.state, code);
      expect(attachBlocked(made.state, made.ctx, ship, "attachment")).toBe(true);
      expect(attachBlocked(made.state, made.ctx, ship, "12132")).toBe(true);
      const bare = table({ staging: [code] }, without(line));
      expect(attachBlocked(bare.state, bare.ctx, idOf(bare.state, code), "attachment")).toBe(false);
    });
  }
});

describe("the Dol Amroth towers (12134 to 12137)", () => {
  // "Guarded." The next card of the encounter deck is revealed and attached to the objective (rr.guarded).
  for (const [code, line] of [[TOWERS.gull, "12135:A:1"], [TOWERS.beacon, "12136:A:1"], [TOWERS.heron, "12137:A:1"]] as const) {
    it(`${line} revealed, it is guarded by the next card of the encounter deck, both in the staging area`, () => {
      const made = table({ deck: ["f0", "f3"] });
      const { state, id } = reveal(made, code);
      const guard = state.cards[idOf(state, "f0")];
      expect(state.cards[id]?.zone).toBe("staging");
      expect(guard).toMatchObject({ host: id, guard: true });
      expect(state.cards[idOf(state, "f3")]?.zone).toBe("encounterDeck");
      const bare = table({ deck: ["f0", "f3"] }, without(line));
      const plain = reveal(bare, code);
      expect(plain.state.cards[plain.id]?.attachments).toEqual([]);
    });
  }

  // rr.guarded: "If the next card also has the guarded keyword, use the next card of the encounter deck to fulfill the original keyword effect, and then resolve the guarded keyword on the second card."
  // FAULT: the second tower is revealed with the guarded keyword, so it goes to the staging area and is guarded in its turn (rr.guarded); the engine skips it and leaves it in the encounter deck.
  it.fails("12135:A:1 a second tower revealed as its guard goes to the staging area, the next card guards the first, and the second tower is guarded in turn", () => {
    const made = table({ deck: [TOWERS.heron, "f0", "f3"] });
    const { state, id } = reveal(made, TOWERS.gull);
    const heron = idOf(state, TOWERS.heron);
    expect(state.cards[heron]?.zone).toBe("staging");
    expect(state.cards[idOf(state, "f0")]?.host).toBe(id);
    expect(state.cards[idOf(state, "f3")]?.host).toBe(heron);
  });

  // "If <tower> is free of encounters, add it to the staging area, controlled by the players."
  for (const [code, line] of [[TOWERS.gull, "12135:A:2"], [TOWERS.beacon, "12136:A:2"], [TOWERS.heron, "12137:A:2"]] as const) {
    it(`${line} guarded, the players do not control it; free of encounters, they do, and it stays in the staging area`, () => {
      const controlled = (effects: readonly Effect[]) => {
        const made = table({ staging: [code, "f0"] }, effects);
        const tower = idOf(made.state, code);
        const guard = idOf(made.state, "f0");
        const guarded = settle(guardWith(made.state, guard, tower), made.ctx, []);
        const freed = settle(syncConstants(moveCard(guarded, guard, { zone: "encounterDiscard" }), made.ctx), made.ctx, []);
        return { guarded: guarded.cards[tower]?.claimed === true, freed: freed.cards[tower]?.claimed === true, zone: freed.cards[tower]?.zone, controller: freed.cards[tower]?.controller };
      };
      expect(controlled(EFFECTS)).toEqual({ guarded: false, freed: true, zone: "staging", controller: null });
      expect(controlled(without(line)).freed).toBe(false);
    });
  }

  // "While the players control Sea-ward Tower, look at 2 additional cards from the top of the encounter deck during each Sailing test." One hero commits: one card, and two more.
  it("12134:A:3 while the players control Sea-ward Tower a Sailing test looks at 2 additional cards, and not while it is guarded", () => {
    const looked = (guarded: boolean, effects: readonly Effect[] = EFFECTS) => {
      const made = table({ staging: [TOWERS.seaWard, "f3"], deck: ["f0", "f0", "f0", "f0", "f0"] }, effects, "Storm");
      const tower = idOf(made.state, TOWERS.seaWard);
      const set = guarded ? guardWith(made.state, idOf(made.state, "f3"), tower) : made.state;
      const state = syncConstants(settle(set, made.ctx, []), made.ctx);
      const sailing = performSailing(state, [made.hero], made.ctx, []).sea?.sailing;
      return sailing && "looked" in sailing ? sailing.looked.length : 0;
    };
    expect(looked(false)).toBe(3);
    expect(looked(true)).toBe(1);
    expect(looked(false, without("12134:A:3"))).toBe(1);
  });
});

describe("Raider Flagship (12124)", () => {
  // "Only Ship objectives can be declared as attackers against Raider Flagship."
  it("12124:A:3 a hero cannot be declared as an attacker against it, a Ship objective can", () => {
    const made = table({ phase: "PlayerAttacks", engaged: [FLAGSHIP], play: [SHIP] });
    const flagship = idOf(made.state, FLAGSHIP);
    expect(legalAttackEnemies(made.state, 0, made.hero, made.cards)).not.toContain(flagship);
    expect(legalAttackEnemies(made.state, 0, idOf(made.state, SHIP), made.cards)).toContain(flagship);
    const bare = table({ phase: "PlayerAttacks", engaged: [FLAGSHIP], play: [SHIP] }, without("12124:A:3"));
    expect(legalAttackEnemies(bare.state, 0, bare.hero, bare.cards)).toContain(idOf(bare.state, FLAGSHIP));
  });

  // "Forced: At the end of the encounter phase, the engaged player reveals the top card of the Corsair deck and engages it."
  const END_OF_ENCOUNTER: GameEvent = { trigger: "endOfPhase", seat: null, phase: "Encounter" };
  const corsairs = { corsairDeck: ["11060", "11061"] };

  it("12124:A:4 at the end of the encounter phase the player it is engaged with, the second, engages the top card of the Corsair deck", () => {
    const layout: Layout = { seats: 2, phase: "Encounter", engaged: [{ code: FLAGSHIP, seat: 1 }], piles: corsairs };
    const state = announce(table(layout), END_OF_ENCOUNTER);
    expect(state.seats[1].engaged.map((id) => state.cards[id]?.code)).toEqual([FLAGSHIP, "11060"]);
    expect(state.seats[0].engaged).toEqual([]);
    expect(state.cards[idOf(state, "11061")]?.zone).toBe("corsairDeck");
    const bare = announce(table(layout, without("12124:A:4")), END_OF_ENCOUNTER);
    expect(bare.cards[idOf(bare, "11060")]?.zone).toBe("corsairDeck");
  });

  it("12124:A:4 in the staging area it is engaged with nobody, and no Corsair is revealed", () => {
    const state = announce(table({ phase: "Encounter", staging: [FLAGSHIP], piles: corsairs }), END_OF_ENCOUNTER);
    expect(state.cards[idOf(state, "11060")]?.zone).toBe("corsairDeck");
  });
});

describe("the locations of the heading (12128, 12129)", () => {
  // "If you are off-course (Cloud, Rain, or Storm), Coast of Anfalas gets +2 Threat." It prints 3.
  it("12128:A:1 it gets +2 Threat off-course, and none on-course", () => {
    const threat = (heading: Heading, effects: readonly Effect[] = EFFECTS) => {
      const made = table({ staging: ["12128"] }, effects, heading);
      const coast = made.state.cards[idOf(made.state, "12128")];
      return coast ? modifiedStat(made.state, coast, "threat", made.cards) : -1;
    };
    expect(threat("Sun")).toBe(3);
    expect(threat("Cloud")).toBe(5);
    expect(threat("Storm")).toBe(5);
    expect(threat("Storm", without("12128:A:1"))).toBe(3);
  });

  // "You cannot travel to Belfalas Islet if you are off-course (Cloud, Rain, or Storm)."
  it("12129:A:1 the players cannot travel to it off-course, and can on-course", () => {
    const travels = (heading: Heading, effects: readonly Effect[] = EFFECTS) => {
      const made = table({ phase: "Travel", staging: ["12129"] }, effects, heading);
      return legalTargets(made.state, { type: "Travel" }, made.ctx).includes(idOf(made.state, "12129"));
    };
    expect(travels("Sun")).toBe(true);
    expect(travels("Rain")).toBe(false);
    expect(travels("Rain", without("12129:A:1"))).toBe(true);
  });
});

describe("Gavin (11210)", () => {
  // "When Revealed: Put Gavin into play under any player's control committed to the quest. Add 1 resource to Lanwyn's resource pool, if able." The first player names the player
  // (docs/scenarios/dream-chaser.md). Gavin has Surge, so the deck holds a card for it.
  const LANWYN = "12030";
  // Lanwyn is a hero of the second player.
  const withLanwyn = (made: LayoutTable): LayoutTable => ({ ...made, state: syncConstants(spawn(made.state, LANWYN, { zone: "heroes", seat: 1 }).state, made.ctx) });

  it("11210:A:5 the player the first player names takes him committed to the quest, and Lanwyn gets 1 resource", () => {
    const layout: Layout = { seats: 2, deck: ["f0", "f0"] };
    const made = withLanwyn(tableFromLayout(ID, layout, { extra: [LANWYN] }));
    const toSecond = (now: ScenarioState) => (now.window?.kind === "choose" && now.window.options.includes("seat:1") ? "seat:1" : now.window?.kind === "choose" ? (now.window.options[0] ?? "") : "");
    const shown = reveal(made, "11210", toSecond);
    const { state } = passOut(shown, made, toSecond);
    const id = shown.id;
    expect(state.cards[id]).toMatchObject({ zone: "play", controller: 1, committed: true });
    expect(state.cards[idOf(state, LANWYN)]?.resources).toBe(1);
    const bare = withLanwyn(tableFromLayout(ID, layout, { extra: [LANWYN], effects: without("11210:A:5") }));
    const plain = reveal(bare, "11210");
    expect(passOut(plain, bare).state.cards[plain.id]?.zone).not.toBe("play");
  });

  it("11210:A:5 with no Lanwyn in play he still enters play committed to the quest", () => {
    const { state, id } = reveal(table({ deck: ["f0", "f0"] }), "11210");
    expect(state.cards[id]).toMatchObject({ zone: "play", controller: 0, committed: true });
  });
});
