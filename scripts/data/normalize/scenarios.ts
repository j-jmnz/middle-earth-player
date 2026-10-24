import { parse as parseJsonc } from "jsonc-parser";

import type { Card } from "../../../src/catalog/card-facts.ts";
import {
  campaignDataSchema,
  parseScenarioData,
  PILES,
  type CampaignData,
  type Pile,
  type Placement,
  type ScenarioData,
} from "../../../src/catalog/scenario-data.ts";
import type { Overrides } from "./cards.ts";
import { sameName } from "./names.ts";
import type { RawData } from "./load-raw.ts";

// Dragncards load groups -> our piles.
const GROUP_PILE: Readonly<Record<string, Pile>> = {
  sharedQuestDeck: "quest",
  sharedEncounterDeck: "encounter",
  sharedStagingArea: "staging",
  sharedActiveLocation: "activeLocation",
  sharedSetAside: "setAside",
};
const PLAYER_GROUP = "player1Play1";
const PACK_BY_NAME: Readonly<Record<string, string>> = { "The Black Riders": "TBR", "The Road Darkens": "TRD" };

type Deck = { label: string; cards: { databaseId: string; quantity: number; loadGroupId: string }[] };

// A scenario is written only when every check passes. The rest are listed in problems and stay unbuilt
// until an override or a template resolves them.
export type ScenarioResult = {
  scenarios: ScenarioData[];
  campaign: CampaignData;
  problems: string[];
};

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isHero(cards: ReadonlyMap<string, Card>, code: string): boolean {
  return cards.get(code)?.type === "hero";
}

export function buildScenarios(raw: RawData, cards: readonly Card[], overrides: Overrides, existingCampaign: unknown): ScenarioResult {
  const problems: string[] = [];
  const decks = (parseJsonc(raw.dragnRaw.preBuiltDecks) as { preBuiltDecks: Record<string, Deck> }).preBuiltDecks;
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const byGuid = new Map<string, Card>();
  const byPackNumber = new Map<string, Card>();
  const bySlug = new Map<string, Card>();
  for (const card of cards) {
    for (const printing of card.printings) {
      if (printing.octgnGuid) byGuid.set(printing.octgnGuid, card);
      if (printing.pack === "TBR" || printing.pack === "TRD") byPackNumber.set(`${printing.pack}:${printing.number}`, card);
      if (printing.hobSlug) bySlug.set(printing.hobSlug, card);
    }
  }

  const resolve = (databaseId: string): Card | null => {
    const direct = byGuid.get(databaseId);
    if (direct) return direct;
    const row = raw.dragn.get(databaseId);
    const pack = PACK_BY_NAME[row?.packName ?? ""];
    const hit = pack ? byPackNumber.get(`${pack}:${row?.numberInPack ?? ""}`) : undefined;
    return hit && row && sameName(hit.name, row.name ?? "") ? hit : null;
  };

  const scenarios: ScenarioData[] = [];
  let prelude: { code: string }[] = [];

  for (const hob of [...raw.scenarios].sort((a, b) => a.Number - b.Number)) {
    const id = slug(hob.Title);
    const entry = Object.entries(decks).find(([key, deck]) => /^Q0C\.\d+$/.test(key) && deck.label === hob.Title);
    if (!entry) {
      problems.push(`${id}: DragnCards has no Q0C deck labelled "${hob.Title}"`);
      continue;
    }
    const [normalKey, normalDeck] = entry;
    const easyKey = normalKey.replace("Q0C", "E0C");
    const easyDeck = decks[easyKey];
    const local: string[] = [];

    const load = (deck: Deck): { placements: Map<string, number>; player: string[] } => {
      const placements = new Map<string, number>();
      const player: string[] = [];
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
        let pile = GROUP_PILE[line.loadGroupId];
        if (!pile) {
          local.push(`${deck.label}: group ${line.loadGroupId} is not supported (${name})`);
          continue;
        }
        const moved = overrides.scenarioPiles.find((rule) => rule.scenario === id && rule.code === card.code);
        if (moved) pile = moved.pile;
        const key = `${card.code}\u0000${pile}`;
        placements.set(key, (placements.get(key) ?? 0) + line.quantity);
      }
      return { placements, player };
    };

    const normal = load(normalDeck);
    const easy = easyDeck ? load(easyDeck) : { placements: new Map<string, number>(), player: [] };
    if (!easyDeck) local.push(`${id}: no ${easyKey} Easy deck`);
    for (const key of easy.placements.keys()) {
      if (!normal.placements.has(key)) local.push(`${id}: Easy deck has ${key.replace("\u0000", " in ")} that Normal does not`);
    }
    const placed: Placement[] = [...normal.placements].map(([key, count]) => {
      const [code = "", pile = ""] = key.split("\u0000");
      return { code, pile: pile as Pile, normal: count, easy: Math.min(easy.placements.get(key) ?? 0, count) };
    });
    // Stages in printed order: the Hall of Beorn quest cards give it, the Dragncards deck must agree.
    const stages = hob.QuestCards.map((quest) => bySlug.get(quest.Slug)?.code).filter((code): code is string => code !== undefined);
    const deckStages = placed.filter((card) => card.pile === "quest").map((card) => card.code);
    if (JSON.stringify(stages) !== JSON.stringify(deckStages)) local.push(`${id}: quest stages disagree: Hall of Beorn ${stages.join(",")} / DragnCards ${deckStages.join(",")}`);
    // Encounter sets, in booklet order: the scenario's own set, then the ones its first quest card includes.
    const first = hob.QuestCards[0];
    const setNames = [first?.EncounterInfo?.EncounterSet, ...(first?.EncounterInfo?.IncludedEncounterSets ?? [])].filter((name): name is string => !!name);
    // Campaign cards (boons, burdens, the Ring) are dealt by the campaign and are not part of a booklet set.
    const isCampaign = (code: string) => byCode.get(code)?.typeName === "Campaign";
    const encounterSets = setNames.map((name) => ({
      name,
      count: placed
        .filter((card) => card.pile !== "quest" && !isCampaign(card.code) && byCode.get(card.code)?.encounterSet === name)
        .reduce((sum, card) => sum + card.normal, 0),
    }));
    // A fixed order, so the same data always shuffles the same way: pile, then booklet set, campaign cards last, then code.
    const setRank = (code: string) => {
      const index = setNames.indexOf(byCode.get(code)?.encounterSet ?? "");
      return (isCampaign(code) ? setNames.length : 0) + (index < 0 ? setNames.length : index);
    };
    placed.sort(
      (a, b) =>
        PILES.indexOf(a.pile) - PILES.indexOf(b.pile) ||
        (a.pile === "quest" ? stages.indexOf(a.code) - stages.indexOf(b.code) : setRank(a.code) - setRank(b.code) || a.code.localeCompare(b.code)),
    );

    // Check 1: Hall of Beorn's Normal and Easy counts for each card the scenario lists.
    for (const listed of hob.ScenarioCards) {
      const card = bySlug.get(listed.Slug);
      if (!card || /\(Campaign\)$/.test(listed.Title) || /Nightmare$/.test(listed.EncounterSet ?? "")) continue;
      const mine = placed.filter((item) => item.code === card.code && item.pile !== "quest");
      const normalCount = mine.reduce((sum, item) => sum + item.normal, 0);
      const easyCount = mine.reduce((sum, item) => sum + item.easy, 0);
      if (normalCount !== listed.NormalQuantity) local.push(`${id}: ${listed.Title} Normal ${normalCount}, Hall of Beorn ${listed.NormalQuantity}`);
      if (easyCount !== listed.EasyQuantity) local.push(`${id}: ${listed.Title} Easy ${easyCount}, Hall of Beorn ${listed.EasyQuantity}`);
    }

    // Check 2: the first quest card's Setup text names what is set aside, added to staging and made active.
    const setup = byCode.get(stages[0] ?? "")?.text ?? "";
    const named = (pattern: RegExp): string[] => [...setup.matchAll(pattern)].map((match) => (match[2] ?? match[1] ?? "").trim());
    const textAside = named(/Set (.+?) aside, out of play/g);
    const textStaging = [...setup.matchAll(/Add (?:\d+|an?|one) (.+?) to the staging area/g)].map((match) => (match[1] ?? "").trim());
    const textActive = named(/make (.+?) the active location/g);
    const namesIn = (pile: Pile): string[] => placed.filter((card) => card.pile === pile).map((card) => byCode.get(card.code)?.name ?? card.code);
    const unchecked = textAside.length + textStaging.length + textActive.length === 0;
    if (unchecked) local.push(`${id}: the quest card's Setup text names no placement, so the piles cannot be cross-checked`);
    else {
      const sameSet = (text: string[], pile: Pile) => {
        const mine = namesIn(pile);
        return text.length === mine.length && text.every((name) => mine.some((other) => sameName(other, name)));
      };
      if (!sameSet(textAside, "setAside")) local.push(`${id}: set aside ${namesIn("setAside").join(", ")} but Setup says ${textAside.join(", ") || "nothing"}`);
      if (!sameSet(textActive, "activeLocation")) local.push(`${id}: active ${namesIn("activeLocation").join(", ")} but Setup says ${textActive.join(", ") || "nothing"}`);
      for (const name of textStaging) {
        if (!namesIn("staging").some((other) => sameName(other, name))) local.push(`${id}: Setup adds ${name} to staging, which the deck does not`);
      }
      // A staging card the quest text does not name must add itself ("Setup: Add X to the staging area.").
      for (const card of placed.filter((item) => item.pile === "staging")) {
        const printed = byCode.get(card.code);
        if (!printed || textStaging.some((name) => sameName(printed.name, name))) continue;
        const own = printed.text ?? "";
        if (/Setup: Attach to the Ring-bearer/.test(own)) local.push(`${id}: ${printed.name} is staged, but its Setup attaches it to the Ring-bearer`);
        else if (!/Setup: Add .* to the staging area/.test(own)) local.push(`${id}: ${printed.name} is staged and no Setup text puts it there`);
      }
    }

    if (local.length > 0) {
      problems.push(...local);
      continue;
    }
    if (scenarios.length === 0) prelude = normal.player.map((code) => ({ code }));
    scenarios.push(
      parseScenarioData({
        id,
        name: hob.Title,
        number: hob.Number,
        stages,
        encounterSets,
        cards: placed,
        source: { dragnNormal: normalKey, dragnEasy: easyDeck ? easyKey : null, hobSlug: hob.Slug },
      }),
    );
  }

  const authored = campaignDataSchema.parse(existingCampaign).authored;
  const known = new Map(scenarios.map((scenario) => [scenario.id, new Set(scenario.cards.map((card) => card.code))]));
  for (const [scenarioId, groups] of Object.entries(authored.resolution)) {
    const codes = known.get(scenarioId);
    if (!codes) {
      if (scenarios.length > 0) problems.push(`campaign resolution names scenario ${scenarioId}, which is not built`);
      continue;
    }
    for (const group of groups) for (const choice of group.choices) if (!codes.has(choice.code)) problems.push(`${scenarioId} resolution ${group.id}: ${choice.code} is not one of the scenario's cards`);
  }
  const campaign: CampaignData = { id: "fellowship-of-the-ring", name: "Fellowship of the Ring", scenarios: scenarios.map((scenario) => scenario.id), prelude, authored };
  return { scenarios, campaign, problems };
}
