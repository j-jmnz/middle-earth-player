# Handover: deck family (player deck, hand, discard pile)

Base: branch `ccr-a8ef8247-8087n8` at 6fa8029 (encounter and costs families merged). Lines: 43, listed in the agent brief
(`fam-deck.txt`). Push WIP to `wip/deck`.

## Design (vocabulary)

Family verbs (`src/catalog/families/deck.ts`): `MoveCard` (card ref to owner's hand / deck top|bottom|shuffle / discard /
removed, optional `from` zones), `PutIntoPlay` (out-of-play card into play under actor/owner/picked player; heroes to heroes;
attachments onto a chosen host matching `host`; exhausted/committed/damage), `GivePicked`, `SwapPicked` (Gildor),
`ShuffleDiscardIntoDeck`, `ShuffleHandIntoDeck` (X = count), `DiscardFromDeck` (amount, shuffle, count -> X + first match
picked, costAtLeast), `AddToX`, `ActAs` (rest of the effect resolves for the last picked player / back to actor), `PlayFrom`
(play a card from a discard pile as if in hand; events paid via costs' PayToPlay, attachments free with host choice),
`ReduceNextDoomed`, `KeepOpeningHand` (Galdor), `ReducePlayCost` (marker read by Erebor Guard's play).
Triggers: `setupHandDrawn` (mulligan window Response), `paying` (Erebor Guard). Flags: `alliesToHand` (table, Rallying Cry
valour), `doomedReduction` (seat).

Shared-schema additions: `Each.upTo` (number | "any"), `Each.totalCost`, `Each.taken` (engine), `Each.when`; `Choose.different`;
limit `oncePerPhaseGroupEachPlayer`; pick `looked`, `sharesTrait: "self"`, `top` now also for discard piles; condition
`sourceIn` zone `hand`; EffectData `options`.

Encounter family's `LookAtTop` is to be extended: `count` takes an amount (X), `deck: "picked"` (the actor looks at the last
picked player's deck). ArrangeTop (effect-frames.ts) is to work on the deck the looked cards are in.

## Done

- Schema: catalog/families/deck.ts, effect-schema.ts (Each/Choose/limit), effect-schema-pick.ts, effect-schema-conditions.ts.
- Engine: choices.ts + families/deck-choose.ts (different Choose); pick.ts + families/deck-pick.ts (looked, sharesTrait, discard
  top); usage.ts (limit entry, `limitSpent` exported, discardDeckTop cost now announces discardedFromDeck); verbs.ts
  (DiscardRandomFromHand announces discardedFromHand); conditions.ts sourceIn hand.

## Next steps

1. rules/families/deck.ts run() + deck-moves.ts (verbs above), deck-each.ts (Each upTo via hook in effect-frames expandEach),
   deck-play.ts (PlayFrom; event alternatives: an event with several Action records on different lines asks which; event
   limit check/record; doomed reduction hook in planning.ts playCard; Erebor Guard slack in planning.ts paymentReason,
   play/pay.ts exact, machine.ts after play; Galdor mulligan Trigger in legal.ts/actions.ts/sheets.ts; allies-to-hand hook in
   keywords.ts destroyCard; hand Actions in actions.ts actionEffect when condition has sourceIn hand).
2. planning.ts eventReason: do not refuse an event for a Pick from a deck, a `looked` Pick or a Pick with `when` (a search
   is not a target, rr.search).
3. Words: src/play/deck-words.ts hooked into choice-words.ts.
4. Records in src/effects/authored/families/deck.ts; tests in src/rules/families/deck*.test.ts.

## Lines still open

All 43 at this checkpoint. Candidate to stay open: 145005:A:1 (card type change).

## Interrupted by the API usage limit (2026-10-26, about 11:30 UTC)

The main session committed the uncommitted work as it stood, unreviewed and possibly not compiling, in the commit after
this note's previous version. The agent's last stated next step was: "Now the records file."
Before continuing: run `pnpm exec tsc --noEmit` and the family tests, and finish or revert that step.
