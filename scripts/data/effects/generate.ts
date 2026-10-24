import type { Effect } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { CampaignData, ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { stripKeywords } from "../normalize/keywords.ts";
import { sameName } from "../normalize/names.ts";
import { keyOf, lineId, type Ledger } from "../printed/ledger.ts";
import { TEMPLATES, type TemplateContext } from "./templates.ts";

export type Segment = { card: Card; index: number; side: "front" | "back" | "shadow"; line: string; lineId: string };

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

// The printed lines of a card, front first, then side B, then the shadow effect: the order the effect records are
// numbered in. A card with no ledger entry falls back to its source text, numbered the same way, so a draft can be
// written for it; the coverage test refuses a dealt card in that state.
export function segmentsOf(card: Card, ledger: Ledger): Segment[] {
  const front = ledger.byKey.get(keyOf(card.code, "A"));
  const back = ledger.byKey.get(keyOf(card.code, "B"));
  const rows: { side: Segment["side"]; line: string; id: string }[] = [];
  const frontLines = front ? front.lines : (card.text ?? "").split("\n").concat((card.shadowText ?? "").split("\n"));
  const shadowRows: typeof rows = [];
  frontLines.forEach((raw, at) => {
    const row = { side: /^Shadow:/.test(raw) ? ("shadow" as const) : ("front" as const), line: normalize(raw), id: lineId(card.code, "A", at + 1) };
    (row.side === "shadow" ? shadowRows : rows).push(row);
  });
  const backLines = back ? back.lines : (card.back?.text ?? "").split("\n");
  backLines.forEach((raw, at) => rows.push({ side: "back", line: normalize(raw), id: lineId(card.code, "B", at + 1) }));
  rows.push(...shadowRows);
  const out: Segment[] = [];
  for (const row of rows) {
    if (row.line === "" || stripKeywords(row.line) === "") continue;
    out.push({ card, index: out.length, side: row.side, line: row.line, lineId: row.id });
  }
  return out;
}

export function generateEffects(cards: readonly Card[], scenarios: readonly ScenarioData[], campaign: CampaignData, ledger: Ledger): Generated {
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
    for (const segment of segmentsOf(card, ledger)) {
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
        for (const draft of drafts) effects.push({ id: `${card.code}:${draft.timing}:${next(draft.timing)}`, cardCode: card.code, lines: [segment.lineId], ...draft });
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
