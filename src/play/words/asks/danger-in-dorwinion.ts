import type { Amount, Condition, PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The choice words of Danger in Dorwinion (vengeance-of-mordor part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario danger-in-dorwinion --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=danger-in-dorwinion` prints each sentence.
// The first player answers for the group at the Messenger's Choose and the Secret Cultist's tie; each player's own cost choice (the Backstabber's engage, the Overwhelmed shadow, the Disappearances shadow, the Setup search) is owned. Row labels stay short so they do not cut on a phone in landscape.
// A raise that can take a player to the elimination level (Sauron Worship lowers it) arms a caution on its row: `raiseEliminates` for the player who raises (no seat: the one asked) or, for the Messenger's raise of every player, each seat at the raise of the active location's Threat read now.
const ACTIVE_LOCATION: Condition = { kind: "canPick", pick: { type: "location", control: "any", active: true } };
const NO_ACTIVE_LOCATION: Condition = { kind: "not", condition: ACTIVE_LOCATION };
// "The active location's Threat": 0 with no active location.
const ACTIVE_THREAT: Amount = { stat: "threat", of: "activeLocation" };
// The ally in play with the highest Attack, the cards the Secret Cultist's Pick offers when several tie (21039:A:1).
const HIGHEST_ALLY: PickSpec = { type: "ally", control: "any", highestAttack: true };
// Some living player's elimination level is reached by a raise of the active location's Threat, read now.
const ANY_ELIMINATED_BY_THREAT: Condition = { kind: "any", conditions: [0, 1, 2, 3].map((seat) => ({ kind: "raiseEliminates" as const, seat, raise: ACTIVE_THREAT })) };
// The player who raises their own threat by 2 (the Overwhelmed shadow, the Rhûn Backstabber) reaches the elimination level.
const ELIMINATED_BY_TWO: Condition = { kind: "raiseEliminates", raise: 2 };
const ALONE: Condition = { kind: "not", condition: { kind: "otherPlayer" } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 21038:A:2 (Shadow): the defending player discards an attachment they control.
  "21038:shadow:1 @0 Pick": { owned: true, why: "shadow effect.", note: "Choose an attachment you control to discard.", verb: "Discard" },

  // 21039:A:1 (When Revealed): attach to the ally in play with the highest Attack; the first player chooses among those tied.
  "21039:whenRevealed:1 @0 Pick": {
    note: "{card}: {tied} allies are tied for the highest Attack ({topAttack}). Choose the one it attaches to. That ally becomes an enemy engaged with its owner.",
    bind: { tied: { count: HIGHEST_ALLY } },
    named: { top: { pick: HIGHEST_ALLY, otherwise: "the same" } },
    verb: "Attach",
  },

  // 21040:A:1 (When Revealed): the first player chooses: each player raises their threat by the active location's Threat, or Messenger from Mordor attacks the first player.
  "21040:whenRevealed:1 @0 Choose": { note: "{card}: {owner} chooses for all the players. Either each player raises their threat by the active location's Threat, or it attacks the first player now." },
  "21040:whenRevealed:1 @0 threat": {
    label: [
      { when: NO_ACTIVE_LOCATION, text: "Each player raises threat by 0 (no active location)" },
      { text: "Each player raises threat by {raise}" },
    ],
    bind: { raise: ACTIVE_THREAT },
    caution: {
      when: ANY_ELIMINATED_BY_THREAT,
      text: [
        { when: ALONE, text: "Tap again: you are eliminated and the game is lost" },
        { text: "Tap again: this eliminates {eliminated}. If no player is left, the game is lost" },
      ],
    },
  },
  "21040:whenRevealed:1 @0 attack": { label: "{card} attacks {owner} now ({attack} Attack)", bind: { attack: { stat: "attack", of: "self" } } },

  // 21042:A:3 (Shadow): the defending player raises their threat by 2, or the attacking enemy cannot take damage this round.
  "21042:shadow:1 @0 Choose": { owned: true, why: "shadow effect.", note: "Raise your threat by 2, or the attacking enemy takes no damage this round." },
  "21042:shadow:1 @0 threat": {
    label: "Raise your threat by 2",
    caution: { when: ELIMINATED_BY_TWO, text: [{ when: ALONE, text: "Tap again: you are eliminated and the game is lost" }, { text: "Tap again: {owner} is eliminated. If no player is left, the game is lost" }] },
  },
  "21042:shadow:1 @0 damage": { label: "{host} takes no damage this round" },

  // 21044:A:1 (Forced after Rhûn Backstabber engages you): raise your threat by 2, or discard an ally you control with printed cost 2 or higher.
  "21044:forced:1 @0 Choose": { owned: true, why: "it engaged you.", note: "Raise your threat by 2, or discard an ally you control with printed cost 2 or higher." },
  "21044:forced:1 @0 threat": {
    label: "Raise your threat by 2",
    caution: { when: ELIMINATED_BY_TWO, text: [{ when: ALONE, text: "Tap again: you are eliminated and the game is lost" }, { text: "Tap again: {owner} is eliminated. If no player is left, the game is lost" }] },
  },
  "21044:forced:1 @0 discard": { label: "Discard an ally of cost 2 or more" },
  "21044:forced:1 @0.discard.0 Pick": { owned: true, why: "discard an ally.", note: "Choose one you control with printed cost 2 or higher.", verb: "Discard" },

  // 21047:A:3 (Travel): look at the top 5 cards of the encounter deck and put one facedown under Seedy Tavern.
  "21047:travel:1 @1 PickEncounter": { note: "Seedy Tavern: to travel here, choose 1 of the top 5 encounter cards to put facedown under it. The other 4 are shuffled back.", verb: "Hide" },

  // 21077:A:1 (Setup): each player searches the encounter deck for a different location and adds it to the staging area; each row shows the location's Threat and quest points.
  "21077:setup:1 @0.0 SearchMove": { owned: true, note: "choose a location from the encounter deck, different from the other players' locations, to add to the staging area at Setup.", verb: "Add", rowStats: ["threat", "questPoints"] },
};
