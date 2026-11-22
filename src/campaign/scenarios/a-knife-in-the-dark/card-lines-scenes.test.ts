// Rules: rr.attachment-cards, rr.in-play-and-out-of-play, rr.constant-ability, rr.then, rr.first-player, rr.shadow-effects (data/rules/entries.json).
// The lines of A Knife in the Dark and its Nightmare deck that a card-spec row cannot say (card-lines.test.ts holds the rows): the traits the boons grant (141018:A:3, 141019:A:3, 141020:A:3, 141021:A:3),
// "Cannot have non-Morgul attachments." (141050:A:1, 141069:A:1, 906202:A:1), and the lines that read The One Ring exhausted or a second seat (906202:A:2, 906203:A:2, 906204:A:2, 906205:A:1, 906205:A:2,
// 906206:A:2, 906208:A:2). Each table is `tableFromLayout` on the records under test; `lineSpec` runs the check again without the records of its line, where it must fail.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { fightEnemy, finish, idOf, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "a-knife-in-the-dark";
const RING = "141085";
const RINGWRAITH = "141069";
const WITCH_KING = "141068";
const RIDER = "141050";
const MENACING = "906202";
const PALE_BLADE = "141070"; // a Morgul treachery that attaches to an enemy

// A table with The One Ring attached to the second hero (so the first defends), exhausted when `exhausted`.
function ringTable(layout: Layout, effects: readonly Effect[], exhausted: boolean): LayoutTable {
  const made = tableFromLayout(SCENARIO, { ...layout, attached: [...(layout.attached ?? []), { code: RING, to: "dh2" }] }, { effects, extra: [RING] });
  const state = exhausted ? updateCard(made.state, idOf(made.state, RING), { exhausted: true }) : made.state;
  return { ...made, state: syncConstants(state, made.ctx) };
}
const exhaustRing = (state: ScenarioState): ScenarioState => updateCard(state, idOf(state, RING), { exhausted: true });

// The engine announces the event to the Forced effects and the choices they open are answered with their first option.
function announced(table: LayoutTable, event: GameEvent): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...table.state, window: null }, event, table.ctx, steps), table.ctx, steps), steps }, table.ctx).state;
}

describe("the boons' traits (141018:A:3 to 141021:A:3)", () => {
  for (const [code, trait] of [["141018", "Ranger"], ["141019", "Healer"], ["141020", "Warrior"], ["141021", "Noble"]] as const) {
    lineSpec(`${code}:A:3`, `the attached hero gains the ${trait} trait and the other hero does not`, (effects) => {
      const table = tableFromLayout(SCENARIO, { attached: [{ code, to: "dh1" }] }, { effects });
      expect(hasTrait(table.state, table.hero, trait, table.ctx)).toBe(true);
      expect(hasTrait(table.state, table.hero2, trait, table.ctx)).toBe(false);
    });
  }
});

describe("Cannot have non-Morgul attachments (141050:A:1, 141069:A:1, 906202:A:1)", () => {
  for (const code of [RIDER, RINGWRAITH, MENACING]) {
    lineSpec(`${code}:A:1`, "a non-Morgul attachment cannot attach to it in the staging area or engaged, a Morgul card can", (effects) => {
      const staged = tableFromLayout(SCENARIO, { staging: [code] }, { effects });
      expect(attachBlocked(staged.state, staged.ctx, idOf(staged.state, code), "attachment")).toBe(true);
      expect(attachBlocked(staged.state, staged.ctx, idOf(staged.state, code), PALE_BLADE)).toBe(false);
      const engaged = tableFromLayout(SCENARIO, { engaged: [code] }, { effects });
      expect(attachBlocked(engaged.state, engaged.ctx, idOf(engaged.state, code), "attachment")).toBe(true);
    });
  }
});

describe("Menacing Wraith (906202:A:2)", () => {
  // "Forced: After The One Ring is exhausted, Menacing Wraith engages the first player and makes an immediate attack." It attacks for 5: undefended, the first player's hero takes it.
  lineSpec("906202:A:2", "after The One Ring is exhausted it engages the first player from the staging area and attacks", (effects) => {
    const table = ringTable({ staging: [MENACING], deck: ["f0", "f0"] }, effects, false);
    const state = announced({ ...table, state: exhaustRing(table.state) }, { trigger: "exhausted", seat: 0, cardId: idOf(table.state, RING) } as GameEvent);
    const wraith = state.cards[idOf(state, MENACING)];
    expect(wraith?.zone).toBe("engaged");
    expect(wraith?.controller).toBe(0);
    // The immediate attack is in progress against the first player: the defense is asked for.
    expect(state.pendingAttack?.enemyId).toBe(wraith?.id);
    expect(state.window?.kind).toBe("defense");
  });

  lineSpec("906202:A:2", "two-handed it engages the first player, the second seat, not the seat whose Ring was exhausted", (effects) => {
    const table = ringTable({ seats: 2, firstPlayer: 1, staging: [MENACING], deck: ["f0", "f0"] }, effects, false);
    const state = announced({ ...table, state: exhaustRing(table.state) }, { trigger: "exhausted", seat: 0, cardId: idOf(table.state, RING) } as GameEvent);
    const wraith = state.cards[idOf(state, MENACING)];
    expect(wraith?.zone).toBe("engaged");
    expect(wraith?.controller).toBe(1);
  });
});

describe("The One Ring exhausted (906203:A:2, 906205:A:2)", () => {
  // "Shadow: Defending character gets -1 Defense (-3 Defense instead if The One Ring is exhausted)." Shady Bree-Lander attacks for 3 against 2 Defense: 1 damage without the Shadow, 3 with -3 Defense.
  lineSpec("906203:A:2", "its Shadow gives the defender -3 Defense instead while The One Ring is exhausted", (effects) => {
    const build = (layout: Layout) => ringTable(layout, effects, false);
    const fought = fightEnemy(build, "906203", "141052", {}, { tweak: exhaustRing });
    expect(fought.run.state.cards[fought.made.hero]?.damage).toBe(3);
  });

  // "While The One Ring is exhausted, Weather Hills gets +2 Threat." Its printed Threat is 3.
  lineSpec("906205:A:2", "it gets +2 Threat while The One Ring is exhausted", (effects) => {
    const table = ringTable({ staging: ["906205"] }, effects, true);
    expect(modifiedStat(table.state, table.state.cards[idOf(table.state, "906205")]!, "threat", table.ctx.cards)).toBe(5);
  });

  it("906205:A:2 has its printed 3 Threat while The One Ring is ready", () => {
    const table = ringTable({ staging: ["906205"] }, EFFECTS, false);
    expect(modifiedStat(table.state, table.state.cards[idOf(table.state, "906205")]!, "threat", table.ctx.cards)).toBe(3);
  });
});

describe("Weather Hills at stage 2 (906205:A:1)", () => {
  // "While the players are at stage 1, progress cannot be placed here.": at stage 2 the quest's progress goes on the active location first. Not provable without the records: progress is placed either way.
  it("906205:A:1 takes progress as the active location once the players are at stage 2", () => {
    const table = tableFromLayout(SCENARIO, { stage: "141026", active: "906205" });
    expect(flagged(table.state, idOf(table.state, "906205"), "noProgressPlaced")).toBe(false);
  });
});

describe("Weathertop: The Witch-king cannot be damaged (906204:A:2)", () => {
  lineSpec("906204:A:2", "while Weathertop is in play the engaged Witch-king cannot be damaged", (effects) => {
    const table = tableFromLayout(SCENARIO, { active: "906204", engaged: [WITCH_KING] }, { effects });
    expect(flagged(table.state, idOf(table.state, WITCH_KING), "cannotTakeDamage")).toBe(true);
  });

  // FAULT: the card prints "The Witch-king cannot be damaged" with no zone, and a card in the staging area is in play (rr.in-play-and-out-of-play); the record's holders are the enemies players control, so the Witch-king in the staging area can be damaged.
  it.fails("906204:A:2 the Witch-king in the staging area cannot be damaged either: it is in play", () => {
    const table = tableFromLayout(SCENARIO, { active: "906204", staging: [WITCH_KING] });
    expect(flagged(table.state, idOf(table.state, WITCH_KING), "cannotTakeDamage")).toBe(true);
  });
});

describe("The Old Road's Then (906206:A:2, rr.then)", () => {
  // "Discard 1 resource token here. Then, if there are no resource tokens here, shuffle 1 out of play Ringwraith into the encounter deck.": with no token to discard the part before "then" does not resolve, so
  // no Ringwraith is shuffled in. Not provable without the records: the Ringwraith stays set aside either way.
  // FAULT: the card prints "Discard 1 resource token here. Then, if there are no resource tokens here, shuffle 1 out of play Ringwraith"; with no token to discard the engine still shuffles a Ringwraith in.
  it.fails("906206:A:2 with no resource token to discard shuffles no Ringwraith into the encounter deck", () => {
    const table = tableFromLayout(SCENARIO, { staging: [{ code: "906206", resources: 0 }], setAside: [RINGWRAITH], deck: ["f0"] });
    const state = announced(table, { trigger: "endOfRound", seat: 0 } as GameEvent);
    expect(state.cards[idOf(state, RINGWRAITH)]?.zone).toBe("setAside");
  });
});

describe("The Ring's Will in true solo (906208:A:2)", () => {
  // "After this attack, attacking enemy engages the next player then makes an immediate attack.": with no other player the enemy stays engaged and attacks once. Not provable without the records.
  it("906208:A:2 true solo: the enemy stays engaged with the one player and makes no second attack", () => {
    const fought = fightEnemy((layout: Layout) => tableFromLayout(SCENARIO, layout), "906208", "f0", {});
    const attacker = fought.during.pendingAttack?.enemyId ?? "";
    expect(fought.run.state.cards[attacker]?.zone).toBe("engaged");
    expect(fought.run.state.cards[fought.made.hero]?.damage).toBe(0);
    expect(start(fought.run.state).state.pendingAttack).toBeNull();
  });
});
