// The Messenger of the King's heroes (pack MotKA): RingsDB's browse-only stand-ins for the allies the contract turns into heroes, listed under
// their own type chip in the Cards tab's Player cards view. Each is tied to its ally's code (99 and the ally's code). Pure.
export const MOTK_PACK = "MotKA";

/** The line a hero's card screen carries: the heroes are for browsing, the contract plays the ally. */
export const MOTK_NOTE = "Browse only · played with the Messenger of the King contract";

// The ally's code is five digits, or six for a Hobbit saga ally (99131006 stands for 131006).
const MOTK_HERO = /^99(\d{5,6})$/;

/** The ally's code behind a MotKA hero's code, or null for a code that is not one. */
export function motkAllyCode(code: string): string | null {
  return MOTK_HERO.exec(code)?.[1] ?? null;
}

/** A printing's name without its leading tag ("(MotK) Faramir" is "Faramir"), to sort and to say (the pool sorts by it too). */
export function untagged(name: string): string {
  return name.replace(/^\([^)]*\)\s*/, "");
}

/** The strip on a hero in the pool: the ally's pack, which tells two heroes of one name apart ("Ally · The Hunt for Gollum"). */
export function allyNote(packName: string | undefined): string {
  return packName ? `Ally · ${packName}` : "Ally";
}
