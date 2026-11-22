import type { Condition, Effect, Instruction, Limit } from "../../../src/catalog/boundary.ts";
import type { Card } from "../../../src/catalog/card-facts.ts";
import type { AnyScenarioData, CampaignData } from "../../../src/catalog/scenario-data.ts";
import { selfNamed as selfNamedBy } from "../../../src/catalog/self-named.ts";
import { stripKeywords } from "../normalize/keywords.ts";
import { sameName } from "../normalize/names.ts";
import { CAMPAIGNS, productOf, scenarioDefs } from "../campaign-defs.ts";
import { dealtCodes, gameCodes, starterCodes } from "../load-scenarios.ts";
import { keyOf, lineId, type Ledger } from "../printed/ledger.ts";
import { isPoolCard } from "../printed/pool.ts";
import { TEMPLATES, type Draft, type TemplateContext } from "./templates.ts";

export type Segment = { card: Card; index: number; side: "front" | "back" | "shadow"; line: string; lineId: string };

// `number` is the place the line's record takes in its timing (`<code>:<timing>:<number>`): the number generate reserved for a
// labelled line, and for an unlabelled one (a constant ability, reserved by nothing) the next number at that point.
// `form` is set on an unlabelled line (timing null): the counter its number comes from.
export type Unmatched = Segment & { timing: string | null; number: number; form?: "constant" | "triggered" };

// The box's cards (what the scenarios deal and both starter lists) as opposed to the rest of the player pool.
export function boxCodes(campaign: CampaignData | readonly CampaignData[], scenarios: readonly AnyScenarioData[]): Set<string> {
  return new Set([...dealtCodes(campaign, scenarios), ...starterCodes(campaign)]);
}

// The generated effects file each box card's records are written to: the campaign of the box that prints the scenario
// dealing it (PRODUCTS, scripts/data/campaign-defs.ts), else the Fellowship's (its starter lists and prelude).
export function boxOwners(campaigns: readonly CampaignData[], scenarios: readonly AnyScenarioData[]): Map<string, string> {
  const owners = new Map<string, string>();
  const home = new Map(scenarioDefs().map((def) => [def.id, productOf(def.product).home]));
  for (const scenario of scenarios) {
    for (const code of [...dealtCodes([], [scenario]), ...gameCodes(campaigns, scenario)]) if (!owners.has(code)) owners.set(code, home.get(scenario.id) ?? "fellowship-of-the-ring");
  }
  for (const code of boxCodes(campaigns, scenarios)) if (!owners.has(code)) owners.set(code, "fellowship-of-the-ring");
  return owners;
}

// A line as the templates read it: keywords stripped, the card's own name as {self}, numbers kept. Two lines with the same
// result are the same sentence on different cards.
export function selfNamed(card: Card, line: string): string {
  return selfNamedBy(card.name, line);
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

// A campaign card's Resolution line that the authored records split into several, each with its own `resolution` number
// (The Temple of the Deceived, 11197:B:1: the Starla sentence, then the Recurring Nightmare sentences).
const SPLIT_LINES: Readonly<Record<string, number>> = { "11197:B:1": 2 };

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

// The first template that reads the whole line. `finish` shapes a template's drafts (the wrapper, the event's play cost) and returns null
// when it cannot, in which case the next template is tried.
function readLine(line: string, context: TemplateContext, finish?: (drafts: Draft[]) => Draft[] | null): { drafts: Draft[]; template: string } | null {
  for (const template of TEMPLATES) {
    const match = template.pattern.exec(line);
    const built = match ? template.build(match, context) : null;
    const drafts = built && finish ? finish(built) : built;
    if (drafts) return { drafts, template: template.id };
  }
  return null;
}

// A Shadow of several sentences, each of which is a Shadow line some template reads: one record, the sentences' instructions in
// order ("Attacking enemy gets +1 Attack. Return attacking enemy to the staging area after this attack.").
function shadowBySentence(line: string, context: TemplateContext): { drafts: Draft[]; templates: string[] } | null {
  const sentences = /^Shadow: (.+)$/.exec(line)?.[1]?.split(/(?<=\.)\s+(?=[A-Z])/);
  if (!sentences || sentences.length < 2) return null;
  const instructions: Instruction[] = [];
  const templates: string[] = [];
  for (const sentence of sentences) {
    const read = readLine(`Shadow: ${sentence}`, context);
    const only = read?.drafts.length === 1 ? read.drafts[0] : undefined;
    if (!read || !only || only.timing !== "shadow" || Object.keys(only).some((key) => key !== "timing" && key !== "instructions")) return null;
    instructions.push(...only.instructions);
    templates.push(read.template);
  }
  return { drafts: [{ timing: "shadow", instructions }], templates };
}

// How an unlabelled ability that opens so reads: a triggered one (a conditional or timed sentence), not a constant one.
const TRIGGERED_OPENING = /^(?:If|When|After|Whenever|Each time|Before) /;

// A leading "If <state>, <card> gets +2 ..." names a state and no event: it holds while the state does, so it is constant.
const IF_STATE_STAT = /^If [^,]+, .*\bgets? [+-]\d/;

/** Which counter an unlabelled line numbers from, and so which timing a record for it takes: `triggered` when it opens like one, else `constant`. */
export function unlabelledForm(line: string): "constant" | "triggered" {
  if (IF_STATE_STAT.test(line)) return "constant";
  return TRIGGERED_OPENING.test(line) ? "triggered" : "constant";
}

// A line the ledger marks as needing no record (an inert reason).
function inertLine(ledger: Ledger, segment: Segment): boolean {
  const [, side, at] = segment.lineId.split(":");
  const entry = ledger.byKey.get(keyOf(segment.card.code, side ?? "A"));
  return entry?.inert.some((mark) => mark.line === Number(at)) ?? false;
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
export function generateEffects(cards: readonly Card[], scenarios: readonly AnyScenarioData[], campaign: CampaignData | readonly CampaignData[], ledger: Ledger): Generated {
  const wanted = new Set([...dealtCodes(campaign, scenarios), ...starterCodes(campaign), ...cards.filter(isPoolCard).map((card) => card.code)]);
  const scope = cards.filter((card) => wanted.has(card.code)).sort((a, b) => a.code.localeCompare(b.code));
  const setAside = new Set(scenarios.flatMap((scenario) => scenario.cards.filter((card) => card.pile === "setAside").map((card) => card.code)));
  const box = boxCodes(campaign, scenarios);
  // A campaign whose cards reuse an earlier box's titles (CampaignDef.ownTitles) reads its own cards by name, and no other box's record sees them.
  const owners = boxOwners(Array.isArray(campaign) ? campaign : [campaign as CampaignData], scenarios);
  const ownTitles = new Set(CAMPAIGNS.filter((def) => def.ownTitles).map((def) => def.id));
  const titled = (code: string): boolean => ownTitles.has(owners.get(code) ?? "");
  // A name a box card prints is a box card; a pool card's is a card of its own pack, else the one pool card of that name.
  const codeOf = (reader: Card, name: string): string | null => {
    const among = (list: readonly Card[]): string | null => {
      // The printed text has typos ("Buckleberry Ferry"), so a name may be a letter or two off.
      const exact = list.filter((card) => card.name.toLowerCase() === name.trim().toLowerCase());
      const hits = exact.length > 0 ? exact : list.filter((card) => sameName(card.name, name.trim()));
      return hits.length === 1 ? (hits[0]?.code ?? null) : null;
    };
    if (box.has(reader.code)) return among(scope.filter((card) => box.has(card.code) && (titled(reader.code) ? owners.get(card.code) === owners.get(reader.code) : !titled(card.code))));
    const pack = reader.printings[0]?.pack;
    return among(scope.filter((card) => card.printings[0]?.pack === pack)) ?? among(scope.filter((card) => !box.has(card.code)));
  };

  // The codes of a name among the cards the reader's own scenario deals (its piles and the Campaign Expansion's reprints of them), in
  // numeric order. The other face of a double-sided card is never itself in a pile (the victory display holds the front).
  const codesNamed = (reader: Card, name: string): string[] => {
    const own = scenarios.find((scenario) => scenario.campaignCard === reader.code);
    if (!own) return [];
    const backs = new Set(own.cards.flatMap((card) => (card.back ? [card.back] : [])));
    const dealt = new Set([...own.cards.map((card) => card.code), ...Object.values(own.reprints ?? {})]);
    return scope
      .filter((other) => dealt.has(other.code) && !backs.has(other.code) && other.name.toLowerCase() === name.trim().toLowerCase())
      .map((other) => other.code)
      .sort((x, y) => Number(x) - Number(y));
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
    const unread = new Set<"constant" | "triggered">();
    let lineInert = false;
    const context: TemplateContext = {
      card,
      codeOf: (name) => codeOf(card, name),
      hasName: (name) => scope.some((other) => other.name.toLowerCase() === name.trim().toLowerCase()),
      codesNamed: (name) => codesNamed(card, name),
      setAside,
      unreadBefore: (timing) => unread.has(timing),
      inert: () => lineInert,
    };
    // A campaign card's Resolution runs from its "Resolution:" line to the next label: every line in it that no template reads
    // reserves the next `resolution` number, as the authored records number it (one record per line, `SPLIT_LINES` for a line
    // that takes several). A header line ("Gain the following:") reads as no record and goes onto the first record of the line
    // after it.
    let inResolution = false;
    let header: Segment | null = null;
    for (const segment of segmentsOf(card, ledger)) {
      lineInert = inertLine(ledger, segment);
      const { line, condition, limit } = wrapped(selfNamed(card, segment.line));
      const label = /^([A-Z][A-Za-z ]+?):\s/.exec(line)?.[1]?.toLowerCase();
      if (label) inResolution = card.type === "campaign" && LABEL_TIMING.get(label) === "resolution";
      let drafts: Draft[] | null = null;
      const read = readLine(line, context, (built) => {
        const wrappedDrafts = condition || limit ? withWrapper(built, condition, limit) : built;
        return wrappedDrafts && wrappedDrafts.map((draft) => (card.type === "event" && draft.timing === "response" && !draft.cost ? { ...draft, cost: { kind: "playEvent" as const } } : draft));
      });
      if (read) {
        drafts = read.drafts;
        usage[read.template] = (usage[read.template] ?? 0) + 1;
      }
      if (!drafts && !condition && !limit) {
        const sentences = shadowBySentence(line, context);
        if (sentences) {
          drafts = sentences.drafts;
          for (const id of sentences.templates) usage[id] = (usage[id] ?? 0) + 1;
        }
      }
      if (drafts && drafts.length === 0) {
        // A header: the next line's record owns it. One header after another leaves the first unread.
        if (header) unmatched.push({ ...header, timing: "resolution", number: (counters.get("resolution") ?? 0) + 1 });
        header = segment;
        continue;
      }
      const carried = header;
      header = null;
      if (drafts) {
        const owned = carried !== null && drafts[0]?.timing === "resolution";
        if (carried && !owned) unmatched.push({ ...carried, timing: "resolution", number: (counters.get("resolution") ?? 0) + 1 });
        drafts.forEach((draft, at) => effects.push({ id: `${card.code}:${draft.timing}:${next(draft.timing)}`, cardCode: card.code, lines: at === 0 && owned && carried ? [carried.lineId, segment.lineId] : [segment.lineId], ...draft }));
        continue;
      }
      const timing = ((label === "setup" && card.type === "campaign" ? "campaignSetup" : label ? LABEL_TIMING.get(label) : undefined)) ?? (inResolution ? "resolution" : null);
      // A labelled line that no template reads keeps its number, so the authored record that replaces it lines up.
      const form = unlabelledForm(line);
      const number = timing ? next(timing) : (counters.get(form) ?? 0) + 1;
      if (timing === "resolution") for (let extra = 1; extra < (SPLIT_LINES[segment.lineId] ?? 1); extra += 1) next(timing);
      if (carried) unmatched.push({ ...carried, timing: "resolution", number });
      unmatched.push({ ...segment, timing, number, ...(timing === null ? { form } : {}) });
      if (timing === null && !lineInert) unread.add(form);
    }
    if (header) unmatched.push({ ...header, timing: "resolution", number: (counters.get("resolution") ?? 0) + 1 });
  }
  return { effects, unmatched, usage };
}

// `name` is the exported constant: GENERATED_EFFECTS for the box's cards, POOL_GENERATED_EFFECTS for the rest of the pool.
export function renderGenerated(effects: readonly Effect[], campaignId: string, name = "GENERATED_EFFECTS"): string {
  const lines = effects.map((effect) => `  ${JSON.stringify(effect)},`);
  return [
    `import type { Effect } from "../../catalog/boundary.ts";`,
    ``,
    `// Written by pnpm data build from data/cards and data/scenarios (${campaignId}). Do not edit.`,
    `// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.`,
    `export const ${name}: readonly Effect[] = [`,
    ...lines,
    `];`,
    ``,
  ].join("\n");
}
