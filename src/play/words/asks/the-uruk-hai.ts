// Rules: rr.the-word-choose, rr.first-player, mec112.setup-the-uruk-hai, rr.player-elimination (data/rules/entries.json). The words of the choices of The Uruk-hai's own cards (ledger lines 143069:A:1, 143024:A:1, 143016:A:3, 143030:A:1, 143063:A:2), as data beside
// the records (src/play/words/asks.ts, docs/design-system-table.md, Choice tray): each sentence names its number, its side (the Captives are under To Isengard! or on Grishnákh) and whose choice it is. The other picks of the scenario read as the families word them.
import type { Ask } from "../asks.ts";

export const ASKS: Readonly<Record<string, Ask>> = {
  // Setup, a seat the Campaign Log names no Captive for (standalone, or a fresh log): any non-Fellowship hero the player controls. A hero the log names is taken without asking (user ruling R1, 2026-11-08).
  "143069:setup:1 @0.0 Pick": {
    why: [{ when: { kind: "campaign" }, text: "the Campaign Log names no Captive of yours." }, { text: "you choose your Captive." }],
    note: "Choose 1 non-Fellowship hero you control. It goes faceup under To Isengard!; its text box is blank and no one controls it.",
    owned: true,
    verb: "Capture",
  },
  // Grishnákh enters play: the first player picks 1 of the Captives under To Isengard! for him to hold (143024:A:1); the rows name whose hero each is, two-handed (sheet-parts.ts cardLabel).
  "143024:forced:1 @0 Pick": {
    why: "it entered play.",
    note: "Choose 1 Captive under To Isengard! to attach to {card}. The Captive takes 1 damage at the end of each quest phase.",
    verb: "Attach",
  },
  // Rest by Night? (143030:A:1): the damage branch hurts each committed character, not one card.
  "143030:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each character committed to the quest" },
  // Isengard Uruk (143063:A:2): the 3 damage is placed one at a time among the player's characters.
  "143063:whenRevealed:1 @0 damage": { label: "Assign 3 damage among your characters" },
  "143063:whenRevealed:1 @0.damage.0 AssignDamage": { note: "Assign 1 damage to a character you control ({step} of {of}).", verb: "Assign", owned: true },
  // Hands of a Healer (143016:A:3): any hero in play, a Captive included (user ruling R3, 2026-11-08).
  "143016:action:1 @0 Pick": {
    note: "choose a hero in play to heal up to 3 damage, a Captive included.",
    owned: true,
    verb: "Heal",
  },
};
