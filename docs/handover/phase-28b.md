# Phase 28b handover (delete in the final commit)

## Done
- `runs` table (drizzle 0007), `src/campaign/runs.ts` (pure builder + back-fill), `src/screens/run-store.ts`, `run-writers.ts`; written on the Resolution screen (win on Confirm, loss on Back to path) and the standalone outcome screen; back-fill at open (`open-databases.ts`), once, `settings` key `runs-backfill`.
- `ActiveScenario.startedAt` (optional) so a campaign run knows when it was dealt.
- brief.md updated (runs, sections key, History row, loss rule).

- Fold control (`fold-section.tsx`, `fold-state.ts`, `section-store.ts`), both tabs folded, design-system.md updated for it.

## In progress / next
- History screen (`history`), history-open buttons, design-system.md.
- Maestro: `.maestro/history.yaml`, `.maestro/sections-fold.yaml`.

## Decisions
- Back-fill runs in TS after migrate (not SQL): JSON logs are parsed with the app's own schemas, and it is testable.
- A campaign loss is written when the lost Resolution screen is closed (Back to path), not on view, so an Undo after the loss sheet cannot leave a phantom loss. A campaign win is written on Confirm. Standalone: when the outcome screen writes the result.
- Run ids: `campaign:<save>:<scenario>:<seed>`, `standalone:<game>`; insert is on-conflict-do-nothing.
- Back-filled rows: ended_at null (unknown), threats null, engine_version null; a campaign win has no start time.
