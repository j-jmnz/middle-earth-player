// Rules: mec112.campaign-mode-aragorn, mec113.campaign-mode, rr.campaign-cards, rr.fellowship-of-heroes (data/rules/entries.json).
//
// What the resolution screen shows for The Two Towers' own choices (src/catalog/families/campaign.ts): the options of a ChooseOption in words, the fallen hero a boon brings back (one tile for each
// player and hero), the hero a player removes from the Campaign Log, and the notes of the settled view (the threat penalty each player took, the hero who returned, the heroes removed, the enemies
// under The Black Gate, and The Return of the King's notes). The options are the ChooseResolution intents the reducer lists; this module only gives them words.
import type { Instruction } from "../catalog/boundary.ts";
import type { ResolutionLog } from "../rules/core/campaign-state.ts";
import type { ScenarioState } from "../rules/engine/reduce.ts";
import { andList } from "./carry-words.ts";
import { SEARCHING_EYE } from "./two-towers-view.ts";

const YOU = "You";

type TwoTowersChoice = Extract<Instruction, { verb: "ChooseOption" | "ReviveFallenHero" | "TrimHeroes" }>;

/** Whether the Resolution instruction is one of The Two Towers' own choices. */
export function isTwoTowersChoice(instruction: Instruction | undefined): instruction is TwoTowersChoice {
  return instruction?.verb === "ChooseOption" || instruction?.verb === "ReviveFallenHero" || instruction?.verb === "TrimHeroes";
}

// The words of an option, by the instruction's name and the option's id: the label on the tile and the sentence above Confirm.
// `says` is told for the seat that answers (`who`: "You", or "Player 2"); `code` is the card an option is about, so its tile shows the card.
const OPTIONS: Readonly<Record<string, { label: string; says: (who: string) => string; code?: string }>> = {
  "uruk:boons": { label: "Each player earns a Skill boon", says: () => "Each player earns one of the Skill boons and attaches it to a hero they control." },
  "uruk:hope": { label: "One player earns Beyond All Hope", says: () => "One player earns Beyond All Hope, takes control of a fallen hero and attaches the boon to it." },
  "marshes:penalty": { label: "Take a permanent +2 starting threat penalty", says: (who) => `${who} ${who === YOU ? "take" : "takes"} a permanent +2 starting threat penalty, recorded in the campaign log.` },
  // Mount Doom's Resolution (146079:B:1): the first player keeps The One Ring or destroys it.
  "ring:keep": { label: "Keep The One Ring and succumb to the power of Sauron", says: () => "The One Ring is kept and the power of Sauron wins: the players lose the campaign." },
  "ring:destroy": { label: "Destroy The One Ring and defeat the power of Sauron", says: () => "The One Ring is destroyed and the power of Sauron is defeated: the players win the campaign." },
  "marshes:searchingEye": { label: "Earn 1 copy of The Searching Eye", says: (who) => `${who} ${who === YOU ? "earn" : "earns"} 1 copy of The Searching Eye, recorded in the campaign log.`, code: SEARCHING_EYE },
};

/** The fields of the choosing view for one of these instructions (the caller adds the step, the seat and the answers already given). */
export type TwoTowersView = {
  eyebrow: string;
  noun: string;
  prompt: string;
  tiles: readonly { optionId: string; code: string | null; name: string; hero: string | null; label: string; says: string; wide?: true }[];
  firstPlayerAnswers: boolean;
  eachSeat: boolean;
};

const seatWords = (state: ScenarioState, seat: number): string => (state.seatCount > 1 ? `Player ${seat + 1}` : YOU);

/** The words of a two-towers choice: `optionIds` are the intents the reducer lists, `name` turns a card code into its title. */
export function twoTowersChoosing(state: ScenarioState, instruction: TwoTowersChoice, seat: number, optionIds: readonly string[], name: (code: string) => string): TwoTowersView {
  if (instruction.verb === "ChooseOption") {
    return {
      eyebrow: state.seatCount > 1 ? "The players choose" : "You choose",
      noun: "option",
      prompt: instruction.who === "eachSeat" || state.seatCount === 1 ? "Choose one option. Your choice is written to the campaign log when you confirm." : "The players choose one option; the first player confirms.",
      tiles: optionIds.map((id) => {
        const words = OPTIONS[`${instruction.name}:${id}`] ?? { label: id, says: () => id };
        return { optionId: id, code: words.code ?? null, name: words.label, hero: null, label: words.label, says: words.says(seatWords(state, seat)), wide: true as const };
      }),
      firstPlayerAnswers: instruction.who === "firstPlayer",
      eachSeat: instruction.who === "eachSeat",
    };
  }
  if (instruction.verb === "ReviveFallenHero") {
    const boon = name(instruction.code);
    return {
      eyebrow: "A fallen hero returns",
      noun: "hero",
      prompt: `${state.seatCount > 1 ? "Choose a fallen hero, and the player who takes control of it." : "Choose a fallen hero."} ${boon} is attached to it and the hero leaves the list of fallen heroes.`,
      tiles: optionIds.map((id) => {
        const [seatText = "", hero = ""] = id.split(":");
        const who = seatWords(state, Number(seatText));
        const title = name(hero);
        return { optionId: id, code: hero, name: title, hero: null, label: state.seatCount > 1 ? `${title} for ${who}` : title, says: `${who === YOU ? "You take" : `${who} takes`} control of ${title}, who leaves the list of fallen heroes. ${boon} is attached to ${title}. Changing heroes this way costs no +1 threat penalty.` };
      }),
      firstPlayerAnswers: true,
      eachSeat: false,
    };
  }
  const who = seatWords(state, seat);
  return {
    eyebrow: "Remove a hero from the campaign log",
    noun: "hero",
    prompt: `${who === YOU ? "You control" : `${who} controls`} more than ${instruction.limit} non-Fellowship heroes. Choose a hero to remove from the campaign log.`,
    tiles: optionIds.map((hero) => ({ optionId: hero, code: hero, name: name(hero), hero: null, label: name(hero), says: `${name(hero)} is removed from the campaign log.` })),
    firstPlayerAnswers: false,
    eachSeat: true,
  };
}

/** What seat `seat` already answered to a ChooseOption, in words ("Take a permanent +2 starting threat penalty"). */
export function pickWords(log: ResolutionLog, instruction: Extract<Instruction, { verb: "ChooseOption" }>, seat: number): string {
  const pick = (log.picks ?? []).find((item) => item.name === instruction.name && item.seat === seat);
  return pick ? (OPTIONS[`${instruction.name}:${pick.option}`]?.label ?? pick.option) : "No answer";
}

/** The sentences the settled view adds about The Two Towers' record: the picks, the penalty each player took, the hero who returned, the heroes removed and the enemies under The Black Gate. */
export function twoTowersNotes(log: ResolutionLog, seatCount: number, name: (code: string) => string): readonly string[] {
  const who = (seat: number): string => (seatCount > 1 ? `Player ${seat + 1}` : YOU);
  const notes: string[] = [];
  for (const penalty of log.threatPenalties ?? []) notes.push(`${who(penalty.seat)} ${seatCount === 1 ? "take" : "takes"} a permanent +${penalty.amount} starting threat penalty.`);
  for (const item of log.revived ?? []) notes.push(`${name(item.hero)} leaves the list of fallen heroes and joins ${seatCount > 1 ? `Player ${item.seat + 1}'s` : "your"} heroes, with no +1 threat penalty.`);
  for (const item of log.removedHeroes ?? []) notes.push(`${name(item.hero)} is removed from the campaign log.`);
  if (log.recorded?.corsairFleet != null) notes.push(`${log.recorded.corsairFleet} ${log.recorded.corsairFleet === 1 ? "resource" : "resources"} on The Corsair Fleet, recorded in the notes section of the campaign log.`);
  if (log.recorded?.blackGateTokens != null) notes.push(`${log.recorded.blackGateTokens} ${log.recorded.blackGateTokens === 1 ? "resource token" : "resource tokens"} on The Black Gate, recorded in the notes section of the campaign log.`);
  if (log.discardedNotFallen) notes.push("A hero in its controller's discard pile is not added to the list of fallen heroes.");
  if (log.campaignEnd) notes.push(log.campaignEnd === "won" ? "The One Ring is destroyed. The players win the campaign." : "The One Ring is kept. The players lose the campaign.");
  const gate = Object.entries(log.underneath ?? {});
  if (gate.length > 0) notes.push(`Under The Black Gate: ${andList(gate.map(([code, count]) => `${count} \u00d7 ${name(code)}`))}, recorded in the campaign log.`);
  return notes;
}
