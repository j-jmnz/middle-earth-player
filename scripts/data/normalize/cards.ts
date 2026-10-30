import { z } from "zod";

import type { PrintedKeywords, RingsDbCard, RingsDbPack } from "../../../src/catalog/boundary.ts";
import { cardSchema, type Card, type Printing } from "../../../src/catalog/card-facts.ts";
import { deckLegal } from "../../../src/catalog/deck-legal.ts";
import { PILES } from "../../../src/catalog/scenario-data.ts";
import { CAMPAIGN_SUFFIX, PRODUCTS } from "../campaign-defs.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import { parseKeywordTokens } from "./keywords.ts";
import type { RawData } from "./load-raw.ts";
import { titleKey } from "./names.ts";
import { addNightmareCards, addProductCards, foldTwoSided, productCodeOf } from "./product-cards.ts";
import { timingLabels } from "./timings.ts";

const TFOTR = "The Fellowship of the Ring";
// Hall of Beorn card sets whose twin codes are RingsDB codes, with the RingsDB pack of each (PRODUCTS, in campaign order).
const TWIN_SETS: ReadonlyMap<string, string> = new Map(PRODUCTS.flatMap((product) => (product.twinPack ? [[product.name, product.twinPack] as const] : [])));
// Sets Hall of Beorn numbers from 00001 with no RingsDB code of their own.
const UNCODED_SETS = new Set([TFOTR, "The Two Towers", "The Return of the King"]);

const TYPE_BY_HOB: Readonly<Record<string, { type: string; typeName: string }>> = {
  Hero: { type: "hero", typeName: "Hero" },
  Ally: { type: "ally", typeName: "Ally" },
  Attachment: { type: "attachment", typeName: "Attachment" },
  Event: { type: "event", typeName: "Event" },
  Enemy: { type: "enemy", typeName: "Enemy" },
  Location: { type: "location", typeName: "Location" },
  Treachery: { type: "treachery", typeName: "Treachery" },
  Quest: { type: "quest", typeName: "Quest" },
  Objective: { type: "objective", typeName: "Objective" },
  Objective_Ally: { type: "objective", typeName: "Objective Ally" },
  Campaign: { type: "campaign", typeName: "Campaign" },
  Nightmare_Setup: { type: "nightmare", typeName: "Nightmare" },
  // Types only Nightmare decks of later cycles print (the encounter side quests of The Lost Realm on, Dream-chaser's ships).
  Encounter_Side_Quest: { type: "encounter-side-quest", typeName: "Encounter Side Quest" },
  Ship_Enemy: { type: "ship-enemy", typeName: "Ship-enemy" },
  // Dream-chaser's player ships (dcce.ship-objectives): an objective ally that attacks and defends against ship-enemies only.
  Ship_Objective: { type: "ship-objective", typeName: "Ship-objective" },
};

const overridesSchema = z.object({
  cards: z.array(
    z.object({
      match: z.object({ code: z.string().optional(), name: z.string().optional(), set: z.string().optional(), number: z.number().optional() }),
      set: z.object({ code: z.string().optional(), pack: z.string().optional(), burdenSet: z.string().optional(), encounterSet: z.string().optional(), name: z.string().optional(), threat: z.number().int().optional(), engagementCost: z.number().int().optional(), keywords: z.record(z.string(), z.unknown()).optional() }),
      reason: z.string().min(1),
      source: z.string().min(1),
    }),
  ),
  // A scenario's pile for one card, where the sources put it somewhere its own Setup text does not.
  scenarioPiles: z
    .array(
      z.object({
        scenario: z.string().min(1),
        code: z.string().min(1),
        pile: z.enum([...PILES, "campaign"]),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // A printed Easy count the sources disagree on. `easy` is the count of copies that stay in an Easy deck.
  scenarioEasy: z
    .array(z.object({ scenario: z.string().min(1), code: z.string().min(1), easy: z.number().int().nonnegative(), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A product whose Hall of Beorn codes collide with another product's: the code is `prefix` and the collector number padded to
  // `width` digits (two by default), which is the code RingsDB gives the same cards where it lists them. A set may have several
  // entries, each for the collector numbers from `from` up (0 by default); the entry with the highest `from` the card reaches wins.
  productCodes: z
    .array(
      z.object({
        set: z.string().min(1),
        prefix: z.string().regex(/^\d{2,3}$/),
        width: z.number().int().min(2).max(3).default(2),
        from: z.number().int().nonnegative().default(0),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // A name a booklet prints for an encounter set that the cards print otherwise (the Learn to Play's "Journey Down the Anduin").
  encounterSetAliases: z
    .array(z.object({ booklet: z.string().min(1), set: z.string().min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // Cards the app leaves out of the player card pool (not deck-legal): every card of a pack, or one card by code.
  outOfScope: z
    .array(z.object({ pack: z.string().min(1).optional(), code: z.string().min(1).optional(), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A campaign no scenario file is built for yet. The sources group its scenarios under packs; the override names the
  // campaign and the packs (Hall of Beorn products), because no source names a campaign.
  campaigns: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1), products: z.array(z.string().min(1)).min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
});
export type Overrides = z.infer<typeof overridesSchema>;
export function parseOverrides(raw: unknown): Overrides {
  return overridesSchema.parse(raw);
}

export type BuildReport = {
  unknownKeywords: Record<string, number>;
  twinless: string[];
};

const RULE_FIELDS = ["name", "text", "cost", "deck_limit", "type_code", "type_name", "sphere_code", "traits", "is_unique", "has_errata", "threat", "willpower", "attack", "defense", "health", "quest", "victory"] as const;

// The listed keys of `source` that hold a value (a missing key stays out, so a spread never overwrites a card's field with undefined).
function pickDefined<K extends string>(source: Partial<Record<K, number>> | undefined, keys: readonly K[]): Partial<Record<K, number>> {
  return Object.fromEntries(keys.flatMap((key) => (source?.[key] != null ? [[key, source[key]]] : []))) as Partial<Record<K, number>>;
}

function comparePacks(left: RingsDbPack, right: RingsDbPack): number {
  if (left.cycle_position !== right.cycle_position) return left.cycle_position - right.cycle_position;
  if (left.position !== right.position) return left.position - right.position;
  return left.code.localeCompare(right.code);
}

function num(value: string | null | undefined): number | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function splitTraits(traits: readonly string[] | string | null | undefined): string[] {
  const list = typeof traits === "string" ? traits.split(".") : (traits ?? []).flatMap((trait) => trait.split("."));
  return list.map((trait) => trait.trim()).filter((trait) => trait !== "");
}

function sideText(lines: readonly string[]): string | null {
  const text = lines.map((line) => line.trim()).filter((line) => line !== "").join("\n").replaceAll("`", "'");
  return text === "" ? null : text;
}

type HobFacts = Pick<Card, "traits" | "threat" | "willpower" | "attack" | "defense" | "health" | "questPoints" | "victory" | "engagementCost" | "cost" | "stage" | "keywords" | "timings" | "campaignKind" | "burdenSet" | "text" | "shadowText" | "back" | "isUnique" | "quantity" | "easyQuantity" | "encounterSet" | "hasErrata">;

type DragnRow = Record<string, string> | undefined;

// Hall of Beorn's keyword list can miss one that the card text and DragnCards carry (Bucklebury Ferry's
// Immune, Bag End's Victory 1). The two sources are merged; DragnCards' free-text keywords field is only
// read for sentences that parse as keywords.
function keywordsOf(card: HobCard, dragn: DragnRow, report: BuildReport): { keywords: PrintedKeywords; victory: number | null } {
  let victory: number | null = num(dragn?.victoryPoints);
  const tokens = card.Front.Keywords.filter((token) => {
    const match = /^Victory (\d+)\.?$/i.exec(token.trim());
    if (match?.[1]) victory = Number(match[1]);
    return !match;
  });
  const parsed = parseKeywordTokens(tokens);
  const fromDragn = parseKeywordTokens((dragn?.keywords ?? "").split(/(?<=\.)\s+/).filter((sentence) => parseKeywordTokens([sentence]).unknown.length === 0));
  Object.assign(parsed.keywords, fromDragn.keywords);
  for (const token of parsed.unknown) report.unknownKeywords[token] = (report.unknownKeywords[token] ?? 0) + 1;
  return { keywords: parsed.keywords, victory };
}

// Every line that is only keywords is not an ability.
function keywordOnly(card: HobCard): (line: string) => boolean {
  const tokens = new Set(card.Front.Keywords.map((token) => token.trim().toLowerCase()));
  return (line) => {
    const parts = line.split(/(?<=\.)\s+/).map((part) => part.trim().toLowerCase());
    return parts.every((part) => tokens.has(part));
  };
}

const PLAYER_TYPES = new Set(["hero", "ally", "attachment", "event"]);
const ENCOUNTER_TYPES = new Set(["enemy", "location", "treachery", "objective", "encounter-side-quest", "ship-enemy", "ship-objective"]);

// The type bar says Boon or Burden. A burden's burden set is printed where an encounter set icon would be, and
// Hall of Beorn lists it as the card's encounter set.
function campaignFacts(card: HobCard): { campaignKind: "boon" | "burden" | null; burdenSet: string | null } {
  const kind = card.CardSubType === "Boon" ? "boon" : card.CardSubType === "Burden" ? "burden" : null;
  return { campaignKind: kind, burdenSet: kind === "burden" ? setName(card.EncounterInfo?.EncounterSet, card.CardSet) : null };
}

// Hall of Beorn names the encounter sets of the campaign editions "Spiders of Mirkwood (Campaign)". The suffix is not part
// of the set's name.
// The Dream-chaser Campaign Expansion's sets read "The Fate of Númenor Campaign" (no parentheses) and belong to the scenario's set.
const BUILT_PRODUCT_NAMES: ReadonlySet<string> = new Set(PRODUCTS.map((product) => product.name));
function setName(name: string | null | undefined, cardSet?: string): string | null {
  if (name == null) return null;
  const plain = name.replace(CAMPAIGN_SUFFIX, "");
  if (cardSet === undefined || !BUILT_PRODUCT_NAMES.has(cardSet)) return plain;
  return plain.replace(/ Campaign$/, "");
}

// RingsDB types every boon and burden "treasure" and gives it the type name Campaign. The type bar prints the real
// type (Attachment, Treachery, Objective Ally), which is what the card does in play.
function realType(card: HobCard): { type: string; typeName: string } | null {
  return card.CardSubType === "Boon" || card.CardSubType === "Burden" ? (TYPE_BY_HOB[card.CardType] ?? null) : null;
}

function backTypeOf(type: string): "player" | "encounter" | null {
  return PLAYER_TYPES.has(type) ? "player" : ENCOUNTER_TYPES.has(type) ? "encounter" : null;
}

function hobFacts(card: HobCard, dragn: DragnRow, report: BuildReport): HobFacts {
  const stats = card.Front.Stats;
  const { keywords, victory } = keywordsOf(card, dragn, report);
  const text = sideText(card.Front.Text);
  const back = card.Back;
  return {
    traits: splitTraits(card.Front.Traits),
    threat: num(stats.Threat) ?? num(stats.ThreatCost),
    willpower: num(stats.Willpower),
    attack: num(stats.Attack),
    defense: num(stats.Defense),
    health: num(stats.HitPoints),
    questPoints: num(stats.QuestPoints) ?? num(back?.Stats.QuestPoints),
    victory,
    engagementCost: num(stats.EngagementCost),
    cost: stats.ResourceCost ?? null,
    stage: stats.StageNumber ?? null,
    keywords,
    // Front lines, then side B, then the shadow effect: the order the effect records are numbered in.
    timings: [
      ...timingLabels(text, keywordOnly(card)),
      ...(card.Back ? timingLabels(sideText(card.Back.Text), keywordOnly(card)) : []),
      ...(card.Front.Shadow?.trim() ? ["shadow"] : []),
    ],
    text,
    shadowText: card.Front.Shadow?.trim().replaceAll("`", "'") || null,
    back: back
      ? { name: null, text: sideText(back.Text), questPoints: num(back.Stats.QuestPoints), stage: back.Stats.StageNumber ?? null }
      : null,
    isUnique: card.IsUnique,
    quantity: card.Quantity,
    easyQuantity: card.EncounterInfo?.EasyModeQuantity ?? null,
    encounterSet: setName(card.EncounterInfo?.EncounterSet, card.CardSet),
    hasErrata: card.HasErrata,
    ...campaignFacts(card),
  };
}

// DragnCards' scan is listed first, Hall of Beorn's after it: both are full card art, which RingsDB lacks for encounter cards.
function printingOf(pack: string, card: HobCard, dragnImage: string | null): Printing {
  const imageUrls = [dragnImage, card.Front.ImagePath, card.Back?.ImagePath].filter((url): url is string => typeof url === "string" && url !== "");
  return {
    pack,
    number: card.Number,
    hobSlug: card.Slug,
    ...(card.OctgnGuid ? { octgnGuid: card.OctgnGuid } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
  };
}

function ringsDbCardFacts(card: RingsDbCard): Omit<Card, "printings" | "campaignKind" | "burdenSet" | "backType" | "keywords" | "timings" | "back" | "stage" | "easyQuantity" | "encounterSet" | "shadowText"> {
  return {
    code: card.code,
    name: card.name,
    type: card.type_code,
    typeName: card.type_name,
    sphere: card.sphere_code ?? null,
    traits: splitTraits(card.traits),
    isUnique: card.is_unique,
    cost: card.cost ?? null,
    deckLimit: card.deck_limit ?? null,
    threat: card.threat ?? null,
    willpower: card.willpower ?? null,
    attack: card.attack ?? null,
    defense: card.defense ?? null,
    health: card.health ?? null,
    questPoints: card.quest ?? null,
    victory: card.victory ?? null,
    engagementCost: card.engagement_cost ?? null,
    quantity: card.quantity,
    text: card.text ?? null,
    hasErrata: card.has_errata,
    errata: card.has_errata ? (card.text ?? null) : null,
    imagesrc: card.imagesrc ?? null,
    deckLegal: deckLegal(card.type_code, card.type_name),
  };
}

function assertRulesMatch(code: string, left: RingsDbCard, right: RingsDbCard): void {
  for (const field of RULE_FIELDS) {
    if ((left[field] ?? null) !== (right[field] ?? null)) throw new Error(`Card ${code}: pack files disagree on ${field}`);
  }
}

// Hall of Beorn's type names for the RingsDB deck-legal types.
const PLAYER_TYPE_BY_HOB: Readonly<Record<string, string>> = {
  Hero: "hero",
  Ally: "ally",
  Attachment: "attachment",
  Event: "event",
  Contract: "contract",
  Player_Side_Quest: "player-side-quest",
};

// Hall of Beorn's RingsDbCardId is not unique: the Nightmare decks, The Dark of Mirkwood and the hero and campaign
// expansions reuse the codes of the cycle they belong to (02004 is Winged Guardian and also Forest Flies), and The
// Mountain of Fire swaps three. A record is the same card only when the title matches and, for a deck-legal card, the
// type and the sides do: a player card prints a side B only when its own text says Side A (contracts, Sméagol), and a
// shadow effect only with the Encounter keyword.
function sameCard(card: RingsDbCard, hob: HobCard): boolean {
  if (titleKey(hob.Title) !== titleKey(card.name)) return false;
  if (!deckLegal(card.type_code, card.type_name)) return true;
  const encounter = hob.Front.Keywords.some((keyword) => /^Encounter\.?$/i.test(keyword.trim()));
  return PLAYER_TYPE_BY_HOB[hob.CardType] === card.type_code && (!hob.Back || /\bSide A\b/.test(card.text ?? "")) && (!hob.Front.Shadow?.trim() || encounter);
}

function twinKey(card: HobCard): string {
  return `${card.Title}\u0000${card.CardType}`;
}

// A TFotR card and its Black Riders or Road Darkens twin share a title and type. Several of each (Frodo,
// Pursued by the Enemy) pair up in campaign order, then collector number.
function pairTwins(tfotr: readonly HobCard[], twins: readonly HobCard[]): Map<HobCard, HobCard> {
  const setOrder = [...TWIN_SETS.keys()];
  const order = (a: HobCard, b: HobCard) => setOrder.indexOf(a.CardSet) - setOrder.indexOf(b.CardSet) || a.Number - b.Number;
  const groups = new Map<string, { tfotr: HobCard[]; twins: HobCard[] }>();
  for (const [list, side] of [[tfotr, "tfotr"], [twins, "twins"]] as const) {
    for (const card of list) {
      const group = groups.get(twinKey(card)) ?? { tfotr: [], twins: [] };
      group[side].push(card);
      groups.set(twinKey(card), group);
    }
  }
  const pairs = new Map<HobCard, HobCard>();
  for (const group of groups.values()) {
    group.tfotr.sort((a, b) => a.Number - b.Number);
    group.twins.sort(order);
    group.tfotr.forEach((card, index) => {
      const twin = group.twins[index];
      if (twin) pairs.set(card, twin);
    });
  }
  return pairs;
}

function overrideFor(overrides: Overrides, probe: { code?: string; name: string; set?: string; number?: number }) {
  const hit = overrides.cards.find(({ match }) =>
    (match.code === undefined || match.code === probe.code) &&
    (match.name === undefined || match.name === probe.name) &&
    (match.set === undefined || match.set === probe.set) &&
    (match.number === undefined || match.number === probe.number),
  );
  return hit?.set;
}

// A card the overrides leave out of the player card pool, by its code or by a pack it is printed in.
function outOfScope(overrides: Overrides, card: Pick<Card, "code" | "printings">): boolean {
  return overrides.outOfScope.some((entry) => entry.code === card.code || (entry.pack != null && card.printings.some((printing) => printing.pack === entry.pack)));
}

// Hall of Beorn gives the Dream-chaser ships no encounter info, but its scenario files list each ship under its set ("Umbar Fleet", "The
// Dream-chaser's Fleet"). A ship takes the set its slug is listed under; a 2023 reprint (Dream-chaser Campaign Expansion) takes its original's.
const DREAM_CHASER_PACKS: ReadonlySet<string> = new Set(PRODUCTS.filter((product) => product.home === "dream-chaser").flatMap((product) => product.packs));
function fillShipSets(raw: RawData, byCode: Map<string, Card>): void {
  const bySlug = new Map<string, string>();
  for (const scenario of raw.scenarios) {
    for (const item of scenario.ScenarioCards) if (item.EncounterSet && !/Nightmare$/.test(item.EncounterSet)) bySlug.set(item.Slug, setName(item.EncounterSet) ?? item.EncounterSet);
  }
  const ships = [...byCode.values()].filter((card) => (card.type === "ship-enemy" || card.type === "ship-objective") && card.campaignKind == null && card.printings.some((printing) => DREAM_CHASER_PACKS.has(printing.pack)));
  const named = new Map<string, string>();
  for (const card of ships) {
    const set = card.printings.map((printing) => (printing.hobSlug ? bySlug.get(printing.hobSlug) : undefined)).find((name) => name !== undefined);
    if (set) named.set(`${card.name}\u0000${card.type}`, set);
  }
  for (const card of ships) {
    const set = named.get(`${card.name}\u0000${card.type}`);
    if (card.encounterSet == null && set) byCode.set(card.code, { ...card, encounterSet: set });
  }
}

export function buildCards(raw: RawData, overrides: Overrides): { cards: Card[]; report: BuildReport } {
  const report: BuildReport = { unknownKeywords: {}, twinless: [] };

  const hobCode = productCodeOf(overrides);
  const hobCards = foldTwoSided(raw.hob).cards;
  const hobByCode = new Map<string, HobCard[]>();
  const hobByTitle = new Map<string, HobCard[]>();
  for (const card of hobCards) {
    hobByTitle.set(titleKey(card.Title), [...(hobByTitle.get(titleKey(card.Title)) ?? []), card]);
    const code = hobCode(card);
    if (UNCODED_SETS.has(card.CardSet) || !code) continue;
    hobByCode.set(code, [...(hobByCode.get(code) ?? []), card]);
  }

  // RingsDB cards, merged across the packs that reprint them.
  const copies = new Map<string, { pack: RingsDbPack; card: RingsDbCard }[]>();
  for (const pack of [...raw.packs].sort(comparePacks)) {
    for (const card of raw.ringsdb.get(pack.code) ?? []) {
      const list = copies.get(card.code) ?? [];
      const first = list[0];
      if (first) assertRulesMatch(card.code, first.card, card);
      if (!list.some((copy) => copy.pack.code === pack.code)) list.push({ pack, card });
      copies.set(card.code, list);
    }
  }

  const byCode = new Map<string, Card>();
  for (const [code, list] of copies) {
    const primary = list[0];
    if (!primary) continue;
    const base = ringsDbCardFacts(primary.card);
    // A deck-legal card none of whose code's records is the same card is looked up by title in its own pack.
    const hob =
      hobByCode.get(code)?.find((candidate) => sameCard(primary.card, candidate)) ??
      (base.deckLegal ? hobByTitle.get(titleKey(primary.card.name))?.find((candidate) => candidate.CardSet === primary.pack.name && sameCard(primary.card, candidate)) : undefined);
    const facts = hob ? hobFacts(hob, raw.dragn.get(hob.OctgnGuid ?? ""), report) : null;
    const real = hob ? realType(hob) : null;
    byCode.set(code, {
      ...base,
      ...(real ?? {}),
      deckLegal: real ? false : base.deckLegal,
      // Hall of Beorn carries keywords and timings for every card it has a record of. Elsewhere they stay unread.
      victory: base.victory,
      campaignKind: facts?.campaignKind ?? null,
      burdenSet: facts?.burdenSet ?? null,
      backType: null,
      keywords: facts?.keywords ?? null,
      timings: facts?.timings ?? [],
      back: facts?.back ?? null,
      stage: facts?.stage ?? null,
      easyQuantity: facts?.easyQuantity ?? null,
      encounterSet: facts?.encounterSet ?? null,
      shadowText: facts?.shadowText ?? null,
      printings: list.map(({ pack, card }) => ({
        pack: pack.code,
        number: card.position,
        ...(hob && pack.code === primary.pack.code && hob.OctgnGuid ? { octgnGuid: hob.OctgnGuid } : {}),
        ...(hob && pack.code === primary.pack.code ? { hobSlug: hob.Slug } : {}),
      })),
    });
  }

  // Fellowship cards: the TFotR printing wins over the twin it was paired with.
  const tfotr = hobCards.filter((card) => card.CardSet === TFOTR);
  const twins = hobCards.filter((card) => TWIN_SETS.has(card.CardSet));
  const pairs = pairTwins(tfotr, twins);
  const claimed = new Set<HobCard>();

  const dragnImageOf = (card: HobCard): string | null => {
    const file = raw.dragn.get(card.OctgnGuid ?? "")?.imageUrl;
    return file ? `${raw.dragnImagePrefix}${file}` : null;
  };

  const merge = (code: string, twin: HobCard | undefined, source: HobCard): Card => {
    const facts = hobFacts(source, raw.dragn.get(twin?.OctgnGuid || source.OctgnGuid || ""), report);
    const existing = byCode.get(code);
    const type = TYPE_BY_HOB[source.CardType] ?? (twin ? TYPE_BY_HOB[twin.CardType] : undefined);
    if (!existing && !type) throw new Error(`Card ${code} ${source.Title}: unknown Hall of Beorn type ${source.CardType}`);
    const printings: Printing[] = [];
    if (twin) printings.push(printingOf(TWIN_SETS.get(twin.CardSet) ?? twin.CardSet, twin, dragnImageOf(twin)));
    if (source !== twin) printings.push(printingOf("TFotR", source, null));
    const known = existing?.printings.filter((p) => !printings.some((q) => q.pack === p.pack)) ?? [];
    const card: Card = existing
      ? {
          ...existing,
          name: source.Title,
          ...facts,
          ...(realType(source) ?? {}),
          backType: existing.backType,
          // RingsDB's errata line stays with the code; Hall of Beorn does not track it.
          hasErrata: existing.hasErrata,
          sphere: source.Sphere ? source.Sphere.toLowerCase() : existing.sphere,
          cost: facts.cost ?? existing.cost,
          threat: facts.threat ?? existing.threat,
          willpower: facts.willpower ?? existing.willpower,
          attack: facts.attack ?? existing.attack,
          defense: facts.defense ?? existing.defense,
          health: facts.health ?? existing.health,
          questPoints: facts.questPoints ?? existing.questPoints,
          victory: facts.victory ?? existing.victory,
          engagementCost: facts.engagementCost ?? existing.engagementCost,
          printings: [...(existing.printings.length > 0 ? existing.printings : []), ...printings.filter((p) => !existing.printings.some((q) => q.pack === p.pack))],
        }
      : {
          code,
          name: source.Title,
          type: type?.type ?? "",
          typeName: type?.typeName ?? "",
          sphere: source.Sphere ? source.Sphere.toLowerCase() : null,
          deckLimit: null,
          ...facts,
          backType: null,
          errata: null,
          imagesrc: null,
          deckLegal: realType(source) ? false : deckLegal(type?.type ?? "", type?.typeName ?? ""),
          printings: [...printings, ...known],
        };
    return card;
  };

  for (const source of tfotr) {
    const twin = pairs.get(source);
    if (twin) claimed.add(twin);
    let code = twin?.RingsDbCardId ?? "";
    let packOverride: string | undefined;
    if (!twin) {
      const set = overrideFor(overrides, { name: source.Title, set: source.CardSet, number: source.Number });
      if (!set?.code) {
        report.twinless.push(`${source.Title} (#${source.Number})`);
        continue;
      }
      code = set.code;
      packOverride = set.pack;
    }
    const merged = merge(code, twin, source);
    if (packOverride) merged.printings = [{ ...(merged.printings[0] ?? { pack: packOverride, number: source.Number }), pack: packOverride }];
    byCode.set(code, merged);
  }
  // Twin printings with no TFotR card of their own (the later scenarios) come from Hall of Beorn alone.
  for (const twin of twins) {
    const code = twin.RingsDbCardId;
    if (claimed.has(twin) || !code || byCode.has(code)) continue;
    byCode.set(code, merge(code, twin, twin));
  }

  addProductCards(hobCards, byCode, hobCode, merge);
  addNightmareCards(hobCards, byCode, merge);
  fillShipSets(raw, byCode);

  const cards: Card[] = [];
  for (const card of byCode.values()) {
    const set = overrideFor(overrides, { code: card.code, name: card.name });
    const withKeywords = set?.keywords ? { ...card, keywords: { ...(card.keywords ?? {}), ...set.keywords } as PrintedKeywords } : card;
    const withBurden = set?.burdenSet ? { ...withKeywords, burdenSet: set.burdenSet } : withKeywords;
    const inSet = set?.encounterSet ? { ...withBurden, encounterSet: set.encounterSet } : withBurden;
    const named = set?.name ? { ...inSet, name: set.name } : inSet;
    // A printed Threat or engagement cost a source leaves out (a burden enemy: Hall of Beorn files its Threat icon as Willpower).
    const stated = { ...named, ...pickDefined(set, ["threat", "engagementCost"]) };
    const next = outOfScope(overrides, stated) ? { ...stated, deckLegal: false } : stated;
    cards.push(cardSchema.parse({ ...next, backType: backTypeOf(next.type) }));
  }
  cards.sort((left, right) => left.code.localeCompare(right.code));
  return { cards, report };
}
