// Rules: rr.keywords, rr.action, rr.response, rr.forced, rr.triggered-ability, rr.shadow-effects, rr.travel, rr.setup, rr.surge, rr.sentinel, rr.ranged, rr.restricted,
// rr.immune, rr.permanent, rr.doomed-x, rr.guarded, mec109.archery, mec109.peril, mec109.indestructible, mec109.toughness, mec109.hide-x, mec113.dire, mec113.phantom,
// dwd.ambush, dwd.regenerate, dcce.sailing, dcce.boarding, dcce.uncharted, dcce.aflame, dcce.grapple, hon.battle, hon.siege, trg.secrecy, bts.valour (data/rules/entries.json).
//
// Which rule span explains a keyword or a timing word in the table's card preview. Candidates are rule ids; the book of the open scenario's
// own wording wins, then the Rules Reference, then Learn to Play (`pickRule`). Pure: the screen turns the id into text (screens/rules/glossary.ts).
import { ruleDoc } from "./ledger.ts";

export type KeywordKey =
  | "surge" | "peril" | "indestructible" | "permanent" | "sentinel" | "ranged" | "restricted" | "battle" | "siege" | "immune" | "sailing" | "uncharted"
  | "phantom" | "dire" | "ambush" | "hide" | "doomed" | "regenerate" | "archery" | "toughness" | "secrecy" | "boarding" | "aflame" | "grapple";

/** `word` is the keyword as printed, without its value; `rules` are the span ids that define it, most specific book first. */
export type RuleWord = { word: string; rules: readonly string[] };

// In the order a card's keywords are listed (the engine's EMPTY_KEYWORDS order).
export const KEYWORD_RULES: Readonly<Record<KeywordKey, RuleWord>> = {
  hide: { word: "Hide", rules: ["mec109.hide-x"] },
  surge: { word: "Surge", rules: ["rr.surge", "ltp.surge"] },
  doomed: { word: "Doomed", rules: ["rr.doomed-x", "ltp.doomed-x"] },
  regenerate: { word: "Regenerate", rules: ["dwd.regenerate"] },
  peril: { word: "Peril", rules: ["mec109.peril", "mec112.peril", "mec113.peril"] },
  archery: { word: "Archery", rules: ["mec109.archery", "mec112.archery", "mec113.archery", "dcce.archery", "hon.archery"] },
  toughness: { word: "Toughness", rules: ["mec109.toughness", "mec112.toughness"] },
  indestructible: { word: "Indestructible", rules: ["mec109.indestructible", "mec112.indestructible", "mec108.indestructible", "emce.indestructible", "dcce.indestructible"] },
  immune: { word: "Immune to player card effects", rules: ["mec109.immune-to-player-card-effects", "mec112.immune-to-player-card-effects", "mec113.immune-to-player-card-effects", "mec108.immune", "emce.immune", "dcce.immune", "rr.immune"] },
  permanent: { word: "Permanent", rules: ["rr.permanent", "mec109.permanent", "mec112.permanent", "ltp.permanent"] },
  sentinel: { word: "Sentinel", rules: ["rr.sentinel"] },
  ranged: { word: "Ranged", rules: ["rr.ranged", "ltp.ranged"] },
  restricted: { word: "Restricted", rules: ["rr.restricted", "ltp.restricted"] },
  battle: { word: "Battle", rules: ["mec108.battle", "hon.battle"] },
  siege: { word: "Siege", rules: ["hon.siege"] },
  secrecy: { word: "Secrecy", rules: ["trg.secrecy"] },
  sailing: { word: "Sailing", rules: ["dcce.sailing"] },
  boarding: { word: "Boarding", rules: ["dcce.boarding"] },
  uncharted: { word: "Uncharted", rules: ["dcce.uncharted"] },
  aflame: { word: "Aflame", rules: ["dcce.aflame"] },
  grapple: { word: "Grapple", rules: ["dcce.grapple"] },
  phantom: { word: "Phantom", rules: ["mec113.phantom"] },
  dire: { word: "Dire", rules: ["mec113.dire"] },
  ambush: { word: "Ambush", rules: ["dwd.ambush"] },
};

export type TimingKey = "action" | "response" | "forced" | "whenRevealed" | "shadow" | "travel" | "setup" | "valour";

export const TIMING_RULES: Readonly<Record<TimingKey, RuleWord>> = {
  action: { word: "Action", rules: ["rr.action"] },
  response: { word: "Response", rules: ["rr.response"] },
  forced: { word: "Forced", rules: ["rr.forced"] },
  whenRevealed: { word: "When Revealed", rules: ["rr.triggered-ability"] },
  shadow: { word: "Shadow", rules: ["rr.shadow-effects"] },
  travel: { word: "Travel", rules: ["rr.travel"] },
  setup: { word: "Setup", rules: ["rr.setup"] },
  valour: { word: "Valour", rules: ["bts.valour"] },
};

/**
 * The timing word a bold label opens ("Forced:", "Combat Action:", "Valour Response:"), or null for any other bold run. A phase-named
 * Action ("Planning Action:", "Quest Action:") is an Action; Valour Action and Valour Response are Valour.
 */
export function timingOf(label: string): TimingKey | null {
  const lower = label.trim().replace(/:$/, "").trim().toLowerCase();
  if (/^valour( action| response)?$/.test(lower)) return "valour";
  if (/^([a-z]+ )?action$/.test(lower)) return "action";
  switch (lower) {
    case "response": return "response";
    case "forced": return "forced";
    case "when revealed": return "whenRevealed";
    case "shadow": return "shadow";
    case "travel": return "travel";
    case "setup": return "setup";
    default: return null;
  }
}

/**
 * The candidate to show: the one from `ownDoc` (the open scenario's booklet), else the Rules Reference's, else Learn to Play's, else the
 * first listed. `docOf` reads a span's document (ledger.ts, ruleDoc).
 */
export function pickRule(candidates: readonly string[], ownDoc: string | null, docOf: (id: string) => string | null = ruleDoc): string | null {
  const docs = candidates.map((id) => docOf(id));
  for (const doc of [ownDoc, "rr", "learn-to-play"]) {
    if (doc == null) continue;
    const at = docs.indexOf(doc);
    if (at >= 0) return candidates[at] ?? null;
  }
  return candidates[0] ?? null;
}
