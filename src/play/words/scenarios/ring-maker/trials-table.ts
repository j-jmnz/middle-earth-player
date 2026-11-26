// Rules: rm.current-trial, rm.time-x, rr.objective-cards, rr.attachment-cards, rr.engaged, rr.travel, rr.cost (data/rules/entries.json); ledger lines 08035:B:1, 08036:B:2, 08037:B:2, 08038:B:2, 08039:A:1, 08040:A:2, 08041:A:2, 08042:A:2, 08043:A:1, 08043:A:2, 08044:A:1, 08045:A:1, 08049:A:2.
// What the table says of The Three Trials' pieces (src/play/readouts/ring-maker/trials.ts, src/play/cards/ring-maker/trials-preview.ts, src/play/choice/sheets.ts): the choice of the next trial, the current trial's Key, the Guardians' time counters, the Key on its host, the Guardians in the victory display and Hallowed Circle's travel cost.
// The engine decided every fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import type { Instruction } from "../../../../catalog/boundary.ts";
import { plural } from "../../list.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

/** Each stage 2A in the choice, by code: what its When Revealed puts on the table. The Strength row also says the Barrows are shielded while that trial is current (08036:B:1). */
const TRIAL_ROWS: Readonly<Record<string, string>> = {
  "08036": "The Trial of Strength: a Guardian and a Barrow join the staging area, the Key lies on the Guardian. Barrows are immune to player cards and cannot be travelled to.",
  "08037": "The Trial of Perseverance: a Barrow joins the staging area with a Key on it, and the Guardian that shares the Key's Trait is revealed.",
  "08038": "The Trial of Intuition: a Guardian and a Barrow join the staging area, and the Key is shuffled into the bottom 10 cards of the encounter deck.",
};

/** The Choose the engine queues at stage 1B and at each stage 2B (AdvanceToChosenStage): the sentence over it and the label of each row, or null for any other Choose. `stage` is the stage in play: "1B" or "2B". */
export function trialsChoice(choose: Choose, stage: string | null): { note: string; label: (id: string) => string | undefined } | null {
  if (!choose.options.every((option) => TRIAL_ROWS[option.id] != null)) return null;
  const left = choose.options.length;
  const first = stage === "1B" ? "No trial is done yet." : `${plural(3 - left, "trial")} done.`;
  return { note: `Stage ${stage ?? "2B"}: the first player, for the group, chooses the next trial. ${plural(left, "trial")} left. ${first}`, label: (id) => TRIAL_ROWS[id] };
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
      return `${key} is in the staging area. The first player claims it once it is free of encounters, and the trial is done when it lies on a hero.`;
    case "encounterDeck":
      return `${key} is somewhere in the encounter deck. When it is revealed or discarded it goes to the staging area.`;
    case "encounterDiscard":
      return `${key} is in the encounter discard pile. It goes to the staging area, and the first player claims it.`;
    default:
      return `${key} is not in play yet.`;
  }
}

/** The Guardians' last-counter effects, by code (08040:A:2 to 08042:A:2), as a clause that follows "With the last gone, the engaged player's Guardian". */
const GUARDIAN_LAST: Readonly<Record<string, string>> = {
  "08040": "the engaged player discards an ally he controls",
  "08041": "it makes an immediate attack on the engaged player",
  "08042": "it deals 1 damage to each character the engaged player controls",
};

/** The effect of the Guardian's last counter, or null for a card with none. */
export const guardianLastWords = (code: string): string | null => GUARDIAN_LAST[code] ?? null;

/** The sentence under a Guardian's count and its warning at the last counters: what comes off, what the last one does, and who it hits. `engaged` is the engaged player as words ("Player 2", "you"), or null in the staging area. */
export function guardianTimeWords(code: string, left: number, limit: number, takes: number, engaged: string | null): string {
  const last = GUARDIAN_LAST[code] ?? "its effect resolves";
  const who = engaged == null ? "No player is engaged with it, so the effect does nothing." : `It hits ${engaged}.`;
  const lead = left <= takes ? `The next refresh phase takes ${left === 1 ? "the last time counter" : `the last ${left} time counters`}.` : `${plural(left, "time counter")} left. ${takes === 1 ? "One comes off" : `${takes} come off`} at the end of each refresh phase.`;
  return `${lead} With the last gone, ${last}, and ${plural(limit, "time counter")} return. ${who}`;
}

/** What the limit of a Guardian's dial says. */
export const guardianLimitWords = (limit: number): string => `Time ${limit}: it starts with ${limit} time counters`;

/** The dial of the current trial's Key: the label under the number, and the name a screen reader hears. */
export const TRIAL_KEY_LABEL = "Key";
export const trialKeyName = (trial: string): string => `Key of the current trial, ${trial}`;

/** The list of Guardians in the victory display and what stage 3A does to them (08039:A:1). */
export const victoryGuardianWords = (names: readonly string[]): string => `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} in the victory display. At stage 3A each is revealed again, with fresh time counters, and joins the staging area.`;

/** The line on a card that holds a Key: a Guardian or a Barrow (the trial's Key lies there) or a hero (the players control it). */
export const keyHostWords = (host: string, key: string, hero: boolean): string =>
  hero ? `${host} holds ${key}. Its player controls it, and it counts toward Hallowed Circle's Travel cost while it is ready.` : `${host} holds ${key}, which no player controls. When ${host} leaves play the Key goes to the staging area.`;

/** Hallowed Circle's Travel cost: 3 ready Keys the players control, and how many they have now. */
export const hallowedCostWords = (ready: number): string => `Travel cost: the players exhaust 3 ready Key objectives, not the heroes they lie on. They control ${plural(ready, "ready Key")} now, so the travel is ${ready >= 3 ? "possible" : "not possible yet"}.`;

/** The Guardians a travel to Hallowed Circle answers with (08049:A:3). */
export const HALLOWED_AFTER = "After the players travel here each engaged Guardian makes an immediate attack.";
