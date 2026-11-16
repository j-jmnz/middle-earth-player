import type { Effect } from "../../../catalog/boundary.ts";

// Records of the sidequests family's contracts whose rules reach past the table: The Burglar's Turn builds a loot deck from the side
// deck (src/catalog/loot.ts) and Messenger of the King turns an ally from the deck into a hero. sidequests.ts takes them into its list.
const SIDE_B = { kind: "faceUp", side: "B" } as const;
// Messenger of the King's Setup goes on only once it has put an ally into play (none in the deck: nothing more happens).
const PICKED_IN_PLAY = { kind: "matches", card: "picked", pick: { type: "ally", control: "you" }, inPlay: true } as const;

export const CONTRACT_RECORDS: readonly Effect[] = [
  // The Burglar's Turn. Side A: "You cannot include attachments in your deck." "Setup: Choose 14 different Item or Artifact attachments
  // from your collection and shuffle them together. This is your loot deck. Flip this card over and place your loot deck facedown
  // under it." Side B: "The active location gets +1 quest point for each attachment attached to it." "Forced: After you travel to a
  // location, attach the top card of your loot deck faceup to that location as a guarded objective. If that attachment has the
  // guarded X keyword, ignore it." "Forced: When the active location is explored, you may put each guarded attachment on that
  // location into play at no cost, or add it to your hand."
  { id: "22024:constant:1", cardCode: "22024", lines: ["22024:A:1"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "noCards", type: "attachment" } }] },
  { id: "22024:setup:1", cardCode: "22024", lines: ["22024:A:2"], timing: "setup", instructions: [{ verb: "BuildLootDeck", size: 14, type: "attachment", traits: ["Item", "Artifact"] }, { verb: "FlipCard" }] },
  {
    id: "22024:constant:2",
    cardCode: "22024",
    lines: ["22024:B:1"],
    timing: "constant",
    condition: SIDE_B,
    instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", active: true }, eachAttached: { type: "attachment", control: "any" } }],
  },
  {
    id: "22024:forced:1",
    cardCode: "22024",
    lines: ["22024:B:2"],
    timing: "forced",
    trigger: "traveled",
    subject: { type: "location", control: "any" },
    condition: SIDE_B,
    instructions: [{ verb: "AttachLoot" }],
  },
  {
    id: "22024:forced:2",
    cardCode: "22024",
    lines: ["22024:B:3"],
    timing: "forced",
    trigger: "activeExplored",
    condition: SIDE_B,
    instructions: [
      {
        verb: "Each",
        pick: { type: "attachment", control: "you", from: "loot", guardsSubject: true },
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "play", instructions: [{ verb: "PutIntoPlay", card: "picked" }] },
              { id: "hand", instructions: [{ verb: "MovePicked", to: "hand" }] },
            ],
          },
        ],
      },
    ],
  },
  // Messenger of the King. Side A: "You cannot choose more than 2 heroes during setup." "Setup: Choose a non-neutral unique ally
  // from your deck and put it into play. Add the sum of that ally's printed Willpower, Attack, Defense, and hit points to your starting
  // threat. Then, flip this card over and attach it to that ally." Side B: "Attached ally loses the ally card type and gains the hero
  // card type" "Attached character cannot be readied more than once per phase" "Messenger of the King is immune to card effects while
  // attached character is in play." "If attached character leaves play, remove Messenger of the King from the game." The Setup resolves
  // after the mulligan, with the other Setup lines of the players' cards (families/sidequests/setup.ts; the designer's ruling, docs/brief.md).
  { id: "22134:constant:1", cardCode: "22134", lines: ["22134:A:1"], timing: "constant", instructions: [{ verb: "DeckRule", rule: { kind: "heroes", max: 2 } }] },
  {
    id: "22134:setup:1",
    cardCode: "22134",
    lines: ["22134:A:2"],
    timing: "setup",
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "ally", unique: true, nonNeutral: true, intoPlay: true } },
      { verb: "MovePicked", to: "play" },
      ...(["willpower", "attack", "defense", "hitPoints"] as const).map((stat) => ({ verb: "RaiseThreat" as const, amount: { stat, of: "picked" as const, printed: true }, starting: true as const, when: PICKED_IN_PLAY })),
      // "Flip this card over and attach it": attaching puts a card faceup, so it attaches first and then turns to side B.
      { verb: "AttachSelfToPicked", when: PICKED_IN_PLAY },
      { verb: "FlipCard", when: PICKED_IN_PLAY },
    ],
  },
  { id: "22134:constant:2", cardCode: "22134", lines: ["22134:B:1"], timing: "constant", condition: SIDE_B, instructions: [{ verb: "ModifyStat", stat: "heroType", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  { id: "22134:constant:3", cardCode: "22134", lines: ["22134:B:2"], timing: "constant", condition: SIDE_B, instructions: [{ verb: "ModifyStat", stat: "readyOncePerPhase", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  { id: "22134:constant:4", cardCode: "22134", lines: ["22134:B:3"], timing: "constant", condition: SIDE_B, instructions: [{ verb: "ModifyStat", stat: "immuneToCardEffects", amount: 1, until: "whileSourceInPlay" }] },
  // It goes out of the game in place of the discard pile an attachment goes to with its host (rr.attachment-cards).
  { id: "22134:constant:5", cardCode: "22134", lines: ["22134:B:4"], timing: "constant", condition: SIDE_B, instructions: [{ verb: "ModifyStat", stat: "removedWithHost", amount: 1, until: "whileSourceInPlay" }] },
];
