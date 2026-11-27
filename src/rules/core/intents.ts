import type { Cause } from "./cause.ts";

export type EngineStep =
  | { kind: "push"; frame: string; cardId: string | null; peril: boolean }
  | { kind: "pop"; frame: string; cardId: string | null; peril: boolean }
  | { kind: "draw"; seat: number; cardId: string; cause: Cause }
  | { kind: "gainResource"; seat: number; heroId: string; cause: Cause }
  | { kind: "damage"; targetId: string; amount: number; cause: Cause }
  | { kind: "threat"; seat: number; amount: number; cause: Cause }
  // The Ring-bearer's life went down by -`amount` (mec109.ringbearers-life).
  | { kind: "life"; amount: number; cause: Cause }
  // `seat`: the player whose card effect placed it, stamped only in a game with a card that hears who placed progress (`eventSeat`, 19102:A:2).
  | { kind: "progress"; targetId: string; amount: number; cause: Cause; seat?: number }
  // `under`: an Aflame location placed facedown underneath The Havens Burn (dcce.aflame): out of play and hidden, so no line names it.
  | { kind: "destroy"; targetId: string; under?: true }
  | { kind: "eliminate"; seat: number }
  | { kind: "reveal"; seat: number; cardId: string; cause: Cause }
  // `boarding`: the ship-enemy whose Boarding keyword revealed this enemy from the Corsair deck (dcce.boarding); absent on every other engagement.
  | { kind: "engage"; seat: number; enemyId: string; boarding?: string }
  // An engaged enemy went back to the staging area by an effect (a shadow card, a location, an ability): `cause` is the effect that returned it.
  | { kind: "returnToStaging"; enemyId: string; cause: Cause }
  | { kind: "commit"; cardId: string }
  | { kind: "hideCommit"; cardId: string }
  | { kind: "fortitudeCommit"; cardId: string }
  | { kind: "escapeCommit"; cardId: string }
  // `seat`: the player who made the test, null for a party test (every player commits to it). `stat`: what the committed characters counted, left out for Willpower.
  | { kind: "escapeTest"; seat: number | null; dealtIds: readonly string[]; committed: number; escape: number; success: boolean; stat?: "attack" | "defense" }
  // The locate test (dwd.locate-test): `handIds` the cards the tester discarded from his hand, `dealtIds` the encounter cards each discarded, in order; the last one passed it when `success`.
  | { kind: "locateTest"; seat: number; handIds: readonly string[]; dealtIds: readonly string[]; success: boolean }
  // A burgle attempt (hob.burgle): `dealtIds` the encounter cards step 1 discarded, the last one the card with the burgle effect; `revealedId` the card step 2 revealed (null with an empty deck); `discardedIds` the hand cards step 3 discarded; the attempt succeeded when `success`.
  | { kind: "burgle"; seat: number; dealtIds: readonly string[]; revealedId: string | null; discardedIds: readonly string[]; success: boolean }
  | { kind: "fortitudeTest"; seat: number; discardedIds: readonly string[]; willpower: number; eyes: number; success: boolean }
  | { kind: "hideTest"; cardId: string; discardedIds: readonly string[]; willpower: number; threat: number; success: boolean }
  // `stormcaller`: the Stormcaller's quest stage advanced (dcce.stormcallers-area-stages), not the players' quest.
  // `random`: a stage chosen at random by a record that announces it (`announce`, The Crossings of Poros): the stages it was chosen among (the ones the quest deck still held) and the card line that named the draw.
  | { kind: "advance"; cardId: string; stormcaller?: true; random?: { from: readonly string[]; cause: Cause } }
  // A stage left the quest by a record that announces it (`announce`): removed from the game (RemoveStage) or set aside (SetStagesAside). `cause` is its line.
  | { kind: "stageLeaves"; cardId: string; how: "removed" | "setAside"; cause: Cause }
  // A card whose control follows the first player token (ControlledBy `announce`) passed to the seat that holds the token now.
  | { kind: "controlPasses"; cardId: string; seat: number; cause: Cause }
  // The numbers quest resolution compared (rr.step-3-4): committed willpower against the threat in staging. It reports what
  // the engine read; the threat or progress that followed is its own step.
  | { kind: "quest"; willpower: number; threat: number; cause: Cause }
  // A players' attack names the characters declared as attackers (`attackerIds`, rr.step-6-8b), which the table's spotlight shows.
  | { kind: "attack"; side: "enemy" | "player"; seat: number; enemyId: string; attackerIds?: readonly string[] }
  // The numbers an attack's combat damage came from (rr.step-6-4-3, rr.step-6-8-3): the attack strength against the defense
  // of the card it hits (0 for the hero an undefended attack hits, `undefended`). The damage placed is the `damage` step
  // after it.
  | { kind: "strike"; side: "enemy" | "player"; enemyId: string; targetId: string; attack: number; defense: number; undefended: boolean; cause: Cause }
  // `by`: the card whose effect canceled a revealed card (Trapped Inside a Barrow, 148004:B:1); absent when a player canceled an effect.
  | { kind: "cancel"; cardId: string; by?: string }
  // An enemy attached itself facedown to a location in the staging area (dcce.grapple): the enemy is not named, it is facedown now.
  | { kind: "grapple"; enemyId: string; locationId: string }
  // A random set-aside card was attached to a host in play (a Capture objective on a Wild Mûmak, 17027:A:1): `seat` is the player the host is engaged with, null while it is in the staging area.
  | { kind: "attachDrawn"; cardId: string; hostId: string; seat: number | null }
  // A hero claimed an objective that announces its claim (the flag `announcesClaim`, The Black Serpent's Harad objectives): the objective lies attached to the hero, controlled by `seat`.
  | { kind: "claim"; cardId: string; heroId: string; seat: number }
  // A grappled enemy came out from under its location, faceup, into the staging area (dcce.grapple): named, it was seen faceup when it was revealed.
  | { kind: "detach"; enemyId: string; locationId: string }
  // A Stormcaller Elite card turned to its objective ally side and a player took it (dcce.stormcaller-elite); the card is the same instance.
  | { kind: "flip"; cardId: string; seat: number }
  // The cards of an encounter set left the game (RemoveEncounterSet), or the set-aside cards of one were shuffled into the encounter deck (ShuffleSetAsideSet): how many (dcce.stormcaller-and-the-thing).
  | { kind: "removeSet"; set: string; count: number }
  | { kind: "shuffleSet"; set: string; count: number }
  | { kind: "resetEncounterDeck"; count: number; cause: Cause }
  // A named deck with a discard pile of its own ran out and the discard pile was shuffled back into it (the Corsair, Evil Creatures, Balrog and Smaug decks): `deck` is the deck's zone, `count` the cards that went back.
  | { kind: "reshuffleDeck"; deck: string; count: number; cause: Cause }
  // Discover X resolved for the active location: the cards looked at (top of the encounter deck first), the Loot objective attached to it as a guarded objective and the Hazard card revealed, if any (emce.discover). The rest went to the encounter discard pile.
  | { kind: "discover"; locationId: string; looked: readonly string[]; loot?: string; hazard?: string; cause: Cause }
  // Beneath the Sands' Track keyword resolved (hrd.track): the location (`locationId`, null when no card ran it), the Track value, the encounter cards discarded (top first), those of them that print On Track, and whether the Search objective flipped to On Track.
  | { kind: "track"; locationId: string | null; amount: number; discarded: readonly string[]; marked: readonly string[]; flipped: boolean; cause: Cause }
  // The Search objective flipped to `to` (hrd.search-objective): the objective card, which keeps its place and shows its other side.
  | { kind: "searchFlip"; cardId: string; to: "onTrack" | "offTrack"; cause: Cause }
  // A card from the encounter discard pile was set aside for the Resolution to add a copy of to the campaign pool (A Growing Threat, 12167:A:2; emce.campaign-pool-encounter): the card that did it and the card set aside.
  | { kind: "setAsideForPool"; sourceId: string; cardId: string; cause: Cause }
  // A card of a player's hand was put facedown underneath a card in play (Discovered!, 08134:A:2): hidden, so the line never names it.
  | { kind: "placeUnder"; seat: number; hostId: string }
  // A character was given poison (hob.venom-poison): `count` is the poison it has now, `of` its printed hit points; one more at `of` makes it unconscious.
  | { kind: "poison"; targetId: string; count: number; of: number; cause: Cause }
  // A character was made unconscious (hob.unconscious-characters), or, with `ready`, readied from it.
  | { kind: "unconscious"; targetId: string; ready?: true; cause: Cause };

export type Payment = { heroId: string; amount: number };

export type PlayerIntent =
  | { type: "Keep" }
  | { type: "Mulligan" }
  | { type: "Pass" }
  // The players give the scenario up from the table menu: the game is lost, whatever window is open.
  | { type: "Resign" }
  | { type: "PlayCard"; cardId: string; payments: readonly Payment[]; hostId?: string }
  | { type: "Commit"; cardIds: readonly string[] }
  | { type: "CommitHide"; cardIds: readonly string[] }
  | { type: "CommitFortitude"; cardIds: readonly string[] }
  | { type: "CommitEscape"; cardIds: readonly string[] }
  | { type: "Travel"; locationId: string }
  | { type: "DeclineTravel" }
  | { type: "Engage"; enemyId: string }
  | { type: "DeclineEngage" }
  | { type: "ChooseEnemy"; enemyId: string }
  | { type: "DeclareDefender"; defenderId: string }
  | { type: "Undefended"; heroId?: string }
  | { type: "DeclareAttackers"; enemyId: string; attackerIds: readonly string[] }
  | { type: "DeclineAttack" }
  | { type: "Distribute"; assignments: readonly { cardId: string; amount: number }[] }
  | { type: "Trigger"; cardId: string; effectId: string; payments?: readonly Payment[] }
  | { type: "Choose"; optionId: string }
  | { type: "ChooseResolution"; optionId: string }
  | { type: "Draw"; amount?: number }
  | { type: "GainResources"; amount?: number }
  | { type: "PayCost"; amount?: number }
  | { type: "DealDamage"; amount?: number }
  | { type: "PlaceProgress"; amount?: number }
  | { type: "RaiseThreat"; amount?: number };

export type LegalIntent =
  | { type: "Keep" }
  | { type: "Mulligan" }
  | { type: "Pass" }
  | { type: "PlayCard"; cardId: string }
  | { type: "Commit" }
  | { type: "CommitHide" }
  | { type: "CommitFortitude" }
  | { type: "CommitEscape" }
  | { type: "Travel" }
  | { type: "DeclineTravel" }
  | { type: "Engage" }
  | { type: "DeclineEngage" }
  | { type: "ChooseEnemy" }
  | { type: "DeclareDefender" }
  | { type: "Undefended" }
  | { type: "DeclareAttackers" }
  | { type: "DeclineAttack" }
  | { type: "Distribute"; total: number }
  | { type: "Trigger"; cardId: string; effectId: string }
  | { type: "Choose"; optionId: string }
  | { type: "ChooseResolution"; optionId: string };

export type Selection =
  | { type: "PlayCard"; cardId: string }
  | { type: "Commit" }
  | { type: "CommitHide" }
  | { type: "CommitFortitude" }
  | { type: "CommitEscape" }
  | { type: "Travel" }
  | { type: "Engage" }
  | { type: "ChooseEnemy" }
  | { type: "DeclareDefender" }
  | { type: "Undefended" }
  | { type: "DeclareAttackers"; cardId: string }
  | { type: "Distribute" };

export const ENGINE_NUMBER_INTENTS = new Set<PlayerIntent["type"]>([
  "Draw",
  "GainResources",
  "PayCost",
  "DealDamage",
  "PlaceProgress",
  "RaiseThreat",
]);

export function suppliesNumber(intent: PlayerIntent): boolean {
  if (ENGINE_NUMBER_INTENTS.has(intent.type)) return true;
  const record = intent as { amount?: unknown; damage?: unknown; threat?: unknown; progress?: unknown };
  return record.amount != null || record.damage != null || record.threat != null || record.progress != null;
}
