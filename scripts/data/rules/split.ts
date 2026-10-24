import type { ExtractedDoc } from "./extract.ts";

export type RuleEntry = {
  id: string;
  doc: string;
  page: number;
  title: string;
  text: string;
  terms: string[];
};

const CONNECTORS = new Set(["the", "and", "of", "a", "an", "to", "in", "or", "for", "on", "simultaneous"]);

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Line = { text: string; page: number };

function isHeading(lines: readonly Line[], index: number): boolean {
  const line = lines[index]?.text.trim() ?? "";
  const before = lines[index - 1]?.text.trim() ?? "";
  const after = lines[index + 1]?.text.trim() ?? "";
  if (line === "" || before !== "" || after === "") return false;
  if (line.split(/\s+/).length > 7 || !/^[A-Z]/.test(line)) return false;
  if (/[.,:;”“?!]$/.test(line) || /^(See|See also|ACTION WINDOW|Appendix)/.test(line)) return false;
  if (line === line.toUpperCase() || /^[IVX]+\.\s/.test(line) || /^\d+$/.test(line)) return false;
  if (/^[“—‘'"]/.test(line)) return false;
  // A wrapped sentence, not a title: the next line continues in lower case, or a quote is left open.
  if (/^[a-z]/.test(after) || (line.match(/[“”]/g)?.length ?? 0) % 2 === 1) return false;
  return true;
}

// Heading text wraps ("Attacks Outside the / Combat Phase"): join while the line ends on a connector.
function headingAt(lines: readonly Line[], index: number): { title: string; next: number } {
  let title = lines[index]?.text.trim() ?? "";
  let next = index + 1;
  while (title.includes(" ") && CONNECTORS.has(title.split(/\s+/).at(-1)?.toLowerCase() ?? "") && lines[next] && lines[next]?.text.trim() !== "") {
    title = `${title} ${lines[next]?.text.trim() ?? ""}`;
    next += 1;
  }
  return { title, next };
}

function termsOf(title: string): string[] {
  const parts = title.split(/\s*[,/]\s*/).map((part) => part.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase());
  return [...new Set([title.toLowerCase(), ...parts].filter((term) => term !== ""))];
}

function uniqueId(base: string, seen: Map<string, number>): string {
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function flatten(doc: ExtractedDoc, from: number, to: number): Line[] {
  return doc.pages
    .filter((page) => page.number >= from && page.number <= to)
    .flatMap((page) => page.text.split("\n").map((text) => ({ text, page: page.number })));
}

function headed(doc: ExtractedDoc, prefix: string, lines: readonly Line[], seen: Map<string, number>): RuleEntry[] {
  const found: { title: string; page: number; at: number; start: number }[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isHeading(lines, index)) continue;
    const { title, next } = headingAt(lines, index);
    found.push({ title, page: lines[index]?.page ?? 1, at: index, start: next });
    index = next - 1;
  }
  return found.map((heading, position) => {
    const end = found[position + 1]?.at ?? lines.length;
    const body = lines
      .slice(heading.start, end)
      .map((line) => line.text)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { id: uniqueId(`${prefix}.${slug(heading.title)}`, seen), doc: doc.doc, page: heading.page, title: heading.title, text: body, terms: termsOf(heading.title) };
  });
}

// Rules Reference "Framework Details": "1.1 Resource phase begins" and a paragraph or two under each.
function frameworkSteps(doc: ExtractedDoc, seen: Map<string, number>): RuleEntry[] {
  const lines = flatten(doc, 22, 26);
  const start = lines.findIndex((line) => line.text.startsWith("Each of the following entries"));
  const entries: RuleEntry[] = [];
  let current: { number: string; title: string; page: number; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const text = current.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    entries.push({
      id: uniqueId(`rr.step-${current.number.replaceAll(".", "-")}`, seen),
      doc: doc.doc,
      page: current.page,
      title: `${current.number} ${current.title}`,
      text,
      terms: [current.number, current.title.toLowerCase()],
    });
    current = null;
  };
  for (const line of lines.slice(start + 1)) {
    const match = /^(\d\.\d+[a-z]?)\s+([A-Z].*)$/.exec(line.text.trim());
    if (match?.[1] && match[2]) {
      flush();
      current = { number: match[1], title: match[2], page: line.page, body: [] };
    } else if (/^[IVX]+\.\s+[A-Z][a-z]+ [Pp]hase$/.test(line.text.trim())) {
      flush();
    } else current?.body.push(line.text);
  }
  flush();
  return entries;
}

export function splitEntries(docs: readonly ExtractedDoc[]): RuleEntry[] {
  const entries: RuleEntry[] = [];
  for (const doc of docs) {
    const seen = new Map<string, number>();
    const last = doc.pages.at(-1)?.number ?? 1;
    if (doc.doc === "rr") {
      entries.push(...headed(doc, "rr", flatten(doc, 2, 19), seen));
      const framework = doc.pages.filter((page) => page.number === 20 || page.number === 21).map((page) => page.text).join("\n\n");
      entries.push({ id: "rr.framework-steps", doc: "rr", page: 20, title: "Framework Steps", text: framework, terms: ["framework steps", "round sequence"] });
      entries.push(...frameworkSteps(doc, seen));
      entries.push(...headed(doc, "rr", flatten(doc, 27, 33), seen));
    } else {
      entries.push(...headed(doc, doc.doc === "learn-to-play" ? "ltp" : doc.doc, flatten(doc, 1, last), seen));
    }
  }
  return entries;
}
