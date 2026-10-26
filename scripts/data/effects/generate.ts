import type { Condition, Effect } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { CampaignData, ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { stripKeywords } from "../normalize/keywords.ts";
import { sameName } from "../normalize/names.ts";
import { dealtCodes, starterCodes } from "../load-scenarios.ts";
import { keyOf, lineId, type Ledger } from "../printed/ledger.ts";
import { PLAYER_REQUESTS } from "../printed/scope.ts";
import { TEMPLATES, type Draft, type TemplateContext } from "./templates.ts";

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
  ["resolution", "resolution"],
]);

const PHASES = ["Resource", "Planning", "Quest", "Travel", "Encounter", "Combat", "Refresh"] as const;

type Limit = { limit: "oncePerRound" | "oncePerPhase"; times: number };

const TIMES: Readonly<Record<string, number>> = { once: 1, twice: 2 };

// "Combat Action: ..." is an Action that can only be used in that phase's action windows (rr.action). "(Limit once per round.)"
// ends a line whose ability may be used once a round or a phase (rr.limits); some printings drop the parentheses ("Limit once
// per round.", 01012:A:1) or allow more uses ("Limit 3 times per phase.", 01070:A:2). Both are lifted off the line so one
// template reads the sentence whether or not the card carries them.
function wrapped(line: string): { line: string; condition: Condition | null; limit: Limit | null } {
  let rest = line;
  let condition: Condition | null = null;
  const phase = new RegExp(`^(${PHASES.join("|")}) Action: `).exec(rest);
  if (phase?.[1]) {
    condition = { kind: "phase", is: phase[1] as (typeof PHASES)[number] };
    rest = `Action: ${rest.slice(phase[0].length)}`;
  }
  let limit: Limit | null = null;
  const limited = /\s*(\()?Limit (once|twice|\d+ times) per (round|phase)\.?(\))?\s*$/.exec(rest);
  if (limited && Boolean(limited[1]) === Boolean(limited[4])) {
    const times = TIMES[limited[2] ?? ""] ?? Number.parseInt(limited[2] ?? "1", 10);
    limit = { limit: limited[3] === "round" ? "oncePerRound" : "oncePerPhase", times };
    rest = rest.slice(0, limited.index);
  }
  return { line: rest, condition, limit };
}

// The phase and the limit go on the record of the Action they were printed on. A record that already has its own condition
// is not one a wrapper can be added to: the line is left to be authored.
function withWrapper(drafts: Draft[], condition: Condition | null, limit: Limit | null): Draft[] | null {
  if (drafts.some((draft) => draft.timing !== "action")) return null;
  if (condition && drafts.some((draft) => draft.condition)) return null;
  return drafts.map((draft) => ({ ...draft, ...(condition ? { condition } : {}), ...(limit ? { limit: limit.limit, ...(limit.times > 1 ? { limitTimes: limit.times } : {}) } : {}) }));
}

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
  // The player's requests (scripts/data/printed/scope.ts) are read by the same templates as the starter cards.
  const wanted = new Set([...dealtCodes(campaign, scenarios), ...starterCodes(campaign), ...PLAYER_REQUESTS]);
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
      const named = stripKeywords(segment.line).replaceAll(new RegExp(card.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "{self}");
      const { line, condition, limit } = wrapped(named);
      let drafts = null;
      for (const template of TEMPLATES) {
        const match = template.pattern.exec(line);
        if (!match) continue;
        drafts = template.build(match, context);
        if (drafts && (condition || limit)) drafts = withWrapper(drafts, condition, limit);
        if (drafts) {
          drafts = drafts.map((draft) => (card.type === "event" && draft.timing === "response" && !draft.cost ? { ...draft, cost: { kind: "playEvent" as const } } : draft));
          usage[template.id] = (usage[template.id] ?? 0) + 1;
          break;
        }
      }
      if (drafts) {
        for (const draft of drafts) effects.push({ id: `${card.code}:${draft.timing}:${next(draft.timing)}`, cardCode: card.code, lines: [segment.lineId], ...draft });
        continue;
      }
      const label = /^([A-Z][A-Za-z ]+?):\s/.exec(line)?.[1]?.toLowerCase();
      const timing = ((label === "setup" && card.type === "campaign" ? "campaignSetup" : label ? LABEL_TIMING.get(label) : undefined)) ?? null;
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
