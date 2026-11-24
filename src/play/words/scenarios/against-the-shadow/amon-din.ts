// Rules: ats.villagers, ats.villager-tokens-discarded, rr.cannot, rr.winning-the-game (data/rules/entries.json); ledger lines 06066:B:1, 06066:B:2, 06066:B:3, 06067:B:1, 06067:B:2, 06068:A:2, 06069:A:1, 06069:A:2, 06070:A:3, 06071:A:1, 06071:A:3.
// The words of Encounter at Amon Dîn's table pieces. A villager token is a resource token on a card that is no hero (ats.villagers), and it is never said as a resource, progress or damage: it is placed, moved or discarded. The damage tokens on Dead Villagers are damage tokens. Pure.
import type { Instruction } from "../../../../catalog/boundary.ts";
import { plural } from "../../list.ts";

/** "1 villager token", "4 villager tokens". */
export const villagerTokens = (count: number): string => plural(count, "villager token");

/** The preview of Rescued Villagers: the tokens it holds and what they win. */
export const rescuedWords = (dead: number): string => `At the end of the game the players win with more villager tokens here than damage tokens on Dead Villagers (${dead} now). A tie loses.`;

/** The preview of Dead Villagers: the damage tokens it holds and what they lose. */
export const deadWords = (rescued: number): string => `Each villager token discarded puts 1 damage token here, and none comes off. At the end of the game the players lose with as many or more damage tokens here than villager tokens on Rescued Villagers (${rescued} now). A tie loses.`;

/** The top-bar dial of Rescued Villagers: its name for a screen reader and the words a tap on it reads. */
export const rescuedDialName = "Villager tokens on Rescued Villagers:";
export const rescuedDialWords = (rescued: number, dead: number): string => `${villagerTokens(rescued)} on Rescued Villagers, against ${plural(dead, "damage token")} on Dead Villagers. The players win at the end of the game with more villager tokens than damage tokens. A tie loses.`;

/** The top-bar dial of Dead Villagers. */
export const deadDialName = "Damage tokens on Dead Villagers:";
export const deadDialWords = (dead: number, rescued: number): string => `${plural(dead, "damage token")} on Dead Villagers, against ${villagerTokens(rescued)} on Rescued Villagers. Each villager token discarded adds 1, and none comes off. The players lose at the end of the game with as many or more damage tokens than villager tokens. A tie loses.`;

/** The line stage 1B adds to its preview: its tokens and what progress does to them (06066:B:2, 06066:B:3). */
export const savageryWords = (): string =>
  "Progress is not placed on this stage: each point moves 1 villager token from here to Rescued Villagers, and progress beyond the tokens it holds is lost. The stage advances when its last token leaves.";

/** The line stage 2B adds to its preview: where an undefended attack's damage goes (06067:B:1). */
export const protectWords = "An undefended attack discards 1 villager token from Rescued Villagers for each point of damage, and no hero is damaged. Each token discarded puts 1 damage token on Dead Villagers.";

/** What stage 2B says of the end: the comparison that decides it (06068:A:2, 06069:A:2). */
export const endWords = (rescued: number, dead: number): string =>
  `At the end of the game: ${rescued > dead ? "the players win" : "the players lose"} if nothing changes (${villagerTokens(rescued)} on Rescued Villagers, ${plural(dead, "damage token")} on Dead Villagers; a tie loses).`;

/** The stage is defeated while Ghulat is in play: the game goes on (06067:B:2, 06071:A:3). */
export const heldWords = (rescued: number, dead: number, alcaronGone: boolean): string =>
  `This stage is defeated, but the game cannot end while Ghulat is in play. It goes on until he leaves play. Then ${alcaronGone ? "the players lose: Lord Alcaron left play" : rescued > dead ? `the players win: ${villagerTokens(rescued)} on Rescued Villagers against ${plural(dead, "damage token")} on Dead Villagers` : `the players lose: ${villagerTokens(rescued)} on Rescued Villagers against ${plural(dead, "damage token")} on Dead Villagers, and a tie loses`}.`;

/** Lord Alcaron left play while Ghulat is in play: the loss waits for Ghulat (06070:A:3, 06071:A:3). */
export const alcaronLeftWords = "Lord Alcaron left play. The players lose once Ghulat leaves play, because the game cannot end while he is in play.";

/** The banner's title for the villager tokens that moved or were discarded. */
export const VILLAGERS_TITLE = "Villager tokens";

/** The banner's title when the defeat is held. */
export const heldTitle = "The game goes on";

/** Lord Alcaron's preview: whose he is and what his leaving does (06070:A:1, 06070:A:3). */
export const alcaronWords = (owner: string | null, ghulatIn: boolean): string =>
  `Objective ally${owner ? ` under ${owner} control` : ""}. If he leaves play, the players lose the game${ghulatIn ? ", once Ghulat has left play" : ""}.`;

/** The dock's warning for a move that would take Lord Alcaron out of play while Ghulat is in play (the loss waits). */
export const alcaronHeldWords = (name: string): string => `${name} leaves play: the players lose once Ghulat leaves play`;

/** Ghulat's preview: what his Attack X counts now and what his presence holds (06071:A:1, 06071:A:3). */
export const ghulatWords = (dead: number): string => `Attack X: X is the number of damage tokens on Dead Villagers (${dead} now). While Ghulat is in play the game cannot end.`;

/** The Undefended line of an enemy's attack sheet while stage 2B aims it at Rescued Villagers (06067:B:1). */
export const undefendedVillagersWords = (held: number): string =>
  held > 0
    ? `Undefended: no hero takes it. Each point of damage discards 1 villager token from Rescued Villagers (it holds ${held}), and each token discarded puts 1 damage token on Dead Villagers.`
    : "Undefended: no hero takes it. Rescued Villagers holds no villager token, so none is discarded.";

/** The dock readout of an undefended attack on Rescued Villagers: the tokens discarded. */
export const undefendedVillagersResult = (discarded: number, shadowNext: boolean): string =>
  `Undefended: ${discarded > 0 ? `${villagerTokens(discarded)} discarded from Rescued Villagers, each a damage token on Dead Villagers` : "no villager token to discard"}${shadowNext ? ", shadow card next" : ""}`;

/** The quest readout while stage 1B replaces progress: the tokens that move and the surplus that is lost. */
export function movesWords(progress: number, held: number, location?: { name: string; share: number }): string {
  const moved = Math.min(progress, held);
  const surplus = progress - moved;
  return `${location && location.share > 0 ? `${location.share} progress on ${location.name}; ` : ""}${location && location.share > 0 ? "n" : "N"}o progress is placed on the quest: ${villagerTokens(moved)} move to Rescued Villagers${moved >= held ? "; the last token leaves and the stage advances" : ""}${surplus > 0 ? `; the other ${surplus} progress ${surplus === 1 ? "is" : "are"} lost` : ""}`;
}

/** The banner's line for a card whose tokens changed. */
export const changedWords = (name: string, was: number, now: number): string => `${name}: ${was} → ${villagerTokens(now)}`;
export const deadChangedWords = (name: string, was: number, now: number): string => `${name}: ${was} → ${plural(now, "damage token")}`;

const holderWords = (ref: string | { code: string }): string => {
  if (typeof ref === "object") return ref.code === "06068" ? "Rescued Villagers" : "that card";
  return ref === "self" ? "this card" : ref === "activeLocation" ? "the active location" : ref === "picked" ? "the card you chose" : "that card";
};

/** The verbs of Encounter at Amon Dîn in a sentence of a choice or a response: a villager token is discarded or moved, a character with the fewest hit points is picked. Null for any other verb. */
export function villagerWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "DiscardVillagerTokens":
      return `discard ${typeof instruction.amount === "number" ? villagerTokens(instruction.amount) : "villager tokens"} from ${holderWords(instruction.from)}`;
    case "MoveVillagerTokens":
      return `move ${instruction.all === true ? "all villager tokens" : typeof instruction.amount === "number" ? villagerTokens(instruction.amount) : "villager tokens"} from ${holderWords(instruction.from)} to ${holderWords(instruction.to)}`;
    case "PickFewestHitPointsLeft":
      return "choose the character with the fewest remaining hit points";
    default:
      return null;
  }
}

/** The banner's line after an undefended attack on Rescued Villagers (06067:B:1), in place of "No damage". */
export const NO_HERO_DAMAGE = "No hero takes damage";
