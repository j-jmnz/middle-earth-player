// The player's choice in words, for what a screen reader hears after Undo (docs/design-system-table.md, Last move): "Taken back", the
// choice, and what it had done. Pure.
import { askingToCommit } from "../../rules/families/sea/sailing-legal.ts";
import type { PlayerIntent } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import { hostName, playWords, type PlayInto } from "../cards/host-words.ts";
import { MOST, type Moment, type MomentLine } from "./outcome.ts";

function listed(ids: readonly string[], card: (cardId: string) => string): string {
  return ids.map((id) => card(id)).join(", ");
}

/** The player's choice in words, for the banner after Undo ("Frodo Baggins committed to the quest"). `before` is the state the intent was sent in: a Commit sent while the first player was asked what to commit to a Sailing test is the test's. */
export function intentWords(intent: PlayerIntent, card: (cardId: string) => string, before?: ScenarioState, into?: (cardId: string) => PlayInto): string {
  switch (intent.type) {
    case "Pass":
      return "Passed";
    case "PlayCard":
      return intent.hostId ? playWords(card(intent.cardId), hostName(card, intent.hostId), intent.hostId, into?.(intent.cardId), before?.seatCount ?? 1, true) : `Played ${card(intent.cardId)}`;
    case "Commit":
      return `${listed(intent.cardIds, card)} committed to the ${before && askingToCommit(before) ? "Sailing test" : "quest"}`;
    case "CommitHide":
      return `${listed(intent.cardIds, card)} committed to the Hide test`;
    case "CommitFortitude":
      return `${listed(intent.cardIds, card)} committed to the Fortitude test`;
    case "CommitEscape":
      return `${listed(intent.cardIds, card)} committed to the escape test`;
    case "Travel":
      return `Traveled to ${card(intent.locationId)}`;
    case "DeclineTravel":
      return "Did not travel";
    case "Engage":
      return `Engaged ${card(intent.enemyId)}`;
    case "DeclineEngage":
      return "Did not engage";
    case "ChooseEnemy":
      return `Chose ${card(intent.enemyId)}`;
    case "DeclareDefender":
      return `${card(intent.defenderId)} defended`;
    case "Undefended":
      return intent.heroId ? `Left the attack undefended on ${card(intent.heroId)}` : "Left the attack undefended";
    case "DeclareAttackers":
      return `${listed(intent.attackerIds, card)} attacked ${card(intent.enemyId)}`;
    case "DeclineAttack":
      return "Did not attack";
    case "Trigger":
      return `Used ${card(intent.cardId)}`;
    case "Distribute":
      return "Assigned the damage";
    case "Keep":
      return "Kept the hand";
    default:
      return "Your last choice";
  }
}

/** The banner after Undo: "Taken back", the choice in words, and what it had done when that said anything. */
export function takenBack(choice: string, undone: Moment | null): Moment {
  const lines: MomentLine[] = [{ text: choice, mark: null }, ...(undone ? [{ text: undone.title, mark: null }, ...undone.lines] : [])];
  return { title: "Taken back", tone: "plain", lines: lines.slice(0, MOST) };
}
