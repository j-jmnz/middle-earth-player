// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.campaign-pool, ltp.campaign-pool,
// rr.fellowship-of-heroes, mec109.setup (data/rules/entries.json).
import type { Effect, Instruction } from "../catalog/boundary.ts";
import { recordInstructions, type Difficulty, type ScenarioData } from "../catalog/scenario-data.ts";
import { printedOf, type PrintedCard } from "../rules/core/printed.ts";
import { AFTER_HAND, type StartSeat } from "../rules/setup/setup.ts";

import { poolCard, type CampaignLog, type PoolCard } from "./log.ts";
import { fallenWithoutAragorn, freedBy, moveToGranted, sagaOf, sagaSeat } from "./checklist-saga.ts";
import { burdenLeftOut, chooseCopyOrResources, removePoolCards, shuffleIntoEachDeck, type BurdenRemoval } from "./checklist-two-towers.ts";
import { logConditionHolds, poolEncounterCopies, removeFromDeck, searchableCaves, searchableDeck } from "./wilderland.ts";
import { xpRowOf } from "./xp.ts";
import { setAsideBoonWords } from "./return-of-the-king-words.ts";

// The Campaign Setup Checklist as numbered steps. Each step names the rule it follows and says what it did, so the
// briefing screen (phase 10) and a test can show the same eight lines. The answers to the campaign card's own Setup
// choices (Sting and the other boons, the Lórien gifts) come in as option ids, in the order the card asks them.

export type ChecklistStep = { n: number; rule: "rr.campaign-setup-checklist"; text: string; did: string[] };
// The seat while the checklist fills it in; StartSeat is the read-only shape it hands to the start.
type Working = { heroes: string[]; deck: string[]; attachments: { host: string; code: string }[]; hand: string[]; afterMulligan: string[]; chosen?: string[]; setAside?: string[]; threatPenalty?: number; threatRaise?: number; resources?: number };

// `note` says what the choice is when the options alone do not (a search of the encounter deck for cards to remove from the game).
// `words` gives an option that is not a card the words it is shown with (`resources`); a card option is shown as the card.
export type Need = { seat: number; options: readonly string[]; note?: string; words?: Readonly<Record<string, string>> };

export type ChecklistInput = {
  log: CampaignLog;
  scenario: ScenarioData;
  seats: readonly { heroes: readonly string[]; deck: readonly string[] }[];
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
  choices?: readonly string[];
  // The difficulty the scenario is dealt at (Normal when absent): the encounter deck a Setup search looks through is built at it.
  difficulty?: Difficulty;
};

// An encounter-deck copy the campaign pool recorded for a seat: the seat its Setup line acts for (the start sets the copy's controller).
export type PoolEncounterOwner = { code: string; seat: number };

export type ChecklistPlan =
  | { ok: true; steps: ChecklistStep[]; threatModifier: number; forcedPenalty: number; seats: StartSeat[]; poolEncounterCards: string[]; poolEncounterOwners: PoolEncounterOwner[]; poolIntoPlay: string[]; removedFromEncounter: string[]; removedFromCaves: string[]; log: CampaignLog }
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
// `deck` is the encounter deck a Setup search looks through as it stands (the campaign card's own shuffles so far, and the pool's encounter cards), `removed` the codes searched out of it; `caves` and `removedCaves` are the Caves deck's.
type Table = { input: ChecklistInput; seats: Working[]; pool: PoolCard[]; fresh: Set<PoolCard>; aside: Set<PoolCard>; answers: string[]; name: (code: string) => string; out: Dealing; deck: string[]; removed: string[]; caves: string[]; removedCaves: string[]; burdens: BurdenRemoval[] };

// The seat a pool card is dealt to: the seat it was recorded for, or the last seat when the game has fewer.
function poolSeat(card: PoolCard, seatCount: number): number {
  return Math.min(card.seat ?? 0, seatCount - 1);
}

// The next answer for `seat`, if it is one of `legal`. With none left the step needs one; a wrong one is an error.
function takeAnswer(table: Table, legal: readonly string[], seat: number, note?: string, words?: Readonly<Record<string, string>>): string | null {
  const answer = table.answers.shift();
  if (answer == null) {
    table.out.needs ??= { seat, options: legal, ...(note ? { note } : {}), ...(words ? { words } : {}) };
    return null;
  }
  if (!legal.includes(answer)) {
    table.out.errors.push(`Seat ${seat + 1}: ${answer} is not one of ${legal.join(", ")}`);
    return null;
  }
  return answer;
}

// RemoveFromEncounterDeckIfLogged: the search runs in src/campaign/wilderland.ts on the table's working deck; this hands it the answers.
function searchEncounterDeck(table: Table, instruction: Extract<Instruction, { verb: "RemoveFromEncounterDeckIfLogged" }>): void {
  const found = removeFromDeck(instruction, { allyLines: table.input.log.allyLines, cards: table.input.cards, deck: table.deck, take: (legal, note) => takeAnswer(table, legal, 0, note) });
  table.removed.push(...found.removed);
  table.out.did.push(...found.removed.map((code) => `The first player searches the encounter deck and removes ${table.name(code)} from the game.`));
}

// RemoveFromCavesIfLogged: the same search of the Caves deck the scenario deals (12175:A).
function searchCaves(table: Table, instruction: Extract<Instruction, { verb: "RemoveFromCavesIfLogged" }>): void {
  const found = removeFromDeck(instruction, { allyLines: table.input.log.allyLines, cards: table.input.cards, deck: table.caves, take: (legal, note) => takeAnswer(table, legal, 0, note) });
  table.removedCaves.push(...found.removed);
  table.out.did.push(...found.removed.map((code) => `The first player searches the Caves deck and removes ${table.name(code)} from the game.`));
}

// SearchBoonAllyToHand (12175:A), SearchBoonOrTreasureToHand (12195:A), SearchBoonToHand (10193:A:2) and SearchDeckForCard (145066:A:1): each player in turn, first player first, may take a card of their deck that `eligible` names (a pool card that step 7 would shuffle into it, or one the deck holds) into their hand, or skip. `untilFirst`: the offer ends
// with the first who takes one ("a player may search"); otherwise every player is asked ("each player may search"). `firstOnly`: only the first player is asked ("The first player may ... search his deck"). `raise`: the search costs each player's threat that much for this game ("raise each player's threat by 1"), added to every seat's starting threat when the first player takes it.
// Setup follows the opening hand and any mulligan (rr.setup step 7), so the card joins the hand after the mulligan, as AddToHandAfterMulligan's cards do; a pool card stays in the pool but is not shuffled into the deck.
type HandSearch = { eligible: (printed: PrintedCard) => boolean; looksFor: string; untilFirst: boolean; skipped: (seat: number, seatCount: number) => string; firstOnly?: boolean; raise?: number };

function searchToHand(table: Table, search: HandSearch): void {
  const { seats, pool, fresh, input, name } = table;
  const isEligible = (code: string): boolean => {
    const printed = input.cards.get(code);
    return printed != null && search.eligible(printed);
  };
  for (const [index, seat] of (search.firstOnly ? seats.slice(0, 1) : seats).entries()) {
    const pooled = pool.filter((card) => card.attachedTo == null && card.back === "player" && !card.afterHand && !fresh.has(card) && poolSeat(card, seats.length) === index && isEligible(card.code));
    const options = [...new Set([...seat.deck.filter(isEligible), ...pooled.map((card) => card.code)])];
    if (options.length === 0) continue;
    const cost = search.raise != null ? `Raise each player's threat by ${search.raise} to search your deck for ${search.looksFor} and add it to your hand, or skip.` : `Search your deck for ${search.looksFor} to add to your hand, or skip.`;
    const answer = takeAnswer(table, [...options, "skip"], index, `${cost} It joins your hand after the mulligan${search.untilFirst ? ", and if you take one no other player does" : ""}.`);
    if (answer == null) return;
    if (answer === "skip") {
      table.out.did.push(search.skipped(index, seats.length));
      continue;
    }
    const inDeck = seat.deck.indexOf(answer);
    if (inDeck >= 0) seat.deck.splice(inDeck, 1);
    else {
      const taken = pooled.find((card) => card.code === answer);
      if (taken) fresh.add(taken);
    }
    seat.afterMulligan.push(answer);
    if (search.raise != null) {
      for (const each of seats) each.threatRaise = (each.threatRaise ?? 0) + search.raise;
      table.out.did.push(`Each player's threat is raised by ${search.raise} for this game.`);
    }
    table.out.did.push(`Seat ${index + 1} searches their deck for ${name(answer)} and adds it to their hand after the mulligan.`);
    if (search.untilFirst) return;
  }
}

const searchBoonAlly = (table: Table): void => searchToHand(table, { eligible: (printed) => printed.type === "ally" && printed.isUnique && printed.campaignKind === "boon", looksFor: "a unique boon ally", untilFirst: true, skipped: (seat) => `Seat ${seat + 1} does not search for a boon ally.` });
// SearchDeckForCard: the first player alone may pay the threat to search for the named card.
const searchDeckForCard = (table: Table, instruction: Extract<Instruction, { verb: "SearchDeckForCard" }>): void =>
  searchToHand(table, { eligible: (printed) => printed.code === instruction.code, looksFor: table.name(instruction.code), untilFirst: true, firstOnly: true, raise: instruction.raiseThreat, skipped: () => `The first player does not search for ${table.name(instruction.code)}.` });
const searchBoon = (table: Table): void => searchToHand(table, { eligible: (printed) => printed.campaignKind === "boon", looksFor: "a boon card", untilFirst: false, skipped: (seat, seatCount) => `${seatCount === 1 ? "You do" : `Player ${seat + 1} does`} not search for a boon card.` });
const searchBoonOrTreasure = (table: Table): void => searchToHand(table, { eligible: (printed) => printed.campaignKind === "boon" || printed.campaignKind === "treasure", looksFor: "a boon or treasure card", untilFirst: false, skipped: (seat, seatCount) => `${seatCount === 1 ? "You do" : `Player ${seat + 1} does`} not search for a boon or treasure card.` });

// SetAsideBoon (146069:A:1): each player in turn, first player first, chooses a boon of the whole campaign pool with the trait, other than `except`, and sets it aside, out of play (the card says "from the campaign pool", not from their own boons). The set-aside boon is the chooser's:
// it is left out of the decks this game and stays in the pool. A copy the chooser's own seat holds is taken before another seat's. A player with no boon left to choose chooses nothing; a game with no pool (a standalone one) has no campaign card and never gets here.
function setAsideBoon(table: Table, instruction: Extract<Instruction, { verb: "SetAsideBoon" }>): void {
  const { seats, pool, fresh, input, name } = table;
  for (const [index, seat] of seats.entries()) {
    const eligible = (code: string): boolean => {
      const printed = input.cards.get(code);
      return printed != null && printed.campaignKind === "boon" && printed.traits.includes(instruction.trait) && code !== instruction.except;
    };
    const pooled = pool.filter((card) => card.attachedTo == null && card.back === "player" && !fresh.has(card) && !table.aside.has(card) && eligible(card.code));
    const options = [...new Set(pooled.map((card) => card.code))];
    if (options.length === 0) continue;
    const answer = takeAnswer(table, options, index, setAsideBoonWords(instruction.trait));
    if (answer == null) return;
    const taken = pooled.find((card) => card.code === answer && poolSeat(card, seats.length) === index) ?? pooled.find((card) => card.code === answer);
    if (taken) table.aside.add(taken);
    seat.setAside = [...(seat.setAside ?? []), answer];
    table.out.did.push(`Seat ${index + 1} sets ${name(answer)} aside, out of play.`);
  }
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
  // A card the pool already holds (a scenario started again from the log it wrote) is not added a second time.
  if (!instruction.eachPlayer && table.pool.some((card) => card.code === instruction.code && card.attachedTo == null)) return;
  const printed = printedOf(table.input.cards, instruction.code);
  for (const seat of instruction.eachPlayer ? table.seats.map((_, index) => index) : [null]) {
    const added = poolCard(printed, instruction.code, null, seat, instruction.eachPlayer === true);
    table.pool.push(added);
    table.fresh.add(added);
  }
  table.out.did.push(`${table.name(instruction.code)} joins the Campaign Pool${instruction.eachPlayer ? " (a copy for each player)" : ""}.`);
}

// ChooseCards: each seat in turn takes a card (the first player alone, every player, or whichever one player takes it: the offer ends with the first taker). The cards a choice earns join the pool, a
// hand or a hero; only a Permanent card stays recorded on its hero (ltp.campaign-pool): another gift goes on the hero for this
// scenario and is shuffled into a deck in later ones.
function chooseCards(table: Table, instruction: Extract<Instruction, { verb: "ChooseCards" }>): void {
  const { seats, pool, name, input } = table;
  const order = seats.map((_, index) => index);
  const taken: string[] = [];
  // Cards that share a title (the four Galdor's Counsel) are told apart by their sphere in the lines below.
  const titles = instruction.codes.filter((code) => input.cards.has(code)).map((code) => name(code));
  const same = (code: string): boolean => input.cards.has(code) && titles.filter((title) => title === name(code)).length > 1;
  // The Campaign Log sheet's row names the copy ("Galdor's Counsel (Leadership)"): the data gives all four copies the neutral sphere.
  const sphereOf = (code: string): string => {
    const row = xpRowOf(code)?.name ?? "";
    return same(code) && row.startsWith(name(code)) ? row.slice(name(code).length) : "";
  };
  const offered = new Set(titles).size === 1 ? (titles[0] ?? "the offer") : "the offer";
  let offerOpen = true;
  for (const seat of instruction.who === "firstPlayer" ? order.slice(0, 1) : order) {
    if (!offerOpen) break;
    const remaining = instruction.codes.filter((code) => !taken.includes(code));
    const options = instruction.to === "hero" ? remaining.flatMap((code) => (seats[seat]?.heroes ?? []).map((hero) => `${code}>${hero}`)) : remaining;
    const answer = takeAnswer(table, instruction.optional ? [...options, "skip"] : options, seat);
    if (answer === "skip") table.out.did.push(`Seat ${seat + 1} skips ${offered}.`);
    if (answer == null || answer === "skip") continue;
    const [code = "", host] = answer.split(">");
    taken.push(code);
    if (instruction.who === "onePlayer") offerOpen = false;
    const printed = printedOf(input.cards, code);
    const hero = host ?? null;
    if (instruction.to === "hero" && hero) seats[seat]?.attachments.push({ host: hero, code });
    // A card that joins the hand once the mulligan is over cannot be shuffled into the deck by it (rr.mulligan); an unearned one is also recorded as chosen (ScenarioState.chosenAtSetup).
    if (instruction.to === "hand") (instruction.afterMulligan ? seats[seat]?.afterMulligan : seats[seat]?.hand)?.push(code);
    const chosenBySeat = seats[seat];
    if (instruction.unearned && chosenBySeat) chosenBySeat.chosen = [...(chosenBySeat.chosen ?? []), code];
    // An unearned card is only dealt: the scenario's Resolution decides whether it joins the pool (11182:B:2).
    if (!instruction.unearned) pool.push(poolCard(printed, code, printed.keywords.permanent ? hero : null, seat));
    table.out.did.push(`Seat ${seat + 1} takes ${name(code)}${sphereOf(code)}${hero ? ` onto ${name(hero)}` : instruction.to === "hand" ? " into hand" : ""}.`);
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
function campaignSetupSteps(campaignSetup: readonly Instruction[], input: ChecklistInput, seats: Working[], pool: PoolCard[], fresh: Set<PoolCard>, name: (code: string) => string): Dealing & { removed: string[]; removedCaves: string[]; leftOut: (card: PoolCard) => boolean; aside: ReadonlySet<PoolCard> } {
  const table: Table = { input, seats, pool, fresh, aside: new Set(), answers: [...(input.choices ?? [])], name, out: { did: [], errors: [], needs: null }, deck: searchableDeck(input.scenario, input.difficulty, input.seats.length, [...encounterDeal(pool, input.effects, campaignSetup, input.cards, () => false).map((card) => card.code), ...poolEncounterCopies(input.log.encounterPool)]), removed: [], caves: searchableCaves(input.scenario, input.difficulty), removedCaves: [], burdens: [] };
  for (const instruction of campaignSetup) {
    // A line that shuffles a card into the encounter deck puts it where the searches after it look (the Setup lines run in print order).
    if (instruction.verb === "ShuffleIntoEncounterDeck" && logConditionHolds(instruction.when, input.log)) table.deck.push(instruction.code);
    if (instruction.verb === "AttachChosen") attachChosen(table, instruction);
    else if (instruction.verb === "AddToHandAfterMulligan") addToHandAfterMulligan(table, instruction);
    else if (instruction.verb === "AddToPool") addToPool(table, instruction);
    else if (instruction.verb === "ChooseCards") chooseCards(table, instruction);
    else if (instruction.verb === "RemoveFromEncounterDeckIfLogged") searchEncounterDeck(table, instruction);
    else if (instruction.verb === "RemoveFromCavesIfLogged") searchCaves(table, instruction);
    else if (instruction.verb === "SearchBoonAllyToHand") searchBoonAlly(table);
    else if (instruction.verb === "SearchBoonOrTreasureToHand") searchBoonOrTreasure(table);
    else if (instruction.verb === "SearchBoonToHand") searchBoon(table);
    else if (instruction.verb === "SearchDeckForCard") searchDeckForCard(table, instruction);
    else if (instruction.verb === "SetAsideBoon") setAsideBoon(table, instruction);
    else if (instruction.verb === "RemovePoolCards") table.out.did.push(...removePoolCards(table.pool, table.seats, instruction).map((code) => `${table.name(code)} is removed from the Campaign Pool.`));
    else if (instruction.verb === "RemoveBurdenSets") table.burdens.push({ sets: instruction.sets, playerDecks: instruction.playerDecks === true });
    else if (instruction.verb === "ShuffleIntoEachDeck") {
      shuffleIntoEachDeck(table.seats, instruction);
      table.out.did.push(`Each player shuffles a copy of ${table.name(instruction.code)} into their deck.`);
    } else if (instruction.verb === "ChooseCopyOrResources") table.out.did.push(...chooseCopyOrResources(table.seats, instruction, (legal, seat, ask) => takeAnswer(table, legal, seat, ask.note, ask.words), table.name));
  }
  return { ...table.out, removed: table.removed, removedCaves: table.removedCaves, leftOut: (card) => burdenLeftOut(table.burdens, card), aside: table.aside };
}

// The pool card's own campaignSetup record puts it into play ("Put Mendor into play at the start of each scenario").
function putsItselfIntoPlay(effects: readonly Effect[], code: string): boolean {
  return recordInstructions(effects, code, "campaignSetup").some((instruction) => instruction.verb === "PutObjectiveAllyIntoPlay" && instruction.code === code);
}

// The pool entries the deal shuffles into the encounter deck (step 8): not attached, not skipped by the caller (set by the campaign card's Setup or already dealt),
// backed by the encounter deck, not shuffled into a player's deck after the hand, and not put into play by their own record. The one definition the Setup searches and step 8 share.
function encounterDeal(pool: readonly PoolCard[], effects: readonly Effect[], campaignSetup: readonly Instruction[], cards: ReadonlyMap<string, PrintedCard>, skipped: (card: PoolCard) => boolean): PoolCard[] {
  return pool.filter((card) => card.attachedTo == null && !skipped(card) && card.back === "encounter" && !card.afterHand && !putsItselfIntoPlay(effects, card.code) && !dealtByCampaignSetup(campaignSetup, card.code, cards));
}

// A pool side quest the campaign card's own Setup deals each game: "Add Protect the Innocent to the staging area", or "add Mysterious Omens to the Campaign Log and shuffle it into the encounter deck" (AddToPool with the shuffle, The Weather Hills, 10159:A:2). A side quest in the pool is the
// one physical card the Setup deals, so step 8 does not shuffle a second copy in. A burden or boon the Setup also shuffles in is another copy, and step 8 still deals the pool's.
function dealtByCampaignSetup(campaignSetup: readonly Instruction[], code: string, cards: ReadonlyMap<string, PrintedCard>): boolean {
  if (cards.get(code)?.type !== "encounter-side-quest") return false;
  const named = (verb: Instruction["verb"]): boolean => campaignSetup.some((instruction) => instruction.verb === verb && "code" in instruction && instruction.code === code && !("when" in instruction && instruction.when != null));
  return named("AddToStaging") || (named("AddToPool") && named("ShuffleIntoEncounterDeck"));
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

  // The pool this checklist works on. A new save's first checklist takes in the cards a finished campaign carried over.
  let pool: PoolCard[] = [...log.campaignPool, ...log.carryIn];
  // Entries the campaign card's own Setup adds (AddToPool): recorded, but not dealt again by steps 7 and 8.
  const fresh = new Set<PoolCard>();

  // The saga hero of a Two Towers scenario (src/campaign/checklist-saga.ts): ☺ Aragorn is granted, not listed in the log, and a logged Aragorn or Fellowship hero is
  // handled by mec112.campaign-mode-aragorn. Every other scenario reads as before (`saga.active` false).
  const saga = sagaOf(scenario, cards);
  const { fallenLists, forcedPenalty } = fallenWithoutAragorn(saga, log.fallenHeroesBySeat);
  const fallen = new Set(fallenLists.flat());

  // 1 and 2: the heroes the players bring against the log, and the fallen list.
  const did1: string[] = log.carryIn.map((card) => `${name(card.code)} is carried over from the last campaign into the Campaign Pool.`);
  let changed = 0;
  const forgotten = new Set<string>();
  // What each seat plays (the granted hero included) and what its log lists afterwards (the granted hero never; the Fellowship heroes the saga keeps).
  const dealtBySeat: string[][] = [];
  const heroesBySeat = input.seats.map((seat, index) => {
    const dealt = [...seat.heroes];
    dealtBySeat.push(dealt);
    const logged = log.heroesBySeat[index] ?? [];
    const playing = dealt.filter((code) => code !== saga.granted);
    if (logged.length === 0) {
      did1.push(`Seat ${index + 1} lists ${playing.map(name).join(", ")} in the Campaign Log.`);
      return playing;
    }
    // The Aragorn rule: that player loses control of the logged version, and the hero who replaces him costs no +1.
    const { lost, keptSaga, loggedPlayers, playersNow } = sagaSeat(saga, logged, playing);
    for (const code of lost) forgotten.add(code);
    const added = playersNow.filter((code) => !loggedPlayers.includes(code));
    const dropped = loggedPlayers.filter((code) => !playersNow.includes(code));
    // The same heroes every scenario, with two exceptions (ltp.fellowship-of-heroes): a fallen hero may be replaced, and
    // a player may trade 1 hero for a new one. A hero still alive is never left out without that trade.
    const droppedFallen = dropped.filter((code) => fallen.has(code)).length;
    const droppedAlive = dropped.filter((code) => !fallen.has(code));
    const freed = freedBy(lost, added);
    const trades = Math.max(0, added.length - droppedFallen - freed);
    if (droppedAlive.length > trades) errors.push(`Seat ${index + 1}: ${droppedAlive.map(name).join(", ")} is listed in the Campaign Log and must start unless traded for a new hero`);
    if (trades > 1) errors.push(`Seat ${index + 1}: a player may trade only 1 hero between scenarios`);
    for (const code of dropped) {
      const carrying = log.campaignPool.find((card) => card.attachedTo === code && printedOf(cards, card.code).keywords.permanent);
      if (carrying && !fallen.has(code)) errors.push(`${name(code)} carries ${name(carrying.code)}, a Permanent card that must be attached to that hero at the start`);
    }
    changed += added.length - freed;
    if (lost.length > 0) did1.push(`Seat ${index + 1} loses control of ${lost.map(name).join(", ")}: ☺ ${name(saga.granted ?? "")} takes ${lost.length === 1 ? "his" : "their"} place${added.length > 0 ? `, and ${added.map(name).join(", ")} replaces ${lost.length === 1 ? "him" : "them"} without the +1 penalty` : ""}.`);
    if (added.length > freed) did1.push(`Seat ${index + 1} changes ${dropped.map(name).join(", ") || "nothing"} for ${added.map(name).join(", ")}.`);
    // The log keeps the Fellowship heroes it holds (the Ring-bearer Frodo while ☺ Aragorn is granted), and lists the new line-up after them.
    return saga.active ? [...keptSaga.filter((code) => !playing.includes(code)), ...playing] : playing;
  });
  note(1, did1.length > 0 ? did1 : ["Every player is using the heroes listed in the log."]);
  const unfit = input.seats.flatMap((seat, index) => seat.heroes.filter((code) => fallen.has(code)).map((code) => `Seat ${index + 1}: ${name(code)} is a fallen hero and cannot start`));
  errors.push(...unfit);
  note(2, unfit.length > 0 ? unfit : ["No hero is listed as fallen."]);

  // 3 and 4: the threat penalty.
  const added = waived ? 0 : changed;
  const threatPenalty = log.threatPenalty + added + forcedPenalty;
  note(3, [...(changed === 0 ? ["No hero was changed."] : waived ? [`${changed} hero change(s) cost nothing: the campaign card waives the +1 penalty.`] : [`${changed} hero change(s) add ${changed} to the threat penalty.`]), ...(forcedPenalty > 0 ? ["Aragorn leaves the list of fallen heroes: each player takes a permanent +1 threat penalty (mec112.campaign-mode-aragorn)."] : [])]);
  const extra = Array.from({ length: seatCount }, (_, index) => log.threatPenaltyBySeat[index] ?? 0);
  // A starting threat modifier in words: "plus 3", "minus 2" (a reduction, 10173:A:2), at least 0 once it is a reduction.
  const modifier = (amount: number): string => (amount < 0 ? `minus ${-amount}, and at least 0` : `plus ${amount}`);
  note(4, [`Each player's starting threat is the combined threat cost of their heroes ${modifier(threatPenalty)}.`, ...extra.flatMap((more, index) => (more > 0 ? [`Seat ${index + 1} takes a permanent +${more} starting threat penalty of its own: its starting threat is the combined threat cost of its heroes ${modifier(threatPenalty + more)}.`] : []))]);

  const seats: Working[] = input.seats.map((seat, index) => ({ heroes: [...(dealtBySeat[index] ?? [])], deck: [...seat.deck], attachments: [], hand: [], afterMulligan: [], ...((extra[index] ?? 0) > 0 ? { threatPenalty: extra[index] } : {}) }));

  // The cards with the Permanent keyword on a logged Aragorn move to ☺ Aragorn (mec112.campaign-mode-aragorn).
  pool = moveToGranted(pool, forgotten, saga);

  // 5: Permanent boons and burdens go on their recorded hero. A hero of the saga who is not starting this scenario (the Ring-bearer Frodo while ☺ Aragorn is granted, ☺ Aragorn
  // in the Ring-bearer scenarios) keeps the card in the pool.
  // A card the campaign card's Setup removes from the pool (step 6) is not attached: step 6 says it is removed.
  const removedAtSetup = new Set(campaignSetup.flatMap((instruction) => (instruction.verb === "RemovePoolCards" ? instruction.codes : [])));
  const did5: string[] = [];
  for (const card of pool) {
    if (card.attachedTo == null || removedAtSetup.has(card.code)) continue;
    const seat = seats.findIndex((candidate) => candidate.heroes.includes(card.attachedTo ?? ""));
    if (seat < 0) {
      if (saga.active && saga.ofSaga(card.attachedTo)) {
        did5.push(`${name(card.code)} stays with ${name(card.attachedTo)}, who is not in this scenario.`);
        continue;
      }
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
  const dealt = (card: PoolCard): boolean => seats.some((seat) => seat.hand.includes(card.code) || seat.attachments.some((attached) => attached.code === card.code));
  const withSetup = pool.filter((card) => card.attachedTo == null && !fresh.has(card) && !dealt(card) && input.effects.some((effect) => effect.cardCode === card.code && effect.timing === "setup"));
  const did6 = [...six.did, ...withSetup.map((card) => `${name(card.code)} has a Setup line: the Setup search finds it in its deck.`)];
  note(6, did6.length > 0 ? did6 : ["No boon or burden has a Setup keyword."]);

  // 7 and 8: what is left in the pool joins the decks it is backed for.
  const did7: string[] = [];
  const did8: string[] = [];
  const poolEncounterCards: string[] = [];
  const poolEncounterOwners: PoolEncounterOwner[] = [];
  const poolIntoPlay: string[] = [];
  const toDeck = new Set(encounterDeal(pool, input.effects, campaignSetup, input.cards, (card) => fresh.has(card) || dealt(card) || six.leftOut(card)));
  for (const card of pool) {
    if (card.attachedTo != null || fresh.has(card)) continue;
    if (dealt(card)) continue;
    // A boon the campaign card's Setup had its player set aside stays in the pool and is not dealt (SetAsideBoon).
    if (six.aside.has(card)) {
      did7.push(`${name(card.code)} is set aside, out of play: it is left out of the decks.`);
      continue;
    }
    // A burden of a set the campaign card's Setup removes stays in the pool and is not dealt (RemoveBurdenSets).
    if (six.leftOut(card)) {
      (card.back === "player" || card.afterHand ? did7 : did8).push(`${name(card.code)} stays in the pool: its burden set is removed from the decks this scenario.`);
      continue;
    }
    if (toDeck.has(card)) {
      poolEncounterCards.push(card.code);
      // A copy recorded for a seat whose Setup line acts for that seat (Overcome by Fear's dial) keeps the seat into the encounter deck.
      if (card.seat != null && input.effects.some((effect) => effect.cardCode === card.code && effect.timing === "setup")) poolEncounterOwners.push({ code: card.code, seat: poolSeat(card, seatCount) });
      did8.push(`${name(card.code)} is shuffled into the encounter deck.`);
      continue;
    }
    // A pool card that says "put into play at the start of each scenario" (Mendor) is dealt into play, so it skips step 8.
    if (putsItselfIntoPlay(input.effects, card.code)) {
      poolIntoPlay.push(card.code);
      did8.push(`${name(card.code)} is put into play instead of being shuffled into the encounter deck.`);
      continue;
    }
    // A side quest the campaign card's own Setup deals (Protect the Innocent, Mysterious Omens) is the one physical card that Setup puts in play: no deck takes a copy of it.
    if (card.back === "encounter" && dealtByCampaignSetup(campaignSetup, card.code, input.cards)) {
      did8.push(`${name(card.code)} is dealt by the campaign card's Setup, not shuffled into a deck.`);
      continue;
    }
    // Shuffled into the chosen player's deck once the starting hand is drawn (11197:B:1): dealt after the mulligan (setup.ts, AFTER_HAND).
    const seat = poolSeat(card, seatCount);
    if (card.afterHand) {
      seats[seat]?.afterMulligan.push(`${AFTER_HAND}${card.code}`);
      did7.push(`${name(card.code)} is shuffled into seat ${seat + 1}'s deck after the starting hand is drawn.`);
    } else {
      seats[seat]?.deck.push(card.code);
      did7.push(`${name(card.code)} is shuffled into seat ${seat + 1}'s deck.`);
    }
  }
  // The encounter cards the pool tallies join every encounter deck, whatever their set (emce.campaign-pool-encounter).
  poolEncounterCards.push(...poolEncounterCopies(log.encounterPool));
  for (const code of Object.keys(log.encounterPool).sort()) {
    const copies = log.encounterPool[code] ?? 0;
    did8.push(`${copies === 1 ? "A copy" : `${copies} copies`} of ${name(code)} ${copies === 1 ? "is" : "are"} shuffled into the encounter deck, whatever the encounter set.`);
  }
  note(7, did7.length > 0 ? did7 : ["No player-backed card is in the pool."]);
  note(8, did8.length > 0 ? did8 : ["No encounter-backed card is in the pool."]);

  if (errors.length > 0) return { ok: false, errors, needs: null };
  return {
    ok: true,
    steps,
    threatModifier: threatPenalty,
    forcedPenalty,
    seats,
    poolEncounterCards,
    poolEncounterOwners,
    poolIntoPlay,
    removedFromEncounter: six.removed,
    removedFromCaves: six.removedCaves,
    log: { ...log, heroesBySeat, fallenHeroesBySeat: fallenLists, threatPenalty, campaignPool: pool, carryIn: [] },
  };
}
