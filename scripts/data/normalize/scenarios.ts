import { parse as parseJsonc } from "jsonc-parser";

import type { Card } from "../../../src/catalog/card-facts.ts";
import {
  parseScenarioData,
  PILES,
  type CampaignData,
  type Pile,
  type Placement,
  type ScenarioData,
} from "../../../src/catalog/scenario-data.ts";
import { CAMPAIGNS, CAMPAIGN_SUFFIX, PRODUCTS, productOf, scenarioDefs, scenarioSlug, type CampaignDef } from "../campaign-defs.ts";
import type { Overrides } from "./cards.ts";
import { clausesOf, codesOf, nameIndex, parseSetup, type ParsedSetup } from "./setup-text.ts";
import { pileAccepts, questFacts } from "./scenario-piles.ts";
import type { RuleEntry } from "../rules/spans.ts";
import { sameName } from "./names.ts";
import { crossCheckProblems, easyRemovals, easySheetProblem, plain, PLAYER_GROUP, type Deck } from "./scenario-checks.ts";
import { pilesFromSetup, type Loaded } from "./setup-piles.ts";
import { nightmareOf } from "./nightmare.ts";
import { reprintsOf, isReprint } from "./reprints.ts";
import { isNightmareCard } from "../nightmare-defs.ts";
import type { RawData } from "./load-raw.ts";

// Dragncards load groups -> our piles.
const GROUP_PILE: Readonly<Record<string, Pile>> = {
  sharedQuestDeck: "quest",
  sharedEncounterDeck: "encounter",
  sharedStagingArea: "staging",
  sharedActiveLocation: "activeLocation",
  sharedSetAside: "setAside",
  // The second shared deck is the burden deck of Flight to the Ford.
  sharedEncounterDeck2: "burden",
};
// Dream-chaser's decks beside the encounter deck (PILES, src/catalog/scenario-data.ts): their cards are dealt by the scenario's Setup
// ("Prepare the Corsair deck", "Prepare the Uncharted deck"), never by a line naming each card, and they count toward their encounter sets.
const EXTRA_DECKS: ReadonlySet<string> = new Set(["corsairDeck", "encounterDeck2", "unchartedDeck", "islandMap", "grottoDeck", "stormcallerQuests"]);
// The RingsDB twin packs (PRODUCTS): DragnCards names the Fellowship boxes by product, RingsDB by these pack codes.
const TWIN_PACKS: ReadonlySet<string> = new Set(PRODUCTS.flatMap((product) => (product.twinPack ? [product.twinPack] : [])));

// A scenario is written only when every check passes. The rest are listed in problems and stay unbuilt
// until an override or a template resolves them.
export type ScenarioResult = {
  scenarios: ScenarioData[];
  // Every built campaign with its definition, each listing the scenarios of it that were built, in play order.
  campaigns: { data: CampaignData; def: CampaignDef }[];
  problems: string[];
};

function isHero(cards: ReadonlyMap<string, Card>, code: string): boolean {
  return cards.get(code)?.type === "hero";
}


function textLines(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

// A line of a card's text that opens an ability of its own ("Forced:", "Travel Action:", "Resolution:"): it ends a Setup paragraph.
const LABELLED = /^[A-Z][A-Za-z' -]{2,28}:\s/;

// The Setup ability of a quest or campaign card as one string (its "Setup:" line and, when `continued`, the unlabelled lines that continue it,
// as the campaign cards of Dream-chaser print them), and the card's other lines.
function setupOf(text: string | null | undefined, continued: boolean): { setup: string | null; others: string[] } {
  const lines = textLines(text);
  const at = lines.findIndex((line) => /^Setup:/.test(line));
  if (at < 0) return { setup: null, others: lines };
  let end = at + 1;
  // Only a Dream-chaser campaign card continues its Setup on unlabelled lines; elsewhere the line after Setup is another ability.
  while (continued && end < lines.length && !LABELLED.test(lines[end] ?? "")) end += 1;
  return { setup: lines.slice(at, end).join(" "), others: [...lines.slice(0, at), ...lines.slice(end)] };
}

function bookletSetsOf(entry: RuleEntry | undefined): string[] {
  if (!entry) return [];
  const flat = entry.text.replace(/\s+/g, " ");
  const match = /built with all the cards from (?:the following encounter sets: )?(.+?)(?: encounter set)?\.(?: These sets| This set| \s*$|$)/.exec(flat);
  if (!match?.[1]) return [];
  return match[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map((name) => name.trim()).filter((name) => name !== "");
}

export function buildScenarios(raw: RawData, cards: readonly Card[], overrides: Overrides, rules: readonly RuleEntry[], campaignDefs: readonly CampaignDef[] = CAMPAIGNS): ScenarioResult {
  const problems: string[] = [];
  const decks = (parseJsonc(raw.dragnRaw.preBuiltDecks) as { preBuiltDecks: Record<string, Deck> }).preBuiltDecks;
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const byGuid = new Map<string, Card>();
  const byPackNumber = new Map<string, Card>();
  const bySlug = new Map<string, Card>();
  for (const card of cards) {
    for (const printing of card.printings) {
      if (printing.octgnGuid) byGuid.set(printing.octgnGuid, card);
      if (TWIN_PACKS.has(printing.pack)) byPackNumber.set(`${printing.pack}:${printing.number}`, card);
      if (printing.hobSlug) bySlug.set(printing.hobSlug, card);
    }
  }
  const ruleById = new Map(rules.map((entry) => [entry.id, entry]));
  // The booklet's name for a set, as the cards print it (overrides.encounterSetAliases).
  const aliases = new Map(overrides.encounterSetAliases.map((alias) => [plain(alias.booklet), plain(alias.set)]));
  const canon = (name: string): string => aliases.get(plain(name)) ?? plain(name);
  const removals = new Map([...easyRemovals(ruleById.get("easy-mode.core-set")?.text ?? "")].map(([set, list]) => [canon(set), list]));
  // A campaign card is looked up in its own box's printing: two boxes can print a card of the same name.
  const campaignCardsOf = (packs: readonly string[]) => new Map(cards.filter((card) => card.type === "campaign" && card.printings.some((p) => packs.includes(p.pack))).map((card) => [card.name, card.code]));

  // A Dream-chaser card: DragnCards files each side of a double-sided card as a row of its own, named after that side, and Hall of Beorn
  // has no OCTGN guid for many of them. The row's box (packName) and type find the card: by name when the name is one card's in the
  // box (Dark Abyss), else by the collector number (the "Lost Island" side of Lush Jungle is #30). A card is `type` when it matches the row's type bar.
  const typeKey = (value: string): string => value.toLowerCase().replace(/[\s-]/g, "");
  const byProduct = (row: Record<string, string>): Card | null => {
    const product = PRODUCTS.find((item) => item.name === row.packName && item.twinPack === null && item.load === "dragncards");
    const pack = product?.packs[0];
    if (!pack) return null;
    const mine = cards.filter((card) => card.printings.some((printing) => printing.pack === pack) && typeKey(card.typeName) === typeKey(row.type ?? ""));
    const named = mine.filter((card) => sameName(card.name, row.name ?? ""));
    if (named.length === 1) return named[0] ?? null;
    // Two cards of one name and number (the Grotto and Underwater sides of Shrine to Morgoth): the row's traits name the side.
    const traitsOf = (list: readonly string[]) => [...list].sort().join(",");
    const rowTraits = (row.traits ?? "").split(".").map((trait) => trait.trim()).filter((trait) => trait !== "");
    const bySide = named.filter((card) => traitsOf(card.traits) === traitsOf(rowTraits));
    if (named.length > 1 && bySide.length === 1) return bySide[0] ?? null;
    const numbered = (list: readonly Card[]) => list.filter((card) => card.printings.some((printing) => printing.pack === pack && String(printing.number) === row.numberInPack));
    const byNumber = numbered(named.length > 1 ? named : mine);
    return byNumber.length === 1 ? (byNumber[0] ?? null) : null;
  };
  // `sided` (a Dream-chaser deck): the rows of one id are its two sides, and a side resolves to the card of that side's own row. Elsewhere the
  // id's last row is the card, as it always was.
  const sideRow = (databaseId: string, side: "a" | "b") => {
    const sides = raw.dragnSides.get(databaseId);
    return side === "a" ? (sides?.a ?? sides?.b) : sides?.b;
  };
  const resolve = (databaseId: string, side: "a" | "b" = "a", sided = false): Card | null => {
    const direct = side === "a" ? byGuid.get(databaseId) : undefined;
    if (direct) return direct;
    const row = sided ? sideRow(databaseId, side) : raw.dragn.get(databaseId);
    const pack = PRODUCTS.find((product) => product.name === row?.packName)?.twinPack;
    const hit = pack ? byPackNumber.get(`${pack}:${row?.numberInPack ?? ""}`) : undefined;
    if (hit && row && sameName(hit.name, row.name ?? "")) return hit;
    return row ? byProduct(row) : null;
  };
  const reprintOf = reprintsOf(cards);

  const scenarios: ScenarioData[] = [];
  const campaignCards: Record<string, string> = {};
  // The cards a campaign's scenarios start with in player 1's play area (the Fellowship's Ring-bearer attachments), by scenario.
  const preludes = new Map<string, { code: string }[]>();
  const hobById = new Map(raw.scenarios.map((hob) => [scenarioSlug(hob.Title), hob]));

  for (const def of scenarioDefs(campaignDefs)) {
    const hob = hobById.get(def.id);
    const id = def.id;
    if (!hob) {
      problems.push(`${id}: Hall of Beorn has no scenario file for it (data/raw/hallofbeorn/Scenarios)`);
      continue;
    }
    const product = productOf(def.product);
    const fromDragn = product.load === "dragncards";
    const local: string[] = [];
    // A scenario names its decks (`def.deck`, Dream-chaser's Q06/E06); otherwise the numbered Q0C deck labelled with its title.
    const entry: [string, Deck | undefined] | undefined = !fromDragn
      ? undefined
      : def.deck
        ? [def.deck.normal, decks[def.deck.normal]]
        : Object.entries(decks).find(([key, deck]) => /^Q0C\.\d+$/.test(key) && deck.label === hob.Title);
    if (fromDragn && !entry?.[1]) {
      problems.push(`${id}: DragnCards has no ${def.deck?.normal ?? "Q0C"} deck labelled "${hob.Title}"`);
      continue;
    }
    if (def.deck && entry?.[1]?.label !== hob.Title) {
      problems.push(`${id}: DragnCards ${def.deck.normal} is labelled "${entry?.[1]?.label ?? ""}", not "${hob.Title}"`);
      continue;
    }
    const [normalKey, normalDeck] = entry ?? [null, null];
    const easyKey = def.deck?.easy ?? normalKey?.replace("Q0C", "E0C") ?? null;
    const easyDeck = easyKey ? decks[easyKey] : undefined;
    // The campaign card, boons and burdens are the box's (a Dream-chaser scenario's are the Campaign Expansion's).
    const cardPacks = productOf(def.campaignProduct ?? def.product).packs;
    const campaignCard = campaignCardsOf(cardPacks).get(hob.Title.replace(CAMPAIGN_SUFFIX, ""));
    if (!campaignCard) {
      problems.push(`${id}: no campaign card named "${hob.Title.replace(CAMPAIGN_SUFFIX, "")}"`);
      continue;
    }

    // Everything the scenario's own cards can name: Hall of Beorn's list, the quest cards, and the box's boons and burdens.
    const listed = new Set<string>();
    // The scenario file also lists the quest cards of its Nightmare deck (Dream-chaser's); those are not this scenario's.
    for (const item of [...hob.QuestCards, ...hob.ScenarioCards]) {
      const card = bySlug.get(item.Slug);
      if (card && !isNightmareCard(card)) listed.add(card.code);
    }
    const scope = cards.filter((card) => listed.has(card.code) || (card.campaignKind != null && card.printings.some((p) => cardPacks.includes(p.pack))));
    // The campaign card names more than the scenario lists: the Campaign Expansion's own cards (Sea Serpent) and the originals of its reprints
    // (Calphon is in no list of Raid on the Grey Havens). They match a name only where no card of the scenario's own list bears it.
    const extras = def.deck === undefined ? [] : cards.filter((card) => !scope.includes(card) && !isReprint(card) && (card.printings.some((p) => cardPacks.includes(p.pack)) || reprintOf.has(card.code)));
    const names = nameIndex([...scope, ...extras], new Set(scope.filter((card) => card.type !== "quest").map((card) => card.code)));

    // Stages in printed order: the Hall of Beorn quest cards give it, the Dragncards deck must agree.
    // The Stormcaller's own stages (2C to 4C, `stormcallerQuests`) are listed with the others and leave `stages` once the load list is read.
    const questCodes = hob.QuestCards.flatMap((quest) => {
      const card = bySlug.get(quest.Slug);
      return card && !isNightmareCard(card) ? [card.code] : [];
    });
    let stages = questCodes;

    // The printed Setup of the first quest stage and of the campaign card.
    const questSetup = setupOf(byCode.get(stages[0] ?? "")?.text, false).setup;
    const campaignLines = setupOf(byCode.get(campaignCard)?.text, def.deck !== undefined);
    const campaignSetup = campaignLines.setup;
    const quest: ParsedSetup = questSetup ? parseSetup(questSetup, names) : { clauses: [], unread: [] };
    const camp: ParsedSetup = campaignSetup ? parseSetup(campaignSetup, names) : { clauses: [], unread: [] };
    for (const sentence of [...quest.unread, ...camp.unread]) local.push(`${id}: a Setup sentence no pattern reads: ${sentence}`);
    const nameOf = (code: string) => byCode.get(code)?.name ?? code;

    // The side a Stormcaller Elite card is dealt faceup (dcce.stormcaller-elite): the quest card's Setup names it ("enemy side faceup",
    // "objective-ally sides faceup"); a Setup that names none deals the DragnCards front, the enemy side (Raid on the Grey Havens).
    const eliteFaceup = /objective[- ]ally sides? faceup/i.test(questSetup ?? "") ? "objective" : /enemy side faceup/i.test(questSetup ?? "") ? "enemy" : null;
    // A key of `Loaded.placements`: code, pile and, for a two-sided card whose sides are two catalog cards, the code of its other side.
    const keyOf = (code: string, pile: string, back?: string) => `${code}\u0000${pile}${back ? `\u0000${back}` : ""}`;
    const load = (deck: Deck): { placements: Map<string, number>; player: string[]; campaign: Set<string> } => {
      const placements = new Map<string, number>();
      const player: string[] = [];
      const campaign = new Set<string>();
      const sided = def.deck !== undefined;
      for (const line of deck.cards) {
        let card = resolve(line.databaseId, "a", sided);
        let other = sided ? resolve(line.databaseId, "b", sided) : null;
        const name = (sided ? sideRow(line.databaseId, "a") : raw.dragn.get(line.databaseId))?.name ?? line.databaseId;
        if (!card) {
          // The scenario overview card has no game text and no catalog row.
          if (name !== hob.Title) local.push(`${deck.label}: no card for "${name}" (${line.databaseId})`);
          continue;
        }
        if (card.type === "campaign") continue;
        if (line.loadGroupId === PLAYER_GROUP && def.groups?.[line.loadGroupId] === undefined) {
          if (!isHero(byCode, card.code)) player.push(card.code);
          continue;
        }
        let pile: Pile | "campaign" | undefined = def.groups?.[line.loadGroupId] ?? GROUP_PILE[line.loadGroupId];
        if (!pile) {
          local.push(`${deck.label}: group ${line.loadGroupId} is not supported (${name})`);
          continue;
        }
        // One physical card with two catalog cards for its sides: `card` is the side faceup, `other` its back. A folded card (Card.back) has none.
        if (other && other.code === card.code) other = null;
        if (other && eliteFaceup && card.type !== eliteFaceup && other.type === eliteFaceup) [card, other] = [other, card];
        const was = pile;
        const moved = overrides.scenarioPiles.find((rule) => rule.scenario === id && rule.code === card?.code && (rule.from === undefined || rule.from === was));
        if (moved) pile = moved.pile;
        if (pile === "campaign") {
          campaign.add(card.code);
          continue;
        }
        const key = keyOf(card.code, pile, other?.code);
        placements.set(key, (placements.get(key) ?? 0) + line.quantity);
      }
      return { placements, player, campaign };
    };

    // A box with no DragnCards load list: Hall of Beorn's counts are the pile, and the quest card's printed Setup moves cards out of it.
    const fromSetup = (difficulty: "Normal" | "Easy"): Loaded => pilesFromSetup({ id, difficulty, hob, stages, bySlug, byCode, clauses: quest.clauses, nameOf, problems: local });
    const empty: Loaded = { placements: new Map<string, number>(), player: [], campaign: new Set<string>() };
    let normal: Loaded;
    let easy: Loaded;
    if (normalDeck) {
      normal = load(normalDeck);
      easy = easyDeck ? load(easyDeck) : empty;
      if (!easyDeck) local.push(`${id}: no ${easyKey} Easy deck`);
      for (const key of easy.placements.keys()) {
        if (!normal.placements.has(key)) local.push(`${id}: Easy deck has ${key.replace("\u0000", " in ")} that Normal does not`);
      }
      // "Players prepare their fleet" deals all six ship-objectives of The Dream-chaser's Fleet (dcce.prepare-your-fleet), set aside until
      // the players choose; the load list holds the four of the original box, so each ship it lacks (by name) is added, in both decks.
      if (clausesOf(quest, "step").some((clause) => clause.step === "prepareFleet")) {
        const dealt = new Set([...normal.placements.keys()].map((key) => byCode.get(key.split("\u0000")[0] ?? "")?.name));
        for (const ship of cards.filter((card) => card.type === "ship-objective" && canon(card.encounterSet ?? "") === canon("The Dream-chaser's Fleet") && !dealt.has(card.name))) {
          normal.placements.set(keyOf(ship.code, "setAside"), 1);
          easy.placements.set(keyOf(ship.code, "setAside"), 1);
        }
      }
      const stormcallerStages = new Set([...normal.placements.keys()].filter((key) => key.endsWith("\u0000stormcallerQuests")).map((key) => key.split("\u0000")[0] ?? ""));
      stages = questCodes.filter((code) => !stormcallerStages.has(code));
      const deckStages = [...normal.placements.keys()].filter((key) => key.endsWith("\u0000quest")).map((key) => key.split("\u0000")[0] ?? "");
      if (JSON.stringify(stages) !== JSON.stringify(deckStages)) local.push(`${id}: quest stages disagree: Hall of Beorn ${stages.join(",")} / DragnCards ${deckStages.join(",")}`);
    } else {
      // No load list: Hall of Beorn's counts are the pile, and the quest card's printed Setup moves cards out of the deck.
      normal = fromSetup("Normal");
      easy = fromSetup("Easy");
    }

    // Placement: a pile card must be said by a Setup line (the quest's, the campaign card's, or its own).
    const placed: Placement[] = [];
    const campaignPlaced = new Set<string>();
    const campaignNamed = codesOf(camp, ["aside", "stage", "active", "attachRingBearer", "shuffleInto", "earned", "choose", "putIntoPlay", "attachChosen", "addToHandAfterMulligan", "addToCampaignPool", "step"]);
    // "Each player chooses 1 Adaptation boon": every boon of that trait in the box is a choice, dealt by the campaign card.
    for (const clause of clausesOf(camp, "eachPlayerChoosesBoon")) {
      for (const card of scope) if (card.campaignKind === "boon" && card.traits.includes(clause.trait)) campaignNamed.add(card.code);
    }
    // The two sides of one physical card, by code: a Setup that names a card by title is satisfied by that card and its other side only.
    const pairs = new Map<string, string>();
    for (const key of normal.placements.keys()) {
      const [code, , back] = key.split("\u0000");
      if (code && back) {
        pairs.set(code, back);
        pairs.set(back, code);
      }
    }
    const same = (left: string, right: string) => left === right || pairs.get(left) === right;
    for (const [key, count] of normal.placements) {
      const [code = "", pile = "", back] = key.split("\u0000");
      const printed = byCode.get(code);
      const facts = questFacts({ quest, code, printed, same, canon });
      const namedByCampaign = [...campaignNamed].some((named) => same(named, code));
      // A card the campaign card's Setup places is dealt by that record, not by the load list.
      if (namedByCampaign && !facts.said(["aside", "stage", "active", "attachRingBearer", "attachChosen"]) && !facts.steps("takeControl", "attach", "prepareStormcallerArea", "flipToCampaignSide")) {
        campaignPlaced.add(code);
        continue;
      }
      if (!pileAccepts({ code, pile, printed, quest, facts })) {
        if (namedByCampaign) campaignPlaced.add(code);
        else local.push(`${id}: ${nameOf(code)} is in the ${pile} pile and no Setup line puts it there`);
        continue;
      }
      const perPlayer = clausesOf(quest, "stage").find((clause) => clause.perPlayer != null && clause.codes.includes(code))?.perPlayer;
      // A location the quest's Setup has each player add (found in the encounter deck): dealt with the deck, found by the Setup record.
      const searched = pile === "staging" && printed?.type === "location" && clausesOf(quest, "eachPlayerAddsLocation").length > 0;
      // "(2 copies instead if there are 3 or more players in the game)": the copies of this card the Setup stages.
      const staged = pile === "staging" ? clausesOf(quest, "stage").find((clause) => clause.many != null && clause.codes.includes(code)) : undefined;
      const byPlayers = staged?.many ? { few: staged.count, many: staged.many.count, from: staged.many.from } : undefined;
      placed.push({ code, pile: pile as Pile, normal: count, easy: Math.min(easy.placements.get(key) ?? 0, count), ...(back ? { back } : {}), ...(perPlayer != null ? { perPlayer } : {}), ...(byPlayers ? { byPlayers } : {}), ...(searched ? { searched: true as const } : {}) });
    }
    // A printed count the sources disagree on: the card's own set size or Setup text settles it (overrides.scenarioCounts).
    for (const rule of overrides.scenarioCounts.filter((item) => item.scenario === id)) {
      const item = placed.find((candidate) => candidate.code === rule.code && candidate.pile === (rule.pile ?? "encounter"));
      if (!item) local.push(`${id}: scenarioCounts names ${nameOf(rule.code)}, which the ${rule.pile ?? "encounter"} pile does not hold`);
      else if (rule.normal != null) item.normal = rule.normal;
      if (item && rule.easy != null) item.easy = rule.easy;
      if (item) item.easy = Math.min(item.easy, item.normal);
    }
    // The campaign card's Setup also deals cards the load list put in an encounter deck or a hand.
    for (const code of codesOf(camp, ["stage", "attachRingBearer", "shuffleInto"])) {
      if (normal.placements.has(`${code}\u0000encounter`)) {
        campaignPlaced.add(code);
        normal.placements.delete(`${code}\u0000encounter`);
        const index = placed.findIndex((item) => item.code === code && item.pile === "encounter");
        if (index >= 0) placed.splice(index, 1);
      }
    }
    for (const code of normal.campaign) campaignPlaced.add(code);
    for (const code of codesOf(camp, ["earned", "choose"])) campaignPlaced.add(code);
    for (const code of campaignNamed) campaignPlaced.add(code);
    // The Resolution on the back names its rewards: they are dealt by the campaign, never by the load list.
    // Dream-chaser's XP list ("Gain the following: 1 XP for each Corsair Warship in the victory display") names cards it only counts.
    for (const code of names.codesOf((byCode.get(campaignCard)?.back?.text ?? "").split("Gain the following")[0] ?? "")) campaignPlaced.add(code);
    // The booklet's campaign paragraph (dcce.campaign-setup-<id>) lists the cards a campaign game needs ("all copies of Send for Help ... Set aside each Send for Help facedown"). The campaign
    // card names most of them in its Setup; a card only the paragraph names (the Send for Help cards, which Gavin's Planning Action shuffles in) is dealt by the campaign too.
    if (def.deck !== undefined) {
      const paragraph = (ruleById.get(def.setupSpan.replace(".setup-", ".campaign-setup-"))?.text ?? "").replace(/\s+/g, " ");
      for (const code of names.allCodesOf(paragraph)) if (byCode.get(code)?.campaignKind != null && byCode.get(code)?.printings.some((p) => cardPacks.includes(p.pack))) campaignPlaced.add(code);
    }
    // The campaign card's other lines (The Thing in the Depths' Forced lines) name the Campaign Expansion's cards they deal.
    if (def.deck !== undefined) for (const code of names.codesOf(campaignLines.others.join(" "))) if (byCode.get(code)?.printings.some((p) => cardPacks.includes(p.pack))) campaignPlaced.add(code);
    // Everything the quest Setup names must be in a pile.
    const inPile = (code: string, piles: readonly string[]) => placed.some((item) => same(item.code, code) && piles.includes(item.pile));
    for (const clause of quest.clauses) {
      if (clause.kind === "aside") for (const code of clause.codes) if (!inPile(code, ["setAside"])) local.push(`${id}: Setup sets ${nameOf(code)} aside, which the load list does not`);
      if (clause.kind === "stage") for (const code of clause.codes) if (!inPile(code, ["staging"])) local.push(`${id}: Setup adds ${nameOf(code)} to staging, which the load list does not`);
      if (clause.kind === "active") for (const code of clause.codes) if (!inPile(code, ["activeLocation"])) local.push(`${id}: Setup makes ${nameOf(code)} the active location, which the load list does not`);
      if (clause.kind === "attachChosen") for (const code of clause.codes) if (!inPile(code, ["attachedChosen"])) local.push(`${id}: Setup attaches ${nameOf(code)} to a hero, which the load list does not`);
      if (clause.kind === "attachRingBearer") for (const code of clause.codes) if (!inPile(code, ["attached"])) local.push(`${id}: Setup attaches ${nameOf(code)} to the Ring-bearer, which the load list does not`);
    }
    // "Set all copies of X aside": every copy the box holds, Hall of Beorn's Normal count.
    for (const clause of quest.clauses) {
      if (clause.kind !== "aside" || !clause.allCopies) continue;
      for (const code of clause.codes) {
        const copies = hob.ScenarioCards.find((item) => bySlug.get(item.Slug)?.code === code)?.NormalQuantity ?? 1;
        const have = placed.filter((item) => item.code === code && item.pile === "setAside").reduce((sum, item) => sum + item.normal, 0);
        if (have !== copies) local.push(`${id}: Setup sets all copies of ${nameOf(code)} aside (${copies}), the load list sets ${have}`);
      }
    }
    // The burden deck: every burden card of the named burden set, and no other.
    const burdenSet = clausesOf(quest, "shuffleInto").find((clause) => clause.into === "burden deck")?.set ?? null;
    if (burdenSet) {
      const expected = cards.filter((card) => card.campaignKind === "burden" && card.burdenSet === burdenSet).map((card) => card.code).sort();
      const got = placed.filter((item) => item.pile === "burden").map((item) => item.code).sort();
      if (JSON.stringify(expected) !== JSON.stringify(got)) local.push(`${id}: the burden deck is ${got.join(",")}, the ${burdenSet} burden set is ${expected.join(",")}`);
    } else if (placed.some((item) => item.pile === "burden")) local.push(`${id}: a burden deck is loaded and no Setup line makes one`);
    const life = clausesOf(quest, "lifeSet")[0]?.amount;

    // Encounter sets: the booklet's Setup paragraph names them, in its order; Hall of Beorn's list must agree.
    const rule = ruleById.get(def.setupSpan);
    const booklet = bookletSetsOf(rule);
    const first = hob.QuestCards[0];
    const isCampaign = (code: string) => byCode.get(code)?.typeName === "Campaign" || byCode.get(code)?.campaignKind != null;
    let hobSets = [first?.EncounterInfo?.EncounterSet, ...(first?.EncounterInfo?.IncludedEncounterSets ?? [])].filter((name): name is string => !!name).map((name) => name.replace(CAMPAIGN_SUFFIX, ""));
    if (booklet.length === 0) local.push(`${id}: the booklet's Setup paragraph ${def.setupSpan} lists no encounter sets`);
    else if (def.deck) {
      // A Dream-chaser scenario: Hall of Beorn lists the sets of its first quest card only (no second deck), so the booklet's paragraph is the
      // list. Every set it names has a card in the load list, and every encounter card the load list deals is in one of them.
      const printedSets = new Map<string, string>();
      for (const item of placed) {
        const card = byCode.get(item.code);
        if (card && item.pile !== "quest" && !isCampaign(item.code) && card.encounterSet) printedSets.set(canon(card.encounterSet), card.encounterSet);
      }
      hobSets = booklet.map((name) => printedSets.get(canon(name)) ?? "");
      booklet.forEach((name, at) => {
        if (hobSets[at] === "") local.push(`${id}: the booklet names the encounter set ${name}, and no card of the load list belongs to it`);
      });
      const listedSets = new Set(booklet.map(canon));
      for (const [key, name] of printedSets) if (!listedSets.has(key)) local.push(`${id}: the load list deals ${name} cards, which the booklet's encounter sets do not name`);
    } else if (JSON.stringify(booklet.map(canon).sort()) !== JSON.stringify(hobSets.map(canon).sort())) local.push(`${id}: encounter sets: booklet ${booklet.join(", ")} / Hall of Beorn ${hobSets.join(", ")}`);
    const setNames = hobSets;
    const encounterSets = setNames.map((name) => ({
      name,
      count: placed
        .filter((card) => (card.pile === "encounter" || (card.pile !== "stormcallerQuests" && EXTRA_DECKS.has(card.pile))) && !isCampaign(card.code) && byCode.get(card.code)?.encounterSet === name)
        .reduce((sum, card) => sum + card.normal, 0),
    }));
    // A fixed order, so the same data always shuffles the same way: pile, then booklet set, then code.
    const setRank = (code: string) => {
      const index = setNames.indexOf(byCode.get(code)?.encounterSet ?? "");
      return index < 0 ? setNames.length : index;
    };
    placed.sort(
      (a, b) =>
        PILES.indexOf(a.pile) - PILES.indexOf(b.pile) ||
        (a.pile === "quest" ? stages.indexOf(a.code) - stages.indexOf(b.code) : setRank(a.code) - setRank(b.code) || a.code.localeCompare(b.code)),
    );

    // Hall of Beorn's Normal and Easy counts for each card the scenario lists. A printed Easy count that the sources
    // disagree on is settled by an override that names the printed card.
    const easyFix = (code: string) => overrides.scenarioEasy.find((rule) => rule.scenario === id && rule.code === code)?.easy;
    for (const item of hob.ScenarioCards) {
      const card = bySlug.get(item.Slug);
      if (!card || /\(Campaign\)$/.test(item.Title) || /Nightmare$/.test(item.EncounterSet ?? "")) continue;
      // Boons and burdens are dealt by the campaign (the pool, a campaign card, or the burden deck), not by the load list.
      if (campaignPlaced.has(card.code) || card.campaignKind != null) continue;
      const mine = placed.filter((p) => (p.code === card.code || p.back === card.code) && p.pile !== "quest");
      const normalCount = mine.reduce((sum, p) => sum + p.normal, 0);
      const fixed = easyFix(card.code);
      const easyCount = fixed ?? mine.reduce((sum, p) => sum + p.easy, 0);
      const sheetProblem = easySheetProblem(id, product, item, card, removals, canon);
      if (sheetProblem) local.push(sheetProblem);
      // Hall of Beorn's count against the load list's: a difference is a problem; an override settles it (overrides.scenarioCounts, scenarioEasy).
      if (normalCount !== item.NormalQuantity) local.push(`${id}: ${item.Title} Normal ${normalCount}, Hall of Beorn ${item.NormalQuantity}`);
      if (easyCount !== item.EasyQuantity) local.push(`${id}: ${item.Title} Easy ${easyCount}, Hall of Beorn ${item.EasyQuantity}`);
      if (fixed != null) for (const p of mine) p.easy = Math.min(fixed, p.normal);
    }

    const textOf = (code: string) => `${byCode.get(code)?.text ?? ""}\n${byCode.get(code)?.back?.text ?? ""}`;
    const everything = placed.map((item) => textOf(item.code)).join("\n");
    const widgets = {
      hide: /\bHide (?:test|\d)/.test(everything) || placed.some((item) => byCode.get(item.code)?.keywords?.hide != null),
      secondActiveLocation: stages.some((code) => /There can be 2 active locations/.test(textOf(code))),
      perSeatStaging: stages.some((code) => /creates? (?:his|their) own staging area/.test(textOf(code))),
    };

    // DragnCards' decks, where a deck of the same cards exists (copy counts only, not piles).
    if (!normalDeck) local.push(...crossCheckProblems(def, decks, raw.dragn, placed, nameOf));

    const nightmare = nightmareOf(id, placed, cards);
    local.push(...nightmare.problems);

    if (local.length > 0) {
      problems.push(...local);
      continue;
    }
    // A campaign game deals the Campaign Expansion's reprint of each card that has one (ScenarioData.reprints).
    const dealt = [...new Set([...placed.flatMap((item) => (item.back ? [item.code, item.back] : [item.code])), ...campaignPlaced])].sort();
    const reprints = Object.fromEntries(dealt.flatMap((code) => (reprintOf.has(code) ? [[code, reprintOf.get(code) as string] as const] : [])));
    preludes.set(id, normal.player.map((code) => ({ code })));
    campaignCards[id] = campaignCard;
    scenarios.push(
      parseScenarioData({
        id,
        name: hob.Title,
        number: hob.Number,
        stages,
        encounterSets,
        cards: placed,
        campaignCard,
        campaignPlaced: [...campaignPlaced].sort(),
        ...(Object.keys(reprints).length > 0 ? { reprints } : {}),
        ...(life != null ? { life } : {}),
        widgets,
        source: { dragnNormal: normalKey, dragnEasy: easyDeck ? easyKey : null, hobSlug: hob.Slug },
        ...(nightmare.data ? { nightmare: nightmare.data } : {}),
      }),
    );
  }

  // Each campaign lists the scenarios of it that were built, in its own order. A campaign whose first scenario is a saga's
  // takes that scenario's player-1 play area as its prelude (the Fellowship's Ring-bearer attachments).
  const campaigns = campaignDefs.map((def) => {
    const built = def.scenarios.filter((scenario) => scenarios.some((item) => item.id === scenario.id));
    const data: CampaignData = {
      id: def.id,
      name: def.name,
      scenarios: built.map((scenario) => scenario.id),
      campaignCards: Object.fromEntries(built.map((scenario) => [scenario.id, campaignCards[scenario.id] ?? ""])),
      bookletId: def.bookletId,
      saga: def.saga,
      prelude: preludes.get(built[0]?.id ?? "") ?? [],
      starterDecks: [],
    };
    return { data, def };
  });
  return { scenarios, campaigns, problems };
}
