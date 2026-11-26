// Rules: hrd.orcs-area, hrd.orcs-area-different-stage, hrd.orcs-area-same-stage (data/rules/entries.json); ledger lines 17047:A:1, 17052:B:3, 17053:B:3, 17054:B:3. What the table says of the Orcs' area of Race Across Harad: the
// Orcs' current quest stage and its progress, where each card of the area stands against the players' stage, and what "the same stage" switches. The numbers are the engine's. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { StageFacts } from "../stormcaller.ts";

/** The preview sentence of a card in the Orcs' area while the players are at another stage: it is no staging card, so it adds no Threat, cannot be engaged or traveled to, and is immune to player card effects. */
export const ORCS_APART = "In the Orcs' area: not in the staging area, immune to player card effects";
/** The preview sentence of a card of the area while the players are at the Orcs' stage: it is a staging card. */
export const ORCS_TOGETHER = "In the Orcs' area, at the Orcs' stage: in the staging area";
/** The title of the row list a fold stack opens when only the area's group folded, and the reader phrase of that fold stack. */
export const ORCS_LIST_TITLE = "Orcs' area";
export const ORCS_FOLD_WHERE = "the Orcs' area";
/** The words of the stage when the Orcs fill their last stage: the players lose (17054:B:3). */
export const ORCS_STAGE_LOSS = "When this stage is full the players lose: the Orcs have caught them";
/** What the same stage switches, said on the stage's preview (hrd.orcs-area-same-stage). */
export const ORCS_SAME_STAGE =
  "At the same stage the cards of the area are in the staging area: they add their Threat, can be engaged or traveled to, and are open to player card effects. At another stage they are out of reach and immune";

const progressOf = (facts: Pick<StageFacts, "progress" | "points">): string => (facts.points == null ? `${facts.progress}` : `${facts.progress}/${facts.points}`);

/** The Orcs' stage named by its numbers: "Orcs · stage 2 of 4 · 5/12". The label of the stage for a screen reader. */
export const orcsStageTitle = (facts: StageFacts): string => `Orcs · stage ${facts.number} of ${facts.last} · ${progressOf(facts)}`;

/** The preview lines of the Orcs' current stage: where it stands against the players' stage, what the same stage switches, and when filling it loses the game (the last stage always; stages 2 and 3 when the players are at their stage). */
export function orcsStageLines(facts: StageFacts): string[] {
  const reach = facts.together ? "the players are at its stage: its cards are in the staging area" : `the players are at stage ${facts.playersAt}: its cards are out of reach`;
  const line = `The Orcs' stage ${facts.number} of ${facts.last} · ${progressOf(facts)} · ${reach}`;
  const loss =
    facts.number >= facts.last
      ? ORCS_STAGE_LOSS
      : facts.number >= 2
        ? `When this stage is full the players lose if they are at stage ${facts.number}; at another stage the Orcs advance`
        : "When this stage is full the Orcs advance";
  return [line, ORCS_SAME_STAGE, loss];
}

/** What a screen reader hears of the Orcs' stage: its numbers, its name, the cards of the area and whether they can be reached. */
export function orcsStageSpeech(facts: StageFacts & { name: string; names: readonly string[] }): string {
  const cards = facts.names.length === 0 ? "No cards in the area" : `In the area: ${facts.names.join(", ")}`;
  const reach = facts.together ? "Reachable: the players are at the same stage, so its cards are in the staging area" : "Out of reach: the players are at another stage, so its cards are immune and not in the staging area";
  return `${orcsStageTitle(facts)}, ${facts.name}. ${cards}. ${reach}`;
}

/** What a screen reader hears of a card of the area. */
export const orcsMemberSpeech = (name: string, role: "apart" | "together"): string => `${name}, ${role === "apart" ? "in the Orcs' area, out of reach" : "in the Orcs' area, reachable in the staging area"}`;

/** The word a card of the area wears on a list that does not draw it. */
export function orcsTell(role: "stage" | "apart" | "together", stage?: StageFacts | null): string {
  if (role === "stage") return stage ? orcsStageTitle(stage) : "the Orcs' quest stage";
  return role === "apart" ? "in the Orcs' area, out of reach" : "in the Orcs' area, in the staging area";
}

/** The banner beat of the Orcs' advance, and what each progress places. */
export const ORCS_ADVANCE_TITLE = "The Orcs advance";
export const orcsAdvanceLine = (number: number, last: number, name: string): string => `The Orcs advance to stage ${number} of ${last}: ${name}`;

/** One instruction of Race Across Harad's Orcs' area or Tamed Mûmak in words (a choice branch, the log), or null for any other verb. */
export function orcsVerbWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "PrepareOrcsArea":
      return "prepare the Orcs' area: a second quest deck of the Orcs' stages, and the Uruk Chieftain in it";
    case "MoveToOrcsArea":
      return instruction.target === "picked" || instruction.code != null ? "add it to the Orcs' area" : "add this card to the Orcs' area";
    case "OrcsProgress":
      return instruction.engaged === true
        ? "discard the top card of the encounter deck. The Orcs place progress on their stage equal to its Threat plus the Threat of each engaged enemy"
        : "discard the top card of the encounter deck. The Orcs place progress on their stage equal to its Threat plus the Threat in the Orcs' area";
    case "AddOrcsProgress":
      return `place ${typeof instruction.amount === "number" ? instruction.amount : "X"} progress on the Orcs' stage`;
    case "TakeObjectiveAlly":
      return "take control of a Tamed Mûmak";
    case "EliminateAfterAttack":
      return "eliminate this player when the attack has resolved";
    default:
      return null;
  }
}

/** The preview of a Tamed Mûmak in play (17038:A:1 to A:3): whose it is, that it takes every undefended attack, and the elimination when it leaves play. `who` is "you" when one player plays, else "Player N". */
export const mumakWords = (who: string): string =>
  `${who === "you" ? "Your" : `${who}'s`} Tamed Mûmak, an objective ally immune to player card effects. All damage of an undefended attack on ${who} goes to it, past its hit points. If it leaves play, ${who === "you" ? "you are" : `${who} is`} eliminated from the game.`;
