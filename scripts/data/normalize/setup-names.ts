import type { NameIndex, SetupClause, SetupStep } from "./setup-text.ts";

// The helpers the Setup readers (setup-text.ts, setup-ered-mithrin.ts) and the booklet's set list (scenarios.ts) share.

// Only separators and the quantity words are left once the names are blanked: "1 copy of  and  copy of ", ",  , and ".
export const isNameList = (rest: string): boolean => rest.replace(/\b(?:and|an?|the|\d+|copy|copies|of)\b/g, " ").replace(/[\s,.]/g, "") === "";

// "A, B, and C" / "A and B" as its names.
export const setsOf = (list: string): string[] => list.split(/,\s*(?:and\s+)?|\s+and\s+/).map((name) => name.trim()).filter((name) => name !== "");

// A card name in a phrase, as printed ("The Empty Mug") or without a leading "The" ("the Stormcaller" is "Stormcaller"); a phrase that is not a list of card names finds none.
export function namedBy(names: NameIndex): (phrase: string | undefined) => string[] {
  const found = (text: string): string[] => (isNameList(names.without(text)) ? names.codesOf(text) : []);
  return (phrase) => {
    const asPrinted = found(phrase ?? "");
    return asPrinted.length > 0 ? asPrinted : found((phrase ?? "").replace(/^the /i, ""));
  };
}

// A Setup step clause with `codes` unless the call gives its own.
export const stepWith = (codes: string[]) => (kind: SetupStep, extra: Partial<Extract<SetupClause, { kind: "step" }>> = {}): SetupClause => ({ kind: "step", step: kind, codes, ...extra });
