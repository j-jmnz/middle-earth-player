// Rules: rm.current-trial, rm.time-x, rr.objective-cards, rr.attachment-cards, rr.engaged, rr.travel, rr.cost (data/rules/entries.json); ledger lines 08035:B:1, 08036:B:2, 08037:B:2, 08038:B:2, 08039:A:1, 08040:A:2, 08041:A:2, 08042:A:2, 08043:A:1, 08043:A:2, 08044:A:1, 08045:A:1, 08049:A:2.
// What the table says of The Three Trials' pieces (src/play/readouts/ring-maker/trials.ts, src/play/cards/ring-maker/trials-preview.ts, src/play/choice/sheets.ts): the choice of the next trial, the current trial's Key, the Guardians' time counters, the Key on its host, the Guardians in the victory display and Hallowed Circle's travel cost.
// The engine decided every fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import type { Instruction } from "../../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../../rules/core/state.ts";
import { plural } from "../../list.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

/** Each stage 2A in the choice, by code: one line of three parts, the trial's name, what its When Revealed puts on the table and its 2B rule in short (08036:B:1, 08037:B:1, 08038:B:1). */
const TRIAL_ROWS: Readonly<Record<string, string>> = {
  "08036": "Strength · Guardian and Barrow, Key on the Guardian · Barrows immune, not travelled to",
  "08037": "Perseverance · Barrow with a Key on it, its Guardian · Guardians cannot be hurt",
  "08038": "Intuition · Guardian and Barrow, Key in the deck · Progress turns into discards",
};

/** The stage in play is the first stage (08035, side B): no trial is done yet. */
const FIRST_STAGE = "08035";

/**
 * The Choose the engine queues at stage 1B and at each stage 2B (AdvanceToChosenStage): the sentence over it, the label of each row and the card a long press on a row opens (the stage's own code, the option id), or null for any other Choose.
 * The first player answers for the group (the reading of 08035:B:1), so with several players the sentence names him.
 */
export function trialsChoice(choose: Choose, game: ScenarioState): { note: string; label: (id: string) => string | undefined; code: (id: string) => string | null } | null {
  if (!choose.options.every((option) => TRIAL_ROWS[option.id] != null)) return null;
  const left = choose.options.length;
  const done = game.questStage != null && game.cards[game.questStage]?.code === FIRST_STAGE ? 0 : 3 - left;
  const ask = game.seatCount > 1 ? `Player ${game.firstPlayer + 1}, for the group: choose the next trial.` : "Choose the next trial.";
  const count = done > 0 ? `${plural(left, "trial")} left, ${done} done.` : `${plural(left, "trial")} left.`;
  return { note: `${ask} ${count}`, label: (id) => TRIAL_ROWS[id], code: (id) => (TRIAL_ROWS[id] != null ? id : null) };
}

/** Where the current trial's Key lies, as a clause after its name. `host` is the card it is attached to; `holder` is the hero's controller, as words, when a hero holds it. */
export type KeyPlace = { zone: "attached" | "staging" | "encounterDeck" | "encounterDiscard" | "other"; host?: string; holder?: string | null };

export function keyWords(key: string, place: KeyPlace): string {
  switch (place.zone) {
    case "attached":
      return place.holder !== undefined
        ? `${key} lies on ${place.host}: ${place.holder ?? "the players"} ${place.holder?.startsWith("Player") ? "controls" : "control"} it. The trial is done.`
        : `${key} lies on ${place.host}, controlled by no player. When ${place.host} leaves play the Key goes to the staging area, and the first player claims it.`;
    case "staging":
      return `${key} is in the staging area. The first player must claim it and attach it to a hero; the trial is done when it lies on a hero.`;
    case "encounterDeck":
      return `${key} is somewhere in the encounter deck. When it is revealed or discarded it goes to the staging area.`;
    case "encounterDiscard":
      return `${key} is in the encounter discard pile. It goes to the staging area, and the first player claims it.`;
    default:
      return `${key} is not in play yet.`;
  }
}

/** The animal of each Key (08043 to 08045) and Guardian (08040 to 08042): short enough to fit under a card or a dial. */
const KEY_ANIMAL: Readonly<Record<string, string>> = { "08043": "Boar", "08044": "Wolf", "08045": "Raven" };
const GUARDIAN_ANIMAL: Readonly<Record<string, string>> = { "08040": "Boar", "08041": "Wolf", "08042": "Raven" };

/** The Guardians' last-counter effects, by code (08040:A:2 to 08042:A:2), as a clause that follows "With the last gone, the engaged player's Guardian". */
const GUARDIAN_LAST: Readonly<Record<string, string>> = {
  "08040": "the engaged player discards an ally he controls",
  "08041": "it makes an immediate attack on the engaged player",
  "08042": "it deals 1 damage to each character the engaged player controls",
};

/** The effect of the Guardian's last counter, or null for a card with none. */
export const guardianLastWords = (code: string): string | null => GUARDIAN_LAST[code] ?? null;

/** The first sentence under a Guardian's count: how many counters are left and how many the refresh phase takes. The dial's warning says it alone, so a screen reader hears it once. */
export function guardianTimeLead(left: number, takes: number): string {
  return left <= takes ? `The next refresh phase takes ${left === 1 ? "the last time counter" : `the last ${left} time counters`}.` : `${plural(left, "time counter")} left. ${takes === 1 ? "One comes off" : `${takes} come off`} at the end of each refresh phase.`;
}

/** The rest of the sentence under a Guardian's count: what the last counter does and who it hits. `engaged` is the engaged player as words ("Player 2", "you"), or null in the staging area. */
export function guardianTimeRest(code: string, limit: number, engaged: string | null): string {
  const last = GUARDIAN_LAST[code] ?? "its effect resolves";
  const who = engaged == null ? "No player is engaged with it, so the effect does nothing." : `It hits ${engaged}.`;
  return `With the last gone, ${last}, and ${plural(limit, "time counter")} return. ${who}`;
}

/** The whole sentence under a Guardian's count, in its dial's note and in its card preview. */
export const guardianTimeWords = (code: string, left: number, limit: number, takes: number, engaged: string | null): string => `${guardianTimeLead(left, takes)} ${guardianTimeRest(code, limit, engaged)}`;

/** The word under a Guardian's dial and a Key's pill: the animal of the pair, "Boar", "Wolf" or "Raven". */
export const trialAnimal = (code: string): string | undefined => KEY_ANIMAL[code] ?? GUARDIAN_ANIMAL[code];

/** What the limit of a Guardian's dial says. */
export const guardianLimitWords = (limit: number): string => `Time ${limit}: it starts with ${limit} time counters`;

/** The dial of the current trial's Key: the label under the number, and the name a screen reader hears. */
export const TRIAL_KEY_LABEL = "Key";
export const trialKeyName = (trial: string): string => `Key of the current trial, ${trial}`;

/** The list of Guardians in the victory display and what stage 3A does to them (08039:A:1). */
export const victoryGuardianWords = (names: readonly string[]): string => `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} in the victory display. At stage 3A each is revealed again, with fresh time counters, and joins the staging area.`;

/** The line on a card that holds a Key: a Guardian or a Barrow (the trial's Key lies there) or a hero (the players control it). `holder` is the controller of the hero as words ("you", "Player 2"), when the card is a hero. */
export const keyHostWords = (host: string, key: string, hero: boolean, holder?: string | null): string => {
  const controls = holder == null ? "Its player controls" : holder === "you" ? "You control" : `${holder} controls`;
  return hero ? `${host} holds ${key}. ${controls} it, and it counts toward Hallowed Circle's Travel cost while it is ready.` : `${host} holds ${key}, which no player controls. When ${host} leaves play the Key goes to the staging area.`;
};

/** Hallowed Circle's Travel cost: 3 ready Keys the players control, and how many they have now. */
export const hallowedCostWords = (ready: number): string => `Travel cost: the players exhaust 3 ready Key objectives, not the heroes they lie on. They control ${plural(ready, "ready Key")} now, so the travel is ${ready >= 3 ? "possible" : "not possible yet"}.`;

/** The Guardians a travel to Hallowed Circle answers with (08049:A:3). */
export const HALLOWED_AFTER = "After the players travel here each engaged Guardian makes an immediate attack.";


/** The pill under a Guardian or a Barrow that holds Keys: the animal of each, "Boar", and the reader hears the full name ("Key of the Boar attached"). `codes` and `names` are the Keys' card codes and titles in the same order. */
export const keyMark = (codes: readonly string[], names: readonly string[]): { text: string; loses: boolean; speech: string } => ({
  text: codes.map((code, index) => KEY_ANIMAL[code] ?? names[index] ?? code).join(" · "),
  loses: false,
  speech: `${names.join(" and ")} attached`,
});
