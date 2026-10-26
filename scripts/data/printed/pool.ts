import type { Card } from "../../../src/catalog/card-facts.ts";
import { keyOf, type Ledger, type LedgerEntry } from "./ledger.ts";

// The player pool's printed lines. Every deck-legal player card is automated (user decision, 2026-10-26), and the cards
// outside the box have no scan-read ledger entry: their lines are their source text (RingsDB, Hall of Beorn), written to
// the ledger's conventions (one ability per line, icons as words, no markup). A card the box ledger holds keeps its entry.

export const PLAYER_TYPES: ReadonlySet<string> = new Set(["hero", "ally", "attachment", "event", "player-side-quest", "contract"]);

export function isPoolCard(card: Card): boolean {
  return card.deckLegal && PLAYER_TYPES.has(card.type);
}

const ICONS: Readonly<Record<string, string>> = {
  willpower: "Willpower",
  attack: "Attack",
  defense: "Defense",
  threat: "Threat",
  leadership: "Leadership",
  tactics: "Tactics",
  spirit: "Spirit",
  lore: "Lore",
  fellowship: "Fellowship",
  baggins: "Baggins",
  neutral: "Neutral",
};

const LABEL = "(?:(?:Valour|Planning|Quest|Travel|Encounter|Combat|Refresh|Resource) )?(?:Action|Response|Forced|Setup|Travel|Shadow|When Revealed|Quest Resolution)";

// An ability label in bold that opens a new ability in the middle of a line ("Cannot have attachments. <b>Setup:</b> ...").
// A label inside quotes is granted text, not an ability of this card, so it stays on its line.
function splitAbilities(line: string): string[] {
  const out: string[] = [];
  let rest = line;
  for (;;) {
    const pattern = new RegExp(`([.)!"]) +(<b>${LABEL}:?</b>:?)`, "g");
    let cut = -1;
    for (const match of rest.matchAll(pattern)) {
      const at = (match.index ?? 0) + (match[1]?.length ?? 0);
      const quotes = (rest.slice(0, at).match(/"/g) ?? []).length;
      if (quotes % 2 === 0) {
        cut = at;
        break;
      }
    }
    if (cut < 0) break;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  out.push(rest);
  return out;
}

function plain(line: string): string {
  return line
    .replace(/\[([a-z_]+)\]/gi, (whole, icon: string) => ICONS[icon.toLowerCase()] ?? whole)
    .replace(/<b\.Response:<\/b>/g, "Response:")
    .replace(/<[^>]+>/g, "")
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/^(\w[\w ]*?) :/, "$1:")
    .trim();
}

// A line that ends "gains:" grants the quoted ability on the next line, so the two are one line. A line that is only a
// quotation, or a "–Name" attribution, is flavor text.
export function poolLines(text: string | null | undefined): string[] {
  if (!text) return [];
  const raw = text.split(/\r?\n/).map((line) => line.trim());
  const joined: string[] = [];
  for (const line of raw) {
    const last = joined.at(-1);
    if (last != null && /:\s*$/.test(last) && /^["\u201c]/.test(line)) joined[joined.length - 1] = `${last} ${line}`;
    else joined.push(line);
  }
  return joined
    .filter((line) => !/^["\u201c][^"\u201d]*["\u201d]$/.test(plain(line)) && !/^[\u2013\u2014-]\s*\S/.test(plain(line)))
    .flatMap(splitAbilities)
    .map(plain)
    .filter((line) => line !== "");
}

// Side A and side B of a card whose text holds both ("<b>Side A</b> ... <b>Side B</b> ..."), or its front and back.
export function poolSides(card: Card): { A: string[]; B: string[] } {
  const text = card.text ?? "";
  const marked = /<b>\s*Side A\s*<\/b>|^Side A$/m.test(text) && /<b>\s*Side B\s*<\/b>|^Side B$/m.test(text);
  if (marked) {
    const [front = "", back = ""] = text.replace(/<b>\s*Side A\s*<\/b>|^Side A$/m, "").split(/<b>\s*Side B\s*<\/b>|^Side B$/m);
    return { A: poolLines(front), B: poolLines(back) };
  }
  // shadowText is not read: the one player card that prints a shadow effect (Wind from the Sea, an Encounter card) has it in its text.
  return { A: poolLines(text), B: poolLines(card.back?.text) };
}

function entry(card: Card, side: "A" | "B", lines: string[]): LedgerEntry {
  return {
    code: card.code,
    side,
    printing: card.printings[0]?.pack ?? "RingsDB",
    // Not read from a scan: there is no pinned file. The image the catalog shows is the reference.
    scan: { url: card.printings[0]?.imageUrls?.[0] ?? `https://ringsdb.com/bundles/cards/${card.code}.png`, sha256: "" },
    lines,
    inert: [],
    misprints: [],
    readBy: "card text (RingsDB and Hall of Beorn), not read from a scan",
    confirmedBy: null,
  };
}

// The box ledger plus an entry for each side of every pool card it does not hold.
export function withPool(ledger: Ledger, cards: readonly Card[]): Ledger {
  const entries = [...ledger.entries];
  const byKey = new Map(ledger.byKey);
  for (const card of cards) {
    if (!isPoolCard(card) || byKey.has(keyOf(card.code, "A"))) continue;
    const sides = poolSides(card);
    for (const side of ["A", "B"] as const) {
      if (sides[side].length === 0) continue;
      const made = entry(card, side, sides[side]);
      entries.push(made);
      byKey.set(keyOf(card.code, side), made);
    }
  }
  return { campaign: ledger.campaign, entries, byKey };
}

// Whether a ledger entry was read from a scan (the box) or made from source text (the pool).
export function fromScan(entry: LedgerEntry): boolean {
  return entry.scan.sha256 !== "";
}
