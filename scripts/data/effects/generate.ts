import type { Effect } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { CampaignData, ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { parseKeywordTokens } from "../normalize/keywords.ts";
import { sameName } from "../normalize/names.ts";
import { TEMPLATES, type TemplateContext } from "./templates.ts";

export type Segment = { card: Card; index: number; side: "front" | "back" | "shadow"; line: string };

export type Unmatched = Segment & { timing: string | null };

export type Generated = {
  effects: Effect[];
  unmatched: Unmatched[];
  // template id -> number of lines it produced records for
  usage: Record<string, number>;
};

const LABEL_TIMING: ReadonlyMap<string, string> = new Map([
  ["setup", "setup"],
  ["forced", "forced"],
  ["when revealed", "whenRevealed"],
  ["response", "response"],
  ["action", "action"],
  ["shadow", "shadow"],
  ["travel", "travel"],
  ["quest resolution", "questResolution"],
]);

function normalize(line: string): string {
  return line.replaceAll("`", "'").trim();
}

function isKeywordSentence(sentence: string): boolean {
  const parsed = parseKeywordTokens([sentence]);
  return parsed.unknown.length === 0 && Object.keys(parsed.keywords).length > 0;
}

// Leading keyword sentences ("Hide 2. Cannot have ...") are not part of the ability. A line that is only keywords is not one.
export function stripKeywords(line: string): string {
  const sentences = line.split(/(?<=\.)\s+/);
  let at = 0;
  while (at < sentences.length && isKeywordSentence(sentences[at] ?? "")) at += 1;
  return sentences.slice(at).join(" ");
}

export function segmentsOf(card: Card): Segment[] {
  const sides: [Segment["side"], string | null][] = [
    ["front", card.text],
    ["back", card.back?.text ?? null],
    ["shadow", card.shadowText],
  ];
  const out: Segment[] = [];
  for (const [side, text] of sides) {
    for (const raw of (text ?? "").split("\n")) {
      const line = normalize(raw);
      if (line === "" || stripKeywords(line) === "") continue;
      out.push({ card, index: out.length, side, line });
    }
  }
  return out;
}

export function generateEffects(cards: readonly Card[], scenarios: readonly ScenarioData[], campaign: CampaignData): Generated {
  const wanted = new Set<string>(campaign.prelude.map((card) => card.code));
  for (const scenario of scenarios) {
    for (const card of scenario.cards) wanted.add(card.code);
    for (const group of campaign.authored.resolution[scenario.id] ?? []) for (const choice of group.choices) wanted.add(choice.code);
  }
  const scope = cards.filter((card) => wanted.has(card.code)).sort((a, b) => a.code.localeCompare(b.code));
  const setAside = new Set(scenarios.flatMap((scenario) => scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code)));
  const codeOf = (name: string): string | null => {
    // The printed text has typos ("Buckleberry Ferry"), so a name may be a letter or two off.
    const exact = scope.filter((card) => card.name.toLowerCase() === name.trim().toLowerCase());
    const hits = exact.length > 0 ? exact : scope.filter((card) => sameName(card.name, name.trim()));
    return hits.length === 1 ? (hits[0]?.code ?? null) : null;
  };

  const effects: Effect[] = [];
  const unmatched: Unmatched[] = [];
  const usage: Record<string, number> = {};
  for (const card of scope) {
    const counters = new Map<string, number>();
    const next = (timing: string): number => {
      const value = (counters.get(timing) ?? 0) + 1;
      counters.set(timing, value);
      return value;
    };
    const context: TemplateContext = { card, codeOf, setAside };
    for (const segment of segmentsOf(card)) {
      const line = stripKeywords(segment.line).replaceAll(new RegExp(card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "{self}");
      let drafts = null;
      for (const template of TEMPLATES) {
        const match = template.pattern.exec(line);
        if (!match) continue;
        drafts = template.build(match, context);
        if (drafts) {
          usage[template.id] = (usage[template.id] ?? 0) + 1;
          break;
        }
      }
      if (drafts) {
        for (const draft of drafts) effects.push({ id: `${card.code}:${draft.timing}:${next(draft.timing)}`, cardCode: card.code, ...draft });
        continue;
      }
      const label = /^([A-Z][A-Za-z ]+?):\s/.exec(line)?.[1]?.toLowerCase();
      const timing = (label ? LABEL_TIMING.get(label) : undefined) ?? null;
      // A labelled line that no template reads keeps its number, so the authored record that replaces it lines up.
      if (timing) next(timing);
      unmatched.push({ ...segment, timing });
    }
  }
  return { effects, unmatched, usage };
}

export function renderGenerated(effects: readonly Effect[], campaignId: string): string {
  const lines = effects.map((effect) => `  ${JSON.stringify(effect)},`);
  return [
    `import type { Effect } from "../../catalog/boundary.ts";`,
    ``,
    `// Written by pnpm data:build from data/cards and data/scenarios (${campaignId}). Do not edit.`,
    `// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.`,
    `export const GENERATED_EFFECTS: readonly Effect[] = [`,
    ...lines,
    `];`,
    ``,
  ].join("\n");
}
