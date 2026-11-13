// Rules: mec108.day-and-night, faq.triggering-forced-effects, rr.cancel, rr.engagement-check, rr.first-player (data/rules/entries.json).
// Day and Night (src/rules/families/angmar/day-night.ts) on the scenario's own table: the Time objective's two sides, the flip at the end of each round and what hears it, the stages that read it, and the engagement a flip sends back or makes.
// Each test starts its title with the line it covers; cards.test.ts holds the encounter cards, pool.test.ts the pool cards and the log.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { flagged } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { finish, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-wastes-of-eriador";
const DAYBREAK = "10011";
const NIGHTFALL = "10012";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10013", phase: "Refresh", staging: [DAYBREAK], ...layout });
type Table = ReturnType<typeof at>;
const scope = { actor: 0, sourceId: null, returned: 0 };

// An event heard now: the Forced effects and Responses it pushes, resolved.
function hear(state: ScenarioState, t: Table, trigger: "endOfRound" | "becameDay" | "becameNight"): ScenarioState {
  const steps: EngineStep[] = [];
  const pushed = fireForced(state, { trigger, seat: null }, t.ctx, steps);
  return finish({ state: settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, steps), steps }, t.ctx).state;
}
const timeCode = (state: ScenarioState): string | undefined => Object.values(state.cards).find((card) => card.code === DAYBREAK || card.code === NIGHTFALL)?.code;
const night = (layout: Layout = {}) => at({ ...layout, staging: [NIGHTFALL, ...(layout.staging ?? [])] });
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

describe("10011:A:3 and 10012:A:3 flip the Time objective at the end of each round, once", () => {
  it("10011:A:3 flips Daybreak to Nightfall at the end of the round, and Nightfall's own Forced effect is not heard in that round", () => {
    const t = at({ deck: ["10018", "10018"] });
    const out = hear(t.state, t, "endOfRound");
    expect(timeCode(out)).toBe(NIGHTFALL);
    // Nightfall's end-of-round Forced (10012:A:3) was not in play and active when the round ended: it does not flip the card back.
    expect(out.cards[idOf(out, NIGHTFALL)]).toBeDefined();
  });

  it("10012:A:3 flips Nightfall back to Daybreak at the end of the round", () => {
    const t = night();
    expect(timeCode(hear(t.state, t, "endOfRound"))).toBe(DAYBREAK);
  });
});

describe("10011:A:1, 10012:A:1 and the condition timeOfDay read the side of the Time objective that is up", () => {
  it("10011:A:1 is Day while Daybreak is up: enemies make no engagement checks, and the condition holds for Day only", () => {
    const t = at();
    expect(flagged(t.state, "table", "noEngagementChecks")).toBe(true);
    expect(holds(t.state, { kind: "timeOfDay", is: "day" }, scope, t.ctx)).toBe(true);
    expect(holds(t.state, { kind: "timeOfDay", is: "night" }, scope, t.ctx)).toBe(false);
    expect(flagged(t.state, "table", "noQuestProgress")).toBe(false);
    expect(flagged(t.state, "table", "encounterUncancelable")).toBe(false);
  });

  it("10012:A:1 is Night while Nightfall is up: no progress on quest cards, encounter card effects cannot be canceled, engagement checks are made", () => {
    const t = night();
    expect(holds(t.state, { kind: "timeOfDay", is: "night" }, scope, t.ctx)).toBe(true);
    expect(holds(t.state, { kind: "timeOfDay", is: "day" }, scope, t.ctx)).toBe(false);
    expect(flagged(t.state, "table", "noQuestProgress")).toBe(true);
    expect(flagged(t.state, "table", "encounterUncancelable")).toBe(true);
    expect(flagged(t.state, "table", "noEngagementChecks")).toBe(false);
  });

  it("10012:A:1 stops progress on the main quest card and on a current encounter side quest at Night, while the active location still takes its progress", () => {
    // Fend Off Despair (10173) is the current quest, Shrouded Hills (5 quest points) the active location; 7 progress is placed by questing.
    const placed = (table: Table) => {
      const quest = idOf(table.state, "10173");
      const current = { ...table.state, modifiers: [...table.state.modifiers, { instanceId: quest, sourceId: quest, stat: "currentQuest" as const, amount: 1, until: "endOfPhase" as const }] };
      const next = placeQuestProgress(current, 7, table.cards, [], () => false, true);
      return { location: next.cards[idOf(next, "09048")]?.progress, sideQuest: next.cards[quest]?.progress, stage: next.cards[idOf(next, "10013")]?.progress };
    };
    const layout = { phase: "Quest" as const, active: "09048" };
    expect(placed(night({ ...layout, staging: ["10173"] }))).toEqual({ location: 5, sideQuest: 0, stage: 0 });
    // By day the same 7 fill the location and put the other 2 on the side quest.
    expect(placed(at({ ...layout, staging: [DAYBREAK, "10173"] }))).toEqual({ location: 5, sideQuest: 2, stage: 0 });
  });

  it("10011:A:1 and 10012:A:1 follow the flip: the flags of the side that was up end, the other side's begin", () => {
    const t = at({ deck: ["10018"] });
    const flipped = hear(t.state, t, "endOfRound");
    expect(flagged(flipped, "table", "noEngagementChecks")).toBe(false);
    expect(flagged(flipped, "table", "noQuestProgress")).toBe(true);
    expect(flagged(flipped, "table", "encounterUncancelable")).toBe(true);
    const back = hear(flipped, t, "endOfRound");
    expect(flagged(back, "table", "noEngagementChecks")).toBe(true);
    expect(flagged(back, "table", "noQuestProgress")).toBe(false);
  });

  it("10011:A:1 holds neither time with no Time objective in play", () => {
    const t = tableFromLayout(ID, { stage: "10013", phase: "Refresh" });
    expect(holds(t.state, { kind: "timeOfDay", is: "day" }, scope, t.ctx)).toBe(false);
    expect(holds(t.state, { kind: "timeOfDay", is: "night" }, scope, t.ctx)).toBe(false);
  });
});

describe("10011:A:2 and 10012:A:2 answer the change of time", () => {
  it("10011:A:2 returns each engaged enemy to the staging area when it becomes Day, whoever it is engaged with", () => {
    const t = night({ seats: 2, engaged: [{ code: "f3", seat: 0 }, { code: "f0", seat: 1 }] });
    const out = hear(t.state, t, "endOfRound");
    expect(timeCode(out)).toBe(DAYBREAK);
    expect(zoneOf(out, "f3")).toBe("staging");
    expect(zoneOf(out, "f0")).toBe("staging");
  });

  it("10012:A:2 has the first player reveal an encounter card when it becomes Night", () => {
    const t = at({ deck: ["10018", "10018"] });
    const out = hear(t.state, t, "endOfRound");
    expect(out.encounterDeck).toHaveLength(1);
    expect(zoneOf(out, "10018")).toBe("staging");
  });

  it("10012:A:2 is not heard at Setup: Daybreak is dealt faceup with no change announced", () => {
    const t = at({ deck: ["10018"] });
    expect(t.state.encounterDeck).toHaveLength(1);
    expect(timeCode(t.state)).toBe(DAYBREAK);
  });
});

describe("10013:B:1 and 10013:B:2 read Day and Night", () => {
  it("10013:B:1 gives each hero +1 Willpower while it is Day, and not at Night", () => {
    const day = at();
    const base = modifiedStat(night().state, night().state.cards[night().hero]!, "willpower", night().cards);
    expect(modifiedStat(day.state, day.state.cards[day.hero]!, "willpower", day.cards)).toBe(base + 1);
  });

  it("10013:B:2 raises each player's threat by 1 when it becomes Night", () => {
    const t = at({ seats: 2, threat: [30, 31], deck: ["10018", "10018"] });
    const out = hear(t.state, t, "becameNight");
    expect([out.seats[0]?.threat, out.seats[1]?.threat]).toEqual([31, 32]);
  });
});

describe("10026:A:1 flips the Time objective to Nightfall at Day only", () => {
  it("10026:A:1 flips Daybreak to Nightfall, and the flip is heard (each player raises threat by 1, 10013:B:2)", () => {
    const t = at({ threat: [30, 30], deck: ["10018"] });
    const run = resolveRecords(t.state, t.ctx, "10026", "whenRevealed");
    expect(timeCode(run.state)).toBe(NIGHTFALL);
    expect(run.state.seats[0]?.threat).toBe(31);
  });

  it("10026:A:1 raises each player's threat by 4 at Night, and a flip to the side already up announces nothing", () => {
    const t = night({ threat: [30, 30] });
    const run = resolveRecords(t.state, t.ctx, "10026", "whenRevealed");
    expect(timeCode(run.state)).toBe(NIGHTFALL);
    expect(run.state.seats[0]?.threat).toBe(34);
  });
});
