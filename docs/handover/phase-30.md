# Phase 30 handover (Journey Along the Anduin)

## Done
- Engine: Hill Troll excess damage (defense-excess.ts), skipStaging flag, RemoveProgressFromQuest, Restrict travelOnly, shadowBlank condition, ShadowAttacks (defense-shadow-attack.ts), quest-setup.ts (first stage Setup reveals + 1B When Revealed), campaign verbs SetAsideEachPlayer / AttachSetAside / EarnAttached / NamePrisoner, pick filter `attachable`, Forced limit support (noteForcedUse), characterDestroyed event carries `other` (the attacking enemy).
- Records: src/effects/authored/journey-along-the-anduin.ts, pool/RevCore.ts (Valor 01133, Scarred 01138). `pnpm effects:open` lists no line for this scenario.

## In progress
- Tests for each new mechanic, then the Journey golden, campaign test, playable.ts, phone half.

## Next
- Tests (rules/families/*-journey tests), golden-anduin, mirkwood campaign test, choice-words, Maestro, fixtures, STATUS.

## Decisions
- Wolf Rider's attack runs after the attack it was dealt to ends (one attack in progress at a time).
- Brown Lands' Forced uses becameActive (also fires when an effect makes it active).
- Search effects search the encounter deck and discard pile (engine convention).

## Lines still open
- none for this scenario.
