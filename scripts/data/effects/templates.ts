import type { Condition, Effect, Instruction } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";

// A template turns one whole line of card text into effect records. A line that no template matches in full
// is not partially matched: it goes to the drafts list for an agent (.agent/drafts, pnpm effects:draft).
// Records carry no id; generate.ts numbers them per card and timing, in text order.
export type Draft = Omit<Effect, "id" | "cardCode" | "lines">;

export type TemplateContext = {
  card: Card;
  // The code of a card named in text, among the cards of the scenario or campaign being built.
  codeOf(name: string): string | null;
  // Codes in the scenario's set-aside pile.
  setAside: ReadonlySet<string>;
};

export type Template = {
  id: string;
  // Matched against the line with the card's own name replaced by {self}.
  pattern: RegExp;
  build(match: RegExpExecArray, context: TemplateContext): Draft[] | null;
};

const NUMBER_WORDS: Readonly<Record<string, number>> = { a: 1, an: 1, one: 1, two: 2, three: 3 };

function count(word: string | undefined): number {
  if (word === undefined) return 1;
  return NUMBER_WORDS[word.toLowerCase()] ?? Number(word);
}

function repeat(instruction: Instruction, times: number): Instruction[] {
  return Array.from({ length: times }, () => instruction);
}

// "you have failed a Hide test this round", "The One Ring is exhausted".
function conditionOf(text: string, context: TemplateContext): Condition | null {
  if (/^(?:you have|the defending player) (?:failed|has failed) a Hide test this round$/i.test(text)) return { kind: "hideFailed", scope: "round" };
  const exhausted = /^(.+?) is exhausted$/.exec(text);
  const code = exhausted?.[1] ? context.codeOf(exhausted[1]) : null;
  return code ? { kind: "exhausted", code, is: true } : null;
}

const ATTACK = (amount: number, extra?: { when: Condition }): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...extra });

const STATS: Readonly<Record<string, "willpower" | "attack" | "defense" | "threat">> = { Willpower: "willpower", Attack: "attack", Defense: "defense", Threat: "threat" };
const SPHERES: Readonly<Record<string, "leadership" | "tactics" | "spirit" | "lore">> = { Leadership: "leadership", Tactics: "tactics", Spirit: "spirit", Lore: "lore" };
const OWN = { kind: "sourceIn", zone: "play" } as const;
const STAT = (stat: "willpower" | "attack" | "defense" | "threat", amount: number, target: "host" | "self" | "heroes", extra?: { when?: Condition; per?: "hobbitHero" }): Instruction => ({
  verb: "ModifyStat",
  stat,
  amount,
  until: "whileSourceInPlay",
  target,
  ...extra,
});
const HIGH_COST = "an? enemy with an engagement cost higher than your threat";

// "a Hobbit hero", "an Istari character", "the Ring-bearer", "the active location", "Gandalf".
function attachHost(text: string): Extract<Instruction, { verb: "AttachesTo" }>["host"] | null {
  const bare = text.replace(/^(?:an?|the) /, "");
  if (bare === "hero" || bare === "character") return { kind: bare };
  if (bare === "Ring-bearer") return { kind: "ringBearer" };
  if (bare === "active location") return { kind: "activeLocation" };
  const typed = /^(\w+) (hero|character)$/.exec(bare);
  if (typed?.[1] && typed[2]) return { kind: typed[2] as "hero" | "character", trait: typed[1] };
  if (/^[A-Z][\w']*$/.test(bare) && text === bare) return { kind: "character", name: bare };
  return null;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "quest-setup",
    pattern: /^Setup: Set (.+?) aside, out of play\. Add (\d+|an?|one) (.+?) to the staging area and make (.+?) the active location\. Shuffle the encounter deck\.$/,
    build: (match, context) => {
      const aside = context.codeOf(match[1] ?? "");
      const staged = context.codeOf(match[3] ?? "");
      const active = context.codeOf(match[4] ?? "");
      if (!aside || !staged || !active) return null;
      return [
        {
          timing: "setup",
          instructions: [
            { verb: "SetAside", code: aside },
            ...repeat({ verb: "AddToStaging", code: staged }, count(match[2])),
            { verb: "MakeActiveLocation", code: active },
            { verb: "ShuffleEncounterDeck" },
          ],
        },
      ];
    },
  },
  {
    id: "setup-add-self-to-staging",
    pattern: /^Setup: Add \{self\} to the staging area\.$/,
    build: (_match, { card }) => [{ timing: "setup", instructions: [{ verb: "AddToStaging", code: card.code }] }],
  },
  {
    id: "setup-attach-to-ring-bearer",
    pattern: /^Setup: Attach to the Ring-bearer\.$/,
    build: (_match, { card }) => [{ timing: "setup", instructions: [{ verb: "AttachToRingBearer", code: card.code }] }],
  },
  {
    id: "setup-first-player-claims",
    pattern: /^Setup: The first player claims \{self\} and attaches it to the Ring-bearer\.$/,
    build: (_match, { card }) => [{ timing: "setup", instructions: [{ verb: "AttachToRingBearer", code: card.code }] }],
  },
  {
    id: "draw-less-in-starting-hand",
    pattern: /^Each player draws (\d+|an?|one) less cards? in (?:his|their) starting hand\.$/,
    build: (match) => [{ timing: "setup", instructions: [{ verb: "ReduceOpeningHand", amount: count(match[1]) }] }],
  },
  {
    id: "hide-failed-engage-staging",
    pattern: /^When a player fails a Hide test, each (.+?) enemy in the staging area engages that player\. \(Trigger Forced effects after resolving this effect\.\)$/,
    build: (match) => [{ timing: "triggered", trigger: "hideFailed", instructions: [{ verb: "EngageAll", trait: match[1] ?? "", who: "actor" }] }],
  },
  {
    id: "cannot-advance-unless-in-victory",
    pattern: /^The players cannot advance unless (.+?) is in the victory display\.$/,
    build: (match, context) => {
      const code = context.codeOf(match[1] ?? "");
      return code ? [{ timing: "constant", condition: { kind: "inVictory", code, is: false }, instructions: [{ verb: "Restrict", what: "advance" }] }] : null;
    },
  },
  {
    id: "search-reveal-and-stage",
    pattern: /^When Revealed: The first player searches the encounter deck and discard pile for an? (.+?), reveals it \(cannot be canceled\), and adds it to the staging area\. Shuffle the encounter deck\.$/,
    build: (match, context) => {
      const code = context.codeOf(match[1] ?? "");
      return code ? [{ timing: "whenRevealed", instructions: [{ verb: "SearchReveal", code, who: "firstPlayer" }, { verb: "ShuffleEncounterDeck" }] }] : null;
    },
  },
  {
    id: "when-revealed-add-to-staging",
    pattern: /^When Revealed: Add (.+?) to the staging area\.$/,
    build: (match, context) => {
      const code = context.codeOf(match[1] ?? "");
      if (!code) return null;
      return [{ timing: "whenRevealed", instructions: [{ verb: context.setAside.has(code) ? "AddSetAsideToStaging" : "AddToStaging", code }] }];
    },
  },
  {
    id: "when-revealed-travel-here",
    pattern: /^When Revealed: Immediately travel to \{self\}\. If another location is currently active, return it to the staging area\.$/,
    build: () => [{ timing: "whenRevealed", instructions: [{ verb: "ReturnToStaging", target: { kind: "activeLocation" } }, { verb: "Travel", to: "self" }] }],
  },
  {
    id: "hide-succeeded-place-progress",
    pattern: /^Response: After a player makes a successful Hide test, place X progress on a non-unique location in play\. X is twice the number of players in the game\.$/,
    build: () => [{ timing: "response", trigger: "hideSucceeded", instructions: [{ verb: "PlaceProgressOnLocation", perPlayer: 2 }] }],
  },
  {
    id: "response-leaves-play-draw-per-trait-hero",
    pattern: /^Response: After \{self\} leaves play, each player draws 1 card for each (.+?) hero he controls\.$/,
    build: (match) => [
      { timing: "response", trigger: "leftPlay", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Draw", perHero: match[1] ?? "" }] }] },
    ],
  },
  {
    id: "active-location-hide-value",
    pattern: /^While \{self\} is the active location, reduce each Hide X value by (\d+)\.$/,
    build: (match) => [
      { timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "hideValue", amount: -count(match[1]), until: "whileSourceInPlay", target: "table" }] },
    ],
  },
  {
    id: "active-location-hide-willpower",
    pattern: /^While \{self\} is the active location, characters get \+(\d+) Willpower while committed to Hide tests\.$/,
    build: (match) => [
      { timing: "constant", condition: { kind: "sourceIn", zone: "activeLocation" }, instructions: [{ verb: "ModifyStat", stat: "hideWillpower", amount: count(match[1]), until: "whileSourceInPlay", target: "table", per: "committed" }] },
    ],
  },
  {
    id: "staging-hide-threat",
    pattern: /^While \{self\} is in the staging area, add (\d+) to the total Threat of the discarded cards when a player resolves a Hide test\.$/,
    build: (match) => [
      { timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "hideThreat", amount: count(match[1]), until: "whileSourceInPlay", target: "table" }] },
    ],
  },
  {
    id: "engaged-hide-value",
    pattern: /^While \{self\} is engaged with a player, that player adds (\d+) to the Hide value for each Hide test he makes\.$/,
    build: (match) => [
      { timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "hideValue", amount: count(match[1]), until: "whileSourceInPlay", target: "engagedSeat" }] },
    ],
  },
  {
    id: "quest-points-in-staging",
    pattern: /^\{self\} gets \+(\d+) quest points while in the staging area\.$/,
    build: (match) => [
      { timing: "constant", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: count(match[1]), until: "whileSourceInPlay" }] },
    ],
  },
  {
    id: "cannot-travel-while-other-location",
    pattern: /^While there is at least 1 other location in play, the players cannot travel here\.$/,
    build: () => [{ timing: "constant", condition: { kind: "otherLocationInPlay" }, instructions: [{ verb: "Restrict", what: "travel" }] }],
  },
  {
    id: "travel-hide-test",
    pattern: /^Travel: The first player must make a Hide (\d+) test to travel here\.$/,
    build: (match) => [{ timing: "travel", instructions: [{ verb: "HideTest", x: count(match[1]) }] }],
  },
  {
    id: "win-when-explored-and-left-play",
    pattern: /^After \{self\} leaves play as an explored location, the players win the game\.$/,
    build: () => [{ timing: "questResolution", instructions: [{ verb: "WinGame" }] }],
  },
  {
    id: "restrict-attachments-except-trait",
    pattern: /^Cannot have non-(.+?) attachments\.$/,
    build: (match) => [{ timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "attach", exceptTrait: match[1] ?? "" }] }],
  },
  {
    id: "forced-engaged-hide-failed-immediate-attack",
    pattern: /^Forced: After engaged player fails a Hide test, \{self\} makes an immediate attack\.$/,
    build: () => [{ timing: "forced", trigger: "hideFailed", condition: { kind: "engagedWithActor" }, instructions: [{ verb: "ImmediateAttack" }] }],
  },
  {
    id: "forced-hide-failed-shuffle-from-discard",
    pattern: /^Forced: After a player fails a Hide test, shuffle an? (.+?) enemy from the discard pile into the encounter deck, if able\.$/,
    build: (match) => [{ timing: "forced", trigger: "hideFailed", instructions: [{ verb: "ShuffleIntoDeck", trait: match[1] ?? "" }] }],
  },
  {
    id: "attached-hero-ring",
    pattern: /^Attached hero does not count against the hero limit\. The first player gains control of attached hero\.$/,
    build: () => [
      { timing: "constant", condition: { kind: "sourceIn", zone: "play" }, instructions: [{ verb: "Restrict", what: "heroLimit" }] },
      { timing: "forced", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "TransferHost", who: "firstPlayer" }] },
    ],
  },
  {
    id: "shadow-attack-bonus",
    pattern: /^Shadow: Attacking enemy gets \+(\d+) Attack \(\+(\d+) Attack instead if (.+?)\)\.?$/,
    build: (match, context) => {
      const condition = conditionOf(match[3] ?? "", context);
      if (!condition) return null;
      const base = count(match[1]);
      return [{ timing: "shadow", instructions: [ATTACK(base), ATTACK(count(match[2]) - base, { when: condition })] }];
    },
  },
  {
    id: "shadow-return-to-staging",
    pattern: /^Shadow: Return attacking enemy to the staging area after this attack\.$/,
    build: () => [{ timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }],
  },
  {
    id: "shadow-additional-attack",
    pattern: /^Shadow: Attacking enemy makes an additional attack after this one\.$/,
    build: () => [{ timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack" }] }] }],
  },
  {
    id: "shadow-undefended-if-hide-failed",
    pattern: /^Shadow: If you have failed a Hide test this round, this attack is considered undefended\.$/,
    build: () => [{ timing: "shadow", instructions: [{ verb: "ConsiderUndefended", when: { kind: "hideFailed", scope: "round" } }] }],
  },
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
    id: "attached-gets-stat",
    pattern: /^Attached (?:hero|character) (?:gets|gains) \+(\d+) (Willpower|Attack|Defense|Threat)\.$/,
    build: (match) => [{ timing: "constant", instructions: [STAT(STATS[match[2] ?? ""] ?? "attack", count(match[1]), "host")] }],
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
  // Actions and Responses of the player cards.
  {
    id: "action-exhaust-choose-player-characters-stat",
    pattern: /^Action: Exhaust \{self\} to choose a player\. Each character controlled by that player gets \+(\d+) (Willpower|Attack|Defense) until the end of the phase\.$/,
    build: (match) => [
      {
        timing: "action",
        cost: { kind: "exhaustSelf" },
        instructions: [
          { verb: "Pick", pick: { type: "player", control: "any" } },
          { verb: "ModifyStat", stat: STATS[match[2] ?? ""] ?? "willpower", amount: count(match[1]), until: "endOfPhase", target: "pickedPlayerCharacters" },
        ],
      },
    ],
  },
  {
    id: "action-exhaust-choose-player-draws",
    pattern: /^Action: Exhaust \{self\} to choose a player\. That player draws (\d+|an?|one) cards?\.$/,
    build: (match) => [
      {
        timing: "action",
        cost: { kind: "exhaustSelf" },
        instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "Draw", amount: count(match[1]), who: "picked" }],
      },
    ],
  },
  {
    id: "action-exhaust-add-resources-to-attached",
    pattern: /^Action: Exhaust \{self\} to add (\d+|an?|one) resources? to attached hero's resource pool\.$/,
    build: (match) => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "AddResources", amount: count(match[1]) }] }],
  },
  {
    id: "action-exhaust-ready-attached",
    pattern: /^Action: Exhaust \{self\} to ready attached hero\.$/,
    build: () => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Ready", target: "host" }] }],
  },
  {
    id: "action-choose-and-ready-ally",
    pattern: /^Action: Choose and ready 1 ally card\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", state: "exhausted" } }, { verb: "Ready", target: "picked" }],
      },
    ],
  },
  {
    id: "action-exhaust-hero-ready-different-hero",
    pattern: /^Action: Exhaust 1 hero you control to choose and ready a different hero\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "hero", control: "you", state: "ready" } },
          { verb: "Exhaust", target: { kind: "picked" } },
          { verb: "Pick", pick: { type: "hero", control: "any", state: "exhausted", different: true } },
          { verb: "Ready", target: "picked" },
        ],
      },
    ],
  },
  {
    id: "action-ready-all-characters",
    pattern: /^Action: Ready all character cards in play\.$/,
    build: () => [{ timing: "action", instructions: [{ verb: "Ready", target: "allCharacters" }] }],
  },
  {
    id: "action-hobbit-character-stats",
    pattern: /^Action: Choose a Hobbit character\. That character gets \+(\d+) Willpower, \+(\d+) Attack, and \+(\d+) Defense until the end of the phase\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "any", trait: "Hobbit" } },
          ...(["willpower", "attack", "defense"] as const).map((stat, at): Instruction => ({ verb: "ModifyStat", stat, amount: count(match[at + 1]), until: "endOfPhase", target: "picked" })),
        ],
      },
    ],
  },
  {
    id: "action-heroes-willpower-draw-per-hobbit-hero",
    pattern: /^Action: Each hero you control gets \+(\d+) Willpower until the end of the round\. Draw 1 card for each Hobbit hero you control\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          { verb: "ModifyStat", stat: "willpower", amount: count(match[1]), until: "endOfRound", target: "ownHeroes" },
          { verb: "Draw", perHero: "Hobbit" },
        ],
      },
    ],
  },
  {
    id: "action-bar-enemy-attack-this-phase",
    pattern: /^Action: Choose an enemy engaged with a player\. That enemy cannot attack that player this phase\.$/,
    build: () => [{ timing: "action", instructions: [{ verb: "BarAttack", scope: "any", until: "endOfPhase" }] }],
  },
  {
    id: "action-exhaust-character-attack-now",
    pattern: /^Action: Exhaust a character you control to immediately declare it as an attacker \(and resolve its attack\) against any eligible enemy target\.$/,
    build: () => [
      {
        timing: "action",
        instructions: [
          { verb: "Pick", pick: { type: "character", control: "you", state: "ready", canAttack: true } },
          { verb: "Exhaust", target: { kind: "picked" } },
          { verb: "Pick", pick: { type: "enemy", control: "any", attackableByPicked: true } },
          { verb: "AttackEnemy" },
        ],
      },
    ],
  },
  {
    id: "action-reduce-threat-give-control",
    pattern: /^Action: Reduce your threat by (\d+) to give control of \{self\} to another player\. Raise that player's threat by (\d+)\.$/,
    build: (match) => [
      {
        timing: "action",
        condition: { kind: "otherPlayer" },
        instructions: [
          { verb: "LowerThreat", amount: count(match[1]), who: "actor" },
          { verb: "GiveControl" },
          { verb: "RaiseThreat", amount: count(match[2]), who: "otherPlayer" },
        ],
      },
    ],
  },
  {
    id: "action-reduce-one-player-threat-or-each",
    pattern: /^Action: Reduce 1 player's threat by (\d+), or reduce each player's threat by (\d+)\.$/,
    build: (match) => [
      {
        timing: "action",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "one", instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "LowerThreat", amount: count(match[1]), who: "picked" }] },
              { id: "each", instructions: [{ verb: "LowerThreat", amount: count(match[2]), who: "eachSeat" }] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "response-ally-leaves-play-controller-draws",
    pattern: /^Response: After an ally card leaves play, that card's controller draws (\d+|an?|one) cards?\.$/,
    build: (match) => [{ timing: "response", trigger: "allyLeftPlay", instructions: [{ verb: "Draw", amount: count(match[1]), who: "eventSeat" }] }],
  },
  {
    id: "response-takes-damage-ready",
    pattern: /^Response: After \{self\} takes any amount of damage, ready (?:him|her|it)\.$/,
    build: () => [{ timing: "response", trigger: "damaged", instructions: [{ verb: "Ready" }] }],
  },
  {
    id: "response-enters-play-choose-location-progress",
    pattern: /^Response: After \{self\} enters play, choose a location\. Place (\d+|an?|one) progress tokens? on that location\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [{ verb: "Pick", pick: { type: "location", control: "any" } }, { verb: "PlaceProgressOn", amount: count(match[1]), target: "picked" }],
      },
    ],
  },
  {
    id: "response-commits-progress-on-each-staging-location",
    pattern: /^Response: After \{self\} commits to a quest, place (\d+|an?|one) progress tokens? on each location in the staging area\.$/,
    build: (match) => [{ timing: "response", trigger: "committed", instructions: [{ verb: "PlaceProgressOn", amount: count(match[1]), target: "eachStagingLocation" }] }],
  },
  {
    id: "end-of-round-discard-self",
    pattern: /^At the end of the round, discard \{self\} from play\.$/,
    build: () => [{ timing: "triggered", trigger: "endOfRound", instructions: [{ verb: "Discard", target: { kind: "self" } }] }],
  },
  {
    id: "response-enters-play-choose-one",
    pattern: /^Response: After \{self\} enters play, \(choose 1\): draw (\d+) cards, deal (\d+) damage to 1 enemy in play, or reduce your threat by (\d+)\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "draw", instructions: [{ verb: "Draw", amount: count(match[1]) }] },
              {
                id: "damage",
                instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: count(match[2]) }],
              },
              { id: "threat", instructions: [{ verb: "LowerThreat", amount: count(match[3]), who: "actor" }] },
            ],
          },
        ],
      },
    ],
  },
  // Cancel, look at, and search.
  {
    id: "response-cancel-when-revealed",
    pattern: /^Response: Cancel the "when revealed" effects of a card that was just revealed from the encounter deck\.$/,
    build: () => [{ timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] }],
  },
  {
    id: "response-cancel-shadow-effect",
    pattern: /^Response: Cancel a shadow effect just triggered during combat\.$/,
    build: () => [{ timing: "response", trigger: "shadowPending", instructions: [{ verb: "CancelEffect" }] }],
  },
  {
    id: "action-exhaust-look-at-encounter-top",
    pattern: /^Action: Exhaust \{self\} to look at the top card of the encounter deck\.$/,
    build: () => [{ timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "LookAtEncounterTop" }] }],
  },
  {
    id: "response-played-search-top-attachment-into-play",
    pattern: /^Response: After you play \{self\} from your hand, search the top (\d+) cards of your deck for an attachment of cost (\d+) or less and put it into play\. Put the remaining cards back in any order\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "played",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", top: count(match[1]), cardType: "attachment", maxCost: count(match[2]) } },
          { verb: "Pick", pick: { type: "character", control: "any", hostForPicked: true } },
          { verb: "AttachPicked" },
          { verb: "ArrangeTop" },
        ],
      },
    ],
  },
  {
    id: "response-enters-play-search-deck-for-trait-attachment",
    pattern: /^Response: After \{self\} enters play, search your deck for an? (\w+) attachment and add it to your hand\. Shuffle your deck\.$/,
    build: (match) => [
      {
        timing: "response",
        trigger: "enteredPlay",
        instructions: [
          { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", trait: match[1] ?? "" } },
          { verb: "MovePicked", to: "hand" },
          { verb: "ShuffleDeck" },
        ],
      },
    ],
  },
];
