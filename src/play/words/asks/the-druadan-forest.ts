import type { Condition } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { BROODING_FOREST_ASKS } from "../scenarios/against-the-shadow/brooding-forest-asks.ts";

// The choice words of The Drúadan Forest (against-the-shadow part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-druadan-forest --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-druadan-forest` prints each sentence.
// A choice of one player's own (a Prowl discard, a payment, the shadow's pick for the defending player) is owned: two-handed the sentence leads with the player. The first player answers for the group at Ancestral Clearing's exhaust, so that sentence is not owned.
// The steps of a group verb (Prowl's discard, Garden of Poisons' payment) stand below the verb in the record walk (words/group-steps.ts): `@0.0` is the Prowl's Choose, `@0.0.discard.0` its hero Pick, `@0.0` the Garden's SpendResources.

// Prowl X (ats.prowl): the players as a group discard X resources from their heroes, each player in turn for his own heroes, one resource at a time, and he may stop while the players after him hold enough for the rest. A discard, not a spend. `{left}` is what is still to discard; `{forced}` says why no Stop row is offered.
// The count comes first and the sheet's title says the card: the sentence must show the count and the instruction whole in the dock.
const prowl = (record: string): Record<string, Ask> => ({
  [`${record} @0.0 Choose`]: { owned: true, note: "Left to discard: {left}. Discard 1 resource from one of your heroes, or stop and leave the rest to the players after you." },
  [`${record} @0.0 discard`]: { label: "Discard 1 resource from one of your heroes" },
  [`${record} @0.0 stop`]: { label: "Stop: the players after you discard the rest" },
  [`${record} @0.0.discard.0 Pick`]: { owned: true, note: "Left to discard: {left}. Choose one of your heroes to discard 1 resource from.{forced}", verb: "Discard" },
});

// "Shadow: Return attacking enemy to the staging area after it attacks unless any player pays 1 resource" (06047:A:3, 06049:A:2): the defending player decides, and the resource comes from the pool of any player's hero. With nothing to pay the enemy returns and nobody is asked.
const returnUnlessPaid = (record: string): Record<string, Ask> => ({
  [`${record} @0 Choose`]: { owned: true, note: "{card}, Shadow: it returns to the staging area after its attack unless any player pays 1 resource." },
  [`${record} @0 pay`]: { label: "Any player pays 1 resource: it stays engaged with you" },
  [`${record} @0 return`]: { label: "It returns to the staging area" },
  [`${record} @0.pay.0 SpendResources`]: { owned: true, note: "{card}, Shadow: choose the hero, any player's, whose pool pays 1 resource. The enemy stays engaged with you.", verb: "Pay" },
});

// "Each hero must pay 1 resource or <consequence>" (06053, 06054): each hero in turn, its controller deciding. A hero with no resource has the consequence only and is not asked.
const payOr = (record: string, note: string, consequence: string): Record<string, Ask> => ({
  [`${record} @0.0.0 Choose`]: { owned: true, note },
  [`${record} @0.0.0 pay`]: { label: "{picked} pays 1 resource from its pool" },
  [`${record} @0.0.0 consequence`]: { label: consequence },
  [`${record} @0.0.0.pay.0 SpendResources`]: { owned: true, note: "{card}: {picked} pays 1 resource from its pool.", verb: "Pay" },
});

// Leaves on Tree: the attachments the asked player controls, read as the record reads them.
const ATTACHMENTS = { type: "attachment", control: "you" } as const;
const MANY_ATTACHMENTS: Condition = { kind: "less", left: 1, right: { count: ATTACHMENTS } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // The Brooding Forest cards dealt here (05046, 05048), worded once for both scenarios.
  ...BROODING_FOREST_ASKS,
  // 06047:A:1 and 06047:A:2 (Drúadan Elite, Prowl X, X the players in the game), 06048:A:1 (Drúadan Hunter, Prowl 1), 06049:A:1 (Drúadan Thief, Prowl 1), 06054:A:1 (Stars in Sky, Prowl 2).
  ...prowl("06047:forced:1"),
  ...prowl("06048:forced:1"),
  ...prowl("06049:forced:1"),
  ...prowl("06054:forced:1"),
  // 06047:A:3 (Drúadan Elite, Shadow) and 06049:A:2 (Drúadan Thief, Shadow).
  ...returnUnlessPaid("06047:shadow:1"),
  ...returnUnlessPaid("06049:shadow:1"),
  // 06050:A:2 (Ancestral Clearing, Travel): one ready hero of any player is exhausted, the first player choosing; with none ready the players cannot travel here.
  "06050:travel:1 @0 Pick": { note: "Ancestral Clearing, Travel: choose a ready hero, any player's, to exhaust to travel here.", verb: "Exhaust" },
  // 06051:A:2 (Garden of Poisons, Travel): each player pays 1 resource from his own heroes' pools; the players cannot travel here while one of them cannot.
  "06051:travel:1 @0.0 SpendResources": { owned: true, note: "Garden of Poisons: choose the hero whose pool pays 1 resource to travel here. Each player pays one.", verb: "Pay" },
  // 06053:A:1 (Men in the Dark, When Revealed): each hero, its controller deciding, pays 1 resource from its own pool or takes 1 damage; when no hero takes damage the card gains surge.
  ...payOr(
    "06053:whenRevealed:1",
    "{card}: {picked} pays 1 resource from its pool, or takes 1 damage. If no hero takes damage, {card} gains surge.",
    "{picked} takes 1 damage",
  ),
  // 06054:A:2 (Stars in Sky, When Revealed): each questing hero pays 1 resource from its own pool or is removed from the quest.
  ...payOr(
    "06054:whenRevealed:1",
    "{card}: {picked} pays 1 resource from its pool, or is removed from the quest.",
    "Remove {picked} from the quest",
  ),
  // 06054:A:3 (Stars in Sky, Shadow): all resources of the defending character's pool are discarded; an ally has none.
  "06054:shadow:1 @0 Pick": { owned: true, note: "{card}, Shadow: choose the defending character to discard all resources from. An ally has none.", verb: "Discard" },
  // 06055:A:2 (Leaves on Tree, When Revealed): each player pays 1 resource for each attachment he controls, all or none from his heroes' pools, or discards all of them.
  "06055:whenRevealed:1 @0.0 Choose": {
    owned: true,
    bind: { attached: { count: ATTACHMENTS } },
    note: [
      { when: MANY_ATTACHMENTS, text: "{card}: pay {attached} resources, 1 for each attachment you control, from your heroes' pools, or discard all of them." },
      { text: "{card}: pay 1 resource for the attachment you control, from your heroes' pools, or discard it." },
    ],
  },
  "06055:whenRevealed:1 @0.0 pay": {
    bind: { attached: { count: ATTACHMENTS } },
    label: [{ when: MANY_ATTACHMENTS, text: "Pay {attached} resources from your heroes' pools" }, { text: "Pay 1 resource from your heroes' pools" }],
  },
  "06055:whenRevealed:1 @0.0 discard": { label: "Discard each attachment you control" },
  "06055:whenRevealed:1 @0.0.pay.0 SpendResources": { owned: true, note: "{card}: choose the hero whose pool pays 1 resource for the attachments you control.", verb: "Pay" },
  // 06055:A:3 (Leaves on Tree, Shadow): the defending player discards an attachment of the defending character.
  "06055:shadow:1 @0 Pick": { owned: true, note: "{card}, Shadow: choose an attachment of the defending character to discard.", verb: "Discard" },
};
