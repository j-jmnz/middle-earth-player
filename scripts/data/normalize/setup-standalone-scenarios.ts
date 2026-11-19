import type { NameIndex, SetupClause } from "./setup-text.ts";

// Rules: none printed outside the quest card (The Massing at Osgiliath and The Battle of Lake-town have no rulesheet: docs/brief.md, Data sources).
// The sentences of the Standalone scenarios' stage 1A cards that the other readers do not read. Each pattern is quoted from a Setup line, names the cards it moves, and
// returns null for a sentence it does not read (or whose card names find no card), so the scenario stays unbuilt and a name is never dropped silently.
export function readStandaloneScenarios(sentence: string, names: NameIndex): SetupClause[] | null {
  let match: RegExpExecArray | null;

  // The Massing at Osgiliath: "Search the encounter deck for 12 Scout cards, and add 3 per player (one of each title), to the staging area": one copy of each Scout title per player,
  // the other copies staying in the encounter deck (the Placement's `perPlayer`).
  if ((match = /^Search the encounter deck for (\d+) ([A-Z][a-z]+) cards?, and add (\d+) per player \(one of each title\), to the staging area$/.exec(sentence))) {
    const scouts = names.cards.filter((card) => card.type === "enemy" && card.traits.includes(match?.[2] ?? "") && card.encounterSet === "The Massing at Osgiliath");
    const titles = new Set(scouts.map((card) => card.name));
    const copies = scouts.reduce((sum, card) => sum + (card.quantity ?? 0), 0);
    if (titles.size === 0 || copies !== Number(match[1]) || Number(match[3]) !== titles.size) return null;
    return [{ kind: "stage", codes: scouts.map((card) => card.code), perPlayer: 1, count: 0 }];
  }
  // The Battle of Lake-town: "Shuffle all copies of Smaug into a separate Smaug Deck": the nine Smaug cards (three titles, three copies each) are dealt out of the encounter deck. The data keeps them
  // in the `smaugDeck` pile (every copy), a deck of its own with a discard pile (src/rules/core/piles.ts DECKS).
  if (/^Shuffle all copies of Smaug into a separate Smaug Deck$/i.test(sentence)) {
    const smaug = names.cards.filter((card) => card.type === "enemy" && /^Smaug\b/.test(card.name) && card.encounterSet === "The Battle of Lake-town");
    return smaug.length === 0 ? null : [{ kind: "step", step: "buildSmaugDeck", codes: [...new Set(smaug.map((card) => card.code))] }];
  }
  // "Then reveal 1 card from the encounter deck per player, and add it to the staging area": the first player reveals one card for each player, as "Each player reveals 1 card" does.
  if ((match = /^Then,? reveal (\d+|an?|one) cards? from the encounter deck per player, and add it to the staging area$/i.exec(sentence))) {
    return [{ kind: "eachPlayerReveals", count: /^\d+$/.test(match[1] ?? "") ? Number(match[1]) : 1 }];
  }
  // The Stone of Erech (50301): "Set Derufin, The Lord of the Dead, The Stone of Erech, and the 3 Night objectives aside, out of play": the three Night-trait objectives (Eventide, Dusk, Midnight) are set aside
  // with the named cards.
  if ((match = /^Set (.+?),? and the (\d+) Night objectives aside,? out of play$/i.exec(sentence))) {
    const night = names.cards.filter((card) => card.type === "objective" && card.traits.includes("Night") && card.encounterSet === "The Stone of Erech");
    const codes = [...names.codesOf(match[1] ?? ""), ...night.map((card) => card.code)];
    return night.length !== Number(match[2]) || names.without(match[1] ?? "").replace(/\bThe\b|[\s,]|and/g, "") !== "" ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  // "Place Eventide into play, next to the current quest": the first Night objective is in play beside the quest deck from the start.
  if ((match = /^Place (.+?) into play, next to the current quest$/i.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "putIntoPlay", codes }];
  }
  // The Old Forest (147001): "Each player searches the encounter deck and adds 1 different location to the staging area": each player finds one location of a title no other player took.
  if ((match = /^Each player searches the encounter deck and adds (\d+|an?|one) different locations? to the staging area$/i.exec(sentence))) {
    return [{ kind: "eachPlayerAddsLocation", count: /^\d+$/.test(match[1] ?? "") ? Number(match[1]) : 1 }];
  }
  if ((match = /^Remove (.+?) from the encounter deck and set (?:him|her|it|them) aside, out of play$/.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 || names.without(match[1] ?? "").replace(/\bThe\b|\s/g, "") !== "" ? null : [{ kind: "aside", codes, allCopies: false }];
  }
  // The Ruins of Belegost (50601): "Randomly select 1 of the 5 remaining Loot objectives and place it facedown underneath Stalking the Ruins (without looking). Shuffle the others into the
  // encounter deck (without looking at them)": the Loot objectives of the set other than the Sword of Belegost, which the line before sets aside. The load list sets all five aside;
  // the first step hides one under Stalking the Ruins and the second shuffles the other four into the encounter deck.
  if ((match = /^Randomly select 1 of the (\d+) remaining Loot objectives and place it facedown underneath (.+?) \(without looking\)$/.exec(sentence))) {
    const loot = names.cards.filter((card) => card.type === "objective" && card.encounterSet === "The Ruins of Belegost" && /^Loot\b/.test(card.text ?? "") && card.name !== "Sword of Belegost");
    const under = names.codesOf(match[2] ?? "");
    return loot.length !== Number(match[1]) || under.length === 0 ? null : [{ kind: "step", step: "hideLoot", codes: loot.map((card) => card.code), to: under }];
  }
  if (/^Shuffle the others into the encounter deck \(without looking at them\)$/.test(sentence)) {
    const loot = names.cards.filter((card) => card.type === "objective" && card.encounterSet === "The Ruins of Belegost" && /^Loot\b/.test(card.text ?? "") && card.name !== "Sword of Belegost");
    return loot.length === 0 ? null : [{ kind: "step", step: "shuffleOthersIn", codes: loot.map((card) => card.code) }];
  }
  // "Shuffle any unused Scoutcards back into the encounter deck" (the card prints "Scoutcards"): the copies not staged stay in the encounter deck.
  if (/^Shuffle any unused Scout ?cards back into the encounter deck$/.test(sentence)) return [{ kind: "shuffleEncounterDeck" }];
  return null;
}
