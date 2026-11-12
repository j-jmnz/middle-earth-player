// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests, mec113.dire, mec113.the-one-ring, rr.then (data/rules/entries.json); ledger lines 146043:A:3, 146047:A:1, 146057:A:1, 146076:B:2, 146077:B:2, 146079:A:1, 146079:A:2.
// The words of Mount Doom's table pieces (readouts/mount-doom.ts, readouts/fortitude.ts, choice/sheet-notes.ts): the Fortitude test's commit and its action window, the tokens on the campaign card, stage 2B's resources, stage 3B's cap, Mount Doom's X and Heavy and Tired's host.
// The rest of the scenario's words are in its asks file (src/play/words/asks/mount-doom.ts). Pure.
import { plural } from "../list.ts";

// What a failed Fortitude test does, by the card that made the test: the clause the commit sheet and the action window say. A test made by a card that is not here says only the standing effects.
const FAILS: Readonly<Record<string, string>> = {
  "146043": "raise your threat by 9",
  "146046": "each player raises their threat by 4",
  "146051": "the top card of the encounter deck is revealed",
  "146055": "raise your threat by 10",
  "146056": "deal 1 damage to each character you control",
  "146076": "discard cards from the encounter deck until an enemy is discarded; it engages you",
  "146077": "no more than 5 progress can be placed on the stage this round",
  "146078": "the Ring-bearer claims The One Ring and the players lose the game",
};

// What a passed test does, by the card that made it, when it is more than doing nothing.
const PASSES: Readonly<Record<string, string>> = {
  "146076": "you place a resource on the stage, which advances the quest when there is one for each player",
};

// A card in play that makes a failed test do more, whichever card made it: the words of its effect (146050:A:2, 146057:A:1).
const STANDING: Readonly<Record<"ringwraith" | "tired", string>> = {
  ringwraith: "Ringwraith of Sauron engages you and attacks",
  tired: "Heavy and Tired exhausts its hero and discards its attachments",
};

/** What failing the test costs, as the card that made it says; null for a test no card here words. */
export const fortitudeFailWords = (code: string): string | null => FAILS[code] ?? null;

/** What passing the test does when it is more than nothing, as the card that made it says; null otherwise. */
export const fortitudePassWords = (code: string): string | null => PASSES[code] ?? null;

/** The standing effects of a failed test that are in play now: Ringwraith of Sauron in the staging area, Heavy and Tired on a hero of the player who tests. */
export const fortitudeStandingWords = (ringwraith: boolean, tired: boolean): readonly string[] => [...(ringwraith ? [STANDING.ringwraith] : []), ...(tired ? [STANDING.tired] : [])];

const joined = (parts: readonly string[]): string => (parts.length < 3 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`);

/**
 * The commit sheet's note: how many cards the test discards, the icons already added to it, that the Willpower must be greater than the icons, what passing does when it does something and what failing does. The icons are counted after the commit, so none is known yet.
 * `cards`: the X cards plus what the card adds; `added`: the icons a card adds to the test (Brake of Thorns, The Lidless Eye); `fails`: the clauses of a failed test, the card's own first.
 */
export function fortitudeCommitWords(cards: number, added: number, pass: string | null, fails: readonly string[]): string {
  const base = `Exhaust heroes to commit them. ${plural(cards, "encounter card", "encounter cards")} ${cards === 1 ? "is" : "are"} discarded next, and their Sauron's Eye icons${added > 0 ? `, ${added} more already added,` : ""} must be fewer than the Willpower you commit.`;
  const passes = pass ? ` If you pass, ${pass}.` : "";
  return `${base}${passes}${fails.length > 0 ? ` If you fail, ${joined(fails)}.` : ""}`;
}

/** The warning on a commit that fails the test for certain, or on the action window's Pass when the count fails: the test fails, and what that costs. `lead` says why (nobody is committed, the Willpower does not beat the icons). */
export const fortitudeFailCaution = (lead: string | null, fails: readonly string[]): string => `Tap again: ${lead ? `${lead}, so ` : ""}the test fails${fails.length > 0 ? `: ${joined(fails)}` : ""}`;

/** Why a commit fails for certain: its Willpower does not beat the icons a card already added to the test. */
export const fortitudeNotBeating = (willpower: number, added: number): string => `Willpower ${willpower} does not beat the ${plural(added, "icon")} already added`;

/** One card with the icons it adds: "Orc-hold (1 icon)". */
export const withEyes = (name: string, eyes: number): string => `${name} (${plural(eyes, "icon")})`;

/** The action window's note, after its lead: the Willpower against the icons counted, what failing costs when the count fails, the cards discarded and the icons ignored. A tie fails. */
export function fortitudeCountWords(willpower: number, eyes: number, fails: readonly string[], discarded: readonly string[], ignored: readonly string[]): string {
  const cards = discarded.length > 0 ? ` Discarded: ${discarded.join(", ")}.` : "";
  const skipped = ignored.length > 0 ? ` Ignored: ${ignored.join(", ")}.` : "";
  const failing = willpower <= eyes && fails.length > 0 ? ` If it fails, ${joined(fails)}.` : "";
  return `Willpower ${willpower} against ${plural(eyes, "Sauron's Eye icon", "Sauron's Eye icons")}. ${willpower > eyes ? "It passes" : "It fails, a tie included"} if nothing changes.${failing}${cards}${skipped}`;
}

/** The result line under the numbers. */
export const fortitudeResult = (willpower: number, eyes: number): string => `Fortitude ${willpower > eyes ? "passed" : "failed"} if nothing changes`;

/** The dial of the tokens on the campaign card: one comes off at the end of each round and the players lose the game when none is left (146079:A:2). The count only falls, so it never looks complete. The dial is drawn only while the timer runs. */
export const doomWords = (tokens: number): string => `${plural(tokens, "resource token", "resource tokens")} on the campaign card. One comes off at the end of each round, and the players lose the game when the last one does`;

/** The warning the dial wears near the end. */
export const doomWarn = (tokens: number): { level: "near" | "critical"; words: string } | undefined =>
  tokens === 1 ? { level: "critical", words: "The last resource token: the players lose the game at the end of this round" } : tokens === 2 ? { level: "near", words: "Two resource tokens left: the players lose the game at the end of next round" } : undefined;

/** Stage 2B's dial: the resources here against the number of players, the goal that advances the quest at the end of the quest phase (146076:B:2). `title` is the stage's. */
export const stageTwoWords = (resources: number, players: number, title: string): string =>
  `${resources} of ${players} ${players === 1 ? "resource" : "resources"} on ${title}. Each player who passes a Fortitude test after a successful quest places one, and at the end of the quest phase the quest advances when there are as many as players`;

/** The line the quest readout adds on stage 3B after the first player failed the test: at most 5 progress can still be placed this round (146077:B:2). Short, since the readout's result holds three lines with Mount Doom's X beside it. */
export const stageThreeCapWords = (cap: number): string => `Fortitude test failed: no more than ${cap} progress here this round`;

/** Mount Doom's Threat in the staging area: X is the tens digit of the first player's threat (146043:A:1). */
export const doomXWords = (x: number, threat: number): string => `Mount Doom's Threat X is ${x} (the tens digit of the first player's ${threat})`;

/** The mark of the seat whose hero carries Heavy and Tired ("P1 · Tired"): the hero cannot commit to Fortitude tests and a failed test exhausts it and discards its attachments (146057:A:1). */
export const tiredLabel = (seat: number | null): string => (seat == null ? "Tired" : `P${seat + 1} · Tired`);
export const tiredWords = (hero: string): string => `${hero} carries Heavy and Tired: it cannot commit to Fortitude tests, and when its player fails one it is exhausted and loses each attachment, Heavy and Tired included`;
