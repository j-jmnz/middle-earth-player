# Inactive text: a rethink

Proposals for how the app shows and handles a player card's text that no effect record applies. Requested 2026-10-26, alongside the table proposals in `docs/plans/done/table-experience.md`. None is built. The brief's decisions stay unless a proposal says otherwise:

- no card-text NLP and no manual resolver;
- the full official pool stays deck-legal;
- a sentence with no record is never handed to the player to resolve (`docs/brief.md`, Effects, layer 3).

## What the app does now

- **Engine.** A card with no record is paid for and played with its printed cost, numbers and implemented keywords. Its unique text does nothing.
- **Which cards.** One check for the whole app: `inactiveCodes` in `src/catalog/active-text.ts`. A code with no record whose text holds more than implemented keywords is inactive. A code with any record counts as active in whole.
- **Table.** A night veil at 62% covers the lower 45% of the picture, with the word Inactive in small type at its top (`Veil` in `src/play/canvas/pieces.native.tsx`). It is drawn on cards in play, hand cards and the card being dragged. It turns sideways with an exhausted card. The web canvas adds "· Inactive" to the card's label.
- **Long-press preview.** No mark.
- **Card screen.** One muted line under the text: "Inactive: no effect record reads this text yet."
- **Card pool.** An "Active text" switch in the filter sheet. Rows carry no mark.
- **Deck list, deck editor, import list and briefing.** No mark.

## What was measured (2026-10-26, after merging main)

These are scratch scripts over `data/`, `src/effects` and the auto-player; none is committed.

- **The pool.** 883 of the 937 deck-legal player cards (94%) have unique text and no record. 46 have a record.
- **MEC109 starter decks.** Both are 0 of 53 inactive.
- **Pre-built decks.** The import screen offers 35 (`data/decks/prebuilt.json`). Each is 20% to 96% inactive by card count. In 27 of the 35, at least two of the three heroes are inactive.
- **The core Leadership deck.** This is the deck the TheGameLocker video teaches with. 12 of its 47 cards and 2 of its 3 heroes are inactive: Aragorn, Glóin, Son of Arnor, Longbeard Orc Slayer, Brok Ironfist and For Gondor!. The video's main combo uses Aragorn's Response.
- **The backlog.** The four core decks hold 42 distinct inactive codes. All 35 pre-built decks hold 301: 46 heroes, 111 allies, 68 events, 73 attachments and 3 side quests. Across the pool, 436 of the 883 are events or attachments, cards whose only value is their text.
- **Paying for nothing.** The probe was A Shadow of the Past in planning, with Frodo, Aragorn and Glóin and the core Leadership deck:
  - For Gondor! (inactive event) is offered. Playing it took 2 resources from Aragorn and discarded the card, and the engine reported no step.
  - Dúnedain Warning (inactive attachment) is offered on each hero. It attaches and adds no defense.
- **Windows opened for nothing.** Five games of the same deck were played with no cards played. Holding For Gondor! opened 21 of 108 action windows that nothing else could use. With it replaced, none opened that way.
- **The per-code check misses lines.** Sting (142011), Mithril Shirt (142012) and Glamdring (142013) each have a record for one ledger line and none for the others. The check calls them active. They are boons of a scenario that is not playable yet, so the coverage test will catch them before it is. But the card screen calls them active today.

## What is wrong with the veil

1. **It marks the card where its text cannot be read, and not where it can.** On a 51×71 pt table card the text box is unreadable anyway. The long-press preview, where the text is readable, has no mark. Neither does the play sheet, where resources are spent.
2. **It hides the picture.** At table size a card is recognized by its art. On a pre-built deck most cards would be half dark.
3. **It looks like the pick veil.** The night veil at 45% means "this pick does not ask about this card". The two stack on the same card.
4. **The word turns sideways when the card exhausts**, which happens most rounds. On a hand card the band sits mostly under the fan's edge.
5. **It does not say what the player loses.** An inactive ally is a whole body missing one ability. An inactive event costs resources and does nothing. The mark is the same for both.
6. **It comes too late.** The deck screens and the briefing say nothing, so the player first learns it at the table, after choosing the deck.
7. **It is per card, not per line.**
8. **"Inactive" reads like a game state**, such as exhausted or out of play. It is not.

## Proposals

1. **Per line, from the ledger.** A printed line counts as applied when one of these holds:
   - a record names it in `lines`;
   - an implemented keyword owns it;
   - the ledger marks it `inert`.

   A card outside the ledger has every unique line unapplied. One function in `src/catalog/active-text.ts` returns the unapplied lines of a code, and every screen reads it. The per-code set becomes "has an unapplied line".
2. **A plain word.** The player sees "Not applied": "Ability not applied", "Text not applied". A screen reader hears "Aragorn, ability not applied". "Inactive" stays the code's term.
3. **Say what it costs, by card type.**
   - **Hero or ally.** "Plays with its printed numbers; its ability is not applied." It is offered and played as now.
   - **Event whose every Action and Response line is unapplied.** It is not offered. It does not glow and opens no window. A tap shows it large with "The app does not apply For Gondor!, so it cannot be played." The reading behind this is `rr.triggered-ability`: "A triggered ability on a player card can only be initiated if its effect has the potential to change the game state on its own." The engine's version of this card's effect has none. This changes layer 3's "can be paid for, played", so it is the user's decision. The fallback is to keep offering it with the attachment warning below.
   - **Attachment with unapplied text.** It is offered. The play sheet says "Its text is not applied: you pay 2 for no effect", and the confirm arms like Pass, with two taps. Restricted and other keywords still apply.
4. **Say it before the game.**
   - **Card rows.** In the pool and the deck editor, a row carries the same small mark beside the name. Its detail line names the loss: "Response not applied", "Cannot be played".
   - **Deck list and editor.** Under the readiness line, one muted line: "6 cards with text not applied". It is not a readiness rule, and the deck stays ready to play.
   - **Briefing.** The deck picker shows the same count. Under the hero tiles, the picked deck names each card: "Aragorn: Response not applied · For Gondor!: cannot be played".
   - **Import list.** Each pre-built deck shows its count ("12 of 47 cards not applied"), so the player can pick a deck the app plays fully.
   - **Card pool, adding to a deck.** The filter sheet's "Active text" switch becomes a visible chip, "Applied only". It stays off by default, because the builder is not restricted.
5. **On the table, remove the veil.**
   - The mark is small and faint, drawn upright with the tokens, in a corner that no token, effect pill or hand card's cost uses. The `ux` agent places it.
   - It is never a band over the picture and never a word on the canvas.
   - It is not gold, which marks the one action, and not danger, which marks a refusal.
   - An event that cannot be played does not glow. Its reason comes from the table plan's "why a card does not glow" proposal.
6. **In the preview and on the card screen.** The preview's side column lists the unapplied lines under "Not applied", set as the card text is and dimmed. The card screen marks each unapplied line in place, not with one footer line under all of them.
7. **Shrink the list.** Bring the 42 codes of the four core decks into scope through `PLAYER_REQUESTS` (`scripts/data/printed/scope.ts`), as The Shirefolk was. These are the Learn to Play's decks and the video's. Then take the pre-built decks, the codes they share first. Each request pins a scan, reads its lines into the ledger and adds records. Each card brought in drops its mark everywhere at once.

## Order

1. The per-line function (1) and the word (2), because every other proposal reads them.
2. The before-the-game lines (4), since the player picks a deck there.
3. The decision on inactive events (3). Either way, the attachment warning.
4. The table mark in place of the veil (5), then the preview and card screen (6).
5. The core-deck requests (7) can run in parallel. They are data work for `effect-author`, not table work.

## Built

All seven proposals were built on 2026-10-26 (branch `ccr-c7b5b4ea-4ei4kn`; the rules are in `docs/brief.md`, Effects, layer 3, and the look in `docs/design-system-table.md` and `docs/design-system.md`, Card and States). Where the build differs:

- The decision (3) went to not offering an event with no record (`rr.triggered-ability`). Its rows read "Cannot be played", and it opens no action window.
- Card rows (4) put the loss in the detail line ("Ability not applied") with no extra mark beside the name.
- The card screen (6) sets the unapplied lines apart under the Not applied eyebrow with the loss sentence. It does not mark each line in place.
- The core decks (7) are in scope: their 42 cards have records for every line, and the four core decks are fully applied.
