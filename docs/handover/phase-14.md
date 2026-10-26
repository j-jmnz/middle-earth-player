# Handover: phase 14, The Ring Goes South

Branch `wip-phase-14` (pushed as `wip/phase-14`), from `ccr-a8ef8247-8087n8`. The final commit deletes this file and restores
`src/effects/open-lines.ts` (do not edit that file by hand; `pnpm effects:open` rewrites it).

## Done

- South family: `src/catalog/families/south.ts` (verbs, flags), `src/rules/families/south*.ts` (engine).
  - Second active location slot: flags `extraActiveLocation`, `mustTravel` (table), `south-locations.ts` (`freeSlot`, `makeActiveIn`,
    `placeOnActive`, `progressRoom` with gates and caps, `damageLoss`). Hooks: `quest.ts` (travelTo, placeQuestProgress), `legal.ts`,
    `effect-verbs.ts` placeProgress, `quest-places.ts` makeActive, `encounter-moves.ts`, `conditions.ts` sourceIn, `keywords.ts` activeExplored.
  - Captive Ring-bearer: zone `captive` (in play, controller null, host = Watcher), `south-captive.ts`.
  - Watcher: flag `engagedWithAll`, `south-watcher.ts`; hooks in `combat.ts` (nextEnemyGroup, beginEnemyAttack, undefendedTargets) and
    `shadow.ts` (attackHere, attackKey, locationDamage). `AttackFromStaging` (Storm of Howls) uses `pendingAttack.fromStaging`.
  - `AssignFaceup` (1B), `AssignDamage` (Redhorn Pass), `DiscardEach`, `MakeSetAsideActive`, `RevealUntilThreat`, `AttachToActiveLocation`,
    `PickHighestEngagement`, `DamageActiveLocation`, `ReleaseRingBearer`, `CaptureRingBearer`.
  - Elsewhere: quest family `AdvanceStage`; encounter `DiscardUntil.trait`; `SearchMove.require`; `AttachSelf` hero `exceptSphere`;
    `DiscardRandomFromHand.amount` is an amount; pick filters `active`, `isHost`, `engagedThisRound`; condition `damageReached`;
    `damaged` is now queued for an indestructible enemy.
- Records: `src/effects/authored/the-ring-goes-south.ts` (all 46 open lines owned; `pnpm effects:open` shows none left for 142011-142038, 142084).
- `src/campaign/playable.ts` lists the scenario.

## Decisions

- The Watcher adds no Threat to the staging area (rr.engaged: an engaged enemy does not). It is dealt a shadow card for each of its attacks.
- A treachery attached to "the active location" with two active locations: the first player chooses.
- Regiments of Crows: undefended damage goes on an active location; with two, the defending player names it through `Undefended`.
- "As a group" (Tree-crowned Hill, Eregion): the first player chooses.

## Left

See the checkpoint list at the bottom of the latest commit message; update here when tests and goldens exist.
