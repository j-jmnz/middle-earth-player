import type { Ask } from "../asks.ts";

// The choice words of The Long Dark (dwarrowdelf part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-long-dark --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-long-dark` prints each sentence.
// The first player answers for the group at the Setup's Torch, Durin's Greaves, Lost and Helpless, Gathering Ground's tie, the Lost effects' order, the Nightmare ally discard and Bottomless Chasm's hand discards, so those sentences are not owned (the sheet adds who chooses, and the rows of a pick that spans
// seats name their owner); each player's own choice is owned: the hand discards, the ally and character discards, Fatigue's exhaust, the locate test of a Shadow and the Lost choices of the Shadows and Dreadful Deep.

// The locate test (dwd.locate-test): the tester discards a hand card to discard the top encounter card, again and again; PASS passes, Stop fails. `{dealt}` lists the encounter cards discarded so far with whether each prints PASS.
const LOCATE = (who: string, owned: boolean): Ask => ({
  note: `{card}: ${who} makes a locate test. Discard 1 card from ${owned ? "your" : "their"} hand to discard the top encounter card. A card that prints PASS passes the test; Stop fails it. Discarded so far: {dealt}.`,
  ...(owned ? { owned: true as const } : {}),
  verb: "Discard",
  labels: { stop: "Stop: fail the test" },
});

// "Trigger all Lost: effects in play": the first player orders them, one at a time (rr.first-player, faq.simultaneous-effects).
const LOST_ORDER: Ask = { note: "{card}: the Lost effects of several cards in play are triggered. The first player chooses which card's Lost effect resolves next; each resolves in full before the next.", verb: "Resolve" };

// The defending player (a Shadow) or each player in turn (Dreadful Deep) chooses the one Lost effect to trigger.
const LOST_ONE: Ask = { note: "{card}: choose 1 \"Lost:\" effect in play to trigger, from the card it is printed on.", owned: true, verb: "Trigger" };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 04086:A:1 (Setup): the first player attaches Cave Torch to a hero of any player.
  "04086:setup:1 @1 Pick": { note: "{card}: the first player chooses a hero of any player to carry Cave Torch. The Torch is removed from the game if it would leave play.", verb: "Attach" },

  // 04086:B:2 and 04087:B:1/B:2, 04092:A:1, 04094:A:1, 04096:A:1, 04099:A:2, 901605:A:1, 901607:A:2: a Lost trigger of every card in play, ordered by the first player.
  "04086:forced:1 @0 TriggerLost": LOST_ORDER,
  "04087:whenRevealed:1 @2 TriggerLost": LOST_ORDER,
  "04087:forced:1 @0 TriggerLost": LOST_ORDER,
  "04092:forced:1 @2 TriggerLost": LOST_ORDER,
  "04094:whenRevealed:1 @2 TriggerLost": LOST_ORDER,
  "04096:whenRevealed:1 @5 TriggerLost": LOST_ORDER,
  "04099:shadow:1 @0 TriggerLost": LOST_ORDER,
  "901605:travel:1 @3 TriggerLost": LOST_ORDER,
  "901607:shadow:1 @1 TriggerLost": LOST_ORDER,

  // The locate tests: the first player makes them, except the Shadow of Dreadful Deep, which the defending player makes.
  "04087:whenRevealed:1 @0 LocateTest": LOCATE("the first player", false),
  "04092:forced:1 @0 LocateTest": LOCATE("the first player", false),
  "04094:whenRevealed:1 @0 LocateTest": LOCATE("the first player", false),
  "04096:whenRevealed:1 @0 LocateTest": LOCATE("the first player", false),
  "901605:travel:1 @1 LocateTest": LOCATE("the first player", false),
  "901607:shadow:1 @0 LocateTest": LOCATE("the defending player", true),

  // 04088:A:1 (When Revealed): the first player attaches Durin's Greaves to a hero of any player. It gives that hero +1 Defense.
  "04088:whenRevealed:1 @0 AttachSelf": { note: "{card}: the first player chooses a hero of any player to carry it. The hero gets +1 Defense; the Greaves are discarded if the hero leaves play.", verb: "Attach" },

  // 04090:A:1 (Lost): each player discards 1 card from his hand.
  "04090:forced:1 @0.0 DiscardFromHand": { owned: true, note: "{card}: choose 1 card from your hand to discard (a Lost effect).", verb: "Discard" },

  // 04093:A:2 (Shadow): the defending player exhausts a character he controls.
  "04093:shadow:1 @0 Pick": { owned: true, note: "{card}: choose a ready character you control to exhaust (the defending player's Shadow).", verb: "Exhaust" },

  // 04095:A:1 (When Revealed): the location in the staging area with the highest Threat plus remaining quest points; the first player breaks a tie.
  "04095:whenRevealed:1 @0 Pick": { note: "{card}: locations in the staging area are tied for the highest Threat plus remaining quest points. The first player chooses the one it attaches to; each enemy revealed from the encounter deck then gains surge.", verb: "Attach" },

  // 04097:A:1 (When Revealed): the first player draws 1 card, then discards 4 from his hand. A:2: the player it engages discards 1.
  "04097:whenRevealed:1 @2 DiscardFromHand": { owned: true, note: "{card}: choose 4 cards from your hand to discard, one at a time.", verb: "Discard" },
  "04097:forced:1 @0 DiscardFromHand": { owned: true, note: "{card} engaged you: choose 1 card from your hand to discard.", verb: "Discard" },

  // 04099:A:1 (Lost): each player discards 1 ally he controls from play.
  "04099:forced:1 @0.0 Pick": { owned: true, note: "{card} (a Lost effect): choose 1 ally you control to discard from play.", verb: "Discard" },

  // 04100:A:2 (Shadow, undefended): the defending player discards a character he controls from play.
  "04100:shadow:1 @0 Pick": { owned: true, note: "{card}: the attack is undefended. Choose 1 character you control to discard from play, before the damage is assigned.", verb: "Discard" },

  // 901601:A:3 (Nightmare setup card, Lost): the first player discards an ally in play, any player's.
  "901601:forced:2 @0 Pick": { note: "{card} (a Lost effect): the first player chooses 1 ally in play, any player's, to discard.", verb: "Discard" },

  // 901604:A:2 and 901605:A:2 (Shadow): the defending player triggers 1 Lost effect. 901607:A:1 (When Revealed): each player in turn triggers a different one.
  "901604:shadow:1 @0 TriggerLost": LOST_ONE,
  "901605:shadow:1 @0 TriggerLost": LOST_ONE,
  "901607:whenRevealed:1 @0 TriggerLost": { ...LOST_ONE, note: "{card}: choose 1 \"Lost:\" effect in play that no earlier player chose, to trigger, from the card it is printed on." },

  // 901606:A:1 (Nightmare, Bottomless Chasm): for each progress placed, the first player picks a card from any player's hand to discard.
  "901606:forced:1 @0.0 Pick": { note: "{card}: for each progress placed on it, 1 card is discarded from a player's hand. The first player chooses a card from any player's hand.", verb: "Discard" },

  // 901608:A:2 (When Revealed): the first player attaches it to a hero of any player; its Lost effect discards that hero. A:3 (Shadow): with no card in hand the defending character is discarded.
  "901608:whenRevealed:1 @0 AttachSelf": { note: "{card}: the first player chooses a hero of any player to carry it. A Lost effect discards that hero from play.", verb: "Attach" },
  "901608:shadow:1 @0 Pick": { owned: true, note: "{card}: you hold no card in hand, so the defending character is discarded from play, not destroyed.", verb: "Discard" },
};
