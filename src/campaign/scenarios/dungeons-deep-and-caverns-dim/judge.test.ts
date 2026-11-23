// Rules: hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3, rr.cannot, rr.cancel, rr.encounter-deck (data/rules/entries.json); ledger lines 131030:A:1, 131030:B:3, 131081:A:1, 131083:A:1, 131084:A:1. The clauses of the riddle cards that a record, a flag or an engine hook holds without a line of its own: the search, Bilbo Baggins in the riddle area, "another" riddle, "cannot be canceled" with no zone.
import { describe, expect } from "vitest";

import { holds } from "../../../rules/interpret/conditions.ts";
import { legalIntents } from "../../../rules/engine/reduce.ts";
import { beginEnemyAttack } from "../../../rules/combat/combat.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { flaggedByClass } from "../../../rules/core/holder-classes.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { expireModifiers, updateCard } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { inDiscard, progressOf, revealAnswering, riddleTable, stacked } from "../../../rules/families/riddles/fixture.ts";
import { HERO, HERO2, idOf, idsOf, legalTargets, send, statOf, resolveRecords, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const engagedF0 = (state: Parameters<typeof idOf>[0]): string => idsOf(state, "f0").find((id) => state.cards[id]?.zone === "engaged") ?? "";
const zoneOf = (state: Parameters<typeof idOf>[0], code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

describe("131030:A:1 Riddles in the Dark, the search", () => {
  lineSpec("131030:A:1", "searches the encounter deck only: Gollum and the Ring in the discard pile are not found, those in the deck are", (effects) => {
    const found = riddleTable({}, effects);
    expect(zoneOf(found.state, "131074")).toBe("riddleArea");
    expect(found.state.cards[idOf(found.state, "131079")]?.host).toBe(found.bilbo);
    const discarded = riddleTable({ deck: ["f0", "f0"], discard: ["131074", "131079"] }, effects);
    expect(zoneOf(discarded.state, "131074")).toBe("encounterDiscard");
    expect(discarded.state.cards[idOf(discarded.state, "131079")]?.host ?? null).toBeNull();
    expect(zoneOf(discarded.state, "131079")).toBe("encounterDiscard");
  });
});

describe("131030:B:3 Bilbo Baggins in the riddle area", () => {
  lineSpec("131030:B:3", "Bilbo Baggins takes damage only from Gollum: no other card's effect or attack hurts him, another hero is hurt as usual", (effects) => {
    const made = riddleTable({ engaged: [{ code: "f0", seat: 0 }] }, effects);
    const hurt = (id: string, source: "framework" | "combat", sourceCode: string) => placeDamage(made.state, id, 2, made.ctx.cards, [], source, ruleCause("rr.damage"), sourceCode === "f0" ? engagedF0(made.state) : idOf(made.state, sourceCode)).cards[id]?.damage;
    expect(hurt(made.bilbo, "framework", "f0")).toBe(0);
    expect(hurt(made.bilbo, "combat", "f0")).toBe(0);
    expect(hurt(made.bilbo, "framework", "131074")).toBe(2);
    expect(hurt(made.hero, "framework", "f0")).toBe(2);
  });

  lineSpec("131030:B:3", "Bilbo Baggins cannot defend against another enemy, and can defend against Gollum", (effects) => {
    const made = riddleTable({ engaged: [{ code: "f0", seat: 0 }] }, effects);
    const steps: EngineStep[] = [];
    const other = beginEnemyAttack(made.state, 0, engagedF0(made.state), made.ctx, steps);
    expect(other.pendingAttack).not.toBeNull();
    const targets = legalTargets({ ...other, window: other.window ?? { kind: "defense", seat: 0 } } as typeof other, { type: "DeclareDefender" }, made.ctx);
    expect(targets).toContain(made.hero);
    expect(targets).not.toContain(made.bilbo);
    const gollum = beginEnemyAttack(made.state, 0, idOf(made.state, "131074"), made.ctx, steps, { fromStaging: true, shadow: false });
    expect(legalTargets({ ...gollum, window: gollum.window ?? { kind: "defense", seat: 0 } } as typeof gollum, { type: "DeclareDefender" }, made.ctx)).toContain(made.bilbo);
  });
});

describe("131081:A:1 It Likes Riddles?, another card with a riddle", () => {
  // The first riddle names cost 2 and discards 2: the 2 top cards cost 0, and only the one the Ring discards matches; with that 1 match the encounter cards are discarded until another riddle card, which is answered.
  lineSpec("131081:A:1", "counts the match the Ring's extra discard finds, then discards until another riddle card and answers it", (effects) => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "131076", "f0"], deckOf: ["01021", "01021", "01013", "01013", "01013"] }, effects);
    const resourced = updateCard(stacked(made.state, ["f0", "131076"]), made.bilbo, { resources: 1 });
    const run = revealAnswering(resourced, made.ctx, "131081", ["2", "ring", "ally"]);
    expect(run.state.cards[made.bilbo]?.resources).toBe(0);
    expect(zoneOf(run.state, "131076")).toBe("encounterDiscard");
    expect(progressOf(run.state)).toBeGreaterThanOrEqual(1);
  });

  lineSpec("131081:A:1", "never answers the card itself as the other riddle: with no other riddle card, the discard pile shuffled back leaves it alone", (effects) => {
    const made = riddleTable({ deck: ["131074", "131079", "f0", "f0", "f0"], deckOf: ["01013", "01013", "01013"] }, effects);
    const run = revealAnswering(stacked(made.state, ["f0", "f0", "f0"]), made.ctx, "131081", ["2"]);
    expect(inDiscard(run.state, "01013")).toBe(2);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toEqual(["131081"]);
  });
});

// Iârion's Pendant (10157:A:2) cancels the When Revealed effects of a card just revealed. A riddle card answered is never in the staging area, so "this effect cannot be canceled" must hold with no zone condition.
describe("131083:A:1 and 131084:A:1 cannot be canceled in any zone", () => {
  const PENDANT = "10157";
  const table = (effects?: Parameters<typeof riddleTable>[1]) => {
    const made = tableFromLayout("dungeons-deep-and-caverns-dim", { stages: ["131029", "131030", "131031"], stage: "131029", deck: ["131074", "131079", "f0", "f0"], staging: ["131078"], attached: [{ code: PENDANT, to: HERO }], hand: ["filler"], committed: [HERO] }, { extra: ["131001", "09043", PENDANT], ...(effects ? { effects } : {}) });
    const bilbo = spawn(made.state, "131001", { zone: "heroes", seat: 0 });
    const setup = resolveRecords(bilbo.state, made.ctx, "131029", "setup", idOf(bilbo.state, "131029"));
    return { ...made, state: settle({ ...setup.state, window: null, mode: "stopped" }, made.ctx, []) };
  };
  const offered = (state: ReturnType<typeof table>["state"], ctx: ReturnType<typeof table>["ctx"]): boolean => legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, PENDANT));

  // The bar is read where the card is not in the staging area (an answered riddle card goes to the encounter discard pile, hob.riddles): it holds in every zone.
  const holdsOutsideStaging = (code: string, effectId: string, effects: Parameters<typeof riddleTable>[1]): boolean => {
    const made = table(effects);
    const record = made.ctx.effects.find((effect) => effect.id === effectId);
    const spawned = spawn(made.state, code, { zone: "encounterDiscard" });
    return record?.uncancelable != null && holds(spawned.state, record.uncancelable, { actor: 0, sourceId: spawned.id, returned: 0 }, made.ctx);
  };

  lineSpec("131083:A:1", "the effect cannot be canceled when the card is not in the staging area", (effects) => {
    expect(holdsOutsideStaging("131083", "131083:whenRevealed:1", effects)).toBe(true);
  });

  lineSpec("131084:A:1", "the effect cannot be canceled when the card is not in the staging area", (effects) => {
    expect(holdsOutsideStaging("131084", "131084:whenRevealed:1", effects)).toBe(true);
  });

  lineSpec("131083:A:1", "no card cancels the effect that makes the first player answer: the Pendant is offered for another card and not for this one", (effects) => {
    const made = table(effects);
    expect(offered(revealFromTop(made.state, made.ctx, "09043", []).state, made.ctx)).toBe(true);
    const revealed = revealFromTop(made.state, made.ctx, "131083", []).state;
    expect(offered(revealed, made.ctx)).toBe(false);
    expect(revealed.window).toMatchObject({ kind: "choose", options: ["leadership", "spirit", "lore", "tactics", "baggins"] });
  });

  lineSpec("131084:A:1", "no card cancels the effect: the Pendant is offered for another card and not for this one", (effects) => {
    const made = table(effects);
    expect(offered(revealFromTop(made.state, made.ctx, "09043", []).state, made.ctx)).toBe(true);
    const revealed = revealFromTop(made.state, made.ctx, "131084", []).state;
    expect(offered(revealed, made.ctx)).toBe(false);
    expect(revealed.window).toMatchObject({ kind: "choose", options: ["enemy", "location", "treachery", "objective"] });
  });
});

describe("131082:A:1 Hiding in the Trees, the end of the round", () => {
  // "Characters get -1 Willpower and cannot attack until the end of the round": every character of both seats while the round lasts, none again in the next round (a second round starts clean).
  lineSpec("131082:A:1", "gives each character -1 Willpower and bars attacks until the end of the round, and the bonus is gone again at the end of the round", (effects) => {
    const made = riddleTable({ seats: 2 }, effects);
    const heroes = [HERO, HERO2].map((code) => idOf(made.state, code));
    const run = revealAnswering(made.state, made.ctx, "131082", ["resolve"]);
    for (const [index, code] of [HERO, HERO2].entries()) {
      expect(statOf(run.state, made.ctx.cards, code, "willpower"), `${code} in the round`).toBe(statOf(made.state, made.ctx.cards, code, "willpower") - 1);
      expect(flaggedByClass(run.state, run.state.cards[heroes[index] ?? ""]!, printedOf(made.ctx.cards, code), "cannotAttack"), `${code} cannot attack`).toBe(true);
    }
    const next = expireModifiers(run.state, ["endOfRound"]);
    for (const [index, code] of [HERO, HERO2].entries()) {
      expect(statOf(next, made.ctx.cards, code, "willpower"), `${code} at the end of the round`).toBe(statOf(made.state, made.ctx.cards, code, "willpower"));
      expect(flaggedByClass(next, next.cards[heroes[index] ?? ""]!, printedOf(made.ctx.cards, code), "cannotAttack"), `${code} can attack again`).toBe(false);
    }
  });
});

describe("131079:A:2 and A:3 Bilbo's Magic Ring, the false cases", () => {
  const named = (made: ReturnType<typeof riddleTable>, resources: number) => {
    const state = updateCard(made.state, made.bilbo, { resources });
    const revealed = { state: revealFromTop(state, made.ctx, "131076", []).state, steps: [] as EngineStep[] };
    return send(send(revealed, { type: "Choose", optionId: "answer" }, made.ctx), { type: "Choose", optionId: "ally" }, made.ctx);
  };

  lineSpec("131079:A:2", "is offered to the answering first player only while Bilbo holds a Baggins resource to spend", (effects) => {
    const made = riddleTable({ deckOf: ["01013", "01013", "01013"] }, effects);
    expect(named(made, 1).state.window).toMatchObject({ kind: "choose", options: ["ring", "stop"] });
    expect(named(made, 0).state.window?.kind === "choose" ? named(made, 0).state.window : null).toBeNull();
  });

  lineSpec("131079:A:3", "is offered while the Ring is ready and not once it is exhausted, with one player or two", (effects) => {
    const offered = (seats: 1 | 2, exhausted: boolean): boolean => {
      const made = riddleTable({ seats }, effects);
      const state = updateCard({ ...made.state, window: { kind: "frameAction" }, passed: [], activeSeat: 0 }, idOf(made.state, "131079"), { exhausted });
      return legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "131079:action:2");
    };
    for (const seats of [1, 2] as const) {
      expect(offered(seats, false), `${seats} seats ready`).toBe(true);
      expect(offered(seats, true), `${seats} seats exhausted`).toBe(false);
    }
  });
});
