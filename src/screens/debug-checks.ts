import { EFFECTS } from "../effects";
import {
  normalEncounterSize,
  scenarioCards,
  scenarioDefinition,
  type CampaignData,
  type ScenarioData,
} from "../catalog/scenario-data";

export const DEBUG_HERO_CODE = "141001";
export const DEBUG_CAMPAIGN_ID = "fellowship-of-the-ring";
export const DEBUG_SAMPLE_CODES = ["141001", "141022", "141023", "141024"] as const;

export type DebugImageSample = {
  code: string;
  imagesrc: string | null;
  width: number | null;
  height: number | null;
  mediaType: string | null;
};

export type DebugQueueStatus = {
  pending: number;
  active: number;
  failures: Readonly<Record<string, string>>;
};

export type DebugCheckInput = {
  bundledVersion: number;
  appliedVersion: number | null;
  packCount: number;
  cardCount: number;
  fellowship: { id: string; name: string } | null;
  deckCount: number;
  saveCount: number;
  hero: {
    present: boolean;
    deckLegal: boolean;
    imagesrc: string | null;
  };
  scenario: ScenarioData;
  campaign: CampaignData;
  presentCardCodes: readonly string[];
  imageFileCount: number;
  snapshotCount: number;
  pauseEntryCount: number;
  samples: readonly DebugImageSample[];
  scansPacked: boolean;
  queue: DebugQueueStatus;
};

export function debugSentences(input: DebugCheckInput): readonly string[] {
  const sentences: string[] = [];
  sentences.push(versionSentence(input.bundledVersion, input.appliedVersion));
  sentences.push(countSentence(input.packCount, "pack"));
  sentences.push(countSentence(input.cardCount, "card"));
  sentences.push(fellowshipSentence(input.fellowship));
  sentences.push(countSentence(input.deckCount, "deck"));
  sentences.push(countSentence(input.saveCount, "save"));
  sentences.push(...heroSentences(input.hero));
  sentences.push(...scenarioSentences(input));
  sentences.push(...absentCardSentences(input.scenario, input.presentCardCodes));
  sentences.push(countSentence(input.imageFileCount, "image file"));
  sentences.push(countSentence(input.snapshotCount, "image in memory", "images in memory"));
  sentences.push(countSentence(input.pauseEntryCount, "pause entry", "pause entries"));
  for (const sample of input.samples) sentences.push(imageSampleSentence(sample));
  sentences.push(input.scansPacked ? "Scans are packed." : "Scans are not packed.");
  sentences.push(`Queue has ${input.queue.pending} pending and ${input.queue.active} active.`);
  for (const code of Object.keys(input.queue.failures).sort()) {
    const failure = input.queue.failures[code];
    if (!failure) continue;
    sentences.push(failureSentence(code, failure));
  }
  return sentences;
}

function versionSentence(bundled: number, applied: number | null): string {
  if (applied == null) {
    return `User database has no applied catalog version. Bundled catalog is ${bundled}.`;
  }
  if (applied !== bundled) {
    return `Catalog ${bundled} does not match user database ${applied}.`;
  }
  return `Catalog ${bundled} matches the user database.`;
}

function fellowshipSentence(fellowship: DebugCheckInput["fellowship"]): string {
  if (!fellowship) return `Fellowship campaign ${DEBUG_CAMPAIGN_ID} is missing.`;
  return `Fellowship campaign ${fellowship.name}.`;
}

function heroSentences(hero: DebugCheckInput["hero"]): string[] {
  if (!hero.present) return [`Hero ${DEBUG_HERO_CODE} is missing.`];
  const problems: string[] = [];
  if (!hero.deckLegal) problems.push(`Hero ${DEBUG_HERO_CODE} is not deck-legal.`);
  if (!usableImagesrc(hero.imagesrc)) problems.push(`Hero ${DEBUG_HERO_CODE} has no imagesrc.`);
  if (problems.length === 0) {
    return [`Hero ${DEBUG_HERO_CODE} is present, deck-legal, and has an imagesrc.`];
  }
  return problems;
}

function scenarioSentences(input: DebugCheckInput): string[] {
  const definition = scenarioDefinition(input.scenario, input.campaign, EFFECTS);
  return [
    `Normal encounter size is ${normalEncounterSize(input.scenario)}.`,
    ...definition.encounterSets.map((set) => `${set.code} has ${set.count} cards.`),
    `Stages are ${listCodes(definition.stages.map((stage) => stage.code))}.`,
    `Setup instructions: ${definition.setup.length}. Resolution instructions: ${definition.resolution.length}.`,
  ];
}

function absentCardSentences(scenario: ScenarioData, presentCardCodes: readonly string[]): string[] {
  const present = new Set(presentCardCodes);
  const missing = [...new Set(scenarioCards(scenario).map((card) => card.code))]
    .filter((code) => !present.has(code))
    .sort();
  return missing.map((code) => `Scenario code ${code} is absent from cards.`);
}

function imageSampleSentence(sample: DebugImageSample): string {
  if (!usableImagesrc(sample.imagesrc)) return `${sample.code} has no imagesrc.`;
  if (sample.width == null || sample.height == null || sample.mediaType == null || sample.mediaType.trim() === "") {
    return `${sample.code} is not cached.`;
  }
  return `${sample.code} is a ${sample.width}×${sample.height} ${sample.mediaType}.`;
}

function failureSentence(code: string, sentence: string): string {
  const text = sentence.endsWith(".") ? sentence : `${sentence}.`;
  return `${code} failed: ${text}`;
}

function usableImagesrc(imagesrc: string | null): string | null {
  if (imagesrc == null) return null;
  const trimmed = imagesrc.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function countSentence(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}.`;
}

function listCodes(codes: readonly string[]): string {
  return codes.join(", ");
}

