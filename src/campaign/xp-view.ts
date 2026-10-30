// Rules: dcce.gaining-xp, dcce.scalable-upgradable (data/rules/entries.json). What the Spend XP screen and the log's XP rows show, from the log and the
// boxes the players have picked and not yet marked. Pure: the screen draws these numbers and sends the picks to spendXp.
import type { CampaignLog } from "./log.ts";
import { XP_ROWS, levelOf, markRefusal, marksOf, xpGainedOf, xpSpentOf, xpUnspentOf, type Picks, type XpRow } from "./xp.ts";

export type XpRowView = {
  code: string;
  name: string;
  kind: XpRow["kind"];
  boxes: number;
  // The boxes already marked in the log, and the ones picked now (marked when the players commit).
  marked: number;
  picked: number;
  // A scalable card's level once the picks are marked; null for an upgradable card.
  level: number | null;
  // Every box marked, with the picks counted: a scalable card is at its top level, an upgradable one is upgraded.
  full: boolean;
  // One more box can be picked now, and why not.
  canPick: boolean;
  reason: string | null;
  // What the row says beside its name ("Level 3", "2 of 4", "Upgraded").
  words: string;
  // What a screen reader hears for the row.
  label: string;
};

export type XpView = { gained: number; spent: number; unspent: number; picked: number; left: number; scalable: XpRowView[]; upgradable: XpRowView[] };

function pickedTotal(picks: Picks): number {
  return Object.values(picks).reduce((sum, boxes) => sum + boxes, 0);
}

function wordsOf(row: XpRow, total: number): string {
  if (row.kind === "scalable") return total === 0 ? "Level 0" : `Level ${total}`;
  return total >= row.boxes ? "Upgraded" : `${total} of ${row.boxes}`;
}

function rowView(log: CampaignLog, picks: Picks, row: XpRow): XpRowView {
  const marked = marksOf(log, row.code);
  const picked = picks[row.code] ?? 0;
  const total = marked + picked;
  const reason = markRefusal(log, picks, row.code);
  const words = wordsOf(row, total);
  const pending = picked > 0 ? `, ${picked} to mark` : "";
  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    boxes: row.boxes,
    marked,
    picked,
    level: row.kind === "scalable" ? levelOf(log, row.code) + picked : null,
    full: total >= row.boxes,
    canPick: reason == null,
    reason,
    words,
    label: `${row.name}, ${words}${pending}, ${row.boxes} boxes`,
  };
}

export function xpView(log: CampaignLog, picks: Picks): XpView {
  const picked = pickedTotal(picks);
  const unspent = xpUnspentOf(log);
  const views = XP_ROWS.map((row) => rowView(log, picks, row));
  return {
    gained: xpGainedOf(log),
    spent: xpSpentOf(log),
    unspent,
    picked,
    left: Math.max(0, unspent - picked),
    scalable: views.filter((row) => row.kind === "scalable"),
    upgradable: views.filter((row) => row.kind === "upgradable"),
  };
}

/** The sentence over the commit button: what is picked and that nothing is spent until it is marked. */
export function pickSentence(view: Pick<XpView, "picked" | "left">): string {
  if (view.picked === 0) return view.left === 0 ? "No XP is left to spend." : `${view.left} XP to spend. Pick a card to mark a box beside it.`;
  const boxes = view.picked === 1 ? "1 box" : `${view.picked} boxes`;
  return `${boxes} picked, ${view.left} XP left. Nothing is spent until you mark them.`;
}

/** The log's line for XP: "5 gained, 2 unspent". */
export function xpWords(log: Pick<CampaignLog, "xpGained" | "marks">): string {
  return `${xpGainedOf(log)} gained, ${xpUnspentOf(log)} unspent`;
}

/** The log sheet's lines for the cards that have a box marked: "Command (Leadership) ■■□□", in the sheet's order. */
export function markedLines(log: Pick<CampaignLog, "marks">, kind: XpRow["kind"]): string[] {
  return XP_ROWS.filter((row) => row.kind === kind && marksOf(log, row.code) > 0).map((row) => {
    const marked = Math.min(marksOf(log, row.code), row.boxes);
    return `${row.name} ${"\u25a0".repeat(marked)}${"\u25a1".repeat(row.boxes - marked)}`;
  });
}
