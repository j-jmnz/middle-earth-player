import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PDF_CACHE_DIR } from "../paths.ts";
import { bytes, createLog, type Log } from "../../log.ts";
import { combinedPin, fetchBytes, sha256, type SourceFile, type SourceRecord } from "./fetch.ts";

const FFG = "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09";

export const RULE_PDFS = [
  { doc: "mec109", file: "mec109_rulebook-compressed.pdf", url: `${FFG}/mec109_rulebook-compressed.pdf` },
  { doc: "learn-to-play", file: "mec101_learn_to_play_eng_v11-compressed.pdf", url: `${FFG}/mec101_learn_to_play_eng_v11-compressed.pdf` },
  { doc: "rr", file: "mec101_rules_reference.pdf", url: "https://hallofbeorn-resources.s3.amazonaws.com/Images/LotR/Rules/MEC101.pdf" },
  // The Dark of Mirkwood's rulebook: its set lists and the campaign-mode page (Mirkwood Paths, the mini campaign). The same bytes (sha256 b0763922...) as FFG's older images-cdn URL, which answers
  // Node's fetch 503; the asmodee host is the one the other FFG PDFs use.
  { doc: "tdom", file: "dark_of_mirkwood_rulebook_v2.pdf", url: `${FFG}/dark_of_mirkwood_rulebook_v2.pdf` },
  { doc: "faq", file: "lotr_faq_19.pdf", url: `${FFG}/lotr_faq_19.pdf` },
  { doc: "campaign-log", file: "campaign-log.pdf", url: `${FFG}/campaign-log.pdf` },
  { doc: "easy-mode", file: "lotr_easy_mode.pdf", url: `${FFG}/lotr_easy_mode.pdf` },
  // Official decklists: each product's rules insert prints its pre-built or suggested decks. Only the decklist pages are
  // extracted (`only` in data/rules/columns.json). hon and wor are read for their keyword rules (battle, siege,
  // guarded (X)), not for decklists.
  ...[
    ["mec103", "mec103_rules.pdf"],
    ["mec104", "mec104_rules.pdf"],
    ["mec105", "mec105_rules.pdf"],
    ["mec106", "mec106_rules.pdf"],
    ["mec107", "mec107_rules.pdf"],
    ["mec110", "mec110_hero_rules_insert_web.pdf"],
    ["mec112", "mec112_rulebook_eng.pdf"],
    ["mec113", "mec113_rules-web.pdf"],
    ["mec114", "mec114_rules-web.pdf"],
    ["tbr", "the-black-riders-rulesheet.pdf"],
    ["trd", "the-road-darkens-rulesheet.pdf"],
    ["tos", "mec45-the-treason-of-saruman-rulesheet.pdf"],
    ["los", "mec46-the-land-of-shadow-rulesheet.pdf"],
    ["fotw", "mec54_rulesheet.pdf"],
    ["mof", "mountain_of_fire_rules_insert_eng.pdf"],
    ["ohauh", "hobbit_over_hill_and_under_hill_rulesheet.pdf"],
    ["otd", "hobbit_on_the_doorstep_rulesheet.pdf"],
    ["hon", "heirs-of-numenor_rules.pdf"],
    ["wor", "mec65_web_the-wilds-of_rhovanion_rules.pdf"],
    ["community-eomer-eowyn", "mec_communitydecklists_eomerandeowyn-compressed.pdf"],
    ["community-red-arrow", "mec_communitydecklists_theredarrow-compressed.pdf"],
    ["community-noldor", "mec_communitydecklists_theswordsofthenoldor-compressed.pdf"],
  ].map(([doc, file]) => ({ doc: doc as string, file: file as string, url: `${FFG}/${file as string}` })),
] as const;

// PDFs stay out of git. They are fetched into .cache/pdf and pinned by sha256 in data/sources.json.
export async function syncRules(log: Log = createLog("rules")): Promise<SourceRecord> {
  mkdirSync(PDF_CACHE_DIR, { recursive: true });
  log.debug(`PDFs go to ${PDF_CACHE_DIR}`);
  const files: SourceFile[] = [];
  const tick = log.progress(RULE_PDFS.length, "pdf");
  for (const pdf of RULE_PDFS) {
    const body = await fetchBytes(pdf.url, 300_000, log);
    const head = new TextDecoder().decode(body.slice(0, 5));
    if (head !== "%PDF-") throw new Error(`${pdf.url} is not a PDF (starts ${JSON.stringify(head)}, ${bytes(body.length)})`);
    writeFileSync(path.join(PDF_CACHE_DIR, pdf.file), body);
    files.push({ path: `pdf/${pdf.file}`, url: pdf.url, sha256: sha256(body), bytes: body.length });
    tick(`${pdf.doc}: ${pdf.file}, ${bytes(body.length)}`);
  }
  return { id: "rules", site: "https://www.fantasyflightgames.com/en/the-lord-of-the-rings-the-card-game/", pin: { kind: "sha256", value: combinedPin(files) }, fetchedAt: new Date().toISOString(), files };
}

export function cachedPdf(file: string): string | null {
  const full = path.join(PDF_CACHE_DIR, file);
  return existsSync(full) ? full : null;
}

export function pdfHash(full: string): string {
  return sha256(readFileSync(full));
}
