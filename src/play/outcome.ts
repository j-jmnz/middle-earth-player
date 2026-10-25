// Rules: rr.step-3-4, rr.quest-advancement, rr.travel, rr.step-6-4-3, rr.step-6-8-3 (data/rules/entries.json).
//
// What the last accepted intent did, in a few words, for the banner over the table: the quest's result (willpower against
// threat, then the threat raised or the progress placed and the stage it advanced to), each attack's numbers and damage,
// travel, the cards revealed and the enemies that engaged. Every number is one the engine put in a step. The log keeps
// the whole round; the banner keeps what changed the table.
import type { EngineStep, PlayerIntent } from "../rules/intents.ts";
import type { ScenarioState } from "../rules/state.ts";

import type { LogMark } from "./log.ts";

export type MomentLine = { text: string; mark: LogMark };
export type MomentTone = "good" | "bad" | "plain";
export type Moment = { title: string; tone: MomentTone; lines: readonly MomentLine[] };

const MOST = 5;

// `shadow` gives the printed shadow line of a card, or null when it has no shadow effect.
type Names = { card: (cardId: string) => string; shadow?: (cardId: string) => string | null };

function seatWord(state: ScenarioState, seat: number): string {
  return state.seatCount > 1 ? `Player ${seat + 1} threat` : "Threat";
}

type Group = { rank: number; title: string; tone: MomentTone; lines: MomentLine[] };

/**
 * The banner for one accepted intent, or null when it changed nothing worth one (a draw, a resource, a pass that only moved
 * to the next window). `before` is the state the intent was sent in, `after` the state it left.
 */
export function momentOf(before: ScenarioState, after: ScenarioState, steps: readonly EngineStep[], names: Names): Moment | null {
  const groups: Group[] = [];
  let current: Group | null = null;
  const open = (rank: number, title: string, tone: MomentTone): Group => {
    const group: Group = { rank, title, tone, lines: [] };
    groups.push(group);
    current = group;
    return group;
  };
  const line = (text: string, mark: LogMark = null) => {
    (current ?? open(9, "", "plain")).lines.push({ text, mark });
  };

  steps.forEach((step, index) => {
    switch (step.kind) {
      case "quest": {
        const [title, tone]: [string, MomentTone] = step.willpower > step.threat ? ["Quest succeeded", "good"] : step.willpower < step.threat ? ["Quest failed", "bad"] : ["Quest held even", "plain"];
        const group = open(0, title, tone);
        group.lines.push({ text: `Willpower ${step.willpower} against threat ${step.threat}`, mark: "willpower" });
        if (tone === "plain") group.lines.push({ text: "No progress, no threat", mark: null });
        return;
      }
      case "push": {
        // A shadow card turned up for an attack: its effect, in its printed words.
        // (A frame of an enemy's own after-attack instructions is also a "shadow" frame; its card is not a shadow card.)
        const dealt = step.cardId != null && (before.cards[step.cardId]?.zone === "shadow" || after.cards[step.cardId]?.zone === "shadow");
        if (step.frame !== "shadow" || !step.cardId || !dealt) return;
        const text = names.shadow?.(step.cardId);
        if (text) line(`Shadow, ${names.card(step.cardId)}: ${text}`, null);
        return;
      }
      case "threat":
        line(`${seatWord(after, step.seat)} ${step.amount >= 0 ? "+" : ""}${step.amount}`, "threat");
        return;
      case "progress":
        line(step.amount < 0 ? `${-step.amount} progress removed from ${names.card(step.targetId)}` : `${step.amount} progress on ${names.card(step.targetId)}`, "progress");
        return;
      case "advance":
        if (!current) open(1, "The quest advances", "good");
        line(`The quest advances to ${names.card(step.cardId)}`);
        return;
      case "strike": {
        const enemy = names.card(step.enemyId);
        const target = names.card(step.targetId);
        if (step.side === "enemy") {
          open(2, `${enemy} attacks`, "plain");
          line(step.undefended ? `Attack ${step.attack} on ${target}, undefended` : `Attack ${step.attack} against ${target}'s defense ${step.defense}`, "attack");
        } else {
          open(2, `Attack on ${enemy}`, "plain");
          line(`Attack ${step.attack} against defense ${step.defense}`, "attack");
        }
        // The damage the strike placed comes before the next attack: say so when there is none.
        const rest = steps.slice(index + 1);
        const end = rest.findIndex((later) => later.kind === "strike" || later.kind === "attack");
        const placed = (end < 0 ? rest : rest.slice(0, end)).some((later) => later.kind === "damage" && later.targetId === step.targetId);
        if (!placed) line("No damage");
        return;
      }
      case "damage":
        line(`${step.amount} damage on ${names.card(step.targetId)}`, "damage");
        return;
      case "destroy": {
        // A location leaves play explored, an enemy defeated, a character destroyed.
        const was = before.cards[step.targetId]?.zone;
        const verb = was === "activeLocation" || was === "secondActiveLocation" ? "explored" : was === "engaged" || was === "staging" ? "defeated" : "destroyed";
        line(`${names.card(step.targetId)} is ${verb}`);
        return;
      }
      case "reveal":
        if (!current || current.rank !== 3) open(3, "Staging", "plain");
        line(`Revealed ${names.card(step.cardId)}`);
        return;
      case "engage":
        open(4, `${names.card(step.enemyId)} engages`, "bad");
        line(after.seatCount > 1 ? `${names.card(step.enemyId)} engages Player ${step.seat + 1}` : `${names.card(step.enemyId)} engages you`);
        return;
      case "hideTest":
        open(1, step.success ? "Hide test passed" : "Hide test failed", step.success ? "good" : "bad");
        line(`Willpower ${step.willpower} against threat ${step.threat}`, "willpower");
        return;
      case "eliminate":
        open(0, `Player ${step.seat + 1} is eliminated`, "bad");
        return;
      case "resetEncounterDeck":
        line("The encounter discard pile is shuffled into the encounter deck");
        return;
      default:
        return;
    }
  });

  // Travel leaves no step of its own: the location that became active from staging.
  const arrived = after.activeLocation;
  if (arrived && arrived !== before.activeLocation && before.staging.includes(arrived)) {
    groups.push({ rank: 1, title: `Traveled to ${names.card(arrived)}`, tone: "plain", lines: [{ text: "It is the active location now", mark: null }] });
  }

  const shown = groups.filter((group) => group.lines.length > 0 || group.title !== "");
  if (shown.length === 0) return null;
  const lead = [...shown].sort((a, b) => a.rank - b.rank)[0] ?? shown[0];
  if (!lead) return null;
  const lines = [...lead.lines, ...shown.filter((group) => group !== lead).flatMap((group) => (group.title ? [{ text: group.title, mark: null }, ...group.lines] : group.lines))];
  const kept = lines.slice(0, MOST);
  if (lines.length > MOST) kept.push({ text: `And ${lines.length - MOST} more in the log`, mark: null });
  return { title: lead.title || "This turn", tone: lead.tone, lines: kept };
}

function listed(ids: readonly string[], card: (cardId: string) => string): string {
  return ids.map((id) => card(id)).join(", ");
}

/** The player's choice in words, for the banner after Undo ("Frodo Baggins committed to the quest"). */
export function intentWords(intent: PlayerIntent, card: (cardId: string) => string): string {
  switch (intent.type) {
    case "Pass":
      return "Passed";
    case "PlayCard":
      return intent.hostId ? `Played ${card(intent.cardId)} on ${card(intent.hostId)}` : `Played ${card(intent.cardId)}`;
    case "Commit":
      return `${listed(intent.cardIds, card)} committed to the quest`;
    case "CommitHide":
      return `${listed(intent.cardIds, card)} committed to the Hide test`;
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
