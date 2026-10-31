import { z } from "zod";

import { scenarioDefinitionSchema, type Effect, type Instruction, type ScenarioDefinition } from "./boundary.ts";

// A scenario as data/scenarios/<id>.json stores it: which cards go to which pile, in Normal and Easy
// counts. The sync adapters and the quest cards' Setup text both agree on it before the build writes it.
// `burden` is the burden deck (Flight to the Ford): a zone beside the quest deck, not part of the encounter deck.
// `attachedChosen` is a card the quest's Setup attaches to a hero the first player chooses (The Caves of Nibin-Dûm's Cave
// Torch): out of the encounter deck, dealt by the Setup record, not by `setupInstructions`.
// Dream-chaser's extra decks (docs/plans/dream-chaser.md, phase 37), each a zone the scenario's Setup prepares (the engine reads them from
// phase 39 on): `corsairDeck` (the non-ship enemies, "Prepare the Corsair deck", dcce.corsair-deck), `encounterDeck2` (the deck the
// quest swaps to: The Thing in the Depths 5, The City of Corsairs 9, dcce.from-sea-to-land), `unchartedDeck` (dcce.uncharted-deck),
// `islandMap` (Temple of the Deceived's fifteen double-sided locations, dcce.island-map), `grottoDeck` (dcce.grotto-deck) and
// `stormcallerQuests` (stages 2C to 4C beside the Stormcaller, dcce.stormcallers-area). None is part of the encounter deck.
export const PILES = ["encounter", "quest", "staging", "activeLocation", "setAside", "attached", "burden", "attachedChosen", "corsairDeck", "encounterDeck2", "unchartedDeck", "islandMap", "grottoDeck", "stormcallerQuests"] as const;
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

// A scenario's Nightmare deck (docs/plans/nightmare-mode.md), from its setup card: the standard piles less `removed` (each copy
// taken from the pile it was in), with the deck's own cards (`cards`, the copies printed) shuffled in. A Nightmare card takes the
// Setup slot of a removed card of its title (`pile`, `perPlayer`). The setup card is placed next to the quest deck, side A faceup,
// and its lines stay active all game.
// In the order a removal takes from them: the encounter deck, then the piles the quest's Setup fills from it.
export const NIGHTMARE_PILES = ["encounter", "staging", "activeLocation", "setAside", "attached"] as const;
const nightmareSchema = z.strictObject({
  setupCard: z.string().min(1),
  removed: z.array(z.strictObject({ code: z.string().min(1), copies: z.number().int().positive(), pile: z.enum(NIGHTMARE_PILES) })),
  cards: z
    .array(z.strictObject({ code: z.string().min(1), copies: z.number().int().positive(), pile: z.enum(NIGHTMARE_PILES), perPlayer: z.number().int().positive().optional() }))
    .min(1),
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
    // The campaign card printed for this scenario. Its Setup and Resolution records belong to the scenario.
    campaignCard: z.string().min(1),
    // Cards the campaign card's Setup places or shuffles in. They are not in `cards`; the records deal them.
    campaignPlaced: z.array(z.string().min(1)),
    // Dream-chaser: the Campaign Expansion's reprint of a card this scenario deals (in `cards` or `campaignPlaced`), by the code it is dealt under.
    // A campaign game deals the reprint, with its Campaign Mode only or Upgraded side; standalone play deals the card named in `cards`.
    reprints: z.record(z.string().min(1), z.string().min(1)).optional(),
    // The Ring-bearer's starting life, when a Setup line sets it.
    life: z.number().int().positive().optional(),
    // Table pieces the cards call for, read from their printed text by the build.
    widgets: z.strictObject({ hide: z.boolean(), secondActiveLocation: z.boolean(), perSeatStaging: z.boolean() }),
    // The DragnCards decks the Fellowship box is loaded from (null where the box has none: Hall of Beorn's counts and the printed
    // Setup text place its cards), and the Hall of Beorn scenario file.
    source: z.strictObject({ dragnNormal: z.string().nullable(), dragnEasy: z.string().nullable(), hobSlug: z.string() }),
    // The Nightmare deck played with this scenario, where one is printed.
    nightmare: nightmareSchema.optional(),
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

export type ScenarioData = z.infer<typeof scenarioDataSchema>;
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
  // The campaign card of each scenario, by scenario id. Its Setup and Resolution lines are effect records.
  campaignCards: z.record(z.string(), z.string().min(1)),
  // The booklet the campaign opens (src/screens/booklets/books.ts): the Fellowship's MEC109, the Learn to Play for Mirkwood
  // Paths, The Dark of Mirkwood's rulebook for the two-scenario campaign.
  bookletId: z.string().min(1),
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
  prelude: z.array(z.strictObject({ code: z.string().min(1) })),
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
  }),
);
export type CampaignIndexEntry = z.infer<typeof campaignIndexSchema>[number];

export function parseScenarioData(raw: unknown): ScenarioData {
  const parsed = scenarioDataSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string" ? raw.id : "(missing id)";
    const paths = parsed.error.issues.map((issue) => (issue.path.length === 0 ? issue.message : `${issue.path.join(".")}: ${issue.message}`)).join(", ");
    throw new Error(`Scenario ${id}: ${paths}`);
  }
  return parsed.data;
}

export function scenarioCards(data: ScenarioData): Placement[] {
  return data.cards;
}

export function normalEncounterSize(data: ScenarioData): number {
  return data.cards.filter((card) => card.pile === "encounter").reduce((sum, card) => sum + card.normal, 0);
}

export function normalCopiesByCode(data: ScenarioData): Map<string, number> {
  const totals = new Map<string, number>();
  for (const card of data.cards) totals.set(card.code, (totals.get(card.code) ?? 0) + card.normal);
  return totals;
}

// Nightmare plays the scenario's Nightmare deck (docs/plans/nightmare-mode.md), where it has one (`nightmare`).
export const DIFFICULTIES = ["Easy", "Normal", "Nightmare"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// The piles at a difficulty. Easy and Normal read each placement's own count. Nightmare starts from the Normal piles, takes out the
// copies the setup card removes from the pile each came from, and adds the Nightmare deck's cards to theirs (`nightmare`).
export function placementsAt(data: ScenarioData, difficulty: Difficulty = "Normal"): Placement[] {
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
export function encounterCodes(data: ScenarioData, difficulty: Difficulty = "Normal", seatCount?: number): string[] {
  return placementsAt(data, difficulty).flatMap((card) => {
    const copies = card.pile === "encounter" || card.searched ? copiesAt(card, difficulty) : card.pile === "quest" || card.pile === "burden" ? 0 : copiesAt(card, difficulty) - placedCopies(card, difficulty, seatCount);
    return Array.from({ length: copies }, () => card.code);
  });
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
export function setupInstructions(data: ScenarioData, difficulty: Difficulty = "Normal", seatCount?: number): Instruction[] {
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
export function corsairCodes(data: ScenarioData, difficulty: Difficulty = "Normal"): string[] {
  return placementsAt(data, difficulty).flatMap((card) => (card.pile === "corsairDeck" ? Array.from({ length: copiesAt(card, difficulty) }, () => card.code) : []));
}

// The Uncharted deck a scenario deals, copy by copy (dcce.uncharted-deck): the `unchartedDeck` pile at the difficulty played.
export function unchartedCodes(data: ScenarioData, difficulty: Difficulty = "Normal"): string[] {
  return placementsAt(data, difficulty).flatMap((card) => (card.pile === "unchartedDeck" ? Array.from({ length: copiesAt(card, difficulty) }, () => card.code) : []));
}

export function burdenCodes(data: ScenarioData): string[] {
  return data.cards.filter((card) => card.pile === "burden").flatMap((card) => Array.from({ length: card.normal }, () => card.code));
}

// The records of one timing on a card, in line order, flattened to their instructions.
export function recordInstructions(effects: readonly Effect[], code: string, timing: Effect["timing"]): Instruction[] {
  return effects.filter((effect) => effect.cardCode === code && effect.timing === timing).flatMap((effect) => effect.instructions);
}

// The same for one side of a double-sided card whose two sides are both in the game's records but only one is faceup (the Hard/Expert Mode
// card: side A Hard, side B Expert). A record belongs to a side when every line it implements is a line of that side ("<code>:<side>:<n>").
export function sideInstructions(effects: readonly Effect[], code: string, side: "A" | "B", timing: Effect["timing"]): Instruction[] {
  return effects.filter((effect) => effect.cardCode === code && effect.timing === timing && effect.lines.every((line) => line.startsWith(`${code}:${side}:`))).flatMap((effect) => effect.instructions);
}

// The Hard/Expert Mode card (collector 217, dcce.hard-expert): put next to the quest deck in a game of a campaign with XP.
export const MODE_CARD_CODE = "11217";

// The cards a campaign game deals beyond the scenario's own piles, the one list every reader of "what a game deals" shares (the world the
// briefing loads, the effect tooling, the coverage tests): the Campaign Expansion's reprint of each card (ScenarioData.reprints) and, in a
// campaign with XP, the Hard/Expert Mode card.
export function campaignGameCodes(campaign: Pick<CampaignData, "xp">, scenario: Pick<ScenarioData, "reprints">): string[] {
  return [...Object.values(scenario.reprints ?? {}), ...(campaign.xp ? [MODE_CARD_CODE] : [])];
}

// What a campaign game deals of a scenario that has reprints: the Campaign Expansion's reprint of each card in place of the original, in every
// pile, the quest stages and the cards the campaign card places (ScenarioData.reprints). Standalone play deals the scenario as it is.
export function campaignScenario(data: ScenarioData): ScenarioData {
  const reprints = data.reprints;
  if (!reprints) return data;
  const swap = (code: string): string => reprints[code] ?? code;
  return { ...data, stages: data.stages.map(swap), cards: data.cards.map((card) => ({ ...card, code: swap(card.code), ...(card.back != null ? { back: swap(card.back) } : {}) })), campaignPlaced: data.campaignPlaced.map(swap) };
}

// A quest card whose Forced effect names the stages its defeat proceeds to (BranchStage, 01120:B:1) carries them as its `branch`.
// A stage that names LookAtStages (11016:B:3) carries the number of stages it looks at as its `look`.
// A stage that names CatchUpWins (12013:B:3) carries the Stormcaller's stage number that makes its defeat a win as its `catchUp`.
function stageOf(code: string, effects: readonly Effect[]): { code: string; branch?: string[]; look?: number; catchUp?: number } {
  const branch = recordInstructions(effects, code, "forced").find((instruction) => instruction.verb === "BranchStage");
  const look = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "LookAtStages");
  const catchUp = effects.filter((effect) => effect.cardCode === code).flatMap((effect) => effect.instructions).find((instruction) => instruction.verb === "CatchUpWins");
  return { code, ...(branch?.verb === "BranchStage" ? { branch: branch.codes } : {}), ...(look?.verb === "LookAtStages" ? { look: look.count } : {}), ...(catchUp?.verb === "CatchUpWins" ? { catchUp: catchUp.stage } : {}) };
}

export function scenarioDefinition(data: ScenarioData, campaign: CampaignData, effects: readonly Effect[] = []): ScenarioDefinition {
  const burden = burdenCodes(data);
  return scenarioDefinitionSchema.parse({
    id: data.id,
    encounterSets: data.encounterSets.map((set) => ({ code: set.name, count: set.count })),
    stages: data.stages.map((code) => stageOf(code, effects)),
    widgets: {
      hide: data.widgets.hide,
      lifeTracker: data.life != null,
      burdenDeck: burden.length > 0,
      secondActiveLocation: data.widgets.secondActiveLocation,
      perSeatStaging: data.widgets.perSeatStaging,
    },
    setup: setupInstructions(data),
    resolution: recordInstructions(effects, data.campaignCard, "resolution"),
    ...(burden.length > 0 ? { burdenDeck: burden } : {}),
    ...(data.life != null ? { life: data.life } : {}),
    campaignCard: data.campaignCard,
    // The part of the campaign (the campaign card's "part number", dcce.gaining-xp): the scenario's place in the campaign, not its number in its product (Hall of Beorn numbers each Adventure Pack's scenario within the pack).
    ...(campaign.xp ? { part: partOf(campaign, data.id) } : {}),
  });
}

// The scenario's place in its campaign (1-based); a scenario the campaign does not list is a data error.
function partOf(campaign: CampaignData, scenarioId: string): number {
  const at = campaign.scenarios.indexOf(scenarioId);
  if (at < 0) throw new Error(`Scenario ${scenarioId} is not in campaign ${campaign.id}`);
  return at + 1;
}
