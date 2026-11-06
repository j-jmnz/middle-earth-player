// Rules: ltp.campaign-cards, rr.campaign-cards, ltp.campaign-pool, rr.campaign-pool, rr.first-player
// (data/rules/entries.json).
//
// What the resolution screen shows for the open scenario: Defeat (a loss writes nothing), the choice the campaign card's
// Resolution is asking now (one seat at a time when the card says each player chooses, starting with the first player, as
// 141044:B:1 does), or, once every choice is answered, what confirming will write. The options are the ChooseResolution
// intents the reducer lists; the screen sends the one the player picks and nothing else. A choice the card lets a seat pass
// ("each player may choose") lists the reducer's `skip` as `decline`, a visible "No boon", not as one more tile.
import { andList, carryVerb, carryWords } from "./carry-words.ts";
import { legalIntents, type ScenarioState } from "../rules/engine/reduce.ts";
import { answeredSeats, asksPlayers, resolutionResult, SKIP } from "../rules/setup/resolution.ts";
import { isEncounterOption, LOG_LINE, poolTally, removalCode, removalSeat } from "../rules/families/wilderland/pool.ts";
import { ALLY_LINE_FACTS, BELDIS_BOXES, type AllyLine } from "../catalog/ally-lines.ts";

import { contextOf } from "./session.ts";
import type { World } from "./world.ts";
import { afterwardsWords } from "./resolution-then.ts";
import { beldisUsed, cappedTally } from "./wilderland.ts";

// `label`: the words on the tile ("Tireless Ranger on Sam Gamgee", "Turayn for Player 1"). `wide`: a tile with no card, laid in a row of its own under the card tiles (the log line). `tag` is a muted
// word under the name that tells a kind apart (an encounter card of the pool), `copies` the copies of such a card the pool holds.
// `held`: a burden among the Hazard cards that this Resolution has already earned for the pool, so choosing it adds nothing.
export type ResolutionTile = { optionId: string; code: string | null; name: string; hero: string | null; label: string; wide?: true; tag?: string; copies?: number; held?: true };

// The decline of an optional choice: the reducer's `skip` option, with its words ("No boon").
export type ResolutionDecline = { optionId: string; label: string };

// A choice a seat already confirmed in this group: its words ("Tireless Ranger on Sam Gamgee", "No boon").
export type ResolutionAnswer = { seat: number; words: string };

// A card the log will hold, with the hero it goes on when it is attached.
export type SettledCard = { code: string; hero: string | null; seat: number | null };

export type ResolutionView =
  | { kind: "playing" }
  | { kind: "lost"; reason: string | null }
  | {
      kind: "choosing";
      step: number;
      seat: number;
      seatCount: number;
      eyebrow: string;
      seatLabel: string | null;
      // What is chosen: boon, burden, card or captive.
      noun: string;
      // The card the Resolution already added to the pool, when the choice is the other burden of The King's Quest (12170:B:3): the burden chosen joins it.
      joins?: string;
      // The boon ally the choice is about, when it is one (BoonAllyOrLogLine): what the log line is traded for, and what the line does at later campaign cards' Setups.
      ally: string | null;
      later: string | null;
      answered: readonly ResolutionAnswer[];
      tiles: readonly ResolutionTile[];
      decline: ResolutionDecline | null;
      // `player`: the card is for a player, named by one of their heroes, and goes into their deck after the starting hand (11197:B:1).
      // `ally`: a boon ally for a player, or the log line instead (emce.boon-allies). `removal`: a card of the Campaign Pool a player may remove (12187:B:4). `location`: a location in the staging area a copy of which joins the pool (12184:B:4).
      to: "pool" | "hand" | "hero" | "captive" | "player" | "ally" | "removal" | "treasure" | "location" | "hazard";
      // The first player chooses one of the cards named for the group and the others do not join the pool (12189:B:5).
      only?: true;
      // The choice is of Song boons (The Withered Heath, 12175:B:6): each player takes one, a Song only once.
      songs?: true;
      // What the instructions after this choice do to the campaign pool, in words (12193:B:4, 12193:B:5): told with the choice, since confirming it runs them.
      then?: readonly string[];
    }
  | {
      kind: "settled";
      earned: readonly SettledCard[];
      fallen: readonly string[];
      captives: readonly string[];
      prisoner?: string;
      // The cards whose once-per-campaign Action was used, written to the log's "Used this campaign" (41044:A:3).
      used?: readonly string[];
      // Cards the log keeps for the next campaign (01131:B:2), a copy for each player when `eachPlayer`.
      carried?: readonly { code: string; eachPlayer: boolean }[];
      // The Ered Mithrin log (emce.treasure, emce.boon-allies, emce.campaign-pool-encounter): the treasures discovered, the lines recorded, and the encounter cards that join or leave the pool, a code once for each copy.
      treasures?: readonly string[];
      lines?: readonly AllyLine[];
      poolAdded?: readonly string[];
      poolRemoved?: readonly string[];
      // The boxes this game marks beside Beldis (emce.campaign-log): one phrase a seat whose count rose.
      beldis?: readonly string[];
    };

// The boxes beside Beldis this game marks (the Action of 12188 marks one for the player who used it), one sentence a seat whose count rose above the log's (`logged`), in the log screen's count: "Player 1 marks 1 box beside Beldis (3 of 4 marked)", solo "You mark 1 box ...".
function beldisBoxes(state: ScenarioState, logged: readonly number[]): { beldis?: readonly string[] } {
  const uses = state.campaignFacts?.beldisUses ?? [];
  const rows = uses.flatMap((used, seat) => {
    const now = beldisUsed({ beldisUses: uses }, seat);
    const rose = now - beldisUsed({ beldisUses: logged }, seat);
    if (rose <= 0) return [];
    return [`${state.seatCount > 1 ? `Player ${seat + 1} marks` : "You mark"} ${rose} ${rose === 1 ? "box" : "boxes"} beside Beldis (${now} of ${BELDIS_BOXES} marked)`];
  });
  return rows.length > 0 ? { beldis: rows } : {};
}

function nameOf(world: World, code: string): string {
  return world.cards.get(code)?.name ?? code;
}

// The copies the Resolution added to and took from the pool's encounter cards: its tally against the one the game started from, a code once for each copy.
function poolChanges(state: ScenarioState, tally: Readonly<Record<string, number>> | undefined): { added: string[]; removed: string[] } {
  const was = state.campaignFacts?.encounterPool ?? {};
  const added: string[] = [];
  const removed: string[] = [];
  for (const code of new Set([...Object.keys(was), ...Object.keys(tally ?? was)])) {
    const change = (tally ?? was)[code] ?? 0;
    const before = was[code] ?? 0;
    (change > before ? added : removed).push(...Array.from({ length: Math.abs(change - before) }, () => code));
  }
  return { added, removed };
}

// A card of the Campaign Pool a player may remove: an encounter card the pool tallies (with its copies and a tag that tells it from the pool's own cards), or a card of the pool, told by its player's seat
// when two players hold the same one (`shared`).
function removalTile(world: World, optionId: string, tally: Readonly<Record<string, number>>, shared: boolean): ResolutionTile {
  const code = removalCode(optionId);
  const name = nameOf(world, code);
  if (isEncounterOption(optionId)) {
    const copies = tally[code] ?? 1;
    return { optionId, code, name, hero: null, label: name, tag: copies > 1 ? `encounter card \u00b7 ${copies} copies` : "encounter card", copies };
  }
  const seat = removalSeat(optionId);
  return { optionId, code, name, hero: null, label: shared && seat != null ? `${name} (Player ${seat + 1})` : name };
}

// `logged`: the boxes beside Beldis the campaign log holds before this game (the save's log), so the view names only the marks this game adds.
export function resolutionView(state: ScenarioState, world: World, logged: readonly number[] = []): ResolutionView {
  if (state.lost) return { kind: "lost", reason: state.lossReason };
  const settled = resolutionResult(state);
  if (settled) {
    // The tally the log will hold: the copies are capped at what one collection holds (applyResolution).
    const changes = poolChanges(state, settled.encounterPool ? cappedTally(settled.encounterPool, world.copies) : undefined);
    const gone = [...changes.removed, ...(settled.poolRemoved ?? []).map((item) => item.code)];
    return {
      kind: "settled",
      ...((settled.treasures ?? []).length > 0 ? { treasures: [...(settled.treasures ?? [])] } : {}),
      ...((settled.allyLines ?? []).length > 0 ? { lines: [...(settled.allyLines ?? [])] } : {}),
      ...(changes.added.length > 0 ? { poolAdded: changes.added } : {}),
      ...(gone.length > 0 ? { poolRemoved: gone } : {}),
      ...beldisBoxes(state, logged),
      earned: settled.earned.map((item) => ({ code: item.code, hero: item.to === "hero" ? item.hero : null, seat: item.seat })),
      fallen: [...settled.fallen],
      captives: settled.captives.map((item) => item.hero),
      ...(settled.prisoner ? { prisoner: settled.prisoner } : {}),
      ...((state.campaignFacts?.usedOnce.length ?? 0) > 0 ? { used: [...new Set(state.campaignFacts?.usedOnce ?? [])] } : {}),
      ...(settled.carryOver && settled.carryOver.length > 0 ? { carried: settled.carryOver.map((item) => ({ code: item.code, eachPlayer: item.perPlayer === true })) } : {}),
    };
  }
  const window = state.window;
  if (!state.stageCleared || window?.kind !== "resolution") return { kind: "playing" };
  const instruction = state.resolution[window.step];
  if (!asksPlayers(instruction)) return { kind: "playing" };
  let decline: ResolutionDecline | null = null;
  let eyebrow = "Name a captive";
  let noun = "captive";
  if (instruction.verb === "BoonAllyOrLogLine") {
    noun = "ally";
    eyebrow = `${nameOf(world, instruction.ally)} or the log`;
  } else if (instruction.verb === "RemoveFromPool") {
    noun = "card";
    eyebrow = "Remove a card from the pool";
  } else if (instruction.verb === "ChooseStagedLocationForPool") {
    noun = "location";
    eyebrow = "Choose a location from the staging area";
  } else if (instruction.verb === "ChooseHazardForPool") {
    noun = "Hazard card";
    eyebrow = "Choose a Hazard card for the pool";
  } else if (instruction.verb === "ChooseRandomTreasure") {
    noun = "treasure";
    eyebrow = "Choose a treasure";
  } else if (instruction.verb === "ChooseCards") {
    const kinds = new Set(instruction.codes.map((code) => world.cards.get(code)?.campaignKind ?? null));
    const sung = instruction.codes.length > 0 && instruction.codes.every((code) => world.cards.get(code)?.traits.includes("Song") === true);
    noun = sung ? "Song boon" : kinds.size === 1 && kinds.has("burden") ? "burden" : kinds.size === 1 && kinds.has("boon") ? "boon" : "card";
    eyebrow = instruction.to === "player" ? "Choose a player" : `Choose a ${noun}`;
  }
  const intents = legalIntents(state, contextOf(world));
  const removable = instruction.verb === "RemoveFromPool" ? intents.flatMap((intent) => (intent.type === "ChooseResolution" && intent.optionId !== SKIP ? [removalCode(intent.optionId)] : [])) : [];
  const tally = poolTally(state);
  const tiles: ResolutionTile[] = intents.flatMap((intent): ResolutionTile[] => {
    if (intent.type !== "ChooseResolution") return [];
    if (intent.optionId === SKIP) {
      decline = { optionId: SKIP, label: instruction.verb === "RemoveFromPool" ? "Remove nothing" : `No ${noun}` };
      return [];
    }
    if (instruction.verb === "NameCaptives") {
      const code = state.cards[intent.optionId]?.code ?? intent.optionId;
      const name = nameOf(world, code);
      return [{ optionId: intent.optionId, code, name, hero: null, label: name }];
    }
    // The log line is a tile with no card: the line as the Campaign Log prints it, in a row of its own.
    if (instruction.verb === "BoonAllyOrLogLine" && intent.optionId === LOG_LINE) {
      const words = ALLY_LINE_FACTS[instruction.line].words;
      return [{ optionId: LOG_LINE, code: null, name: words, hero: null, label: words, wide: true }];
    }
    if (instruction.verb === "ChooseHazardForPool") {
      const code = state.cards[intent.optionId.slice(2)]?.code ?? "";
      const name = nameOf(world, code);
      const burden = intent.optionId.startsWith("b:");
      return [{ optionId: intent.optionId, code, name, hero: null, label: name, tag: burden ? "burden" : "encounter card", ...(burden && state.resolutionLog.earned.some((item) => item.code === code) ? { held: true as const } : {}) }];
    }
    if (instruction.verb === "ChooseStagedLocationForPool") return [{ optionId: intent.optionId, code: intent.optionId, name: nameOf(world, intent.optionId), hero: null, label: nameOf(world, intent.optionId) }];
    if (instruction.verb === "RemoveFromPool") return [removalTile(world, intent.optionId, tally, state.seatCount > 1 && removable.filter((code) => code === removalCode(intent.optionId)).length > 1)];
    const [code = "", heroId] = intent.optionId.split(">");
    const hero = heroId ? state.cards[heroId] : undefined;
    const heroCode = hero?.code;
    const name = nameOf(world, code);
    const heroName = heroCode ? nameOf(world, heroCode) : null;
    // A card for a player (a boon ally, or Recurring Nightmare) joins that player's pool or deck, not the hero that names them: "Turayn for Player 1", the card alone in a solo game.
    if (instruction.verb === "BoonAllyOrLogLine" || (instruction.verb === "ChooseCards" && instruction.to === "player")) return [{ optionId: intent.optionId, code, name, hero: heroName, label: state.seatCount > 1 && hero?.controller != null ? `${name} for Player ${hero.controller + 1}` : name }];
    return [{ optionId: intent.optionId, code, name, hero: heroName, label: heroName ? `${name} on ${heroName}` : name }];
  });
  // The King's Quest (12170:B:3) says "the first player chooses either Threat to Wilderland or Dagnir's Spawn". Fellowship's 142060:B:2 says the same of its burdens; its words stay as they were.
  // Gundabad Hunter or Gundabad Stalker (12189:B:5): the first player chooses the one burden for the group (the record's `only`).
  const only = instruction.verb === "ChooseCards" && instruction.only === true;
  const kingsBurden = instruction.verb === "ChooseCards" && instruction.who === "firstPlayer" && instruction.codes.includes("12172") && state.resolutionLog.earned.some((item) => item.code === "12174");
  const eachSeat = instruction.verb === "NameCaptives" || instruction.verb === "RemoveFromPool" || instruction.verb === "ChooseStagedLocationForPool" || (instruction.verb === "ChooseCards" && instruction.who === "eachSeat");
  const first = window.seat === state.firstPlayer ? " (first player)" : "";
  // The seats before this one have confirmed: each recorded card in this group, or the decline when nothing was recorded.
  const answered = answeredSeats(state).map((seat): ResolutionAnswer => {
    if (instruction.verb === "NameCaptives") {
      const captive = state.resolutionLog.captives.find((item) => item.seat === seat);
      return { seat, words: captive ? nameOf(world, captive.hero) : `No ${noun}` };
    }
    // The group's answer to a boon ally is the first player's; the removals of the pool are kept by seat.
    if (instruction.verb === "BoonAllyOrLogLine") {
      const ally = state.resolutionLog.earned.find((item) => item.step === window.step);
      return { seat, words: ally ? nameOf(world, ally.code) : ALLY_LINE_FACTS[instruction.line].words };
    }
    if (instruction.verb === "ChooseStagedLocationForPool") {
      const chosen = state.resolutionLog.poolAnswers?.find((item) => item.seat === seat)?.option;
      return { seat, words: chosen == null ? "No location" : nameOf(world, chosen) };
    }
    if (instruction.verb === "RemoveFromPool") {
      const taken = state.resolutionLog.poolAnswers?.find((item) => item.seat === seat)?.option;
      return { seat, words: taken == null || taken === SKIP ? "Nothing removed" : nameOf(world, removalCode(taken)) };
    }
    const card = state.resolutionLog.earned.find((item) => item.step === window.step && item.seat === seat);
    return { seat, words: card ? cardWords(world, { code: card.code, hero: card.hero, seat }) : `No ${noun}` };
  });
  const then = afterwardsWords(state, window.step, (code) => nameOf(world, code));
  return {
    kind: "choosing",
    step: window.step,
    seat: window.seat,
    seatCount: state.seatCount,
    eyebrow,
    // A boon ally's offer is the first player's alone, and a table of several players is told whose (the first player token).
    ...(kingsBurden ? { joins: nameOf(world, "12174") } : {}),
    ...(only ? { only: true as const } : {}),
    seatLabel: (eachSeat || kingsBurden || instruction.verb === "BoonAllyOrLogLine" || instruction.verb === "ChooseRandomTreasure" || instruction.verb === "ChooseHazardForPool" || only) && state.seatCount > 1 ? `Player ${window.seat + 1}${first} chooses` : null,
    noun,
    ...(noun === "Song boon" ? { songs: true as const } : {}),
    ally: instruction.verb === "BoonAllyOrLogLine" ? nameOf(world, instruction.ally) : null,
    later: instruction.verb === "BoonAllyOrLogLine" ? ALLY_LINE_FACTS[instruction.line].later : null,
    answered,
    ...(then.length > 0 ? { then } : {}),
    tiles,
    decline,
    to: instruction.verb === "NameCaptives" ? "captive" : instruction.verb === "BoonAllyOrLogLine" ? "ally" : instruction.verb === "RemoveFromPool" ? "removal" : instruction.verb === "ChooseStagedLocationForPool" ? "location" : instruction.verb === "ChooseRandomTreasure" ? "treasure" : instruction.verb === "ChooseHazardForPool" ? "hazard" : instruction.to,
  };
}

const orList = (items: readonly string[]): string => (items.length < 3 ? items.join(" or ") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`);

/** The sentence above Confirm: what choosing this tile writes, and what the instructions after it do to the campaign pool. */
export function choiceSentence(view: Extract<ResolutionView, { kind: "choosing" }>, tile: ResolutionTile): string {
  const sentence = choiceCore(view, tile);
  return view.then && tile.optionId !== SKIP ? `${sentence} ${view.then.join(" ")}` : sentence;
}

function choiceCore(view: Extract<ResolutionView, { kind: "choosing" }>, tile: ResolutionTile): string {
  if (tile.optionId === SKIP) return declineSentence(view);
  switch (view.to) {
    case "pool": {
      if (view.songs) return `${tile.name} is added to the campaign pool.${view.seatCount > 1 ? " No other player can take it." : ""}`;
      if (view.only) {
        // One of the cards named (12189:B:5): the others are not added.
        const left = view.tiles.filter((item) => item.optionId !== tile.optionId).map((item) => item.name);
        return left.length > 0 ? `${tile.name} is added to the campaign pool as a ${view.noun}; ${andList(left)} ${left.length === 1 ? "is" : "are"} not.` : `${tile.name} is added to the campaign pool.`;
      }
      if (view.joins == null) return `${tile.name} is added to the campaign pool.`;
      const other = view.tiles.find((item) => item.optionId !== tile.optionId)?.name;
      // Dagnir's Spawn is an encounter card of the pool (emce.campaign-pool-encounter); the other burden is not shuffled in.
      const shuffled = tile.code === "12173" ? " and is shuffled into later encounter decks" : "";
      return `${tile.name} joins ${view.joins} in the campaign pool${shuffled}${other ? `; ${other} does not` : ""}.`;
    }
    case "hero":
      return `${tile.name} is attached to ${tile.hero ?? "the hero"} and recorded on the log.`;
    case "hand":
      return `${tile.name} is recorded and starts the next scenario in hand.`;
    case "captive":
      return `${tile.name} is recorded as a captive.`;
    case "player":
      return `${tile.name} is added to the campaign pool. ${tile.hero ? `The player with ${tile.hero}` : "That player"} shuffles it into their deck after drawing their starting hand, for the rest of the campaign.`;
    case "ally":
      return tile.code
        ? `${tile.name} is added to the campaign pool. ${tile.hero ? `The player with ${tile.hero}` : "That player"} adds it to their deck for the rest of the campaign. The log line is not recorded, so no card is removed from the encounter deck for it later.`
        : `\u201c${tile.name}\u201d is marked in the campaign log. ${view.ally ?? "The ally"} does not join the campaign pool. ${view.later ? `Later Setups remove from the encounter deck ${view.later}.` : ""}`.trim();
    case "location":
      return `A copy of ${tile.name} is added to the campaign pool as an encounter card. It is written in the campaign log and added to the encounter deck of every later scenario.`;
    case "hazard":
      if (tile.held) return `${tile.name} is already a burden in the campaign pool, so nothing is added.`;
      return tile.tag === "burden" ? `${tile.name} is added to the campaign pool as a burden.` : `${tile.name} is added to the campaign pool as an encounter card. It is written in the campaign log and added to the encounter deck of every later scenario.`;
    case "treasure":
      return `${tile.name} is discovered and recorded in the campaign log. The scenario is over, so it is not attached to a character.`;
    case "removal":
      if (tile.copies == null) return `${tile.label} is removed from the campaign pool.`;
      return tile.copies > 1 ? `One copy of ${tile.name} leaves the campaign pool (${tile.copies - 1} ${tile.copies === 2 ? "stays" : "stay"}).` : `${tile.name} leaves the campaign pool: it was the last copy.`;
  }
}

/** The sentence above Confirm when the seat declines: nothing is written for this choice. */
export function declineSentence(view: Extract<ResolutionView, { kind: "choosing" }>): string {
  const who = view.seatCount > 1 && view.seatLabel ? `Player ${view.seat + 1}` : "You";
  if (view.to === "removal") return `${who} ${who === "You" ? "remove" : "removes"} nothing from the campaign pool.`;
  const what = view.decline?.label.replace(/^No /, "") ?? "card";
  return `${who} ${who === "You" ? "take" : "takes"} no ${what}. Nothing is recorded for this choice.`;
}

/** The sentence above Confirm before anything is chosen, built from the noun: "Choose a boon and a hero, or tap No boon." A boon ally's offer says who takes the ally. */
export function promptSentence(view: Extract<ResolutionView, { kind: "choosing" }>): string {
  // A boon ally's offer: the first player answers for the group, and the ally goes to the player whose hero is tapped (emce.boon-allies).
  if (view.to === "ally") {
    const ally = view.ally ?? "the ally";
    return view.seatCount > 1 ? `Choose which player takes ${ally}, or the line for the log.` : `Take ${ally}, or the line for the log.`;
  }
  // The treasure of three random undiscovered ones (12175:B:7): the number now.
  if (view.to === "treasure") return `Choose 1 of the ${view.tiles.length} random undiscovered treasures${view.decline ? `, or tap ${view.decline.label}` : ""}. It is recorded as discovered when you confirm.${view.then ? ` ${view.then.join(" ")}` : ""}`;
  // The Hazard cards the Resolution discarded (12189:B:6): the group chooses one for the pool.
  if (view.to === "hazard") return `Choose 1 of the ${view.tiles.length} Hazard cards discarded (${orList(view.tiles.map((tile) => tile.name))}); the group decides${view.seatCount > 1 ? `; Player ${view.seat + 1} confirms` : ""}. It joins the campaign pool when you confirm, and the ${view.tiles.length === 2 ? "other is" : "others are"} not added.`;
  // A copy of a location of the staging area for the pool (12184:B:4): each player in turn, a different one if able.
  if (view.to === "location") return `Choose a location in the staging area.${view.seatCount > 1 ? " Each player chooses a different location if able." : ""} A copy of it joins the campaign pool when you confirm.`;
  // Each player may remove one non-burden card from the pool (12187:B:4), the first player first; a decline keeps the pool as it is.
  if (view.to === "removal") return `Choose a non-burden card to remove from the campaign pool, or tap ${view.decline?.label ?? "Remove nothing"} to keep them all.${view.seatCount > 1 ? " Each player is asked in turn, the first player first." : ""} Your choice is written to the campaign log when you confirm.`;
  // One burden of two for the pool (12189:B:5): both are named, and the one not chosen stays out.
  if (view.only && view.tiles.length > 1) return `Choose ${orList(view.tiles.map((tile) => tile.name))} for the campaign pool; the ${view.tiles.length === 2 ? "other is" : "others are"} not added. It is written to the campaign log when you confirm.`;
  const what =
    view.to === "hero"
      ? `a ${view.noun} and a hero`
      : view.to === "captive"
        ? "a hero to name as a captive"
        : view.to === "player"
          ? "a player, by one of their heroes"
          : `a ${view.noun}`;
  const decline = view.decline ? `, or tap ${view.decline.label}` : "";
  return `Choose ${what}${decline}. Your choice is written to the campaign log when you confirm.`;
}

/** The sentence above Confirm: what the chosen tile or the decline writes, or the prompt while nothing is chosen. */
export function consequenceSentence(view: Extract<ResolutionView, { kind: "choosing" }>, picked: ResolutionTile | null, declined: boolean): string {
  if (picked) return choiceSentence(view, picked);
  return declined ? declineSentence(view) : promptSentence(view);
}

function cardWords(world: World, card: SettledCard): string {
  return card.hero ? `${nameOf(world, card.code)} on ${nameOf(world, card.hero)}` : nameOf(world, card.code);
}

/** The sentence above the final Confirm: what the log will hold (a boon on its hero), and the scenario that unlocks, or that the campaign is complete
 * (`completes` is the campaign's name when the scenario is the last of its campaign, The Caves of Nibin-Dûm for both Mirkwood campaigns). */
export function settledSentence(view: Extract<ResolutionView, { kind: "settled" }>, world: World, next: string | null, completes: string | null = null): string {
  // A card on its hero already reads as a boon. When every card goes to the pool, a single card says what it is ("the burden Ungoliant's Swarm").
  const kinded = view.earned.every((card) => card.hero == null);
  const words = view.earned.map((card) => cardWords(world, card));
  // Copies of one card are one phrase ("each player earns 1 copy of Mendor's Support": "2 copies of Mendor's Support").
  const earned = [...new Set(words)].map((text) => {
    const copies = words.filter((other) => other === text).length;
    const kind = kinded ? world.cards.get(view.earned[words.indexOf(text)]?.code ?? "")?.campaignKind : null;
    return copies > 1 ? `${copies} copies of ${text}` : kind ? `the ${kind} ${text}` : text;
  });
  const list = andList(earned);
  const records = earned.length > 0 ? `Confirming records ${list} in the campaign` : "Confirming records the win";
  const unlocked = next ? `${records} and unlocks ${next}.` : completes ? `${records} and completes ${completes}.` : `${records}.`;
  // A once-per-campaign Action used in this game or an earlier scenario is written to the log (41044:A:3).
  const names = (view.used ?? []).map((code) => nameOf(world, code));
  const sentence = names.length > 0 ? `${unlocked} ${andList(names)} ${names.length === 1 ? "is" : "are"} recorded as used this campaign.` : unlocked;
  // The heroes a Resolution lists as fallen (Fallen Into Evil still on its hero, 142060:B:1) and the captives the players named are written to the log too.
  const fallen = view.fallen.length > 0 ? `${sentence} ${andList(view.fallen.map((code) => nameOf(world, code)))} ${view.fallen.length === 1 ? "is" : "are"} recorded as fallen.` : sentence;
  const captives = view.captives.length > 0 ? `${fallen} ${andList(view.captives.map((code) => nameOf(world, code)))} ${view.captives.length === 1 ? "is" : "are"} recorded as captive.` : fallen;
  // The hero a Resolution takes prisoner is written to the log too (01130:B:1): a sentence of its own, with the reason.
  const prisoner = view.prisoner ? `${captives} ${nameOf(world, view.prisoner)}, the hero with the most damage, is taken prisoner.` : captives;
  // The Ered Mithrin log (emce.treasure, emce.boon-allies, emce.campaign-pool-encounter): treasures discovered, lines marked, encounter cards joining or leaving the pool.
  const treasures = view.treasures && view.treasures.length > 0 ? `${prisoner} The players discover ${andList(view.treasures.map((code) => nameOf(world, code)))}.` : prisoner;
  const lines = view.lines && view.lines.length > 0 ? `${treasures} ${andList(view.lines.map((line) => `\u201c${ALLY_LINE_FACTS[line].words}\u201d`))} ${view.lines.length === 1 ? "is" : "are"} marked in the campaign log.` : treasures;
  const copies = (codes: readonly string[]) => andList([...new Set(codes)].map((code) => {
    const count = codes.filter((other) => other === code).length;
    return count > 1 ? `${count} copies of ${nameOf(world, code)}` : nameOf(world, code);
  }));
  const joined = view.poolAdded && view.poolAdded.length > 0 ? `${lines} ${copies(view.poolAdded)} join${view.poolAdded.length === 1 ? "s" : ""} the campaign pool as encounter cards.` : lines;
  const gone = view.poolRemoved && view.poolRemoved.length > 0 ? `${joined} ${copies(view.poolRemoved)} leave${view.poolRemoved.length === 1 ? "s" : ""} the campaign pool.` : joined;
  // The boxes marked beside Beldis in this game are recorded with the win (emce.campaign-log).
  const left = view.beldis && view.beldis.length > 0 ? `${gone} ${andList(view.beldis)}.` : gone;
  // The cards a Resolution keeps for the next campaign, not this one (01131:B:2): a sentence of its own.
  if (!view.carried || view.carried.length === 0) return left;
  const kept = view.carried.map((card) => ({ code: card.code, perPlayer: card.eachPlayer }));
  const carried = carryWords(kept, (code) => nameOf(world, code));
  return `${left} ${carried.charAt(0).toUpperCase()}${carried.slice(1)} ${carryVerb(kept)} kept for your next campaign.`;
}
