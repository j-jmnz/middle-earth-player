# Handover: attachments family

Brief: `/tmp/.../scratchpad/brief.md` (mechanic-family agent). Family lines: `fam-attachments.txt` (45 lines, all open at
start). Base: `origin/ccr-a8ef8247-8087n8` at 6fa8029 (encounter + costs merged). Do not reset again.

## Rules text

- Trap: no rules text in data/rules (Trap is a trait; the card text says how). Worked from card text.
- Guarded (X) on player cards: missing from data/rules (rr.guarded / ltp.guarded cover objectives only). Worked from the
  brief's summary: on play or put into play, reveal encounter cards until one of the type is revealed; the attachment is
  guarded by it (out of play) until it leaves play, then its player puts it into play. Guard: when the encounter deck has
  no card of the type, nothing is revealed and the card enters play at once.
- rr.blank exists (Thrór's Key).

## Design (vocabulary in src/catalog/families/attachments.ts)

- Verbs: PlayInto, AttachSourceTo, Guarded, GuardWith (engine), PutAttachmentIntoPlay, HealAmong, LookAtEncounterCards,
  DeclareAttack, QuestProgressFirst (engine). Triggers: hostDefeated (event's card = attachment, other = the destroyed
  enemy / defeated quest card), unguarded. Flags: attackableByAny, lessStagingThreat (table), blankText,
  takesQuestProgress, progressFirst (table, engine).
- Pseudo host ids for PlayCard: "staging" (Traps, Guarded cards) and "seat:N" (play area, threat dial).
- Guarded card while guarded: zone setAside, controller = its player, host = guard, in guard.attachments.

## Done

- Engine, hooks, records for all 45 lines, tests (src/rules/families/attachments-{traps,guarded,hosts}.test.ts, 28 tests).
- Full suite run once: only failures were a boundary-test comment (fixed) and the knife golden's final pendingEvents
  (hostDefeated queued for an encounter attachment; fixed by announcing only to player attachments). Both re-checked green.

## Next

- Re-run the full suite, card-smoke, effects:open + coverage; final commit (delete this file, restore open-lines.ts); report.

## Lines open

None of the 45 (effects:open: 728 -> 683 open lines).
