// Rules: dcce.gaining-xp, dcce.scalable-upgradable, dcce.hard-expert (data/rules/entries.json). The Dream-chaser Campaign Log's XP: what a
// won scenario's Resolution awards, the scalable and upgradable cards the players spend it on, and what the game reads back (a scalable
// card's level, an upgraded card's Upgraded side). Pure. The players choose where each XP goes: nothing here spends XP for them.
import type { CampaignLog } from "./log.ts";
import type { Save } from "./save.ts";

/** The Hard/Expert Mode card (collector 217): side A is Hard, side B is Expert. Its Resolution gains 1 or 2 XP (dcce.hard-expert). */
export type ModeCard = "hard" | "expert";
export const MODE_CARDS: readonly ModeCard[] = ["hard", "expert"];
export const MODE_CARD_CODE = "11217";
export const MODE_CARD_SIDE: Readonly<Record<ModeCard, "A" | "B">> = { hard: "A", expert: "B" };
export const MODE_CARD_NAME: Readonly<Record<ModeCard, string>> = { hard: "Hard", expert: "Expert" };

/**
 * A row of the Campaign Log sheet (MEC111 p31): a card with checkboxes beside its title. One XP marks one box.
 * `scalable`: its level is the boxes marked, which its X reads. `upgradable`: once every box is marked it is dealt on its Upgraded side
 * for the rest of the campaign (a burden's Upgraded side is the weaker one). A row is keyed by the code the campaign deals, which is the
 * Campaign Expansion's reprint (110NNN) where the box reprints the card. `from`: the scenario that must be completed before a box is marked.
 */
export type XpRow = { code: string; name: string; kind: "scalable" | "upgradable"; boxes: number; from?: string };

// The sheet's order: Leadership, Lore, Spirit and Tactics for a card printed in four spheres. Each sphere is its own card (its own code), and
// the codes do not follow one order from card to card. The box counts are the sheet's; each upgradable card's XP cost, printed at the foot
// of its Upgraded side, equals them (the ledger records it).
export const XP_ROWS: readonly XpRow[] = [
  { code: "11205", name: "Círdan's Blessing (Leadership)", kind: "scalable", boxes: 5 },
  { code: "11208", name: "Círdan's Blessing (Lore)", kind: "scalable", boxes: 5 },
  { code: "11207", name: "Círdan's Blessing (Spirit)", kind: "scalable", boxes: 5 },
  { code: "11206", name: "Círdan's Blessing (Tactics)", kind: "scalable", boxes: 5 },
  { code: "11195", name: "Come Together", kind: "scalable", boxes: 5 },
  { code: "11201", name: "Command (Leadership)", kind: "scalable", boxes: 4 },
  { code: "11202", name: "Command (Lore)", kind: "scalable", boxes: 4 },
  { code: "11203", name: "Command (Spirit)", kind: "scalable", boxes: 4 },
  { code: "11204", name: "Command (Tactics)", kind: "scalable", boxes: 4 },
  { code: "11184", name: "Galdor's Counsel (Leadership)", kind: "scalable", boxes: 5 },
  { code: "11187", name: "Galdor's Counsel (Lore)", kind: "scalable", boxes: 5 },
  { code: "11186", name: "Galdor's Counsel (Spirit)", kind: "scalable", boxes: 5 },
  { code: "11185", name: "Galdor's Counsel (Tactics)", kind: "scalable", boxes: 5 },
  { code: "11198", name: "Starla", kind: "scalable", boxes: 5 },
  { code: "11172", name: "Armor Plating", kind: "upgradable", boxes: 2 },
  { code: "11173", name: "Ballista", kind: "upgradable", boxes: 2 },
  { code: "11183", name: "Black Key (boon)", kind: "upgradable", boxes: 4 },
  { code: "11192", name: "Black Key (burden)", kind: "upgradable", boxes: 5 },
  { code: "11193", name: "Calaerion", kind: "upgradable", boxes: 5 },
  { code: "110013", name: "Calphon", kind: "upgradable", boxes: 2 },
  { code: "110137", name: "Dawn Star", kind: "upgradable", boxes: 4 },
  { code: "110102", name: "Dol Amroth Warship", kind: "upgradable", boxes: 3 },
  { code: "110136", name: "Dream-chaser (ship-objective)", kind: "upgradable", boxes: 4 },
  { code: "11039", name: "Dream-chaser (location)", kind: "upgradable", boxes: 2 },
  { code: "110138", name: "Duskbringer", kind: "upgradable", boxes: 4 },
  { code: "11174", name: "Enlarged Quarters", kind: "upgradable", boxes: 2 },
  { code: "11175", name: "Extra Sails", kind: "upgradable", boxes: 2 },
  { code: "110078", name: "Gate Key", kind: "upgradable", boxes: 2 },
  // Gavin comes back by spending 4 XP on him at the Resolution of A Storm on Cobas Haven (11209: "The players may spend 4 XP on Gavin to record in
  // the Campaign Log that 'Gavin returned.'"): "Gavin returned" is his four boxes marked, and they are marked after that scenario.
  { code: "11210", name: "Gavin", kind: "upgradable", boxes: 4, from: "a-storm-on-cobas-haven" },
  { code: "110139", name: "Glórinaith", kind: "upgradable", boxes: 4 },
  { code: "110140", name: "Nárelenya", kind: "upgradable", boxes: 4 },
  { code: "11189", name: "Parrying Cutlass", kind: "upgradable", boxes: 5 },
  { code: "11211", name: "Send for Help (Leadership)", kind: "upgradable", boxes: 3 },
  { code: "11214", name: "Send for Help (Lore)", kind: "upgradable", boxes: 2 },
  { code: "11213", name: "Send for Help (Spirit)", kind: "upgradable", boxes: 4 },
  { code: "11212", name: "Send for Help (Tactics)", kind: "upgradable", boxes: 3 },
  { code: "110141", name: "Silver Wing", kind: "upgradable", boxes: 4 },
  { code: "11180", name: "Spyglass", kind: "upgradable", boxes: 3 },
  { code: "11216", name: "The Black Sword", kind: "upgradable", boxes: 5 },
  { code: "11038", name: "The Havens Burn", kind: "upgradable", boxes: 2 },
  { code: "110129", name: "The Shattered Monument", kind: "upgradable", boxes: 2 },
  { code: "11190", name: "Throwing Axe", kind: "upgradable", boxes: 5 },
];

const GAVIN = "11210";
const BY_CODE: ReadonlyMap<string, XpRow> = new Map(XP_ROWS.map((row) => [row.code, row]));

export function xpRowOf(code: string): XpRow | null {
  return BY_CODE.get(code) ?? null;
}

/** The boxes marked beside a card. */
export function marksOf(log: Pick<CampaignLog, "marks">, code: string): number {
  return log.marks[code] ?? 0;
}

/** Every XP the won scenarios awarded. */
export function xpGainedOf(log: Pick<CampaignLog, "xpGained">): number {
  return Object.values(log.xpGained).reduce((sum, amount) => sum + amount, 0);
}

/** Every box marked: one XP each. */
export function xpSpentOf(log: Pick<CampaignLog, "marks">): number {
  return Object.values(log.marks).reduce((sum, boxes) => sum + boxes, 0);
}

/** The XP gained and not yet spent (the sheet's XP Unspent). Derived from the two lists above, so it can never drift from them. */
export function xpUnspentOf(log: Pick<CampaignLog, "xpGained" | "marks">): number {
  return Math.max(0, xpGainedOf(log) - xpSpentOf(log));
}

/** A scalable card's level: the boxes marked beside it, which its X reads (dcce.scalable-upgradable). */
export function levelOf(log: Pick<CampaignLog, "marks">, code: string): number {
  return xpRowOf(code)?.kind === "scalable" ? marksOf(log, code) : 0;
}

/** An upgradable card is upgraded once every box beside it is marked: its Upgraded side is dealt from then on. */
export function isUpgraded(log: Pick<CampaignLog, "marks">, code: string): boolean {
  const row = xpRowOf(code);
  return row != null && row.kind === "upgradable" && marksOf(log, code) >= row.boxes;
}

/** "Gavin returned": the players spent 4 XP on him (A Storm on Cobas Haven's Resolution), which The City of Corsairs' Setup reads. */
export function gavinReturned(log: Pick<CampaignLog, "marks">): boolean {
  return isUpgraded(log, GAVIN);
}

/** The levels and upgrades the engine reads (CampaignFacts), each left out while it has none. */
export function xpFacts(log: Pick<CampaignLog, "marks">): { levels?: Readonly<Record<string, number>>; upgraded?: readonly string[] } {
  const levels = Object.fromEntries(XP_ROWS.flatMap((row) => (row.kind === "scalable" && marksOf(log, row.code) > 0 ? [[row.code, marksOf(log, row.code)] as const] : [])));
  const upgraded = XP_ROWS.filter((row) => isUpgraded(log, row.code)).map((row) => row.code);
  return { ...(Object.keys(levels).length > 0 ? { levels } : {}), ...(upgraded.length > 0 ? { upgraded } : {}) };
}

/** The boxes the players have picked to mark and not yet committed: extra marks by row code, kept by the Spend XP screen. */
export type Picks = Readonly<Record<string, number>>;

function pickedCount(picks: Picks): number {
  return Object.values(picks).reduce((sum, boxes) => sum + boxes, 0);
}

/** Why one more box beside this card cannot be marked now, or null when it can. */
export function markRefusal(log: CampaignLog, picks: Picks, code: string): string | null {
  const row = xpRowOf(code);
  if (!row) return "That card has no boxes in the Campaign Log";
  if (row.from != null && !log.completed.includes(row.from)) return `${row.name} is marked after ${row.from.replaceAll("-", " ")} is completed`;
  if (marksOf(log, code) + (picks[code] ?? 0) >= row.boxes) return `Every box beside ${row.name} is marked`;
  if (xpUnspentOf(log) - pickedCount(picks) <= 0) return "No XP is left to spend";
  return null;
}

/** One more box picked beside the card, or the picks as they were when none can be. */
export function pick(log: CampaignLog, picks: Picks, code: string): Picks {
  return markRefusal(log, picks, code) == null ? { ...picks, [code]: (picks[code] ?? 0) + 1 } : picks;
}

/** One pick taken back. A pick is a draft: nothing is spent until it is committed. */
export function unpick(picks: Picks, code: string): Picks {
  const have = picks[code] ?? 0;
  if (have <= 0) return picks;
  const { [code]: _taken, ...rest } = picks;
  return have > 1 ? { ...rest, [code]: have - 1 } : rest;
}

export type Spent = { ok: true; log: CampaignLog } | { ok: false; reason: string };

/**
 * Marks the picked boxes, one XP each (dcce.scalable-upgradable). Refuses a pick the sheet does not allow: more boxes than the card has, more
 * XP than is unspent, a card that is not on the sheet. Nothing is chosen for the players: an empty pick changes nothing.
 */
export function spendXp(log: CampaignLog, picks: Picks): Spent {
  let drafted: Picks = {};
  for (const [code, boxes] of Object.entries(picks)) {
    for (let box = 0; box < boxes; box += 1) {
      const refusal = markRefusal(log, drafted, code);
      if (refusal != null) return { ok: false, reason: refusal };
      drafted = { ...drafted, [code]: (drafted[code] ?? 0) + 1 };
    }
  }
  const marks = { ...log.marks };
  for (const [code, boxes] of Object.entries(drafted)) marks[code] = marksOf(log, code) + boxes;
  return { ok: true, log: { ...log, marks } };
}

/** Spends XP on a save: only before or after a scenario, so never while one is open (dcce.scalable-upgradable). */
export function spendOnSave(save: Save, picks: Picks): { ok: true; save: Save } | { ok: false; reason: string } {
  if (save.active) return { ok: false, reason: "XP is spent only before or after a scenario" };
  const spent = spendXp(save.log, picks);
  return spent.ok ? { ok: true, save: { ...save, log: spent.log } } : spent;
}

/** What a won scenario writes for its XP: the Resolution's lines added up, never below 0 (the log cannot take XP back). */
export function xpAwarded(total: number): number {
  return Math.max(0, total);
}
