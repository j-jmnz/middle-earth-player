import type { Ask } from "../asks.ts";

// The choice words of Journey to the Cross-roads (the-two-towers part 5), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario journey-to-the-cross-roads --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=journey-to-the-cross-roads` prints each sentence.
// Every choice here is one player's own (the player who plays Brace of Coneys, reveals a Peril card, is dealt the shadow card, or answers for themselves): `owned` names that player two-handed. A pick over heroes or players says "any player's".
// Ties for the lowest Attack or Threat go to the player who chooses (the card prints no tiebreaker, so the chooser settles them): only the tied enemies are offered.
const CONEYS = (path: string, step: string, left: string): Record<string, Ask> => ({
  [`144014:action:1 @${path} Choose`]: { owned: true, note: `Brace of Coneys: choose the ${step} of 2 different options.${left}` },
  [`144014:action:1 @${path} heal`]: { label: "Heal up to 2 damage from a hero, any player's" },
  [`144014:action:1 @${path} resources`]: { label: "Add 2 resources to a hero's pool, any player's" },
  [`144014:action:1 @${path} draw`]: { label: "Choose a player to draw 2 cards" },
  [`144014:action:1 @${path} threat`]: { label: "Choose a player to reduce their threat by 2" },
  [`144014:action:1 @${path}.heal.0 Pick`]: { owned: true, note: "Brace of Coneys: choose a hero with damage, any player's, to heal up to 2 damage.", verb: "Heal" },
  [`144014:action:1 @${path}.resources.0 Pick`]: { owned: true, note: "Brace of Coneys: choose a hero, any player's, to add 2 resources to its pool.", verb: "Add" },
  [`144014:action:1 @${path}.draw.0 Pick`]: { owned: true, note: "Brace of Coneys: choose a player, any seat, to draw 2 cards.", verb: "Draw" },
  [`144014:action:1 @${path}.threat.0 Pick`]: { owned: true, note: "Brace of Coneys: choose a player, any seat, to reduce their threat by 2.", verb: "Reduce" },
});

export const ASKS: Readonly<Record<string, Ask>> = {
  // 144014:A:2 (choose 2): two different options, the first answered then the second (the option taken is not offered again; one that nothing can change is not offered).
  ...CONEYS("1", "first", ""),
  ...CONEYS("2", "second", " The first option is not offered again."),
  // 144033:A:2: the first player engages any enemy in the staging area as the cost of the travel.
  "144033:travel:1 @0 Pick": { owned: true, note: "Foothills of Ephel Dúath: to travel here, engage an enemy in the staging area, any enemy.", verb: "Engage" },
  // 144034:A:1 and 144035:A:1 are gained Forced effects of the active location, resolved by the player who engaged the Harad enemy.
  "144034:forced:1 @0 Pick": { owned: true, note: "Ithilien Woods: you engaged a Harad enemy, so ready 1 exhausted character you control.", verb: "Ready" },
  // 144035:A:2 (Shadow): the defending player discards a non-objective attachment they control.
  "144035:shadow:1 @0 Pick": { owned: true, note: "Hills of Ithilien, Shadow: choose a non-objective attachment you control to discard.", verb: "Discard" },
  // 144036:A:2 (Peril): the revealing player chooses; the lowest Attack enemy is picked among those tied for it.
  "144036:whenRevealed:1 @0 Choose": { owned: true, note: "The Dark Lord's Summons: you either place your lowest Attack Harad enemy under The Black Gate, or reveal one under The Cross-roads." },
  "144036:whenRevealed:1 @0 place": { label: "Place the lowest Attack Harad enemy engaged with you facedown under The Black Gate" },
  "144036:whenRevealed:1 @0 reveal": { label: "Reveal the top facedown card under The Cross-roads and put it into play engaged with you" },
  "144036:whenRevealed:1 @0.place.0 Pick": { owned: true, note: "The Dark Lord's Summons: several Harad enemies engaged with you are tied for the lowest Attack. Choose which goes facedown under The Black Gate.", verb: "Place" },
  // 144037:A:1: each player chooses for themselves, the first player first; the search is of the encounter deck alone.
  "144037:whenRevealed:1 @0.0 Choose": { owned: true, note: "Marching Up the Road: you either return an engaged enemy to the staging area, or search the encounter deck for a Harad enemy." },
  "144037:whenRevealed:1 @0.0 return": { label: "Return an enemy engaged with you to the staging area" },
  "144037:whenRevealed:1 @0.0 search": { label: "Search the encounter deck for a Harad enemy and put it into play engaged with you" },
  "144037:whenRevealed:1 @0.0.return.0 ReturnToStaging": { owned: true, note: "Marching Up the Road: choose the enemy engaged with you that returns to the staging area.", verb: "Return" },
  "144037:whenRevealed:1 @0.0.search.0 SearchMove": { owned: true, note: "Marching Up the Road: search the encounter deck, not its discard pile, for a Harad enemy. It is put into play engaged with you.", verb: "Engage" },
  // 144038:A:2 (Peril): the revealing player chooses; the lowest Threat enemy is picked among those tied for it.
  "144038:whenRevealed:1 @0 Choose": { owned: true, note: "Fierce Southrons: you either place the lowest Threat Harad enemy staged under The Black Gate, or each staged enemy attacks you." },
  "144038:whenRevealed:1 @0 place": { label: "Place the lowest Threat Harad enemy in the staging area facedown under The Black Gate, then reveal 1 more encounter card" },
  "144038:whenRevealed:1 @0 attack": { label: "Each enemy in the staging area makes an immediate attack against you, dealt a shadow card" },
  "144038:whenRevealed:1 @0.place.0 Pick": { owned: true, note: "Fierce Southrons: several Harad enemies in the staging area are tied for the lowest Threat. Choose which goes facedown under The Black Gate.", verb: "Place" },
  // 144039:A:2 (Shadow): the defending player chooses for the attacking enemy.
  "144039:shadow:1 @0 Choose": { owned: true, note: "Arrows Thick in the Air: you either place the attacker under The Black Gate after this attack, or it attacks you again." },
  "144039:shadow:1 @0 place": { label: "Place the attacking enemy facedown under The Black Gate after this attack" },
  "144039:shadow:1 @0 attack": { label: "The attacking enemy makes an additional attack against you after this one, dealt a new shadow card" },
  // 144058:A:2: X damage (the number of players) among the engaged player's characters.
  "144058:forced:1 @0 AssignDamage": { owned: true, note: "Haradrim Archer: assign {x} damage among the characters you control, 1 for each player in the game.", bind: { x: { players: true } }, verb: "Assign" },
  // 144068:A:1: each player but the first searches for a different non-unique location.
  "144068:setup:1 @1.0 SearchMove": { owned: true, note: "Ambush the Men of Harad: search the encounter deck for a non-unique location no other player took. It joins the staging area.", verb: "Add" },
};
