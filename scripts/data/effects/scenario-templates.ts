import { count, repeat, conditionOf, ATTACK } from "./template-kit.ts";
import type { Template } from "./template-kit.ts";

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
];
