import type { Condition, Effect, Limit } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { CampaignData, ScenarioData } from "../../../src/catalog/scenario-data.ts";
import { stripKeywords } from "../normalize/keywords.ts";
import { sameName } from "../normalize/names.ts";
import { PRODUCT_HOME, scenarioDefs } from "../campaign-defs.ts";
import { dealtCodes, starterCodes } from "../load-scenarios.ts";
import { keyOf, lineId, type Ledger } from "../printed/ledger.ts";
import { isPoolCard } from "../printed/pool.ts";
import { TEMPLATES, type Draft, type TemplateContext } from "./templates.ts";

export type Segment = { card: Card; index: number; side: "front" | "back" | "shadow"; line: string; lineId: string };

export type Unmatched = Segment & { timing: string | null };

// The box's cards (what the scenarios deal and both starter lists) as opposed to the rest of the player pool.
export function boxCodes(campaign: CampaignData | readonly CampaignData[], scenarios: readonly ScenarioData[]): Set<string> {
  return new Set([...dealtCodes(campaign, scenarios), ...starterCodes(campaign)]);
}

// The generated effects file each box card's records are written to: the campaign of the box that prints the scenario
// dealing it (PRODUCT_HOME), else the Fellowship's (its starter lists and prelude).
export function boxOwners(campaigns: readonly CampaignData[], scenarios: readonly ScenarioData[]): Map<string, string> {
  const owners = new Map<string, string>();
  const home = new Map(scenarioDefs().map((def) => [def.id, PRODUCT_HOME[def.product] ?? "fellowship-of-the-ring"]));
  for (const scenario of scenarios) {
    for (const code of dealtCodes([], [scenario])) if (!owners.has(code)) owners.set(code, home.get(scenario.id) ?? "fellowship-of-the-ring");
  }
  for (const code of boxCodes(campaigns, scenarios)) if (!owners.has(code)) owners.set(code, "fellowship-of-the-ring");
  return owners;
}

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

// The printed limits a wrapper reads, by "<times> per <round|phase>" (rr.limits).
const LIMITS: Readonly<Record<string, Limit>> = {
  "once per round": "oncePerRound",
  "once per phase": "oncePerPhase",
  "twice per round": "twicePerRound",
  "twice per phase": "twicePerPhase",
  "3 times per phase": "thricePerPhase",
  "5 times per phase": "fivePerPhase",
};

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
  const named = limited ? LIMITS[`${limited[2]} per ${limited[3]}`] : undefined;
  if (limited && named && Boolean(limited[1]) === Boolean(limited[4])) {
    limit = named;
    rest = rest.slice(0, limited.index);
  }
  return { line: rest, condition, limit };
}

// The phase and the limit go on the record of the Action they were printed on. A record that already has its own condition
// is not one a wrapper can be added to: the line is left to be authored.
function withWrapper(drafts: Draft[], condition: Condition | null, limit: Limit | null): Draft[] | null {
  if (drafts.some((draft) => draft.timing !== "action")) return null;
  if (condition && drafts.some((draft) => draft.condition)) return null;
  return drafts.map((draft) => ({ ...draft, ...(condition ? { condition } : {}), ...(limit ? { limit } : {}) }));
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

// The cards templates read: what the scenarios deal, both starter lists, and every deck-legal player card (user decision,
// 2026-10-26: the whole pool is automated). The ledger passed in holds the pool's lines (withPool).
export function generateEffects(cards: readonly Card[], scenarios: readonly ScenarioData[], campaign: CampaignData | readonly CampaignData[], ledger: Ledger): Generated {
  const wanted = new Set([...dealtCodes(campaign, scenarios), ...starterCodes(campaign), ...cards.filter(isPoolCard).map((card) => card.code)]);
  const scope = cards.filter((card) => wanted.has(card.code)).sort((a, b) => a.code.localeCompare(b.code));
  const setAside = new Set(scenarios.flatMap((scenario) => scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code)));
  const box = boxCodes(campaign, scenarios);
  // A name a box card prints is a box card; a pool card's is a card of its own pack, else the one pool card of that name.
  const codeOf = (reader: Card, name: string): string | null => {
    const among = (list: readonly Card[]): string | null => {
      // The printed text has typos ("Buckleberry Ferry"), so a name may be a letter or two off.
      const exact = list.filter((card) => card.name.toLowerCase() === name.trim().toLowerCase());
      const hits = exact.length > 0 ? exact : list.filter((card) => sameName(card.name, name.trim()));
      return hits.length === 1 ? (hits[0]?.code ?? null) : null;
    };
    if (box.has(reader.code)) return among(scope.filter((card) => box.has(card.code)));
    const pack = reader.printings[0]?.pack;
    return among(scope.filter((card) => card.printings[0]?.pack === pack)) ?? among(scope.filter((card) => !box.has(card.code)));
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
    const context: TemplateContext = { card, codeOf: (name) => codeOf(card, name), setAside };
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

// `name` is the exported constant: GENERATED_EFFECTS for the box's cards, POOL_GENERATED_EFFECTS for the rest of the pool.
export function renderGenerated(effects: readonly Effect[], campaignId: string, name = "GENERATED_EFFECTS"): string {
  const lines = effects.map((effect) => `  ${JSON.stringify(effect)},`);
  return [
    `import type { Effect } from "../../catalog/boundary.ts";`,
    ``,
    `// Written by pnpm data:build from data/cards and data/scenarios (${campaignId}). Do not edit.`,
    `// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.`,
    `export const ${name}: readonly Effect[] = [`,
    ...lines,
    `];`,
    ``,
  ].join("\n");
}
