import { z } from "zod";

import { scenarioDefinitionSchema, type Effect, type Instruction, type ScenarioDefinition } from "./boundary.ts";

// A scenario as data/scenarios/<id>.json stores it: which cards go to which pile, in Normal and Easy
// counts. The sync adapters and the quest cards' Setup text both agree on it before the build writes it.
// `burden` is the burden deck (Flight to the Ford): a zone beside the quest deck, not part of the encounter deck.
// `attachedChosen` is a card the quest's Setup attaches to a hero the first player chooses (The Caves of Nibin-Dûm's Cave
// Torch): out of the encounter deck, dealt by the Setup record, not by `setupInstructions`.
// Dream-chaser's extra decks (docs/scenarios/dream-chaser.md, Dream-chaser), each a zone the scenario's Setup prepares (the engine reads them from
// phase 39 on): `corsairDeck` (the non-ship enemies, "Prepare the Corsair deck", dcce.corsair-deck), `encounterDeck2` (the deck the
// quest swaps to: The Thing in the Depths 5, The City of Corsairs 9, dcce.from-sea-to-land), `unchartedDeck` (dcce.uncharted-deck),
// `islandMap` (Temple of the Deceived's fifteen double-sided locations, dcce.island-map), `grottoDeck` (dcce.grotto-deck) and
// `stormcallerQuests` (stages 2C to 4C beside the Stormcaller, dcce.stormcallers-area). None is part of the encounter deck.
// Ered Mithrin's decks beside the encounter deck (docs/scenarios/ered-mithrin.md, Ered Mithrin), each a zone the scenario's Setup builds from encounter sets:
// `evilCreaturesDeck` (the Wilderlands enemies, emce.evil-creatures-deck), `cavesDeck` (the Lost Caves set and the cards a Setup shuffles in,
// emce.caves-deck), `sideQuestDeck` (Fire in the Night's eight encounter side quests, emce.side-quests), and Lost in Mirkwood's two decks
// `spidersDeck` and `orcsDeck` (the Spiders of Mirkwood and Dol Guldur Orcs sets, which the quest swaps into the encounter deck).
// The Two Towers' second encounter decks (mec112.setup-journey-to-the-cross-roads, mec112.setup-shelobs-lair): `haradDeck` (the Men of Harad set, shuffled and
// placed facedown under The Cross-roads) and `greatSpiderDeck` (The Great Spider set, set aside). Neither is part of the encounter deck.
// Angmar Awakened's Orc deck (mec108.orc-deck): `angmarOrcDeck`, the Angmar Orcs enemies and Concealed Orc-camp The Weather Hills' Setup takes out of the encounter deck.
// The Battle of Lake-town's Smaug deck (docs/scenarios/standalone-scenarios.md, The Battle of Lake-town): `smaugDeck`, the nine Smaug cards its Setup shuffles into a separate deck, with a discard pile of its own.
export const PILES = ["encounter", "quest", "staging", "activeLocation", "setAside", "attached", "burden", "attachedChosen", "corsairDeck", "encounterDeck2", "unchartedDeck", "islandMap", "grottoDeck", "stormcallerQuests", "evilCreaturesDeck", "cavesDeck", "sideQuestDeck", "spidersDeck", "orcsDeck", "haradDeck", "greatSpiderDeck", "angmarOrcDeck", "smaugDeck"] as const;
export type Pile = (typeof PILES)[number];

const placementSchema = z
  .strictObject({
    code: z.string().min(1),
    normal: z.number().int().positive(),
    easy: z.number().int().nonnegative(),
    pile: z.enum(PILES),
    // Staging only: this many copies per player in the game ("1 Fell Rider per player"); `normal` is the box's total.
    perPlayer: z.number().int().positive().optional(),
    // Staging only: the quest card's Setup finds these copies in the encounter deck, a different location for each player ("Each player adds 1
    // different location to the staging area", 142040:A:1). They are dealt with the encounter pile and the Setup record searches for them.
    searched: z.literal(true).optional(),
    // Staging only: "1 copy of Rolling Seas (2 copies instead if there are 3 or more players in the game)": `few` copies, `many` from `from`
    // players on; the copies of `normal` the Setup does not stage stay in the encounter deck.
    byPlayers: z.strictObject({ few: z.number().int().positive(), many: z.number().int().positive(), from: z.number().int().min(2) }).optional(),
    // A card with two sides that are two catalog cards, `code` the side dealt faceup and `back` the other side of the same physical card
    // (the Stormcaller Elite's enemy and objective-ally sides, the Grotto locations and the Underwater side each one is paired with: the pairings
    // differ card to card, dcce.grotto-deck, so one code can appear in several placements of a pile). A card with a folded second side
    // (Card.back) has no `back` here.
    back: z.string().min(1).optional(),
  })
  .refine((card) => card.easy <= card.normal, { message: "easy exceeds normal" });

// A scenario's Nightmare deck (docs/scenarios/nightmare.md, Nightmare), from its setup card: the standard piles less `removed` (each copy
// taken from the pile it was in), with the deck's own cards (`cards`, the copies printed) shuffled in. A Nightmare card takes the
// Setup slot of a removed card of its title (`pile`, `perPlayer`). The setup card is placed next to the quest deck, side A faceup,
// and its lines stay active all game.
// In the order a removal takes from them: the encounter deck, then the piles the quest's Setup fills from it. `encounterDeck2` is an encounter set the Setup sets aside (Foundations of Stone's),
// which the removal list also thins; `quest` is a stage the removal list takes out of the quest deck (Road to Rivendell's "Orc Outpost (quest stage 2)"), which the Nightmare deck's own quest card replaces.
export const NIGHTMARE_PILES = ["encounter", "staging", "activeLocation", "setAside", "attached", "encounterDeck2", "quest"] as const;
const nightmareSchema = z.strictObject({
  setupCard: z.string().min(1),
  removed: z.array(z.strictObject({ code: z.string().min(1), copies: z.number().int().positive(), pile: z.enum(NIGHTMARE_PILES) })),
  cards: z
    .array(z.strictObject({ code: z.string().min(1), copies: z.number().int().positive(), pile: z.enum(NIGHTMARE_PILES), perPlayer: z.number().int().positive().optional() }))
    .min(1),
  // The deck's quest cards (side A codes), which the build records and does not place.
  questCards: z.array(z.string().min(1)).min(1).optional(),
});
export type NightmareData = z.infer<typeof nightmareSchema>;

export const scenarioDataSchema = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    number: z.number().int().positive(),
    stages: z.array(z.string().min(1)).min(1),
    // The booklet's encounter sets, in booklet order, with the Normal count of cards each contributes.
    encounterSets: z.array(z.strictObject({ name: z.string().min(1), count: z.number().int().nonnegative() })),
    cards: z.array(placementSchema),
    // The campaign card printed for this scenario. Its Setup and Resolution records belong to the scenario. A scenario of a cycle (Shadows of
    // Mirkwood) has none: it has no Campaign Mode and is played standalone only (`CycleScenarioData`).
    campaignCard: z.string().min(1).optional(),
    // Cards the campaign card's Setup places or shuffles in. They are not in `cards`; the records deal them.
    campaignPlaced: z.array(z.string().min(1)),
    // Dream-chaser: the Campaign Expansion's reprint of a card this scenario deals (in `cards` or `campaignPlaced`), by the code it is dealt under.
    // A campaign game deals the reprint, with its Campaign Mode only or Upgraded side; standalone play deals the card named in `cards`.
    reprints: z.record(z.string().min(1), z.string().min(1)).optional(),
    // The Ring-bearer's starting life, when a Setup line sets it.
    life: z.number().int().positive().optional(),
    // The Two Towers: the saga hero the first player takes control of at setup (mec112.setting-up-the-game), where a scenario names one. `hero` is a
    // ☺ hero card (Aragorn in scenarios 7 to 9, who does not count against the hero limit); `ringBearer` is a ☺ hero with the Ring-bearer trait the
    // first player picks, with `attached` (The One Ring) attached to him (scenarios 10 to 12). Absent for the Fellowship box, whose six scenarios
    // all start with a Ring-bearer and its attachments in the campaign's `prelude`.
    sagaStart: z.union([z.strictObject({ hero: z.string().min(1) }), z.strictObject({ ringBearer: z.literal(true), attached: z.array(z.string().min(1)).min(1) })]).optional(),
    // The Hobbit: the treasure cards a deck may add at this scenario's Setup (hob.treasure-ohauh, hob.treasure-otd), the treasures of the earlier scenarios the Setup lists by icon. Absent where none is listed.
    treasures: z.array(z.string().min(1)).min(1).optional(),
    // Table pieces the cards call for, read from their printed text by the build.
    widgets: z.strictObject({ hide: z.boolean(), secondActiveLocation: z.boolean(), perSeatStaging: z.boolean() }),
    // The DragnCards decks the Fellowship box is loaded from (null where the box has none: Hall of Beorn's counts and the printed
    // Setup text place its cards), and the Hall of Beorn scenario file.
    source: z.strictObject({ dragnNormal: z.string().nullable(), dragnEasy: z.string().nullable(), hobSlug: z.string() }),
    // The Nightmare deck played with this scenario, where one is printed.
    nightmare: nightmareSchema.optional(),
    // The code of the scenario's own mode card (The Siege of Annúminas' Standard Game Mode): its Setup runs before the quest card's, then it is flipped and kept beside the quest deck all game
    // (`ScenarioDefinition.modeCard`). The Dream-chaser Hard/Expert Mode card is not this: a campaign with XP adds it (MODE_CARD_CODE).
    modeCard: z.string().min(1).optional(),
    // The mode card the app's Easy difficulty deals in its place (The Hunt for the Dreadnaught's Easy Mode, docs/scenarios/standalone-scenarios.md, The Hunt for the Dreadnaught, reading 1): the Setup, the back and the game are as with `modeCard`.
    easyModeCard: z.string().min(1).optional(),
  })
  .superRefine((data, context) => {
    const quest = data.cards.filter((card) => card.pile === "quest").map((card) => card.code);
    const same = quest.length === data.stages.length && data.stages.every((code, index) => quest.includes(code) && data.stages.indexOf(code) === index);
    if (!same) context.addIssue({ code: "custom", message: "stages must be the quest-pile cards" });
    const seen = new Set<string>();
    for (const card of data.cards) {
      const key = `${card.code}\u0000${card.pile}\u0000${card.back ?? ""}`;
      if (seen.has(key)) context.addIssue({ code: "custom", message: `duplicate code, pile and back ${card.code} ${card.pile} ${card.back ?? ""}` });
      seen.add(key);
    }
  });

type ParsedScenario = z.infer<typeof scenarioDataSchema>;
// A scenario of a campaign: the campaign card is printed for it, and every campaign reader may rely on it.
export type ScenarioData = Omit<ParsedScenario, "campaignCard"> & { campaignCard: string };
// A scenario of a cycle: no campaign card. Code that reads a built scenario whichever kind it is takes `AnyScenarioData`.
export type CycleScenarioData = Omit<ParsedScenario, "campaignCard"> & { campaignCard?: undefined };
export type AnyScenarioData = ScenarioData | CycleScenarioData;
export type Placement = z.infer<typeof placementSchema>;

// One printed row of a starter decklist: the card's name as the booklet prints it, its collector number, its type,
// how many copies, and the catalog code chosen for it.
export const starterRowSchema = z.strictObject({
  name: z.string().min(1),
  collector: z.number().int().positive(),
  type: z.enum(["hero", "ally", "attachment", "event"]),
  count: z.number().int().positive(),
  code: z.string().min(1),
});
// `span` is the rule span of the MEC109 booklet that prints the list (data/rules/index.json).
export const starterDeckSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  span: z.string().min(1),
  rows: z.array(starterRowSchema).min(1),
});
export type StarterRow = z.infer<typeof starterRowSchema>;
export type StarterDeckData = z.infer<typeof starterDeckSchema>;

export const campaignDataSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  scenarios: z.array(z.string().min(1)),
  // "cycle": scenarios that belong to no campaign (Shadows of Mirkwood), played standalone only. Absent in a campaign's file.
  kind: z.literal("cycle").optional(),
  // A cycle built a scenario at a time: the titles of the ones it lists that are not built yet, in release order. The Scenarios tab shows each under Coming later.
  later: z.array(z.string().min(1)).optional(),
  // The campaign card of each scenario, by scenario id. Its Setup and Resolution lines are effect records. A cycle's file omits it (read as empty).
  campaignCards: z.record(z.string(), z.string().min(1)).default({}),
  // The booklet the campaign opens (src/screens/booklets/books.ts): the Fellowship's MEC109, the Learn to Play for Mirkwood
  // Paths, The Dark of Mirkwood's rulebook for the two-scenario campaign. A cycle names one only where its rules inserts are a booklet.
  bookletId: z.string().min(1).optional(),
  // A saga campaign carries the Ring-bearer and the Fellowship-sphere rules (the Fellowship of the Ring only). The others
  // are plain campaigns: no Ring-bearer, and Fellowship heroes are not allowed.
  saga: z.boolean(),
  // The campaign cards award XP the players spend on the log's scalable and upgradable cards (Dream-chaser, dcce.gaining-xp). Absent otherwise.
  xp: z.boolean().optional(),
  // The page of the campaign's booklet where a scenario's setup is printed, by scenario id. Only scenarios whose
  // `setup-<id>` span (data/rules/index.json) is in that booklet have one; the reader opens on it, otherwise on the saved
  // last page.
  bookletPages: z.record(z.string(), z.number().int().positive()).optional(),
  // Cards every scenario starts with, attached to the Ring-bearer. From the sources' player-1 play area. Empty outside a saga.
  prelude: z.array(z.strictObject({ code: z.string().min(1) })).default([]),
  // The two starter decks the booklet prints (data/starter-decks.json). The seed script reads them. Empty outside the Fellowship.
  starterDecks: z.array(starterDeckSchema),
});
export type CampaignData = z.infer<typeof campaignDataSchema>;

// data/campaigns/index.json: every campaign the list may name. A campaign without scenario files is listed locked, with
// the name and scenario count the sources give (scripts/data/normalize/campaigns.ts).
export const campaignIndexSchema = z.array(
  z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    scenarioCount: z.number().int().positive(),
    playable: z.boolean(),
    // "campaign": played in Campaign Mode, listed on the Campaigns tab. "cycle": a grouping of scenarios that is part of no
    // campaign, listed only on the Scenarios tab.
    kind: z.enum(["campaign", "cycle"]),
    // The RCO product a locked campaign is printed in ("The Return of the King Saga Expansion"), the name the Scenarios tab gives
    // its tile; null for a built campaign (the Scenarios tab names its boxes, src/screens/data/campaign-data.ts) and for a cycle.
    box: z.string().min(1).nullable(),
    // The US release of the product that starts it (YYYY-MM-DD).
    released: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // The order every list shows the entries in, from 1: by release, the three Lord of the Rings saga boxes together in book order
    // at the Fellowship's release (scripts/data/normalize/campaigns.ts).
    position: z.number().int().positive(),
  }),
);
export type CampaignIndexEntry = z.infer<typeof campaignIndexSchema>[number];

// A campaign scenario: a file with no campaign card is a cycle's (`parseAnyScenarioData`) and is no campaign's.
export function parseScenarioData(raw: unknown): ScenarioData {
  const data = parseAnyScenarioData(raw);
  if (data.campaignCard === undefined) throw new Error(`Scenario ${data.id}: a cycle scenario has no campaign card`);
  return data;
}

export function parseAnyScenarioData(raw: unknown): AnyScenarioData {
  const parsed = scenarioDataSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string" ? raw.id : "(missing id)";
    const paths = parsed.error.issues.map((issue) => (issue.path.length === 0 ? issue.message : `${issue.path.join(".")}: ${issue.message}`)).join(", ");
    throw new Error(`Scenario ${id}: ${paths}`);
  }
  return parsed.data as AnyScenarioData;
}

export function scenarioCards(data: AnyScenarioData): Placement[] {
  return data.cards;
}

export function normalEncounterSize(data: AnyScenarioData): number {
  return data.cards.filter((card) => card.pile === "encounter").reduce((sum, card) => sum + card.normal, 0);
}

export function normalCopiesByCode(data: AnyScenarioData): Map<string, number> {
  const totals = new Map<string, number>();
  for (const card of data.cards) totals.set(card.code, (totals.get(card.code) ?? 0) + card.normal);
  return totals;
}

// Nightmare plays the scenario's Nightmare deck (docs/scenarios/nightmare.md, Nightmare), where it has one (`nightmare`).
export const DIFFICULTIES = ["Easy", "Normal", "Nightmare"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// The piles at a difficulty. Easy and Normal read each placement's own count. Nightmare starts from the Normal piles, takes out the
// copies the setup card removes from the pile each came from, and adds the Nightmare deck's cards to theirs (`nightmare`).
export function placementsAt(data: AnyScenarioData, difficulty: Difficulty = "Normal"): Placement[] {
  if (difficulty !== "Nightmare") return data.cards;
  const nightmare = data.nightmare;
  if (!nightmare) throw new Error(`Scenario ${data.id} has no Nightmare deck`);
  const less = (card: Placement) => nightmare.removed.filter((item) => item.code === card.code && item.pile === card.pile).reduce((sum, item) => sum + item.copies, 0);
  const standard = data.cards.flatMap((card) => {
    const normal = card.normal - less(card);
    return normal > 0 ? [{ ...card, normal, easy: Math.min(card.easy, normal) }] : [];
  });
  const added = nightmare.cards.map((card): Placement => ({ code: card.code, normal: card.copies, easy: 0, pile: card.pile, ...(card.perPlayer != null ? { perPlayer: card.perPlayer } : {}) }));
  return [...standard, ...added];
}

function copiesAt(card: Placement, difficulty: Difficulty): number {
  return difficulty === "Easy" ? card.easy : card.normal;
}

// The copies the quest card's Setup puts out: all of them, or for "1 Fell Rider per player" one per seat. With no seat
// count (the catalog's definition) every copy is counted.
function placedCopies(card: Placement, difficulty: Difficulty, seatCount?: number): number {
  const copies = copiesAt(card, difficulty);
  if (card.byPlayers != null && seatCount != null) return Math.min(copies, seatCount >= card.byPlayers.from ? card.byPlayers.many : card.byPlayers.few);
  return card.perPlayer != null && seatCount != null ? Math.min(copies, card.perPlayer * seatCount) : copies;
}

// The encounter deck at a difficulty. Easy drops the cards the booklet marks (the `easy` count of each placement); Nightmare deals
// the Nightmare piles (placementsAt). The copies of a per-player Setup card the players did not take stay in the encounter deck.
export function encounterCodes(data: AnyScenarioData, difficulty: Difficulty = "Normal", seatCount?: number): string[] {
  return placementsAt(data, difficulty).flatMap((card) => {
    const copies = card.pile === "encounter" || card.searched ? copiesAt(card, difficulty) : card.pile === "quest" || card.pile === "burden" ? 0 : copiesAt(card, difficulty) - placedCopies(card, difficulty, seatCount);
    return Array.from({ length: copies }, () => card.code);
  });
}

// The quest deck: each stage once, and a stage printed in several copies ("a different stage 2A" for each player, 10038:B:1) once for each seat, never more than
// the copies the box holds. Every stage the box prints once is dealt once, so a scenario without such a stage deals `data.stages` unchanged.
// The Nightmare deck's quest cards (`nightmare.questCards`) take the place of the stages its setup card removes from the quest deck (`nightmare.removed` with the pile `quest`: Into the Pit's Goblin Patrol
// leaves and Goblin Ambush takes its place, 901001:B:3 and 901001:B:11, "in stage order"): the first takes the first removed stage's place and so on. The ones left follow the stages: a stage 3 after the last printed one (Grimbeorn's Folly, 900511).
export function questDeckCodes(data: AnyScenarioData, difficulty: Difficulty = "Normal", seatCount = 1): string[] {
  const placements = placementsAt(data, difficulty);
  const nightmare = difficulty === "Nightmare" ? data.nightmare : undefined;
  const added = nightmare?.questCards ?? [];
  const printed = new Set(data.cards.filter((card) => card.pile === "quest").map((card) => card.code));
  let taken = 0;
  const stages = data.stages.flatMap((code) => {
    const placed = placements.find((card) => card.pile === "quest" && card.code === code);
    // A stage the setup card removes: the next Nightmare quest card, when it has one, stands in its place.
    if (!placed && nightmare && printed.has(code)) return taken < added.length ? [added[taken++] as string] : [];
    const copies = placed ? Math.max(1, Math.min(copiesAt(placed, difficulty), seatCount)) : 1;
    return Array.from({ length: copies }, () => code);
  });
  return [...stages, ...added.slice(taken)];
}

const SETUP_VERB = {
  setAside: "SetAside",
  // The Stormcaller's quest stages wait set aside until the Setup prepares the Stormcaller's area (dcce.stormcallers-area).
  stormcallerQuests: "SetAside",
  // The encounter set a quest stage swaps into the encounter deck waits set aside, out of play (dcce.stormcaller-and-the-thing).
  encounterDeck2: "SetAside",
  staging: "AddToStaging",
  activeLocation: "MakeActiveLocation",
  attached: "AttachToRingBearer",
} as const;

// Order of the quest card's setup steps: set aside, add to staging, make a location active, then attach.
// Each copy is one instruction at the difficulty played; a per-player card is one per seat when the seat count is known
// (buildStart). The encounter, quest and burden piles are dealt by buildStart.
export function setupInstructions(data: AnyScenarioData, difficulty: Difficulty = "Normal", seatCount?: number): Instruction[] {
  const instructions: Instruction[] = [];
  const cards = placementsAt(data, difficulty);
  for (const pile of ["setAside", "stormcallerQuests", "encounterDeck2", "staging", "activeLocation", "attached"] as const) {
    for (const card of cards) {
      if (card.pile !== pile || card.searched) continue;
      for (let copy = 0; copy < placedCopies(card, difficulty, seatCount); copy += 1) instructions.push({ verb: SETUP_VERB[pile], code: card.code });
    }
  }
  return instructions;
}

// The Corsair deck a scenario deals, copy by copy (dcce.corsair-deck): the `corsairDeck` pile at the difficulty played.
export function corsairCodes(data: AnyScenarioData, difficulty: Difficulty = "Normal"): string[] {
  return placementsAt(data, difficulty).flatMap((card) => (card.pile === "corsairDeck" ? Array.from({ length: copiesAt(card, difficulty) }, () => card.code) : []));
}

// The decks of Ered Mithrin a scenario deals, copy by copy (emce.caves-deck, emce.evil-creatures-deck): each of these piles at the difficulty played, by pile. A pile the scenario does not deal is left out.
export const DEAL_PILES = ["cavesDeck", "evilCreaturesDeck", "spidersDeck", "orcsDeck", "sideQuestDeck", "haradDeck", "greatSpiderDeck", "angmarOrcDeck", "smaugDeck"] as const;
export function dealtPiles(data: AnyScenarioData, difficulty: Difficulty = "Normal"): Partial<Record<(typeof DEAL_PILES)[number], string[]>> {
  const piles: Partial<Record<(typeof DEAL_PILES)[number], string[]>> = {};
  for (const card of placementsAt(data, difficulty)) {
    const pile = DEAL_PILES.find((name) => name === card.pile);
    if (pile) piles[pile] = [...(piles[pile] ?? []), ...Array.from({ length: copiesAt(card, difficulty) }, () => card.code)];
  }
  return piles;
}

// The Uncharted deck a scenario deals, copy by copy (dcce.uncharted-deck): the `unchartedDeck` pile at the difficulty played. The `islandMap` pile (dcce.island-map) is dealt the same way: its
// "Prepare the Island Map" Setup takes the double-sided locations from the deck and lays them out.
export function unchartedCodes(data: AnyScenarioData, difficulty: Difficulty = "Normal"): string[] {
  return placementsAt(data, difficulty).flatMap((card) => (card.pile === "unchartedDeck" || card.pile === "islandMap" ? Array.from({ length: copiesAt(card, difficulty) }, () => card.code) : []));
}

// The cards of a scenario with two sides that are two catalog cards (`back`), copy by copy, for the Grotto deck (dcce.grotto-deck): the `grottoDeck` pile at the difficulty played, and the `setAside` cards with a
// `back` once each (the engine keeps those that are Grotto locations: the Shrine to Morgoth's Underwater side).
export function doubleSidedCards(data: AnyScenarioData, difficulty: Difficulty = "Normal"): { code: string; back: string; pile: "grottoDeck" | "setAside" }[] {
  return placementsAt(data, difficulty).flatMap((card) => {
    if (card.back == null || (card.pile !== "grottoDeck" && card.pile !== "setAside")) return [];
    const copies = card.pile === "setAside" ? 1 : copiesAt(card, difficulty);
    return Array.from({ length: copies }, () => ({ code: card.code, back: card.back as string, pile: card.pile as "grottoDeck" | "setAside" }));
  });
}

export function burdenCodes(data: AnyScenarioData): string[] {
  return data.cards.filter((card) => card.pile === "burden").flatMap((card) => Array.from({ length: card.normal }, () => card.code));
}

// A record's place on its card: the lowest printed line it names (side A before side B, then line number), then its record number.
function printedPlace(effect: Effect): [number, number, number] {
  let side = Infinity;
  let line = Infinity;
  for (const id of effect.lines) {
    const [, s, n] = id.split(":");
    const at: [number, number] = [s === "A" ? 0 : 1, Number(n)];
    if (at[0] < side || (at[0] === side && at[1] < line)) [side, line] = at;
  }
  return [side, line, Number(effect.id.split(":").at(-1))];
}

// Records of one card in printed order, whatever order the list holds them in (generated records come before authored ones).
function inPrintedOrder(effects: Effect[]): Effect[] {
  const place = new Map(effects.map((effect) => [effect, printedPlace(effect)]));
  return effects.sort((a, b) => {
    const [x, y] = [place.get(a)!, place.get(b)!];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
}

// The records of one timing on a card, in printed line order, flattened to their instructions.
export function recordInstructions(effects: readonly Effect[], code: string, timing: Effect["timing"]): Instruction[] {
  return inPrintedOrder(effects.filter((effect) => effect.cardCode === code && effect.timing === timing)).flatMap((effect) => effect.instructions);
}

// The same for one side of a double-sided card whose two sides are both in the game's records but only one is faceup (the Hard/Expert Mode
// card: side A Hard, side B Expert). A record belongs to a side when every line it implements is a line of that side ("<code>:<side>:<n>").
export function sideInstructions(effects: readonly Effect[], code: string, side: "A" | "B", timing: Effect["timing"]): Instruction[] {
  return inPrintedOrder(effects.filter((effect) => effect.cardCode === code && effect.timing === timing && effect.lines.every((line) => line.startsWith(`${code}:${side}:`)))).flatMap((effect) => effect.instructions);
}

// The Hard/Expert Mode card (collector 217, dcce.hard-expert): put next to the quest deck in a game of a campaign with XP.
export const MODE_CARD_CODE = "11217";

// The cards a campaign game deals beyond the scenario's own piles, the one list every reader of "what a game deals" shares (the world the
// briefing loads, the effect tooling, the coverage tests): the Campaign Expansion's reprint of each card (ScenarioData.reprints) and, in a
// campaign with XP, the Hard/Expert Mode card.
export function campaignGameCodes(campaign: Pick<CampaignData, "xp">, scenario: Pick<ScenarioData, "reprints" | "modeCard" | "easyModeCard">): string[] {
  return [...Object.values(scenario.reprints ?? {}), ...(scenario.modeCard != null ? [scenario.modeCard] : []), ...(scenario.easyModeCard != null ? [scenario.easyModeCard] : []), ...(campaign.xp ? [MODE_CARD_CODE] : [])];
}

// What a campaign game deals of a scenario that has reprints: the Campaign Expansion's reprint of each card in place of the original, in every
// pile, the quest stages and the cards the campaign card places (ScenarioData.reprints). Standalone play deals the scenario as it is.
export function campaignScenario<T extends AnyScenarioData>(data: T): T {
  const reprints = data.reprints;
  if (!reprints) return data;
  const swap = (code: string): string => reprints[code] ?? code;
  return { ...data, stages: data.stages.map(swap), cards: data.cards.map((card) => ({ ...card, code: swap(card.code), ...(card.back != null ? { back: swap(card.back) } : {}) })), campaignPlaced: data.campaignPlaced.map(swap) };
}

// A quest card whose Forced effect names the stages its defeat proceeds to (BranchStage, 01120:B:1) carries them as its `branch`.
// A stage that names LookAtStages (11016:B:3) carries the number of stages it looks at as its `look`.
// A stage that names CatchUpWins (12013:B:3) carries the Stormcaller's stage number that makes its defeat a win as its `catchUp`.
// A stage that names AdvanceToRandomStage (19048:B:2) carries the stages it proceeds to, in a random order, as its `randomNext`.
// A stage that names AdvanceIfAttached (50601:B:3) carries the Loot card its branch asks about and the two stages it leads to as its `attachedNext`.
// A stage that names FlipAtQuestPhase (19135:A:2), or flips with its When Revealed resolving (FlipCurrentQuest `resolve`, 03070:A:1), is a stage of a quest deck (`deck`): it is not flipped when revealed.
export function stageOf(code: string, effects: readonly Effect[]): { code: string; branch?: string[]; look?: number; catchUp?: number; randomNext?: { codes: string[]; otherwise?: string; remove?: true; different?: true }; attachedNext?: { code: string; then: string; otherwise: string }; deck?: true } {
  const branch = recordInstructions(effects, code, "forced").find((instruction) => instruction.verb === "BranchStage");
  const look = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "LookAtStages");
  const catchUp = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "CatchUpWins");
  const random = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "AdvanceToRandomStage");
  const randomNext = random?.verb === "AdvanceToRandomStage" ? { codes: random.codes, ...(random.otherwise != null ? { otherwise: random.otherwise } : {}), ...(random.remove ? { remove: true as const } : {}), ...(random.different ? { different: true as const } : {}) } : undefined;
  const attached = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "AdvanceIfAttached");
  const attachedNext = attached?.verb === "AdvanceIfAttached" ? { code: attached.code, then: attached.then, otherwise: attached.otherwise } : undefined;
  const deck = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).some((instruction) => instruction.verb === "FlipAtQuestPhase" || (instruction.verb === "FlipCurrentQuest" && instruction.resolve === true));
  return { code, ...(randomNext ? { randomNext } : {}), ...(attachedNext ? { attachedNext } : {}), ...(deck ? { deck: true as const } : {}), ...(branch?.verb === "BranchStage" ? { branch: branch.codes } : {}), ...(look?.verb === "LookAtStages" ? { look: look.count } : {}), ...(catchUp?.verb === "CatchUpWins" ? { catchUp: catchUp.stage } : {}) };
}

// The pursuit value at which the players lose, when a stage's Setup sets a pursuit tracker (mec112.pursuit, SetPursuit): the `min` of the pursuit condition on a LoseGame record of a card the scenario places. Undefined
// for a scenario with no tracker. The top bar's pursuit dial draws its meter against it.
export function pursuitLimit(data: AnyScenarioData, effects: readonly Effect[]): number | undefined {
  if (!data.stages.some((code) => recordInstructions(effects, code, "setup").some((instruction) => instruction.verb === "SetPursuit"))) return undefined;
  const placed = new Set(placementsAt(data, "Normal").map((card) => card.code));
  for (const effect of effects) {
    if (!placed.has(effect.cardCode)) continue;
    for (const instruction of effect.instructions) if (instruction.verb === "LoseGame" && instruction.when?.kind === "pursuit" && instruction.when.min != null) return instruction.when.min;
  }
  return undefined;
}

// The objective whose tokens end a stage when they reach a number (mec112.defense, The Defense of Helm's Deep, 143033:A:3): the card of a record whose instruction is held by a `tokens` condition on that card, the `min` of it,
// and the quest stage (1-based, as `stageNumber` counts) the same record's `AdvanceToStage` goes to. Undefined for a scenario that deals no such card. The top bar's Defense dial draws its meter against the limit.
export function defenseTracker(data: AnyScenarioData, effects: readonly Effect[]): { code: string; limit: number; stage: number } | undefined {
  const dealt = new Set(data.cards.map((card) => card.code));
  for (const effect of effects) {
    if (!dealt.has(effect.cardCode) || effect.timing !== "forced") continue;
    for (const instruction of effect.instructions) {
      const when = "when" in instruction ? instruction.when : undefined;
      if (instruction.verb !== "AddSourceToVictory" || when?.kind !== "tokens" || when.code !== effect.cardCode || when.min == null) continue;
      const advance = effect.instructions.find((other) => other.verb === "AdvanceToStage");
      const stage = advance?.verb === "AdvanceToStage" ? data.stages.indexOf(advance.code) + 1 : 0;
      if (stage > 0) return { code: effect.cardCode, limit: when.min, stage };
    }
  }
  return undefined;
}

export function scenarioDefinition(data: AnyScenarioData, campaign: CampaignData, effects: readonly Effect[] = []): ScenarioDefinition {
  const burden = burdenCodes(data);
  const pursuit = pursuitLimit(data, effects);
  const defense = defenseTracker(data, effects);
  return scenarioDefinitionSchema.parse({
    id: data.id,
    encounterSets: data.encounterSets.map((set) => ({ code: set.name, count: set.count })),
    stages: data.stages.map((code) => stageOf(code, effects)),
    widgets: {
      hide: data.widgets.hide,
      lifeTracker: data.life != null,
      burdenDeck: burden.length > 0,
      ...(pursuit != null ? { pursuitTracker: pursuit } : {}),
      ...(defense != null ? { defenseTracker: defense } : {}),
      secondActiveLocation: data.widgets.secondActiveLocation,
      perSeatStaging: data.widgets.perSeatStaging,
    },
    setup: setupInstructions(data),
    resolution: data.campaignCard === undefined ? [] : recordInstructions(effects, data.campaignCard, "resolution"),
    ...(burden.length > 0 ? { burdenDeck: burden } : {}),
    ...(data.life != null ? { life: data.life } : {}),
    ...(data.campaignCard !== undefined ? { campaignCard: data.campaignCard } : {}),
    ...(data.modeCard != null ? { modeCard: { code: data.modeCard, side: "B" as const } } : {}),
    // The part of the campaign (the campaign card's "part number", dcce.gaining-xp): the scenario's place in the campaign, not its number in its product (Hall of Beorn numbers each Adventure Pack's scenario within the pack).
    // Ered Mithrin has no XP, but the burdens The King's Quest (part 3) adds to the pool read it too ("X is the campaign card's part number", 12172:A:1, 12173:A:1: emce.campaign-pool-encounter), so
    // its games from that part on hold it; the first two parts have no card that reads it, and their state is as it was.
    ...(campaign.xp || (campaign.id === "ered-mithrin" && partOf(campaign, data.id) >= BURDENS_READ_PART) ? { part: partOf(campaign, data.id) } : {}),
  });
}

/** The part of Ered Mithrin whose Resolution adds the first burdens that read the campaign card's part number (The King's Quest). */
const BURDENS_READ_PART = 3;

// The scenario's place in its campaign (1-based); a scenario the campaign does not list is a data error.
function partOf(campaign: CampaignData, scenarioId: string): number {
  const at = campaign.scenarios.indexOf(scenarioId);
  if (at < 0) throw new Error(`Scenario ${scenarioId} is not in campaign ${campaign.id}`);
  return at + 1;
}
