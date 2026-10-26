import type { Effect } from "../../../catalog/boundary.ts";

// Records for the EaAD player cards whose lines no template reads (data/cards/EaAD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 06058 Lord of Morthond
  {"id":"06058:constant:1","cardCode":"06058","lines":["06058:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Gondor","Outlands"]}]}]},
  {"id":"06058:response:1","cardCode":"06058","lines":["06058:A:2"],"timing":"response","trigger":"played","subject":{"type":"ally","control":"you","spheres":["lore","spirit","tactics"]},"eventSeat":"you","condition":{"kind":"allMatch","of":{"type":"hero","control":"you"},"match":{"type":"hero","control":"you","printedIcon":"leadership"}},"instructions":[{"verb":"Draw","amount":1}]},
  // 06059 Book of Eldacar (06059:constant:1 is the generated "Attach to a Tactics hero"). Line 3 plays an event from the
  // discard pile, which no verb does.
  {"id":"06059:constant:2","cardCode":"06059","lines":["06059:A:2"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"hero","control":"you","printedIcon":"tactics"}}}]},
  // 06065 Hobbit-sense. An event's lasting effect reaches the cards in play when it resolves (rr.event-cards): the enemies
  // engaged with you, and the characters you control, which cannot be declared as attackers.
  {"id":"06065:constant:1","cardCode":"06065","lines":["06065:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"heroesAll","trait":"Hobbit"}}]},
  {"id":"06065:action:1","cardCode":"06065","lines":["06065:A:2"],"timing":"action","condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"endOfRound","holders":{"type":"enemy","control":"any","engaged":"you"}},{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"endOfRound","holders":{"type":"character","control":"you"}}]},
];

export const REPLACES: readonly string[] = [];
