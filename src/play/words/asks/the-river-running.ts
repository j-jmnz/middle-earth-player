import type { Amount } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";

// The resources on Easterling Pursuit, said as "Easterling Pursuit holds N of 3." in the sentences that add one.
const PURSUIT: Amount = { stat: "resources", ofNamed: "Easterling Pursuit" };

// The choice words of The River Running (vengeance-of-mordor part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-river-running --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-river-running` prints each sentence.
// The first player answers for the group at each Travel cost and each "highest or lowest" tie (the attached enemy of Easterling Horse, Sword of Rhûn and Recurve Bow, the Captain's attachment, Warriors of the East's attacker), so those sentences are not owned and the sheet adds who chooses; a choice of one player's own (the attachment a shadow discards, the character Painful Fatigue exhausts, the hero An Arduous Journey readies) is owned.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 21013:A:2 (Forced after Easterling Outrider engages you): place 1 resource on Easterling Pursuit, or it makes an immediate attack against you.
  "21013:forced:1 @0 Choose": { owned: true, note: "Easterling Outrider engaged you: place 1 resource on Easterling Pursuit, or it makes an immediate attack against you. Easterling Pursuit holds {pursuit} of 3.", bind: { pursuit: PURSUIT } },
  "21013:forced:1 @0 pursuit": { label: "Place 1 resource on Easterling Pursuit" },
  "21013:forced:1 @0 attack": { label: "Easterling Outrider attacks you now" },
  // 21013:A:3 (Shadow): the defending player discards an attachment they control.
  "21013:shadow:1 @0 Pick": { owned: true, note: "Easterling Outrider shadow: choose an attachment you control to discard.", verb: "Discard" },

  // 21014:A:2 (Travel): the first player engages the highest engagement cost enemy in the staging area; on a tie the first player picks.
  "21014:travel:1 @0 Pick": { note: "River Running: to travel here, choose the enemy in the staging area with the highest engagement cost. It engages the first player.", verb: "Engage" },

  // 21015:A:2 (Travel): place 1 resource on Easterling Pursuit.
  "21015:travel:1 @0 Pick": { note: "Exposed Riverbank: to travel here, place 1 resource on Easterling Pursuit (in the staging area). Easterling Pursuit holds {pursuit} of 3.", bind: { pursuit: PURSUIT }, verb: "Place" },

  // 21017:A:2 (Forced when it would take damage): discard an Easterling attachment from it, then cancel the damage.
  "21017:forced:2 @0 Pick": { note: "Easterling Captain would take damage: choose an Easterling attachment on him to discard. The damage is canceled.", verb: "Discard" },

  // 21018:A:3 (When Revealed): search for an Easterling Horse and attach it to Rider of Rhûn.
  "21018:whenRevealed:1 @0 AttachSearched": { note: "Rider of Rhûn: choose an Easterling Horse from the encounter deck or its discard pile to attach to Rider of Rhûn.", verb: "Attach" },

  // 21019, 21022, 21023 (When Revealed): the treachery attaches to the enemy with the lowest or highest stat that has none of its kind; the first player breaks a tie.
  "21019:whenRevealed:1 @0 Pick": { note: "Easterling Horse: choose the Easterling enemy with the lowest engagement cost and no Horse. The Horse attaches to it and it returns to the staging area.", verb: "Attach" },
  "21022:whenRevealed:1 @0 Pick": { note: "Sword of Rhûn: choose the Easterling enemy with the lowest Attack and no Sword of Rhûn. The Sword attaches to it.", verb: "Attach" },
  "21023:whenRevealed:1 @0 Pick": { note: "Recurve Bow: choose the Easterling enemy with the highest engagement cost and no Recurve Bow. The Bow attaches to it.", verb: "Attach" },

  // 21024:A:3 (Forced after it becomes the current quest): the highest Attack Easterling enemy in the staging area attacks the first player.
  "21024:forced:2 @0 Pick": { note: "Warriors of the East: choose the Easterling enemy in the staging area with the highest Attack. It attacks the first player now.", verb: "Attack" },

  // 21026:A:2 (Travel): the first player exhausts a hero they control.
  "21026:travel:1 @0 Pick": { note: "Rocky Outcrop: to travel here, choose a ready hero the first player controls to exhaust.", verb: "Exhaust" },

  // 21028:A:1 (When Revealed): each player exhausts a character they control and deals 1 damage to it.
  "21028:whenRevealed:1 @0.0 Pick": { owned: true, note: "Painful Fatigue: choose a ready character you control. It is exhausted and takes 1 damage.", verb: "Exhaust" },
  // 21028:A:2 (Shadow): the defending player exhausts a character they control, or the attacker returns to the staging area after the attack.
  "21028:shadow:1 @0 Choose": { owned: true, note: "Painful Fatigue shadow: exhaust a character you control, or the attacking enemy returns to the staging area after this attack." },
  "21028:shadow:1 @0 exhaust": { label: "Exhaust a character you control" },
  "21028:shadow:1 @0 staging": { label: "Attacker goes back to staging after it" },
  "21028:shadow:1 @0.exhaust.0 Pick": { owned: true, note: "Painful Fatigue shadow: choose a ready character you control to exhaust.", verb: "Exhaust" },

  // 21029:A:1 (each player cannot ready more than 6 characters in the refresh phase): the player keeps the exhausted characters beyond 6 exhausted.
  "21029:forced:1 @0.0 CapRefresh": { owned: true, why: "only 6 of your characters ready this refresh phase.", note: "{ready} exhausted characters would ready. Choose {left} of them to stay exhausted.", verb: "Keep exhausted" },
  // 21029:A:2 (Response when this stage is defeated): each player may ready a hero they control.
  "21029:response:1 @0.0 Choose": { owned: true, note: "An Arduous Journey was defeated: ready an exhausted hero you control, or do nothing." },
  "21029:response:1 @0.0 ready": { label: "Ready an exhausted hero you control" },
  "21029:response:1 @0.0 none": { label: "Do not ready a hero" },
  "21029:response:1 @0.0.ready.0 Pick": { owned: true, note: "An Arduous Journey was defeated: choose an exhausted hero you control to ready.", verb: "Ready" },

  // 21075:A:1 (Setup): each player adds 1 Easterling enemy with a different title to the staging area.
  "21075:setup:1 @0.0 SearchMove": { owned: true, note: "choose an Easterling enemy from the encounter deck, with a title no other player chose, to add to the staging area at Setup.", verb: "Add" },
};
