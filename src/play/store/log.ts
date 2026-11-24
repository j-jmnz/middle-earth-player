// The table's log: this round's engine steps in words, each with its cause from phase 8d (the rule title, or the card and
// its printed line), so a player can check a number against its source. It is text, not a control.
import { plural } from "../words/list.ts";
import { reshuffleWords } from "./pile-ids.ts";
import { escapeCountedWords, escapeResultTitle } from "../words/scenarios/escape.ts";
import { detachLine, grappleLine } from "../words/scenarios/grapple.ts";
import { discoverLogLine, setAsideLine } from "../words/scenarios/wilderland.ts";
import { poisonLine, unconsciousLine } from "../words/scenarios/the-hobbit/poison.ts";
import type { Cause } from "../../rules/core/cause.ts";
import type { EngineStep } from "../../rules/core/intents.ts";

export type LogNames = {
  // A card instance by id.
  card: (cardId: string) => string;
  // A card code (the card an effect record belongs to).
  code: (code: string) => string;
  // The picture key of the card an effect record belongs to (`causeKey`): its code, or the Lost Island key for a line of the Lost Island side.
  effectCard: (effectId: string, lineId: string) => string | null;
  rule: (ruleId: string) => string | null;
  line: (lineId: string) => string | null;
};

// The mark beside a log line: a game icon (threat, willpower), or a token coin for damage, progress and a resource (no
// high-resolution source of those tokens exists; docs/design-system.md, Icons).
export type LogMark = "threat" | "willpower" | "attack" | "defense" | "damage" | "progress" | "resource" | null;

/** The stat the quest counted at a quest step, given the stage the quest advanced to right after it (null: it did not advance in the round's steps). */
export type QuestStatAt = (advancedTo: string | null) => "willpower" | "attack" | "defense";

export type LogLine = { key: string; text: string; cause: string | null; mark: LogMark };

/** What a screen reader hears of a log line, as one element: the step, then its cause ("3 damage on Aragorn. Enemy attack, rr.step-6-4-3"). */
export function logLineSpeech(line: Pick<LogLine, "text" | "cause">): string {
  return line.cause ? `${line.text}. ${line.cause}` : line.text;
}

function markOf(step: EngineStep, stat: LogMark = null): LogMark {
  switch (step.kind) {
    case "threat":
      return "threat";
    case "hideTest":
    case "fortitudeTest":
      return "willpower";
    // The quest's mark is the stat the stage counted (Attack under Battle, Defense under Siege).
    case "quest":
      return stat ?? "willpower";
    case "escapeTest":
      return step.stat ?? "willpower";
    case "strike":
      return "attack";
    case "damage":
      return "damage";
    case "progress":
      return "progress";
    case "gainResource":
      return "resource";
    // Life lost wears the damage token: no icon of its own exists (docs/design-system.md, Icons).
    case "life":
      return "damage";
    default:
      return null;
  }
}

function player(seat: number): string {
  return `Player ${seat + 1}`;
}

function signed(amount: number): string {
  return amount >= 0 ? `+${amount}` : String(amount);
}

/** The picture key a cause names its card by: a line of the B side of a double-sided location is the Lost Island side's, which never says which location it is (dcce.uncharted). */
export function causeKey(code: string, lineId: string, uncharted: boolean): string {
  return uncharted && lineId.split(":")[1] === "B" ? `${code}.B` : code;
}

/** The cause of a step in words: "Rule: <title>", or "<card>: <printed line>". */
export function causeText(cause: Cause, names: LogNames): string {
  if ("rule" in cause) return `Rule: ${names.rule(cause.rule) ?? cause.rule}`;
  const code = names.effectCard(cause.effect, cause.line);
  const card = code ? names.code(code) : cause.effect;
  const line = names.line(cause.line);
  return line ? `${card}: ${line}` : card;
}

function words(step: EngineStep, names: LogNames, questStat: string): string | null {
  switch (step.kind) {
    case "push":
    case "pop":
      return null;
    case "draw":
      return `${player(step.seat)} draws a card`;
    case "gainResource":
      return `${names.card(step.heroId)} gains 1 resource`;
    case "damage":
      // A heal is a damage step with a negative amount (rr.damage).
      return step.amount < 0 ? `${-step.amount} damage healed on ${names.card(step.targetId)}` : `${step.amount} damage on ${names.card(step.targetId)}`;
    case "threat":
      return `${player(step.seat)} threat ${signed(step.amount)}`;
    case "life":
      return `The Ring-bearer's life ${signed(step.amount)}`;
    case "progress":
      // A removal (141026:B:2) is a step with a negative amount: say what left the card, never a minus sign.
      return step.amount < 0 ? `${-step.amount} progress removed from ${names.card(step.targetId)}` : `${step.amount} progress on ${names.card(step.targetId)}`;
    case "destroy":
      // A location placed facedown underneath The Havens Burn is out of play and hidden: the line never names it (dcce.aflame).
      return step.under ? "A location burns and is placed facedown underneath The Havens Burn" : `${names.card(step.targetId)} is destroyed`;
    case "eliminate":
      return `${player(step.seat)} is eliminated`;
    case "reveal":
      return `${player(step.seat)} reveals ${names.card(step.cardId)}`;
    case "engage":
      return `${names.card(step.enemyId)} engages ${player(step.seat)}`;
    case "commit":
      return `${names.card(step.cardId)} commits to the quest`;
    case "hideCommit":
      return `${names.card(step.cardId)} commits to the Hide test`;
    case "fortitudeCommit":
      return `${names.card(step.cardId)} commits to the Fortitude test`;
    case "escapeCommit":
      return `${names.card(step.cardId)} commits to the escape test`;
    case "escapeTest":
      return `${escapeResultTitle(step.success, step.seat, true)}: ${escapeCountedWords(step.stat ?? "willpower", step.committed, step.escape)}`;
    case "locateTest":
      return `${step.success ? "Locate test passed" : "Locate test failed"}: ${plural(step.handIds.length, "card")} discarded from the hand, ${plural(step.dealtIds.length, "encounter card")} discarded`;
    case "burgle":
      return `${step.success ? "Burgle attempt succeeded" : "Burgle attempt failed"}: ${plural(step.dealtIds.length, "encounter card")} discarded, ${plural(step.discardedIds.length, "card")} discarded from the hand`;
    case "fortitudeTest":
      return `Fortitude test ${step.success ? "passed" : "failed"}: willpower ${step.willpower} against ${plural(step.eyes, "Sauron's Eye icon")}`;
    case "hideTest":
      return `Hide test ${step.success ? "passed" : "failed"}: willpower ${step.willpower} against threat ${step.threat}`;
    case "quest":
      return `Quest: ${questStat} ${step.willpower} against threat ${step.threat}`;
    case "strike":
      return step.undefended ? `Attack ${step.attack}, undefended, on ${names.card(step.targetId)}` : `Attack ${step.attack} against defense ${step.defense} on ${names.card(step.targetId)}`;
    case "advance":
      return step.stormcaller === true ? `The Stormcaller advances to ${names.card(step.cardId)}` : `The quest advances to ${names.card(step.cardId)}`;
    case "attack":
      return step.side === "enemy" ? `${names.card(step.enemyId)} attacks ${player(step.seat)}` : `${player(step.seat)} attacks ${names.card(step.enemyId)}`;
    case "cancel":
      return step.by ? `${names.card(step.by)}: ${names.card(step.cardId)} is canceled and discarded` : `${names.card(step.cardId)} is canceled`;
    // The enemy was faceup when it was revealed: the line names it and the location it is facedown under now (dcce.grapple).
    case "grapple":
      return grappleLine(names.card(step.enemyId), names.card(step.locationId));
    case "detach":
      return detachLine(names.card(step.enemyId), names.card(step.locationId));
    case "flip":
      return `${names.card(step.cardId)} flips to its objective side, and ${player(step.seat)} takes it`;
    case "removeSet":
      return step.count === 0 ? null : `${step.count} ${step.count === 1 ? "card" : "cards"} of ${step.set} ${step.count === 1 ? "leaves" : "leave"} the game`;
    case "shuffleSet":
      return step.count === 0 ? null : `${step.count} ${step.count === 1 ? "card" : "cards"} of ${step.set} ${step.count === 1 ? "is" : "are"} shuffled into the encounter deck`;
    case "setAsideForPool":
      return setAsideLine(names.card(step.sourceId), names.card(step.cardId));
    case "poison":
      return poisonLine(names.card(step.targetId), step.count, step.of);
    case "unconscious":
      return unconsciousLine(names.card(step.targetId), step.ready === true);
    case "resetEncounterDeck":
      return `The encounter discard pile (${step.count}) is shuffled into the encounter deck`;
    case "reshuffleDeck":
      return reshuffleWords(step.deck, step.count);
    case "discover":
      return discoverLogLine({ location: names.card(step.locationId), looked: step.looked.length, loot: step.loot ? names.card(step.loot) : null, hazard: step.hazard ? names.card(step.hazard) : null });
  }
}

/** The round's steps as log lines, oldest first. Frame pushes and pops are bookkeeping and are left out. */
export function logLines(steps: readonly EngineStep[], names: LogNames, questStat?: QuestStatAt): LogLine[] {
  const lines: LogLine[] = [];
  steps.forEach((step, index) => {
    // A quest step names the stat the stage counted: the stage that was current then, which is the one the quest advanced from when an advance follows in the round.
    const advanced = step.kind === "quest" ? steps.slice(index + 1).find((later) => later.kind === "advance" && later.stormcaller !== true) : undefined;
    const stat = step.kind === "quest" && questStat ? questStat(advanced?.kind === "advance" ? advanced.cardId : null) : null;
    const text = words(step, names, stat ?? "willpower");
    if (!text) return;
    lines.push({ key: `${index}`, text, cause: "cause" in step ? causeText(step.cause, names) : null, mark: markOf(step, stat) });
  });
  return lines;
}
