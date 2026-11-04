import { count, repeat, conditionOf, ATTACK } from "./template-kit.ts";
import type { Condition } from "../../../src/catalog/boundary.ts";
import type { Template, TemplateContext } from "./template-kit.ts";

// The conditions a Shadow's "(+M Attack instead if ...)" reads. `adds`: the record adds the difference when it holds.
type Atom = Exclude<Condition, { kind: "not" | "all" | "any" }>;
function shadowCondition(text: string, context: TemplateContext): { condition: Atom; adds: boolean } | null {
  // conditionOf reads only atoms.
  const hide = conditionOf(text, context) as Atom | null;
  if (hide) return { condition: hide, adds: true };
  if (text === "this attack is undefended") return { condition: { kind: "undefended" }, adds: false };
  if (text === "you are off-course") return { condition: { kind: "heading", is: "offCourse" }, adds: false };
  const threat = /^the defending player's threat is (\d+) or higher$/.exec(text);
  if (threat) return { condition: { kind: "threat", min: count(threat[1]) }, adds: false };
  const trait = /^attacking enemy is an? (\w+)$/.exec(text);
  if (trait?.[1]) return { condition: { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: trait[1] } }, adds: false };
  if (text === "the defending character has fewer printed hit points than the attacking enemy") {
    return { condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", fewerHitPointsThan: "attackingEnemy" } }, adds: false };
  }
  const location = /^the active location is (?:an? )?(\w+?)(?: location)?$/.exec(text);
  if (location?.[1]) return { condition: { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: location[1] } }, adds: true };
  return null;
}

export const SCENARIO_TEMPLATES: readonly Template[] = [
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
    // A boon earned onto a hero (141018-141021). The Campaign Setup Checklist step 5 puts a Permanent card on its recorded
    // hero before the decks are set (rr.campaign-setup-checklist, mec109.permanent), so the Setup search never finds it in a
    // deck and this record never places it a second time; it runs only for a copy that is in a deck at setup.
    id: "setup-attach-to-a-hero",
    pattern: /^Setup[:.] Attach to a hero\.$/,
    build: () => [{ timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero" } }] }],
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
    id: "cannot-advance-while-in-play",
    pattern: /^The players cannot advance while (.+?) is in play\.$/,
    build: (match, context) => {
      const code = context.codeOf(match[1] ?? "");
      return code ? [{ timing: "constant", condition: { kind: "inPlay", code, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] }] : null;
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
    // The line before a bullet list of XP. It is no record: the first bullet's record names it as well (generate.ts).
    id: "resolution-gain-the-following",
    pattern: /^(?:Resolution: )?Gain the following:$/,
    build: () => [],
  },
  {
    id: "xp-each-surviving-player",
    pattern: /^• (\d+) XP for each surviving player\.$/,
    build: (match) => [{ timing: "resolution", instructions: [{ verb: "GainXp", amount: count(match[1]), each: { kind: "survivingPlayer" } }] }],
  },
  {
    id: "xp-survivors-threat",
    pattern: /^• (\d+) XP if each surviving player's threat is (\d+) or less\.$/,
    build: (match) => [{ timing: "resolution", instructions: [{ verb: "GainXp", amount: count(match[1]), when: { kind: "survivorsThreat", max: count(match[2]) } }] }],
  },
  {
    // "Is in the victory display" is one shape: a count of the victory-display cards with the name, at least one.
    id: "xp-named-card-in-victory",
    pattern: /^• ([-−–])?(\d+) XP if (\p{Lu}.*?) is in the victory display\.$/u,
    build: (match, context) => {
      const name = match[3] ?? "";
      if (!context.hasName(name)) return null;
      const amount = count(match[2]) * (match[1] ? -1 : 1);
      // The played scenarios' goldens store a card the name resolves to by code (`inVictory`), one condition per printing when
      // the scenario has several; a name no code is read from (a card the scenario does not deal) stays a count of the display.
      const codes = context.codesNamed(name);
      const present = codes.map((code) => ({ kind: "inVictory" as const, code, is: true }));
      const only = present.length === 1 ? present[0] : undefined;
      const when: Condition = only ?? (present.length > 1 ? { kind: "any", conditions: present } : { kind: "count", pick: { type: "card", control: "any", from: "victory", names: [name] }, min: 1 });
      return [{ timing: "resolution", instructions: [{ verb: "GainXp", amount, when }] }];
    },
  },
  {
    // "+N Attack (+M Attack instead if C)". Two shapes are written, the ones the authored records use: a condition that holds
    // for a trait of the active location or a Hide test adds the difference to the base (shadowCondition's `adds`); any other
    // condition holds the base back when it is true and gives M in its place.
    id: "shadow-attack-bonus",
    pattern: /^Shadow: Attacking enemy gets \+(\d+) Attack\.? \(\+(\d+) Attack instead if (.+?)\.?\)\.?$/,
    build: (match, context) => {
      const read = shadowCondition(match[3] ?? "", context);
      if (!read) return null;
      const base = count(match[1]);
      const instead = count(match[2]);
      const when = read.condition;
      const instructions = read.adds ? [ATTACK(base), ATTACK(instead - base, { when })] : [ATTACK(base, { when: { kind: "not" as const, condition: when } }), ATTACK(instead, { when })];
      return [{ timing: "shadow", instructions }];
    },
  },
  {
    id: "shadow-attack-plus",
    pattern: /^Shadow: Attacking enemy gets \+(\d+) Attack\.$/,
    build: (match) => [{ timing: "shadow", instructions: [ATTACK(count(match[1]))] }],
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
    // The consequences of an attack that destroys a character read X (characters destroyed) at least 1 once the attack is over.
    id: "shadow-destroys-character-raise-threat",
    pattern: /^Shadow: If this attack destroys a character, raise your threat by (\d+)\.$/,
    build: (match) => [{ timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: count(match[1]), when: { kind: "x", min: 1 } }] }] }],
  },
  {
    id: "shadow-destroys-character-reduce-life",
    pattern: /^Shadow: If this attack destroys a character, reduce the Ring-bearer's life by (\d+)\.$/,
    build: (match) => [{ timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReduceLife", amount: count(match[1]), when: { kind: "x", min: 1 } }] }] }],
  },
  {
    id: "shadow-destroys-character-damage-active-location",
    pattern: /^Shadow: If this attack destroys a character, place (\d+) damage on an active location\.$/,
    build: (match) => [
      {
        timing: "shadow",
        instructions: [
          {
            verb: "AfterAttack",
            instructions: [
              { verb: "Pick", pick: { type: "location", control: "any", active: true, who: "firstPlayer" }, when: { kind: "x", min: 1 } },
              { verb: "PlaceDamage", amount: count(match[1]), card: "picked", when: { kind: "x", min: 1 } },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "shadow-destroys-character-additional-attack",
    pattern: /^Shadow: If this attack destroys a character, attacking enemy makes an additional attack\.$/,
    build: () => [{ timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack", when: { kind: "x", min: 1 } }] }] }],
  },
  {
    id: "shadow-undefended-if-hide-failed",
    pattern: /^Shadow: If you have failed a Hide test this round, this attack is considered undefended\.$/,
    build: () => [{ timing: "shadow", instructions: [{ verb: "ConsiderUndefended", when: { kind: "hideFailed", scope: "round" } }] }],
  },
];
