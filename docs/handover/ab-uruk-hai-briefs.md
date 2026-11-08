# Briefs of the A/B on The Uruk-hai

The briefs and follow-up messages each arm's agents received, verbatim, for `docs/handover/ab-uruk-hai.md`. Paths in them name the worktrees the arms ran in (`/home/user/ab-fast`, `/home/user/ab-classic`) and the orchestrator's scratch files (`.agent/ab/rulings.md`), which are not in git; the rulings are in `docs/brief.md`, The Two Towers, on each arm's branch.

## Shared blocks

Both arms' briefs append these two blocks, with the worktree and branch filled in.

### The scenario

#### The scenario
- Scenario `the-uruk-hai` (The Two Towers, scenario 7 of the saga; part 1 of the campaign `the-two-towers`). Its data is built: data/scenarios/the-uruk-hai.json, the ledger data/printed/the-two-towers.json (all sides read from scans), the campaign card 143071 whose Setup and Resolution records already exist in src/effects/authored/the-two-towers.ts. Rules: docs/brief.md "The Two Towers" (read with `pnpm docs:section docs/brief.md "The Two Towers"`).
- Left to this scenario by the campaign shell (docs/phases/STATUS.md, Open items, Rules and engine (The Two Towers)): the quest card's captive step (143069:A, reading `campaignFacts.heroLog.captives`; empty on a fresh log) and the setter of `ScenarioState.pursuit` (the campaign card's Resolution reads "if the pursuit value is 25 or lower").
- The goal: the-uruk-hai in PLAYABLE_SCENARIOS (src/campaign/playable.ts), every ledger line it deals owned by a record (`pnpm effects:open`), coverage and its goldens green, and `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm data:check` green.
- Work in the git worktree <worktree> (branch <branch>). All commands run there (cd <worktree> first; use absolute paths). Do not touch /home/user/middle-earth-lcg or any other worktree. `.cache` there is a link to the shared scan cache; node_modules is installed.
- No phone, simulator or Maestro in this session; phone and tablet checks are not tracked (write no note for them). Maestro flows are written, not run.

### Standing rules, what must not move, hand-back

#### Standing rules (read these first)
Read and follow, in the worktree: CLAUDE.md; .claude/rules/authority.md; .claude/rules/code-standards.md (Making a change, Checking a change; files under 500 lines); .claude/rules/docs-standards.md (current state only; `pnpm docs:index` after any heading change); .claude/rules/commit-standards.md (you do not commit; your suggested commit summary follows `<type>: <summary>`). Data: data/ is changed only through the sources, the normalizer, the templates or an override, then `pnpm data:build`; the network only through `pnpm data:sync`; card and rule text comes from the pinned sources (data/), never memory.

#### What must not move
- Every other scenario's golden.json, step logs, src/campaign/fixtures/*.json (other than this scenario's own new fixture file) and data/ files stay byte-identical. ENGINE_VERSION (src/rules/engine/version.ts) moves only if a rule change can move a replayed game, as .claude/agents/implementer.md says; then say why.
- src/screens imports nothing from src/rules (`pnpm lint`). src/play/compiler.test.ts at zero bailouts.
- No change to an existing words or sheets test's assertions for another scenario.
- STOP and report instead of deciding: a change that alters another scenario's behaviour, a missing API you cannot add cleanly, a test that breaks for a reason you did not expect. Never work around one silently.

#### Hand-back
- Do not commit or push. Do not edit docs/phases/STATUS.md.
- Check while working with the cheap checks; the full `pnpm test` once at the end of a task that ends with the gates; report each command, its result and whether the tree changed after.
- Report: changes by file, deviations and why, command results, and (for any task that reads or writes records) the Readings list: for each line read in more than one way, the line, the reading taken, the alternative, a citation (a ledger line or a rule span) and a status `literal`, `span-settled` or `needs-ruling`.

## Fast arm

### Read (scenario-author, Sonnet)

#### Task: The Uruk-hai, scenario-author task 1 of 3: Read

You are the scenario-author agent (.claude/agents/scenario-author.md; read it first), running on Sonnet. This is task 1 of 3 (Read). Follow docs/handover/fast-track.md, section Read, exactly; the orchestrator runs Build and Finish as later tasks, and a reading-judge between them.

#### Your task (fast-track.md, Read)
- Scaffold: `pnpm scenario:new the-uruk-hai --track fast --dry-run`, then without --dry-run; then `pnpm data:build`.
- Pack: `pnpm author:pack the-uruk-hai`; read .agent/pack/the-uruk-hai.md in place of the brief's reading list.
- Readings pass over every draft line, grouped by mechanic, against docs/plans/effect-authoring.md (Readings the review catches).
- Hand back: the Readings list (every line read more than one way, with status literal / span-settled / needs-ruling) and the list of mechanics that need a new verb, trigger or flag (with the lines that need each). No engine code and no records yet. The scaffold and `pnpm data:build` may leave the tree changed; run `pnpm lint` and `pnpm typecheck` and `pnpm test:scenario the-uruk-hai --quick --list` and report them; no full test run in this task.

### Build (message to the same agent)

Orchestrator here. Task 2 of 3: Build (docs/handover/fast-track.md, Build). Same worktree /home/user/ab-fast, same standing rules as your Read brief (sections The scenario, Standing rules, What must not move, Hand-back).

The user's rulings on your five needs-ruling readings are in .agent/ab/rulings.md (R1-R5); apply them as given, and write each into docs/brief.md (The Two Towers) in the worktree, R1 replacing the fresh-start sentence about the captive step. Your span-settled and literal readings stand as you took them. Reading 7 (the six older records with `shadow: false` on an additional attack) is outside this scenario: change nothing there.

Do: the mechanics you listed (pursuit tracker, captives, sole attacker, AttachSelf trait, barring treachery attachments, SearchReveal to engaged, and confirm the two "check" items), each a verb/trigger/flag/condition in a family with its engine and its own test; the records in src/effects/authored/the-uruk-hai.ts (templates and copies where they fit); `pnpm effects:open`; put the-uruk-hai in PLAYABLE_SCENARIOS once none of its lines is open; then `pnpm effects:render the-uruk-hai --out .agent/render/the-uruk-hai.md`. Run lint, typecheck and `pnpm test:scenario the-uruk-hai --quick` while working; no spec rows, asks or goldens yet (that is Finish).

Hand back: the render's absolute path, the verbs/flags/conditions added (by family, with signatures), lines still open, ENGINE_VERSION moved or not and why, the command results with whether the tree changed after, and an updated Readings list for anything new you met. Do not commit.

### reading-judge (Opus, fresh)

Judge the render of the-uruk-hai's effect records at .agent/render/the-uruk-hai.md against the printed ledger (data/printed/the-two-towers.json) in the worktree. Follow .claude/agents/reading-judge.md for inputs and output format; the user's rulings are in docs/brief.md, The Two Towers; a reading that follows a ruling is ok. Read only.

### Finish (message to the same agent)

Orchestrator here. Task 3 of 3: Finish (docs/handover/fast-track.md, Finish). Same worktree /home/user/ab-fast and standing rules. Your Build is checkpoint commit d138a81 (I committed it; keep working uncommitted on top).

The reading-judge's verdicts on .agent/render/the-uruk-hai.md:
WRONG (fix in the records and render again):
- 143067:A:1: the "return" option renders as "return engagedEnemies to the staging area" (every engaged enemy, no pick). Printed: the player returns AN enemy engaged with them: a pick of 1 enemy engaged with the acting player.
- 143067:A:2: in the Shadow record "return this card to the staging area" names the shadow card. Printed: "return attacking enemy to the staging area".
AMBIGUOUS (settle as below; fix the record or the render so the English shows it):
- 143022:A:1: the blank-text filter "each hero (any player controls) that is a Captive" must match Captives (nobody controls them); show "Captives are in play but not under any player's control" as owned by the captives family.
- 143023:A:2: allies cannot defend ONLY against Uglúk's attacks (printed "against Uglúk"); the Restrict defend must be scoped to Uglúk and render so.
- 143027:A:1: "each hero's resource pool" includes Captives (orchestrator decision by analogy with ruling R3; J1).
- 143031:A:2: the additional attack is against the defending player ("against you") by the attacking enemy; make the render say so.
- 143032:A:1: the cap excludes progress on the active location and counts as your reading 12 says; make the render show it.
- 143065:A:2: span-settled by rr.lasting-effects: the enemies engaged with you stay LIVE until the end of the round (enemies that engage later are caught). Make the record live, not a snapshot, if the engine allows; if it cannot, STOP-report.
- 143069:B:2: "cannot leave the staging area" must bar every way out (move, return, discard, put into play engaged, player-card engagement), not only engagement ("for any reason", docs/plans/effect-authoring.md, Readings the review catches); fix or STOP-report a missing API.
- 143070:B:3: the second sentence (rescued each Captive and won) is owned by the last-stage win; show it in the render.
Render again after the fixes (same --out path) and list what changed.

Then the rest of Finish: spec rows (one per record whose behaviour needs a game moment, in src/campaign/scenarios/the-uruk-hai/spec.test.ts), the asks (src/play/words/asks/the-uruk-hai.ts; `pnpm test:scenario the-uruk-hai --words` and each sentence checked against docs/design-system-table.md, Choice tray), the golden, seed finder and Maestro flows (docs/handover/agent-brief.md, Scenario procedure, step 5; register the goldens), the scaffold's unused CampaignLog import, then `pnpm test:scenario the-uruk-hai` once, `pnpm lint`, `pnpm typecheck`, the full `pnpm test` once, `pnpm data:check`. Every other scenario's goldens, fixtures and data byte-identical. Hand back the report (docs/handover/agent-brief.md, Report) with commands and whether the tree changed after each, and an updated Readings list. Do not commit.

(After the container restart, a second message resumed the same agent: carry on from the uncommitted tree, and explain why data/cards/Nightmare.json changed. It was the agent's own condition flagging a Nightmare card; it scoped the condition and the file returned to identical.)

### Fix (implementer, Sonnet, fresh)

#### Task: review-fix for The Uruk-hai (branch ab/the-uruk-hai-fast)

You are a Sonnet implementer. The scenario The Uruk-hai is built on branch ab/the-uruk-hai-fast in the worktree /home/user/ab-fast (diff 7137f44..HEAD). One review round (reviewer + ux) ran; fix every finding below in this one task. The user's rulings are in docs/brief.md, The Two Towers; decisions are settled. Re-read each file before editing.

#### Blocks
1. src/rules/core/keywords.ts eliminateEmpties: `held` = `(card.guardedHero || card.captive) && card.owner === index` with no zone check; a destroyed Captive (defeatedDestination -> owner's discard pile) keeps `captive: true`, so a seat with no heroes is never eliminated (rr.player-elimination). Two-handed path: Grishnákh's Captive (seat 1) destroyed by 143024:A:2; seat 0's Captive still under To Isengard!; seat 1's heroes destroyed -> seat 1 plays on. Fix: check card.zone === "captive" (as captivesOf and score.ts do) AND clear captive/owner-held state when a card leaves the captive zone (as Carried Away clears guardedHero, families/wilderland/carried.ts). Test the path.

#### Table (ux)
2. The pursuit value is shown nowhere but the stage's quest-points badge. Add a pursuit readout on the top bar, declared like lifeTracker and burdenDeck (src/play/readouts/widgets.ts): the number, with the 30 loss threshold, warming near it, with a change badge as the threat dial has. Add the "The table adds …" clause to docs/brief.md (The Two Towers, The Uruk-hai) and docs/design-system-table.md as earlier scenarios do. Respect the React Compiler rules (src/play/compiler.test.ts zero bailouts), narrow selectors.
3. Two-handed, only one Captive under To Isengard! is drawn: src/play/store/selectors.ts entriesOf uses captiveUnder (src/rules/families/south/captive.ts, `.find`). Draw every Captive under its host (a captivesUnder list for hosts that hold Captives), without changing other scenarios' entries.
4. A Captive held by Grishnákh vanishes once he is engaged: entriesOf looks for a captive only in staging/captive zones. Include engaged so the held Captive is drawn under him wherever he is.
5. A held dial per seat with a Captive (heldDial in widgets.ts; heldMark in src/play/cards/card-effects.ts): "<hero> is a Captive under To Isengard!" / "… held by Grishnákh", as Carried Away's dial does.
6. Grishnákh's pick rows (143024:forced:1 @0 Pick) do not say whose Captive each row is: add the owner to a Captive's row when the options hold more than one seat's ("Legolas · Player 2"), in cardLabel or a row helper like shipRow (src/play/choice/sheet-parts.ts), only for Captives.
7. Pursuit Choose sheets (143025, 143029:A:2, 143030, 143063) have no note giving the current value: add asks `note` entries bound to the pursuit amount ("The pursuit value is 27. At 30 at the end of the refresh phase, the players lose."), each under 25 words.
8. The Setup capture sentence does not say what the player loses: e.g. "Choose 1 of your heroes, not a Fellowship hero, to be a Captive. You lose control of it, and its text is blank, until the players win." (under 25 words).
9. Loss reason (143022:forced:1) should say why: "To Isengard!: the pursuit value reached 30". The 143030 damage row label drops "This cannot be canceled." (rows have no full stop).
10. Two-handed owned asks notes read "Player 1: Choose …" (capital) where the Choice tray writes "Player 1: choose …": fix it in src/play/words/asks.ts lead (an owned note is capitalised only solo) and check every existing asks test still holds; the Grishnákh note says "until he is defeated" but the ruling is any way he leaves play: reword.

#### Tests (reviewer)
11. spec.test.ts header claims 143015:A:3 and 143017:A:3 are covered in uruk-hai-verbs.test.ts; they are not. Add behaviour coverage (spec rows where a row can express it, else a test) for: 143015:A:3 (Intimidation), 143017:A:3 (Forewarned), 143023:A:2, 143028:A:2/143032:A:2, 143029:A:1, 143029:A:2, 143063:A:2, 143067:A:2, 143031:A:2, 143030:A:1's damage option, the cannotBeEngaged half of 143069:B:2. Fix the header to state only what is true.
12. captives/index.test.ts "a Captive held by Grishnákh" is hollow (idOf(…,"143023") is Uglúk; HoldCaptive runs with nothing picked; the hold is faked with updateCard). Run the real path through moveCard with Grishnákh 143024.
13. uruk-hai-verbs.test.ts: 143070:B:2 must check the enemyDestroyed trigger offers the Response; 143026:A:1 must assert each player drew. Move this file's verb cases beside their families or into the scenario's folder (src/campaign/scenarios/the-uruk-hai/), not the shared interpret folder.

#### Code (reviewer)
14. scripts/data/effects/render/verbs.ts Restrict template now misrenders other scenarios: every Restrict what:"advance" says "...so the Captives are rescued …" (about 44 records), and Restrict what:"defend" without allies says "characters with little Willpower". Keep scenario-specific text out of the shared template (derive it from the record, or render the generic sentence).
15. soleAttacker condition and cannotLeaveStaging flag live in the pursuit family; move soleAttacker to the attack family (src/rules/families/attack/) and cannotLeaveStaging to where staging rules live (a family or core keyword that fits), with catalog entries moved alike.
16. scripts/data/normalize/cards.ts keywordsOf questPointsX: one dense condition detecting the box by a regex on Back.ImagePath; spell it out as a named predicate, say why only these boxes count (and prefer a fact from the campaign defs over an image path if one exists). Data output unchanged.
17. src/play/words/choice.ts is at exactly 500 lines and src/rules/interpret/conditions.ts at 499: split each along behaviour so the next addition fits (scripts/checks/file-size.test.ts must stay green and not list them).
18. scripts/e2e/the-uruk-hai.ts `return found && found;` -> `return found;`.

Not to change: the readings already ruled (Eastemnet including Captives is ruling J1 by the orchestrator, keep it); the score of a Captive whose owner was eliminated stays as it is (list it in your Readings list as a reading to settle).

## Classic arm

### Task A, records and verbs (implementer, Sonnet)

#### Task: The Uruk-hai, records and verbs (task 1 of 2)

You are a Sonnet implementer (.claude/agents/implementer.md). This is the records-and-verbs task of a scenario phase on the classic procedure: docs/handover/agent-brief.md (read it: Setup, Files you own, Shared files, Approach, Scenario procedure, Checks before committing, Report), steps 1 to 4 of its Scenario procedure. A later task writes the words, goldens, fixtures and flows (steps 5 and 6).

#### Your task
- Step 1: `pnpm data:build -- --verbose`, the cross-check for the-uruk-hai.
- Step 2: `pnpm scenario:new the-uruk-hai --dry-run`, then without --dry-run (the classic track, no --track flag); `pnpm data:build`; `pnpm effects:draft the-uruk-hai`; author the records in src/effects/authored/the-uruk-hai.ts (as the effect-author agent file, .claude/agents/effect-author.md, describes; you write them yourself) until ownership coverage is green for every line of every dealt card; `pnpm effects:open`; the-uruk-hai in PLAYABLE_SCENARIOS once none of its lines is open.
- Step 3: each new mechanic a verb/trigger/flag/condition in its family with its engine and its own test; card tests for the records whose behaviour needs a game moment, on the scene kit (test/scenarios/the-uruk-hai/scene.ts, which scenario:new writes, and src/campaign/scenarios/the-uruk-hai/).
- Step 4: any zone or widget only when a setup record or card line creates it, cited in docs/brief.md.
- `pnpm test:scenario the-uruk-hai` is the loop. No goldens, words or flows in this task (the golden test may stay skipped as the skeleton leaves it).
- End with the Readings list.

#### The user's rulings for this scenario (apply them as given; write each into docs/brief.md, The Two Towers)
- R1. Captives and the Campaign Log (143069:A:1 with 143022:A:1): a seat whose log names a captive takes that hero as its Captive without being asked; a seat with no logged captive (a fresh log, or a mixed one) chooses 1 non-Fellowship hero it controls, as in standalone. This replaces the earlier "a fresh start skips the captive step" in docs/brief.md (The Two Towers): skipping would lose at once to 143022:A:1.
- R2. Strange Weariness (143031:A:1): a snapshot. The characters committed when it resolves keep -1 Willpower until the end of the round, even after the quest phase (as record 01076 does).
- R3. Hands of a Healer (143016:A:3): "a hero" is any hero in play, a Captive included.
- R4. Grishnakh (143024:A:1): any way he leaves play puts the attached Captive faceup underneath To Isengard!; a Captive is never discarded that way.
- R5. A Captive keeps its tokens and attachments (a Permanent boon included).
- J1. 143027:A:1 "add 1 resource to each hero's resource pool": Captives included, as with R3.

A reading you find that these rulings do not settle and that needs a ruling: implement the literal reading, mark it needs-ruling in your Readings list, and go on.


### Task B, words, goldens, fixtures and flows (implementer, Sonnet)

#### Task: The Uruk-hai, words, goldens, fixtures and flows (task 2 of 2)

You are a Sonnet implementer (.claude/agents/implementer.md). This is the second task of a scenario phase on the classic procedure: docs/handover/agent-brief.md (read it: Setup, Files you own, Shared files, Approach, Scenario procedure, Checks before committing, Report), steps 5 and 6 of its Scenario procedure, and the Screen half exit.

#### What task 1 built (checkpoint commit 0c4f3ac on this branch, base 7137f44)
A new `uruk` family (src/catalog/families/uruk.ts; src/rules/families/uruk/{index,pursuit,captive}.ts): SetPursuit, RaisePursuit, LowerPursuit, TakeCaptive, AttachCaptive, ReturnCaptive, the flag noTreacheryAttachments, the amount {pursuit:true}, the pick filters captives (only/also/held) and loggedCaptive; the pursuit condition takes min and max; DiscardRandomFromHand setX, AttachSelf hero trait, SearchReveal engaged; CardInstance.captive; the scenario's records in src/effects/authored/the-uruk-hai.ts; card tests in src/campaign/scenarios/the-uruk-hai/{stages,cards,boons}.test.ts; the scene test/scenarios/the-uruk-hai/scene.ts with captives and pursuit layout fields. Known failures this task fixes: src/play/words/scenario-words.test.ts (three bare "Choose a hero." picks at 143024:forced:1 and 143069:setup:1) and scripts/checks/maestro.test.ts (path-soon); the unused CampaignLog import in scripts/e2e/the-uruk-hai.ts.

#### Your task
- The words: each pick and choice of the scenario worded in src/play/words (as earlier scenarios' words modules do), with any gate test the procedure needs, `pnpm test:scenario the-uruk-hai --words`, and each sentence checked against docs/design-system-table.md, Choice tray (number, side, owner). Any widget or readout the scenario's cards create (step 4: the pursuit value, the Captives) on the table, cited in docs/brief.md and docs/design-system-table.md.
- Step 5: the golden of auto-player games on fixed seeds, true solo and two-handed, through a win and through a loss, on the shared kit, listed in test/harness/golden-registry.ts; the seed finder and the fixtures; the Maestro win and loss flows (written, not run).
- Step 6: the campaign test continues the campaign.
- The new ruling C1 below, in the campaign shell's Resolution (src/rules/families/campaign/resolution.ts and the Resolution view): a Skill boon is offered only to a hero with its trait.
- The rulings (all of them, below) stand in docs/brief.md; add C1-C3 there.

#### The user's rulings for this scenario
- R1. Captives and the Campaign Log (143069:A:1 with 143022:A:1): a seat whose log names a captive takes that hero as its Captive without being asked; a seat with no logged captive (a fresh log, or a mixed one) chooses 1 non-Fellowship hero it controls, as in standalone. This replaces the earlier "a fresh start skips the captive step" in docs/brief.md (The Two Towers): skipping would lose at once to 143022:A:1.
- R2. Strange Weariness (143031:A:1): a snapshot. The characters committed when it resolves keep -1 Willpower until the end of the round, even after the quest phase (as record 01076 does).
- R3. Hands of a Healer (143016:A:3): "a hero" is any hero in play, a Captive included.
- R4. Grishnakh (143024:A:1): any way he leaves play puts the attached Captive faceup underneath To Isengard!; a Captive is never discarded that way.
- R5. A Captive keeps its tokens and attachments (a Permanent boon included).
- J1. 143027:A:1: Captives included, as with R3.
- C1. The Skill boons (143015-143018) attach only to a hero with their trait (Warrior, Healer, Ranger, Noble), also when earned at The Uruk-hai's Resolution (143071:B:1). Source: FFG preview "Now May I Make a Right Choice" (2015-02-25): "Each of these boons can only be attached to a hero with the corresponding trait."
- C2. A seat whose last non-Fellowship hero is its Captive is not eliminated while that Captive is held (rr.player-elimination).
- C3. Rohan Lies Open's Response (143070:B:2) lowers the pursuit value no lower than 0.

A reading you find that these rulings do not settle and that needs a ruling: implement the literal reading, mark it needs-ruling in your Readings list, and go on.


### Fix (implementer, Sonnet, fresh)

#### Task: review-fix for The Uruk-hai (branch ab/the-uruk-hai-classic)

You are a Sonnet implementer. The scenario The Uruk-hai is built on branch ab/the-uruk-hai-classic in the worktree /home/user/ab-classic (diff 7137f44..HEAD, commits 0c4f3ac and b455b44). One review round (reviewer + ux) ran; fix every finding below in this one task. The user's rulings are in docs/brief.md, The Two Towers; decisions are settled. Re-read each file before editing.

#### Blocks
1. src/rules/families/uruk/captive.ts inPlayByCode is the third copy of "the in-play card with this code" (also src/rules/families/moria/index.ts and src/rules/families/wilderland/rhovanion.ts). One helper in src/rules/core; all three call it.
2. (ux) A Captive held by an engaged Grishnákh vanishes: src/play/store/selectors.ts entriesOf draws captivesUnder only for staging/captive hosts. Draw it for an engaged host too; add the Grishnákh case (engaged and in staging) to src/play/store/captives.test.ts, whose header claims it.
3. (ux) Rest by Night? damage branch reads "Deal 1 damage to it": add a label for `143030:whenRevealed:1 @0 damage`, e.g. "Deal 1 damage to each character committed to the quest".

#### Changes
4. A rescued Captive cannot take a Skill boon at the Resolution: 143070:B:3 says "they have rescued each Captive hero", but nothing returns a Captive to its owner's heroes on the win, so `ChooseCards to: "hero"` (state.seats[seat].heroes) never offers it. Rescue the Captives (back into their owner's heroes, controlled again, text no longer blank) when the last stage is defeated, before openResolution; check the score and the log (fallen heroes, hero lists) still read right. Test: a seat whose only Warrior is its Captive wins with pursuit <= 25 and "boons" offers Intimidation on that hero.
5. docs/brief.md (The Two Towers, The Uruk-hai, ruling 9) names "Rohan Lies Open"; the card 143070 is "Rescue the Captives". Fix the name.
6. Hollow test cards.test.ts "143030:A:1 the effect cannot be canceled" only checks record.uncancelable is defined: offer a cancel on the reveal and assert it is refused.
7. .maestro/scenarios/the-uruk-hai/the-uruk-hai.yaml has commented-out CHOICE_ID/CHOICE_PROMPT/CHOICE_CONSEQUENCE "for later": write the Resolution's choice keys from the resolution screen's test ids (find them), or remove the placeholders with a header line saying the flow waits for hai-won.
8. captivesUnder (south/captive.ts) and uruk/captive.ts captivesOf(state, heldBy) repeat the filter: captivesOf calls captivesUnder and filters on the flag.
9. (ux) Two-handed, nothing shows whose hero each Captive is: a held dial per owning seat in src/play/readouts/widgets.ts heldDial ("Gimli is a Captive under To Isengard!" / "… held by Grishnákh"), and the card preview of a Captive says it is one, whose it is, and that its text box is blank (143022:A:1) (src/play/cards).
10. (ux) Setup pick `143069:setup:1 @0.1 Pick`: swap "keeps its tokens and attachments" for "its text box is blank and no one controls it" (under 25 words); give a real `why` (e.g. a `{ when }` variant: "the Campaign Log names no Captive of yours." in campaign, standalone otherwise) instead of "you choose your Captive.".
11. (ux) Logged-Captive `143069:setup:1 @0.0 Pick` opens a one-row "Choose that hero" though ruling R1 says "without being asked": resolve the logged hero without a moment (TakeCaptive on it), keeping the golden behaviour otherwise; if a golden step log moves, that is only this scenario's golden.
12. (ux) Grishnákh's end-of-quest damage `143024:forced:3 @0 Pick` always has one row: make it a DamageCard on the held Captive with no Pick, told by the banner.
13. (ux) Grishnákh's attach pick `143024:forced:1 @0 Pick`: "Choose 1 Captive under To Isengard! to attach to {card}." and each row names its owner ("Player N") two-handed, only for Captives.
14. (ux) Isengard Uruk `143063:whenRevealed:1 @0 damage` label: "Assign 3 damage among your characters", and the follow-up step's note counts down ("1 of 3").
15. (ux) The Pursuit dial shows no limit: its spoken name and a reading aid say the loss ("Pursuit value 14, the players lose at 30"), and it warms near 30 as the threat dial does; docs/design-system-table.md (Top bar) says so.
16. Notes: the loss reason (143022:forced:1) "The pursuit value reached 30"; a Captive's attachments are drawn (or listed in its preview); a banner/log line when the pursuit value changes (the uruk family pushes a step) if it fits the banner rules; the orphaned comment above discardRandomFromHand in interpret/verbs.ts and spell out handCost; drop the dead `?? 0` in keywords.ts defeatedDestination; spell out boonHeroes and the captives branch in interpret/pick.ts as named steps; stages.test.ts "143070:A:1" stops mutating the shared world (world.cards.set); the 143065 test also searches the discard pile and checks the found enemy's When Revealed runs (use an Uglúk's Uruk-hai); Unseen Barrier (143032:A:1): progress placed on the quest earlier in the round counts toward its 3 (ruling-free: rr reading as the card says "until the end of the round, no more than 3 progress"), with a test.

Keep every other scenario's state, words, goldens and fixtures unchanged. Do not edit docs/phases/STATUS.md.

## Review rounds

Each arm's own review round ran a reviewer (Opus) and a ux (Opus) in parallel with the same brief apart from the worktree and the procedure name. The reviewer brief: review the scenario on the branch, diff 7137f44..HEAD; the rulings (docs/brief.md, The Two Towers) are settled; follow .claude/agents/reviewer.md; look hardest at each record against its ledger line with a concrete game state, the engine changes on shared paths (no existing scenario's state may differ), tests that pass hollow and lines with no behaviour test, the asks words against docs/design-system-table.md (Choice tray), code standards and docs; the gate is green, run only what a finding needs. The ux brief: review what the player sees (the choice words, the sheets, any table readout for the pursuit value and the Captives, the banners) against the Choice tray and docs/design-system.md; run `pnpm test:scenario the-uruk-hai --words` and read every sentence; check the pursuit value and the Captives are visible, every choice names its number, side and owner, solo and two-handed, and nothing for other scenarios changed.

The classic review started a moment before task B's work was committed; both reviewers were told by message that HEAD had moved to b455b44 and to review 7137f44..b455b44.

## Blind review (same brief for each tree)

### reviewer

Review the scenario The Uruk-hai as built in the git worktree <arm worktree> (detached HEAD): the whole diff from 7137f44 to HEAD (`git -C <arm worktree> diff 7137f44 HEAD`). Work only in that directory; read the code and the tree, not the commit messages. Follow .claude/agents/reviewer.md and the repo rules (CLAUDE.md, .claude/rules/*.md). The user's rulings for the scenario are in docs/brief.md, The Two Towers; they are settled.

Look at: each record against its printed ledger line (data/printed/the-two-towers.json, codes 143015-143032, 143063-143070) with a concrete game state for any mismatch; engine changes on shared paths (no other scenario's state may differ); tests that pass hollow and lines with no behaviour test; the choice words against docs/design-system-table.md, Choice tray; file size (500) and code standards; docs current state.

The gate is green on HEAD. Run only the tests a finding needs. Report each real finding with file, a concrete failing input or path, severity (block / change / note), and one class from: reading (a record that misreads its card), engine (a shared-path or engine bug), test gap, words, file size, screen. Read-only.

### ux

Review (do not edit) what the player sees of the scenario The Uruk-hai as built in the git worktree <arm worktree> (detached HEAD; diff 7137f44..HEAD; work only in that directory; read the code, not the commit messages). Look at the choice words, the sheets they feed (src/play/choice), the table readouts for the pursuit value and the Captives, the card previews and the banners, against docs/design-system-table.md (Choice tray, Top bar) and docs/design-system.md. Run `pnpm test:scenario the-uruk-hai --words` there (WORDS_DUMP prints each sentence) and read every sentence. Check that the player can see the pursuit value and its limit and which heroes are Captives and whose, that every choice names its number, side and owner, that solo and two-handed words are right, and that nothing for other scenarios changed. A cloud session has no phone or simulator. Report each real finding with file, a concrete case, severity (block / change / note) and one class from: reading, engine, test gap, words, file size, screen.
