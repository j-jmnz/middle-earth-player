// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.campaign-pool, ltp.campaign-pool,
// rr.fellowship-of-heroes, mec109.setup (data/rules/entries.json).
import type { Effect, Instruction } from "../catalog/boundary.ts";
import { recordInstructions, type ScenarioData } from "../catalog/scenario-data.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import type { StartSeat } from "../rules/setup.ts";

import { poolCard, type CampaignLog, type PoolCard } from "./log.ts";

// The Campaign Setup Checklist as numbered steps. Each step names the rule it follows and says what it did, so the
// briefing screen (phase 10) and a test can show the same eight lines. The answers to the campaign card's own Setup
// choices (Sting and the other boons, the Lórien gifts) come in as option ids, in the order the card asks them.

export type ChecklistStep = { n: number; rule: "rr.campaign-setup-checklist"; text: string; did: string[] };
// The seat while the checklist fills it in; StartSeat is the read-only shape it hands to the start.
type Working = { heroes: string[]; deck: string[]; attachments: { host: string; code: string }[]; hand: string[]; afterMulligan: string[] };

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
  | { ok: true; steps: ChecklistStep[]; threatModifier: number; seats: StartSeat[]; poolEncounterCards: string[]; poolIntoPlay: string[]; log: CampaignLog }
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


// What the campaign card's Setup does at step 6: the answers it takes, and what it did, asked and refused.
type Dealing = { did: string[]; errors: string[]; needs: Need | null };
// What a verb works on: the seats, the pool, the answers still unused and the names.
type Table = { input: ChecklistInput; seats: Working[]; pool: PoolCard[]; fresh: Set<PoolCard>; answers: string[]; name: (code: string) => string; out: Dealing };

// The next answer for `seat`, if it is one of `legal`. With none left the step needs one; a wrong one is an error.
function takeAnswer(table: Table, legal: readonly string[], seat: number): string | null {
  const answer = table.answers.shift();
  if (answer == null) {
    table.out.needs ??= { seat, options: legal };
    return null;
  }
  if (!legal.includes(answer)) {
    table.out.errors.push(`Seat ${seat + 1}: ${answer} is not one of ${legal.join(", ")}`);
    return null;
  }
  return answer;
}

// AttachChosen: the first player chooses any hero at the table, their own or another player's.
function attachChosen(table: Table, instruction: Extract<Instruction, { verb: "AttachChosen" }>): void {
  const owners = table.seats.flatMap((seat, index) => seat.heroes.map((hero) => ({ hero, seat: index })));
  const answer = takeAnswer(table, owners.map((owner) => `${instruction.code}>${owner.hero}`), 0);
  if (answer == null) return;
  const host = owners.find((owner) => `${instruction.code}>${owner.hero}` === answer);
  if (host) table.seats[host.seat]?.attachments.push({ host: host.hero, code: instruction.code });
  table.out.did.push(`The first player attaches ${table.name(instruction.code)} to ${table.name(host?.hero ?? "")}.`);
}

function addToHandAfterMulligan(table: Table, instruction: Extract<Instruction, { verb: "AddToHandAfterMulligan" }>): void {
  table.seats.forEach((seat, index) => {
    seat.afterMulligan.push(instruction.code);
    table.out.did.push(`Seat ${index + 1} adds ${table.name(instruction.code)} to their hand after the mulligan.`);
  });
}

// AddToPool: recorded for the next scenario. This game already has the card (shuffled in or in a hand), so steps 7 and 8 leave it be.
function addToPool(table: Table, instruction: Extract<Instruction, { verb: "AddToPool" }>): void {
  const printed = printedOf(table.input.cards, instruction.code);
  for (const seat of instruction.eachPlayer ? table.seats.map((_, index) => index) : [null]) {
    const added = poolCard(printed, instruction.code, null, seat, instruction.eachPlayer === true);
    table.pool.push(added);
    table.fresh.add(added);
  }
  table.out.did.push(`${table.name(instruction.code)} joins the Campaign Pool${instruction.eachPlayer ? " (a copy for each player)" : ""}.`);
}

// ChooseCards: each seat in turn takes a card (the first player alone, or every player). The cards a choice earns join the pool, a
// hand or a hero; only a Permanent card stays recorded on its hero (ltp.campaign-pool): another gift goes on the hero for this
// scenario and is shuffled into a deck in later ones.
function chooseCards(table: Table, instruction: Extract<Instruction, { verb: "ChooseCards" }>): void {
  const { seats, pool, name, input } = table;
  const order = seats.map((_, index) => index);
  const taken: string[] = [];
  for (const seat of instruction.who === "firstPlayer" ? order.slice(0, 1) : order) {
    const remaining = instruction.codes.filter((code) => !taken.includes(code));
    const options = instruction.to === "hero" ? remaining.flatMap((code) => (seats[seat]?.heroes ?? []).map((hero) => `${code}>${hero}`)) : remaining;
    const answer = takeAnswer(table, instruction.optional ? [...options, "skip"] : options, seat);
    if (answer == null || answer === "skip") continue;
    const [code = "", host] = answer.split(">");
    taken.push(code);
    const printed = printedOf(input.cards, code);
    const hero = host ?? null;
    if (instruction.to === "hero" && hero) seats[seat]?.attachments.push({ host: hero, code });
    if (instruction.to === "hand") seats[seat]?.hand.push(code);
    pool.push(poolCard(printed, code, printed.keywords.permanent ? hero : null, seat));
    table.out.did.push(`Seat ${seat + 1} takes ${name(code)}${hero ? ` onto ${name(hero)}` : instruction.to === "hand" ? " into hand" : ""}.`);
  }
  if (instruction.leftover === "firstPlayerDeck") {
    // The players earned every one of these cards, so the unchosen ones join the pool too, as the first player's: step 7 shuffles
    // them into that deck.
    for (const code of instruction.codes.filter((item) => !taken.includes(item))) {
      pool.push(poolCard(printedOf(input.cards, code), code, null, 0));
      table.out.did.push(`${name(code)} was not chosen: it is shuffled into the first player's deck.`);
    }
  }
}

// Step 6: the campaign card's Setup instructions that deal a card to a player, in the order the card lists them.
function campaignSetupSteps(campaignSetup: readonly Instruction[], input: ChecklistInput, seats: Working[], pool: PoolCard[], fresh: Set<PoolCard>, name: (code: string) => string): Dealing {
  const table: Table = { input, seats, pool, fresh, answers: [...(input.choices ?? [])], name, out: { did: [], errors: [], needs: null } };
  for (const instruction of campaignSetup) {
    if (instruction.verb === "AttachChosen") attachChosen(table, instruction);
    else if (instruction.verb === "AddToHandAfterMulligan") addToHandAfterMulligan(table, instruction);
    else if (instruction.verb === "AddToPool") addToPool(table, instruction);
    else if (instruction.verb === "ChooseCards") chooseCards(table, instruction);
  }
  return table.out;
}

// The pool card's own campaignSetup record puts it into play ("Put Mendor into play at the start of each scenario").
function putsItselfIntoPlay(effects: readonly Effect[], code: string): boolean {
  return recordInstructions(effects, code, "campaignSetup").some((instruction) => instruction.verb === "PutObjectiveAllyIntoPlay" && instruction.code === code);
}

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

  // The pool this checklist works on. A new save's first checklist takes in the cards a finished campaign carried over.
  const pool: PoolCard[] = [...log.campaignPool, ...log.carryIn];
  // Entries the campaign card's own Setup adds (AddToPool): recorded, but not dealt again by steps 7 and 8.
  const fresh = new Set<PoolCard>();

  // 1 and 2: the heroes the players bring against the log, and the fallen list.
  const did1: string[] = log.carryIn.map((card) => `${name(card.code)} is carried over from the last campaign into the Campaign Pool.`);
  let changed = 0;
  const heroesBySeat = input.seats.map((seat, index) => {
    const logged = log.heroesBySeat[index] ?? [];
    if (logged.length === 0) {
      did1.push(`Seat ${index + 1} lists ${seat.heroes.map(name).join(", ")} in the Campaign Log.`);
      return [...seat.heroes];
    }
    const added = seat.heroes.filter((code) => !logged.includes(code));
    const dropped = logged.filter((code) => !seat.heroes.includes(code));
    // The same heroes every scenario, with two exceptions (ltp.fellowship-of-heroes): a fallen hero may be replaced, and
    // a player may trade 1 hero for a new one. A hero still alive is never left out without that trade.
    const droppedFallen = dropped.filter((code) => fallen.has(code)).length;
    const droppedAlive = dropped.filter((code) => !fallen.has(code));
    const trades = Math.max(0, added.length - droppedFallen);
    if (droppedAlive.length > trades) errors.push(`Seat ${index + 1}: ${droppedAlive.map(name).join(", ")} is listed in the Campaign Log and must start unless traded for a new hero`);
    if (trades > 1) errors.push(`Seat ${index + 1}: a player may trade only 1 hero between scenarios`);
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

  const seats: Working[] = input.seats.map((seat, index) => ({ heroes: [...(heroesBySeat[index] ?? [])], deck: [...seat.deck], attachments: [], hand: [], afterMulligan: [] }));

  // 5: Permanent boons and burdens go on their recorded hero.
  const did5: string[] = [];
  for (const card of pool) {
    if (card.attachedTo == null) continue;
    const seat = seats.findIndex((candidate) => candidate.heroes.includes(card.attachedTo ?? ""));
    if (seat < 0) {
      errors.push(`${name(card.code)} is attached to ${name(card.attachedTo)}, who is not one of the heroes starting`);
      continue;
    }
    seats[seat]?.attachments.push({ host: card.attachedTo, code: card.code });
    did5.push(`${name(card.code)} goes on ${name(card.attachedTo)}.`);
  }
  note(5, did5.length > 0 ? did5 : ["No Permanent card is in the pool."]);

  // The campaign card's own Setup choices come before the pool is shuffled in, so the cards they earn join the same decks.
  const six = campaignSetupSteps(campaignSetup, input, seats, pool, fresh, name);
  if (six.needs) return { ok: false, errors, needs: six.needs };
  errors.push(...six.errors);
  // A Permanent card already went on its hero in step 5 (it is not in a deck); the others with a Setup line are found
  // in the deck they are shuffled into (mec109.setup).
  const withSetup = pool.filter((card) => card.attachedTo == null && !fresh.has(card) && input.effects.some((effect) => effect.cardCode === card.code && effect.timing === "setup"));
  const did6 = [...six.did, ...withSetup.map((card) => `${name(card.code)} has a Setup line: the Setup search finds it in its deck.`)];
  note(6, did6.length > 0 ? did6 : ["No boon or burden has a Setup keyword."]);

  // 7 and 8: what is left in the pool joins the decks it is backed for.
  const did7: string[] = [];
  const did8: string[] = [];
  const poolEncounterCards: string[] = [];
  const poolIntoPlay: string[] = [];
  for (const card of pool) {
    if (card.attachedTo != null || fresh.has(card)) continue;
    if (seats.some((seat) => seat.hand?.includes(card.code) || seat.attachments.some((attached) => attached.code === card.code))) continue;
    // A pool card that says "put into play at the start of each scenario" (Mendor) is dealt into play, so it skips step 8.
    if (putsItselfIntoPlay(input.effects, card.code)) {
      poolIntoPlay.push(card.code);
      did8.push(`${name(card.code)} is put into play instead of being shuffled into the encounter deck.`);
      continue;
    }
    if (card.back === "player") {
      const seat = Math.min(card.seat ?? 0, seatCount - 1);
      seats[seat]?.deck.push(card.code);
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
    poolIntoPlay,
    log: { ...log, heroesBySeat, threatPenalty, campaignPool: pool, carryIn: [] },
  };
}
