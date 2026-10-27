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
import { nameIndex, parseSetup, type ParsedSetup, type SetupClause } from "./setup-text.ts";
import type { RuleEntry } from "../rules/spans.ts";
import { sameName } from "./names.ts";
import { crossCheckProblems, easyRemovals, easySheetProblem, plain, PLAYER_GROUP, type Deck } from "./scenario-checks.ts";
import { pilesFromSetup, type Loaded } from "./setup-piles.ts";
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

function setupOf(text: string | null | undefined): string | null {
  return textLines(text).find((line) => /^Setup:/.test(line)) ?? null;
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

  const resolve = (databaseId: string): Card | null => {
    const direct = byGuid.get(databaseId);
    if (direct) return direct;
    const row = raw.dragn.get(databaseId);
    const pack = PRODUCTS.find((product) => product.name === row?.packName)?.twinPack;
    const hit = pack ? byPackNumber.get(`${pack}:${row?.numberInPack ?? ""}`) : undefined;
    return hit && row && sameName(hit.name, row.name ?? "") ? hit : null;
  };

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
    const packs = product.packs;
    const local: string[] = [];
    const entry = fromDragn ? Object.entries(decks).find(([key, deck]) => /^Q0C\.\d+$/.test(key) && deck.label === hob.Title) : undefined;
    if (fromDragn && !entry) {
      problems.push(`${id}: DragnCards has no Q0C deck labelled "${hob.Title}"`);
      continue;
    }
    const [normalKey, normalDeck] = entry ?? [null, null];
    const easyKey = normalKey?.replace("Q0C", "E0C") ?? null;
    const easyDeck = easyKey ? decks[easyKey] : undefined;
    const campaignCard = campaignCardsOf(packs).get(hob.Title.replace(CAMPAIGN_SUFFIX, ""));
    if (!campaignCard) {
      problems.push(`${id}: no campaign card named "${hob.Title.replace(CAMPAIGN_SUFFIX, "")}"`);
      continue;
    }

    // Everything the scenario's own cards can name: Hall of Beorn's list, the quest cards, and the box's boons and burdens.
    const listed = new Set<string>();
    for (const item of [...hob.QuestCards, ...hob.ScenarioCards]) {
      const card = bySlug.get(item.Slug);
      if (card) listed.add(card.code);
    }
    const scope = cards.filter((card) => listed.has(card.code) || (card.campaignKind != null && card.printings.some((p) => packs.includes(p.pack))));
    const names = nameIndex(scope, new Set(scope.filter((card) => card.type !== "quest").map((card) => card.code)));

    // Stages in printed order: the Hall of Beorn quest cards give it, the Dragncards deck must agree.
    const stages = hob.QuestCards.map((quest) => bySlug.get(quest.Slug)?.code).filter((code): code is string => code !== undefined);

    // The printed Setup of the first quest stage and of the campaign card.
    const questSetup = setupOf(byCode.get(stages[0] ?? "")?.text);
    const campaignSetup = setupOf(byCode.get(campaignCard)?.text);
    const quest: ParsedSetup = questSetup ? parseSetup(questSetup, names) : { clauses: [], unread: [] };
    const camp: ParsedSetup = campaignSetup ? parseSetup(campaignSetup, names) : { clauses: [], unread: [] };
    for (const sentence of [...quest.unread, ...camp.unread]) local.push(`${id}: a Setup sentence no pattern reads: ${sentence}`);
    const clausesOf = <K extends SetupClause["kind"]>(parsed: ParsedSetup, kind: K) => parsed.clauses.filter((clause): clause is Extract<SetupClause, { kind: K }> => clause.kind === kind);
    const codesOf = (parsed: ParsedSetup, kinds: readonly SetupClause["kind"][]) =>
      new Set(parsed.clauses.flatMap((clause) => (kinds.includes(clause.kind) && "codes" in clause ? clause.codes : [])));
    const nameOf = (code: string) => byCode.get(code)?.name ?? code;

    const load = (deck: Deck): { placements: Map<string, number>; player: string[]; campaign: Set<string> } => {
      const placements = new Map<string, number>();
      const player: string[] = [];
      const campaign = new Set<string>();
      for (const line of deck.cards) {
        const card = resolve(line.databaseId);
        const name = raw.dragn.get(line.databaseId)?.name ?? line.databaseId;
        if (!card) {
          // The scenario overview card has no game text and no catalog row.
          if (name !== hob.Title) local.push(`${deck.label}: no card for "${name}" (${line.databaseId})`);
          continue;
        }
        if (card.type === "campaign") continue;
        if (line.loadGroupId === PLAYER_GROUP) {
          if (!isHero(byCode, card.code)) player.push(card.code);
          continue;
        }
        let pile: Pile | "campaign" | undefined = GROUP_PILE[line.loadGroupId];
        if (!pile) {
          local.push(`${deck.label}: group ${line.loadGroupId} is not supported (${name})`);
          continue;
        }
        const moved = overrides.scenarioPiles.find((rule) => rule.scenario === id && rule.code === card.code);
        if (moved) pile = moved.pile;
        if (pile === "campaign") {
          campaign.add(card.code);
          continue;
        }
        const key = `${card.code}\u0000${pile}`;
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
    const campaignNamed = codesOf(camp, ["aside", "stage", "active", "attachRingBearer", "shuffleInto", "earned", "choose", "putIntoPlay", "attachChosen", "addToHandAfterMulligan", "addToCampaignPool"]);
    // "Each player chooses 1 Adaptation boon": every boon of that trait in the box is a choice, dealt by the campaign card.
    for (const clause of clausesOf(camp, "eachPlayerChoosesBoon")) {
      for (const card of scope) if (card.campaignKind === "boon" && card.traits.includes(clause.trait)) campaignNamed.add(card.code);
    }
    for (const [key, count] of normal.placements) {
      const [code = "", pile = ""] = key.split("\u0000");
      const printed = byCode.get(code);
      const own = printed?.text ?? "";
      const said = (kinds: readonly SetupClause["kind"][]) => codesOf(quest, kinds).has(code);
      // A card the campaign card's Setup places is dealt by that record, not by the load list.
      if (campaignNamed.has(code) && !codesOf(quest, ["aside", "stage", "active", "attachRingBearer", "attachChosen"]).has(code)) {
        campaignPlaced.add(code);
        continue;
      }
      let ok = true;
      if (pile === "setAside") ok = said(["aside"]);
      else if (pile === "activeLocation") ok = said(["active"]);
      else if (pile === "attachedChosen") ok = said(["attachChosen"]);
      else if (pile === "attached") ok = said(["attachRingBearer"]) || /Setup: Attach to the Ring-bearer/.test(own);
      else if (pile === "staging") {
        const eachPlayer = clausesOf(quest, "stage").some((clause) => clause.perPlayer != null && clause.codes.includes(code));
        const explorers = clausesOf(quest, "eachPlayerAddsLocation").length > 0 && printed?.type === "location";
        const searched = clausesOf(quest, "searchObjectives").length > 0 && printed?.type === "objective";
        ok = said(["stage"]) || eachPlayer || explorers || searched || /Setup: Add .* to the staging area/.test(own);
      } else if (pile === "burden") ok = true;
      if (!ok && campaignNamed.has(code)) {
        campaignPlaced.add(code);
        continue;
      }
      if (!ok) {
        local.push(`${id}: ${nameOf(code)} is in the ${pile} pile and no Setup line puts it there`);
        continue;
      }
      const perPlayer = clausesOf(quest, "stage").find((clause) => clause.perPlayer != null && clause.codes.includes(code))?.perPlayer;
      placed.push({ code, pile: pile as Pile, normal: count, easy: Math.min(easy.placements.get(key) ?? 0, count), ...(perPlayer != null ? { perPlayer } : {}) });
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
    for (const code of names.codesOf(byCode.get(campaignCard)?.back?.text ?? "")) campaignPlaced.add(code);
    // Everything the quest Setup names must be in a pile.
    const inPile = (code: string, piles: readonly string[]) => placed.some((item) => item.code === code && piles.includes(item.pile));
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
    const hobSets = [first?.EncounterInfo?.EncounterSet, ...(first?.EncounterInfo?.IncludedEncounterSets ?? [])].filter((name): name is string => !!name).map((name) => name.replace(CAMPAIGN_SUFFIX, ""));
    if (booklet.length === 0) local.push(`${id}: the booklet's Setup paragraph ${def.setupSpan} lists no encounter sets`);
    else if (JSON.stringify(booklet.map(canon).sort()) !== JSON.stringify(hobSets.map(canon).sort())) local.push(`${id}: encounter sets: booklet ${booklet.join(", ")} / Hall of Beorn ${hobSets.join(", ")}`);
    const setNames = hobSets;
    const isCampaign = (code: string) => byCode.get(code)?.typeName === "Campaign" || byCode.get(code)?.campaignKind != null;
    const encounterSets = setNames.map((name) => ({
      name,
      count: placed
        .filter((card) => card.pile === "encounter" && !isCampaign(card.code) && byCode.get(card.code)?.encounterSet === name)
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
      const mine = placed.filter((p) => p.code === card.code && p.pile !== "quest");
      const normalCount = mine.reduce((sum, p) => sum + p.normal, 0);
      const fixed = easyFix(card.code);
      const easyCount = fixed ?? mine.reduce((sum, p) => sum + p.easy, 0);
      const sheetProblem = easySheetProblem(id, product, item, card, removals, canon);
      if (sheetProblem) local.push(sheetProblem);
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

    if (local.length > 0) {
      problems.push(...local);
      continue;
    }
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
        ...(life != null ? { life } : {}),
        widgets,
        source: { dragnNormal: normalKey, dragnEasy: easyDeck ? easyKey : null, hobSlug: hob.Slug },
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
