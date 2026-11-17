import type { PrintedKeywords, RingsDbCard, RingsDbPack } from "../../../src/catalog/boundary.ts";
import { cardSchema, type Card, type Printing } from "../../../src/catalog/card-facts.ts";
import { deckLegal } from "../../../src/catalog/deck-legal.ts";
import { PRODUCTS, REPRINTS } from "../campaign-defs.ts";
import type { HobCard } from "../sources/hallofbeorn.ts";
import { parseKeywordTokens } from "./keywords.ts";
import type { RawData } from "./load-raw.ts";
import { titleKey } from "./names.ts";
import { pairTwins, sameCard, twinSetsOf } from "./card-twins.ts";
import { addDragnBacks, addNightmareCards, addProductCards, dragnOnlyCards, dragnRowOf, fillShipSets, fillSideQuestSets, foldTwoSided, productCodeOf, setName } from "./product-cards.ts";
import type { Overrides } from "./overrides.ts";
import { timingLabels } from "./timings.ts";

// Hall of Beorn card sets whose twin codes are RingsDB codes, with the RingsDB pack of each (PRODUCTS, in campaign order).
const TWIN_SETS: ReadonlyMap<string, string> = new Map(PRODUCTS.flatMap((product) => (product.twinPack ? [[product.name, product.twinPack] as const] : [])));
// Sets Hall of Beorn numbers from 00001 with no RingsDB code of their own: each saga box's reprint set (PRODUCTS, `reprint`).
const UNCODED_SETS = new Set(REPRINTS.map((reprint) => reprint.set));

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
  // Ered Mithrin: an objective that is also a location (The Old Ford), and the treasure a discovered campaign card becomes (emce.treasure).
  Objective_Location: { type: "objective", typeName: "Objective Location" },
  Treasure: { type: "treasure", typeName: "Treasure" },
  // Types only Nightmare decks of later cycles print (the encounter side quests of The Lost Realm on, Dream-chaser's ships).
  Encounter_Side_Quest: { type: "encounter-side-quest", typeName: "Encounter Side Quest" },
  Ship_Enemy: { type: "ship-enemy", typeName: "Ship-enemy" },
  // Dream-chaser's player ships (dcce.ship-objectives): an objective ally that attacks and defends against ship-enemies only.
  Ship_Objective: { type: "ship-objective", typeName: "Ship-objective" },
};

export { parseOverrides, type Overrides } from "./overrides.ts";

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

// A location that prints X for its quest points.
const locationPrintsX = (card: HobCard): boolean => card.Front.Stats.QuestPoints === "X" && card.CardType === "Location";

// The boxes whose quest stages the engine plays and whose side B prints X ("X is the pursuit value", The Uruk-hai 143069:B:1 and Rescue the Captives 143070:B:1): the Two Towers box and its Treason of Saruman printing. The other stages
// with an X on side B (The Paths of the Dead, Retreat from Osgiliath, On the Trail, Goblin Ambush) are in scenarios that are not built, and flagging them would change their cards before a record gives X its value, so they do not count yet.
// Neither the campaign definitions nor Hall of Beorn's card carry the box as a field, so it is read from the folder of side B's image.
const BUILT_BOXES = /\/Cards\/The-(Two-Towers|Treason-of-Saruman)\//;
const stagePrintsX = (card: HobCard): boolean => card.CardType === "Quest" && card.Back?.Stats.QuestPoints === "X" && BUILT_BOXES.test(card.Back.ImagePath ?? "");

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
  // A location or a built quest stage that prints X for its quest points (the number stays null; a record sets the value).
  if (locationPrintsX(card) || stagePrintsX(card)) parsed.keywords.questPointsX = true;
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

export const PLAYER_TYPES = new Set(["hero", "ally", "attachment", "event"]);
const ENCOUNTER_TYPES = new Set(["enemy", "location", "treachery", "objective", "encounter-side-quest", "ship-enemy", "ship-objective"]);

// A Hall of Beorn Treasure of a campaign expansion (Ered Mithrin's, emce.treasure). The Hobbit saga's Treasure rows (Sting) are RingsDB's
// "treasure / Campaign" cards and stay as they are.
const isCampaignTreasure = (card: HobCard): boolean => card.CardType === "Treasure" && PRODUCTS.some((product) => product.campaignExpansion && product.name === card.CardSet);

// The type bar says Boon or Burden (or Treasure). A burden's burden set is printed where an encounter set icon would be, and
// Hall of Beorn lists it as the card's encounter set.
function campaignFacts(card: HobCard): { campaignKind: "boon" | "burden" | "treasure" | null; burdenSet: string | null } {
  const kind = card.CardSubType === "Boon" ? "boon" : card.CardSubType === "Burden" ? "burden" : isCampaignTreasure(card) ? "treasure" : null;
  return { campaignKind: kind, burdenSet: kind === "burden" ? setName(card.EncounterInfo?.EncounterSet, card.CardSet) : null };
}

// RingsDB types every boon and burden "treasure" and gives it the type name Campaign. The type bar prints the real
// type (Attachment, Treachery, Objective Ally), which is what the card does in play. A treasure prints Treasure.
// A campaign expansion's encounter side quest (Angmar Awakened's Protect the Innocent, Mysterious Omens, Fend off Despair, Loot the Dungeons) is a campaign card
// RingsDB types "treasure" as well.
const isCampaignSideQuest = (card: HobCard): boolean => card.CardType === "Encounter_Side_Quest" && PRODUCTS.some((product) => product.campaignExpansion && product.name === card.CardSet);

function realType(card: HobCard): { type: string; typeName: string } | null {
  return card.CardSubType === "Boon" || card.CardSubType === "Burden" || isCampaignTreasure(card) || isCampaignSideQuest(card) ? (TYPE_BY_HOB[card.CardType] ?? null) : null;
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

export function buildCards(raw: RawData, overrides: Overrides): { cards: Card[]; report: BuildReport } {
  const report: BuildReport = { unknownKeywords: {}, twinless: [] };

  const hobCode = productCodeOf(overrides);
  const folded = foldTwoSided(raw.hob).cards;
  // A twin card whose Hall of Beorn RingsDbCardId is another card's takes the code RingsDB gives it (overrides.hobRingsDbCodes).
  const hobCards = [...folded, ...dragnOnlyCards(raw, folded)].map((card) => {
    const fixed = overrides.hobRingsDbCodes.find((rule) => rule.set === card.CardSet && rule.number === card.Number && (rule.title === undefined || rule.title === card.Title));
    return fixed ? { ...card, RingsDbCardId: fixed.code } : card;
  });
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
    const facts = hob ? hobFacts(hob, dragnRowOf(raw, hob.OctgnGuid ?? "", hob), report) : null;
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

  // Saga box cards (the Fellowship's, the Two Towers'): the reprint's printing wins over the twin it was paired with.
  const claimed = new Set<HobCard>();

  const dragnImageOf = (card: HobCard): string | null => {
    const file = raw.dragn.get(card.OctgnGuid ?? "")?.imageUrl;
    return file ? `${raw.dragnImagePrefix}${file}` : null;
  };

  const merge = (code: string, twin: HobCard | undefined, source: HobCard): Card => {
    const facts = hobFacts(source, dragnRowOf(raw, twin?.OctgnGuid || source.OctgnGuid || "", twin ?? source), report);
    const existing = byCode.get(code);
    const type = TYPE_BY_HOB[source.CardType] ?? (twin ? TYPE_BY_HOB[twin.CardType] : undefined);
    if (!existing && !type) throw new Error(`Card ${code} ${source.Title}: unknown Hall of Beorn type ${source.CardType}`);
    const printings: Printing[] = [];
    if (twin) printings.push(printingOf(TWIN_SETS.get(twin.CardSet) ?? twin.CardSet, twin, dragnImageOf(twin)));
    // A reprint card (source is not its twin) is printed in its box's pack (TFotR, TTwT).
    const reprint = REPRINTS.find((item) => item.set === source.CardSet);
    if (source !== twin && reprint) printings.push(printingOf(reprint.pack, source, null));
    const known = existing?.printings.filter((p) => !printings.some((q) => q.pack === p.pack)) ?? [];
    // A RingsDB player card of a box whose reprint keeps it (ReprintDef.keepsRingsDb) takes only the reprint's printing.
    if (existing?.deckLegal && reprint?.keepsRingsDb && twin) {
      return { ...existing, printings: [...existing.printings, ...printings.filter((p) => !existing.printings.some((q) => q.pack === p.pack))] };
    }
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
          deckLegal: realType(source) ? false : deckLegal(type?.type ?? "", type?.typeName ?? "", facts.campaignKind),
          printings: [...printings, ...known],
        };
    return card;
  };

  for (const reprint of REPRINTS) {
    const sets = twinSetsOf(reprint);
    const mine = hobCards.filter((card) => card.CardSet === reprint.set);
    const twins = hobCards.filter((card) => sets.includes(card.CardSet));
    const pairs = pairTwins(mine, twins, sets);
    for (const source of mine) {
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
  }
  // Twin printings with no reprint card of their own (the later scenarios) come from Hall of Beorn alone.
  for (const twin of hobCards.filter((card) => TWIN_SETS.has(card.CardSet))) {
    const code = twin.RingsDbCardId;
    if (claimed.has(twin) || !code || byCode.has(code)) continue;
    byCode.set(code, merge(code, twin, twin));
  }

  addProductCards(hobCards, byCode, hobCode, merge);
  addNightmareCards(hobCards, byCode, merge);
  fillShipSets(raw, byCode);
  fillSideQuestSets(raw, byCode);
  addDragnBacks(raw, byCode);

  const cards: Card[] = [];
  for (const card of byCode.values()) {
    const set = overrideFor(overrides, { code: card.code, name: card.name });
    const withKeywords = set?.keywords ? { ...card, keywords: { ...(card.keywords ?? {}), ...set.keywords } as PrintedKeywords } : card;
    const withBurden = set?.burdenSet ? { ...withKeywords, burdenSet: set.burdenSet } : withKeywords;
    const inSet = set?.encounterSet ? { ...withBurden, encounterSet: set.encounterSet } : withBurden;
    const named = set?.name ? { ...inSet, name: set.name } : inSet;
    // A trait a source garbles (Hall of Beorn's "Nazg√l"): the printed traits, in print order.
    const traited = set?.traits ? { ...named, traits: set.traits } : named;
    // A printed stat a source leaves out: Threat and engagement cost of a burden enemy (Hall of Beorn files its Threat icon as Willpower), and
    // the stats and Victory of a ship, which Hall of Beorn has no field for.
    const printedStats = { ...traited, ...pickDefined(set, ["threat", "engagementCost", "willpower", "attack", "defense", "health", "victory"]) };
    // A quest stage that prints no quest points, which Hall of Beorn fills with 0 (a stage with 0 would be completed as it is revealed): both sides carry none.
    const stated = set?.questPoints !== undefined ? { ...printedStats, questPoints: set.questPoints, back: printedStats.back ? { ...printedStats.back, questPoints: set.questPoints } : printedStats.back } : printedStats;
    // A card type a source files wrongly: a ship-enemy that Hall of Beorn lists as an enemy (the scan prints SHIP-ENEMY).
    const typed = set?.type === "ship-enemy" ? { ...stated, type: set.type, typeName: "Ship-enemy" } : stated;
    // The stats of the Upgraded side, side B, which Hall of Beorn has no fields for either (dcce.scalable-upgradable).
    const backed = set?.back && typed.back ? { ...typed, back: { ...typed.back, ...set.back } } : typed;
    const next = outOfScope(overrides, backed) ? { ...backed, deckLegal: false } : backed;
    // A card whose printed back is not the one its type implies (the Stormcaller Elite has no encounter back) carries it as an override.
    // A treasure of a campaign (campaignKind) is a player card whatever its type; the treasures RingsDB files under older cycles keep no back.
    const backType = set?.backType !== undefined ? set.backType : next.campaignKind === "treasure" ? "player" : backTypeOf(next.type);
    cards.push(cardSchema.parse({ ...next, backType }));
  }
  cards.sort((left, right) => left.code.localeCompare(right.code));
  return { cards, report };
}
