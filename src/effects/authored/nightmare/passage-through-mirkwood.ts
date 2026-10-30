import type { Effect } from "../../../catalog/boundary.ts";

// Passage Through Mirkwood Nightmare (deck 9001, data/printed/nightmare.json). Nightmare Ungoliant's Spawn (900102) takes the place of the
// standard one (01076): the quest's records that name it by title or by code read it (twinCode, src/rules/families/nightmare-guards.ts).
// Rules: rr.setup, rr.forced, rr.reveal, rr.step-6-4-2, rr.attachment-cards (data/rules/entries.json).
const UNDEFENDED = { kind: "undefended" } as const;
const NOT_UNDEFENDED = { kind: "not", condition: UNDEFENDED } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 900101 Passage Through Mirkwood Nightmare (setup card, side A): each player reveals a card once the piles are dealt (rr.setup).
  {"id":"900101:forced:1","cardCode":"900101","lines":["900101:A:2"],"timing":"forced","trigger":"duringSetup","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RevealEncounter"}]}]},
  // 900102 Ungoliant's Spawn: the committed characters get -2 Willpower, and each one left at 0 is discarded when the effect resolves.
  {"id":"900102:whenRevealed:1","cardCode":"900102","lines":["900102:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":-2,"until":"endOfPhase","holders":{"type":"character","control":"any","committed":true}},{"verb":"Each","pick":{"type":"character","control":"any","committed":true,"maxWillpower":0},"instructions":[{"verb":"DiscardPicked"}]}]},
  {"id":"900102:shadow:1","cardCode":"900102","lines":["900102:A:2"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":5,"who":"actor","when":NOT_UNDEFENDED},{"verb":"RaiseThreat","amount":10,"who":"actor","when":UNDEFENDED}]},
  // 900103 Ungoliant's Brood: the engaged player's cards in play cannot ready until the end of the round, the refresh phase included.
  {"id":"900103:forced:1","cardCode":"900103","lines":["900103:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"ModifyStat","stat":"cannotReady","amount":1,"until":"endOfRound","holders":{"type":"card","control":"you"}}]},
  {"id":"900103:shadow:1","cardCode":"900103","lines":["900103:A:2"],"timing":"shadow","instructions":[{"verb":"Each","pick":{"type":"character","control":"you","state":"ready"},"instructions":[{"verb":"Exhaust","target":{"kind":"picked"}}],"when":UNDEFENDED}]},
  // 900104 Forest Flies
  {"id":"900104:forced:1","cardCode":"900104","lines":["900104:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"DamageEach","amount":1,"pick":{"type":"character","control":"you","state":"exhausted"}}]},
  {"id":"900104:shadow:1","cardCode":"900104","lines":["900104:A:2"],"timing":"shadow","instructions":[{"verb":"DealShadowTo","target":"attacker","when":{"kind":"matches","card":"attacker","pick":{"type":"enemy","control":"any","trait":"Insect"}}},{"verb":"DealShadowTo","target":"attacker","when":{"kind":"matches","card":"attacker","pick":{"type":"enemy","control":"any","trait":"Insect"}}}]},
  // 900105 Spiders of Mirkwood
  {"id":"900105:constant:1","cardCode":"900105","lines":["900105:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"engaged"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"character","control":"you","state":"exhausted"}},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"900105:shadow:1","cardCode":"900105","lines":["900105:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"DamageCard","amount":2,"target":"picked","when":UNDEFENDED}]},
  // 900106 The Spider's Web, in printed order: the player with the highest threat (the first player chooses among a tie) exhausts each hero he
  // controls, then attaches it to one of his heroes, which he chooses. The attachment's text is a triggered effect of the attached hero's readying.
  {"id":"900106:whenRevealed:1","cardCode":"900106","lines":["900106:A:1"],"timing":"whenRevealed","instructions":[{"verb":"PickHighestThreat"},{"verb":"Each","pick":{"type":"hero","control":"any","controlledBy":"picked","state":"ready"},"instructions":[{"verb":"Exhaust","target":{"kind":"picked"}}]},{"verb":"AttachSelf","to":{"kind":"hero","control":"picked"}}]},
  {"id":"900106:constant:1","cardCode":"900106","lines":["900106:A:1"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  {"id":"900106:triggered:1","cardCode":"900106","lines":["900106:A:1"],"timing":"triggered","trigger":"readied","subject":"host","instructions":[{"verb":"DamageCard","amount":1,"target":"host"}]},
  // 900107 Backtrack! (line 1 is Surge)
  {"id":"900107:whenRevealed:1","cardCode":"900107","lines":["900107:A:2"],"timing":"whenRevealed","instructions":[{"verb":"PickDiscardTop","types":["enemy","location"]},{"verb":"MoveEncounterCard","to":"staging"}]},
  {"id":"900107:shadow:1","cardCode":"900107","lines":["900107:A:3"],"timing":"shadow","instructions":[{"verb":"DealShadowFromDiscard"}]},
  // 900108 Abandoned Camp (line 1 is Immune to player card effects)
  {"id":"900108:forced:1","cardCode":"900108","lines":["900108:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","instructions":[{"verb":"DamageEach","amount":2,"pick":{"type":"character","control":"any","state":"exhausted"}}]},
  {"id":"900108:shadow:1","cardCode":"900108","lines":["900108:A:3"],"timing":"shadow","instructions":[{"verb":"Each","pick":{"type":"attachment","control":"any","playerCard":true},"instructions":[{"verb":"DiscardPicked"}],"when":UNDEFENDED}]},
  // 900109 Glade of the Spawn
  {"id":"900109:forced:1","cardCode":"900109","lines":["900109:A:1"],"timing":"forced","trigger":"encounterEnteredPlay","subject":{"type":"enemy","control":"any","trait":"Spider"},"condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
