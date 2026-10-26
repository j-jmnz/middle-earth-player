# Handover: attachments family

Brief: `/tmp/.../scratchpad/brief.md` (mechanic-family agent). Family lines: `fam-attachments.txt` (45 lines, all open at
start). Base: `origin/ccr-a8ef8247-8087n8` at 6fa8029 (encounter + costs merged). Do not reset again.

## Rules text

- Trap: no rules text in data/rules (Trap is a trait; the card text says how). Work from card text.
- Guarded (X) on player cards: missing from data/rules (rr.guarded / ltp.guarded cover objectives only). Worked from the
  brief's summary: on play or put into play, reveal encounter cards until one of the type is revealed; the attachment is
  guarded by it (out of play) until it leaves play, then its player puts it into play. Guard: when the encounter deck has
  no card of the type, nothing is revealed and the card enters play at once.
- rr.blank exists (Thrór's Key). rr.attachment-cards, rr.destroy, rr.quest-advancement.

## Design (vocabulary in src/catalog/families/attachments.ts)

- Verbs: PlayInto {into staging|playArea|threatDial, limitPerPlayer}; AttachSourceTo {card}; Guarded {types};
  GuardWith (engine); PutAttachmentIntoPlay {card picked|self, unguarded}; HealAmong {amount, pick}; LookAtEncounterCards
  {amount}; DeclareAttack {target, attackers(engine)}; QuestProgressFirst {first} (engine).
- Triggers: hostDefeated (attachment hears its enemy destroyed / quest card defeated), unguarded.
- Flags: attackableByAny, stagingThreat (table), blankText, takesQuestProgress, progressFirst (table, engine).
- Pseudo host ids for PlayCard: "staging" (traps into staging, Guarded cards) and "seat:N" (play area, threat dial). The
  table's pick sheet already labels "seat:N" as "Player N+1".
- Guarded card while guarded: zone setAside, controller = its player, host = guard, listed in guard.attachments (drawn on
  it). releaseAttachments (keywords.ts) releases it: host cleared, `unguarded` event; the card's triggered record
  `unguarded` → PutAttachmentIntoPlay {card: self, unguarded: true}.
- Schema shared edits: pick fields attached/guarded/progress; condition hostActive; AttachesTo host.kind "quest"; SetStat
  stat questPoints; PlaceProgressOn target host; Ready target other.

## Done

- Schema (catalog family file + shared edits above).
- Hooks: keywords.ts (hostDefeated before enemy destroyCard; releaseAttachments → releaseGuarded), quest.ts (stagingThreat
  via withStagingThreat; advanceStage releases a defeated quest card's attachments with hostDefeated; placeQuestProgress
  `questing` param → progressFirstLocations), listen.ts hears + constant-records.ts + travel.ts (blankText),
  conditions.ts (hostActive; matches honors enemy `engaged`), player-verbs.ts (Ready other).
- src/rules/families/attachments-hold.ts, attachments-quest.ts.

## Next

1. attachments-play.ts (PlayInto targets, playElsewhere, Guarded start, GuardWith, PutAttachmentIntoPlay, AttachSourceTo),
   attachments-pick.ts (pick hook), attachments.ts run(); hooks in planning.ts (playCard, playReason, attachmentTargets),
   attach.ts (quest kind; [] for PlayInto cards), pick.ts (pick hook), stage-reveal.ts (askQuestProgress), combat.ts +
   legal.ts (attackableByAny), choice-words.ts (attachment words), sheets.ts option("staging").
2. HealAmong, LookAtEncounterCards, DeclareAttack (Ambush: read host before discarding the source).
3. Records in src/effects/authored/families/attachments.ts; tests in src/rules/families/attachments*.test.ts.
4. Checks (tsc, lint, effects:open, vitest targeted, card-smoke), full test, commit.

## Lines open

All 45 still open (no records yet).

## Interrupted by the API usage limit (2026-10-26, about 11:30 UTC)

The main session committed the uncommitted work as it stood, unreviewed and possibly not compiling, in the commit after
this note's previous version. The agent's last stated next step was: "Now the sheets option label for the "staging" pseudo host."
Before continuing: run `pnpm exec tsc --noEmit` and the family tests, and finish or revert that step.
