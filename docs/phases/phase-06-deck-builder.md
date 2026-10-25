# Phase 6 — Deck builder

Depends on: phases 5 and 17
Blocks: phase 10

## Goal

A root deck builder that saves any official deck-legal card, seeds the two printed starters, and stays smooth on a phone. Chrome uses the tokens in `docs/design-system.md`. Do not invent a palette or a type scale.

## Builder

Route beside the campaign list. Filters: name, sphere, type, pack or cycle, trait, cost, unique, and whether unique text is active. Opening a card shows stats, text, and the errata line. An inactive sentence is labeled inactive. This screen writes no campaign.

A deck saves at any stage (user decision 2026-10-25; `docs/brief.md`, Deckbuilding). The rules below decide whether it is ready to play: the list and the editor say so, the briefing deals only a ready deck, and a copy past the limit or a hero twice is refused at the tap. They are the Rules Reference's (`rr.deckbuilding`; user decision 2026-10-25, which replaced this phase's original three-hero and sphere-match rules; `docs/brief.md`, Deckbuilding):

- One to three heroes, no two with the same title.
- At least 50 other cards.
- At most three copies of a title, across its printings, and never more than `deck_limit`. `is_unique` does not lower that cap. A second copy of a unique title cannot enter play; that is not a save check.
- A card's sphere does not have to match a hero to save. Playing it needs a hero of that sphere (`rr.resource-match`), which the table checks. Saga rules still run on the briefing loadout, not on this save.
- A restriction record is enforced when that record exists. If the printed limit has no record yet, the card still saves and carries the inactive-text mark.

Do not apply Fellowship rules here. A Fellowship hero shows a saga-only badge and still saves. Contract decks that need a different hero count or copy limit are a known limit of this phase. Do not build that exception.

Import accepts a RingsDB decklist id or a `ringsdb.com` URL, via `GET /api/public/decklist/{id}.json`. Cards missing from the official pool are reported by name and dropped. The result is an ordinary saved deck.

Lists use `@shopify/flash-list`, the version `pnpm expo install` selected. Not `FlatList`, and not a map of card views. If that pin is FlashList 2.0.2, do not use sticky headers. Load card rows when this screen opens, then filter in memory. Row images are decoded at row size. The campaign list still does not query `cards`.

## Seeds

On first launch, insert two `user.db` decks that match the printed lists in the brief. Resolve each collector number by card name against the core set plus MEC109. Prefer the Revised Core code when both exist. Write the chosen code next to the row in the seed script. Parenthetical numbers in the brief are collector numbers, not RingsDB codes.

When both decks are used together, the booklet says to replace the three copies of Gandalf (73) in Stealth and Steadfastness with three copies of Elrond (19). Show that as a note. Do not mutate the saved deck. Do not reject the pair because both contain Faramir, Steward of Gondor, or Celebrían's Stone.

## E2E

`.maestro/deck.yaml` filters the pool, saves a legal deck, relaunches, and finds that deck. A fourth copy is refused at the tap: the toast names the card and the rule, and the count stays at three. A Fellowship hero saves. The flow uses testIDs on the editor, the save action, and the error. It does not fling the list to judge frame rate.

## Exit

A deck of cards from outside the Fellowship box saves and reloads offline. A fourth copy is refused. A Fellowship hero saves and shows the saga-only badge. The Maestro flow passes. On a physical phone, flinging the full official pool and typing in the filter do not hitch. The simulator does not count for that check.
