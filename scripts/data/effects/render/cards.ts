// One card as the reading aid prints it: the card, each printed ledger line, and the records that name the line rendered in English beneath it.
// A line no record names, and a record that names no line of the card, are shown as such; a line owned by the card's keywords or by the scenario's piles says so. The text is a reading aid, not a gate.
import type { Effect } from "../../../../src/catalog/boundary.ts";
import type { Card } from "../../../../src/catalog/card-facts.ts";
import { stripKeywords } from "../../normalize/keywords.ts";
import type { Segment } from "../generate.ts";
import { newCtx, type Obj, type Tally } from "./kit.ts";
import { checkLines } from "./checks.ts";
import { renderRecord } from "./record.ts";

export type CardRender = { text: string; tally: Tally };

// `rawLines`: every printed ledger line of the card in order (the ones generate.ts drops as keyword-only included). `pile`: where the scenario deals the card (encounter, quest, staging...), which places it with no record. `perPlayer`: the pile places that many copies for each player (the other copies stay in the encounter deck).
export type CardExtras = { rawLines?: readonly { lineId: string; line: string }[]; pile?: string; perPlayer?: number; finalStage?: boolean; checks?: boolean; nameOf?: (code: string) => string | undefined };

// `checks`: print under each line the checks that apply to it (checks.ts), which the reading judge answers.
// `inert`: the ledger line ids marked inert (a reminder or keyword the engine applies by rule), which need no record.
export function renderCard(card: Card, segments: readonly Segment[], effects: readonly Effect[], inert: ReadonlySet<string>, extras: CardExtras = {}): CardRender {
  const own = effects.filter((effect) => effect.cardCode === card.code);
  const rows = extras.rawLines ?? segments.map((segment) => ({ lineId: segment.lineId, line: segment.line }));
  const ctx = newCtx({ effects: effects as unknown as readonly Obj[], cardName: card.name, cardType: card.type, lineTexts: new Map(rows.map((row) => [row.lineId, row.line])), ...(extras.nameOf ? { nameOf: extras.nameOf } : {}), ...(extras.finalStage ? { finalStage: true } : {}) });
  const known = new Set(segments.map((segment) => segment.lineId));
  const bySegment = new Map(segments.map((segment) => [segment.lineId, segment]));
  const out: string[] = [`## ${card.code} ${card.name}`];
  if (extras.pile) {
    const each = extras.perPlayer != null ? `, ${extras.perPlayer} cop${extras.perPlayer === 1 ? "y" : "ies"} for each player, the other copies stay in the encounter deck` : "";
    out.push(`(the scenario deals it into the ${extras.pile} pile${each}; the piles place it, no record does)`);
  }
  for (const row of rows) {
    const segment = bySegment.get(row.lineId);
    out.push("", `${row.lineId}${segment ? ` (${segment.side})` : ""}: ${row.line}`);
    if (!segment) {
      out.push("  (keyword line: the card's keywords own it, read by the engine from the card; no record)");
      continue;
    }
    if (stripKeywords(segment.line) !== segment.line) out.push(`  (the keyword part is owned by the card's keywords; the records cover: ${stripKeywords(segment.line)})`);
    const owners = own.filter((effect) => effect.lines.includes(row.lineId));
    if (owners.length === 0) out.push(inert.has(row.lineId) ? "  (inert: the engine applies it by rule, no record)" : "  NO RECORD NAMES THIS LINE");
    for (const effect of owners) {
      const shared = effect.lines.length > 1 ? ` (record also names ${effect.lines.filter((id) => id !== row.lineId).join(", ")})` : "";
      out.push(...renderRecord(effect as unknown as Obj, ctx).map((line, at) => `  ${line}${at === 0 ? shared : ""}`));
    }
    if (extras.checks) out.push(...checkLines(row.line, owners));
  }
  const stray = own.filter((effect) => !effect.lines.some((id) => known.has(id)));
  for (const effect of stray) out.push("", `RECORD NAMING NO LINE OF THIS CARD (${effect.lines.join(", ")})`, ...renderRecord(effect as unknown as Obj, ctx).map((line) => `  ${line}`));
  return { text: out.join("\n"), tally: ctx.tally };
}
