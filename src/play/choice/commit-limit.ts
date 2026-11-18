// Rules: ltp.commit-characters, rr.cannot (data/rules/entries.json); ledger line 04118:B:2.
// The commit sheet under a table that lets a player commit no more allies than heroes (Out of the Depths): a tap that would break it is refused with the engine's words, the ally rows
// are listed as refused while no hero picked has room, the note counts what is picked, and unpicking a hero names the allies it puts back. The reducer's own refusal stays the last word.
import { commitCounts, commitLimitReason } from "../../rules/families/play/commit-limit.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import type { Sheet, SheetNames, SheetOption, Unavailable } from "./sheet-types.ts";
import type { Choice, TapContext, TapResult } from "./table-choice.ts";

/** The set a tap on a character leaves picked, the allies it put back, or why the tap is refused. */
export type CommitToggle = { ids: readonly string[]; dropped: readonly string[] } | { refused: string };

/**
 * A tap on a character of a commit: the set offered stays one the reducer accepts. A tap that would break the limit is refused with its reason, and unpicking a hero also drops the last allies picked
 * that it leaves over.
 */
export function toggleCommit(ids: readonly string[], id: string, table: TapContext): CommitToggle {
  const reason = (set: readonly string[]) => commitLimitReason(table.game, table.game.activeSeat, set, table.ctx.cards);
  if (!ids.includes(id)) {
    const added = [...ids, id];
    const refused = reason(added);
    return refused != null ? { refused } : { ids: added, dropped: [] };
  }
  const kept = ids.filter((item) => item !== id);
  if (reason(kept) == null) return { ids: kept, dropped: [] };
  // Drop the allies picked last until the rest is legal (only allies can break the limit).
  const trimmed = [...kept];
  const dropped: string[] = [];
  while (trimmed.length > 0 && reason(trimmed) != null) {
    const last = trimmed.findLastIndex((item) => table.game.cards[item]?.zone !== "heroes");
    if (last < 0) break;
    dropped.push(...trimmed.splice(last, 1));
  }
  return { ids: trimmed, dropped };
}

/** A tap on a character of a commit as the table answers it: the choice (with what it put back, said on the dock) or the refusal. */
export function commitTap(choice: Choice, id: string, table: TapContext): TapResult {
  const toggled = toggleCommit(choice.ids, id, table);
  if ("refused" in toggled) return { kind: "refused", reason: toggled.refused };
  const back = toggled.dropped.map((item) => table.names.card(item));
  const said = back.length > 0 ? `${back.join(" and ")} ${back.length === 1 ? "goes" : "go"} back: a player cannot commit more allies than the heroes he commits.` : null;
  return { kind: "choice", choice: { ...choice, ids: toggled.ids }, ...(said ? { said } : {}) };
}

// The rows of a commit the sheet offers: a commit sheet's own, or the commit window's.
function commitOptions(sheet: Sheet): readonly SheetOption[] {
  if (sheet.kind === "window") return sheet.commit?.options ?? [];
  return sheet.kind === "multi" && sheet.build.kind === "Commit" ? sheet.options : [];
}

const counted = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * What the limit adds to a commit: the note's sentence with the count picked, and the ally rows that cannot be picked now (no hero picked has room), each with the engine's reason. Nothing while
 * the table holds no limit.
 */
export function commitLimitWords(game: ScenarioState, ctx: ReduceContext, sheet: Sheet, ids: readonly string[], names: SheetNames): { note: string; refused: readonly Unavailable[] } | null {
  const options = commitOptions(sheet);
  const counts = options.length > 0 ? commitCounts(game, game.activeSeat, ids, ctx.cards) : null;
  if (!counts) return null;
  const refused: Unavailable[] = [];
  for (const item of options) {
    if (ids.includes(item.id)) continue;
    const reason = commitLimitReason(game, game.activeSeat, [...ids, item.id], ctx.cards);
    if (reason != null) refused.push({ id: item.id, label: item.label, code: item.code, reason });
  }
  return { note: `${names.card(counts.source)}: no more allies than heroes (${counted(counts.heroes, "hero", "heroes")}, ${counted(counts.allies, "ally", "allies")} picked).`, refused };
}
