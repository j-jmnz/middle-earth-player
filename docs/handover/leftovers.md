# Leftovers handover

Branch wip/leftovers (from ccr-a8ef8247-8087n8). Three tasks.

## 1. Battle / Siege (done)
- `battle` / `siege` are printed keywords (boundary.ts printedKeywordsSchema, printed.ts Keywords, data/normalize/keywords.ts,
  active-text.ts) and quest-family flags. `data/cards/AtE.json` 10058 Delay the Enemy (a side quest) now carries `battle`
  (closes 10058:A:1). No encounter quest card prints Battle or Siege in data/.
- `currentQuestHas` (families/quest-conditions.ts), `questStatOf` (quest.ts): committedWillpower counts Attack/Defense;
  both keywords at once count Willpower (decision); questsWithAttack still wins. readout.ts preview uses it.
- New condition `questKeyword`, new ModifyStat target `currentQuest`. Record 06036:action:1 in authored/families/quest.ts.
- Tests: src/rules/families/quest-keywords.test.ts.

## 2. Imrahil 145005:A:1 (done)
- Reused play family `heroType` flag (zone heroes = hero card type). Record 145005:constant:1 in authored/families/play.ts with a
  `count` condition (hero in own discard). New `cardTypeOf(instance, printed)` in printed.ts: used by heldBy/allyLeftPlay/destroy
  (keywords.ts), deck-moves leavePlay, deck-rules alliesToHand, conditions attachedToHero, pick.ts, constants.ts targets.
- `heroSavers` state field (state.ts) kept by playSweep: eliminateEmpties(state, steps, final) waits for the sweep so the last
  hero falling does not eliminate a seat whose Imrahil becomes a hero. Tests: play-types.test.ts.
## 3. Unify PutIntoPlay / PutAttachmentIntoPlay (todo)
