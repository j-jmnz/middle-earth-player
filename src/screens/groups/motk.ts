// The Messenger of the King's heroes (pack MotKA): RingsDB's browse-only stand-ins for the allies the contract turns into heroes, as one group
// of the Cards tab. Each is tied to its ally's code (99 and the ally's code). Pure.
import { groupCard, type GroupCard, type GroupRow } from "./group-types";

export const MOTK_PACK = "MotKA";

/** The line each hero carries (its strip in the grid, its card screen): they are for browsing, the contract plays the ally. */
export const MOTK_NOTE = "Browse only · played with the Messenger of the King contract";

// The ally's code is five digits, or six for a Hobbit saga ally (99131006 stands for 131006).
const MOTK_HERO = /^99(\d{5,6})$/;

export type MotkHero = { card: GroupCard; /** The ally the hero stands for. */ allyCode: string };

/** The ally's code behind a MotKA hero's code, or null for a code that is not one. */
export function motkAllyCode(code: string): string | null {
  return MOTK_HERO.exec(code)?.[1] ?? null;
}

// The name a printing carries ("(MotK) Faramir") without the tag, to sort and to say.
export function untagged(name: string): string {
  return name.replace(/^\(MotK\)\s*/, "");
}

/** The heroes in name order, the tag ignored. */
export function motkHeroes(rows: readonly GroupRow[]): MotkHero[] {
  return rows
    .filter((row) => row.packCode === MOTK_PACK)
    .flatMap((row) => {
      const allyCode = motkAllyCode(row.code);
      return allyCode ? [{ row, allyCode }] : [];
    })
    .sort((left, right) => untagged(left.row.name).localeCompare(untagged(right.row.name)) || left.row.code.localeCompare(right.row.code))
    .map(({ row, allyCode }) => ({ card: groupCard(row, { note: () => MOTK_NOTE }), allyCode }));
}
