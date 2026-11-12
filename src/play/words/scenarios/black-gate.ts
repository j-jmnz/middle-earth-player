// Rules: mec113.saga-staging-rules, rr.first-player (data/rules/entries.json); ledger lines 146041:A:2, 146072:B:1.
// The words of The Black Gate Opens' own branches of a Choose: Gwaihir's control, and the Embassy's pair. The rest of the scenario's words are in its asks file (src/play/words/asks/the-black-gate-opens.ts). Pure.
import type { Instruction } from "../../../catalog/boundary.ts";

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
