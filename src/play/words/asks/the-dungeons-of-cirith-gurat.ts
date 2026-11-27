import type { Ask } from "../asks.ts";

// The choice words of The Dungeons of Cirith Gurat (haradrim part 8), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-dungeons-of-cirith-gurat --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-dungeons-of-cirith-gurat` prints each sentence.
import type { Condition } from "../../../catalog/boundary.ts";
import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";

const ALLY: Condition = { kind: "matches", card: "picked", pick: { type: "ally", control: "any" } };
const HERO: Condition = { kind: "matches", card: "picked", pick: { type: "hero", control: "any" } };

// The Gate of Iron's Travel raises every player's threat by 3: the warning holds when any living player (seatThreat reads only a living one) would reach the level, and names each such player.
const RAISE = 3;
const ANY_ELIMINATED: Condition = { kind: "any", conditions: [0, 1, 2, 3].map((seat) => ({ kind: "seatThreat" as const, seat, min: ELIMINATION_LEVEL - RAISE })) };
const ELIMINATED_BY_THREAT = { when: ANY_ELIMINATED, text: "Tap again: this takes the threat of {eliminated} to 50 or more and eliminates them. If no player is left, the game is lost" };
// A character a pick captures loses its tokens and attachments (17119:A:2).
const LOSES = "loses its tokens and attachments";

export const ASKS: Readonly<Record<string, Ask>> = {
  // 16061:forced:1 (Uruk Chieftain, forced): Forced: At the end of the encounter phase, Uruk Chieftain engages the player engaged with the most non-unique Orc enemies.
  "16061:forced:1 @0 EngageSeatWithMost": { note: "{card} engages the player engaged with the most non-unique Orc enemies: choose that player if several are tied.", verb: "Engage" },
  // 16064:whenRevealed:1 (Mordor Warg, whenRevealed): When Revealed: Attach to an Orc enemy and return that enemy to the staging area. Limit 1 per enemy. (Counts as a Mount attachment with the text: "Attached enemy gets +2 Threat, +2 Attack, +2 Defense and +2 hit points. Forced: When attached enemy leaves play, add Mordor Warg to the staging area.")
  "16064:whenRevealed:1 @0 Pick": { note: "{card}: choose an Orc enemy to attach it to. The enemy returns to the staging area and gets +2 Threat, +2 Attack, +2 Defense and +2 hit points.", verb: "Attach" },
  // 17121:forced:1 (Jailer of Cirith Gurat, forced): Forced: After Jailer of Cirith Gurat engages you, attach an ally you control to it.
  "17121:forced:1 @0 Pick": { owned: true, note: "{card} engaged you: choose an ally you control to attach to it. You lose control of that ally until it is rescued.", verb: "Attach", caution: { when: ALLY, text: `Tap again: {picked} ${LOSES} and is captured by {card} until it leaves play` } },
  // 17123:whenRevealed:1 (Dungeon Warg, whenRevealed): When Revealed: Dungeon Warg makes an immediate attack against the player who controls the most allies.
  "17123:whenRevealed:1 @0 AttackSeatWithMost": { note: "{card} makes an immediate attack against the player who controls the most allies: choose that player if several are tied.", verb: "Attack" },
  // 17129:whenRevealed:1 (Taken Prisoner, whenRevealed): When Revealed: The first player attaches an ally he controls to an unattached enemy or location in the staging area. If he cannot, Taken Prisoner gains doomed 2.
  "17129:whenRevealed:1 @2 Pick": { owned: true, note: "{card}: the first player chooses an ally they control to attach. It is captured until it is rescued.", verb: "Attach", caution: { when: ALLY, text: `Tap again: {picked} ${LOSES} and is captured until its holder leaves play` } },
  "17129:whenRevealed:1 @3 Pick": { owned: true, note: "{card}: choose the unattached enemy or location in the staging area to hold {picked} ({whose} ally).", verb: "Attach" },
  // 17131:whenRevealed:1 (Captured!, whenRevealed): When Revealed: Each player loses control of an ally he controls and attaches it to this stage. If no allies are attached to this stage, discard it and reveal an additional encounter card.
  "17131:whenRevealed:1 @0.0 Pick": { owned: true, note: "{card}: choose an ally you control. You attach it to Captured! and lose control of it.", verb: "Attach", caution: { when: ALLY, text: `Tap again: {picked} ${LOSES} and is captured until Captured! is defeated. Your threat then goes down by its cost ({pickedCost})` } },
  // 17132:setup:1 (Rescue the Prisoners, setup): Setup: Set Uruk Chieftain aside, out of play. Add The Captives of Cirith Gurat and 1 copy of Dungeon Cell to the staging area. Attach Abaan to Dungeon Cell. Each player searches the encounter deck for a different Orc enemy and adds it to the staging area. Shuffle the encounter deck. Starting with the first player, each player discards cards from the top of his deck until an ally that is not in play is discarded and attaches that ally to an unattached enemy in the staging area.
  "17132:setup:1 @0 Pick": { note: "{card}: choose the Dungeon Cell in the staging area to hold Abaan.", verb: "Attach" },
  "17132:setup:1 @4.1 Pick": { owned: true, note: "{card}: choose an unattached enemy in the staging area to hold {picked} ({whose} ally).", verb: "Attach" },
  // 17134:whenRevealed:1 (Fight Your Way Out, whenRevealed): When Revealed: The first player adds Uruk Chieftain to the staging area. Each player chooses a hero he controls, discards all tokens and attachments from it, and attaches it to an unattached enemy in the staging area as a captive. Then, the players make a standard series of engagement checks against each enemy in the staging area. Reduce the engagement cost of each enemy not guarding an objective to 0 during these engagement checks.
  "17134:whenRevealed:1 @1.0 Pick": { owned: true, note: "{card}: choose a hero you control. It loses its tokens and attachments and is attached to an enemy as a captive.", verb: "Capture", caution: { when: HERO, text: `Tap again: {picked} ${LOSES} and is captured until its holder leaves play` } },
  "17134:whenRevealed:1 @1.2 Pick": { owned: true, note: "{card}: choose an unattached enemy in the staging area to hold {picked} ({whose} hero).", verb: "Attach" },
  // 17120:A:2 (Abaan, Response after he exhausts): a Harad character gets +1 Willpower, +1 Attack and +1 Defense until the end of the round.
  "17120:response:1 @0 Pick": { owned: true, note: "{card} exhausted: choose a Harad character to get +1 Willpower, +1 Attack and +1 Defense until the end of the round.", verb: "Boost" },
  // 17124:A:2 (Travel): the first player discards a card from hand with cost above the discarded card's Threat, or every player raises their threat by 3.
  "17124:travel:1 @2 discard": { label: "Discard a card from your hand with a cost above {threat} ({discarded})" },
  "17124:travel:1 @2 threat": { label: "Every player raises their threat by 3", bind: { raise: RAISE }, caution: ELIMINATED_BY_THREAT },
  "17124:travel:1 @2.discard.0 Pick": { owned: true, note: "{card}: choose a card from your hand with a cost above {threat} ({discarded}).", verb: "Discard" },
  // 17132:A:1 (Setup): each player searches the encounter deck for a different Orc enemy and adds it to the staging area.
  "17132:setup:1 @2.0 SearchMove": { owned: true, note: "{card}: choose an Orc enemy from the encounter deck, different from the other players' choices, to add to the staging area.", verb: "Add", rowStats: ["threat", "engagementCost"] },
  // 17134:A:1 (Fight Your Way Out): a standard series of engagement checks, enemies that guard no objective counting a cost of 0.
  "17134:whenRevealed:1 @2 MakeEngagementChecks": { owned: true, note: "{card}: choose which enemy engages you when several tie for the highest engagement cost. Enemies that guard no captive count a cost of 0.", verb: "Engage" },
};
