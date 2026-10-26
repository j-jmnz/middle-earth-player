import type { Effect } from "../../../catalog/boundary.ts";

// Records for the ToR player cards whose lines no template reads (data/cards/ToR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 10084 Erestor. The 3 extra cards are drawn with the resource phase's draw.
  {"id":"10084:constant:1","cardCode":"10084","lines":["10084:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraDraw","amount":3,"until":"whileSourceInPlay","target":"actorSeat"}]},
  {"id":"10084:triggered:1","cardCode":"10084","lines":["10084:A:2"],"timing":"triggered","trigger":"endOfRound","instructions":[{"verb":"Each","pick":{"type":"card","control":"you","from":"hand"},"instructions":[{"verb":"DiscardPicked"}]}]},
  // 10086 Send for Aid (a player side quest: line 2 is no longer open)
  {"id":"10086:constant:1","cardCode":"10086","lines":["10086:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
  // 10087 Elven Spear
  {"id":"10087:constant:1","cardCode":"10087","lines":["10087:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Noldor","Silvan"]}]}]},
  {"id":"10087:action:1","cardCode":"10087","lines":["10087:A:2"],"timing":"action","limit":"thricePerPhase","condition":{"kind":"handHasCard"},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"host"}]},
  // 10088 Horn's Cry. The card is played once and resolves one of its two abilities: the Action, or (threat 40 or higher) the
  // Valour Action on a chosen player. With at most two seats, "another player" is the one other seat.
  {"id":"10088:action:1","cardCode":"10088","lines":["10088:A:1","10088:A:2"],"timing":"action","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"all","instructions":[{"verb":"ModifyStat","stat":"attack","amount":-1,"until":"endOfPhase","holders":{"type":"enemy","control":"any","staging":true}}]},
    {"id":"valour-you","requires":{"kind":"threat","min":40},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":-3,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"you"}}]},
    {"id":"valour-other","requires":{"kind":"all","conditions":[{"kind":"threat","min":40},{"kind":"otherPlayer"}]},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":-3,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"other"}}]}]}]},
  // 10089 Galadhrim Weaver
  {"id":"10089:constant:1","cardCode":"10089","lines":["10089:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"10089:response:1","cardCode":"10089","lines":["10089:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"card","control":"you","from":"discard"}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","topmost":true}},{"verb":"PutOnDeck","position":"shuffle","target":"picked"}]},
  // 10091 Galdor of the Havens: one event per discarded card, and the limit makes it "1 or more".
  {"id":"10091:response:1","cardCode":"10091","lines":["10091:A:1"],"timing":"response","trigger":"discardedFromHand","subject":{"type":"card","control":"you"},"limit":"oncePerRound","instructions":[{"verb":"Draw","amount":1}]},
  // 10093 Elf-friend (line 1 is the generated 10093:constant:1)
  {"id":"10093:constant:2","cardCode":"10093","lines":["10093:A:2"],"timing":"constant","instructions":[{"verb":"GrantTrait","trait":"Noldor"},{"verb":"GrantTrait","trait":"Silvan"}]},
];

export const REPLACES: readonly string[] = [];
