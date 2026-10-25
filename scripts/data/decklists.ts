// Reads a printed decklist span (data/rules/entries.json, `decklist.*`) into rows. The products print three layouts:
// - "Allies (25)" headings over "2x Name ( 11)" rows, a collector number in the parentheses (the starter inserts, the
//   hero and saga expansion rulebooks); a hero is a bare "Name ( 1)", and "0-3x" is a count the printed conditions choose.
// - "Allies" headings over "Name x2" rows (the saga and Hobbit rulesheets); a parenthesis there qualifies the name.
// - "A l ly ( 1 7)" letter-spaced headings over "3x" then "Name (Product, Product)" (the Community Deck Lists).
// Column extraction can split a row: "3x Daughter of the Nimrodel" over "( 58)", or "Círdan the Shipwright (" with its
// "5)" a few lines later. Those pieces are joined back to their row; a count left with no row fails.

export type Section = "hero" | "ally" | "attachment" | "event" | "player-side-quest";

export type PrintedRow = {
  section: Section;
  // The name as printed, without its parenthesis.
  name: string;
  // The collector number inside the parenthesis, when it is one.
  collector: number | null;
  // The qualifier or product list inside the parenthesis, when it is not a number.
  qualifier: string | null;
  min: number;
  max: number;
};

export type PrintedDecklist = { rows: PrintedRow[]; totals: Map<Section, number> };

const HEADINGS: Readonly<Record<string, Section>> = {
  hero: "hero",
  heroes: "hero",
  ally: "ally",
  allies: "ally",
  attachment: "attachment",
  attachments: "attachment",
  event: "event",
  events: "event",
  sidequest: "player-side-quest",
  sidequests: "player-side-quest",
};

function heading(line: string): { section: Section; total: number | null } | null {
  const match = /^([a-z]+)(?:\((\d+)\))?$/i.exec(line.replace(/\s+/g, ""));
  const section = match ? HEADINGS[(match[1] ?? "").toLowerCase()] : undefined;
  return section ? { section, total: match?.[2] ? Number(match[2]) : null } : null;
}

const COUNT_ONLY = /^(\d+)(?:-(\d+))?x$/;
const COUNT_FIRST = /^(\d+)(?:-(\d+))?x\s+(.+)$/;
const COUNT_LAST = /^(.+?)\s+x(\d+)$/;
const ORPHAN_CLOSE = /^\(?\s*(\d+)\s*\)$/;

function split(body: string): { name: string; collector: number | null; qualifier: string | null } {
  const groups = [...body.matchAll(/\(([^()]*)\)?/g)].map((match) => (match[1] ?? "").trim()).filter((inside) => inside !== "");
  const name = body.replace(/\s*\([^()]*\)?/g, "").trim();
  const number = groups.find((inside) => /^\d+$/.test(inside));
  if (number) return { name, collector: Number(number), qualifier: null };
  return { name, collector: null, qualifier: groups.length > 0 ? groups.join(", ") : null };
}

export function parseDecklist(text: string): PrintedDecklist {
  const totals = new Map<Section, number>();
  const pieces: { section: Section; text: string; min: number; max: number }[] = [];
  let section: Section | null = null;
  let pending: { min: number; max: number } | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const head = heading(line);
    if (head && pending) throw new Error(`Decklist count with no row before ${line}`);
    if (head) {
      section = head.section;
      if (head.total !== null) totals.set(section, head.total);
      continue;
    }
    if (!section) throw new Error(`Decklist row before a heading: ${line}`);
    const countOnly = COUNT_ONLY.exec(line);
    if (countOnly) {
      pending = { min: Number(countOnly[1]), max: Number(countOnly[2] ?? countOnly[1]) };
      continue;
    }
    const orphan = ORPHAN_CLOSE.exec(line);
    if (orphan) {
      // The tail of a row whose collector number wrapped: the latest row left with an open parenthesis, else the last row.
      const open = [...pieces].reverse().find((piece) => piece.text.endsWith("("));
      const target = open ?? pieces.at(-1);
      if (!target) throw new Error(`Decklist collector with no row: ${line}`);
      target.text = `${target.text.replace(/\s*\($/, "")} (${orphan[1]})`;
      continue;
    }
    const last = pieces.at(-1);
    if (line.startsWith("(")) {
      // A product line printed under its row. When a column prints two names before their products ("Círdan the
      // Shipwright", "Erestor", "(The Grey Havens)", "(The Treachery of Rhudaur)"), each goes to the first row of the
      // section still without one.
      const owner = pieces.find((piece) => piece.section === section && !piece.text.includes("("));
      if (!owner) throw new Error(`Decklist product line with no row: ${line}`);
      owner.text = `${owner.text} ${line}`;
      continue;
    }
    const first = COUNT_FIRST.exec(line);
    if (first) {
      pieces.push({ section, text: first[3] ?? "", min: Number(first[1]), max: Number(first[2] ?? first[1]) });
      continue;
    }
    const after = COUNT_LAST.exec(line);
    if (after) {
      pieces.push({ section, text: after[1] ?? "", min: Number(after[2]), max: Number(after[2]) });
      continue;
    }
    if (pending) {
      pieces.push({ section, text: line, ...pending });
      pending = null;
      continue;
    }
    if (section === "hero") {
      pieces.push({ section, text: line, min: 1, max: 1 });
      continue;
    }
    // A row that wrapped onto a second line: "3x King Under the" over "Mountain".
    if (!last || last.section !== section) throw new Error(`Decklist line is not a row: ${line}`);
    last.text = `${last.text} ${line}`;
  }
  if (pending) throw new Error("Decklist ends on a count with no row");
  return { rows: pieces.map((piece) => ({ section: piece.section, ...split(piece.text), min: piece.min, max: piece.max })), totals };
}
