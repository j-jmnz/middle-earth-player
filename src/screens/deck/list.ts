import { columnsFor, gutter, type SizeClass } from "../../ui/size-class";
import { sessionSetting } from "../data/session-setting.ts";

// The deck list's filter and view. Filtering runs in memory on the decks the list already read.

export type DeckListStatus = "all" | "ready" | "unready";

export type DeckListFilter = {
  query: string;
  status: DeckListStatus;
  // A deck matches when one of its heroes is of this sphere.
  sphere: string | null;
};

export const emptyDeckListFilter: DeckListFilter = { query: "", status: "all", sphere: null };

type ListedDeck = { id: string; name: string; heroes: readonly string[] };
type HeroFacts = ReadonlyMap<string, { name: string; sphereCode: string | null; sphereName?: string | null }>;

/** The decks that match: the search names the deck or one of its heroes; status and sphere narrow it. Order is kept. */
export function filterDecks<T extends ListedDeck>(decks: readonly T[], filter: DeckListFilter, heroes: HeroFacts, ready: (deck: T) => boolean): T[] {
  const query = filter.query.trim().toLowerCase();
  return decks.filter((deck) => {
    if (query.length > 0) {
      const names = [deck.name, ...deck.heroes.map((code) => heroes.get(code)?.name ?? "")];
      if (!names.some((name) => name.toLowerCase().includes(query))) return false;
    }
    if (filter.status === "ready" && !ready(deck)) return false;
    if (filter.status === "unready" && ready(deck)) return false;
    if (filter.sphere && !deck.heroes.some((code) => heroes.get(code)?.sphereCode === filter.sphere)) return false;
    return true;
  });
}

const SPHERE_ORDER = ["leadership", "tactics", "spirit", "lore", "fellowship", "baggins", "neutral"];

/** The spheres of the heroes in these decks, in the game's order, with their printed names: the list's sphere chips. */
export function deckListSpheres(decks: readonly ListedDeck[], heroes: HeroFacts): { code: string; name: string }[] {
  const present = new Map<string, string>();
  for (const deck of decks) {
    for (const code of deck.heroes) {
      const hero = heroes.get(code);
      if (hero?.sphereCode && !present.has(hero.sphereCode)) present.set(hero.sphereCode, hero.sphereName ?? hero.sphereCode);
    }
  }
  const rank = (sphere: string) => {
    const at = SPHERE_ORDER.indexOf(sphere);
    return at < 0 ? SPHERE_ORDER.length : at;
  };
  return [...present]
    .sort(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
    .map(([code, name]) => ({ code, name }));
}

export function deckListFiltered(filter: DeckListFilter): boolean {
  return filter.query.trim().length > 0 || filter.status !== "all" || filter.sphere !== null;
}

// Cards: the hero pictures above each deck. List: one compact row per deck. Kept while the app is open.
export type DeckListView = "Cards" | "List";

const deckListView = sessionSetting<DeckListView>("Cards");

export const setDeckListView = deckListView.set;
export const getDeckListView = deckListView.get;
export const useDeckListView = deckListView.useValue;

/** The gap between two covers in the Cards view's grid, in Medium's points. */
export const COVER_GAP = 12;
const COVER_TARGET = 300;

/**
 * How the deck list lays out in a list `width` wide (screen points, UI scale `s`): the Cards view is a grid of covers about 300 wide
 * (one column in compact, so a phone is as it was), the List view a reading column centred by `inset` on each side
 * (docs/design-system.md, Decks; Tablets). The rows that are not decks span every column.
 */
export function deckListLayout(width: number, size: SizeClass, view: DeckListView, s = 1): { columns: number; inset: number } {
  if (view === "List") return { columns: 1, inset: gutter(width, size, "readable", s) };
  return { columns: size === "compact" ? 1 : columnsFor(width, COVER_TARGET, COVER_GAP, s, 1), inset: 0 };
}
