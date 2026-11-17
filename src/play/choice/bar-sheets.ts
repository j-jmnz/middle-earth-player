// The sheets of an ordinary action window (the window itself, the quest commit, the Actions list) and those a tap on a card
// opens (playing it, paying for it, using its Action), and the intents a multi-choice or distribute sheet sends for what the
// player picked. The reducer still checks every intent.
import { legalAttackEnemies } from "../../rules/combat/combat.ts";
import { sideQuestIds } from "../../rules/families/sidequests/quest.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { flagged } from "../../rules/core/state.ts";
import { questSeat } from "../store/selectors.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import type { PlayerIntent, LegalIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { legalTargets } from "../../rules/engine/reduce.ts";

import { checkFor, playCaution } from "../cards/not-applied.ts";
import { playRequest, type PayRequest, type Share } from "./pay.ts";
import { STEP_WORDS, windowPoint } from "../phases/rail.ts";
import type { DistributePurpose, DistributeSheet, MultiSheet, PickSheet, Sheet, SheetNames, TriggerOption, TriggerSheet, WindowSheet } from "./sheet-types.ts";
import { option, statOf, step } from "./sheet-parts.ts";
import { triggerOptions } from "./sheets.ts";
import { currentSideQuest } from "../../rules/families/wilderland/night-quest.ts";

// The commit names the quest it is to: the side quest a player made the current quest until the end of the phase (emce.side-quests-in-play), else the main quest.
function commitTitle(game: ScenarioState, names: SheetNames): string {
  const current = currentSideQuest(game);
  return current ? `Commit to ${names.card(current)} (current quest until the end of the phase)` : "Commit to the quest";
}

export function commitSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames): MultiSheet {
  return {
    kind: "multi",
    key: `commit:${game.round}`,
    step: "Quest",
    title: commitTitle(game, names),
    note: "Committed characters exhaust and add their willpower against the threat in staging.",
    verb: "Commit",
    options: legalTargets(game, { type: "Commit" }, ctx).map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, "willpower") })),
    build: { kind: "Commit" },
    allowEmpty: false,
    preselected: [],
    alternative: null,
  };
}

/** The Actions the seat can use in an ordinary action window, as a trigger sheet the bar opens. */
export function actionsSheet(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): TriggerSheet {
  return {
    kind: "trigger",
    key: `actions:${game.round}:${game.mode}`,
    step: step(game),
    title: "Actions",
    sourceId: null,
    timing: "Action",
    note: "Only the Actions the rules allow now are listed.",
    hide: null,
    options: triggerOptions(game, ctx, legal, names),
    pass: null,
  };
}

// The armed line of Commit no one: the quest still resolves, against the threat in staging and what the reveal adds.
export function noOneQuests(threat: number): string {
  return threat > 0 ? `Tap again: no one quests (threat ${threat}+)` : "Tap again: no one quests";
}

/**
 * The words of a commit window that still owes a hero: "Aragorn must commit to the quest (A Fell Dread)". The heroes are those of the commit options the rules say must commit (the flag `mustCommit`), and each card that says so is named once.
 * Null when none is owed, or when Pass is still legal (the engine decides: `legal` holds no Pass while a hero is owed, rejectionReason in rules/engine/legal.ts).
 */
export function mustCommitWords(game: ScenarioState, names: SheetNames, commit: MultiSheet, legal: readonly LegalIntent[]): string | null {
  if (legal.some((intent) => intent.type === "Pass")) return null;
  const owed = commit.options.filter((item) => flagged(game, item.id, "mustCommit"));
  if (owed.length === 0) return null;
  const sources = [...new Set(game.modifiers.filter((modifier) => modifier.stat === "mustCommit" && owed.some((item) => item.id === modifier.instanceId)).map((modifier) => names.card(modifier.sourceId)))];
  return `${owed.map((item) => names.card(item.id)).join(" and ")} must commit to the quest${sources.length > 0 ? ` (${sources.join(", ")})` : ""}`;
}

/**
 * The ordinary action window as the table answers it: what can be played and used now, the quest commit in the commit
 * window, and Pass. Every card it names comes from legalIntents.
 */
export function windowSheet(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): WindowSheet {
  const plays = legal.flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));
  const triggers = triggerOptions(game, ctx, legal, names);
  const commit = game.mode === "questCommit" && legal.some((intent) => intent.type === "Commit") ? commitSheet(game, ctx, names) : null;
  const usable = plays.length > 0 || triggers.length > 0;
  // A card played from the discard pile is not on the table: the note says where it is.
  const fromPile = plays.filter((id) => game.cards[id]?.zone === "discard");
  // In combat with no enemy any of the seat's characters could attack (none engaged: Éowyn's +9 would buy nothing), the window says so.
  const noFight = game.phase === "Combat" && !canFight(game, ctx) ? "No enemy can be attacked this phase." : null;
  const pileNote = fromPile.length > 0 ? `Tap your discard pile to play ${[...new Set(fromPile.map((id) => names.card(id)))].join(" or ")} from it.` : null;
  // The eyebrow is the phase; the title says what the window is for.
  const base = { kind: "window" as const, key: `window:${game.round}:${game.mode}:${game.activeSeat}:${game.stepWindows.length}`, step: game.phase, commit, plays, triggers };
  if (commit) {
    // Once a character is committed, passing ends the commit rather than sending no one.
    const some = Object.values(game.cards).some((card) => card.committed && card.controller === game.activeSeat);
    // A player side quest in a quest area takes characters committed to it instead (families/sidequests/quest.ts).
    const sideQuests = sideQuestIds(game).map((id) => ({ id, label: names.card(id) }));
    // A hero that must commit has not: passing is not legal, so the window offers Commit only (the dock's primary waits for a pick).
    const owed = mustCommitWords(game, names, commit, legal);
    const toSide = sideQuests.length > 0 ? ` Or send them to ${sideQuests.map((quest) => quest.label).join(" or ")}: its willpower goes on it as progress.` : "";
    if (owed != null) return { ...base, sideQuests, title: commitTitle(game, names), note: `${owed}. Tap a character to commit.${toSide}`, mustCommit: owed, pass: null, passNote: null, armed: null };
    return some
      ? { ...base, sideQuests, title: commitTitle(game, names), note: `Tap more characters to quest, or end the commit.${toSide}`, pass: "Done", passNote: "Done ends the commit.", armed: "Tap again: no one else quests" }
      : {
          ...base,
          sideQuests,
          title: commitTitle(game, names),
          note: `Tap characters to quest. They exhaust, so they cannot defend or attack this round.${toSide}`,
          pass: "Commit no one",
          passNote: "Pass sends no one.",
          // The quest is never skipped (rr.step-3-3): staging still reveals and its threat still counts against no willpower.
          armed: noOneQuests(stagingThreat(game, ctx.cards, questSeat(game))),
        };
  }
  // A screen reader hears what its buttons say in place of a glow or a drag (card-speech.ts: "Can be played", "Can use its Action").
  const readerPlays = plays.length > 0 ? "Cards that say 'can be played' can be played now." : null;
  const readerUses = triggers.length > 0 ? "Cards that say 'can use' can be used now." : null;
  if (game.mode === "planning") {
    return {
      ...base,
      title: "Play allies and attachments",
      note: [usable ? "Tap a glowing card to play it, or drag it." : "Nothing in your hand can be played now.", pileNote].filter((part) => part != null).join(" "),
      readerNote: [usable ? [readerPlays, readerUses].filter((part) => part != null).join(" ") : "Nothing in your hand can be played now.", pileNote].filter((part) => part != null).join(" "),
      pass: "Pass",
      passNote: "Pass ends your planning.",
      armed: "Tap again: planning ends",
    };
  }
  // The window is named by what comes next, so the player knows what an action here can still change (rail.ts).
  const point = windowPoint(game);
  return {
    ...base,
    title: point?.title ?? "Action window",
    note: [point?.note, noFight, usable ? "Tap a glowing card to use it." : null, pileNote].filter((part) => part != null).join(" ") || null,
    readerNote: [point?.note, noFight, [readerPlays, readerUses].filter((part) => part != null).join(" ") || null, pileNote].filter((part) => part != null).join(" ") || null,
    pass: "Pass",
    passNote: game.seatCount > 1 ? "The game moves on once both players pass." : "Pass moves the game on.",
    armed: "Tap again to pass",
  };
}

// Some character of the acting seat could attack an enemy this combat phase, exhausted or not (it may be readied first).
function canFight(game: ScenarioState, ctx: ReduceContext): boolean {
  const seat = game.activeSeat;
  return [...(game.seats[seat]?.heroes ?? []), ...(game.seats[seat]?.play ?? [])].some((id) => legalAttackEnemies(game, seat, id, ctx.cards, true).length > 0);
}

/**
 * Playing one card the player picked on the table: an attachment asks for its host first, a card with a cost asks which
 * pools pay it, and a free card asks only to confirm. Null when the rules do not let it be played now.
 */
export function playSheet(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames, cardId: string, hostId: string | null = null): Sheet | null {
  const instance = game.cards[cardId];
  if (!instance || !legal.some((intent) => intent.type === "PlayCard" && intent.cardId === cardId)) return null;
  const name = names.card(cardId);
  const request = playRequest(game, ctx, cardId, hostId);
  const printed = printedOf(ctx.cards, instance.code);
  // A card the app does not fully apply says so before it is paid for; an attachment that would do nothing asks twice.
  const warn = playCaution(instance.code, printed.type, names.text?.(instance.code) ?? null, request?.total ?? 0, checkFor(ctx.effects));
  const caution = warn?.armed ? { caution: warn.armed } : {};
  const said = (note: string | null): string | null => (warn ? [warn.words + ".", note].filter((part) => part != null).join(" ") : note);
  const at = (host: string | null): PlayerIntent => (host ? { type: "PlayCard", cardId, payments: [], hostId: host } : { type: "PlayCard", cardId, payments: [] });
  const pay = (host: string | null): DistributeSheet => {
    const sheet = paySheet(game, names, request as PayRequest, { kind: "play", cardId, hostId: host });
    return { ...sheet, note: said(sheet.note) ?? sheet.note, ...caution };
  };
  if (printed.type === "attachment" && hostId == null) {
    const hosts = legalTargets(game, { type: "PlayCard", cardId }, ctx);
    return {
      kind: "pick",
      key: `play:${cardId}`,
      step: step(game),
      title: `Play ${name}`,
      note: said(hosts.length > 0 ? "Tap the card to attach it to." : "No card can take it now."),
      verb: "Attach to",
      options: hosts.map((id) => ({ ...option(game, names, id), ...(request ? { next: pay(id) } : { intent: at(id) }) })),
      primary: null,
      alternative: null,
      about: [cardId],
      ...caution,
    };
  }
  if (request) return pay(hostId);
  const sheet: PickSheet = {
    kind: "pick",
    key: `play:${cardId}:${hostId ?? ""}`,
    step: step(game),
    title: hostId ? `Attach ${name} to ${names.card(hostId)}` : `Play ${name}`,
    note: said("It costs nothing."),
    verb: "",
    options: [],
    primary: { label: `Play ${name}`, intent: at(hostId) },
    alternative: null,
    selectionMade: true,
    about: [cardId],
    ...caution,
  };
  return sheet;
}

/** Using an Action of one card the player picked on the table: its options only, each with its printed line. */
export function cardTriggerSheet(game: ScenarioState, names: SheetNames, triggers: readonly TriggerOption[], cardId: string): TriggerSheet | null {
  const options = triggers.filter((item) => item.cardId === cardId);
  if (options.length === 0) return null;
  return {
    kind: "trigger",
    key: `use:${cardId}`,
    step: step(game),
    title: names.card(cardId),
    sourceId: cardId,
    timing: options[0]?.timing ?? "Action",
    note: options.length > 1 ? "Tap the card again for its other ability." : null,
    hide: null,
    options,
    pass: null,
    // The tap on the card was the pick when it has one ability.
    ...(options.length === 1 && options[0] ? { preselect: options[0].id } : {}),
  };
}

/** The intent a multi-choice sheet sends for the chosen ids. */
export function multiIntent(sheet: MultiSheet, ids: readonly string[]): PlayerIntent {
  switch (sheet.build.kind) {
    case "Commit":
      return { type: "Commit", cardIds: [...ids] };
    case "CommitHide":
      return { type: "CommitHide", cardIds: [...ids] };
    case "CommitFortitude":
      return { type: "CommitFortitude", cardIds: [...ids] };
    case "CommitEscape":
      return { type: "CommitEscape", cardIds: [...ids] };
    case "attack":
      return { type: "DeclareAttackers", enemyId: sheet.build.enemyId, attackerIds: [...ids] };
  }
}

// The card's own rule on how many pools pay (PayDistinctHeroes): "from 3 different heroes' pools", "from a single hero's pool".
function distinctWords(distinct: PayRequest["distinct"]): string {
  if (!distinct) return "";
  if (distinct.max === 1) return " Pay from a single hero.";
  if (distinct.min != null && distinct.max != null) return ` Pay from ${distinct.min} to ${distinct.max} different heroes.`;
  if (distinct.min != null) return ` Pay from ${distinct.min} different heroes.`;
  return distinct.max != null ? ` Pay from at most ${distinct.max} heroes.` : "";
}

/** The pay sheet for a card or an effect whose cost takes resources. */
export function paySheet(game: ScenarioState, names: SheetNames, request: PayRequest, purpose: DistributePurpose): DistributeSheet {
  const source = names.card(request.cardId);
  return {
    kind: "distribute",
    key: `pay:${request.cardId}:${purpose.kind}`,
    step: STEP_WORDS[game.mode],
    title: request.exact ? `Pay ${request.total} for ${source}` : `Pay for ${source}`,
    note: `${request.exact ? "" : "X is what you pay. "}Tap a hero to take one resource from its pool.${distinctWords(request.distinct)}`,
    total: request.total,
    exact: request.exact,
    options: request.pools.map((pool) => ({ ...option(game, names, pool.heroId), max: pool.max })),
    purpose,
    ...(request.distinct ? { distinct: request.distinct } : {}),
  };
}

/** The intent a distribute sheet sends for the chosen shares. */
export function distributeIntent(sheet: DistributeSheet, shares: readonly Share[]): PlayerIntent {
  const given = shares.filter((share) => share.amount > 0);
  switch (sheet.purpose.kind) {
    case "archery":
      return { type: "Distribute", assignments: given.map((share) => ({ cardId: share.id, amount: share.amount })) };
    case "play": {
      const payments = given.map((share) => ({ heroId: share.id, amount: share.amount }));
      return sheet.purpose.hostId ? { type: "PlayCard", cardId: sheet.purpose.cardId, payments, hostId: sheet.purpose.hostId } : { type: "PlayCard", cardId: sheet.purpose.cardId, payments };
    }
    case "trigger":
      return { type: "Trigger", cardId: sheet.purpose.cardId, effectId: sheet.purpose.effectId, payments: given.map((share) => ({ heroId: share.id, amount: share.amount })) };
  }
}

/**
 * True when the sheet's own buttons already send Pass (a Response's Pass, an action window's Continue, Look's Done) or the
 * game is over, so the table adds no second Pass beside them.
 */
export function sheetSendsPass(sheet: Sheet): boolean {
  switch (sheet.kind) {
    case "trigger":
      return sheet.pass != null;
    case "pick": {
      const alternative = sheet.alternative;
      return sheet.primary?.intent.type === "Pass" || (alternative != null && "intent" in alternative && alternative.intent.type === "Pass");
    }
    case "outcome":
    case "window":
      return true;
    case "multi": {
      // The Sailing commit names its own Pass (sea-sheets.ts): the dock does not add another.
      const alternative = sheet.alternative;
      return alternative != null && "intent" in alternative && alternative.intent.type === "Pass";
    }
    case "distribute":
      return false;
  }
}
