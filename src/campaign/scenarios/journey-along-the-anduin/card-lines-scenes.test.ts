// Rules: rr.shadow-effects, rr.surge, rr.step-6-4-3, rr.action, rr.campaign-cards, rr.attachment-cards, rr.damage, rr.lasting-effects (data/rules/entries.json).
// Lines: 900202:A:2, 900203:A:1, 900204:A:1, 900204:A:3, 900205:A:2, 900206:A:1, 900206:A:2, 01133:A:1, 01138:A:1, 01130:A:2. The Journey Along the Anduin lines a single card-spec row cannot show
// (card-lines.test.ts holds the rows): the false cases and the durations (rows played with `rowProblems`, which holds with and without the records, beside the row that does not), the second player, damage
// placed, the hosts Valor and Scarred may take and the campaign card's Setup. Each runs again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { attachmentHostIds } from "../../../rules/player/attach.ts";
import { answer, attack, damageOn, deckCount, defend, endPhase, endRound, flag, resolve, reveal, type Row, rowProblems, stat, threat, withoutLines, zone } from "../../../../test/harness/card-spec.ts";
import { finish, first, idOf, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const ID = "journey-along-the-anduin";
const HILL_TROLL = "01082";
const MENDOR = "01135";
const VALOR = "01133";
const SCARRED = "01138";
const make = (layout: Layout, effects: readonly Effect[] = EFFECTS): LayoutTable => tableFromLayout(ID, layout, { effects });
// What a row says is wrong on these records: nothing when it holds.
const problems = (row: Row, effects: readonly Effect[] = EFFECTS): string[] => rowProblems(ID, row, effects);

describe("900202 Marshland Outlaws", () => {
  // "Shadow: Raise your threat by X. X is the amount of damage dealt by this attack." dh1 (2 Defense) defends f3 (1 Attack): no damage, no threat.
  it("900202:A:2 raises the threat by nothing when the defended attack deals no damage, and by 1 when it deals 1", () => {
    expect(problems({ line: "900202:A:2", act: [attack("f3", { shadow: "900202" }), defend("dh1")], expect: [damageOn("dh1", 0), threat(28)] })).toEqual([]);
    const undefended: Row = { line: "900202:A:2", act: attack("f3", { shadow: "900202", undefended: true }), expect: threat(29) };
    expect(problems(undefended)).toEqual([]);
    expect(problems(undefended, withoutLines(EFFECTS, "900202:A:2"))).not.toEqual([]);
  });
});

describe("900203 Anduin Troll Spawn", () => {
  // "If there is no Hill Troll in play, Anduin Troll Spawn gains surge." A Hill Troll engaged with the player is in play.
  it("900203:A:1 gains no surge while a Hill Troll is engaged with a player", () => {
    const surge: Row = { line: "900203:A:1", layout: { deck: ["f0", "f0"] }, act: reveal("900203"), expect: deckCount(1) };
    expect(problems({ line: "900203:A:1", layout: { engaged: [HILL_TROLL], deck: ["f0", "f0"] }, act: reveal("900203"), expect: deckCount(2) })).toEqual([]);
    expect(problems({ line: "900203:A:1", layout: { staging: [HILL_TROLL], deck: ["f0", "f0"] }, act: reveal("900203"), expect: deckCount(2) })).toEqual([]);
    expect(problems(surge, withoutLines(EFFECTS, "900203:A:1"))).not.toEqual([]);
  });
});

describe("900204 Brown Water Rats", () => {
  // A:1 "Brown Water Rats cannot be damaged."
  it("900204:A:1 damage placed on Brown Water Rats does not land", () => {
    const hurt = (effects: readonly Effect[]) => {
      const made = make({ engaged: ["900204"] }, effects);
      const id = idOf(made.state, "900204");
      const state = placeDamage(made.state, id, 2, made.cards, [], "framework", ruleCause("rr.damage"));
      return { zone: state.cards[id]?.zone, damage: state.cards[id]?.damage ?? 0 };
    };
    expect(hurt(EFFECTS)).toEqual({ zone: "engaged", damage: 0 });
    expect(hurt(withoutLines(EFFECTS, "900204:A:1"))).not.toEqual({ zone: "engaged", damage: 0 });
  });

  // A:3 "Shadow: Attacking enemy cannot be damaged this round." The round is passed to its end after the attack.
  it("900204:A:3 the attacking enemy can be damaged again once the round is over", () => {
    expect(problems({ line: "900204:A:3", act: [attack("f3", { shadow: "900204" }), defend("dh1"), endRound], expect: flag("f3", "cannotTakeDamage", false) })).toEqual([]);
    expect(problems({ line: "900204:A:3", act: [attack("f3", { shadow: "900204" }), defend("dh1")], expect: flag("f3", "cannotTakeDamage") }, withoutLines(EFFECTS, "900204:A:3"))).not.toEqual([]);
  });
});

describe("900205 A Flooded Ford", () => {
  // "Shadow: If this attack is undefended, put A Flooded Ford into the staging area with 1 progress token on it."
  it("900205:A:2 a defended attack leaves A Flooded Ford with the attacker as its shadow card, out of the staging area", () => {
    expect(problems({ line: "900205:A:2", act: [attack("f3", { shadow: "900205" }), defend("dh1")], expect: zone("900205", "shadow") })).toEqual([]);
    expect(problems({ line: "900205:A:2", act: attack("f3", { shadow: "900205", undefended: true }), expect: zone("900205", "staging") }, withoutLines(EFFECTS, "900205:A:2"))).not.toEqual([]);
  });
});

describe("900206 Gladden Marshlands", () => {
  // A:1 "Action: Deal 1 damage to a hero you control to reduce Gladden Marshlands' Threat by 1 until the end of the phase. Any player may trigger this effect." It prints 10 Threat.
  it("900206:A:1 the Threat is 10 again once the phase is over", () => {
    expect(problems({ line: "900206:A:1", layout: { phase: "Planning", staging: ["900206"] }, act: [resolve("900206", "action"), answer("dh1"), endPhase], expect: stat("900206", "threat", 10) })).toEqual([]);
    expect(problems({ line: "900206:A:1", layout: { phase: "Planning", staging: ["900206"] }, act: [resolve("900206", "action"), answer("dh1")], expect: stat("900206", "threat", 9) }, withoutLines(EFFECTS, "900206:A:1"))).not.toEqual([]);
  });

  it("900206:A:1 the second player may trigger it, dealing the damage to a hero he controls", () => {
    const used = (effects: readonly Effect[]) => {
      const made = make({ seats: 2, phase: "Planning", staging: ["900206"] }, effects);
      const state = { ...made.state, activeSeat: 1 };
      const marsh = idOf(state, "900206");
      const intent = legalIntents(state, made.ctx).find((offered) => offered.type === "Trigger" && offered.cardId === marsh);
      if (!intent) return null;
      const run = finish(send(start(state), intent as PlayerIntent, made.ctx), made.ctx);
      return { dh3: run.state.cards[idOf(run.state, "dh3")]?.damage ?? 0, dh1: run.state.cards[idOf(run.state, "dh1")]?.damage ?? 0 };
    };
    expect(used(EFFECTS)).toEqual({ dh3: 1, dh1: 0 });
    expect(used(withoutLines(EFFECTS, "900206:A:1"))).toBeNull();
  });

  // A:2 "Shadow: Each enemy engaged with the defending player gets +1 Attack until the end of the phase." Marshland Outlaws 900202 (2 Attack) is engaged with him beside the attacker f3; another f3 is engaged with the
  // second player, who does not defend.
  it("900206:A:2 the bonus ends with the combat phase and reaches no enemy engaged with another player", () => {
    const layout: Layout = { seats: 2, engaged: ["f3", "900202", { code: "01082", seat: 1 }] };
    expect(problems({ line: "900206:A:2", layout, act: [attack("f3", { shadow: "900206" }), defend("dh1")], expect: [stat("900202", "attack", 3), stat("01082", "attack", 6)] })).toEqual([]);
    expect(problems({ line: "900206:A:2", layout, act: [attack("f3", { shadow: "900206" }), defend("dh1"), endPhase], expect: stat("900202", "attack", 2) })).toEqual([]);
    expect(problems({ line: "900206:A:2", layout, act: [attack("f3", { shadow: "900206" }), defend("dh1")], expect: stat("900202", "attack", 3) }, withoutLines(EFFECTS, "900206:A:2"))).not.toEqual([]);
  });
});

describe("01133 Valor and 01138 Scarred", () => {
  // "Permanent. Limit 1 per hero." A hero that already carries one cannot take a second; the other hero can.
  for (const [code, line] of [[VALOR, "01133:A:1"], [SCARRED, "01138:A:1"]] as const) {
    it(`${line} a hero that carries one cannot take a second`, () => {
      const hosts = (effects: readonly Effect[]): string[] => {
        const made = make({ attached: [{ code, to: "dh1" }], play: ["ally"] }, effects);
        return attachmentHostIds(made.state, 0, code, made.ctx).map((id) => made.state.cards[id]?.code ?? id).sort();
      };
      expect(hosts(EFFECTS)).toEqual(["dh2"]);
      expect(hosts(withoutLines(EFFECTS, line))).toContain("dh1");
    });
  }
});

describe("01130 Journey Along the Anduin (campaign card)", () => {
  // A:2 "Setup: Put Mendor into play. Set each copy of Valor and Scarred aside, out of play." Two players, the second the first player: Mendor goes to him, and a copy of each for each player is set aside.
  it("01130:A:2 puts Mendor into play under the first player and sets a Valor and a Scarred aside for each player", () => {
    const setUp = (effects: readonly Effect[]) => {
      const made = make({ seats: 2, firstPlayer: 1, campaign: true }, effects);
      const run = resolveRecords(made.state, made.ctx, "01130", "campaignSetup", first(made.state, "01130"));
      const all = Object.values(run.state.cards);
      return {
        mendor: all.filter((card) => card.code === MENDOR).map((card) => [card.zone, card.controller]),
        valor: all.filter((card) => card.code === VALOR && card.zone === "setAside").length,
        scarred: all.filter((card) => card.code === SCARRED && card.zone === "setAside").length,
      };
    };
    expect(setUp(EFFECTS)).toEqual({ mendor: [["play", 1]], valor: 2, scarred: 2 });
    expect(setUp(withoutLines(EFFECTS, "01130:A:2"))).toEqual({ mendor: [], valor: 0, scarred: 0 });
  });
});
