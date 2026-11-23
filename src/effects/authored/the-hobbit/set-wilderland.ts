import type { Condition, Effect, Instruction } from "../../../catalog/boundary.ts";

// Records for the Wilderland encounter set (132035 to 132038), which Flies and Spiders, The Lonely Mountain and The Battle of Five Armies all deal. Every line is read from the scan ledger (data/printed/the-hobbit.json). The readings are in docs/scenarios/the-hobbit.md (The Battle of Five Armies).
// Rules: rr.active-location, rr.travel, rr.attachment-cards, rr.forced, rr.neutral-cards, faq.lasting-effects, hob.baggins-sphere-otd, hob.bilbo-multiplayer-otd, rr.damage, rr.destroy (data/rules/entries.json).
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const ATTACHED: Condition = { kind: "sourceIn", zone: "attached" };
const SPHERES = ["leadership", "lore", "spirit", "tactics"] as const;

// "The first player names a sphere. Then, all non-Baggins characters who do not belong to the named sphere are removed from the quest." One of the four spheres is named (a neutral or Baggins sphere cannot be); a neutral character belongs to none, so it is removed (rr.neutral-cards).
const NAME_A_SPHERE: Instruction = {
  verb: "Choose",
  who: "firstPlayer",
  options: SPHERES.map((sphere) => ({
    id: sphere,
    instructions: [{ verb: "Each", pick: { type: "character", control: "any", committed: true, exceptSphere: [sphere, "baggins"] }, instructions: [{ verb: "RemoveFromQuest" }] }],
  })),
};

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 132035 Hidden Path. While it is the active location, locations in the staging area get -1 Threat. Travel: spend 2 Baggins resources (a hero of the Baggins sphere pays them, as Bilbo's pool does in every staging area he is in).
  { id: "132035:constant:1", cardCode: "132035", lines: ["132035:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  { id: "132035:travel:1", cardCode: "132035", lines: ["132035:A:2"], timing: "travel", instructions: [{ verb: "SpendResources", amount: 2, sphere: "baggins", group: true }] },

  // 132036 Dark Bats. Forced: after it damages a character it attaches to that character; attached it counts as a Condition attachment that gives -1 Willpower, Attack and Defense. A character it destroys is not in play, so the card stays an enemy.
  // Shadow: it attaches to the defending character (none when the attack is undefended).
  {
    id: "132036:forced:1",
    cardCode: "132036",
    lines: ["132036:A:1"],
    timing: "forced",
    trigger: "damagedByAttack",
    subject: { type: "character", control: "any" },
    condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", isSource: true } },
    instructions: [{ verb: "AttachSelf", to: { kind: "subject" } }],
  },
  {
    id: "132036:constant:1",
    cardCode: "132036",
    lines: ["132036:A:1"],
    timing: "constant",
    condition: ATTACHED,
    instructions: [
      { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
      { verb: "ModifyStat", stat: "willpower", amount: -1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "attack", amount: -1, until: "whileSourceInPlay", target: "host" },
      { verb: "ModifyStat", stat: "defense", amount: -1, until: "whileSourceInPlay", target: "host" },
    ],
  },
  { id: "132036:shadow:1", cardCode: "132036", lines: ["132036:A:2"], timing: "shadow", instructions: [{ verb: "AttachSelf", to: { kind: "defender" } }] },

  // 132037 Fighting Among Friends. When Revealed: the first player names a sphere; every committed non-Baggins character outside it leaves the quest. Shadow: attacking enemy gets +1 Attack (+2 if undefended).
  { id: "132037:whenRevealed:1", cardCode: "132037", lines: ["132037:A:1"], timing: "whenRevealed", instructions: [NAME_A_SPHERE] },
  {
    id: "132037:shadow:1",
    cardCode: "132037",
    lines: ["132037:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "undefended", is: false } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "undefended" } },
    ],
  },

  // 132038 Weighed Down. When Revealed: until the end of the round exhausted characters get -1 Willpower, Attack and Defense, read as the characters exhaust and ready (faq.lasting-effects). Shadow: a defender this attack destroys makes its controller raise his threat by 5.
  {
    id: "132038:whenRevealed:1",
    cardCode: "132038",
    lines: ["132038:A:1"],
    timing: "whenRevealed",
    instructions: (["willpower", "attack", "defense"] as const).map((stat) => ({ verb: "ModifyStat" as const, stat, amount: -1, until: "endOfRound" as const, target: "characters" as const, when: { kind: "holderExhausted" as const } })),
  },
  { id: "132038:shadow:1", cardCode: "132038", lines: ["132038:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 5, when: { kind: "x", min: 1 } }] }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
