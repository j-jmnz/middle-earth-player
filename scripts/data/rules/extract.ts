import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PDF_CACHE_DIR } from "../paths.ts";
import { sha256 } from "../sources/fetch.ts";
import { RULE_PDFS } from "../sources/rules.ts";

// A page is read one column at a time: `pdftotext -x -y -W -H` over each column box. Full-page extraction
// interleaves the two columns of the books. The boxes are recorded per document in data/rules/columns.json:
// a default for every page and an override for a page that lays out differently.
export type Box = { x: number; y: number; w: number; h: number };
// `only` limits extraction to those pages: a product insert whose decklist page is all that is read.
export type DocColumns = { default: Box[]; pages?: Record<string, Box[]>; only?: number[] };
export type ColumnsFile = Record<string, DocColumns>;

export type Page = { number: number; columns: string[] };
export type ExtractedDoc = { doc: string; sha256: string; columnsSha256: string; pages: Page[] };

export function boxesFor(columns: DocColumns, page: number): Box[] {
  return columns.pages?.[String(page)] ?? columns.default;
}

export function hashColumns(columns: DocColumns): string {
  return sha256(JSON.stringify({ columns, glyphs: ICON_GLYPHS }));
}

// The books print stat icons as font glyphs that pdftotext emits as stray letters: Ú is the defense icon and so on.
// They are written as [icon] tokens so a span never holds a letter that is really a picture. The map is part of the
// extraction hash, so changing it re-extracts every document.
export const ICON_GLYPHS: Readonly<Record<string, string>> = { "Ú": "[defense]", "Û": "[attack]", "Ò": "[willpower]", $: "[threat]", "‰": "[unique]" };

function pageCount(file: string): number {
  const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  const match = /^Pages:\s+(\d+)/m.exec(info);
  if (!match?.[1]) throw new Error(`Cannot read the page count of ${file}`);
  return Number(match[1]);
}

function clean(text: string): string {
  return text.replace(/[ÚÛÒ$‰]/g, (glyph) => ICON_GLYPHS[glyph] ?? glyph).replaceAll("\f", "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractPdf(doc: string, file: string, columns: DocColumns): ExtractedDoc {
  const bytes = readFileSync(file);
  const pages: Page[] = [];
  const count = pageCount(file);
  for (const number of columns.only ?? Array.from({ length: count }, (_, at) => at + 1)) {
    if (number > count) throw new Error(`${doc} has no page ${number}`);
    const texts = boxesFor(columns, number).map((box) =>
      clean(
        execFileSync(
          "pdftotext",
          ["-f", String(number), "-l", String(number), "-x", String(box.x), "-y", String(box.y), "-W", String(box.w), "-H", String(box.h), file, "-"],
          { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
        ),
      ),
    );
    pages.push({ number, columns: texts });
  }
  return { doc, sha256: sha256(bytes), columnsSha256: hashColumns(columns), pages };
}

export function renderDoc(extracted: ExtractedDoc): string {
  const body = extracted.pages
    .map((page) => `## p${page.number}\n\n${page.columns.map((text, at) => `### p${page.number} c${at + 1}\n\n${text}\n`).join("\n")}`)
    .join("\n");
  return `# ${extracted.doc}\n\nsha256: ${extracted.sha256}\ncolumns: ${extracted.columnsSha256}\n\n${body}`;
}

export function parseDoc(markdown: string): ExtractedDoc {
  const doc = /^# (.+)$/m.exec(markdown)?.[1] ?? "";
  const hash = /^sha256: ([0-9a-f]+)$/m.exec(markdown)?.[1] ?? "";
  const columnsHash = /^columns: ([0-9a-f]+)$/m.exec(markdown)?.[1] ?? "";
  const pages = new Map<number, string[]>();
  for (const match of markdown.matchAll(/^### p(\d+) c(\d+)\n\n([\s\S]*?)(?=\n### p\d+ c\d+\n|\n## p\d+\n|(?![\s\S]))/gm)) {
    const number = Number(match[1]);
    const list = pages.get(number) ?? [];
    list[Number(match[2]) - 1] = (match[3] ?? "").trim();
    pages.set(number, list);
  }
  return { doc, sha256: hash, columnsSha256: columnsHash, pages: [...pages].sort(([a], [b]) => a - b).map(([number, columns]) => ({ number, columns })) };
}

export function parseColumns(json: string): ColumnsFile {
  return JSON.parse(json) as ColumnsFile;
}

// Extracts every cached PDF whose sha256 or column boxes differ from the committed markdown. Returns the docs,
// extracted or read back. Without the PDFs (a clean clone, CI) the committed markdown is the source.
export function extractAll(outDir: string, pinned: ReadonlyMap<string, string>, columnsFile: ColumnsFile): ExtractedDoc[] {
  mkdirSync(path.join(outDir, "rules"), { recursive: true });
  const docs: ExtractedDoc[] = [];
  for (const pdf of RULE_PDFS) {
    const target = path.join(outDir, "rules", `${pdf.doc}.md`);
    const cached = path.join(PDF_CACHE_DIR, pdf.file);
    const wanted = pinned.get(`pdf/${pdf.file}`);
    const columns = columnsFile[pdf.doc];
    if (!columns) throw new Error(`data/rules/columns.json has no boxes for ${pdf.doc}`);
    const committed = existsSync(target) ? parseDoc(readFileSync(target, "utf8")) : null;
    if (committed && committed.sha256 === wanted && committed.columnsSha256 === hashColumns(columns)) {
      docs.push(committed);
    } else if (existsSync(cached) && sha256(readFileSync(cached)) === wanted) {
      const extracted = extractPdf(pdf.doc, cached, columns);
      writeFileSync(target, renderDoc(extracted));
      docs.push(extracted);
    } else {
      throw new Error(`data/rules/${pdf.doc}.md is stale or missing and ${pdf.file} is not cached. Run pnpm data:sync rules.`);
    }
  }
  return docs;
}
