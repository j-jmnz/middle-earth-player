import { describe, expect, it } from "vitest";

import { definePrinted } from "../../core/printed.ts";
import { eliminateEmpties } from "../../core/eliminate.ts";
import { withThreat } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { lowerThreatByEffect } from "../quest/threat.ts";
import { hero, table, treachery } from "../defense/table.ts";
import { holds } from "../../interpret/conditions.ts";
import { DIRE_ELIMINATION_LEVEL, questIsDire, syncDire } from "./dire.ts";

// Rules: mec113.dire (data/rules/entries.json): while the main quest has the Dire keyword each player's threat elimination level is 99 and non-boon player card effects lower a player's threat by at most 1 each round.

const stage = (code: string, keywords: { dire?: boolean }) => definePrinted({ code, name: code, type: "quest", keywords: keywords as never });
const event = (code: string, extra = {}) => definePrinted({ code, name: code, type: "event", sphere: "lore", cost: 0, ...extra } as never);

function onStage(code: string, keywords: { dire?: boolean }) {
  const base = table({ cards: [hero("a"), stage(code, keywords), event("calm"), event("boon", { campaignKind: "boon" }), treachery("curse")], effects: [], heroes: [{ code: "a" }] });
  const placed = spawn(base.state, code, { zone: "questStage" });
  const state = syncDire({ ...placed.state, questStage: placed.id }, base.ctx);
  const source = (card: string, from = state) => spawn(from, card, { zone: "hand", seat: 0 });
  return { ...base, state, source };
}

describe("Dire (mec113.dire)", () => {
  it("is read from the main quest card and follows it", () => {
    const dire = onStage("dire-stage", { dire: true });
    expect(dire.state.dire).toBe(true);
    expect(questIsDire(dire.state, dire.ctx)).toBe(true);
    const plain = onStage("plain-stage", {});
    expect(plain.state.dire).toBeUndefined();
    expect(syncDire(plain.state, plain.ctx)).toBe(plain.state);
    const gone = syncDire({ ...dire.state, questStage: null }, dire.ctx);
    expect(gone.dire).toBeUndefined();
  });

  it("moves the elimination level from 50 to 99", () => {
    const dire = onStage("dire-stage", { dire: true });
    const high = eliminateEmpties(withThreat(dire.state, 0, 60), []);
    expect(high.seats[0]?.eliminated).toBeFalsy();
    const out = eliminateEmpties(withThreat(dire.state, 0, DIRE_ELIMINATION_LEVEL), []);
    expect(out.seats[0]?.eliminated).toBe(true);
    // Another quest keeps 50.
    const plain = onStage("plain-stage", {});
    expect(eliminateEmpties(withThreat(plain.state, 0, 50), []).seats[0]?.eliminated).toBe(true);
  });

  it("caps non-boon player card reductions at 1 each round, and a boon is not held to it", () => {
    const dire = onStage("dire-stage", { dire: true });
    const start = withThreat(dire.state, 0, 70);
    const first = dire.source("calm", start);
    const once = lowerThreatByEffect(first.state, 0, 3, first.id, dire.ctx, [], { kind: "rule", ruleId: "test" } as never);
    expect(once.seats[0]?.threat).toBe(69);
    const twice = lowerThreatByEffect(withThreat(once, 0, 69), 0, 3, first.id, dire.ctx, [], { kind: "rule", ruleId: "test" } as never);
    expect(twice.seats[0]?.threat).toBe(69);
    const boon = dire.source("boon", start);
    const eased = lowerThreatByEffect(boon.state, 0, 3, boon.id, dire.ctx, [], { kind: "rule", ruleId: "test" } as never);
    expect(eased.seats[0]?.threat).toBe(67);
    expect(eased.playerThreatLoweredBy?.[0]).toBeUndefined();
  });

  it("holds no cap against an encounter card, and no cap at all on another quest", () => {
    const dire = onStage("dire-stage", { dire: true });
    const curse = spawn(withThreat(dire.state, 0, 70), "curse", { zone: "encounterDiscard" });
    expect(lowerThreatByEffect(curse.state, 0, 3, curse.id, dire.ctx, [], { kind: "rule", ruleId: "test" } as never).seats[0]?.threat).toBe(67);
    const plain = onStage("plain-stage", {});
    const calm = spawn(withThreat(plain.state, 0, 40), "calm", { zone: "hand", seat: 0 });
    expect(lowerThreatByEffect(calm.state, 0, 3, calm.id, plain.ctx, [], { kind: "rule", ruleId: "test" } as never).seats[0]?.threat).toBe(37);
  });

  it("moves Valour's threshold from 40 to 80, and the complement of 22138 and 22002 with it, but not another threat condition", () => {
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const valour = { kind: "threat", min: 40, valour: true } as const;
    const notValour = { kind: "threat", max: 39, valour: true } as const;
    const own = { kind: "threat", min: 40 } as const;
    const at = (made: ReturnType<typeof onStage>, threat: number) => {
      const state = withThreat(made.state, 0, threat);
      return [valour, notValour, own].map((condition) => holds(state, condition, scope, made.ctx));
    };
    const plain = onStage("plain-stage", {});
    expect([39, 40].map((threat) => at(plain, threat))).toEqual([[false, true, false], [true, false, true]]);
    const dire = onStage("dire-stage", { dire: true });
    // Between 40 and 79 under Dire the card is not at Valour: the "not Valour" branch holds, a threshold of its own stays at 40.
    expect([39, 40, 79, 80].map((threat) => at(dire, threat))).toEqual([[false, true, false], [false, true, true], [false, true, true], [true, false, true]]);
  });
});
