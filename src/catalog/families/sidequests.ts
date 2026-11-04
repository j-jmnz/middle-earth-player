// The vocabulary player side quests, contracts, encounter-keyword player cards and the victory display adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

// A deckbuilding rule a contract prints on its side A (src/catalog/deck-rules.ts reads them): `noCards`, "Your deck cannot include
// ally cards"; `copies`, no more than this many copies of a title; `heroes`, how many starting heroes (and, with `differentSpheres`,
// each of a different sphere); `size`, the deck holds at least `min` or exactly `exactly` cards; `perSphere`, exactly this many
// cards of each of the Leadership, Lore, Spirit and Tactics spheres.
export const deckRuleSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("noCards"), type: z.enum(["ally", "attachment"]) }),
  z.strictObject({ kind: z.literal("copies"), max: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("heroes"), max: z.number().int().positive(), differentSpheres: z.boolean().optional() }),
  z.strictObject({ kind: z.literal("size"), min: z.number().int().positive().optional(), exactly: z.number().int().positive().optional() }),
  z.strictObject({ kind: z.literal("perSphere"), count: z.number().int().positive() }),
]);
export type DeckRule = z.infer<typeof deckRuleSchema>;

const VERBS = [
  // Constant on a card that goes to the victory display ("Limit 3 copies of ~ in the victory display"): the display holds at
  // most `copies` of its title. A copy that would be added beyond that goes to its owner's discard pile instead
  // (src/rules/families/sidequests/victory.ts).
  z.strictObject({ verb: z.literal("VictoryLimit"), copies: z.number().int().positive(), ...when }),
  // Constant on a side quest ("Battle.", "Siege."): the characters committed to it quest with this stat instead of their
  // Willpower (src/rules/families/sidequests/quest.ts).
  z.strictObject({ verb: z.literal("QuestsWith"), stat: z.enum(["attack", "defense"]), ...when }),
  // The actor is eliminated from the game by a card effect ("At the end of the round, you are eliminated from the game",
  // rr.player-elimination).
  z.strictObject({ verb: z.literal("EliminatePlayer"), ...when }),
  // Constant on a card in hand ("Limit 2 copies of ~ in play"): it cannot be played while this many copies of its title are in
  // play (src/rules/families/sidequests/play.ts).
  z.strictObject({ verb: z.literal("InPlayLimit"), copies: z.number().int().positive(), ...when }),
  // The source card is removed from the campaign pool ("add ~ to the victory display and remove it from the campaign pool"): the
  // campaign log drops it when the scenario is won.
  z.strictObject({ verb: z.literal("RemoveFromCampaignPool"), ...when }),
  // Constant on a player card ("Encounter."): the card is not part of its player's drawn deck. At the start of the game it is set
  // aside, still its owner's card; a player card effect shuffles it into the encounter deck, where it is revealed like an
  // encounter card (src/rules/families/sidequests/encounter.ts).
  z.strictObject({ verb: z.literal("EncounterKeyword"), ...when }),
  // Shuffles one set-aside copy of the card with this code into the encounter deck ("Shuffle 1 of your set aside Ranger of the
  // North allies into the encounter deck"): the actor's own copy with `own`, any player's otherwise. Nothing happens with none.
  z.strictObject({ verb: z.literal("ShuffleSetAsideIntoEncounterDeck"), code: z.string().min(1), own: z.boolean().optional(), ...when }),
  // The source card, an Encounter-keyword player card just revealed into the staging area, enters the play area of the player
  // `who` names (the last picked player, the actor or the first player): ready, or `committed` to the quest, still its owner's card.
  z.strictObject({ verb: z.literal("TakeRevealedCard"), who: z.enum(["picked", "actor", "firstPlayer"]), committed: z.boolean().optional(), ...when }),
  // The source card is flipped over: side A becomes side B and side B side A ("flip this card over"). `flipped` is announced about
  // it. A contract's records name their side in their line ids (`21074:B:1`) and carry a `faceUp` condition for it.
  z.strictObject({ verb: z.literal("FlipCard"), ...when }),
  // The actor's loot deck is built from the cards they chose at deckbuilding (StartSeat.loot), shuffled and set aside under the
  // contract (The Burglar's Turn, src/rules/families/sidequests/loot.ts).
  z.strictObject({ verb: z.literal("BuildLootDeck"), ...when }),
  // The top card of the actor's loot deck is attached faceup to the location the answered event is about, as a guarded objective:
  // out of play under that location until it is explored.
  z.strictObject({ verb: z.literal("AttachLoot"), ...when }),
  // Constant on a card in play: its controller cannot play, or put into play, a card that matches `pick` ("You cannot play
  // non-unique allies or put non-unique allies into play"). A card in a hand, a deck or a discard pile is read from its owner's side.
  // `anyPlayer`: the card bars every player, whoever controls it ("players cannot play attachments or allies", 12092:B:1, 12093:B:1), from playing a matching card from their hand; a card
  // put into play is not played (rr.play-and-put-into-play), so it is left alone. Without it only the controller is barred, from playing and from putting into play.
  z.strictObject({ verb: z.literal("CannotPlay"), pick: pickSchema, anyPlayer: z.literal(true).optional(), ...when }),
  // Constant on a card in play: the first card that matches `pick` its controller plays on each of their heroes each round costs
  // `amount` less ("Reduce the cost of the first restricted attachment you play on each of your heroes each round by 1").
  z.strictObject({ verb: z.literal("ReduceFirstOnEachHero"), pick: pickSchema, amount: z.number().int().positive(), ...when }),
  // Constant on a contract: a deckbuilding rule of its side A (src/catalog/deck-rules.ts). It does nothing in a game.
  z.strictObject({ verb: z.literal("DeckRule"), rule: deckRuleSchema, ...when }),
] as const;

const TRIGGERS = [
  // About a side quest: its progress reached its quest points and it was defeated. A player side quest in the victory display or
  // its owner's discard pile hears it ("Response: When this stage is defeated, ...").
  "questDefeated",
  // About a card: it was flipped over (the FlipCard verb); a contract hears "When this card is flipped to this side".
  "flipped",
] as const;

const FLAGS = [
  // On a seat: its threat cannot be reduced by player card effects (1), or by those of cards that are not contracts (2).
  "noThreatReduction",
  // Held by a seat until the end of the round: the option of Council of the Wise (22091:A:2) already taken this round.
  "councilThreat",
  "councilDraw",
  "councilResource",
] as const;

export const manifest = { name: "sidequests", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
