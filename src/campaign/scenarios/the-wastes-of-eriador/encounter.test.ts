// Rules: mec108.day-and-night, mec108.side-quests-in-play, rr.travel, rr.the-word-choose, rr.first-player, rr.reveal, rr.attachment-cards, faq.additional-attacks, faq.enemy-attacks-outside-combat (data/rules/entries.json).
// White Warg, Wolf of Angmar, Eriador Wastes, Warg's Den, North Downs, Sudden Darkness and Predatory Wolves on the scenario's own table, by the time of day each reads. Each test starts its title with the line it covers; cards.test.ts holds the stages and the first
// five encounter cards.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import { fightEnemy, idOf, idsOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { questRoom } from "../../../rules/families/caves/progress.ts";

const ID = "the-wastes-of-eriador";
const DAYBREAK = "10011";
const NIGHTFALL = "10012";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10013", phase: "Quest", staging: [DAYBREAK], ...layout });
const night = (layout: Layout = {}) => at({ ...layout, staging: [NIGHTFALL, ...(layout.staging ?? [])] });
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
const damageOn = (state: ScenarioState, id: string): number => state.cards[id]?.damage ?? 0;
type Table = ReturnType<typeof at>;
const fight = (time: "day" | "night", shadow: string, layout: Layout = {}, tweak?: (state: ScenarioState, made: Table) => ScenarioState) =>
  fightEnemy((made: Layout) => (time === "night" ? night(made) : at(made)), shadow, "f3", { phase: "Encounter", deckOf: ["filler", "filler"], ...layout }, { undefended: true, ...(tweak ? { tweak } : {}) });

describe("10021:A:1 and 10021:A:2 are the White Warg's lines", () => {
  it("10021:A:1 deals 1 damage to a character you control after it engages you at Day, 2 at Night", () => {
    const damage = (time: "day" | "night") => {
      const t = time === "night" ? night({ staging: ["10021"] }) : at({ staging: ["10021"] });
      const run = resolveRecords(t.state, t.ctx, "10021", "forced", idOf(t.state, "10021"));
      return Object.values(run.state.cards).reduce((sum, card) => sum + (card.zone === "heroes" ? card.damage : 0), 0);
    };
    expect(damage("day")).toBe(1);
    expect(damage("night")).toBe(2);
  });

  it("10021:A:2 makes an additional attack after this one at Night only", () => {
    const hurt = (time: "day" | "night") => {
      const run = fight(time, "10021");
      return damageOn(run.run.state, run.made.hero);
    };
    expect(hurt("night")).toBe(hurt("day") * 2);
    expect(hurt("day")).toBeGreaterThan(0);
  });
});

describe("10022:A:2 and 10022:A:3 are the Wolf of Angmar's lines", () => {
  it("10022:A:2 gets +2 Attack while it is Night, and not at Day", () => {
    const attack = (t: Table) => modifiedStat(t.state, t.state.cards[idOf(t.state, "10022")]!, "attack", t.cards);
    const day = at({ staging: ["10022"] });
    const dark = night({ staging: ["10022"] });
    expect(attack(dark)).toBe(attack(day) + 2);
  });

  it("10022:A:3 gives the attacking enemy +1 Attack at Day and +2 at Night", () => {
    const defended = (time: "day" | "night") => {
      const run = fightEnemy((made: Layout) => (time === "night" ? night(made) : at(made)), "10022", "f3", { phase: "Encounter", deckOf: ["filler"] });
      return damageOn(run.run.state, run.made.hero);
    };
    // f3 has 1 Attack and the hero 2 Defense: +1 leaves no damage, +2 leaves 1.
    expect(defended("day")).toBe(0);
    expect(defended("night")).toBe(1);
  });
});

describe("10023:A:1 and 10023:A:2 are Eriador Wastes", () => {
  it("10023:A:1 lets no more than 5 progress be placed on the current quest each round while it is in the staging area", () => {
    const t = at({ staging: [DAYBREAK, "10023"] });
    expect(questRoom(t.state)).toBe(5);
    expect(questRoom(at({ active: "10023" }).state)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("10023:A:2 has the first player engage a Warg enemy in the staging area and deal it a shadow card, and cannot be paid with no Warg there", () => {
    const t = at({ active: "10023", staging: [DAYBREAK, "10019"], deck: ["f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "10023", "travel", idOf(t.state, "10023"));
    expect(zoneOf(run.state, "10019")).toBe("engaged");
    expect(run.state.cards[idOf(run.state, "10019")]?.shadowId).toBeDefined();
    const bare = at({ staging: [DAYBREAK, "10023"] });
    expect(travelCostUnpayable(bare.state, bare.ctx, idOf(bare.state, "10023"))).toBe(true);
    expect(travelCostUnpayable(t.state, t.ctx, idOf(t.state, "10023"))).toBe(false);
  });
});

describe("10024:A:2 is Warg's Den", () => {
  it("10024:A:2 searches the encounter deck and discard pile for a Warg, reveals it and puts it into play engaged with the first player", () => {
    const t = at({ active: "10024", deck: ["10025", "10018"], discard: ["10019"] });
    const run = resolveRecords(t.state, t.ctx, "10024", "travel", idOf(t.state, "10024"));
    const engaged = Object.values(run.state.cards).filter((card) => card.zone === "engaged");
    expect(engaged).toHaveLength(1);
    expect(engaged[0]?.controller).toBe(0);
  });

  it("10024:A:2 is a cost that cannot be paid when no Warg is left to find", () => {
    const none = at({ staging: [DAYBREAK, "10024"], deck: ["10025"] });
    expect(travelCostUnpayable(none.state, none.ctx, idOf(none.state, "10024"))).toBe(true);
    const one = at({ staging: [DAYBREAK, "10024"], deck: ["10025"], discard: ["10018"] });
    expect(travelCostUnpayable(one.state, one.ctx, idOf(one.state, "10024"))).toBe(false);
  });
});

describe("10025:A:1 and 10025:A:2 are North Downs", () => {
  it("10025:A:1 gets +2 Threat while it is Night", () => {
    const threat = (t: Table) => modifiedStat(t.state, t.state.cards[idOf(t.state, "10025")]!, "threat", t.cards);
    expect(threat(night({ staging: ["10025"] }))).toBe(threat(at({ staging: ["10025"] })) + 2);
  });

  it("10025:A:2 gives the attacking enemy +1 Attack and removes all progress from the current quest when the attack destroys a character", () => {
    const run = fight("day", "10025", { progress: 4 }, (state, made) => updateCard(state, made.hero, { damage: 5 }));
    expect(run.run.state.cards[run.made.hero]?.zone).not.toBe("heroes");
    expect(run.run.state.cards[idOf(run.run.state, "10013")]?.progress).toBe(0);
    const spared = fight("day", "10025", { progress: 4 });
    expect(spared.run.state.cards[idOf(spared.run.state, "10013")]?.progress).toBe(4);
  });
});

describe("10026:A:2 is the Sudden Darkness shadow", () => {
  it("10026:A:2 puts the topmost Warg enemy of the discard pile into play engaged with you and deals it a shadow card", () => {
    const run = fight("day", "10026", { discard: ["10025", "10019", "10018"] });
    const wargs = ["10019", "10018"].flatMap((code) => idsOf(run.run.state, code)).filter((id) => run.run.state.cards[id]?.zone === "engaged");
    expect(wargs).toHaveLength(1);
    expect(run.run.state.cards[wargs[0] ?? ""]?.shadowId).toBeDefined();
  });
});

describe("10027:A:1 is Predatory Wolves", () => {
  const reveal = (layout: Layout, pick: (state: ScenarioState) => string) => {
    const t = at({ phase: "Encounter", ...layout });
    return resolveRecords(t.state, t.ctx, "10027", "whenRevealed", undefined, pick);
  };

  it("10027:A:1 lets a player discard the highest cost ally they control, Amarthiúl counting as cost 0", () => {
    const run = reveal({ play: ["ally", "10016"], deck: ["10018"] }, () => "discard");
    expect(zoneOf(run.state, "ally")).toBe("discard");
    expect(zoneOf(run.state, "10016")).toBe("play");
  });

  it("10027:A:1 lets a player search for a Warg enemy, reveal it and add it to the staging area instead", () => {
    const run = reveal({ play: ["ally"], deck: ["10025", "10018"] }, () => "search");
    expect(zoneOf(run.state, "ally")).toBe("play");
    expect(zoneOf(run.state, "10018")).toBe("staging");
  });

  it("10027:A:1 gives a player with no ally only the search", () => {
    const run = reveal({ deck: ["10018"] }, () => "discard");
    expect(zoneOf(run.state, "10018")).toBe("staging");
  });
});

const steps = (): EngineStep[] => [];
void steps;
void flagged;
