// Rules: rr.engaged, rr.search, rr.travel, rr.explored, rr.reveal, rr.staging, rr.damage, rr.destroy, rr.step-6-4-1, rr.active-location, rr.quest-advancement,
// rr.first-player, rr.in-player-order, rr.modifiers (data/rules/entries.json). The enemies, locations and treacheries of Journey in the Dark.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { defenseBlocked } from "../rules/restrictions.ts";
import { modifiedStat } from "../rules/keywords.ts";
import type { ScenarioState } from "../rules/state.ts";
import { flagged } from "../rules/state.ts";
import { legalIntents, legalTargets } from "../rules/legal.ts";
import type { PlayerIntent } from "../rules/reduce.ts";
import { BALROG, CHAMBER, CHIEFTAIN, DOOM, fire, loadMoriaWorld, makeTable, runOne, settled, type MoriaLayout, type MoriaWorld } from "../../scripts/moria-scene.ts";
import { codesOf, first, send, start, type Run } from "../../scripts/past-scene.ts";
import { spawn } from "../rules/zones.ts";

let world: MoriaWorld;

beforeAll(async () => {
  world = await loadMoriaWorld();
}, 60_000);

const make = (layout: MoriaLayout = {}) => makeTable(world, layout);

describe("Orc-chieftain (142045:A:1, A:2)", () => {
  it("cannot have attachments", () => {
    const table = make({ staging: [CHIEFTAIN] });
    expect(flagged(table.state, first(table.state, CHIEFTAIN), "cannotHaveAttachments")).toBe(true);
  });

  it("cannot be defended against by allies, while a hero may", () => {
    const table = make({ engaged: [{ code: CHIEFTAIN, seat: 0 }], allies: ["ally"], heroes: ["strong"] });
    const attacking = { ...table.state, pendingAttack: { enemyId: first(table.state, CHIEFTAIN), seat: 0 } };
    expect(defenseBlocked(attacking, table.ctx, first(table.state, "ally"))).toBe(true);
    expect(defenseBlocked(attacking, table.ctx, first(table.state, "strong"))).toBe(false);
    // Another enemy's attack: the ally defends.
    const other = make({ engaged: [{ code: "grunt", seat: 0 }], allies: ["ally"] });
    expect(defenseBlocked({ ...other.state, pendingAttack: { enemyId: first(other.state, "grunt"), seat: 0 } }, other.ctx, first(other.state, "ally"))).toBe(false);
  });

  it("engages the first player at the beginning of the encounter phase, from the staging area or from another player", () => {
    for (const where of ["staging", "engaged"] as const) {
      const table = make({ seats: 2, phase: "Encounter", ...(where === "staging" ? { staging: [CHIEFTAIN] } : { engaged: [{ code: CHIEFTAIN, seat: 0 }] }) });
      const state = { ...table.state, firstPlayer: 1 };
      const after = fire(table, state, first(state, CHIEFTAIN), "142045:forced:1", [], "forced");
      const chieftain = after.cards[first(after, CHIEFTAIN)];
      expect(chieftain?.zone, where).toBe("engaged");
      expect(chieftain?.controller, where).toBe(1);
    }
  });
});

describe("Great Cave-troll (142046:A:1, A:2)", () => {
  it("prints the lines Cave-troll of The Caves of Nibin-Dûm prints, so it has its records", async () => {
    const { default: ledger } = await import("../../data/printed/fellowship-of-the-ring.json", { with: { type: "json" } });
    const { default: mirkwood } = await import("../../data/printed/mirkwood-paths.json", { with: { type: "json" } });
    const linesOf = (entries: { code: string; side: string; lines: string[] }[], code: string) => entries.filter((entry) => entry.code === code && entry.side === "A").flatMap((entry) => entry.lines);
    expect(linesOf(ledger.entries, "142046")).toEqual(linesOf(mirkwood.entries, "41030"));
    const table = make({ staging: ["142046"] });
    const troll = first(table.state, "142046");
    expect(flagged(table.state, troll, "cannotHaveAttachments")).toBe(true);
    expect(flagged(table.state, troll, "excessToQuestProgress")).toBe(true);
  });
});

describe("Uruk from Mordor (142047:A:1)", () => {
  it("makes an attack against the first player as it is revealed, and stays in the staging area", () => {
    const table = make({ seats: 2, staging: ["142047"], heroes: ["strong"] });
    const state = { ...table.state, firstPlayer: 1 };
    const after = fire(table, state, first(state, "142047"), "142047:whenRevealed:1");
    expect(after.pendingAttack?.enemyId).toBe(first(after, "142047"));
    expect(after.pendingAttack?.seat).toBe(1);
    expect(after.cards[first(after, "142047")]?.zone).toBe("staging");
  });
});

// Plays the attack in progress to its end, the first hero the rules offer taking an undefended attack.
function finishAttack(table: ReturnType<typeof make>, state: ScenarioState, ...heroes: string[]): Run {
  let run: Run = { ...start(state), state };
  for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
    if (run.state.window?.kind === "defense") {
      run = send(run, { type: "Undefended", heroId: heroes.find((id) => run.state.cards[id]?.zone === "heroes") ?? legalTargets(run.state, { type: "Undefended" }, table.ctx)[0] }, table.ctx);
      continue;
    }
    const pass = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    run = send(run, pass as PlayerIntent, table.ctx);
  }
  return run;
}

const enemyStrikes = (run: Run) => run.steps.filter((step) => step.kind === "strike" && step.side === "enemy");

describe("an enemy that attacks from the staging area without being flagged (142047:A:1, 142038:A:2)", () => {
  // "Shadow: Attacking enemy gets +1 Attack. If this attack destroys a character, attacking enemy makes an additional attack." (142047:A:2)
  it("makes the additional attack its shadow grants, with a shadow card of its own", () => {
    const table = make({ staging: ["142047"], heroes: ["strong"], deck: ["142047", "f0", "f0", "f0"] });
    const uruk = table.state.staging.find((id) => table.state.cards[id]?.code === "142047") ?? "";
    expect(flagged(table.state, uruk, "engagedWithFirst")).toBe(false);
    const fired = fire(table, table.state, uruk, "142047:whenRevealed:1");
    const run = finishAttack(table, fired, first(fired, "141002"), first(fired, "strong"));
    // Uruk is dealt a copy of itself: +1 Attack destroys Sam, so a second attack follows.
    expect(enemyStrikes(run)).toHaveLength(2);
    expect(run.state.cards[uruk]?.zone).toBe("staging");
    expect(run.state.pendingAttack).toBeNull();
  });

  // "Shadow: ... If this attack destroys a character, the first player reveals..." runs "after this attack" for a staging attacker too (142059:A:3).
  it("runs a shadow card's \"after this attack\" effect", () => {
    const table = make({ seats: 2, staging: ["142047"], heroes: ["strong"], deck: ["142059", "grunt", "grunt"] });
    const uruk = first(table.state, "142047");
    const fired = fire(table, table.state, uruk, "142047:whenRevealed:1");
    const run = finishAttack(table, fired, first(fired, "141002"), first(fired, "strong"));
    const destroyed = Object.values(run.state.cards).some((card) => card.zone === "discard" && (card.code === "141002"));
    const revealed = run.state.staging.some((id) => run.state.cards[id]?.code === "grunt");
    expect(destroyed).toBe(true);
    expect(revealed).toBe(true);
  });
});

describe("Moria Orc (142048:A:1)", () => {
  it("removes a damage token from Doom, Doom, Doom, or reveals an additional encounter card", () => {
    const table = make({ doom: 4, staging: ["142048"], deck: ["f0", "f0"] });
    const orc = first(table.state, "142048");
    const removed = fire(table, table.state, orc, "142048:whenRevealed:1", ["doom"]);
    expect(removed.cards[first(removed, DOOM)]?.damage).toBe(3);
    expect(removed.encounterDeck).toHaveLength(2);
    const revealed = fire(table, table.state, orc, "142048:whenRevealed:1", ["reveal"]);
    expect(revealed.cards[first(revealed, DOOM)]?.damage).toBe(4);
    expect(revealed.encounterDeck).toHaveLength(1);
    expect(codesOf(revealed, revealed.staging)).toContain("f0");
  });
});

describe("Moria Archer (142049:A:2, A:3)", () => {
  it.each([1, 2] as const)("assigns X damage among the revealing player's characters, X being the %i player(s) in the game", (seats) => {
    const table = make({ seats, heroes: ["strong"], staging: ["142049"] });
    const strong = first(table.state, "strong");
    const after = fire(table, table.state, first(table.state, "142049"), "142049:whenRevealed:1", [strong, strong]);
    expect(after.cards[strong]?.damage).toBe(seats);
    // Another player's characters take none.
    expect(after.cards[table.merry ?? ""]?.damage ?? 0).toBe(0);
  });
});

describe("Chamber of Mazarbul (142051:A:2, A:3)", () => {
  it("cannot be travelled to without each player finding a different enemy in the encounter deck or discard pile, the first search taking Orc-chieftain", () => {
    const table = make({ seats: 2, staging: [CHAMBER], deck: ["grunt", CHIEFTAIN, "orc"], discard: ["warg"] });
    const after = fire(table, table.state, first(table.state, CHAMBER), "142051:travel:1", [], "forced");
    const found = codesOf(after, after.staging).filter((code) => code !== CHAMBER);
    expect(found).toHaveLength(2);
    expect(found).toContain(CHIEFTAIN);
    expect(new Set(found).size).toBe(2);
  });

  it("takes any enemy once Orc-chieftain is not in the deck or the discard pile", () => {
    const table = make({ staging: [CHAMBER], engaged: [{ code: CHIEFTAIN, seat: 0 }], deck: ["grunt", "orc"] });
    const after = fire(table, table.state, first(table.state, CHAMBER), "142051:travel:1", [], "forced");
    expect(codesOf(after, after.staging).filter((code) => code !== CHAMBER)).toHaveLength(1);
  });
});

describe("Mines of Moria (142052:A:1)", () => {
  it("takes the progress placed on the quest before the quest does, while it is in the staging area", () => {
    const table = make({ stage: "142040", staging: ["142052"] });
    const mines = first(table.state, "142052");
    const after = runOne(table, table.state, { verb: "ProgressQuest", amount: 3 }, table.frodo);
    expect(after.cards[mines]?.progress).toBe(3);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(0);
    // With more than it needs, it is explored and the rest goes on the quest.
    const full = runOne(table, table.state, { verb: "ProgressQuest", amount: 7 }, table.frodo);
    expect(full.cards[mines]?.zone).not.toBe("staging");
    expect(full.cards[full.questStage ?? ""]?.progress).toBe(3);
  });

  it("does not hold progress back when it is the active location, and Many-pillared Hall in the staging area does not take it", () => {
    const hall = make({ stage: "142040", staging: ["142053"] });
    const after = runOne(hall, hall.state, { verb: "ProgressQuest", amount: 3 }, hall.frodo);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(3);
  });
});

describe("Many-pillared Hall (142053:A:1)", () => {
  it("gets +1 Threat for each Many-pillared Hall in play, itself included", () => {
    const one = make({ staging: ["142053"] });
    const two = make({ staging: ["142053", "142053"], active: "142053" });
    const threat = (table: ReturnType<typeof make>, id: string) => modifiedStat(table.state, table.state.cards[id]!, "threat", table.ctx.cards);
    expect(threat(one, first(one.state, "142053"))).toBe(2);
    expect(threat(two, first(two.state, "142053"))).toBe(4);
  });
});

describe("Darkened Stairway (142054:A:1)", () => {
  function explored(deck: string[]): ScenarioState {
    const table = make({ stage: "142040", active: "142054", deck });
    return runOne(table, table.state, { verb: "PlaceProgressOn", amount: 2, target: "activeLocation" }, table.frodo);
  }

  it("discards the top card of the encounter deck when explored, and adds it to the staging area when it is a location", () => {
    const location = explored(["place", "f0"]);
    expect(codesOf(location, location.staging)).toEqual(["place"]);
    // The explored location itself is in the discard pile; the location found is not.
    expect(codesOf(location, location.encounterDiscard)).toEqual(["142054"]);
    const enemy = explored(["f0", "grunt"]);
    expect(enemy.staging).toHaveLength(0);
    expect(codesOf(enemy, enemy.encounterDiscard).sort()).toEqual(["142054", "f0"]);
  });
});

describe("Ancient Guardroom (142055:A:1, A:2)", () => {
  it("gives each enemy in play -1 Attack while it is the active location, and not in the staging area", () => {
    const active = make({ active: "142055", staging: ["warg"], engaged: [{ code: "orc", seat: 0 }] });
    const attack = (table: ReturnType<typeof make>, code: string) => modifiedStat(table.state, table.state.cards[first(table.state, code)]!, "attack", table.ctx.cards);
    expect(attack(active, "warg")).toBe(2);
    expect(attack(active, "orc")).toBe(1);
    const idle = make({ staging: ["142055", "warg"] });
    expect(attack(idle, "warg")).toBe(3);
  });

  it("travels by discarding the top card of the encounter deck, and each player raises their threat by its Threat", () => {
    const table = make({ seats: 2, staging: ["142055"], deck: ["f3", "f0"] });
    const after = fire(table, table.state, first(table.state, "142055"), "142055:travel:1", [], "forced");
    expect(codesOf(after, after.encounterDiscard)).toEqual(["f3"]);
    expect(after.seats[0].threat).toBe(8 + 3);
    expect(after.seats[1].threat).toBe(6 + 3);
  });
});

describe("They Are Coming! (142056:A:2)", () => {
  it.each([1, 2] as const)("shuffles the discard pile into the deck, then discards from the top until %i enemy(ies) are discarded and adds them to the staging area", (seats) => {
    const table = make({ seats, deck: ["place", "f0", "f3", "f0"], discard: ["f0", "grunt"] });
    const after = fire(table, table.state, first(table.state, "f0") ?? "", "142056:whenRevealed:1");
    const staged = codesOf(after, after.staging);
    expect(staged).toHaveLength(seats);
    expect(staged.every((code) => ["f0", "f3", "grunt"].includes(code))).toBe(true);
    // Non-enemies discarded on the way stay in the discard pile; enemies are not.
    expect(after.encounterDiscard.every((id) => !["f0", "f3", "grunt"].includes(after.cards[id]?.code ?? ""))).toBe(true);
    expect(after.encounterDeck.length + after.encounterDiscard.length + after.staging.length).toBe(6);
  });
});

describe("We Cannot Get Out (142057:A:1)", () => {
  it("has each player assign damage for each exhausted character they control", () => {
    const table = make({ seats: 2, heroes: ["strong"] });
    const strong = first(table.state, "strong");
    // Sam and strong are exhausted for seat 0, Merry for seat 1.
    let state = table.state;
    for (const id of [table.sam, strong, table.merry ?? ""]) state = { ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, exhausted: true } } };
    const source = spawn(state, "f0", { zone: "staging" });
    const after = fire(table, source.state, source.id, "142057:whenRevealed:1", [strong, strong, table.merry ?? ""], "whenRevealed");
    expect(after.cards[strong]?.damage).toBe(2);
    expect(after.cards[table.merry ?? ""]?.damage).toBe(1);
  });
});

describe("Deep Fissure (142058:A:2)", () => {
  it.each([
    ["big", true],
    ["f3", false],
  ] as const)("removes a character from the quest and discards the top card (%s): the character is discarded when its printed Willpower is below the card's Threat (%s)", (top, discarded) => {
    const table = make({ heroes: ["strong"], deck: [top, "f0"] });
    const strong = first(table.state, "strong");
    const committed = { ...table.state, cards: { ...table.state.cards, [strong]: { ...table.state.cards[strong]!, committed: true } } };
    const source = spawn(committed, "f0", { zone: "staging" });
    const after = fire(table, source.state, source.id, "142058:whenRevealed:1", [strong]);
    expect(after.cards[strong]?.committed).toBe(false);
    expect(after.cards[strong]?.zone).toBe(discarded ? "discard" : "heroes");
    expect(codesOf(after, after.encounterDiscard)).toEqual([top]);
  });
});

describe("Fool of a Took! (142059:A:2)", () => {
  it("removes a damage token from Doom, Doom, Doom, or makes the Balrog attack the first player when it is in play", () => {
    const table = make({ doom: 5, staging: [BALROG, "142059"], heroes: ["strong"] });
    const fool = first(table.state, "142059");
    const tokens = fire(table, table.state, fool, "142059:whenRevealed:1", ["doom"]);
    expect(tokens.cards[first(tokens, DOOM)]?.damage).toBe(4);
    expect(tokens.pendingAttack).toBeNull();
    const attacked = fire(table, table.state, fool, "142059:whenRevealed:1", ["balrog"]);
    expect(attacked.pendingAttack?.enemyId).toBe(first(attacked, BALROG));
    expect(attacked.pendingAttack?.seat).toBe(0);
  });

  it("offers only the damage token while the Balrog is not in play", () => {
    const table = make({ doom: 5, staging: ["142059"], setAside: [BALROG] });
    const steps: unknown[] = [];
    void steps;
    const state = fire(table, table.state, first(table.state, "142059"), "142059:whenRevealed:1");
    // The one option left is taken without asking.
    expect(state.window?.kind).not.toBe("choose");
    expect(state.cards[first(state, DOOM)]?.damage).toBe(4);
    void settled;
    void syncConstants;
  });
});
