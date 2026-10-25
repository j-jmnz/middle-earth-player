import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import type { EngineStep } from "../rules/intents.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { shadowCards } from "../rules/zones.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../scripts/starter-game.ts";

// Rules: rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.step-6-8-3, ltp.shadow-discard (data/rules/entries.json). The combat
// phase from the table's side, over whole games of both starter decks: every attacking enemy carries a face-down shadow card
// while the defender is chosen, the card is face up once the attack resolves, combat damage is the attack strength less the
// defense the engine reports (less an enemy's toughness), and no shadow card is left once combat ends.
type Seen = { attacks: number; strikes: number; shadowsTurned: number; playerStrikes: number };

function checkStrikes(steps: readonly EngineStep[], seen: Seen): void {
  steps.forEach((step, index) => {
    if (step.kind !== "strike") return;
    seen.strikes += 1;
    if (step.side === "player") seen.playerStrikes += 1;
    const owed = Math.max(0, step.attack - step.defense);
    // The damage of this strike comes before the next attack begins.
    const rest = steps.slice(index + 1);
    const end = rest.findIndex((later) => later.kind === "attack" || later.kind === "strike");
    const placed = (end < 0 ? rest : rest.slice(0, end)).find((later) => later.kind === "damage" && later.targetId === step.targetId);
    if (step.side === "enemy") {
      // Combat damage on a character is exactly what the strike owes; none is placed when the defense stops all of it.
      expect(placed?.kind === "damage" ? placed.amount : 0, JSON.stringify(step)).toBe(owed);
    } else {
      // An enemy's toughness may take some of it away (mec109.toughness); never more than the strike owes.
      expect(placed?.kind === "damage" ? placed.amount : 0).toBeLessThanOrEqual(owed);
    }
  });
}

// The hero with the most attack, kept back from the quest and from defense so the seat has someone to attack with.
function striker(state: ScenarioState, ctx: ReduceContext): string | null {
  const heroes = state.seats[state.activeSeat]?.heroes ?? [];
  const attack = (id: string) => modifiedStat(state, state.cards[id] ?? (null as never), "attack", ctx.cards);
  return [...heroes].filter((id) => state.cards[id]?.code !== RING_BEARER).sort((a, b) => attack(b) - attack(a))[0] ?? null;
}

// The auto-player never attacks (its goldens are pinned). Here the seat keeps its best attacker ready, and attacks the first
// enemy it can with every character that may join, so player attacks are played too.
function attackOrPolicy(state: ScenarioState, ctx: ReduceContext): PlayerIntent {
  const kept = striker(state, ctx);
  const legal = legalIntents(state, ctx);
  if (state.mode === "questCommit" && state.window?.kind === "pass" && legal.some((intent) => intent.type === "Commit")) {
    const cardIds = legalTargets(state, { type: "Commit" }, ctx).filter((id) => id !== kept);
    if (cardIds.length > 0) return { type: "Commit", cardIds };
  }
  if (state.window?.kind === "defense" && kept) {
    const heroes = legalTargets(state, { type: "Undefended" }, ctx).filter((id) => id !== kept && state.cards[id]?.code !== RING_BEARER);
    const defenders = legalTargets(state, { type: "DeclareDefender" }, ctx).filter((id) => id !== kept);
    if (defenders[0]) return { type: "DeclareDefender", defenderId: defenders[0] };
    if (heroes[0]) return { type: "Undefended", heroId: heroes[0] };
  }
  if (state.window?.kind === "playerAttack" && legal.some((intent) => intent.type === "DeclareAttackers")) {
    const seat = state.seats[state.activeSeat];
    const ids = [...(seat?.heroes ?? []), ...(seat?.play ?? [])];
    const enemyId = ids.flatMap((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx))[0];
    if (enemyId) {
      const attackerIds = ids.filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).includes(enemyId));
      return { type: "DeclareAttackers", enemyId, attackerIds };
    }
  }
  return nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true });
}

function playGame(ctx: ReduceContext, start: ScenarioState, seen: Seen): ScenarioState {
  let state = expectOk(reduce(start, { type: "Keep" }, ctx)).state;
  for (let turn = 0; turn < 900 && !state.lost && !state.stageCleared; turn += 1) {
    if (state.window?.kind === "defense") {
      const enemy = state.cards[state.window.enemyId];
      const dealt = shadowCards(enemy);
      // A shadow card is dealt unless the encounter deck and its discard pile were both empty (rr.step-6-2).
      if (dealt.length > 0) {
        seen.attacks += 1;
        expect(state.cards[dealt[0] ?? ""]?.face).toBe("down");
      }
    }
    const before = state;
    const result = expectOk(reduce(state, attackOrPolicy(state, ctx), ctx));
    checkStrikes(result.steps, seen);
    state = result.state;
    // The attack the intent finished: its enemy's shadow card is now face up, or it has already gone to the discard pile.
    const finished = before.pendingAttack && state.pendingAttack?.enemyId !== before.pendingAttack.enemyId ? before.pendingAttack.enemyId : null;
    if (finished) {
      for (const shadowId of shadowCards(before.cards[finished])) {
        const now = state.cards[shadowId];
        // Still with its enemy, it is face up; otherwise the end of combat has already discarded it.
        if (now?.zone !== "shadow") continue;
        expect(now.face).toBe("up");
        seen.shadowsTurned += 1;
      }
    }
    // Once combat is over every shadow card dealt this round is in the encounter discard pile (ltp.shadow-discard).
    if (before.phase === "Combat" && state.phase !== "Combat") {
      expect(Object.values(state.cards).filter((card) => card.zone === "shadow")).toEqual([]);
    }
  }
  return state;
}

describe("combat on the table", () => {
  it("deals, turns up and discards shadow cards, and places the damage each strike owes, in whole starter games", async () => {
    const seen: Seen = { attacks: 0, strikes: 0, shadowsTurned: 0, playerStrikes: 0 };
    for (const deck of ["stealth-and-steadfastness", "wisdom-and-wizardry"]) {
      const { ctx } = await starterWorld(deck);
      for (const seed of STARTER_SEEDS) playGame(ctx, startScenario(starterStart(deck, seed), ctx), seen);
    }
    expect(seen.attacks).toBeGreaterThan(3);
    expect(seen.strikes).toBeGreaterThan(3);
    expect(seen.shadowsTurned).toBeGreaterThan(0);
    expect(seen.playerStrikes).toBeGreaterThan(0);
  }, 120_000);
});
