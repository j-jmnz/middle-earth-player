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
import { ALLY_LINE_FACTS, type AllyLine } from "../catalog/ally-lines.ts";

import { contextOf } from "./session.ts";
import type { World } from "./world.ts";
import { cappedTally } from "./wilderland.ts";

// `label`: the words on the tile ("Tireless Ranger on Sam Gamgee", "Turayn for Player 1"). `wide`: a tile with no card, laid in a row of its own under the card tiles (the log line). `tag` is a muted
// word under the name that tells a kind apart (an encounter card of the pool), `copies` the copies of such a card the pool holds.
export type ResolutionTile = { optionId: string; code: string | null; name: string; hero: string | null; label: string; wide?: true; tag?: string; copies?: number };

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
      // The boon ally the choice is about, when it is one (BoonAllyOrLogLine): what the log line is traded for.
      ally: string | null;
      answered: readonly ResolutionAnswer[];
      tiles: readonly ResolutionTile[];
      decline: ResolutionDecline | null;
      // `player`: the card is for a player, named by one of their heroes, and goes into their deck after the starting hand (11197:B:1).
      // `ally`: a boon ally for a player, or the log line instead (emce.boon-allies). `removal`: a card of the Campaign Pool a player may remove (12187:B:4).
      to: "pool" | "hand" | "hero" | "captive" | "player" | "ally" | "removal";
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
    };

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

export function resolutionView(state: ScenarioState, world: World): ResolutionView {
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
  } else if (instruction.verb === "ChooseCards") {
    const kinds = new Set(instruction.codes.map((code) => world.cards.get(code)?.campaignKind ?? null));
    noun = kinds.size === 1 && kinds.has("burden") ? "burden" : kinds.size === 1 && kinds.has("boon") ? "boon" : "card";
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
  const eachSeat = instruction.verb === "NameCaptives" || instruction.verb === "RemoveFromPool" || (instruction.verb === "ChooseCards" && instruction.who === "eachSeat");
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
    if (instruction.verb === "RemoveFromPool") {
      const taken = state.resolutionLog.poolAnswers?.find((item) => item.seat === seat)?.option;
      return { seat, words: taken == null || taken === SKIP ? "Nothing removed" : nameOf(world, removalCode(taken)) };
    }
    const card = state.resolutionLog.earned.find((item) => item.step === window.step && item.seat === seat);
    return { seat, words: card ? cardWords(world, { code: card.code, hero: card.hero, seat }) : `No ${noun}` };
  });
  return {
    kind: "choosing",
    step: window.step,
    seat: window.seat,
    seatCount: state.seatCount,
    eyebrow,
    seatLabel: eachSeat && state.seatCount > 1 ? `Player ${window.seat + 1}${first} chooses` : null,
    noun,
    ally: instruction.verb === "BoonAllyOrLogLine" ? nameOf(world, instruction.ally) : null,
    answered,
    tiles,
    decline,
    to: instruction.verb === "NameCaptives" ? "captive" : instruction.verb === "BoonAllyOrLogLine" ? "ally" : instruction.verb === "RemoveFromPool" ? "removal" : instruction.to,
  };
}

/** The sentence above Confirm: what choosing this tile writes. */
export function choiceSentence(view: Extract<ResolutionView, { kind: "choosing" }>, tile: ResolutionTile): string {
  if (tile.optionId === SKIP) return declineSentence(view);
  switch (view.to) {
    case "pool":
      return `${tile.name} is added to the campaign pool.`;
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
        ? `${tile.name} is added to the campaign pool. ${tile.hero ? `The player with ${tile.hero}` : "That player"} adds it to their deck for the rest of the campaign. The log line is not recorded.`
        : `\u201c${tile.name}\u201d is marked in the campaign log. ${view.ally ?? "The ally"} does not join the campaign pool.`;
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

/** The sentence above Confirm before anything is chosen, built from the noun: "Choose a boon and a hero, or tap No boon." */
export function promptSentence(view: Extract<ResolutionView, { kind: "choosing" }>): string {
  const what =
    view.to === "hero"
      ? `a ${view.noun} and a hero`
      : view.to === "captive"
        ? "a hero to name as a captive"
        : view.to === "player"
          ? "a player, by one of their heroes"
          : view.to === "ally"
            ? "the ally for a player, by one of their heroes, or the line for the log"
            : view.to === "removal"
              ? "a card to remove from the campaign pool"
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
  const left = view.poolRemoved && view.poolRemoved.length > 0 ? `${joined} ${copies(view.poolRemoved)} leave${view.poolRemoved.length === 1 ? "s" : ""} the campaign pool.` : joined;
  // The cards a Resolution keeps for the next campaign, not this one (01131:B:2): a sentence of its own.
  if (!view.carried || view.carried.length === 0) return left;
  const kept = view.carried.map((card) => ({ code: card.code, perPlayer: card.eachPlayer }));
  const carried = carryWords(kept, (code) => nameOf(world, code));
  return `${left} ${carried.charAt(0).toUpperCase()}${carried.slice(1)} ${carryVerb(kept)} kept for your next campaign.`;
}
