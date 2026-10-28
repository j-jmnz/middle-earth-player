import type { Effect } from "../../../catalog/boundary.ts";

// Records for The Dark of Mirkwood boons and burdens whose lines no template reads (data/cards/TDoM.json): the Adaptations of The Oath (41044 to 41047),
// Stalking Goblin (41041), Guilty Conscience (41043), and The Caves of Nibin-Dûm's Shiny Distraction (41042), "No Time to Waste!" (41048) and Ranger Sense (41049). Their "Setup. Attach to a hero." line is the generated setup record. Every line is read from the
// scan ledger (data/printed/mirkwood-paths.json).
// Rules: rr.limits, rr.search, rr.attachment-cards, rr.campaign-pool, rr.campaign-cards (data/rules/entries.json).
const ONCE_PER_CAMPAIGN = "oncePerCampaign" as const;
const DAMAGED_HERO = {"type":"hero","control":"any","damaged":true} as const;
const EXHAUSTED_HERO = {"type":"hero","control":"any","state":"exhausted"} as const;
const ENGAGED_ENEMY = {"type":"enemy","control":"any","engaged":"you"} as const;

export const RECORDS: readonly Effect[] = [
  // 41041 Stalking Goblin (burden enemy): after it engages a player the encounter deck, the discard pile and the collection are searched for a Goblin Sniper,
  // which goes to the staging area (collection: families/encounter-collection.ts); as a Shadow card it is added to the staging area.
  {"id":"41041:forced:1","cardCode":"41041","lines":["41041:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"SearchCollection","code":"41020","to":"staging"},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"41041:shadow:1","cardCode":"41041","lines":["41041:A:2"],"timing":"shadow","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"staging"}]},
  // 41043 Guilty Conscience (burden treachery, Surge): attached to the hero with the highest threat cost; it counts as an Adaptation attachment whose Forced raises
  // its hero's controller's threat by 2 at the end of each round and whose Action spends 2 resources from the hero's pool to discard it.
  {"id":"41043:whenRevealed:1","cardCode":"41043","lines":["41043:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"hero","control":"highestThreatCost"}}]},
  {"id":"41043:constant:1","cardCode":"41043","lines":["41043:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Adaptation"}]},
  {"id":"41043:forced:1","cardCode":"41043","lines":["41043:A:2"],"timing":"forced","trigger":"endOfRound","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any"}},"instructions":[{"verb":"RaiseThreat","amount":2,"who":"hostController"}]},
  {"id":"41043:action:1","cardCode":"41043","lines":["41043:A:2"],"timing":"action","cost":{"kind":"resources","amount":2,"from":"host"},"instructions":[{"verb":"Discard","target":{"kind":"self"}}]},
  // 41042 Shiny Distraction (burden treachery, Surge and Doomed 1 are keywords): each player may add 1 resource to each of his heroes' pools, and one who does raises his threat by 5.
  {"id":"41042:whenRevealed:1","cardCode":"41042","lines":["41042:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"add","instructions":[{"verb":"HeroesGainResources","amount":1,"who":"actor"},{"verb":"RaiseThreat","amount":5,"who":"actor"}]},{"id":"decline","instructions":[]}]}]}]},
  // 41048 "No Time to Waste!" (boon event, put in each hand by the campaign card): "choose one" is playing it for one of two Quest Actions. The first removes the card from the game
  // and the Campaign Pool, lowers each player's threat by 3 and reveals an encounter card.
  {"id":"41048:action:1","cardCode":"41048","lines":["41048:A:2"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"RemoveFromCampaignPool"},{"verb":"RemoveSourceFromGame"},{"verb":"LowerThreat","amount":3,"who":"eachSeat"},{"verb":"RevealEncounter"}]},
  {"id":"41048:action:2","cardCode":"41048","lines":["41048:A:3"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"Draw","amount":1}]},
  // 41049 Ranger Sense (boon event, earned by The Caves of Nibin-Dûm): one Action removes it from the game and the Campaign Pool to look at the top 4 cards of the deck, take 1 to the hand and
  // put the rest back in any order; the other draws a card.
  {"id":"41049:action:1","cardCode":"41049","lines":["41049:A:2"],"timing":"action","instructions":[{"verb":"RemoveFromCampaignPool"},{"verb":"RemoveSourceFromGame"},{"verb":"LookAtTop","count":4,"deck":"own"},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","looked":true}},{"verb":"MovePicked","to":"hand"},{"verb":"ArrangeTop"}]},
  {"id":"41049:action:2","cardCode":"41049","lines":["41049:A:3"],"timing":"action","instructions":[{"verb":"Draw","amount":1}]},
  // The Adaptations (boons): the attached hero gains a resource icon; an Action usable once per campaign (the use goes to the Campaign Log's `usedOnce`).
  // 41044 The Fervor of Lore: 3 cards discarded from hand heal all damage from a hero.
  {"id":"41044:constant:1","cardCode":"41044","lines":["41044:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"lore"}]},
  {"id":"41044:action:1","cardCode":"41044","lines":["41044:A:3"],"timing":"action","limit":ONCE_PER_CAMPAIGN,"condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"card","control":"you","from":"hand"},"min":3},{"kind":"canPick","pick":DAMAGED_HERO}]},"instructions":[{"verb":"DiscardFromHand","amount":3},{"verb":"Pick","pick":DAMAGED_HERO},{"verb":"Heal","all":true,"target":"picked"}]},
  // 41045 The Might of Tactics: 1 damage to the attached hero deals 3 damage to an enemy engaged with the player.
  {"id":"41045:constant:1","cardCode":"41045","lines":["41045:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"tactics"}]},
  {"id":"41045:action:1","cardCode":"41045","lines":["41045:A:3"],"timing":"action","limit":ONCE_PER_CAMPAIGN,"condition":{"kind":"canPick","pick":ENGAGED_ENEMY},"instructions":[{"verb":"DamageCard","amount":1,"target":"host"},{"verb":"Pick","pick":ENGAGED_ENEMY},{"verb":"DamageCard","amount":3,"target":"picked"}]},
  // 41046 The Power of Spirit: exhausting the attached hero places 3 progress on a location.
  {"id":"41046:constant:1","cardCode":"41046","lines":["41046:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"spirit"}]},
  {"id":"41046:action:1","cardCode":"41046","lines":["41046:A:3"],"timing":"action","limit":ONCE_PER_CAMPAIGN,"cost":{"kind":"exhaustHost"},"condition":{"kind":"canPick","pick":{"type":"location","control":"any"}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":3,"target":"picked"}]},
  // 41047 The Secret of Leadership: 1 resource from the attached hero's pool readies a hero.
  {"id":"41047:constant:1","cardCode":"41047","lines":["41047:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"leadership"}]},
  {"id":"41047:action:1","cardCode":"41047","lines":["41047:A:3"],"timing":"action","limit":ONCE_PER_CAMPAIGN,"cost":{"kind":"resources","amount":1,"from":"host"},"condition":{"kind":"canPick","pick":EXHAUSTED_HERO},"instructions":[{"verb":"Pick","pick":EXHAUSTED_HERO},{"verb":"Ready","target":"picked"}]},
];

export const REPLACES: readonly string[] = [];
