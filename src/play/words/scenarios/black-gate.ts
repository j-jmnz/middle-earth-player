// Rules: mec113.saga-staging-rules, mec113.dire, rr.first-player (data/rules/entries.json); ledger lines 146024:A:3, 146029:A:1, 146029:A:2, 146041:A:2, 146073:B:1, 146072:B:1, 146074:B:1.
// The words of The Black Gate Opens' own branches of a Choose (Gwaihir's control, the Embassy's pair) and of its table pieces (readouts/black-gate.ts): the resources on The Black Gate, the enemies under Reeking Moat, the Embassy's row, the seat that controls Gwaihir.
// The rest of the scenario's words are in its asks file (src/play/words/asks/the-black-gate-opens.ts). Pure.
import type { Instruction } from "../../../catalog/boundary.ts";

import { plural } from "../list.ts";

/** One instruction of the scenario's own verbs in words, as a branch of a Choose says it, or null when it is not one of them. */
export function blackGateWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "TakeControl":
      return "take control of the revealed card";
    case "EmbassyDiscard":
      return "discard both cards of the pair";
    case "EmbassyReveal":
      return "reveal the encounter card of the pair";
    default:
      return null;
  }
}

/**
 * What the dial of the resources on The Black Gate says: it gains one each quest phase (146024:A:3); on stage 2B the first player reveals that many encounter cards in each staging step and Jaws of Steel deals that much damage (146073:B:1, 146038:A:1); at the
 * end of the scenario the count is recorded for Mount Doom (146074:B:1). `second`: the main quest is stage 2.
 */
export const gateWords = (tokens: number, second: boolean): string =>
  `${plural(tokens, "resource", "resources")} on The Black Gate, one more each quest phase. ${second ? `The first player reveals ${plural(tokens, "encounter card", "encounter cards")} in each staging step, and Jaws of Steel deals ${tokens} damage` : "From stage 2B the first player reveals that many encounter cards in each staging step"}. When the scenario ends the count is recorded for Mount Doom`;

/** The dial of the enemies lying under Reeking Moat: they engage the first player when it leaves play (146029:A:1, A:2). */
export const moatWords = (names: readonly string[]): string => `${names.join(", ")} ${names.length === 1 ? "lies" : "lie"} facedown under Reeking Moat, out of play. When it leaves play ${names.length === 1 ? "it engages" : "they engage"} the first player`;

/** One pair of the Embassy's row, the player card with its owner and the encounter card it is paired with: "Player 1's Gandalf with Hill-troll" (solo: "your Gandalf with Hill-troll"). */
export const pairWords = (owner: string | null, player: string, encounter: string): string => `${owner == null ? "" : `${owner} `}${player} with ${encounter}`;

/** What the Embassy dial says: how many pairs are left and each pair, in the order the first player decides them (146072:B:1). */
export const embassyWords = (left: number, pairs: readonly string[]): string => `${plural(left, "pair", "pairs")} left to decide. The first player discards both cards of a pair, or reveals the encounter card and plays the player card at no cost. ${pairs.length > 0 ? `${pairs.join("; ")}` : "No pairs are made yet"}`;

/** The mark of the seat that controls Gwaihir ("Gwaihir", "P1 · Gwaihir" two-handed): he joins the campaign pool only if the first player controls him when the scenario ends (146041:A:2, 146074:B:1). */
export const gwaihirLabel = (seat: number | null): string => (seat == null ? "Gwaihir" : `P${seat + 1} · Gwaihir`);

/** Heard with the mark. */
export const gwaihirWords = (first: boolean): string => `Gwaihir is under this player's control. ${first ? "He joins the campaign pool if the first player still controls him when the scenario ends" : "He is earned only if the first player controls him when the scenario ends"}`;
