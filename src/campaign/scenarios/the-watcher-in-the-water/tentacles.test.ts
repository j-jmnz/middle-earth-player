// Rules: rr.attachment-cards, rr.shadow-effects, rr.destroy, rr.engaged, rr.damage, rr.cancel, rr.first-player, rr.encounter-deck (data/rules/entries.json); ledger lines 04072:A:2, 04073:A:1, 04074:A:1, 04075:A:1, 901501:A:3, 901503:A:1, 901504:A:1.
// The Tentacle enemies of The Watcher in the Water, each on a table of the scene kit: the discard check of Grasping, Thrashing and Striking Tentacle, the Tentacle attachments (an attached enemy is no enemy and is discarded with its host), Writhing and Choking Tentacle, and the Nightmare
// setup card's damage to The Watcher when a Tentacle enemy is destroyed.
import { describe, expect, it } from "vitest";

import { destroyCard, modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { doRefresh } from "../../../rules/engine/refresh.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { finish, fightEnemy, idOf, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-watcher-in-the-water";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);

/** The combat phase until the defense window opens for the enemy engaged with the first seat (the deck: `deck`, the first card its shadow). */
function toDefense(enemy: string, deck: readonly string[], layout: Layout = {}) {
  const made = table({ phase: "Encounter", engaged: [{ code: enemy, seat: 0 }], deck, ...layout });
  let run: Run = send(start(syncConstants(made.state, made.ctx)), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 60 && run.state.window?.kind !== "defense"; guard += 1) {
    if (run.state.window?.kind === "choose") {
      run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
      continue;
    }
    if (run.state.window?.kind === "look") {
      run = send(run, { type: "Pass" }, made.ctx);
      continue;
    }
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, made.ctx);
  }
  return { made, run };
}

describe("04075:A:1 Striking Tentacle", () => {
  it("04075:A:1 an attack is considered undefended when the discarded card has a shadow effect", () => {
    const { run } = toDefense("04075", ["f0", "04066", "f0", "f0"]);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.undefended).toBe(true);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toContain("04066");
  });

  it("04075:A:1 an attack is considered undefended when the discarded card is a Tentacle enemy", () => {
    const { run } = toDefense("04075", ["f0", "04073", "f0", "f0"]);
    expect(run.state.pendingAttack?.undefended).toBe(true);
  });

  it("04075:A:1 the attack is defended as usual when the discarded card is neither", () => {
    const { run } = toDefense("04075", ["f0", "f0", "f0", "f0"]);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.pendingAttack?.undefended ?? false).toBe(false);
  });
});

/** The first hero attacks the enemy engaged with him, the deck above holding the cards the Tentacle's Forced effect discards. */
function attackIt(enemy: string, deck: readonly string[], layout: Layout = {}) {
  const made = table({ phase: "PlayerAttacks", engaged: [{ code: enemy }], deck, ...layout });
  const state = syncConstants(made.state, made.ctx);
  const target = Object.values(state.cards).find((card) => card.code === enemy && card.zone === "engaged")?.id ?? "";
  const run = finish(send(start(state), { type: "DeclareAttackers", enemyId: target, attackerIds: [made.hero] }, made.ctx), made.ctx);
  return { made, run, enemy: target };
}

describe("04073:A:1 Grasping Tentacle", () => {
  it("04073:A:1 attaches to the attacking character on a match, the attack deals it no damage and the character's Attack and Defense are 0", () => {
    const { made, run, enemy } = attackIt("04073", ["04066", "f0", "f0"]);
    const card = run.state.cards[enemy];
    expect(card?.zone).toBe("attached");
    expect(card?.host).toBe(made.hero);
    expect(card?.asAttachment).toBe("discard");
    expect(card?.damage).toBe(0);
    expect(modifiedStat(run.state, run.state.cards[made.hero]!, "attack", made.cards)).toBe(0);
    expect(modifiedStat(run.state, run.state.cards[made.hero]!, "defense", made.cards)).toBe(0);
    expect(run.state.cards[made.hero]?.exhausted).toBe(true);
  });

  it("04072:A:2 the Watcher may be optionally engaged again once the Tentacle engaged with a player lies as an attachment (04073:A:1)", () => {
    const { made, run, enemy } = attackIt("04073", ["04066", "f0", "f0"], { staging: ["04072"] });
    const watcher = idOf(run.state, "04072");
    expect(run.state.cards[enemy]?.zone).toBe("attached");
    expect(flagged(syncConstants(run.state, made.ctx), watcher, "cannotBeOptionallyEngaged")).toBe(false);
    // Before the attach, with the Tentacle engaged, it cannot.
    const before = table({ phase: "Encounter", engaged: [{ code: "04073" }], staging: ["04072"] });
    expect(flagged(syncConstants(before.state, before.ctx), idOf(before.state, "04072"), "cannotBeOptionallyEngaged")).toBe(true);
  });

  it("04073:A:1 is discarded to the encounter discard pile when its host leaves play", () => {
    const { made, run, enemy } = attackIt("04073", ["04066", "f0", "f0"]);
    const gone = destroyCard(run.state, made.hero, made.cards, []);
    expect(gone.cards[enemy]?.zone).toBe("encounterDiscard");
    expect(gone.cards[enemy]?.asAttachment).toBeUndefined();
  });

  it("04073:A:1 does nothing when the discarded card has no shadow effect and is no Tentacle enemy: the attack goes on", () => {
    const { run, enemy } = attackIt("04073", ["f0", "f0", "f0"]);
    expect(run.state.cards[enemy]?.zone).toBe("engaged");
    expect(run.state.cards[enemy]?.damage).toBeGreaterThan(0);
  });
});

describe("04074:A:1 Thrashing Tentacle", () => {
  it("04074:A:1 deals the damage of the attack to a character an attacking player controls, ignoring defense, and takes none itself", () => {
    const { made, run, enemy } = attackIt("04074", ["04066", "f0", "f0"]);
    expect(run.state.cards[enemy]?.damage).toBe(0);
    expect(run.state.cards[enemy]?.zone).toBe("engaged");
    const heroes = made.state.seats[0]?.heroes ?? [];
    const hit = heroes.filter((id) => (run.state.cards[id]?.damage ?? 0) > 0);
    expect(hit).toHaveLength(1);
    expect(run.state.cards[hit[0] ?? ""]?.damage).toBe(2);
  });

  it("04074:A:1 takes the damage of the attack as usual with no match", () => {
    const { run, enemy } = attackIt("04074", ["f0", "f0", "f0"]);
    expect(run.state.cards[enemy]?.damage).toBe(2);
  });
});

/** Plays an attack out: the first hero defends, choices take their first option and look windows close. */
function driveAttack(run: Run, ctx: ReturnType<typeof table>["ctx"], defender: string): Run {
  let current = run;
  for (let guard = 0; guard < 40; guard += 1) {
    const window = current.state.window;
    if (window?.kind === "defense") current = send(current, { type: "DeclareDefender", defenderId: defender }, ctx);
    else if (window?.kind === "choose") current = send(current, { type: "Choose", optionId: window.options[0] ?? "" }, ctx);
    else if (window?.kind === "look") current = send(current, { type: "Pass" }, ctx);
    else if (current.state.pendingAttack != null) {
      const pass = legalIntents(current.state, ctx).find((intent) => intent.type === "Pass");
      if (!pass) break;
      current = send(current, pass as PlayerIntent, ctx);
    } else break;
  }
  return current;
}

describe("901503:A:1 Writhing Tentacle", () => {
  const engage = (deck: readonly string[], layout: Layout = {}) => {
    const made = table({ phase: "Encounter", staging: ["901503"], deck, threat: [60, 20], ...layout });
    const state = syncConstants(made.state, made.ctx);
    const enemy = idOf(state, "901503");
    const engaged = send(start(state), { type: "Engage", enemyId: enemy }, made.ctx);
    return { made, enemy, run: driveAttack(engaged, made.ctx, made.hero) };
  };

  it("901503:A:1 attacks at once when it engages a player and attaches to the defending character after the attack, which then cannot commit to the quest", () => {
    const { made, enemy, run } = engage(["04066", "f0", "f0", "f0"]);
    const card = run.state.cards[enemy];
    expect(card?.zone).toBe("attached");
    expect(card?.host).toBe(made.hero);
    expect(card?.asAttachment).toBe("discard");
    expect(flagged(syncConstants(run.state, made.ctx), made.hero, "cannotQuest")).toBe(true);
  });

  it("901503:A:1 stays engaged as an enemy when the discarded card is no match", () => {
    const { enemy, run } = engage(["f0", "f0", "f0", "f0"]);
    expect(run.state.cards[enemy]?.zone).toBe("engaged");
  });
});

describe("901504:A:1 Choking Tentacle", () => {
  it("901504:A:1 attaches after its attack to a character the defending player controls, and the character takes 1 damage each time it readies", () => {
    const fought = fightEnemy(table, "f0", "901504", { deck: ["f0", "04066", "f0", "f0"] });
    const state = fought.run.state;
    const enemy = idOf(state, "901504");
    const card = state.cards[enemy];
    expect(card?.zone).toBe("attached");
    expect(card?.asAttachment).toBe("discard");
    const host = card?.host ?? "";
    expect(fought.made.state.seats[0]?.heroes).toContain(host);
    // Each time the attached character readies it takes 1 damage.
    const steps: EngineStep[] = [];
    const tired = updateCard(state, host, { exhausted: true, damage: 0 });
    const refreshed = settle(doRefresh({ ...tired, phase: "Refresh", window: null, pendingAttack: null }, fought.ctx, steps), fought.ctx, steps);
    expect(refreshed.cards[host]?.exhausted).toBe(false);
    expect(refreshed.cards[host]?.damage).toBe(1);
  });

  it("901504:A:1 two-handed, it attaches to a character of the defending player (seat 1), not of the first player who chooses", () => {
    const made = table({ seats: 2, engaged: [{ code: "901504", seat: 1 }], deck: ["04066", "f0", "f0"] });
    const enemy = idOf(made.state, "901504");
    const run = resolveRecords(made.state, made.ctx, "901504", "forced", enemy);
    expect(run.state.cards[enemy]?.zone).toBe("attached");
    expect(made.state.seats[1]?.heroes).toContain(run.state.cards[enemy]?.host ?? "");
  });

  it("901504:A:1 stays an enemy when the discarded card is no match", () => {
    const fought = fightEnemy(table, "f0", "901504", { deck: ["f0", "f0", "f0", "f0"] });
    expect(fought.run.state.cards[idOf(fought.run.state, "901504")]?.zone).toBe("engaged");
  });
});

describe("901501:A:3 a Tentacle enemy destroyed damages The Watcher", () => {
  it("901501:A:3 a Tentacle enemy destroyed deals 1 damage to The Watcher in play", () => {
    const { run } = attackIt("04075", ["f0", "f0", "f0"], { nightmare: "901501", staging: ["901502"], engaged: [{ code: "04075", damage: 2 }] });
    expect(run.state.cards[idOf(run.state, "04075")]?.zone).not.toBe("engaged");
    expect(run.state.cards[idOf(run.state, "901502")]?.damage).toBe(1);
  });

});
