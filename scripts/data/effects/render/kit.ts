// The renderer's shared parts: the tally of what a template read and what fell back to JSON, and the helpers every template uses.
// A template names the keys it reads; any key it leaves is printed after the text as `[also {...}]`, so a field is never hidden from the reader.

export type Tally = { template: number; json: number };
// `effects` and `cardName` are the card being rendered and the records around it, read by the barred-effect note (bars.ts).
// `attacker`: the instructions run when an attack ends (AfterAttack), where "this card" is the attacking enemy whose shadow it is.
// `engagedNext`: an EngageNextPlayer step ran before this one in the same list, so an attack here is against the player the enemy just engaged.
// `reads`: set by read-fields.test.ts to collect the keys each finished template claimed (the last entry is the outermost piece), so the test can check each one shows in the English.
export type Ctx = { tally: Tally; effects?: readonly Obj[]; cardName?: string; attacker?: boolean; engagedNext?: boolean; reads?: (readonly string[])[] };
export type Obj = Readonly<Record<string, unknown>>;

export const newCtx = (extra: { effects?: readonly Obj[]; cardName?: string } = {}): Ctx => ({ tally: { template: 0, json: 0 }, ...extra });

export const compact = (value: unknown): string => JSON.stringify(value) ?? "undefined";

// No template for this piece: it prints as compact JSON, in brackets so a reader sees where the renderer stopped.
export function jsonOf(ctx: Ctx, label: string, value: unknown): string {
  ctx.tally.json += 1;
  return `[json ${label} ${compact(value)}]`;
}

export function without(obj: Obj, keys: readonly string[]): Obj {
  return Object.fromEntries(Object.entries(obj).filter(([key, value]) => !keys.includes(key) && value !== undefined));
}

// Finishes a template: the text, plus whatever keys the template did not read.
export function done(ctx: Ctx, text: string, obj: Obj, read: readonly string[]): string {
  ctx.reads?.push(read);
  const rest = without(obj, read);
  if (Object.keys(rest).length === 0) {
    ctx.tally.template += 1;
    return text;
  }
  ctx.tally.json += 1;
  return `${text} [also ${compact(rest)}]`;
}

export const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
export const str = (value: unknown): string => (typeof value === "string" ? value : compact(value));
export const quoted = (names: readonly unknown[]): string => names.map((name) => `"${str(name)}"`).join(" or ");
export const joinAnd = (parts: readonly string[]): string => (parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

// "PlaceProgressOn" -> "place progress on".
/** "a card", "an enemy": the noun with the article it takes. */
export const withArticle = (noun: string): string => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
export const spaced = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
