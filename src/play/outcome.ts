// Rules: rr.step-3-4, rr.quest-advancement, rr.travel, rr.step-6-4-3, rr.step-6-8-3, rr.damage, rr.step-7-3
// (data/rules/entries.json).
//
// What the last accepted intent did, in a few words, for the banner over the table: the quest's result (willpower against
// threat, then the threat raised or the progress placed and the stage it advanced to), each attack's numbers and damage,
// travel, the cards revealed and the enemies that engaged. Every number is one the engine put in a step. The log keeps
// the whole round; the banner keeps what changed the table.
import { askingToCommit } from "../rules/families/sea/sailing-legal.ts";
import type { EngineStep, PlayerIntent } from "../rules/core/intents.ts";
import type { ScenarioState } from "../rules/core/state.ts";

import type { LogMark } from "./log.ts";
import { detachLine, grappleLine } from "./grapple-words.ts";
import { boardingWords } from "./sea-words.ts";

// `cards`: the cards a line touches (the shadow card, the card damaged or destroyed), drawn on the table while the banner
// is at that line (resolve in beats).
export type MomentLine = { text: string; mark: LogMark; cards?: readonly string[] };
export type MomentTone = "good" | "bad" | "plain";
export type Moment = { title: string; tone: MomentTone; lines: readonly MomentLine[] };

const MOST = 5;

// The banner shows its lines one beat at a time (resolve in beats): this long between two lines.
export const BEAT_MS = 650;

// `shadow` gives the printed shadow line of a card, or null when it has no shadow effect; `stage` the printed lines of a quest
// stage that say how it is won or held (not its When Revealed effects), or null.
// `revealed` gives the printed When Revealed lines of a card (the Stormcaller's stage the C side of which was just revealed), or null.
type Names = { card: (cardId: string) => string; shadow?: (cardId: string) => string | null; stage?: (cardId: string) => string | null; revealed?: (cardId: string) => string | null };

// "stage 3 of 4" for the Stormcaller's stage `cardId` (the area's current stage once it has advanced), or "its next stage" for a state that moved on.
function stormcallerStageWords(state: ScenarioState, cardId: string): string {
  const area = state.sea?.stormcaller;
  return area && area.stage === cardId ? `stage ${area.number} of ${area.number + area.deck.length}` : "its next stage";
}

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
  const line = (text: string, mark: LogMark = null, cards: readonly string[] = []) => {
    (current ?? open(9, "", "plain")).lines.push({ text, mark, ...(cards.length > 0 ? { cards } : {}) });
  };

  // Boarding (dcce.boarding): the Corsair cards a ship-enemy's Boarding revealed engage after it in the same steps (the engine names the ship on each: `boarding`). They are one beat of
  // the ship's own, "Boarding 2 · Corsair Warship: 2 Corsairs engage Player 1", not a beat each; a Corsair card another effect revealed keeps its own engage beat.
  const boarded = new Map<number, number>();
  const joined = new Set<number>();
  steps.forEach((step, index) => {
    if (step.kind !== "engage" || step.boarding == null) return;
    const shipAt = steps.findLastIndex((earlier, at) => at < index && earlier.kind === "engage" && earlier.enemyId === step.boarding);
    if (shipAt < 0) return;
    joined.add(index);
    boarded.set(shipAt, (boarded.get(shipAt) ?? 0) + 1);
  });

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
        if (text) line(`Shadow, ${names.card(step.cardId)}: ${text}`, null, [step.cardId]);
        return;
      }
      case "threat":
        line(`${seatWord(after, step.seat)} ${step.amount >= 0 ? "+" : ""}${step.amount}`, "threat");
        return;
      case "progress":
        line(step.amount < 0 ? `${-step.amount} progress removed from ${names.card(step.targetId)}` : `${step.amount} progress on ${names.card(step.targetId)}`, "progress");
        return;
      case "advance": {
        // The Stormcaller's stage advance (dcce.stormcallers-area-stages): its C side's When Revealed is the beat's second line.
        if (step.stormcaller === true) {
          open(1, "The Stormcaller advances", "bad");
          line(`The Stormcaller advances to ${stormcallerStageWords(after, step.cardId)}: ${names.card(step.cardId)}`);
          const text = names.revealed?.(step.cardId);
          if (text) line(text, null, [step.cardId]);
          return;
        }
        if (!current) open(1, "The quest advances", "good");
        line(`The quest advances to ${names.card(step.cardId)}`);
        // A stage whose When Revealed swaps the encounter sets (Change of Plans, 12040:B:1) reads its printed words as the beat: its flips, the set that leaves and the set shuffled in are in the log.
        if (steps.slice(index + 1).some((later) => later.kind === "removeSet")) {
          const text = names.revealed?.(step.cardId);
          if (text) line(text, null, [step.cardId]);
        }
        // A stage a branch led to ("proceed to one of the 2 A Chosen Path stages, at random", 01120:B:1): the stages share a
        // name, so the banner says the pick was the shuffle's and what the stage asks of the players.
        const code = after.cards[step.cardId]?.code;
        if (code != null && after.stages.some((stage) => stage.branch?.includes(code))) {
          line("The path was chosen at random");
          const text = names.stage?.(step.cardId);
          if (text) line(text, null, [step.cardId]);
        }
        return;
      }
      case "strike": {
        const enemy = names.card(step.enemyId);
        const target = names.card(step.targetId);
        if (step.side === "enemy") {
          open(2, `${enemy} attacks`, "plain");
          // A defender the shadow card destroyed leaves the attack undefended (rr.step-6-4-3): say why it is.
          const declared = before.pendingAttack?.enemyId === step.enemyId ? before.pendingAttack.defenderId : undefined;
          if (step.undefended && declared && declared !== step.targetId && steps.slice(0, index).some((earlier) => earlier.kind === "destroy" && earlier.targetId === declared)) {
            line(`With ${names.card(declared)} gone, the attack is undefended`, null, [declared]);
          }
          line(step.undefended ? `Attack ${step.attack} on ${target}, undefended` : `Attack ${step.attack} against ${target}'s defense ${step.defense}`, "attack", [step.enemyId, step.targetId]);
        } else {
          open(2, `Attack on ${enemy}`, "plain");
          line(`Attack ${step.attack} against defense ${step.defense}`, "attack", [step.enemyId]);
        }
        // The damage the strike placed comes before the next attack: say so when there is none.
        const rest = steps.slice(index + 1);
        const end = rest.findIndex((later) => later.kind === "strike" || later.kind === "attack");
        const placed = (end < 0 ? rest : rest.slice(0, end)).some((later) => later.kind === "damage" && later.amount > 0 && later.targetId === step.targetId);
        if (!placed) line("No damage");
        return;
      }
      case "damage":
        // A heal is a damage step with a negative amount (rr.damage).
        line(step.amount < 0 ? `${-step.amount} damage healed on ${names.card(step.targetId)}` : `${step.amount} damage on ${names.card(step.targetId)}`, "damage", [step.targetId]);
        return;
      case "destroy": {
        // A location placed facedown underneath The Havens Burn is hidden from now on: the line does not name it and rings no card (dcce.aflame).
        if (step.under) {
          line("A location burns and is placed facedown underneath The Havens Burn");
          return;
        }
        // A location leaves play explored, an enemy defeated, a character destroyed.
        const was = before.cards[step.targetId]?.zone;
        const verb = was === "activeLocation" || was === "secondActiveLocation" ? "explored" : was === "engaged" || was === "staging" ? "defeated" : "destroyed";
        line(`${names.card(step.targetId)} is ${verb}`, null, [step.targetId]);
        return;
      }
      case "reveal":
        if (!current || current.rank !== 3) open(3, "Staging", "plain");
        line(`Revealed ${names.card(step.cardId)}`);
        return;
      // The enemy was faceup when it was revealed: the line names it and the location it is facedown under now (dcce.grapple).
      case "grapple":
        if (!current || current.rank !== 3) open(3, "Staging", "plain");
        line(grappleLine(names.card(step.enemyId), names.card(step.locationId)), null, [step.locationId]);
        return;
      // The enemies grappled with a location that became the active location or was explored come out from under it, faceup, into the staging area (dcce.grapple).
      case "detach":
        if (!current || current.rank !== 2) open(2, "", "plain");
        line(detachLine(names.card(step.enemyId), names.card(step.locationId)), null, [step.enemyId]);
        return;
      case "engage": {
        if (joined.has(index)) return;
        open(4, `${names.card(step.enemyId)} engages`, "bad");
        line(after.seatCount > 1 ? `${names.card(step.enemyId)} engages Player ${step.seat + 1}` : `${names.card(step.enemyId)} engages you`);
        const count = boarded.get(index);
        // The ship's ring follows this beat.
        if (count) line(boardingWords({ ship: names.card(step.enemyId), count, seat: step.seat, seats: after.seatCount }), null, [step.enemyId]);
        return;
      }
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

  // Travel leaves no step of its own: the location that became active from staging. Once stages are separate each seat has an active location of its
  // own (`Seat.active`), and in two-handed play the line names the seat that traveled.
  if (after.separate === true && before.separate === true) {
    for (let seat = 0; seat < after.seatCount; seat += 1) {
      const arrived = after.seats[seat]?.active;
      if (!arrived || arrived === before.seats[seat]?.active || !before.staging.includes(arrived)) continue;
      const who = after.seatCount > 1 ? `Player ${seat + 1} traveled` : "Traveled";
      groups.push({ rank: 1, title: `${who} to ${names.card(arrived)}`, tone: "plain", lines: [{ text: "It is the active location now", mark: null }] });
    }
    // An enemy sent to another seat's staging area out of an engagement area (Growing Threat's choice, its Shadow effect): where it went.
    for (let seat = 0; seat < after.seatCount; seat += 1) {
      for (const id of after.seats[seat]?.staging ?? []) {
        const was = before.cards[id];
        if (was?.zone !== "engaged" || was.controller == null || was.controller === seat) continue;
        groups.push({ rank: 5, title: `${names.card(id)} leaves Player ${was.controller + 1}`, tone: "plain", lines: [{ text: after.seatCount > 1 ? `It is in Player ${seat + 1}'s staging area now` : "It is in the staging area now", mark: null }] });
      }
    }
  } else if (after.activeLocation && after.activeLocation !== before.activeLocation && after.activeLocation !== before.secondActiveLocation && before.staging.includes(after.activeLocation)) {
    groups.push({ rank: 1, title: `Traveled to ${names.card(after.activeLocation)}`, tone: "plain", lines: [{ text: "It is the active location now", mark: null }] });
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

/** The player's choice in words, for the banner after Undo ("Frodo Baggins committed to the quest"). `before` is the state the intent was sent in: a Commit sent while the first player was asked what to commit to a Sailing test is the test's. */
export function intentWords(intent: PlayerIntent, card: (cardId: string) => string, before?: ScenarioState): string {
  switch (intent.type) {
    case "Pass":
      return "Passed";
    case "PlayCard":
      return intent.hostId ? `Played ${card(intent.cardId)} on ${card(intent.hostId)}` : `Played ${card(intent.cardId)}`;
    case "Commit":
      return `${listed(intent.cardIds, card)} committed to the ${before && askingToCommit(before) ? "Sailing test" : "quest"}`;
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

/** The steps of a reduce that belong to the round it finished: up to and including the refresh's threat (rr.step-7-3). */
export function finishedRoundSteps(steps: readonly EngineStep[]): readonly EngineStep[] {
  let cut = -1;
  steps.forEach((step, index) => {
    if (step.kind === "threat" && "rule" in step.cause && step.cause.rule === "rr.step-7-3") cut = index;
  });
  return cut < 0 ? steps : steps.slice(0, cut + 1);
}

/**
 * The round in a few lines, for the banner when it ends: each seat's threat from the start of the round to its end, the
 * progress placed, the damage players' cards took and enemies took, the enemies defeated and the cards drawn. Every number is
 * a sum of the engine's own steps. `after` is the state the round ended in.
 */
export function roundSummary(round: number, steps: readonly EngineStep[], after: ScenarioState, isPlayerCard: (cardId: string) => boolean): Moment | null {
  if (steps.length === 0) return null;
  const lines: MomentLine[] = [];
  for (let seat = 0; seat < after.seatCount; seat += 1) {
    const raised = steps.reduce((sum, step) => sum + (step.kind === "threat" && step.seat === seat ? step.amount : 0), 0);
    const end = after.seats[seat]?.threat ?? 0;
    if (raised !== 0) lines.push({ text: `${seatWord(after, seat)} ${end - raised} → ${end}`, mark: "threat" });
  }
  const progress = steps.reduce((sum, step) => sum + (step.kind === "progress" && step.amount > 0 ? step.amount : 0), 0);
  if (progress > 0) lines.push({ text: `${progress} progress placed`, mark: "progress" });
  const taken = steps.reduce((sum, step) => sum + (step.kind === "damage" && step.amount > 0 && isPlayerCard(step.targetId) ? step.amount : 0), 0);
  const dealt = steps.reduce((sum, step) => sum + (step.kind === "damage" && step.amount > 0 && !isPlayerCard(step.targetId) ? step.amount : 0), 0);
  if (taken > 0 || dealt > 0) lines.push({ text: `${taken} damage taken, ${dealt} dealt`, mark: "damage" });
  const defeated = steps.filter((step) => step.kind === "destroy" && !isPlayerCard(step.targetId)).length;
  if (defeated > 0) lines.push({ text: `${defeated} encounter ${defeated === 1 ? "card" : "cards"} defeated or explored`, mark: null });
  const drawn = steps.filter((step) => step.kind === "draw").length;
  if (drawn > 0) lines.push({ text: `${drawn} ${drawn === 1 ? "card" : "cards"} drawn`, mark: null });
  return { title: `Round ${round} ends`, tone: "plain", lines };
}
