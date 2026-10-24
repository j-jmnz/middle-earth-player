import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PDF_CACHE_DIR } from "../paths.ts";
import { sha256 } from "../sources/fetch.ts";
import { RULE_PDFS } from "../sources/rules.ts";

export type Page = { number: number; text: string };
export type ExtractedDoc = { doc: string; sha256: string; pages: Page[] };

function pageCount(file: string): number {
  const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  const match = /^Pages:\s+(\d+)/m.exec(info);
  if (!match?.[1]) throw new Error(`Cannot read the page count of ${file}`);
  return Number(match[1]);
}

// Reading order, one page at a time. Not -layout: the books are two-column and -layout interleaves them.
export function extractPdf(doc: string, file: string): ExtractedDoc {
  const bytes = readFileSync(file);
  const pages: Page[] = [];
  for (let number = 1; number <= pageCount(file); number += 1) {
    const text = execFileSync("pdftotext", ["-f", String(number), "-l", String(number), file, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    pages.push({ number, text: text.replaceAll("\f", "").replace(/[ \t]+$/gm, "").trim() });
  }
  return { doc, sha256: sha256(bytes), pages };
}

export function renderDoc(extracted: ExtractedDoc): string {
  const body = extracted.pages.map((page) => `## p${page.number} {#${extracted.doc}-p${page.number}}\n\n${page.text}\n`).join("\n");
  return `# ${extracted.doc}\n\nsha256: ${extracted.sha256}\n\n${body}`;
}

export function parseDoc(markdown: string): ExtractedDoc {
  const doc = /^# (.+)$/m.exec(markdown)?.[1] ?? "";
  const hash = /^sha256: ([0-9a-f]+)$/m.exec(markdown)?.[1] ?? "";
  const pages = [...markdown.matchAll(/^## p(\d+) \{#[^}]+\}\n\n([\s\S]*?)(?=\n## p\d+ \{#|(?![\s\S]))/gm)].map((match) => ({ number: Number(match[1]), text: (match[2] ?? "").trim() }));
  return { doc, sha256: hash, pages };
}

// Extracts every cached PDF whose sha256 differs from the committed markdown. Returns the docs, extracted or read back.
export function extractAll(outDir: string, pinned: ReadonlyMap<string, string>): ExtractedDoc[] {
  mkdirSync(path.join(outDir, "rules"), { recursive: true });
  const docs: ExtractedDoc[] = [];
  for (const pdf of RULE_PDFS) {
    const target = path.join(outDir, "rules", `${pdf.doc}.md`);
    const cached = path.join(PDF_CACHE_DIR, pdf.file);
    const wanted = pinned.get(`pdf/${pdf.file}`);
    if (existsSync(cached) && sha256(readFileSync(cached)) === wanted) {
      const committed = existsSync(target) ? parseDoc(readFileSync(target, "utf8")) : null;
      if (committed?.sha256 === wanted) {
        docs.push(committed);
        continue;
      }
      const extracted = extractPdf(pdf.doc, cached);
      writeFileSync(target, renderDoc(extracted));
      docs.push(extracted);
    } else if (existsSync(target)) {
      docs.push(parseDoc(readFileSync(target, "utf8")));
    } else {
      throw new Error(`data/rules/${pdf.doc}.md is missing and ${pdf.file} is not cached. Run pnpm data:sync rules.`);
    }
  }
  return docs;
}
