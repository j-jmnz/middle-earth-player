// Rules: emce.immune, emce.indestructible (data/rules/entries.json). The two keywords the Ered Mithrin cards print, read against the engine's: "Immune to player card effects" (on enemies, locations and objectives: the card ignores the effects of
// player cards and cannot be chosen as a target of one; an encounter card's effects still reach it) and Indestructible (an enemy with damage equal to its hit points is not destroyed). Both exist (core/keyword-flags.ts); these tests pin them for the
// card types Ered Mithrin prints them on.
import { describe, expect, it } from "vitest";

import { ruleCause } from "../../core/cause.ts";
import { placeDamage, playerCardEffectCanChoose } from "../../core/keywords.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { reduce } from "../../engine/reduce.ts";
import { expectOk } from "../../core/test-fixture.ts";
import { spawn } from "../../core/zones.ts";
import type { ScenarioState } from "../../core/state.ts";
import { ctxOf, table } from "./fixture.ts";

const ctx = ctxOf([]);
// The state with a flag held by the card for the round ("immuneToPlayerCards", "losesKeywords").
const flag = (state: ScenarioState, id: string, stat: "immuneToPlayerCards" | "losesKeywords"): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat, amount: 1, until: "endOfRound" }] });
const hit = (state: ScenarioState, id: string, source: "player" | "framework") => placeDamage(state, id, 3, ctx.cards, [], source, ruleCause("rr.damage"));

describe("Immune to player card effects (emce.immune)", () => {
  it("cannot be chosen by a player card's effect, whatever the card is: an enemy, a location or an objective", () => {
    let state = table();
    const ford = spawn(state, "oldford", { zone: "staging" });
    const urdug = spawn(ford.state, "urdug", { zone: "engaged", seat: 0 });
    const hoard = spawn(urdug.state, "hoard", { zone: "staging" });
    const plain = spawn(hoard.state, "plain", { zone: "staging" });
    state = plain.state;
    const spell = spawn(state, "blessing", { zone: "hand", seat: 0 });
    const chosen = (type: "location" | "enemy" | "objective", sourceId: string | null) => pickCandidates(spell.state, { type, control: "any" }, 0, [], sourceId, ctx);
    // An event in hand is a player card: only the cards that are not immune can be chosen.
    expect(chosen("location", spell.id)).toEqual([plain.id]);
    expect(chosen("enemy", spell.id)).toEqual([]);
    expect(chosen("objective", spell.id)).toEqual([]);
    // An encounter card's effect (no source here, or a location as the source) may choose them.
    expect(chosen("location", ford.id).sort()).toEqual([ford.id, plain.id].sort());
    expect(chosen("enemy", ford.id)).toEqual([urdug.id]);
    expect(chosen("objective", ford.id)).toEqual([hoard.id]);
  });

  it("ignores the damage of a player card but takes the damage of the game", () => {
    const urdug = spawn(table(), "urdug", { zone: "engaged", seat: 0 });
    expect(hit(urdug.state, urdug.id, "player").cards[urdug.id]?.damage).toBe(0);
    expect(hit(urdug.state, urdug.id, "framework").cards[urdug.id]?.damage).toBe(3);
  });

  it("is gained by a card an effect makes immune (\"Attached enemy or location is immune to player card effects\", 19012:A:2; \"all encounter cards are immune ... until the end of the phase\", 12172:A:1)", () => {
    const made = spawn(table(), "orc", { zone: "engaged", seat: 0 });
    expect(playerCardEffectCanChoose(ctx.cards.get("orc")!, made.state, made.id)).toBe(true);
    const flagged = flag(made.state, made.id, "immuneToPlayerCards");
    expect(playerCardEffectCanChoose(ctx.cards.get("orc")!, flagged, made.id)).toBe(false);
    expect(hit(flagged, made.id, "player").cards[made.id]?.damage).toBe(0);
  });

  it("is printed on a location as well: it cannot be chosen by a player card, and can by the game", () => {
    const ford = spawn(table(), "oldford", { zone: "staging" });
    const plain = spawn(ford.state, "plain", { zone: "staging" });
    const state = plain.state;
    expect(playerCardEffectCanChoose(ctx.cards.get("oldford")!, state, ford.id)).toBe(false);
    expect(playerCardEffectCanChoose(ctx.cards.get("plain")!, state, plain.id)).toBe(true);
    // The game's own effect (a location as its source) may still choose it.
    expect(pickCandidates(state, { type: "location", control: "any" }, 0, [], plain.id, ctx)).toContain(ford.id);
  });
});

describe("Indestructible (emce.indestructible)", () => {
  it("keeps its damage but is not destroyed by it, even with damage equal to its hit points", () => {
    const urdug = spawn(table(), "urdug", { zone: "engaged", seat: 0 });
    const hurt = hit(hit(urdug.state, urdug.id, "framework"), urdug.id, "framework");
    expect(hurt.cards[urdug.id]).toMatchObject({ damage: 6, zone: "engaged" });
    // The sweep that destroys cards with damage at their hit points leaves it too.
    const swept = expectOk(reduce({ ...hurt, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [] }, { type: "Pass" }, ctx)).state;
    expect(swept.cards[urdug.id]?.zone).not.toBe("encounterDiscard");
  });

  it("is only an enemy's keyword: an objective or a location that prints it is destroyed by its damage as any other card", () => {
    const relic = spawn(table(), "relic", { zone: "staging" });
    expect(hit(relic.state, relic.id, "framework").cards[relic.id]?.zone).toBe("encounterDiscard");
    const pit = spawn(table(), "pit", { zone: "staging" });
    expect(hit(pit.state, pit.id, "framework").cards[pit.id]?.zone).toBe("encounterDiscard");
  });

  it("is lost with the enemy's keywords when a card takes them away (losesKeywords)", () => {
    const urdug = spawn(table(), "urdug", { zone: "engaged", seat: 0 });
    const stripped = flag(urdug.state, urdug.id, "losesKeywords");
    expect(hit(hit(stripped, urdug.id, "framework"), urdug.id, "framework").cards[urdug.id]?.zone).toBe("encounterDiscard");
  });
});
