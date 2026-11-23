import type { Condition, Effect, Instruction, PickSpec, SimpleInstruction } from "../../../catalog/boundary.ts";

// Authored records for the player's deck, hand and discard pile: look, arrange, search, return, play from the discard pile (docs/agents/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
//
// Conventions: "look at the top N cards" is LookAtTop (deck `own`, or `picked` for another player's deck), "add 1 of those
// cards" a Pick with `looked`, "return them in any order" ArrangeTop. "Search the top N cards for a card" is a Pick from the
// deck with `top`, "up to N" / "any number" an Each with `upTo`. "That player searches" is ActAs `pickedPlayer`. "Name a
// number" is ChooseX (0 to 6, the highest printed cost in the pool); "name a card type" a Choose with an option per type.

// The printed card types a player deck holds, for "name a card type".
const TYPES = ["ally", "attachment", "event"] as const;

// "If you paid all of its resource cost from a single hero's resource pool" (as the costs family's Linhir Sea-captain).
const SINGLE_PAYER = { kind: "count", pick: { type: "hero", control: "you", paidFor: "subject" }, min: 1, max: 1 } as const;

const committedSelf: Condition = { kind: "matches", card: "self", pick: { type: "character", control: "any", committed: true } };
// "After X quests successfully": the quest has resolved and cleared the live committed mark, so the round's record of who quested answers (state.quested).
const questedSelf: Condition = { kind: "matches", card: "self", pick: { type: "character", control: "any", questedThisRound: true } };

// "Discard ~ to play any Tactics event card in your discard pile as if it were in your hand. Then, place that event on the
// bottom of your deck."
function playFromDiscard(code: string, sphere: "tactics" | "spirit" | "leadership" | "lore"): Effect {
  const pick: PickSpec = { type: "card", control: "you", from: "discard", cardType: "event", sphere };
  return {
    id: `${code}:action:1`,
    cardCode: code,
    lines: [`${code}:A:3`],
    timing: "action",
    cost: { kind: "discardSelf" },
    condition: { kind: "canPick", pick },
    instructions: [{ verb: "PlayFrom", pick }, { verb: "PutOnDeck", position: "bottom" }],
  };
}

// "Name a card type": one option per type.
function named(instructions: (type: (typeof TYPES)[number]) => SimpleInstruction[]): Instruction {
  return { verb: "Choose", who: "actor", options: TYPES.map((type) => ({ id: type, instructions: instructions(type) })) };
}

// "Search the top 5 cards of your deck for X and add it to your hand. Shuffle your deck."
function search(pick: Omit<PickSpec, "type" | "control" | "from">): Instruction[] {
  return [{ verb: "Pick", pick: { type: "card", control: "you", from: "deck", ...pick } }, { verb: "MovePicked", to: "hand" }, { verb: "ShuffleDeck" }];
}

const gondorAlly: PickSpec = { type: "card", control: "you", from: "deck", top: 5, cardType: "ally", trait: "Gondor" };
const lowThreat: Condition = { kind: "threat", max: 39, valour: true };

export const RECORDS: readonly Effect[] = [
  // 01049 Will of the West: the event is removed from the game instead of going to the discard pile.
  {"id":"01049:action:1","cardCode":"01049","lines":["01049:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"ShuffleDiscardIntoDeck","who":"picked"},{"verb":"MoveCard","card":"self","to":"removed"}]},
  // 01054 Fortune or Fate
  {"id":"01054:action:1","cardCode":"01054","lines":["01054:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","from":"discard","intoPlay":true}},{"verb":"PutIntoPlay","card":"picked","who":"owner"}]},
  // 01067 Gandalf's Search: X is what was paid for it; the actor looks and chooses, the card goes to its owner's hand.
  {"id":"01067:action:1","cardCode":"01067","lines":["01067:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"LookAtTop","count":{"x":true},"deck":"picked"},{"verb":"Pick","pick":{"type":"card","control":"any","from":"deck","looked":true}},{"verb":"MovePicked","to":"hand"},{"verb":"ArrangeTop"}]},
  // 02054 To the Eyrie
  {"id":"02054:response:1","cardCode":"02054","lines":["02054:A:1"],"timing":"response","trigger":"characterDestroyed","subject":{"type":"ally","control":"any"},"cost":{"kind":"playEvent"},"condition":{"kind":"canPick","pick":{"type":"character","control":"you","trait":"Eagle","state":"ready"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","trait":"Eagle","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"MoveCard","card":"subject","to":"hand","from":["discard"]}]},
  // 02079 Gildor Inglorion: the card from the hand takes the switched card's place among the three put back.
  {"id":"02079:action:1","cardCode":"02079","lines":["02079:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"LookAtTop","count":3,"deck":"own"},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","looked":true}},{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand"}},{"verb":"SwapPicked"},{"verb":"ArrangeTop"}]},
  // 03009 Zigil Miner: X is the named number, then how many of the two discarded cards cost that much.
  {"id":"03009:action:1","cardCode":"03009","lines":["03009:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ChooseX","max":[6],"min":0},{"verb":"DiscardFromDeck","amount":2,"count":{"type":"card","control":"any","costIsX":true}},{"verb":"Pick","pick":{"type":"hero","control":"you"},"when":{"kind":"matches","card":"picked"}},{"verb":"AddResources","amount":{"x":true},"to":"picked"}]},
  // 04002 Taking Initiative: the discarded card is picked only when its printed cost is high enough.
  {"id":"04002:action:1","cardCode":"04002","lines":["04002:A:1"],"timing":"action","instructions":[{"verb":"DiscardFromDeck","amount":1,"count":{"type":"card","control":"any"},"costAtLeast":{"count":{"type":"character","control":"you"}}},{"verb":"Draw","amount":2,"when":{"kind":"matches","card":"picked"}},{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true},"when":{"kind":"matches","card":"picked"}},{"verb":"DamageCard","amount":2,"when":{"kind":"matches","card":"picked"}}]},
  // 04106 Imladris Stargazer: the chosen player looks and arranges.
  {"id":"04106:action:1","cardCode":"04106","lines":["04106:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any","deckHasCards":true}},{"verb":"ActAs","who":"pickedPlayer"},{"verb":"LookAtTop","count":5,"deck":"own"},{"verb":"ArrangeTop"}]},
  // 06059 Book of Eldacar, 06087 Map of Earnil, 06109 Tome of Atanatar, 06142 Scroll of Isildur.
  playFromDiscard("06059", "tactics"),
  playFromDiscard("06087", "spirit"),
  playFromDiscard("06109", "leadership"),
  playFromDiscard("06142", "lore"),
  // 06112 Emery: an Action used from the hand. The discard is its cost, made after Emery enters play (the same result); the
  // first discarded card of those spheres decides whether Emery is discarded.
  {"id":"06112:action:1","cardCode":"06112","lines":["06112:A:1"],"timing":"action","fromHand":true,"condition":{"kind":"all","conditions":[{"kind":"sourceIn","zone":"hand"},{"kind":"count","pick":{"type":"card","control":"you","from":"deck"},"min":3}]},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"PutIntoPlay","card":"self","who":"picked"},{"verb":"DiscardFromDeck","amount":3,"count":{"type":"card","control":"any","spheres":["tactics","lore","leadership"]}},{"verb":"Discard","target":{"kind":"self"},"when":{"kind":"matches","card":"picked"}}]},
  // 06116 Well-Equipped
  {"id":"06116:action:1","cardCode":"06116","lines":["06116:A:1"],"timing":"action","instructions":[{"verb":"DiscardFromDeck","amount":2},{"verb":"Choose","who":"actor","options":[
    {"id":"attach","requires":{"kind":"canPick","pick":{"type":"card","control":"you","from":"discard","looked":true,"cardType":"attachment"}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","looked":true,"cardType":"attachment"}},{"verb":"PutIntoPlay","card":"picked","host":{"type":"character","control":"any","trait":"Dwarf"}}]},
    {"id":"decline","instructions":[]}]}]},
  // 08009 The Tree People: returning the Silvan ally is the cost; one copy a phase for each player.
  {"id":"08009:action:1","cardCode":"08009","lines":["08009:A:1"],"timing":"action","limit":"oncePerPhaseGroupEachPlayer","condition":{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand"},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","trait":"Silvan","intoPlay":true}},{"verb":"MovePicked","to":"play"},{"verb":"ShuffleDeck"}]},
  // 08010 The White Council (line 1, its X, is another record's).
  {"id":"08010:action:1","cardCode":"08010","lines":["08010:A:2"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","different":true,"options":[
    {"id":"ready","requires":{"kind":"canPick","pick":{"type":"hero","control":"you"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"Ready","target":"picked"}]},
    {"id":"resource","requires":{"kind":"canPick","pick":{"type":"hero","control":"you"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
    {"id":"draw","instructions":[{"verb":"Draw","amount":1}]},
    {"id":"shuffle","requires":{"kind":"canPick","pick":{"type":"card","control":"you","from":"discard"}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard"}},{"verb":"PutOnDeck","position":"shuffle"}]}]}]}]},
  // 08032 Message from Elrond: the chosen player may give one card from the hand to another player.
  {"id":"08032:action:1","cardCode":"08032","lines":["08032:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"ActAs","who":"pickedPlayer"},{"verb":"Each","pick":{"type":"card","control":"you","from":"hand"},"upTo":1,"when":{"kind":"otherPlayer"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"other"}},{"verb":"GivePicked"},{"verb":"Delay","until":"endOfRound","subject":"picked","instructions":[{"verb":"MoveCard","to":"deckShuffle","from":["hand","play"]}]}]}]},
  // 10003 Rallying Cry: the Response moves the ally that left play from the discard pile; the Valour Action is a lasting effect
  // the engine reads where an ally leaves play.
  {"id":"10003:response:1","cardCode":"10003","lines":["10003:A:1"],"timing":"response","trigger":"allyLeftPlay","subject":{"type":"ally","control":"any"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"MoveCard","card":"subject","to":"hand","from":["discard"]}]},
  {"id":"10003:action:1","cardCode":"10003","lines":["10003:A:2"],"timing":"action","condition":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"ModifyStat","stat":"alliesToHand","amount":1,"until":"endOfPhase","target":"actorSeat"}]},
  // 10063 Hope Rekindled: the Valour Action (its Action is 10063:action:1; the player uses one of the two).
  {"id":"10063:action:2","cardCode":"10063","lines":["10063:A:2"],"timing":"action","condition":{"kind":"threat","min":40,"valour":true},"instructions":search({ top: 10, cardType: "event", valour: true })},
  // 10090 Silver Harp
  {"id":"10090:response:1","cardCode":"10090","lines":["10090:A:3"],"timing":"response","trigger":"discardedFromHand","subject":{"type":"card","control":"you"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"MoveCard","card":"subject","to":"hand","from":["discard"]}]},
  // 10145 Elven-light: played from the discard pile (10145:constant:1), it goes back to the hand instead of the discard pile.
  {"id":"10145:action:1","cardCode":"10145","lines":["10145:A:2"],"timing":"action","instructions":[{"verb":"ReturnEventToHand"},{"verb":"Draw","amount":1}]},
  // 11002 Galdor of the Havens: offered in the mulligan window, in place of the mulligan.
  {"id":"11002:response:1","cardCode":"11002","lines":["11002:A:1"],"timing":"response","trigger":"setupHandDrawn","instructions":[{"verb":"Each","pick":{"type":"card","control":"you","from":"hand"},"upTo":"any","instructions":[{"verb":"DiscardPicked"}]},{"verb":"Draw","amount":{"x":true}},{"verb":"KeepOpeningHand"}]},
  // 11006 Warden of the Havens, 11012 Sailor of Lune: the top card of the discard pile is the last one put there.
  {"id":"11006:constant:1","cardCode":"11006","lines":["11006:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"card","control":"you","from":"discard","top":1,"cardType":"attachment"},"min":1},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"11012:constant:1","cardCode":"11012","lines":["11012:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"card","control":"you","from":"discard","top":1,"cardType":"event"},"min":1},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"whileSourceInPlay","when":committedSelf}]},
  // 12009 Heed the Dream: the chosen player searches; the group may pay for a second search of the whole deck only when the first search found a card (rr.then).
  {"id":"12009:action:1","cardCode":"12009","lines":["12009:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"ActAs","who":"pickedPlayer"},...search({ top: 5 }),{"verb":"ActAs","who":"actor"},{"verb":"Choose","who":"actor","options":[
    {"id":"spend","requires":{"kind":"all","conditions":[{"kind":"matches","card":"picked","pick":{"type":"card","control":"any"}},{"kind":"resources","min":3,"sphere":"leadership","group":true}]},"instructions":[{"verb":"SpendResources","amount":3,"sphere":"leadership","group":true},{"verb":"ActAs","who":"pickedPlayer"},...(search({}) as SimpleInstruction[])]},
    {"id":"decline","instructions":[]}]}]},
  // 12033 Master Ironsmith: from the hand or the discard pile, onto the hero that paid for it.
  {"id":"12033:response:1","cardCode":"12033","lines":["12033:A:1"],"timing":"response","trigger":"played","subject":"self","eventSeat":"you","condition":SINGLE_PAYER,"instructions":[{"verb":"Choose","who":"actor","options":(["hand","discard"] as const).map((from) => ({"id":from,"requires":{"kind":"canPick","pick":{"type":"card","control":"you","from":from,"cardType":"attachment","traits":["Weapon","Armor"]}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":from,"cardType":"attachment","traits":["Weapon","Armor"]}},{"verb":"PutIntoPlay","card":"picked","host":{"type":"hero","control":"you","paidFor":"subject"}}]}) satisfies Extract<Instruction, { verb: "Choose" }>["options"][number])}]},
  // 12066 Ered Luin Miner: heard from the discard pile it went to.
  {"id":"12066:response:1","cardCode":"12066","lines":["12066:A:1"],"timing":"response","trigger":"discardedFromDeck","subject":"self","instructions":[{"verb":"PutIntoPlay","card":"self"}]},
  // 12118 The Houses of Healing (line 1, its cost, is another record's).
  {"id":"12118:action:1","cardCode":"12118","lines":["12118:A:2"],"timing":"action","condition":{"kind":"phase","is":"Refresh"},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","from":"discard","intoPlay":true}},{"verb":"PutIntoPlay","card":"picked","who":"owner","damage":1}]},
  // 12138 Prince Imrahil
  {"id":"12138:action:1","cardCode":"12138","lines":["12138:A:1"],"timing":"action","limit":"oncePerRound","cost":{"kind":"resources","amount":1,"from":"self"},"condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","sharesTrait":"self","intoPlay":true}},{"verb":"MovePicked","to":"play"},{"verb":"ShuffleDeck"},{"verb":"Delay","until":"endOfPhase","subject":"picked","instructions":[{"verb":"MoveCard","to":"deckShuffle","from":["play"]}]}]},
  // 131014 A Very Good Tale: X adds up the printed costs of the two allies exhausted for it.
  {"id":"131014:action:1","cardCode":"131014","lines":["131014:A:1"],"timing":"action","condition":{"kind":"count","pick":{"type":"ally","control":"you","state":"ready"},"min":2},"instructions":[
    {"verb":"Pick","pick":{"type":"ally","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"AddToX","amount":{"stat":"cost","of":"picked","printed":true}},
    {"verb":"Pick","pick":{"type":"ally","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"AddToX","amount":{"stat":"cost","of":"picked","printed":true}},
    {"verb":"DiscardFromDeck","amount":5,"shuffle":true},
    {"verb":"Each","pick":{"type":"card","control":"you","from":"discard","looked":true,"cardType":"ally","intoPlay":true},"upTo":2,"totalCost":{"x":true},"instructions":[{"verb":"PutIntoPlay","card":"picked"}]}]},
  // 132017 Expert Treasure-hunter: the discarded card is taken only if it is of the named type.
  {"id":"132017:response:1","cardCode":"132017","lines":["132017:A:2"],"timing":"response","trigger":"questSucceeded","eventSeat":"you","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","questedThisRound":true}},"instructions":[named((type) => [{"verb":"DiscardFromDeck","amount":1},{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","looked":true,"cardType":type}},{"verb":"MovePicked","to":"hand"}])]},
  // 16004 Erebor Guard: read when it is played (deck-play.ts): paying 2 less discards the top 2 cards of the deck.
  {"id":"16004:response:1","cardCode":"16004","lines":["16004:A:2"],"timing":"response","trigger":"paying","subject":"self","cost":{"kind":"discardDeckTop","amount":2},"instructions":[{"verb":"ReducePlayCost","amount":2}]},
  // 19008 Long Lake Fisherman
  {"id":"19008:response:1","cardCode":"19008","lines":["19008:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"ChooseX","max":[6],"min":0},...search({ top: 5, costIsX: true })]},
  // 19116 Drinking Song
  {"id":"19116:action:1","cardCode":"19116","lines":["19116:A:1"],"timing":"action","instructions":[{"verb":"ShuffleHandIntoDeck"},{"verb":"Draw","amount":{"x":true}},{"verb":"Draw","amount":1,"when":{"kind":"count","pick":{"type":"character","control":"you","trait":"Hobbit","unique":true},"min":1}}]},
  // 19146 Messenger Raven: the chosen player looks at their top card; it is taken if it is of the named type, else discarded.
  {"id":"19146:action:1","cardCode":"19146","lines":["19146:A:2"],"timing":"action","cost":{"kind":"returnSelfToHand"},"condition":{"kind":"phase","is":"Refresh"},"instructions":[named((type) => [{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"ActAs","who":"pickedPlayer"},{"verb":"LookAtTop","deck":"own"},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","looked":true,"cardType":type}},{"verb":"MovePicked","to":"hand"},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","looked":true}},{"verb":"DiscardPicked"}])]},
  // 19153 Reforged: X is what was paid for it.
  {"id":"19153:action:1","cardCode":"19153","lines":["19153:A:1"],"timing":"action","instructions":[{"verb":"PlayFrom","pick":{"type":"card","control":"any","from":"discard","cardType":"attachment","trait":"Item","costIsX":true},"free":true}]},
  // 22002 Soldier of Gondor
  {"id":"22002:response:1","cardCode":"22002","lines":["22002:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":gondorAlly,"when":lowThreat},{"verb":"MovePicked","to":"hand","when":lowThreat},{"verb":"Each","pick":gondorAlly,"upTo":"any","when":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"MovePicked","to":"hand"}]},{"verb":"ShuffleDeck"}]},
  // 22027 Lothíriel (line 1 is another record's): only an ally that shares a Trait with her can enter play, so the choice is
  // among those.
  {"id":"22027:response:1","cardCode":"22027","lines":["22027:A:2"],"timing":"response","trigger":"committed","subject":"self","condition":{"kind":"canPick","pick":{"type":"card","control":"you","from":"hand","cardType":"ally","sharesTrait":"self","intoPlay":true}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand","cardType":"ally","sharesTrait":"self","intoPlay":true}},{"verb":"PutIntoPlay","card":"picked","committed":true},{"verb":"Delay","until":"endOfPhase","subject":"picked","instructions":[{"verb":"MoveCard","to":"deckShuffle","from":["play"]}]}]},
  // 22062 The Muster of Rohan (line 1 is the costs family's).
  {"id":"22062:action:1","cardCode":"22062","lines":["22062:A:2"],"timing":"action","condition":{"kind":"phase","is":"Planning"},"instructions":[{"verb":"Each","pick":{"type":"card","control":"you","from":"deck","top":10,"cardType":"ally","trait":"Rohan","intoPlay":true},"upTo":4,"instructions":[{"verb":"MovePicked","to":"play"},{"verb":"Delay","until":"endOfRound","subject":"picked","instructions":[{"verb":"Discard","target":{"kind":"picked"},"when":{"kind":"matches","card":"picked","inPlay":true}}]}]},{"verb":"ShuffleDeck"}]},
  // 22063 Saruman's Staff
  {"id":"22063:action:1","cardCode":"22063","lines":["22063:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"doomed","instructions":[{"verb":"ReduceNextDoomed","amount":2,"until":"endOfPhase"}]},
    {"id":"search","instructions":search({ top: 5, cardType: "event", keyword: "doomed" }) as SimpleInstruction[]}]}]},
  // 22140 Haleth
  {"id":"22140:response:1","cardCode":"22140","lines":["22140:A:1"],"timing":"response","trigger":"questSucceeded","eventSeat":"you","condition":questedSelf,"instructions":search({ top: 5, cardType: "attachment" })},
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
