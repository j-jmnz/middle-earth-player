import { parse as parseJsonc } from "jsonc-parser";

import type { Card } from "../../../src/catalog/card-facts.ts";
import {
  parseAnyScenarioData,
  PILES,
  type CampaignData,
  type Pile,
  type Placement,
  type AnyScenarioData,
} from "../../../src/catalog/scenario-data.ts";
import { CAMPAIGNS, CAMPAIGN_SUFFIX, productOf, scenarioDefs, scenarioSlug, type CampaignDef } from "../campaign-defs.ts";
import { PLAYER_TYPES, type Overrides } from "./cards.ts";
import { clausesOf, codesOf, nameIndex, parseSetup, type ParsedSetup } from "./setup-text.ts";
import { loggedHarad, pileAccepts, questFacts } from "./scenario-piles.ts";
import { bookletSetsOf, setupOf } from "./scenario-text.ts";
import { burdenSetProblems, crossCheckProblems, easyRemovals, easySheetProblem, plain, PLAYER_GROUP, type Deck } from "./scenario-checks.ts";
import { pilesFromSetup, type Loaded } from "./setup-piles.ts";
import type { RuleEntry } from "../rules/spans.ts";
import { campaignTextCodes } from "./campaign-text.ts";
import { nightmareOf } from "./nightmare.ts";
import { sagaStartOf } from "./saga-start.ts";
import { reprintsOf, isReprint } from "./reprints.ts";
import { dragnResolver } from "./dragn-resolve.ts";
import { campaignsOf, indexCards, mentions } from "./scenario-indexes.ts";
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
// Ered Mithrin's decks (evilCreaturesDeck, cavesDeck, sideQuestDeck, spidersDeck, orcsDeck) are built by the Setup's deck steps the same way, and
// The Two Towers' second encounter decks (haradDeck, greatSpiderDeck) by the Setup's encounter set that is shuffled under a card or set aside.
const EXTRA_DECKS: ReadonlySet<string> = new Set(["corsairDeck", "encounterDeck2", "unchartedDeck", "islandMap", "grottoDeck", "stormcallerQuests", "evilCreaturesDeck", "cavesDeck", "sideQuestDeck", "spidersDeck", "orcsDeck", "haradDeck", "greatSpiderDeck", "angmarOrcDeck", "smaugDeck"]);

// A scenario is written only when every check passes. The rest are listed in problems and stay unbuilt
// until an override or a template resolves them.
export type ScenarioResult = {
  scenarios: AnyScenarioData[];
  // Every built campaign with its definition, each listing the scenarios of it that were built, in play order.
  campaigns: { data: CampaignData; def: CampaignDef }[];
  problems: string[];
};

function isHero(cards: ReadonlyMap<string, Card>, code: string): boolean {
  return cards.get(code)?.type === "hero";
}


export function buildScenarios(raw: RawData, cards: readonly Card[], overrides: Overrides, rules: readonly RuleEntry[], campaignDefs: readonly CampaignDef[] = CAMPAIGNS): ScenarioResult {
  const problems: string[] = [];
  const decks = (parseJsonc(raw.dragnRaw.preBuiltDecks) as { preBuiltDecks: Record<string, Deck> }).preBuiltDecks;
  const { byCode, byGuid, byPackNumber, bySlug } = indexCards(cards);
  const ruleById = new Map(rules.map((entry) => [entry.id, entry]));
  // The booklet's name for a set, as the cards print it (overrides.encounterSetAliases).
  const aliases = new Map(overrides.encounterSetAliases.map((alias) => [plain(alias.booklet), plain(alias.set)]));
  const canon = (name: string): string => aliases.get(plain(name)) ?? plain(name);
  const removals = new Map([...easyRemovals(ruleById.get("easy-mode.core-set")?.text ?? "")].map(([set, list]) => [canon(set), list]));
  // A campaign card is looked up in its own box's printing: two boxes can print a card of the same name.
  const campaignCardsOf = (packs: readonly string[]) => new Map(cards.filter((card) => card.type === "campaign" && card.printings.some((p) => packs.includes(p.pack))).map((card) => [card.name, card.code]));

  const { resolve, sideRow } = dragnResolver(raw, cards, overrides, { byCode, byGuid, byPackNumber });
  const reprintOf = reprintsOf(cards);

  // The name of a card as a word of a text, either apostrophe: built once per name.
  const mentioned = new Map<string, RegExp>();
  const scenarios: AnyScenarioData[] = [];
  const campaignCards: Record<string, string> = {};
  // The cards a campaign's scenarios start with in player 1's play area (the Fellowship's Ring-bearer attachments), by scenario.
  const preludes = new Map<string, { code: string }[]>();
  const hobById = new Map(raw.scenarios.map((hob) => [scenarioSlug(hob.Title), hob]));

  // A scenario of a cycle (Shadows of Mirkwood) has no campaign card: its piles are checked against the quest card's printed Setup (and the Adventure Pack's rules insert where one is pinned).
  const cycleIds = new Set(campaignDefs.flatMap((campaign) => (campaign.kind === "cycle" ? campaign.scenarios.map((scenario) => scenario.id) : [])));
  for (const def of scenarioDefs(campaignDefs)) {
    const cycle = cycleIds.has(def.id);
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
    const deckLabel = def.deck?.label ?? hob.Title;
    if (def.deck && entry?.[1]?.label !== deckLabel) {
      problems.push(`${id}: DragnCards ${def.deck.normal} is labelled "${entry?.[1]?.label ?? ""}", not "${deckLabel}"`);
      continue;
    }
    const [normalKey, normalDeck] = entry ?? [null, null];
    const easyKey = def.deck?.easy ?? normalKey?.replace("Q0C", "E0C") ?? null;
    const easyDeck = easyKey ? decks[easyKey] : undefined;
    // The campaign card, boons and burdens are the box's (a Dream-chaser scenario's are the Campaign Expansion's).
    const cardPacks = productOf(def.campaignProduct ?? def.product).packs;
    const campaignCard = cycle ? undefined : campaignCardsOf(cardPacks).get(hob.Title.replace(CAMPAIGN_SUFFIX, ""));
    if (!cycle && !campaignCard) {
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
    // A card of the scenario's own box that its campaign card names without its scenario listing it (Ered Mithrin's The King's Quest: "Haldan may be included").
    const campaignText = `${byCode.get(campaignCard ?? "")?.text ?? ""}\n${bySlug.get(hob.QuestCards[0]?.Slug ?? "")?.text ?? ""}`;
    const ownBox = productOf(def.product).packs;
    const inCampaignText = (card: Card) => {
      if (card.campaignKind != null || PLAYER_TYPES.has(card.type) || !card.printings.some((p) => ownBox.includes(p.pack))) return false;
      return mentions(mentioned, card.name, campaignText);
    };
    // A saga campaign card names cards it does not deal: the earlier box's boons ("Remove Gildor Inglorion and Mr. Underhill from the Campaign Pool") and the box's Fellowship cards ("attaches Andúril and Banner of Elendil to Aragorn").
    const poolCards = product.sagaStart ? cards.filter((card) => (card.campaignKind != null && !card.printings.some((p) => cardPacks.includes(p.pack))) || (card.sphere === "fellowship" && card.printings.some((p) => cardPacks.includes(p.pack)))) : [];
    const sagaNamed = product.sagaStart ? cards.filter((card) => !scope.includes(card) && !isReprint(card) && inCampaignText(card)) : [];
    // A hero of the scenario's own box that its campaign card names (The Battle of Carn Dûm: "Amarthiúl may be included among a player's heroes").
    const heroNamed = (card: Card) => card.type === "hero" && card.printings.some((p) => ownBox.includes(p.pack)) && mentions(mentioned, card.name, campaignText);
    const extras = def.deck === undefined ? [...poolCards, ...sagaNamed] : cards.filter((card) => !scope.includes(card) && !isReprint(card) && (card.printings.some((p) => cardPacks.includes(p.pack)) || reprintOf.has(card.code) || inCampaignText(card) || heroNamed(card)));
    const names = nameIndex([...scope, ...extras], new Set(scope.filter((card) => card.type !== "quest").map((card) => card.code)));

    // Stages in printed order: the Hall of Beorn quest cards give it, the Dragncards deck must agree.
    // The Stormcaller's own stages (2C to 4C, `stormcallerQuests`) are listed with the others and leave `stages` once the load list is read.
    const questCodes = hob.QuestCards.flatMap((quest) => {
      const card = bySlug.get(quest.Slug);
      // A mode card (The Siege of Annúminas' Standard Game Mode) is listed with the quest cards but is no stage; a quest card the scenario never plays is excluded by an override (the Siege's Epic Multiplayer stages).
      return card && card.type === "quest" && !isNightmareCard(card) && !overrides.scenarioExcluded.some((rule) => rule.scenario === id && rule.code === card.code) ? [card.code] : [];
    });
    for (const rule of overrides.scenarioStages) if (rule.scenario === id && !questCodes.includes(rule.code)) questCodes.push(rule.code);
    let stages = questCodes;

    // The printed Setup of the first quest stage and of the campaign card.
    const questSetup = setupOf(byCode.get(stages[0] ?? "")?.text, false).setup;
    const campaignLines = setupOf(byCode.get(campaignCard ?? "")?.text, def.deck !== undefined || product.sagaStart === true);
    const campaignSetup = campaignLines.setup;
    // A mode card's Setup (the Siege's Standard Game Mode: Annúminas to the staging area) runs before the quest card's: its sentences are read with the quest card's.
    const modeCard = def.modeCard === undefined ? undefined : cards.find((card) => card.type === "campaign" && card.name === def.modeCard && card.printings.some((p) => cardPacks.includes(p.pack)));
    const modeSetup = setupOf(modeCard?.text, false).setup;
    const modeParsed: ParsedSetup = modeSetup ? parseSetup(modeSetup, names) : { clauses: [], unread: [] };
    const questParsed: ParsedSetup = questSetup ? parseSetup(questSetup, names) : { clauses: [], unread: [] };
    const quest: ParsedSetup = { clauses: [...modeParsed.clauses, ...questParsed.clauses], unread: [...modeParsed.unread, ...questParsed.unread] };
    const camp: ParsedSetup = campaignSetup ? parseSetup(campaignSetup, names) : { clauses: [], unread: [] };
    for (const sentence of [...quest.unread, ...camp.unread]) local.push(`${id}: a Setup sentence no pattern reads: ${sentence}`);
    local.push(...burdenSetProblems(id, camp, cards, plain));
    const nameOf = (code: string) => byCode.get(code)?.name ?? code;

    // The side a Stormcaller Elite card is dealt faceup (dcce.stormcaller-elite): the quest card's Setup names it ("enemy side faceup",
    // "objective-ally sides faceup"); a Setup that names none deals the DragnCards front, the enemy side (Raid on the Grey Havens).
    const eliteFaceup = /objective[- ]ally sides? faceup/i.test(questSetup ?? "") ? "objective" : /enemy side faceup/i.test(questSetup ?? "") ? "enemy" : null;
    // A key of `Loaded.placements`: code, pile and, for a two-sided card whose sides are two catalog cards, the code of its other side.
    const keyOf = (code: string, pile: string, back?: string) => `${code}\u0000${pile}${back ? `\u0000${back}` : ""}`;
    // The heroes the Normal load list puts in player 1's play area (the saga hero of a Two Towers scenario).
    const heroes: string[] = [];
    const load = (deck: Deck): { placements: Map<string, number>; player: string[]; campaign: Set<string> } => {
      const placements = new Map<string, number>();
      const player: string[] = [];
      const campaign = new Set<string>();
      const sided = def.deck !== undefined || def.sidedLoad === true;
      for (const line of deck.cards) {
        let card = resolve(line.databaseId, "a", sided);
        let other = sided ? resolve(line.databaseId, "b", sided) : null;
        const name = (sided ? sideRow(line.databaseId, "a") : raw.dragn.get(line.databaseId))?.name ?? line.databaseId;
        if (!card) {
          // The scenario overview card has no game text and no catalog row; a Rules card (The Ruins of Belegost's Discover and Loot keyword card) is a reminder, not a card the scenario deals.
          if (name !== hob.Title && raw.dragn.get(line.databaseId)?.type !== "Rules") local.push(`${deck.label}: no card for "${name}" (${line.databaseId})`);
          continue;
        }
        if (card.type === "campaign" || raw.dragn.get(line.databaseId)?.type === "Campaign") continue;
        // The saga start the load list sets aside (Mount Doom's Ring-bearer and The One Ring): the scenario's `sagaStart`, not a pile.
        if (def.sagaStartAside === true && line.loadGroupId === "sharedSetAside" && (isHero(byCode, card.code) || card.name === "The One Ring")) {
          if (!isHero(byCode, card.code)) player.push(card.code);
          else if (deck === normalDeck) heroes.push(card.code);
          continue;
        }
        if (line.loadGroupId === PLAYER_GROUP && def.groups?.[line.loadGroupId] === undefined) {
          if (!isHero(byCode, card.code)) player.push(card.code);
          else if (deck === normalDeck) heroes.push(card.code);
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
        // A two-sided card the Setup has the first player take control of is dealt on the side it names (Haldan, not Woodmen Village).
        const controlled = def.takeControlFaceup === true && clausesOf(quest, "step").some((clause) => clause.step === "takeControl" && other != null && clause.codes.includes(other.code) && !clause.codes.includes(card?.code ?? ""));
        if (other && controlled) [card, other] = [other, card];
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
      // The variants of one stage (Flight from Moria's seven stage 2 cards, Foundations of Stone's four stage 4 cards) are dealt in no printed order, so the load list may list them in another order than Hall of Beorn's.
      const stageNumber = (code: string) => Number.parseInt(byCode.get(code)?.stage ?? "", 10);
      const sameStages = JSON.stringify(stages) === JSON.stringify(deckStages) || (stages.length === deckStages.length && [...stages].sort().join() === [...deckStages].sort().join() && stages.every((code, at) => stageNumber(code) === stageNumber(deckStages[at] ?? "")));
      if (!sameStages) local.push(`${id}: quest stages disagree: Hall of Beorn ${stages.join(",")} / DragnCards ${deckStages.join(",")}`);
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
        // The Harad enemies the campaign log records (Setup: "Set each Harad enemy recorded in the campaign log aside"): the campaign record deals them.
        if (namedByCampaign || loggedHarad(camp, printed)) campaignPlaced.add(code);
        else local.push(`${id}: ${nameOf(code)} is in the ${pile} pile and no Setup line puts it there`);
        continue;
      }
      // "Each player sets 1 copy of X aside" (143072:A:1, an `aside` clause with `eachPlayer`) places one copy for each player, as the `stage` clauses of a per-player Setup do.
      const perPlayer = clausesOf(quest, "stage").find((clause) => clause.perPlayer != null && clause.codes.includes(code))?.perPlayer ?? clausesOf(quest, "aside").find((clause) => clause.eachPlayer != null && clause.codes.includes(code))?.eachPlayer;
      // A location the quest's Setup has each player add (found in the encounter deck): dealt with the deck, found by the Setup record. A location the Setup stages (Mount Doom) is staged as it says; one it makes the active location (Brake of Thorns, of which the set holds more copies) is made active by one copy, and its other copies are found like any location.
      const searched = pile === "staging" && printed?.type === "location" && clausesOf(quest, "eachPlayerAddsLocation").length > 0 && !facts.said(["stage"]);
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
      if (item && item.normal === 0) placed.splice(placed.indexOf(item), 1);
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
    for (const code of cycle || campaignCard === undefined ? [] : campaignTextCodes({ names, byCode, ruleById, campaignCard, campaignLines: campaignLines.others, setupSpan: def.deck !== undefined ? (def.setupSpan ?? null) : null, cardPacks, campaignCardsOnly: productOf(def.campaignProduct ?? def.product).campaignCardRewards === true })) campaignPlaced.add(code);
    for (const rule of overrides.scenarioCampaignPlaced) if ([rule.scenario].flat().includes(id)) for (const code of [rule.code].flat()) campaignPlaced.add(code);
    // Everything the quest Setup names must be in a pile.
    const inPile = (code: string, piles: readonly string[]) => placed.some((item) => same(item.code, code) && piles.includes(item.pile));
    for (const clause of quest.clauses) {
      if (clause.kind === "aside") for (const code of clause.codes) if (!inPile(code, ["setAside"])) local.push(`${id}: Setup sets ${nameOf(code)} aside, which the load list does not`);
      if (clause.kind === "stage") for (const code of clause.codes) if (!inPile(code, ["staging"])) local.push(`${id}: Setup adds ${nameOf(code)} to staging, which the load list does not`);
      if (clause.kind === "active") for (const code of clause.codes) if (!inPile(code, ["activeLocation"])) local.push(`${id}: Setup makes ${nameOf(code)} the active location, which the load list does not`);
      if (clause.kind === "attachChosen") for (const code of clause.codes) if (!inPile(code, ["attachedChosen"])) local.push(`${id}: Setup attaches ${nameOf(code)} to a hero, which the load list does not`);
      if (clause.kind === "step" && clause.step === "takeControl") for (const code of clause.codes) if (!inPile(code, ["setAside"])) local.push(`${id}: Setup has the first player take control of ${nameOf(code)}, which the load list does not set aside`);
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
    const rule = def.setupSpan === undefined ? undefined : ruleById.get(def.setupSpan);
    if (def.setupSpan === undefined && !cycle) local.push(`${id}: a campaign scenario names its Setup span (scripts/data/campaign-defs.ts)`);
    if (def.setupSpan !== undefined && !rule) local.push(`${id}: no rules span ${def.setupSpan} (data/rules/index.json)`);
    // Angmar Awakened's booklet lists an icon named for an objective-ally (Amarthiúl) among the encounter sets; his card is dealt in its own scenario's set, so the name is a card title, not a set.
    const namesAnObjective = (name: string) => placed.some((item) => byCode.get(item.code)?.type === "objective" && canon(byCode.get(item.code)?.name ?? "") === canon(name) && canon(byCode.get(item.code)?.encounterSet ?? "") !== canon(name));
    const booklet = bookletSetsOf(rule).filter((name) => !(def.deck && namesAnObjective(name)));
    const first = hob.QuestCards[0];
    const isCampaign = (code: string) => byCode.get(code)?.typeName === "Campaign" || byCode.get(code)?.campaignKind != null;
    let hobSets = def.encounterSets ? [...def.encounterSets] : [first?.EncounterInfo?.EncounterSet, ...(first?.EncounterInfo?.IncludedEncounterSets ?? [])].filter((name): name is string => !!name).map((name) => name.replace(CAMPAIGN_SUFFIX, ""));
    if (def.setupSpan === undefined) {
      // No rules insert is pinned for this scenario (a cycle's Adventure Pack): Hall of Beorn's set list is the list, and the sets of the cards the load list deals must be exactly those.
      const dealtSets = new Set<string>();
      for (const item of placed) {
        const card = byCode.get(item.code);
        if (card && item.pile !== "quest" && !isCampaign(item.code) && card.encounterSet) dealtSets.add(canon(card.encounterSet));
      }
      if (JSON.stringify([...dealtSets].sort()) !== JSON.stringify(hobSets.map(canon).sort())) local.push(`${id}: encounter sets: load list deals ${[...dealtSets].sort().join(", ")} / Hall of Beorn ${hobSets.join(", ")}`);
    } else if (booklet.length === 0) local.push(`${id}: the booklet's Setup paragraph ${def.setupSpan} lists no encounter sets`);
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
      // A card the first player takes control of (Haldan) is no part of the encounter deck, so its set need not be one the booklet names.
      const controlled = clausesOf(quest, "step").filter((clause) => clause.step === "takeControl").flatMap((clause) => clause.codes);
      const onlyControlled = (name: string) => placed.every((item) => canon(byCode.get(item.code)?.encounterSet ?? "") !== canon(name) || item.pile === "quest" || controlled.some((code) => same(code, item.code)));
      for (const [key, name] of printedSets) if (!listedSets.has(key) && !onlyControlled(name)) local.push(`${id}: the load list deals ${name} cards, which the booklet's encounter sets do not name`);
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
      // A card of a set the scenario's Setup removes from the game (overrides.scenarioRemovals) is not dealt.
      if (overrides.scenarioRemovals.some((rule) => rule.scenario === id && canon(card.encounterSet ?? "") === canon(rule.set) && rule.types.includes(card.type))) continue;
      if (overrides.scenarioExcluded.some((rule) => rule.scenario === id && rule.code === card.code)) continue;
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
      // An override is the recorded decision, so its count is not compared with Hall of Beorn's again (The Two Towers keeps DragnCards' E0C counts where the two differ).
      if (fixed == null && easyCount !== item.EasyQuantity) local.push(`${id}: ${item.Title} Easy ${easyCount}, Hall of Beorn ${item.EasyQuantity}`);
      if (fixed != null) for (const p of mine) p.easy = Math.min(fixed, p.normal);
    }

    const textOf = (code: string) => `${byCode.get(code)?.text ?? ""}\n${byCode.get(code)?.back?.text ?? ""}`;
    const everything = placed.map((item) => textOf(item.code)).join("\n");
    const widgets = {
      hide: /\bHide (?:test|\d)/.test(everything) || placed.some((item) => byCode.get(item.code)?.keywords?.hide != null),
      // A stage that says "There can be 2 active locations", or a dealt card that grants the slot (Fisherman's Dock: "There are now 2 active locations").
      secondActiveLocation: stages.some((code) => /There can be 2 active locations/.test(textOf(code))) || /There are now 2 active locations/.test(everything),
      // A stage that creates a staging area for each player (Breaking of the Fellowship, Escape from Mount Gram), or a dealt card that sends a player to a staging area of his own (Great Barrow, 148007).
      perSeatStaging: stages.some((code) => /creates? (?:his|their|your) own staging area/i.test(textOf(code))) || /create your own staging area/.test(everything),
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
    // A Two Towers scenario's saga hero is `sagaStart`; the campaign's prelude stays empty (the Fellowship's attachments are its prelude).
    const sagaStart = product.sagaStart ? sagaStartOf(byCode, heroes, normal.player) : undefined;
    if (product.sagaStart && !sagaStart) {
      problems.push(`${id}: the load list's player 1 play area is not one saga hero or a Ring-bearer with attachments (heroes ${heroes.join(",")}, cards ${normal.player.join(",")})`);
      continue;
    }
    preludes.set(id, product.sagaStart ? [] : normal.player.map((code) => ({ code })));
    if (campaignCard !== undefined) campaignCards[id] = campaignCard;
    scenarios.push(
      parseAnyScenarioData({
        id,
        name: hob.Title,
        number: hob.Number,
        stages,
        encounterSets,
        cards: placed,
        ...(campaignCard !== undefined ? { campaignCard } : {}),
        campaignPlaced: [...campaignPlaced].sort(),
        ...(Object.keys(reprints).length > 0 ? { reprints } : {}),
        ...(life != null ? { life } : {}),
        ...(sagaStart ? { sagaStart } : {}),
        widgets,
        source: { dragnNormal: normalKey, dragnEasy: easyDeck ? easyKey : null, hobSlug: hob.Slug },
        ...(nightmare.data ? { nightmare: nightmare.data } : {}),
        ...(modeCard ? { modeCard: modeCard.code } : {}),
      }),
    );
  }

  const campaigns = campaignsOf(campaignDefs, scenarios, campaignCards, preludes, raw.scenarioIndex);
  return { scenarios, campaigns, problems };
}
