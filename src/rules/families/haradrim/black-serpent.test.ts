// Rules: hrd.guarded-x, hrd.guarded-x-example, rr.guarded, rr.objective-cards, rr.engaged, rr.reveal (data/rules/entries.json); ledger lines 17091:A:1, 17091:A:2, 17092:A:2, 17106:A:1, 17106:B:1, 17106:B:2, 17107:B:2, 17108:A:1, 17108:B:2. The new pieces of The Black Serpent:
// the objectives that hang on or are guarded by an encounter card, the random reveal of a set-aside objective, the claim sweep, the Serpent engaged with the players who hold an objective.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { settle } from "../../engine/machine.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { matchesPick, pickCandidates } from "../../interpret/pick.ts";
import { claimedBy, finish, first, idOf, opened, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { canAttack } from "../../combat/combat.ts";
import { rejectionReason } from "../../engine/legal.ts";
import { optionalEnemies } from "../../quest/quest.ts";
import { consideredEngagedSeats } from "../../core/engaged.ts";
import { stagingAttackers } from "../south/watcher.ts";
import { guardWith } from "../objectives/guard.ts";

const BANNER = "17091";
const GARB = "17092";
const SUMMONS = "17093";
const SERPENT = "17094";
const ARCHER = "16043";

const table = (layout: Layout = {}) => tableFromLayout("the-black-serpent", { seats: 1, stage: "17106", ...layout });

/** The objective lies attached to the hero, claimed, as ClaimObjective leaves it. */
const claimed = (state: ScenarioState, code: string, heroId: string): ScenarioState => claimedBy(state, idOf(state, code), heroId);

describe("17091:A:1 Guarded (enemy or location): the first card of a listed type discarded from the encounter deck guards the objective", () => {
  it("discards the treachery, adds the enemy to the staging area and attaches it as the guard", () => {
    const made = table({ staging: [BANNER], deck: ["17103", ARCHER, "16042"], discard: [] });
    const run = resolveRecords(made.state, made.ctx, BANNER, "whenRevealed", idOf(made.state, BANNER));
    const [guard] = run.state.cards[run.id]?.attachments ?? [];
    expect(run.state.cards[guard ?? ""]).toMatchObject({ code: ARCHER, zone: "staging", host: run.id, guard: true });
    expect(run.state.cards[first(run.state, "17103")]?.zone).toBe("encounterDiscard");
  });
});

describe("The objectives family's filters for an objective attached to an encounter card", () => {
  const guarded = () => {
    const made = table({ staging: [BANNER, ARCHER, GARB, SUMMONS] });
    const state = guardWith(made.state, idOf(made.state, ARCHER), idOf(made.state, BANNER));
    return { made, state };
  };

  it("onEncounter holds for an objective an encounter card guards and not for a free one", () => {
    const { made, state } = guarded();
    const guardedObjective = idOf(state, BANNER);
    const free = idOf(state, GARB);
    expect(matchesPick(state, guardedObjective, { type: "objective", control: "any", onEncounter: true }, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
    expect(matchesPick(state, free, { type: "objective", control: "any", onEncounter: true }, { seat: 0, sourceId: null }, made.ctx)).toBe(false);
    expect(matchesPick(state, free, { type: "objective", control: "any", onEncounter: false }, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
  });

  it("onEncounter lists an objective hanging on the Serpent as a candidate, and not a claimed one", () => {
    const made = table({ staging: [SERPENT, SUMMONS], setAside: [BANNER, GARB] });
    const serpent = idOf(made.state, SERPENT);
    const hung = updateCard(attachTo(moveCard(made.state, idOf(made.state, SUMMONS), { zone: "attached" }), idOf(made.state, SUMMONS), serpent), idOf(made.state, SUMMONS), { face: "up", controller: null });
    const held = claimed(hung, BANNER, made.hero);
    const spec = { type: "objective", control: "any", trait: "Harad", onEncounter: true } as const;
    expect(pickCandidates(held, spec, 0, [], null, made.ctx)).toEqual([idOf(held, SUMMONS)]);
  });

  it("linkedToSource holds for the guard of the source objective, and for the card the source hangs on", () => {
    const { made, state } = guarded();
    const spec = { type: "enemy", control: "any", staging: true, linkedToSource: true } as const;
    expect(matchesPick(state, idOf(state, ARCHER), spec, { seat: 0, sourceId: idOf(state, BANNER) }, made.ctx)).toBe(true);
    expect(matchesPick(state, idOf(state, ARCHER), spec, { seat: 0, sourceId: idOf(state, GARB) }, made.ctx)).toBe(false);
  });

  it("holdsObjective holds for a hero with a claimed objective attached", () => {
    const made = table({ staging: [BANNER] });
    const state = claimed(made.state, BANNER, made.hero);
    const spec = { type: "hero", control: "any", holdsObjective: true } as const;
    expect(pickCandidates(state, spec, 0, [], null, made.ctx)).toEqual([made.hero]);
    expect(pickCandidates(made.state, spec, 0, [], null, made.ctx)).toEqual([]);
  });
});

describe("17106:A:1 RevealRandomSetAside: the first player reveals a random set aside Harad objective", () => {
  it("reveals one of the three, adds it to the staging area and resolves its Guarded (X)", () => {
    const made = table({ side: "A", setAside: [BANNER, GARB, SUMMONS], staging: [SERPENT], deck: ["16043", "16042", "17103", "17099", "16041"] });
    const run = resolveRecords(made.state, made.ctx, "17106", "setup", idOf(made.state, "17106"));
    const revealed = [BANNER, GARB, SUMMONS].filter((code) => run.state.cards[idOf(run.state, code)]?.zone === "staging");
    expect(revealed).toHaveLength(1);
    expect(run.state.setAside).toHaveLength(2);
    const objective = idOf(run.state, revealed[0] ?? "");
    expect(run.state.cards[objective]?.attachments).toHaveLength(1);
  });

  it("leaves the objective unguarded when no card of its type is in the deck or the discard pile (user ruling, docs/scenarios/ered-mithrin.md), so the stage claims it for a hero", () => {
    const made = table({ side: "A", setAside: [SUMMONS], staging: [SERPENT], deck: ["16043", "16042", "17103"] });
    const run = resolveRecords(made.state, made.ctx, "17106", "setup", idOf(made.state, "17106"));
    const summons = run.state.cards[idOf(run.state, SUMMONS)];
    expect(summons).toMatchObject({ zone: "attached", host: made.hero, claimed: true, attachments: [] });
    expect(run.state.encounterDeck).toHaveLength(3);
  });

  it("does nothing when no Harad objective is set aside", () => {
    const made = table({ staging: [SERPENT], deck: ["16043"] });
    const run = resolveRecords(made.state, made.ctx, "17106", "setup", idOf(made.state, "17106"));
    expect(run.state.staging).toEqual(made.state.staging);
  });
});

describe("17106:B:1 ClaimUnattached: the first player claims a Harad objective that nothing holds", () => {
  it("claims a free objective in the staging area for a hero of the first player, and leaves a guarded one", () => {
    const made = table({ staging: [GARB, BANNER, ARCHER] });
    const state = guardWith(made.state, idOf(made.state, ARCHER), idOf(made.state, BANNER));
    const steps: EngineStep[] = [];
    const run = finish({ state: settle({ ...opened(made, state).state, window: null, mode: "stopped" }, made.ctx, steps), steps }, made.ctx);
    const settled = run.state;
    expect(settled.cards[idOf(settled, GARB)]).toMatchObject({ claimed: true, host: made.hero, controller: 0 });
    // The claim is a step the banner and the log read.
    expect(run.steps).toContainEqual({ kind: "claim", cardId: idOf(settled, GARB), heroId: made.hero, seat: 0 });
    expect(settled.cards[idOf(settled, BANNER)]?.claimed).toBeUndefined();
    expect(settled.cards[idOf(settled, BANNER)]?.zone).toBe("staging");
  });
});

describe("17108:B:2 The Black Serpent loses its first sentence with 6 progress on stage 3B", () => {
  const SERPENT_LOSES = (progress: number) => {
    const made = table({ stage: "17108", progress, staging: [SERPENT] });
    return { made, state: opened(made).state };
  };

  it("cannot take damage or leave the staging area below 6 progress", () => {
    const { state } = SERPENT_LOSES(5);
    expect(flagged(state, idOf(state, SERPENT), "cannotTakeDamage")).toBe(true);
    expect(flagged(state, idOf(state, SERPENT), "losesNoDamage")).toBe(false);
    expect(flagged(state, idOf(state, SERPENT), "losesCannotLeaveStaging")).toBe(false);
  });

  it("keeps the Serpent in the staging area below 6 progress and lets it leave with 6", () => {
    for (const [progress, zone] of [[5, "staging"], [6, "engaged"]] as const) {
      const { state } = SERPENT_LOSES(progress);
      const id = idOf(state, SERPENT);
      expect(moveCard(state, id, { zone: "engaged", seat: 0 }).cards[id]?.zone).toBe(zone);
    }
  });

  it("loses both with 6 progress, and X is the stage number", () => {
    const { made, state } = SERPENT_LOSES(6);
    expect(flagged(state, idOf(state, SERPENT), "losesNoDamage")).toBe(true);
    expect(flagged(state, idOf(state, SERPENT), "losesCannotLeaveStaging")).toBe(true);
    const serpent = state.cards[idOf(state, SERPENT)];
    expect(modifiedStat(state, serpent!, "attack", made.ctx.cards)).toBe(2 + 3);
  });
});

describe("17102:A:1 RevealDetached: a Harad objective a hero holds is detached, revealed and added to the staging area", () => {
  it("detaches the objective from its hero, reveals it and resolves its Guarded (X)", () => {
    const made = table({ stage: "17107", staging: [BANNER], deck: ["16043", "16042", "16041"] });
    const state = claimed(made.state, BANNER, made.hero);
    const run = resolveRecords(state, made.ctx, "17102", "whenRevealed", undefined, () => "detach");
    const banner = run.state.cards[idOf(run.state, BANNER)];
    expect(banner).toMatchObject({ zone: "staging", host: null, controller: 0 });
    expect(banner?.claimed).toBeUndefined();
    expect(banner?.attachments).toHaveLength(1);
    expect(run.state.cards[made.hero]?.attachments).not.toContain(banner?.id);
  });

  it("offers the option only while a Harad objective is on a hero", () => {
    const made = table({ stage: "17107", deck: ["16043", "16042", "16041"] });
    const run = resolveRecords(made.state, made.ctx, "17102", "whenRevealed");
    expect(run.state.encounterDeck.length).toBe(made.state.encounterDeck.length - 2);
  });
});

describe("17107:B:2 The Black Serpent is considered engaged with each player who controls a Harad objective", () => {
  const stage2 = () => {
    const made = table({ seats: 2, stage: "17107", staging: [SERPENT, BANNER] });
    return { made, state: opened(made, claimed(made.state, BANNER, made.hero)).state };
  };

  it("is engaged with the player who holds the objective and not with the other", () => {
    const { state } = stage2();
    const serpent = idOf(state, SERPENT);
    expect(consideredEngagedSeats(state, serpent, [0, 1])).toEqual([0]);
    expect(stagingAttackers(state, 0)).toEqual([serpent]);
    expect(stagingAttackers(state, 1)).toEqual([]);
  });

  it("only the player who holds the objective declares attackers against it, with the characters of the others only when they have ranged", () => {
    const { made, state } = stage2();
    const serpent = idOf(state, SERPENT);
    const other = made.seat1Hero ?? "";
    expect(canAttack(state, 0, made.hero, serpent, made.ctx.cards)).toBe(true);
    expect(canAttack(state, 1, other, serpent, made.ctx.cards)).toBe(false);
  });

  it("is engaged with nobody while no player holds an objective", () => {
    const made = table({ seats: 2, stage: "17107", staging: [SERPENT] });
    const state = opened(made).state;
    expect(consideredEngagedSeats(state, idOf(state, SERPENT), [0, 1])).toEqual([]);
  });
});

describe("17094:A:1 The Black Serpent is never optionally engaged: it cannot leave the staging area", () => {
  const optional = (progress: number) => {
    const made = table({ stage: "17108", progress, staging: [SERPENT, ARCHER] });
    const state = { ...opened(made).state, phase: "Encounter" as const, window: { kind: "optionalEngage" as const } };
    return { made, state };
  };

  it("is not offered and the Engage intent for it is refused, while another enemy is offered", () => {
    const { made, state } = optional(3);
    expect(optionalEnemies(state, made.ctx.cards)).toEqual([idOf(state, ARCHER)]);
    expect(rejectionReason(state, { type: "Engage", enemyId: idOf(state, SERPENT) }, made.ctx)).toBe("That enemy cannot be optionally engaged");
    expect(rejectionReason(state, { type: "Engage", enemyId: idOf(state, ARCHER) }, made.ctx)).toBeNull();
  });

  it("is offered again once 6 progress let it leave the staging area", () => {
    const { made, state } = optional(6);
    expect(optionalEnemies(state, made.ctx.cards)).toContain(idOf(state, SERPENT));
  });
});

describe("17091:A:2 While attached to an encounter card, each Harad enemy gets +1 Attack", () => {
  it("holds while an encounter card guards the Banner and stops when it is free", () => {
    const made = table({ staging: [BANNER, ARCHER, "16042"] });
    const guardedState = opened(made, guardWith(made.state, idOf(made.state, ARCHER), idOf(made.state, BANNER))).state;
    const free = opened(made).state;
    const bonus = (state: ScenarioState) => modifiedStat(state, state.cards[idOf(state, "16042")]!, "attack", made.ctx.cards);
    expect(bonus(guardedState)).toBe(bonus(free) + 1);
  });
});
