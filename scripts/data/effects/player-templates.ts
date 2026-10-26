import type { Instruction } from "../../../src/catalog/boundary.ts";
import { count, STATS, SPHERES, OWN, STAT, HIGH_COST, attachHost, statOf } from "./template-kit.ts";
import type { Template } from "./template-kit.ts";
import { PLAYER_ABILITY_TEMPLATES } from "./player-ability-templates.ts";
import { PLAYER_SEARCH_TEMPLATES } from "./player-search-templates.ts";
import { PLAYER_STARTER_TEMPLATES } from "./player-starter-templates.ts";

// "+1 Willpower", "-1 Threat", "+4 Hit Points" on the card the source is attached to.
function attachedStat(signed: string, word: string): Instruction | null {
  const stat = statOf(word);
  const amount = Number.parseInt(signed, 10);
  if (!stat || !Number.isInteger(amount) || amount === 0) return null;
  return { verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "host" };
}

// Player card templates: stats, traits and placement of attachments and characters. The rest are split by behavior
// (abilities, search and temporary play, starter-deck lines); the order is kept, so the first template that matches still wins.
const PLAYER_CARD_TEMPLATES: readonly Template[] = [
  // Player cards. An attachment names where it goes; Restricted is a keyword the engine reads from the card.
  {
    id: "attach-to",
    pattern: /^Attach to (.+?)\.(?: Limit 1 per (?:hero|character)\.)?(?: Restricted\.)?$/,
    build: (match) => {
      const host = attachHost(match[1] ?? "");
      if (!host) return null;
      return [{ timing: "constant", instructions: [{ verb: "AttachesTo", host, ...(/Limit 1 per/.test(match[0]) ? { limitPerHost: true } : {}) }] }];
    },
  },
  {
    // "Attached hero gains +1 Willpower." (01055:A:2), "Attached hero gets +4 Hit Points." (01040:A:2), "Attached location gets
    // -1 Threat." (01056:A:2).
    id: "attached-gets-stat",
    pattern: /^Attached (?:hero|character|location|enemy) (?:gets|gains) ([+-]\d+) (Willpower|Attack|Defense|Threat|[Hh]it [Pp]oints?)\.$/,
    build: (match) => {
      const instruction = attachedStat(match[1] ?? "", match[2] ?? "");
      return instruction ? [{ timing: "constant", instructions: [instruction] }] : null;
    },
  },
  {
    // "Attach to a hero. Attached hero gets -1 Willpower." printed as one line (01071:A:1): where it goes and what it gives.
    id: "attach-to-then-attached-stat",
    pattern: /^Attach to (.+?)\. Attached (?:hero|character|location|enemy) (?:gets|gains) ([+-]\d+) (Willpower|Attack|Defense|Threat|[Hh]it [Pp]oints?)\.$/,
    build: (match) => {
      const host = attachHost(match[1] ?? "");
      const instruction = attachedStat(match[2] ?? "", match[3] ?? "");
      return host && instruction ? [{ timing: "constant", instructions: [{ verb: "AttachesTo", host }, instruction] }] : null;
    },
  },
  {
    // "Attached hero gains +1 Attack. (+2 Attack instead if attached hero is a Dwarf.)" (01041:A:2): the bonus, and the rest of
    // it while the hero has the trait.
    id: "attached-gets-stat-more-for-trait",
    pattern: /^Attached (?:hero|character) (?:gets|gains) \+(\d+) (Willpower|Attack|Defense)\. \(\+(\d+) \2 instead if attached (?:hero|character) is an? (\w+)\.\)$/,
    build: (match) => {
      const stat = STATS[match[2] ?? ""] ?? "attack";
      const extra = count(match[3]) - count(match[1]);
      return [{ timing: "constant", instructions: [STAT(stat, count(match[1]), "host"), STAT(stat, extra, "host", { when: { kind: "hostTrait", trait: match[4] ?? "" } })] }];
    },
  },
  {
    // "Attached enemy cannot attack." (01069:A:2): a flag on the enemy the source is attached to.
    id: "attached-enemy-cannot-attack",
    pattern: /^Attached enemy cannot attack\.$/,
    build: () => [{ timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "host" }] }],
  },
  {
    // "Gimli gets +1 Attack for each damage token on him." (01004:A:1)
    id: "self-stat-per-damage",
    pattern: /^\{self\} gets \+(\d+) (Willpower|Attack|Defense) for each damage token on (?:him|her|it)\.$/,
    build: (match) => [
      {
        timing: "constant",
        condition: OWN,
        instructions: [{ verb: "ModifyStat", stat: STATS[match[2] ?? ""] ?? "attack", amount: count(match[1]), until: "whileSourceInPlay", target: "self", per: "damage" }],
      },
    ],
  },
  {
    id: "attached-defense-vs-high-engagement",
    pattern: /^Attached hero gets \+(\d+) Defense while defending against an attack made by an enemy with an engagement cost higher than your threat\.$/,
    build: (match) => [
      { timing: "constant", instructions: [STAT("defense", count(match[1]), "host", { when: { kind: "versusHighEngagement", role: "defending" } })] },
    ],
  },
  {
    id: "attached-attack-bonus-vs-high-engagement",
    pattern: /^Attached hero gets \+(\d+) Attack \(\+(\d+) Attack instead if attacking an enemy with an engagement cost higher than your threat\)\.$/,
    build: (match) => [
      {
        timing: "constant",
        instructions: [STAT("attack", count(match[1]), "host"), STAT("attack", count(match[2]) - count(match[1]), "host", { when: { kind: "versusHighEngagement", role: "attacking" } })],
      },
    ],
  },
  {
    id: "self-stat-per-hobbit-hero",
    pattern: /^\{self\} gets \+(\d+) (Willpower|Attack|Defense) for each Hobbit hero you control\.$/,
    build: (match) => [{ timing: "constant", condition: OWN, instructions: [STAT(STATS[match[2] ?? ""] ?? "attack", count(match[1]), "self", { per: "hobbitHero" })] }],
  },
  {
    id: "enemies-engagement-per-hobbit-hero",
    pattern: /^Each enemy in play gets \+(\d+) engagement cost for each Hobbit hero you control\.$/,
    build: (match) => [
      {
        timing: "constant",
        condition: OWN,
        instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: count(match[1]), until: "whileSourceInPlay", target: "enemies", per: "hobbitHero" }],
      },
    ],
  },
  {
    id: "self-defense-vs-high-engagement",
    pattern: new RegExp(`^\\{self\\} gets \\+(\\d+) Defense while defending against ${HIGH_COST}\\.$`),
    build: (match) => [
      { timing: "constant", condition: OWN, instructions: [STAT("defense", count(match[1]), "self", { when: { kind: "versusHighEngagement", role: "defending" } })] },
    ],
  },
  {
    id: "each-hero-gets-stat",
    pattern: /^Each hero gets \+(\d+) (Willpower|Attack|Defense)\.$/,
    build: (match) => [{ timing: "constant", condition: OWN, instructions: [STAT(STATS[match[2] ?? ""] ?? "willpower", count(match[1]), "heroes")] }],
  },
  {
    id: "hobbit-characters-hit-points",
    pattern: /^Each Hobbit character gets \+(\d+) hit points?\.$/,
    build: (match) => [
      {
        timing: "constant",
        condition: OWN,
        instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: count(match[1]), until: "whileSourceInPlay", target: "hobbitCharacters" }],
      },
    ],
  },
  {
    id: "lower-cost-if-control-cannot-have-attachments",
    pattern: /^Lower the cost to play \{self\} by (\d+) if you control (.+?)\. Cannot have attachments\.$/,
    build: (match, context) => {
      const code = context.codeOf(match[2] ?? "");
      if (!code) return null;
      return [{ timing: "constant", instructions: [{ verb: "ReduceCost", amount: count(match[1]), when: { kind: "controls", code } }, { verb: "Restrict", what: "attach" }] }];
    },
  },
  {
    id: "attached-gains-trait",
    pattern: /^Attached hero gains the (\w+) trait\.$/,
    build: (match) => [{ timing: "constant", instructions: [{ verb: "GrantTrait", trait: match[1] ?? "" }] }],
  },
  {
    // The four A Knife in the Dark boons (141018-141021): one stat and one trait for the hero the card is attached to.
    id: "attached-gets-stat-and-gains-trait",
    pattern: /^Attached hero gets \+(\d+) (Willpower|Attack|Defense|hit points?) and gains the (\w+) trait\.$/,
    build: (match) => {
      const stat = /^hit point/.test(match[2] ?? "") ? "hitPoints" : (STATS[match[2] ?? ""] ?? "willpower");
      return [
        {
          timing: "constant",
          instructions: [
            { verb: "ModifyStat", stat, amount: count(match[1]), until: "whileSourceInPlay", target: "host" },
            { verb: "GrantTrait", trait: match[3] ?? "" },
          ],
        },
      ];
    },
  },
  {
    id: "attached-named-gains-icon",
    pattern: /^If attached hero is (\w+), he also gains an? (Leadership|Tactics|Spirit|Lore) resource icon\.$/,
    build: (match) => {
      const sphere = SPHERES[match[2] ?? ""];
      return sphere ? [{ timing: "constant", instructions: [{ verb: "GrantIcon", sphere, when: { kind: "hostNamed", name: match[1] ?? "" } }] }] : null;
    },
  },
  {
    id: "response-character-destroyed-add-resource-to-attached",
    pattern: /^Response: After a character is destroyed, add (\d+|an?|one) resources? to attached hero's (?:resource )?pool\.$/,
    build: (match) => [{ timing: "response", trigger: "characterDestroyed", instructions: [{ verb: "AddResources", amount: count(match[1]) }] }],
  },
  {
    id: "forced-character-destroyed-discard-self",
    pattern: /^Forced: After a character is destroyed, discard \{self\}\.$/,
    build: () => [{ timing: "forced", trigger: "characterDestroyed", instructions: [{ verb: "Discard", target: { kind: "self" } }] }],
  },
];

export const PLAYER_TEMPLATES: readonly Template[] = [...PLAYER_CARD_TEMPLATES, ...PLAYER_ABILITY_TEMPLATES, ...PLAYER_SEARCH_TEMPLATES, ...PLAYER_STARTER_TEMPLATES];
