// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.campaign-pool, ltp.campaign-pool,
// rr.fellowship-of-heroes, mec109.setup (data/rules/entries.json).
import type { Effect, Instruction } from "../catalog/boundary.ts";
import { recordInstructions, type ScenarioData } from "../catalog/scenario-data.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import type { StartSeat } from "../rules/setup.ts";

import type { CampaignLog, PoolCard } from "./log.ts";

// The Campaign Setup Checklist as numbered steps. Each step names the rule it follows and says what it did, so the
// briefing screen (phase 10) and a test can show the same eight lines. The answers to the campaign card's own Setup
// choices (Sting and the other boons, the Lórien gifts) come in as option ids, in the order the card asks them.

export type ChecklistStep = { n: number; rule: "rr.campaign-setup-checklist"; text: string; did: string[] };
export type Need = { seat: number; options: readonly string[] };

export type ChecklistInput = {
  log: CampaignLog;
  scenario: ScenarioData;
  seats: readonly { heroes: readonly string[]; deck: readonly string[] }[];
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
  choices?: readonly string[];
};

export type ChecklistPlan =
  | { ok: true; steps: ChecklistStep[]; threatModifier: number; seats: StartSeat[]; poolEncounterCards: string[]; log: CampaignLog }
  | { ok: false; errors: string[]; needs: Need | null };

const TEXT: Readonly<Record<number, string>> = {
  1: "Check that each player is using the heroes listed in the Campaign Log.",
  2: "Ensure that none of the heroes are listed as fallen heroes.",
  3: "If a player wishes to voluntarily change heroes, list the new heroes and add 1 to the threat penalty for each.",
  4: "Apply threat penalty.",
  5: "Attach permanent cards.",
  6: "Check setup cards.",
  7: "Set player decks.",
  8: "Set encounter deck.",
};

export function checklist(input: ChecklistInput): ChecklistPlan {
  const { log, scenario, cards } = input;
  const errors: string[] = [];
  const steps: ChecklistStep[] = [];
  const note = (n: number, did: string[]) => steps.push({ n, rule: "rr.campaign-setup-checklist", text: TEXT[n] ?? "", did });
  const name = (code: string) => printedOf(cards, code).name;
  const seatCount = input.seats.length;
  const campaignSetup = recordInstructions(input.effects, scenario.campaignCard, "campaignSetup");
  const waived = campaignSetup.some((instruction) => instruction.verb === "WaiveThreatPenalty");
  const fallen = new Set(log.fallenHeroesBySeat.flat());

  // 1 and 2: the heroes the players bring against the log, and the fallen list.
  const did1: string[] = [];
  let changed = 0;
  const heroesBySeat = input.seats.map((seat, index) => {
    const logged = log.heroesBySeat[index] ?? [];
    if (logged.length === 0) {
      did1.push(`Seat ${index + 1} lists ${seat.heroes.map(name).join(", ")} in the Campaign Log.`);
      return [...seat.heroes];
    }
    const added = seat.heroes.filter((code) => !logged.includes(code));
    const dropped = logged.filter((code) => !seat.heroes.includes(code));
    for (const code of dropped) {
      const carrying = log.campaignPool.find((card) => card.attachedTo === code && printedOf(cards, card.code).keywords.permanent);
      if (carrying && !fallen.has(code)) errors.push(`${name(code)} carries ${name(carrying.code)}, a Permanent card that must be attached to that hero at the start`);
    }
    changed += added.length;
    if (added.length > 0) did1.push(`Seat ${index + 1} changes ${dropped.map(name).join(", ") || "nothing"} for ${added.map(name).join(", ")}.`);
    return [...seat.heroes];
  });
  note(1, did1.length > 0 ? did1 : ["Every player is using the heroes listed in the log."]);
  const unfit = input.seats.flatMap((seat, index) => seat.heroes.filter((code) => fallen.has(code)).map((code) => `Seat ${index + 1}: ${name(code)} is a fallen hero and cannot start`));
  errors.push(...unfit);
  note(2, unfit.length > 0 ? unfit : ["No hero is listed as fallen."]);

  // 3 and 4: the threat penalty.
  const added = waived ? 0 : changed;
  const threatPenalty = log.threatPenalty + added;
  note(3, changed === 0 ? ["No hero was changed."] : waived ? [`${changed} hero change(s) cost nothing: the campaign card waives the +1 penalty.`] : [`${changed} hero change(s) add ${changed} to the threat penalty.`]);
  note(4, [`Each player's starting threat is the combined threat cost of their heroes plus ${threatPenalty}.`]);

  const seats: StartSeat[] = input.seats.map((seat, index) => ({ heroes: [...(heroesBySeat[index] ?? [])], deck: [...seat.deck], attachments: [] as { host: string; code: string }[], hand: [] as string[] }));
  const pool: PoolCard[] = [...log.campaignPool];

  // 5: Permanent boons and burdens go on their recorded hero.
  const did5: string[] = [];
  for (const card of pool) {
    if (card.attachedTo == null) continue;
    const seat = seats.findIndex((candidate) => candidate.heroes.includes(card.attachedTo ?? ""));
    if (seat < 0) {
      errors.push(`${name(card.code)} is attached to ${name(card.attachedTo)}, who is not one of the heroes starting`);
      continue;
    }
    (seats[seat]?.attachments as { host: string; code: string }[]).push({ host: card.attachedTo, code: card.code });
    did5.push(`${name(card.code)} goes on ${name(card.attachedTo)}.`);
  }
  note(5, did5.length > 0 ? did5 : ["No Permanent card is in the pool."]);

  // The campaign card's own Setup: the choices it opens, answered in order. They come before the cards of the pool
  // are shuffled in, so the cards they earn join the same decks.
  const answers = [...(input.choices ?? [])];
  const did6: string[] = [];
  let needs: Need | null = null;
  const order = Array.from({ length: seatCount }, (_, index) => index);
  const choosers = campaignSetup.filter((instruction): instruction is Extract<Instruction, { verb: "ChooseCards" }> => instruction.verb === "ChooseCards");
  for (const instruction of choosers) {
    const taken: string[] = [];
    for (const seat of instruction.who === "firstPlayer" ? order.slice(0, 1) : order) {
      const remaining = instruction.codes.filter((code) => !taken.includes(code));
      const options = instruction.to === "hero" ? remaining.flatMap((code) => (seats[seat]?.heroes ?? []).map((hero) => `${code}>${hero}`)) : remaining;
      const legal = instruction.optional ? [...options, "skip"] : options;
      const answer = answers.shift();
      if (answer == null) {
        needs ??= { seat, options: legal };
        continue;
      }
      if (!legal.includes(answer)) {
        errors.push(`Seat ${seat + 1}: ${answer} is not one of ${legal.join(", ")}`);
        continue;
      }
      if (answer === "skip") continue;
      const [code = "", host] = answer.split(">");
      taken.push(code);
      const printed = printedOf(cards, code);
      const hero = host ?? null;
      if (instruction.to === "hero" && hero) (seats[seat]?.attachments as { host: string; code: string }[]).push({ host: hero, code });
      if (instruction.to === "hand") (seats[seat]?.hand as string[]).push(code);
      pool.push({ code, back: printed.backType ?? "player", burdenSet: printed.burdenSet, attachedTo: hero, seat });
      did6.push(`Seat ${seat + 1} takes ${name(code)}${hero ? ` onto ${name(hero)}` : instruction.to === "hand" ? " into hand" : ""}.`);
    }
    if (instruction.leftover === "firstPlayerDeck") {
      for (const code of instruction.codes.filter((item) => !taken.includes(item))) {
        (seats[0]?.deck as string[]).push(code);
        did6.push(`${name(code)} was not chosen: it is shuffled into the first player's deck.`);
      }
    }
  }
  if (needs) return { ok: false, errors, needs };
  // Cards with their own Setup are found in the deck they are shuffled into (mec109.setup).
  const withSetup = pool.filter((card) => input.effects.some((effect) => effect.cardCode === card.code && effect.timing === "setup"));
  for (const card of withSetup) did6.push(`${name(card.code)} has a Setup line: the Setup search finds it in its deck.`);
  note(6, did6.length > 0 ? did6 : ["No boon or burden has a Setup keyword."]);

  // 7 and 8: what is left in the pool joins the decks it is backed for.
  const did7: string[] = [];
  const did8: string[] = [];
  const poolEncounterCards: string[] = [];
  for (const card of pool) {
    if (card.attachedTo != null) continue;
    if (seats.some((seat) => seat.hand?.includes(card.code))) continue;
    if (card.back === "player") {
      const seat = Math.min(card.seat ?? 0, seatCount - 1);
      (seats[seat]?.deck as string[]).push(card.code);
      did7.push(`${name(card.code)} is shuffled into seat ${seat + 1}'s deck.`);
    } else {
      poolEncounterCards.push(card.code);
      did8.push(`${name(card.code)} is shuffled into the encounter deck.`);
    }
  }
  note(7, did7.length > 0 ? did7 : ["No player-backed card is in the pool."]);
  note(8, did8.length > 0 ? did8 : ["No encounter-backed card is in the pool."]);

  if (errors.length > 0) return { ok: false, errors, needs: null };
  return {
    ok: true,
    steps,
    threatModifier: threatPenalty,
    seats,
    poolEncounterCards,
    log: { ...log, heroesBySeat, threatPenalty, campaignPool: pool },
  };
}
