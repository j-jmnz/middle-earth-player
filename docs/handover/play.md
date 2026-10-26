# Handover: play family

Base: local branch `ccr-a8ef8247-8087n8` at 02f9ba6 (encounter + costs merged). Brief:
`/tmp/claude-0/-home-user-middle-earth-lcg/86b0215b-0801-5c6e-aa95-6e427d7b2743/scratchpad/brief.md`, lines in `fam-play.txt` there
(35 lines). Drafts: `pnpm effects:draft 01019,02053,...` (comma-separated codes).

## Design (vocabulary in src/catalog/families/play.ts)

Verbs: PutIntoPlay, PutIntoPlayFromHand, ChangeControl, ControlledBy (constant), TakeFirstPlayer, Doomed, TakeIntoHand,
ReturnAttachments, AttachFacedown, SwitchActor, DiscardWhen (constant), PlaceDamage, SpendFrom, DiscardSameTitle.
Triggers: discardedFromPlay, discardedByEffect, doomedRaised, enteredOrLeftPlay (alias heard on enteredPlay/leftPlay),
leftPlayWithAttachments (event.attachments), changedControl (duplicate of defense family's: drop one on merge),
activeExplored (duplicate of quest family's, same emitting line in keywords.ts destroyCard: drop one on merge).
Flags: heroType (Sword-thain: the card sits in the heroes zone while it holds it), threatCeiling (seat-held, Vanish from Sight).
Effect field `fromHand: true` (effect-schema.ts): an Action/Response of a non-event card used from the hand.
Pick field `sharesTraitWith: self|host`. Condition `copiesPlayedThisRound.you`, and its count now excludes only the card's
own play (a card returned to hand and played again counts the earlier play).

Engine files (src/rules/families): play.ts (runner), play-refs.ts (card/seat refs, delayed scheduling), play-hooks.ts (reads
from shared files: triggerHears, seatThreat, doomedRaised, discardedFromPlay), play-zones.ts (attachments released when a
host leaves play by any path; facedown cards under a player card discarded), play-enter.ts, play-control.ts, play-leave.ts,
play-sweep.ts (settle sweep: heroType zone, ControlledBy, DiscardWhen), play-pick.ts.

Facedown attachments (Eagles of the Misty Mountains): zone `under`, host = Eagles, `owner` set; out of play, no text. 02119:A:1
(another family) must count `cardsUnder(state, eaglesId)`.

## Planned shared edits

effect-schema.ts (fromHand), effect-schema-pick.ts (sharesTraitWith), effect-schema-conditions.ts (copiesPlayedThisRound.you),
conditions.ts (copies fix, threat via seatThreat), frame-types.ts (GameEvent.attachments), zones.ts (moveCard released param,
release hook), keywords.ts (destroyCard byDamage + released + discard events + activeExplored, raiseThreat doomed event,
versusHighEngagement threat), listen.ts + responses.ts (triggerHears, fromHand), actions.ts (fromHand Actions),
planning.ts (attachment enteredPlay), pick.ts (type: heroes zone is hero; aboveThreat; play pick hook), quest.ts / attach.ts /
amounts.ts (seatThreat), machine.ts (playSweep), choice-words.ts (play words), scripts/data/normalize/timings.ts ("trigger this
action" allows action: Ceorl 12058).

## Status

- [x] catalog vocabulary, schema fields
- [ ] engine modules, shared hooks, tests
- [ ] records (src/effects/authored/families/play.ts)
- Open by design: 06036:A:2 Trained for War (Battle keyword has no rules span in data/rules; needs data:sync rules).
