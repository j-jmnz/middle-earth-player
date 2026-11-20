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
  // Murder at the Prancing Pony (50701): "Search the encounter deck for the 5 Suspect enemies and 5 Hideout locations. Randomly select 1 Suspect and 1 Hideout and set them aside out of play,
  // facedown (without looking at them). Build the Investigation deck (see rules) and place it next to the quest deck." The load list sets all ten and both copies of Taken by Surprise aside;
  // the first step finds the ten, the second hides one Suspect and one Hideout, the third shuffles the other eight with the Taken by Surprise copies into the Investigation deck (rules card 2).
  if ((match = /^Search the encounter deck for the (\d+) Suspect enemies and (\d+) Hideout locations$/.exec(sentence))) {
    const suspects = names.cards.filter((card) => card.type === "enemy" && card.traits.includes("Suspect") && card.encounterSet === "Investigation");
    const hideouts = names.cards.filter((card) => card.type === "location" && card.traits.includes("Hideout") && card.encounterSet === "Investigation");
    return suspects.length !== Number(match[1]) || hideouts.length !== Number(match[2]) ? null : [{ kind: "step", step: "findSuspectsAndHideouts", codes: [...suspects, ...hideouts].map((card) => card.code) }];
  }
  if (/^Randomly select 1 Suspect and 1 Hideout and set them aside out of play, facedown \(without looking at them\)$/.test(sentence)) {
    const cards = names.cards.filter((card) => card.encounterSet === "Investigation" && (card.traits.includes("Suspect") || card.traits.includes("Hideout")));
    return cards.length === 0 ? null : [{ kind: "step", step: "hideSuspectAndHideout", codes: cards.map((card) => card.code) }];
  }
  if (/^Build the Investigation deck \(see rules\) and place it next to the quest deck$/.test(sentence)) {
    const cards = names.cards.filter((card) => card.encounterSet === "Investigation");
    return cards.length === 0 ? null : [{ kind: "step", step: "buildInvestigationDeck", codes: [...new Set(cards.map((card) => card.code))] }];
  }
  // "Make The Prancing Pony the active location and add 1 Ramshackle Manor to the staging area".
  if ((match = /^Make (.+?) the active location and add (\d+|an?|one) (.+?) to the staging area$/.exec(sentence))) {
    const active = names.codesOf(match[1] ?? "");
    const staged = names.codesOf(match[3] ?? "");
    return active.length === 0 || staged.length === 0 ? null : [{ kind: "active", codes: active }, { kind: "stage", codes: staged, perPlayer: null, count: /^\d+$/.test(match[2] ?? "") ? Number(match[2]) : 1 }];
  }
  // The Siege of Annúminas (50803): "Each player searches the encounter deck for a different location and adds it to the staging area. One of those locations must be Gate of Annúminas.": the line after
  // the search names the one location that is not free to choose.
  if ((match = /^One of those locations must be (.+)$/.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 || names.without(match[1] ?? "").replace(/\s/g, "") !== "" ? null : [{ kind: "step", step: "gateAmongLocations", codes }];
  }
  // The Siege of Annúminas' Standard Game Mode (50801): "Arrange the quest cards into three separate quest decks: 1A-3A, 1C-3C, and 1E-3E. Remove the 1C-3C deck and 1E-3E deck from the game. Search the
  // encounter deck for Annúminas, add it to the staging area, and set its city strength to 20. Flip this card over and place it next to the quest deck."
  if (/^Arrange the quest cards into three separate quest decks: 1A-3A, 1C-3C, and 1E-3E$/.test(sentence)) return [{ kind: "step", step: "arrangeQuestDecks", codes: [] }];
  if (/^Remove the 1C-3C deck and (?:the )?1E-3E deck from the game$/.test(sentence)) return [{ kind: "step", step: "removeQuestDecks", codes: [] }];
  if ((match = /^Search the encounter deck for (.+?), add it to the staging area, and set its city strength to (\d+)$/.exec(sentence))) {
    const codes = names.codesOf(match[1] ?? "");
    return codes.length === 0 ? null : [{ kind: "stage", codes, perPlayer: null, count: 1 }, { kind: "step", step: "setCityStrength", codes, count: Number(match[2]) }];
  }
  if (/^Flip this card over and place it next to the quest deck$/.test(sentence)) return [{ kind: "step", step: "flipModeCard", codes: [] }];
  // "Shuffle any unused Scoutcards back into the encounter deck" (the card prints "Scoutcards"): the copies not staged stay in the encounter deck.
  if (/^Shuffle any unused Scout ?cards back into the encounter deck$/.test(sentence)) return [{ kind: "shuffleEncounterDeck" }];
  return null;
}
