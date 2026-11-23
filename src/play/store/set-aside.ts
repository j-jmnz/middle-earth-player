// Rules: rr.in-play-and-out-of-play, dcce.campaign-setup-a-storm-on-cobas-haven, dcce.campaign-setup-the-city-of-corsairs (data/rules/entries.json); ledger lines 50701:A:1, 12148:B:1 (docs/brief.md, Core round: set-aside cards are open unless set aside facedown).
//
// The Set aside list of the table menu (docs/design-system-table.md, Reading panels): the set-aside cards the players may read, and how many lie facedown. A card is named unless a family's verb
// declares it secret (src/catalog/family-manifest.ts, AsideSecret): then it is counted and nothing else of it leaves this file, not its id, name, picture, type or place. Not listed and not counted:
// a quest card (a defeated stage is in the quest card's preview, cards/earlier-stages.ts; a stage to come belongs to the quest deck), a card a choice offers out of the collection (families/misc/collection.ts),
// a loot deck's cards (families/sidequests/loot.ts: a shuffled deck, as the inactive decks in `piles`) and the cards of the encounter sets a kit's Quick-build left out (AsideUnused: no part of the game). The engine keeps no faceup flag on a set-aside card (the Setup puts every card out facedown, named or not),
// so `face` is never read here. Pure, so a test reads it; nothing in the engine reads it.
import { ASIDE_SECRETS, ASIDE_UNUSED, type AsideSecret, type Effect } from "../../catalog/boundary.ts";
import { memoOf, type StateMemo } from "../../rules/interpret/constant-records.ts";
import type { PrintedCard } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

/** The public set-aside cards by id, in a stable order that says nothing of when each was set aside (by name, then id), and the number of facedown ones. */
export type SetAsideList = { readonly cards: readonly string[]; readonly facedown: number };

const EMPTY: SetAsideList = { cards: [], facedown: 0 };

// The printed types a facedown deck holds (AsideSecret, `deck`).
const DECK_TYPES: ReadonlySet<string> = new Set(["enemy", "location", "treachery", "encounter-side-quest"]);

// What one record hides: codes, titles, and whether it makes the game's set-aside deck cards facedown (less the sets that stay open).
// `unusedSets`: the encounter sets whose set-aside cards are no part of the game (AsideUnused).
type Hidden = { readonly cardCode: string; readonly codes: readonly string[]; readonly names: readonly string[]; readonly deck: boolean; readonly openSets: readonly string[]; readonly unusedSets: readonly string[] };

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

// What the records of an effect list hide, read once per list: the list is never changed (docs/architecture.md, State).
const HIDDEN = new WeakMap<readonly Effect[], readonly Hidden[]>();

function hiddenBy(effects: readonly Effect[]): readonly Hidden[] {
  let made = HIDDEN.get(effects);
  if (!made) {
    made = effects.flatMap((effect): Hidden[] => {
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
          // The open sets are read from the same record: the stage that sets the deck aside names the set that takes its place.
          openSets: all.flatMap((instruction) => {
            const field = OPEN_SET_VERBS.get(instruction.verb as string);
            return field ? strings(instruction[field]) : [];
          }),
          unusedSets,
        },
      ];
    });
    HIDDEN.set(effects, made);
  }
  return made;
}

// The declarations that hold for a game: those of the records whose card is in it.
function liveIn(game: ScenarioState, ctx: ReduceContext): readonly Hidden[] {
  const present = new Set(Object.values(game.cards).map((card) => card.code));
  return hiddenBy(ctx.effects).filter((hidden) => present.has(hidden.cardCode));
}

// Whether the set-aside card with this printing is a card of a set the game does not use.
function unusedAside(live: readonly Hidden[]): (printed: PrintedCard | undefined) => boolean {
  const sets = new Set(live.flatMap((hidden) => hidden.unusedSets));
  return (printed) => printed != null && DECK_TYPES.has(printed.type) && printed.encounterSet != null && sets.has(printed.encounterSet);
}

/** Whether the set-aside card with this printing is one the players must not see, by the declarations of the records whose card is in the game. Exported for the tests. */
export function secretAside(game: ScenarioState, ctx: ReduceContext, live: readonly Hidden[] = liveIn(game, ctx)): (printed: PrintedCard | undefined, code: string) => boolean {
  const codes = new Set(live.flatMap((hidden) => hidden.codes));
  const names = new Set(live.flatMap((hidden) => hidden.names));
  const deck = live.some((hidden) => hidden.deck);
  const open = new Set(live.flatMap((hidden) => hidden.openSets));
  return (printed, code) => {
    if (codes.has(code)) return true;
    // A card the table has no printing of cannot be named anyway: count it.
    if (!printed) return true;
    if (names.has(printed.name)) return true;
    return deck && DECK_TYPES.has(printed.type) && !(printed.encounterSet != null && open.has(printed.encounterSet));
  };
}

const LISTS: StateMemo<SetAsideList> = new WeakMap();

/** The Set aside list of a game. The same game and context give the same object, so a selector on it is stable (.claude/rules/code-standards.md, Rendering the table and screens). */
export function setAsideList(game: ScenarioState, ctx: ReduceContext): SetAsideList {
  if (game.setAside.length === 0) return EMPTY;
  return memoOf(LISTS, game, ctx, () => {
    const live = liveIn(game, ctx);
    const secret = secretAside(game, ctx, live);
    const unused = unusedAside(live);
    const loot = new Set((game.lootDecks ?? []).flat());
    const open: { id: string; name: string }[] = [];
    let facedown = 0;
    for (const id of game.setAside) {
      const card = game.cards[id];
      if (!card || card.collection != null || loot.has(id)) continue;
      const printed = ctx.cards.get(card.code);
      if (printed?.type === "quest" || unused(printed)) continue;
      if (secret(printed, card.code)) facedown += 1;
      else open.push({ id, name: printed?.name ?? "" });
    }
    if (open.length === 0 && facedown === 0) return EMPTY;
    // By name, then by id as a number: the order of `setAside` would say when each card was set aside.
    open.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id, undefined, { numeric: true }));
    return { cards: open.map((entry) => entry.id), facedown };
  });
}

/** How many cards the list holds, named or facedown: the number on the menu's row, which is left out at 0. */
export function setAsideCount(game: ScenarioState, ctx: ReduceContext): number {
  const list = setAsideList(game, ctx);
  return list.cards.length + list.facedown;
}
