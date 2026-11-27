// Rules: rr.in-play-and-out-of-play, dcce.campaign-setup-a-storm-on-cobas-haven, dcce.campaign-setup-the-city-of-corsairs (data/rules/entries.json); ledger lines 50701:A:1, 12148:B:1, 51241:A:1, 51001:A:1
// (docs/brief.md, Core round: set-aside cards are open unless set aside facedown).
//
// The Set aside list of the table menu (docs/design-system-table.md, Reading panels): the set-aside cards the players may read, and how many lie facedown. A card is named unless a family's verb
// declares it secret (src/catalog/family-manifest.ts, AsideSecret): then it is counted and nothing else of it leaves this file, not its id, name, picture, type or place. Not listed and not counted:
// a quest card (a defeated stage is in the quest card's preview, cards/earlier-stages.ts; a stage to come belongs to the quest deck), a card a choice offers out of the collection (families/misc/collection.ts),
// a loot deck's cards (families/sidequests/loot.ts: a shuffled deck, as the inactive decks in `piles`) and the cards of the encounter sets a kit's Quick-build left out (AsideUnused: no part of the game).
//
// The engine keeps no mark on a set-aside card that says how it got there (the Setup puts every card out facedown, named or not, so `face` is never read here). What the state can tell is read from where
// the other cards of a set lie:
//   - A Quick-build set is left out while none of its cards lies outside the set-aside zone. A kept set has its cards in the deck, in play or discarded, so a card of it that waits set aside
//     (one Hidden Threat hid) is not dropped: it is counted.
//   - A facedown deck with an open set (The City of Corsairs: the second deck's set waits set aside, named by the Setup) is set aside once a card of that open set lies outside the set-aside zone:
//     the second deck has taken the first's place. Before that every card is named. After it the state cannot tell a card of the first deck from a card the Setup named, so every set-aside
//     encounter card that is not of the open set is counted, the named objectives too (Gavin may have been shuffled into the first deck): the list never names a hidden card, and may count an open one.
//   - A facedown deck with no open set (Hidden Threat) holds for the whole game: its hidden cards wait set aside only between the successful quest and their reveal, and the state has no mark for that.
// Pure, so a test reads it; nothing in the engine reads it.
import { ASIDE_SECRETS, ASIDE_UNUSED, type AsideSecret, type Effect } from "../../catalog/boundary.ts";
import { memoOf, type StateMemo } from "../../rules/interpret/constant-records.ts";
import { fromEncounterDeck, type PrintedCard } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { underworldCount } from "../readouts/against-the-shadow/stewards-fear.ts";

/**
 * A row of the list: the copies of one printed card that say the same, as one row. `id` is the first copy (the one a tap shows), `picture` the picture key of the side it lies on,
 * `kept` the damage it keeps while set aside (SetAsideInPlay `keepDamage`, 19024:A:1; 0 for none: a copy with its own damage has its own row), `count` the copies, `set` its encounter set ("" for a card of none).
 */
export type SetAsideRow = { readonly id: string; readonly code: string; readonly picture: string; readonly kept: number; readonly count: number; readonly set: string };

/** The public set-aside cards by id, in a stable order that says nothing of when each was set aside (by name, then id); the same cards as rows; and the number of facedown ones. */
/** `deck`: how many of the facedown cards lie in The Steward's Fear's underworld deck (absent in any other game); the rest are the cards the Setup hides. */
export type SetAsideList = { readonly cards: readonly string[]; readonly rows: readonly SetAsideRow[]; readonly facedown: number; readonly deck?: number };

const EMPTY: SetAsideList = { cards: [], rows: [], facedown: 0 };

// What one record declares: codes and titles to hide, a facedown deck (with the sets that stay open, named by the same record), and the sets a Quick-build chooses among.
type Declared = { readonly cardCode: string; readonly codes: readonly string[]; readonly names: readonly string[]; readonly deck: boolean; readonly openSets: readonly string[]; readonly unusedSets: readonly string[] };

const strings = (value: unknown): string[] => (typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

// Every instruction of a record, the nested ones too (a choice's options, a cost's effect): any object with a `verb`.
function instructionsIn(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) for (const item of value) instructionsIn(item, out);
  else if (value != null && typeof value === "object") {
    const entry = value as Record<string, unknown>;
    if (typeof entry.verb === "string") out.push(entry);
    for (const inner of Object.values(entry)) if (inner != null && typeof inner === "object") instructionsIn(inner, out);
  }
  return out;
}

const SECRET_BY_VERB: ReadonlyMap<string, AsideSecret> = new Map(ASIDE_SECRETS.map((secret) => [secret.verb, secret]));
const UNUSED_BY_VERB: ReadonlyMap<string, readonly string[]> = new Map(ASIDE_UNUSED.map((unused) => [unused.verb, unused.sets]));
const OPEN_SET_VERBS: ReadonlyMap<string, string> = new Map(ASIDE_SECRETS.flatMap((secret) => (secret.openSets ? [[secret.openSets.verb, secret.openSets.field] as const] : [])));

// What the records of an effect list declare, read once per list: the list is never changed (docs/architecture.md, State).
const DECLARED = new WeakMap<readonly Effect[], readonly Declared[]>();

function declaredBy(effects: readonly Effect[]): readonly Declared[] {
  let made = DECLARED.get(effects);
  if (!made) {
    made = effects.flatMap((effect): Declared[] => {
      const all = instructionsIn(effect.instructions);
      const secrets = all.flatMap((instruction) => {
        const secret = SECRET_BY_VERB.get(instruction.verb as string);
        return secret ? [{ secret, instruction }] : [];
      });
      const unusedSets = all.flatMap((instruction) => (UNUSED_BY_VERB.get(instruction.verb as string) ?? []).flatMap((field) => strings(instruction[field])));
      if (secrets.length === 0 && unusedSets.length === 0) return [];
      return [
        {
          cardCode: effect.cardCode,
          codes: secrets.flatMap(({ secret, instruction }) => (secret.codes ?? []).flatMap((field) => strings(instruction[field]))),
          names: secrets.flatMap(({ secret, instruction }) => (secret.names ?? []).flatMap((field) => strings(instruction[field]))),
          deck: secrets.some(({ secret }) => secret.deck === true),
          // The open sets are the ones the same record names (AsideSecret, `openSets`): the stage that sets the deck aside names the set that takes its place.
          openSets: all.flatMap((instruction) => {
            const field = OPEN_SET_VERBS.get(instruction.verb as string);
            return field ? strings(instruction[field]) : [];
          }),
          unusedSets,
        },
      ];
    });
    DECLARED.set(effects, made);
  }
  return made;
}

/** What the list does with a set-aside card of a printing: name it, count it, or leave it out. */
export type AsideSort = "open" | "facedown" | "unused";

/**
 * How the set-aside cards of a game are sorted, by the declarations of the records whose card is in the game and by where the game's other cards lie (the file's header). Exported for the tests.
 * A quest card, a choice's option and a loot deck's card are left out by the caller, which knows the instance.
 */
export function asideSorter(game: ScenarioState, ctx: ReduceContext): (printed: PrintedCard | undefined, code: string) => AsideSort {
  const all = declaredBy(ctx.effects);
  const titles = new Set(all.flatMap((declared) => declared.names));
  // One pass over the game's cards: the codes in it, the codes that bear a declared title, and the encounter sets with a card outside the set-aside zone (no quest card, no campaign card:
  // a stage of the set is in the quest deck from the start, and a boon or burden of it is not a card of the set the scenario sets aside, grapple/cards.ts shuffleSetAsideSet).
  const present = new Set<string>();
  const byTitle = new Map<string, Set<string>>();
  const outside = new Set<string>();
  for (const card of Object.values(game.cards)) {
    present.add(card.code);
    const printed = ctx.cards.get(card.code);
    if (!printed) continue;
    if (titles.has(printed.name)) byTitle.set(printed.name, (byTitle.get(printed.name) ?? new Set<string>()).add(card.code));
    if (card.zone !== "setAside" && printed.encounterSet != null && printed.type !== "quest" && printed.campaignKind == null) outside.add(printed.encounterSet);
  }
  const live = all.filter((declared) => present.has(declared.cardCode));
  const codes = new Set(live.flatMap((declared) => declared.codes));
  // A title hides its cards only when different cards of the game bear it (the four Send for Help): a random pick among copies of one card tells nothing, and those copies were set aside by name (Gondorian Warship, 40005).
  const names = new Set(live.flatMap((declared) => declared.names).filter((name) => (byTitle.get(name)?.size ?? 0) > 1));
  const unusedSets = new Set(live.flatMap((declared) => declared.unusedSets).filter((set) => !outside.has(set)));
  // The facedown decks that lie set aside now, each with its open sets.
  const decks = live.filter((declared) => declared.deck && (declared.openSets.length === 0 || declared.openSets.some((set) => outside.has(set))));
  return (printed, code) => {
    if (codes.has(code)) return "facedown";
    // A card the table has no printing of cannot be named anyway: count it.
    if (!printed) return "facedown";
    if (names.has(printed.name)) return "facedown";
    if (!fromEncounterDeck(printed)) return "open";
    if (printed.encounterSet != null && unusedSets.has(printed.encounterSet)) return "unused";
    return decks.some((deck) => !(printed.encounterSet != null && deck.openSets.includes(printed.encounterSet))) ? "facedown" : "open";
  };
}

const LISTS: StateMemo<SetAsideList> = new WeakMap();

/** The Set aside list of a game. The same game and context give the same object. */
export function setAsideList(game: ScenarioState, ctx: ReduceContext): SetAsideList {
  if (game.setAside.length === 0) return EMPTY;
  return memoOf(LISTS, game, ctx, () => {
    const sort = asideSorter(game, ctx);
    const loot = new Set((game.lootDecks ?? []).flat());
    const open: { id: string; name: string; code: string; picture: string; kept: number; set: string }[] = [];
    let facedown = 0;
    for (const id of game.setAside) {
      const card = game.cards[id];
      if (!card || card.collection != null || loot.has(id)) continue;
      const printed = ctx.cards.get(card.code);
      if (printed?.type === "quest") continue;
      const sorted = sort(printed, card.code);
      if (sorted === "facedown") facedown += 1;
      else if (sorted === "open") open.push({ id, name: printed?.name ?? "", code: card.code, picture: pictureKey(card), kept: card.keepsDamage === true ? card.damage : 0, set: printed?.encounterSet ?? "" });
    }
    if (open.length === 0 && facedown === 0) return EMPTY;
    // By encounter set when the cards come from more than one (the panel groups them under the set's name), then by name, then by id as a number: the order of `setAside` would say when each card was set aside.
    const grouped = new Set(open.map((entry) => entry.set)).size > 1;
    open.sort((left, right) => (grouped ? left.set.localeCompare(right.set) : 0) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id, undefined, { numeric: true }));
    // The copies of one printed card that say the same are one row, at the place of the first.
    const rows = new Map<string, SetAsideRow>();
    for (const entry of open) {
      const key = `${entry.picture}\t${entry.kept}`;
      const row = rows.get(key);
      rows.set(key, row ? { ...row, count: row.count + 1 } : { id: entry.id, code: entry.code, picture: entry.picture, kept: entry.kept, count: 1, set: entry.set });
    }
    const deck = Math.min(facedown, underworldCount(game));
    return { cards: open.map((entry) => entry.id), rows: [...rows.values()], facedown, ...(deck > 0 ? { deck } : {}) };
  });
}

/** How many cards the list holds, named or facedown: the number on the menu's row, which is left out at 0. */
export function setAsideCount(game: ScenarioState, ctx: ReduceContext): number {
  const list = setAsideList(game, ctx);
  return list.cards.length + list.facedown;
}

/**
 * The list as one string, for a subscription: a state that changes nothing the panel draws gives an equal string, so the panel does not render (.claude/rules/code-standards.md,
 * Rendering the table and screens). The first line is the facedown count, then a line for each row. `setAsideFromKey` reads it back.
 */
export function setAsideKey(game: ScenarioState, ctx: ReduceContext): string {
  const list = setAsideList(game, ctx);
  return [list.deck ? `${list.facedown}\t${list.deck}` : String(list.facedown), ...list.rows.map((row) => [row.id, row.code, row.picture, row.kept, row.count, row.set].join("\t"))].join("\n");
}

export function setAsideFromKey(key: string): { rows: readonly SetAsideRow[]; facedown: number; deck?: number; total: number } {
  const [first = "0", ...lines] = key.split("\n");
  const rows = lines.map((line): SetAsideRow => {
    const [id = "", code = "", picture = "", kept = "0", count = "1", set = ""] = line.split("\t");
    return { id, code, picture, kept: Number(kept), count: Number(count), set };
  });
  const [count = "0", inDeck = "0"] = first.split("\t");
  const facedown = Number(count);
  const deck = Number(inDeck);
  return { rows, facedown, ...(deck > 0 ? { deck } : {}), total: facedown + rows.reduce((sum, row) => sum + row.count, 0) };
}
