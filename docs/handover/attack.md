# Handover: attack family (player attacks)

Brief: /tmp/claude-0/-home-user-middle-earth-lcg/86b0215b-0801-5c6e-aa95-6e427d7b2743/scratchpad/brief.md (family F = attack).
Lines: /tmp/claude-0/-home-user-middle-earth-lcg/86b0215b-0801-5c6e-aa95-6e427d7b2743/scratchpad/fam-attack.txt (39 lines), plus
three player-attack lines the defense family left open: 02123:A:1 (Mirkwood Runner), 03007:A:4 (Dwarrowdelf Axe), 08004:A:3
(Firefoot).

Base: branch reset to `ccr-a8ef8247-8087n8` (02f9ba6, a descendant of d2f8a7a with the encounter and costs families merged) so
the costs family's `SpendResources` / `resources` condition can be used for "the players as a group may spend".

## Done (engine, compiles)

- Vocabulary `src/catalog/families/attack.ts`: verbs DeclareAttack, OfferAttacks, QuestProgress, ExcessDamageTo; triggers
  attacked, attackDamaged, attackDestroyedEngaged, optionallyEngaged (duplicate of the quest family's, unify on merge); flags
  attacksStaging, attacksStagingAlone, ignoresDefense, nextAttackBonus, drawOnAttackDestroy, engagedThisRound.
- Shared schema: conditions `attacking` (stat condition too) and `engagedThisRound`; pick fields printedKeyword, notHost,
  engagedWith, sharesTrait, onSubject, minHitPoints, topOfDiscard; ModifyStat target `other`; target kind `other`; Delay until
  `endOfAttack`; Commit `target`.
- Engine: `src/rules/families/attack.ts` (verbs, commitCard), `attack-flow.ts` (declare, await Responses, end of attack:
  endOfAttack expiry, `attacked`, Delay endOfAttack, window back, nested strikes), `attack-strike.ts` (attacking condition,
  ignoresDefense, struck: excess, attackDamaged/attackDestroyed/attackDestroyedEngaged, Knife-work draws), `attack-targets.ts`
  (staging targets, card attack windows, alone rule), `attack-pick.ts`, `attack-events.ts` (engagedThisRound note, optional
  engagement event).
- Hooks: combat.ts (canAttack, legalAttackEnemies, attackDeclared, applyPlayerAttack, continueStrike, strikeEnemy), legal.ts
  attackReason, machine.ts (strike/attack resume order, Engage), keywords.ts modifiedStat, conditions.ts, pick.ts, responses.ts
  and triggers.ts (`other` in scope), attack-verbs.ts (stat `when` kept, target other), verbs.ts holdsNow, events.ts,
  effect-frames.ts (ReturnToStaging other), interpret.ts (Commit target), frame-types.ts, state.ts (Window targets).

Bugs fixed: declaredAttacker Responses used to resolve after the attack's damage when no action window opened; endOfAttack
modifiers never expired after a player attack.

## Next

1. Tests in `src/rules/families/attack.test.ts` (delete `attack-probe.test.ts`).
2. Records in `src/effects/authored/families/attack.ts` (design notes per line below), choice words for Commit/verbs.
3. Checks from the brief, card-smoke, full test, final commit (delete this file).

## Record design per line

Legolas/Blade of Gondolin progress: attackDestroyed + QuestProgress. Blade +1 vs Orc, Spear of the Mark, Bow of the Galadhrim,
Ranger Spear: +1 base and +1 `when: attacking {enemy|notEnemy}`. Unseen Strike: ModifyStat with versusHighEngagement (now kept on
the modifier). Rivendell Blade, Bard: `triggered` on declaredAttacker, ModifyStat defense -2 target other (Bard: condition
attacking ranged). Rivendell Bow: constant, condition host printedKeyword ranged, +1 when attacking ranged. Vassal, Trollshaw Scout:
forced on `attacked`. Haradrim Spear, Riddermark Knight, Gúthwinë: declaredAttacker Response + ModifyStat endOfAttack + Delay
endOfAttack. Hands Upon the Bow, Haldir, Knight of Minas Tirith, Roheryn, Éomer, Great Yew Bow, Battle-fury: DeclareAttack.
Charge into Battle: OfferAttacks. Forth Eorlingas!: attacksStaging holders. Dúnhere: attacksStagingAlone + attack when alone in
staging. Skinbark, Mirkwood Runner: constant ignoresDefense under `attacking alone` condition. Mighty Prowess, Azain: sharesTrait.
Sword of Númenor: minHitPoints. Derufin, Brand: attackDestroyedEngaged. Swift and Strong, Foe-hammer: onSubject Weapon. Knife-work:
engagedWith picked holders + group spend + drawOnAttackDestroy on pickedSeat. Rain of Arrows: Each engagedWith picked.
Mithlond Sea-watcher: count topOfDiscard ally. Firefoot: declaredAttacker + ExcessDamageTo. Dwarrowdelf Axe: attacked + DamageCard
other. Ithilien Archer: attackDamaged + ReturnToStaging other.
