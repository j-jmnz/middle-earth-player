# Phase 8c: Printed text and rule spans

Depends on: phase 8b
Blocks: phases 8d and 9

Plan: [docs/plans/done/authoritative-data.md](../plans/done/authoritative-data.md), changes A, B and E.

## Goal

The text the build reads for a dealt card is the text printed on that card, pinned to the scan it was read from. A rule id holds the rule it names. Nothing in the engine changes behavior. The scenario 1 golden stays identical.

## Printed-text ledger

- `pnpm data:sync scans` downloads, for the codes in scope, the scan of each side into `.cache/scans/<code>.<side>.jpg`. Use the Hall of Beorn `ImagePath` for the MEC109 printing first, then DragnCards. Record URL and sha256 per file in `data/sources.json`. Do not commit scans.
- In scope for this phase: every card that `a-shadow-of-the-past` deals, The One Ring, all six campaign cards, and every card in both starter lists. Phase 8d adds the cards of scenarios 2 to 6.
- `data/printed/fellowship-of-the-ring.json` holds one entry per code and side: printing, scan URL and sha256, `lines` as printed (one ability per line, apostrophes, not backticks), `inert` line numbers with a reason, `readBy`, and `confirmedBy`.
- An agent reads each scan and writes the entry. When the scan is unreadable or ambiguous, leave the entry out and name the card in STATUS. Do not fill it from Hall of Beorn.
- `data:build` reads ledger lines in place of the source text for templates, `effects:draft`, Setup-text names, and coverage. It prints each difference between the ledger and Hall of Beorn. The build fails when a ledgered scan's sha256 no longer matches.
- Record the corrections already known: 142019 (The Ring Goes South campaign card, both sides), 141025, 141026, 141056, 142039, 142062, the duplicated line on 141029, and the MEC109 printing differences on the nine campaign and burden cards that 8b found.

## Line-owned effects

- A ledger line has the id `<code>:<side>:<n>`. `Effect` gains `lines: string[]`. Templates set it. Existing authored records get it.
- `scripts/checks/effect-coverage.test.ts` checks ownership: each line of a dealt card is owned by a record, by an implemented keyword, or by an `inert` entry. Each record's lines exist and belong to its card. Remove the per-timing count checks.

## Rule spans

- `scripts/data/rules/extract.ts` extracts each page per column with `pdftotext -x -y -W -H`. A page's column boxes are recorded per document.
- `data/rules/index.json` is curated: `{ id, doc, page, column, from, to }`, with `from` and `to` as exact quotes. `data:build` writes `entries.json` from it. Delete the heading heuristic in `split.ts`.
- A test fails when a span's quotes are not found verbatim, in order, on that page and column.
- Cover at least: every id the brief, `src/rules` and the tests cite; archery; toughness; restricted; scoring (the full Learn to Play rule); campaign cards, campaign pool, and the 8-step Campaign Setup Checklist; each MEC109 scenario Setup paragraph; the burden deck and the Ring-bearer's life.
- Fix every citation in `docs/brief.md` and in `src/rules` headers that pointed at the wrong text. The known ones are archery (`ltp.attack-strength`), `rr.campaign-pool`, `ltp.campaign-pool`, `ltp.score`, and the truncated `rr.campaign-setup-checklist` and `rr.scoring`.

## Exit

- `pnpm data:check`, `pnpm test`, `pnpm lint` and `tsc` are green from a clean clone with the network off.
- Every card in scope has a ledger entry, or is named in STATUS as unreadable.
- Coverage is ownership-based and green for scenario 1. No record exists without a line.
- Every cited rule id resolves to a verified span. The brief's keyword table cites spans that hold the keyword.
- The scenario 1 golden and `full-game.test.ts` logs are unchanged.
- Phone checks: none.
