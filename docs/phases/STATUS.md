# Phase status

Status is `not started`, `active`, or `completed`. This file keeps only what is current (`.claude/rules/docs-standards.md`).

## Rules

- A phase is a file in `docs/phases/` with its spec, dependencies and exit, and a row in the table below. If nothing is active, the only legal start is the lowest-numbered phase whose dependencies are completed.
- When you start a phase, set it to `active` with a one-line note. Do not mark the next phase active. More than one phase may be active only when their files say they can run beside each other.
- A phase is completed when its exit is green and `/reviewer` reports no blocks (one review round when `orchestrator` runs it: `.claude/agents/orchestrator.md`, One review round). A phase that changes `src/screens` or `src/play` also needs `/ux` to report no blocks. Then delete its row and its file; what is still open goes to its area's issue (Open items).
- A scenario phase has an engine half and a screen half (`docs/agents/agent-brief.md`, Scenario procedure). When the engine half's exit is green and reviewed, write `engine done` in the note and leave the phase `active`. The phase is completed when both halves are.
- Current counts live in code: the engine version in `src/rules/engine/version.ts`, the playable scenarios in `src/campaign/playable.ts`, the printed lines no record owns in `src/effects/open-lines.ts` (`pnpm effects open`).

## Phases

No phase is open.

| Phase | Work | Status | Note |
| --- | --- | --- | --- |

## Open items

Open work is tracked as GitHub issues, one per area, with one checklist line per item. Read the issue of the area your task touches, not all of them. A new open item is a line in its area's issue, or a new issue with an existing label (`docs/agents/issue-standards.md`).

- Rules and engine: #189. Angmar Awakened: #184. The Two Towers and The Return of the King: #186. Dwarrowdelf: #185. Shadows of Mirkwood: #182. Standalone scenarios: #183.
- Fixtures (the won and lost games not found): #188.
- Screens and code: #187. Desktop: #181. Cards tab views: #178. Sound and music: #179. README showcase: #180. Releases: #177.

A reading no official source settles is not an open item: it is in the section `Readings to confirm` of its box's file in `docs/scenarios/` (or of `docs/brief.md` for the core round and the player cards), until the user confirms it.

## Standing decisions
- Sources are online; no physical card or box check (user, 2026-10-24). The nine MEC109 cards rest on the older printing's scans.
- Every Rules Reference action window opens; Responses are offered as soon as their trigger resolves; deckbuilding follows the Rules Reference (one to three heroes, no sphere match on save) (user, 2026-10-25).
- An event with no record cannot be played (`rr.triggered-ability`) (user, 2026-10-26).
- Every deck-legal player card is automated (user, 2026-10-26), Messenger of the King included; RingsDB's `(MotK)` hero stand-ins (`MotKA`) stay out of the pool and import as their ally (user, 2026-11-16).
- The player deck stays hidden; the two-handed peek shows the whole seat (user, 2026-10-26).
- Back order on the table is spotlight, scrub, peek, then the rest (user, 2026-10-27).
- Pinned RevCore encounter scans that are 2010/2012 Core Set printings are accepted where the text matches (user, 2026-10-27).
- The table is landscape only; only a tablet (shortest side 600 pt) rotates other routes (user, 2026-10-28).
- The hand scrub starts after a 150 ms hold and shows a fanned risen hand; the card preview has no Close (user, 2026-10-28).
- In Daylight, gold is a bronze with a cream `onGold` (user, 2026-10-28).
- The quest meter (the command column's head) shows only in the Quest phase (user, 2026-11-03).
- The victory display is a fanned pile at staging's right end, shown only while a card is in it; card lists (piles, rows, the choice's rows) show each card's picture on night (user, 2026-11-03).
- The combat spotlight stage is always dark, a lone attack runs about 2.2 s, and a destroyed target burns (user, 2026-10-29).
- Page art has no hard edges: it fades to black or into the fog; framed tiles and panels keep theirs (user, 2026-10-30).
- The screen reader path is independent of ordinary play: with no phone screen reader on, nothing drawn, touched, heard or timed changes, the web build included; new reader behaviour is gated on `useReaderMode()`, which the Table as a list setting set to Always also turns on (user, 2026-11-05, 2026-11-07).
- The Black Gate Opens ends when the last player is eliminated, and that end runs 146074's Resolution and unlocks Mount Doom; every other scenario's loss writes nothing (user, 2026-11-12).
- A rule reading no official ruling, rule span or agreed community answer settles takes the agent's recommendation, recorded in its box's file in `docs/scenarios/` (or `docs/brief.md`) as "agent recommendation (no ruling found)"; it is not an open item (user, 2026-11-12).
- One scenario pipeline; no more A/B tests (user decision, 2026-11-08). The procedure is in `docs/agents/agent-brief.md` (Scenario procedure).
- An open game is never dropped by the app: after an update the player chooses Continue (from the saved table, checked against the engine) or Restart (user decision, 2026-11-11).
- Desktop builds are unsigned: Windows Authenticode is an optional step behind secrets and macOS notarization is not wired (user decision, 2026-11-16; `docs/releasing.md`, Signing).
- The desktop origin and profile folder never change after the first release (user decision, 2026-11-16; `.claude/rules/release-standards.md`, Tags and releases).
- The desktop and web work never changes phone or iPad code or the Android and iOS bundles (user instruction, 2026-11-16; `docs/architecture.md`, Screens).
- The app may go online for the RingsDB deck import and a daily update check (on by default, a switch in Settings), and for nothing else (user decision, 2026-11-17; `docs/architecture.md`, Update check).
- Saves stay synchronous on desktop and web, as on the phone; the web waits for the database on a clock deadline, not a spin count (user instruction, 2026-11-16; `src/screens/data/web/sync-wait.ts`).
