import type { Ask } from "../asks.ts";

// The choice words of The Passing of the Grey Company (the-return-of-the-king part 1), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-passing-of-the-grey-company --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-passing-of-the-grey-company` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 145016:A:3: Forced at the end of the round; the raise comes first, then the dial's player may spend a Fellowship resource (only Aragorn's pool holds one: the first player's, mec113.multiplayer-aragorn).
  "145016:forced:1 @1 Choose": { owned: true, note: "Overcome by Fear: you either spend 1 Fellowship resource to detach it from your threat dial and set it aside, or keep it." },
  "145016:forced:1 @1 detach": { label: "Spend 1 Fellowship resource: detach Overcome by Fear and set it aside" },
  "145016:forced:1 @1 keep": { label: "Keep Overcome by Fear on your threat dial" },
  "145016:forced:1 @1.detach.0 SpendResources": { owned: true, note: "Overcome by Fear: choose the Fellowship hero whose pool pays 1 resource to detach it.", verb: "Pay" },
  // 145017:A:2, 145019:A:2 and 145064:A:1: cards found by a search are added (or put into play engaged), not revealed.
  "145017:forced:1 @0.0 SearchMove": { owned: true, note: "The Stone of Erech is the active location: search the encounter deck and discard pile for an Oathbreaker enemy. Add it to the staging area.", verb: "Add" },
  "145019:travel:1 @0 SearchMove": { owned: true, note: "Trysting Place: search the encounter deck and discard pile for an Oathbreaker enemy. Put it into play engaged with you.", verb: "Engage" },
  "145064:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "The Paths of the Dead: search the encounter deck for a location with a different title. Add it to the staging area.", verb: "Add" },
  // 145020:A:2: the Travel cost, paid by the first player (a copy of Shifting Quagmire's line).
  "145020:travel:1 @0 SpendResources": { owned: true, note: "Deadly Road: choose the Fellowship hero whose pool pays 1 resource to travel here.", verb: "Pay" },
  // 145021:A:3: Haunted Path's shadow, the defending player chooses.
  "145021:shadow:1 @0 Choose": { owned: true, note: "Haunted Path shadow: you either raise your threat by 2, or the attacking enemy returns to the staging area after this attack." },
  "145021:shadow:1 @0 threat": { label: "Raise your threat by 2" },
  "145021:shadow:1 @0 staging": { label: "The attacking enemy returns to the staging area after the attack" },
  // 145022:A:2 and 145025:A:2: after the enemy engages the player; every attach option reads the same.
  "145022:forced:1 @0 Choose": { owned: true, note: "Dead Man of Dunharrow engaged you. Attach Overcome by Fear to your threat dial, or raise your threat by 2." },
  "145022:forced:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145022:forced:1 @0 threat": { label: "Raise your threat by 2" },
  "145025:forced:1 @0 Choose": { owned: true, note: "Shadow Host engaged you. Attach Overcome by Fear to your threat dial, or it makes an immediate attack against you." },
  "145025:forced:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145025:forced:1 @0 attack": { label: "Shadow Host makes an immediate attack against you" },
  // 145023:A:2 (Peril): the revealing player chooses.
  "145023:whenRevealed:1 @0 Choose": { owned: true, note: "Faithless Dead: you either raise each player's threat by 2, or reveal an additional encounter card." },
  "145023:whenRevealed:1 @0 threat": { label: "Each player raises their threat by 2" },
  "145023:whenRevealed:1 @0 reveal": { label: "Reveal an additional encounter card" },
  // 145024:A:2 (Peril): the revealing player chooses; the attack comes from the staging area.
  "145024:whenRevealed:1 @0 Choose": { owned: true, note: "Ghosts of Men: attach Overcome by Fear to your threat dial, or it makes an immediate attack against you." },
  "145024:whenRevealed:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145024:whenRevealed:1 @0 attack": { label: "Ghosts of Men makes an immediate attack against you" },
  // 145027:A:2 (Peril) and 145028:A:2 (Peril): the revealing player chooses.
  "145027:whenRevealed:1 @0 Choose": { owned: true, note: "The Way is Shut: attach Overcome by Fear to your threat dial, or stop progress on the current quest this round." },
  "145027:whenRevealed:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145027:whenRevealed:1 @0 noProgress": { label: "No progress can be placed on the current quest this round" },
  "145028:whenRevealed:1 @0 Choose": { owned: true, note: "Whispers in the Dark: attach Overcome by Fear to your threat dial, or your characters get -1 Willpower, Attack and Defense." },
  "145028:whenRevealed:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145028:whenRevealed:1 @0 weaken": { label: "Each character you control gets -1 Willpower, -1 Attack and -1 Defense this round" },
  // 145029:A:1: each player in turn order, the first player first; A:2: the defending player.
  "145029:whenRevealed:1 @0.0 Choose": { owned: true, note: "No Turning Back: attach Overcome by Fear to your threat dial, or discard an ally you control." },
  "145029:whenRevealed:1 @0.0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145029:whenRevealed:1 @0.0 discard": { label: "Discard an ally you control" },
  "145029:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "No Turning Back: choose an ally you control to discard.", verb: "Discard" },
  "145029:shadow:1 @0 Choose": { owned: true, note: "No Turning Back shadow: attach Overcome by Fear to your threat dial, or the attacker makes an additional attack against you." },
  "145029:shadow:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145029:shadow:1 @0 attack": { label: "The attacking enemy makes an additional attack against you" },
  // 145063:B:1: each player in turn order decides for themself.
  "145063:whenRevealed:1 @0.0 Choose": { owned: true, note: "The Forbidden Door: you may add 1 resource to each hero you control. If you do, raise your threat by 3." },
  "145063:whenRevealed:1 @0.0 add": { label: "Add 1 resource to each hero you control, then raise your threat by 3" },
  "145063:whenRevealed:1 @0.0 decline": { label: "Decline: no resources, no threat" },
  // 145064:B:3: Forced at the beginning of the planning phase, each player in turn order.
  "145064:forced:1 @0.0 Choose": { owned: true, note: "The Paths of the Dead: you either raise your threat by 1, or cannot play cards from your hand this phase." },
  "145064:forced:1 @0.0 threat": { label: "Raise your threat by 1" },
  "145064:forced:1 @0.0 noPlay": { label: "You cannot play cards from your hand this phase" },
  // 145065:A:1: each player in turn order may detach their own copy.
  "145065:whenRevealed:1 @2.0 Choose": { owned: true, note: "The Dead are Following: you may raise your threat by 3 to detach Overcome by Fear from your threat dial." },
  "145065:whenRevealed:1 @2.0 detach": { label: "Raise your threat by 3: detach Overcome by Fear and set it aside" },
  "145065:whenRevealed:1 @2.0 keep": { label: "Keep Overcome by Fear on your threat dial" },
  // 145067:A:3: Forced when Army of the Dead attacks, the defending player chooses.
  "145067:forced:1 @0 Choose": { owned: true, note: "Army of the Dead attacks you: attach Overcome by Fear to your threat dial, or discard an ally you control." },
  "145067:forced:1 @0 attach": { label: "Attach Overcome by Fear to your threat dial" },
  "145067:forced:1 @0 discard": { label: "Discard an ally you control" },
  "145067:forced:1 @0.discard.0 Pick": { owned: true, note: "Army of the Dead: choose an ally you control to discard.", verb: "Discard" },
};
