# Table experience: next improvements

Proposals for the landscape table after the 2026-10-25 rework (`docs/design-system.md`, Table). None is built. Each one keeps the brief's rules: the engine computes every number, the table only offers legal choices, and no single tap sends an intent.

## Source

The user asked for proposals drawn from the script of TheGameLocker's "How To Play The Lord Of The Rings LCG – the EASY way! (Part 1)" (YouTube `NCiTsoouhjc`, 2022-12-23, about 63 minutes). Its transcript could not be read from a cloud session: YouTube answered every caption, transcript and download route with its "Sign in to confirm you're not a bot" check (yt-dlp: HTTP 429, youtube-transcript-api: IP blocked). Only the page's metadata was read. Its description says the video covers what a first few solo games need, "about 70% of the rules", and leaves to Part 2 multiplayer, more action-window examples, deckbuilding, the golden and grim rules, card-text terms, scoring, campaign rules and Easy Mode. Its chapters teach by playing one solo game round by round: Basic Concepts, Setup, then Rounds 1 to 6, the first round about twice as long as the others. The description links a fan-made printable turn reference.

So these proposals rest on that structure (teach by playing, round one slowest, a turn reference at hand, action windows left for later) and on the rules in `data/rules`, not on anything said in the video. Read the transcript before building the first two.

## Proposals, most useful first

1. **Combat foresight on the defender pick.** While the player picks a defender, mark each ready character with what the engine says the attack would do to it before the shadow card: the damage, and "destroyed" in danger when the damage reaches its remaining hit points. Same for an undefended hero. The numbers come from `modifiedStat`, as the dock's readout already does for the picked defender.
2. **A turn reference behind the rail.** A tap on the rail opens a panel listing the round's phases and steps (`rail.ts`, `STEP_WORDS`), the current one marked, each with one line from its rule title in `data/rules` and what the player decides there. It answers "what happens next" without the booklet.
3. **A first-game guide.** For the first scenario of a campaign, a dismissible line under the dock's title explains the step the first two times it comes up ("Staging: each player reveals one encounter card; its threat adds to the quest"), worded from the rule spans. Later rounds are quiet, as the video's later rounds are shorter.
4. **Fewer Pass presses, still confirmed.** A setting, off by default, that passes an action window for the player when nothing they hold can be played or used there. The engine already skips windows where no seat can act; this covers windows where the only actions are ones the player has said they never take early (for example events in the resource phase). The setting is the confirmation; it is shown on the dock while on.
5. **Threat and engagement cues.** In staging, mark each enemy whose engagement cost is at or below the seat's threat ("Engages at the encounter phase"), and show the threat a failed quest would add next to the threat ring during the quest. Both are engine reads (`engagementCostOf`, the quest readout).
6. **Affordable at a glance in planning.** Dim hand cards the seat cannot pay for now and show each hero's resources by sphere on its token, so the player sees why a card does not glow.
7. **Round summary.** At the end of the round, the banner sums the round from the log: threat before and after, progress placed, damage taken, cards drawn and played.
8. **Undo within an open decision.** The engine keeps an undo log with a snapshot per phase (`src/rules/undo.ts`). Offer Undo for the last confirmed intent while no hidden card has been revealed since (a commit, a defender before the shadow card turns). It needs a rule decision in the brief first.
9. **Haptics on arm and confirm.** A light tick when a button arms and when an intent is sent. It needs `expo-haptics`, a new package the user would have to allow.
10. **Readability options.** A larger-cards setting that drops to five cards across and lets the hand overlap more, and a high-contrast badge option. The badges already carry a sign and an icon, so they do not rest on colour alone.
