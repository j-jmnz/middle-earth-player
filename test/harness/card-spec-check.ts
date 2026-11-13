import { flagged, type ScenarioState } from "../../src/rules/core/state.ts";
import { declaredDefenders } from "../../src/rules/families/defense/defenders.ts";
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import { stagingThreat } from "../../src/rules/quest/quest.ts";

import type { CounterName, Done, Expect } from "./card-spec-types.ts";
import { idOf, idsOf, legalIntents } from "./scene-kit.ts";

// Test helper. What each expectation of a card-spec row (card-spec-types.ts, Expect) reads off the state the actions left, and the steps they took. Rules: rr.multiple-defenders, rr.cancel, mec112.pursuit,
// mec109.ringbearers-life (data/rules/entries.json).

// The scenario values `counter` reads, each through a named reader: the pursuit value (absent until the quest card's Setup sets it) and the Ring-bearer's life.
export const COUNTERS: Readonly<Record<CounterName, (state: ScenarioState) => number | undefined>> = {
  pursuit: (state) => state.pursuit,
  life: (state) => state.life,
};

// The codes of the cards that attacked the card: the enemies whose attack struck it, and the characters declared to attack it.
function attackersOf(done: Done, code: string): string[] {
  const { state, steps } = done.run;
  const id = idOf(state, code);
  const found: string[] = [];
  for (const step of steps) {
    if (step.kind === "strike" && step.side === "enemy" && step.targetId === id) found.push(state.cards[step.enemyId]?.code ?? step.enemyId);
    if (step.kind === "attack" && step.side === "player" && step.enemyId === id) found.push(...(step.attackerIds ?? []).map((attacker) => state.cards[attacker]?.code ?? attacker));
  }
  return found;
}

// What the expectation says is wrong with the state the actions left; nothing when it holds.
export function failures(done: Done, wanted: readonly Expect[]): string[] {
  const { state, steps } = done.run;
  const problems: string[] = [];
  for (const item of wanted) {
    try {
      switch (item.expect) {
        case "stat": {
          const got = modifiedStat(state, state.cards[idOf(state, item.code)]!, item.name, done.table.cards);
          if (got !== item.value) problems.push(`${item.code} ${item.name} is ${got}, not ${item.value}`);
          break;
        }
        case "flag": {
          const got = flagged(state, idOf(state, item.code), item.name);
          if (got !== item.value) problems.push(`${item.code} ${item.name} is ${got}, not ${item.value}`);
          break;
        }
        case "zone": {
          const zones = idsOf(state, item.code).map((id) => state.cards[id]?.zone);
          if (!zones.includes(item.zone as never)) problems.push(`${item.code} is in ${zones.join(", ") || "no zone"}, not ${item.zone}`);
          break;
        }
        case "progressOn":
        case "resourcesOn":
        case "damageOn": {
          const field = item.expect === "progressOn" ? "progress" : item.expect === "resourcesOn" ? "resources" : "damage";
          const got = state.cards[idOf(state, item.code)]?.[field] ?? 0;
          if (got !== item.value) problems.push(`${item.code} holds ${got} ${field}, not ${item.value}`);
          break;
        }
        case "handCount": {
          const got = state.seats[item.seat]?.hand.length ?? 0;
          if (got !== item.value) problems.push(`seat ${item.seat} holds ${got} cards in hand, not ${item.value}`);
          break;
        }
        case "drew": {
          const got = steps.filter((step) => step.kind === "draw" && step.seat === item.seat).length;
          if (got !== item.value) problems.push(`seat ${item.seat} drew ${got} cards, not ${item.value}`);
          break;
        }
        case "defender": {
          const attack = done.during?.pendingAttack ?? state.pendingAttack;
          if (!attack) throw new Error("no attack was in progress: the row needs an attack action");
          const got = declaredDefenders(attack).includes(idOf(state, item.code));
          if (got !== item.value) problems.push(`${item.code} ${got ? "defended" : "did not defend"} the attack`);
          break;
        }
        case "attackersOf": {
          const got = attackersOf(done, item.code);
          if (got.join(",") !== item.attackers.join(",")) problems.push(`${item.code} was attacked by [${got.join(", ")}], not [${item.attackers.join(", ")}]`);
          break;
        }
        case "refused": {
          const id = idOf(state, item.code);
          const got = steps.some((step) => step.kind === "cancel" && step.cardId === id);
          if (got !== item.value) problems.push(`the effect of ${item.code} was ${got ? "" : "not "}canceled`);
          break;
        }
        case "counter": {
          const got = COUNTERS[item.name](state);
          if (got !== item.value) problems.push(`${item.name} is ${got ?? "absent"}, not ${item.value}`);
          break;
        }
        case "heldBy": {
          const held = state.cards[idOf(state, item.code)];
          const host = idOf(state, item.host);
          if (held?.zone !== "captive" || held.host !== host) problems.push(`${item.code} is ${held?.zone === "captive" ? `held by ${state.cards[held.host ?? ""]?.code ?? "nothing"}` : `in ${held?.zone ?? "no zone"}`}, not held by ${item.host}`);
          break;
        }
        case "deckCount":
          if (state.encounterDeck.length !== item.value) problems.push(`the encounter deck holds ${state.encounterDeck.length} cards, not ${item.value}`);
          break;
        case "exhausted": {
          const got = state.cards[idOf(state, item.code)]?.exhausted === true;
          if (got !== item.value) problems.push(`${item.code} is ${got ? "" : "not "}exhausted`);
          break;
        }
        case "stagingThreat": {
          const got = stagingThreat(state, done.table.cards);
          if (got !== item.value) problems.push(`the staging area's total Threat is ${got}, not ${item.value}`);
          break;
        }
        case "threat": {
          const got = state.seats[item.seat]?.threat;
          if (got !== item.value) problems.push(`seat ${item.seat} has threat ${got}, not ${item.value}`);
          break;
        }
        case "revealedBy": {
          const seats = steps.flatMap((step) => (step.kind === "reveal" && state.cards[step.cardId]?.code === item.code ? [step.seat] : []));
          if (!seats.includes(item.seat)) problems.push(`${item.code} was revealed by ${seats.length > 0 ? `seat ${seats.join(", ")}` : "nobody"}, not seat ${item.seat}`);
          break;
        }
        case "lost":
          if (!state.lost) problems.push("the game is not lost");
          break;
        case "won":
          if (!state.stageCleared || state.lost) problems.push("the game is not won");
          break;
        case "notWon":
          if (state.stageCleared) problems.push("the game is won");
          break;
        case "frame":
          if (!steps.some((step) => step.kind === "push" && step.frame === item.name)) problems.push(`no ${item.name} frame was pushed`);
          break;
        case "offers": {
          const id = item.code ? idOf(state, item.code) : undefined;
          const offered = legalIntents(state, done.table.ctx).some((intent) => intent.type === item.intent && (id === undefined || ("cardId" in intent && intent.cardId === id)));
          if (!offered) problems.push(`${item.intent}${item.code ? ` of ${item.code}` : ""} is not offered`);
          break;
        }
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  return problems;
}
