// The Nightmare decks (FFG's print-on-demand Nightmare packs), one row per Hall of Beorn card set. The user brought them into
// scope on 2026-10-30: every deck's cards are built for future use, and a built scenario with a deck of its own can be played on
// Nightmare (docs/brief.md, Nightmare). No source names a stable code for a Nightmare card: Hall of Beorn reuses the codes of
// the cycle each deck belongs to (02002 is Ungoliant's Spawn and also The Hunt for Gollum's card 2), and RingsDB does not list
// them. A card's code is the deck's `prefix` and its two-digit collector number (900102 is Ungoliant's Spawn), so a row keeps its
// prefix forever: a new deck is appended, never inserted. `folder` is the deck's folder in the Nightmare proxies on Google Drive
// (sources/nightmare.ts), whose names carry their own spellings ("Encouter at Amon Dîn", "Belagaer"). `scenario` names the
// built scenario (data/scenarios/<id>.json) the deck is played with.
export type NightmareDeckDef = { set: string; prefix: string; folder: string; scenario?: string };

// Every card of a Nightmare deck is printed in this pack (data/cards/Nightmare.json); its number is the collector number.
export const NIGHTMARE_PACK = "Nightmare";

export const NIGHTMARE_DECKS: readonly NightmareDeckDef[] = [
  { set: "Passage Through Mirkwood Nightmare", prefix: "9001", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/01 - Nightmare Core Set/01 - Passage through Mirkwood", scenario: "passage-through-mirkwood" },
  { set: "Journey Along the Anduin Nightmare", prefix: "9002", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/01 - Nightmare Core Set/02 - Journey Along the Anduin", scenario: "journey-along-the-anduin" },
  { set: "Escape from Dol Guldur Nightmare", prefix: "9003", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/01 - Nightmare Core Set/03 - Escape from Dol Guldur", scenario: "escape-from-dol-guldur" },
  { set: "The Hunt for Gollum Nightmare", prefix: "9004", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/02 - Nightmare Shadows of Mirkwood/01 - The Hunt for Gollum", scenario: "the-hunt-for-gollum" },
  { set: "Conflict at the Carrock Nightmare", prefix: "9005", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/02 - Nightmare Shadows of Mirkwood/02 - Conflict at Carrock", scenario: "conflict-at-the-carrock" },
  { set: "A Journey to Rhosgobel Nightmare", prefix: "9006", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/02 - Nightmare Shadows of Mirkwood/03 - A Journey to Rhosgobel", scenario: "a-journey-to-rhosgobel" },
  { set: "The Hills of Emyn Muil Nightmare", prefix: "9007", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/02 - Nightmare Shadows of Mirkwood/04 - The Hills of Emyn Muil", scenario: "the-hills-of-emyn-muil" },
  { set: "The Dead Marshes Nightmare", prefix: "9008", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/02 - Nightmare Shadows of Mirkwood/05 - The Dead Marshes", scenario: "the-dead-marshes" },
  { set: "Return to Mirkwood Nightmare", prefix: "9009", folder: "01 - Nightmare Core Set & Shadows of Mirkwood/02 - Nightmare Shadows of Mirkwood/06 - Return to Mirkwood", scenario: "return-to-mirkwood" },
  { set: "Into the Pit Nightmare", prefix: "9010", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/01 - Nightmare Khazad Dûm/01 - Into the Pit", scenario: "into-the-pit" },
  { set: "The Seventh Level Nightmare", prefix: "9011", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/01 - Nightmare Khazad Dûm/02 - The Seventh Level", scenario: "the-seventh-level" },
  { set: "Flight from Moria Nightmare", prefix: "9012", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/01 - Nightmare Khazad Dûm/03 - Flight from Moria", scenario: "flight-from-moria" },
  { set: "The Redhorn Gate Nightmare", prefix: "9013", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/02 - Nightmare Dwarrowdelf/01 - The Redhorn Gate", scenario: "the-redhorn-gate" },
  { set: "Road to Rivendell Nightmare", prefix: "9014", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/02 - Nightmare Dwarrowdelf/02 - Road to Rivendell", scenario: "road-to-rivendell" },
  { set: "The Watcher in the Water Nightmare", prefix: "9015", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/02 - Nightmare Dwarrowdelf/03 - The Watcher in the Water", scenario: "the-watcher-in-the-water" },
  { set: "The Long Dark Nightmare", prefix: "9016", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/02 - Nightmare Dwarrowdelf/04 - The Long Dark", scenario: "the-long-dark" },
  { set: "Foundations of Stone Nightmare", prefix: "9017", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/02 - Nightmare Dwarrowdelf/05 - Foundations of Stone", scenario: "foundations-of-stone" },
  { set: "Shadow and Flame Nightmare", prefix: "9018", folder: "02 - Nightmare Khazad Dûm & Dwarrowdelf/02 - Nightmare Dwarrowdelf/06 - Shadow and Flame", scenario: "shadow-and-flame" },
  { set: "Peril in Pelargir Nightmare", prefix: "9019", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/01 - Nightmare Heirs of Númenor/01 - Peril in Pelargir" },
  { set: "Into Ithilien Nightmare", prefix: "9020", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/01 - Nightmare Heirs of Númenor/02 - Into Ithilien" },
  { set: "The Siege of Cair Andros Nightmare", prefix: "9021", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/01 - Nightmare Heirs of Númenor/03 - The Siege of Cair Andros" },
  { set: "The Steward's Fear Nightmare", prefix: "9022", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/02 - Nightmare Against the Shadow/01 - The Stewards Fear" },
  { set: "The Drúadan Forest Nightmare", prefix: "9023", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/02 - Nightmare Against the Shadow/02 - The Drúadan Forest" },
  { set: "Encounter at Amon Dîn Nightmare", prefix: "9024", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/02 - Nightmare Against the Shadow/03 - Encouter at Amon Dîn" },
  { set: "Assault on Osgiliath Nightmare", prefix: "9025", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/02 - Nightmare Against the Shadow/04 - Assault on Osgiliath" },
  { set: "The Blood of Gondor Nightmare", prefix: "9026", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/02 - Nightmare Against the Shadow/05 - The Blood of Gondor" },
  { set: "The Morgul Vale Nightmare", prefix: "9027", folder: "03 - Nightmare Heirs of Númenor & Against the Shadow/02 - Nightmare Against the Shadow/06 - The Morgul Vale" },
  { set: "The Fords of Isen Nightmare", prefix: "9028", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/01 - Nightmare The Voice of Isengard/01 - The Fords of Isen" },
  { set: "To Catch an Orc Nightmare", prefix: "9029", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/01 - Nightmare The Voice of Isengard/02 - To Catch an Orc" },
  { set: "Into Fangorn Nightmare", prefix: "9030", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/01 - Nightmare The Voice of Isengard/03 - Into Fangorn" },
  { set: "The Dunland Trap Nightmare", prefix: "9031", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/02 - Nightmare The Ring-maker/01 - The Dunland Trap" },
  { set: "The Three Trials Nightmare", prefix: "9032", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/02 - Nightmare The Ring-maker/02 - The Three Trials" },
  { set: "Trouble in Tharbad Nightmare", prefix: "9033", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/02 - Nightmare The Ring-maker/03 - Trouble in Tharbad" },
  { set: "The Nîn-in-Eilph Nightmare", prefix: "9034", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/02 - Nightmare The Ring-maker/04 - The Nîn in Eilph" },
  { set: "Celebrimbor's Secret Nightmare", prefix: "9035", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/02 - Nightmare The Ring-maker/05 - Celebrimbors Secret" },
  { set: "The Antlered Crown Nightmare", prefix: "9036", folder: "04 - Nightmare The Voice of Isengard & The Ring-maker/02 - Nightmare The Ring-maker/06 - The Antlered Crown" },
  { set: "Intruders in Chetwood Nightmare", prefix: "9037", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/01 - Nightmare The Lost Realm/01 - Invaders in Chetwood" },
  { set: "The Weather Hills Nightmare", prefix: "9038", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/01 - Nightmare The Lost Realm/02 - The Weather Hills" },
  { set: "Deadmen's Dike Nightmare", prefix: "9039", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/01 - Nightmare The Lost Realm/03 - Deadmen's Dike" },
  { set: "The Wastes of Eriador Nightmare", prefix: "9040", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/02 - Nightmare Angmar Awakend/01 - The Wastes of Eriador" },
  { set: "Escape from Mount Gram Nightmare", prefix: "9041", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/02 - Nightmare Angmar Awakend/02 - Escape from Mount Gram" },
  { set: "Across the Ettenmoors Nightmare", prefix: "9042", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/02 - Nightmare Angmar Awakend/03 - Across the Ettenmoors" },
  { set: "The Treachery of Rhudaur Nightmare", prefix: "9043", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/02 - Nightmare Angmar Awakend/04 - The Treachery of Rhudaur" },
  { set: "The Battle of Carn Dûm Nightmare", prefix: "9044", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/02 - Nightmare Angmar Awakend/05 - The Battle of Carn Dûm" },
  { set: "The Dread Realm Nightmare", prefix: "9045", folder: "05 - Nightmare The Lost Realm & Angmar Awakend/02 - Nightmare Angmar Awakend/06 - The Dread Realm" },
  { set: "Voyage Across Belegaer Nightmare", prefix: "9046", folder: "06 - Nightmare The Grey Havens & Dream-chaser/01 - Nightmare The Grey Havens/01 - Voyage Across Belagaer" },
  { set: "The Fate of Númenor Nightmare", prefix: "9047", folder: "06 - Nightmare The Grey Havens & Dream-chaser/01 - Nightmare The Grey Havens/02 - The Fate of Númenor" },
  { set: "Raid on the Grey Havens Nightmare", prefix: "9048", folder: "06 - Nightmare The Grey Havens & Dream-chaser/01 - Nightmare The Grey Havens/03 - Raid on the Grey Havens" },
  { set: "Flight of the Stormcaller Nightmare", prefix: "9049", folder: "06 - Nightmare The Grey Havens & Dream-chaser/02 - Nightmare Dream-chaser/01 - Flight of the Stormcaller" },
  { set: "The Thing in the Depths Nightmare", prefix: "9050", folder: "06 - Nightmare The Grey Havens & Dream-chaser/02 - Nightmare Dream-chaser/02 - The Things in the Depths" },
  { set: "Temple of the Deceived Nightmare", prefix: "9051", folder: "06 - Nightmare The Grey Havens & Dream-chaser/02 - Nightmare Dream-chaser/03 - Temple of the Deceived" },
  { set: "The Drowned Ruins Nightmare", prefix: "9052", folder: "06 - Nightmare The Grey Havens & Dream-chaser/02 - Nightmare Dream-chaser/04 - The Drowned Ruins" },
  { set: "A Storm on Cobas Haven Nightmare", prefix: "9053", folder: "06 - Nightmare The Grey Havens & Dream-chaser/02 - Nightmare Dream-chaser/05 - A Storm on Cobas Haven" },
  { set: "The City of Corsairs Nightmare", prefix: "9054", folder: "06 - Nightmare The Grey Havens & Dream-chaser/02 - Nightmare Dream-chaser/06 - The City of Corsairs" },
  { set: "We Must Away, Ere Break of Day Nightmare", prefix: "9055", folder: "07 - Nightmare The Hobbit Saga/01 - Nightmare Over Hill and Under Hill/01 - We Must Away, Ere Break of Day" },
  { set: "Over the Misty Mountains Grim Nightmare", prefix: "9056", folder: "07 - Nightmare The Hobbit Saga/01 - Nightmare Over Hill and Under Hill/02 - Over the Misty Mountains Grim" },
  { set: "Dungeons Deep and Caverns Dim Nightmare", prefix: "9057", folder: "07 - Nightmare The Hobbit Saga/01 - Nightmare Over Hill and Under Hill/03 - Dungeons Deep and Caverns Dim" },
  { set: "Flies and Spiders Nightmare", prefix: "9058", folder: "07 - Nightmare The Hobbit Saga/02 - Nightmare On Doorstep/04 - Flies and Spiders" },
  { set: "The Lonely Mountain Nightmare", prefix: "9059", folder: "07 - Nightmare The Hobbit Saga/02 - Nightmare On Doorstep/05 - The Lonely Mountain" },
  { set: "The Battle of Five Armies Nightmare", prefix: "9060", folder: "07 - Nightmare The Hobbit Saga/02 - Nightmare On Doorstep/06 - The Battle of Five Armies" },
  { set: "A Shadow of the Past Nightmare", prefix: "9061", folder: "08 - Nightmare The Lord of the Rings Saga/01 - Nightmare The Black Riders/01 - A Shadow of the Past", scenario: "a-shadow-of-the-past" },
  { set: "A Knife in the Dark Nightmare", prefix: "9062", folder: "08 - Nightmare The Lord of the Rings Saga/01 - Nightmare The Black Riders/02 - A Knife in the Dark", scenario: "a-knife-in-the-dark" },
  { set: "Flight to the Ford Nightmare", prefix: "9063", folder: "08 - Nightmare The Lord of the Rings Saga/01 - Nightmare The Black Riders/03 - Flight to the Ford", scenario: "flight-to-the-ford" },
  { set: "The Ring Goes South Nightmare", prefix: "9064", folder: "08 - Nightmare The Lord of the Rings Saga/02 - Nightmare The Road Darkens/01 - The Ring Goes South", scenario: "the-ring-goes-south" },
  { set: "Journey in the Dark Nightmare", prefix: "9065", folder: "08 - Nightmare The Lord of the Rings Saga/02 - Nightmare The Road Darkens/02 - Journey in the Dark", scenario: "journey-in-the-dark" },
  { set: "Breaking of the Fellowship Nightmare", prefix: "9066", folder: "08 - Nightmare The Lord of the Rings Saga/02 - Nightmare The Road Darkens/03 - Breaking of the Fellowship", scenario: "breaking-of-the-fellowship" },
  { set: "The Uruk-hai Nightmare", prefix: "9067", folder: "08 - Nightmare The Lord of the Rings Saga/03 - Nightmare The Treason of Saruman/01 - The Uruk Hai" },
  { set: "Helm's Deep Nightmare", prefix: "9068", folder: "08 - Nightmare The Lord of the Rings Saga/03 - Nightmare The Treason of Saruman/02 - Helms Deep" },
  { set: "The Road to Isengard Nightmare", prefix: "9069", folder: "08 - Nightmare The Lord of the Rings Saga/03 - Nightmare The Treason of Saruman/03 - The Road to Isengard" },
  { set: "The Passage of the Marshes Nightmare", prefix: "9070", folder: "08 - Nightmare The Lord of the Rings Saga/04 - Nightmare The Land of Shadow/01 - The Passage of the Marshes" },
  { set: "Journey to the Cross-roads Nightmare", prefix: "9071", folder: "08 - Nightmare The Lord of the Rings Saga/04 - Nightmare The Land of Shadow/02 - Journey to the Cross-Roads" },
  { set: "Shelob's Lair Nightmare", prefix: "9072", folder: "08 - Nightmare The Lord of the Rings Saga/04 - Nightmare The Land of Shadow/03 - Shelobs Lair" },
];

const prefixes = new Set(NIGHTMARE_DECKS.map((deck) => deck.prefix));
if (prefixes.size !== NIGHTMARE_DECKS.length) throw new Error("nightmare-defs: two decks share a prefix");

export const NIGHTMARE_SETS: ReadonlyMap<string, NightmareDeckDef> = new Map(NIGHTMARE_DECKS.map((deck) => [deck.set, deck]));

/** The Nightmare deck played with a built scenario, if it has one. */
export function nightmareDeckOf(scenarioId: string): NightmareDeckDef | undefined {
  return NIGHTMARE_DECKS.find((deck) => deck.scenario === scenarioId);
}

/** The Nightmare deck a code belongs to: its prefix and two more digits. */
export function nightmareDeckOfCode(code: string): NightmareDeckDef | undefined {
  return NIGHTMARE_DECKS.find((deck) => code.length === deck.prefix.length + 2 && code.startsWith(deck.prefix));
}

/** A card printed in a Nightmare deck. */
export function isNightmareCard(card: { printings: readonly { pack: string }[] }): boolean {
  return card.printings.some((printing) => printing.pack === NIGHTMARE_PACK);
}

/** A Nightmare card's code: its deck's prefix and its two-digit collector number. */
export function nightmareCode(deck: Pick<NightmareDeckDef, "prefix">, number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > 99) throw new Error(`nightmare-defs: collector number ${number} is not 1 to 99`);
  return `${deck.prefix}${String(number).padStart(2, "0")}`;
}

// A Nightmare card whose printed set icon is the scenario's set-aside encounter set (the Data task put every card in the
// `encounter` pile; the scan's icon decides): it is shuffled into that set, not into the standard deck. Foundations of Stone:
// 901702 and 901703 bear the Goblins of the Deep icon, 901704 to 901708 the Foundations of Stone icon (set aside at Setup,
// `encounterDeck2`; scans .cache/scans/9017*.A.jpg, docs/brief.md, Foundations of Stone).
export const NIGHTMARE_CARD_PILES: Readonly<Record<string, "encounterDeck2">> = {
  "901704": "encounterDeck2",
  "901705": "encounterDeck2",
  "901706": "encounterDeck2",
  "901707": "encounterDeck2",
  "901708": "encounterDeck2",
};
