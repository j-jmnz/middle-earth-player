// Rules: rr.action, rr.response, rr.cancel, rr.mulligan, mec109.hide-x, mec109.hide-tests, rr.travel,
// rr.optional-engagement, rr.step-6-2 (data/rules/entries.json). The combat sheets are in combat-sheets.ts.
//
// What the choice sheet over the rail asks, for the window the engine has open. Every option is an intent legalIntents and
// legalTargets list, or a number the engine computed (the Hide numbers, an attack and a defense). Nothing here writes a
// number: a sheet names who does something, the reducer decides what happens.
import type { Effect } from "../catalog/boundary.ts";
import { rejectionReason } from "../rules/legal.ts";
import { printedOf } from "../rules/printed.ts";
import { hideWillpower } from "../rules/hide.ts";
import { engagementCostOf, questPointsOf } from "../rules/quest.ts";
import { legalTargets, type LegalIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import type { Frame } from "../rules/state.ts";
import { topFrame } from "../rules/windows.ts";

import { branchThreat, branchWords, outOfPlayLabel, pickWords, type ChoiceNames } from "./choice-words.ts";
import { archerySheet, defenseSheet, playerAttackSheet } from "./combat-sheets.ts";
import { threatRows } from "./foresight.ts";
import { cancelRequest, triggerRequest } from "./pay.ts";
import { STEP_WORDS } from "./rail.ts";
import { has, option, statOf, step } from "./sheet-parts.ts";
import { TIMING_WORDS, type SheetStat, type HideNumbers, type PickOption, type Sheet, type SheetNames, type TriggerOption, type Unavailable } from "./sheet-types.ts";

function effectOf(ctx: ReduceContext, effectId: string): Effect | undefined {
  return ctx.effects.find((effect) => effect.id === effectId);
}

function lineOf(effect: Effect | undefined, names: SheetNames): string | null {
  const id = effect?.lines[0];
  return id ? names.line(id) : null;
}

export function triggerOptions(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): TriggerOption[] {
  const options: TriggerOption[] = [];
  for (const intent of legal) {
    if (intent.type !== "Trigger") continue;
    const effect = effectOf(ctx, intent.effectId);
    const card = game.cards[intent.cardId];
    if (!effect || !card) continue;
    options.push({
      id: `${intent.cardId}|${intent.effectId}`,
      label: names.card(intent.cardId),
      code: card.code,
      effectId: intent.effectId,
      cardId: intent.cardId,
      timing: TIMING_WORDS[effect.timing],
      text: lineOf(effect, names),
      pay: game.window?.kind === "cancelOffer" ? cancelRequest(game, ctx, intent.cardId) : triggerRequest(game, ctx, intent.cardId, effect),
    });
  }
  return options;
}

function hideNumbers(game: ScenarioState, ctx: ReduceContext, frame: Frame | undefined): HideNumbers | null {
  for (let index = game.stack.length - 1; index >= 0; index -= 1) {
    const hide = game.stack[index];
    const data = hide?.data;
    if (!hide || data?.kind !== "hide") continue;
    // The engine's own total: committed characters in play plus what the seat and the table hold for the test.
    return { x: data.x, threat: data.threat, willpower: hideWillpower(game, hide.seat, data.committedIds, ctx), committed: data.committedIds };
  }
  return frame?.data.kind === "hide" ? { x: frame.data.x, threat: frame.data.threat, willpower: 0, committed: [] } : null;
}

/**
 * The locations in staging the players cannot travel to, each with the reducer's reason and the card's Travel line
 * (Weathertop while The One Ring is exhausted or gone: 141046:A:3, rr.travel). Nothing is listed while a location is active.
 */
export function travelRefusals(game: ScenarioState, ctx: ReduceContext, names: SheetNames, targets: readonly string[]): Unavailable[] {
  if (game.activeLocation) return [];
  return game.staging.flatMap((id): Unavailable[] => {
    const card = game.cards[id];
    if (!card || targets.includes(id) || printedOf(ctx.cards, card.code).type !== "location") return [];
    const reason = rejectionReason(game, { type: "Travel", locationId: id }, ctx);
    if (!reason) return [];
    const travel = ctx.effects.find((effect) => effect.cardCode === card.code && effect.timing === "travel");
    const line = lineOf(travel, names);
    return [{ id, label: names.card(id), code: card.code, reason: line ? `${reason}. ${line}` : `${reason}.` }];
  });
}

// A response window's sentence, naming the Responses of this occurrence that wait for a cost another one may pay
// (rr.triggering-condition: Aragorn's ready waits for Théodred's resource).
function responseNote(game: ScenarioState, names: SheetNames, offers: readonly { cardId: string; effectId: string; seat: number }[], listed: readonly TriggerOption[]): string {
  const seat = game.window?.kind === "response" ? game.window.seat : game.activeSeat;
  const waiting = offers.filter((offer) => offer.seat === seat && !listed.some((item) => item.cardId === offer.cardId && item.effectId === offer.effectId));
  const base = "A Response may be used now, or passed.";
  if (waiting.length === 0) return base;
  return `${base} Waiting for its cost, and offered once it can be paid: ${waiting.map((offer) => names.card(offer.cardId)).join(", ")}. Passing gives it up too.`;
}

// What the optional engagement is against: the seat's threat, and which enemies the engagement checks engage anyway or
// leave in staging (rr.optional-engagement, rr.engagement-check).
function optionalEngageNote(game: ScenarioState, ctx: ReduceContext, names: SheetNames): string {
  const seat = game.activeSeat;
  const rows = threatRows(game, ctx);
  const threat = game.seats[seat]?.threat ?? 0;
  const anyway = rows.filter((row) => row.engagesSeat === seat).map((row) => `${names.card(row.id)} (${row.cost})`);
  const stays = rows.filter((row) => row.engagesSeat == null).map((row) => `${names.card(row.id)} (${row.cost})`);
  const parts = [`You may engage one enemy in staging. Your threat is ${threat}.`];
  if (anyway.length > 0) parts.push(`The checks engage ${anyway.join(", ")} anyway.`);
  if (stays.length > 0) parts.push(`${stays.join(", ")} ${stays.length === 1 ? "stays" : "stay"} in staging.`);
  return parts.join(" ");
}

/**
 * An action window between two framework steps (rr.framework-steps), not the one inside a Hide test: the bar answers it
 * like any action window, with Pass, the Actions list and the hand.
 */
export function isStepWindow(game: ScenarioState): boolean {
  return game.window?.kind === "frameAction" && topFrame(game)?.frame !== "hide";
}

/**
 * The sheet for the open window, or null when the bar alone answers it (an ordinary action window, where Pass and the
 * Actions list sit on the bar).
 */
// A won game opens the campaign card's Resolution when it has one. A standalone game has none (rr.campaign-cards): its
// win has nothing to choose, and the outcome screen shows the score.
export function wonSheet(game: ScenarioState): Sheet {
  const rewards = game.resolution.length > 0;
  return {
    kind: "outcome",
    key: "won",
    result: "won",
    step: rewards ? "Resolution" : "Scenario",
    title: "Victory",
    note: rewards ? "The scenario is won. Choose the rewards the campaign card offers." : "The scenario is won.",
    action: rewards ? "Choose rewards" : "See the score",
  };
}

export function sheetFor(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): Sheet | null {
  if (game.lost) {
    return { kind: "outcome", key: "lost", result: "lost", step: "Scenario", title: "Defeat", note: game.lossReason ? `${game.lossReason}.` : "The scenario is lost.", action: "Continue" };
  }
  if (game.stageCleared) return wonSheet(game);
  const window = game.window;
  if (!window) return null;
  const frame = topFrame(game);
  switch (window.kind) {
    case "mulligan":
      return {
        kind: "pick",
        key: `mulligan:${game.activeSeat}`,
        step: "Setup",
        title: game.seatCount > 1 ? `Player ${game.activeSeat + 1}: opening hand` : "Opening hand",
        note: "Keep this hand, or shuffle it back and draw a new one once.",
        verb: "",
        options: [],
        primary: { label: "Keep", intent: { type: "Keep" } },
        alternative: has(legal, "Mulligan") ? { label: "Mulligan", intent: { type: "Mulligan" } } : null,
      };
    case "pass":
      return null;
    case "hideCommit": {
      if (!game.widgets.hide) return null;
      const hide = hideNumbers(game, ctx, frame);
      const source = frame?.cardId ?? null;
      return {
        kind: "multi",
        key: `hideCommit:${frame?.id ?? ""}`,
        step: "Hide test",
        title: source ? `${names.card(source)}: Hide ${hide?.x ?? ""}`.trim() : `Hide ${hide?.x ?? ""}`.trim(),
        note: "Commit characters to the Hide test. Their willpower is compared with the threat of the cards discarded.",
        verb: "Commit",
        options: legalTargets(game, { type: "CommitHide" }, ctx).map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, "willpower") })),
        build: { kind: "CommitHide" },
        allowEmpty: true,
        preselected: [],
        alternative: null,
      };
    }
    case "frameAction": {
      if (isStepWindow(game)) return null;
      const hide = game.widgets.hide && frame?.data.kind === "hide" ? hideNumbers(game, ctx, frame) : null;
      const source = frame?.cardId ?? null;
      return {
        kind: "trigger",
        key: `frameAction:${frame?.id ?? ""}:${frame?.step ?? 0}`,
        step: hide ? "Hide test" : step(game),
        title: source ? names.card(source) : "Action window",
        sourceId: source,
        timing: "Action",
        note: hide ? `Hide ${hide.x}: willpower ${hide.willpower} against threat ${hide.threat}.` : "Actions may be used before this resolves.",
        hide,
        options: triggerOptions(game, ctx, legal, names),
        pass: "Continue",
      };
    }
    case "choose": {
      const data = frame?.data.kind === "effect" ? frame.data : null;
      const effect = data ? effectOf(ctx, data.effectId) : undefined;
      const source = frame?.cardId ?? null;
      const words: ChoiceNames = { card: names.card, code: (code) => ctx.cards.get(code)?.name ?? code };
      const line = lineOf(effect, names);
      // Two-handed, the sheet says whose decision it is: the first player's for "the first player must either" (rr.first-player).
      const who = game.seatCount > 1 ? ` Player ${window.seat + 1} chooses.` : "";
      const wait = data?.wait;
      const base = {
        kind: "pick" as const,
        key: `choose:${frame?.id ?? ""}:${window.options.join(",")}`,
        step: effect ? TIMING_WORDS[effect.timing] : step(game),
        title: source ? names.card(source) : "Choose",
        primary: null,
        alternative: null,
      };
      // Either of two instructions (141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2): each option is a branch in words.
      if (wait?.kind === "branch" && wait.item.instruction.verb === "Choose") {
        const choose = wait.item.instruction;
        return {
          ...base,
          note: [`Choose one.${who}`, line].filter((part) => part != null).join(" "),
          verb: "Choose",
          confirm: "Confirm",
          options: window.options.map((id): PickOption => {
            // A branch that raises or lowers threat carries the threat icon with the record's amount.
            const threat = branchThreat(choose, id);
            const stats: SheetStat[] = threat == null ? [] : [{ icon: "threat", value: threat, word: "Threat" }];
            return { id, label: branchWords(choose, id, game, words, source), code: null, ...(stats.length > 0 ? { stats } : {}), intent: { type: "Choose", optionId: id } };
          }),
        };
      }
      // A Pick names what the card is for: a hero removed from the quest, an attachment discarded, an ally put into play,
      // an enemy placed under Weather Hills.
      const asked = wait?.kind === "target" ? pickWords(wait.item.instruction, data?.queue[0]?.instruction, words, source) : { verb: "Choose", prompt: "Choose one." };
      const outOfPlay = wait?.kind === "target" && wait.item.instruction.verb === "ShuffleOutOfPlayIntoEncounterDeck";
      return {
        ...base,
        note: [`${asked.prompt}${who}`, line].filter((part) => part != null).join(" "),
        verb: asked.verb,
        // Which Ringwraith copy goes in: the primary says the action alone, so the pill does not wrap on a long zone name.
        ...(outOfPlay ? { confirm: asked.verb } : {}),
        options: window.options.map((id): PickOption => {
          const card = option(game, names, id);
          // Copies of one card in different zones are told apart by where each one is.
          const label = outOfPlay ? outOfPlayLabel(game, id, words) : card.label;
          return { ...card, label, intent: { type: "Choose", optionId: id } };
        }),
      };
    }
    case "cancelOffer":
    case "response": {
      const options = triggerOptions(game, ctx, legal, names);
      const data = frame?.data;
      const about = data?.kind === "responses" ? (data.event.subject ?? data.event.cardId ?? null) : (frame?.cardId ?? null);
      const cancel = window.kind === "cancelOffer";
      return {
        kind: "trigger",
        key: `${window.kind}:${frame?.id ?? ""}:${options.length}`,
        step: step(game),
        title: about ? names.card(about) : cancel ? "Cancel" : "Response",
        sourceId: about,
        timing: cancel ? "Cancel" : "Response",
        note: cancel ? "The first player may pay to cancel this effect before it resolves." : responseNote(game, names, data?.kind === "responses" ? data.offers : [], options),
        hide: null,
        options,
        pass: "Pass",
      };
    }
    case "look":
      return {
        kind: "pick",
        key: `look:${window.cardIds.join(",")}`,
        step: step(game),
        title: window.cardIds.map((id) => names.card(id)).join(", ") || "Look",
        // Dark Knowledge (01071:A:2) looks at a shadow card dealt to an enemy, not at the encounter deck.
        note: window.cardIds.some((id) => game.cards[id]?.zone === "shadow") ? "A shadow card dealt to an enemy attacking you. Nothing moves." : "The top of the encounter deck. Nothing moves.",
        verb: "",
        options: [],
        primary: { label: "Done", intent: { type: "Pass" } },
        alternative: null,
        about: window.cardIds,
      };
    case "travel": {
      const targets = has(legal, "Travel") ? legalTargets(game, { type: "Travel" }, ctx) : [];
      const unavailable = travelRefusals(game, ctx, names, targets);
      // Only one location can be active (rr.travel): while one is, say what exploring it still takes.
      const active = game.activeLocation ? game.cards[game.activeLocation] : undefined;
      const activePoints = active ? questPointsOf(game, active, ctx.cards) : null;
      const waiting = game.staging.some((id) => printedOf(ctx.cards, game.cards[id]?.code ?? "").type === "location");
      const blocked = targets.length === 0 && active != null && waiting;
      return {
        kind: "pick",
        key: `travel:${game.round}`,
        step: "Travel",
        title: targets.length > 0 ? "Travel to a location" : blocked && active ? `Explore ${names.card(active.id)} first` : "No location to travel to",
        note:
          targets.length > 0
            ? "The location becomes active and leaves staging: its threat stops counting, and progress goes on it before the quest."
            : blocked && active && activePoints != null
              ? `${Math.max(0, activePoints - active.progress)} more progress explores it. Only one location can be active.`
              : null,
        verb: "Travel to",
        options: targets.map((id) => {
          const location = game.cards[id];
          const points = location ? questPointsOf(game, location, ctx.cards) : null;
          const stats: SheetStat[] = [...statOf(game, ctx, id, "threat"), ...(points == null ? [] : [{ icon: "questPoints" as const, value: points, word: "Quest points" }])];
          // Its Travel line, when it prints one (a cost the travel pays: Great Forest Web's "exhaust 1 hero").
          const travel = ctx.effects.find((effect) => effect.cardCode === location?.code && effect.timing === "travel");
          const line = lineOf(travel, names);
          const base = option(game, names, id);
          return { ...base, label: line ? `${base.label} · ${line}` : base.label, stats, intent: { type: "Travel", locationId: id } };
        }),
        ...(unavailable.length > 0 ? { unavailable } : {}),
        primary: null,
        alternative: { label: targets.length > 0 ? "Do not travel" : "Continue", intent: { type: "DeclineTravel" } },
      };
    }
    case "optionalEngage": {
      const targets = legalTargets(game, { type: "Engage" }, ctx);
      return {
        kind: "pick",
        key: `optionalEngage:${game.round}:${game.activeSeat}`,
        step: "Encounter",
        title: game.seatCount > 1 ? `Player ${game.activeSeat + 1}: optional engagement` : "Optional engagement",
        note: optionalEngageNote(game, ctx, names),
        verb: "Engage",
        options: targets.map((id) => {
          const enemy = game.cards[id];
          const cost = enemy ? engagementCostOf(game, enemy, ctx.cards) : null;
          return { ...option(game, names, id), stats: cost == null ? [] : [{ icon: "engagementCost" as const, value: cost, word: "Engagement cost" }], intent: { type: "Engage", enemyId: id } };
        }),
        primary: null,
        alternative: { label: "Do not engage", intent: { type: "DeclineEngage" } },
      };
    }
    case "chooseEnemy":
      return {
        kind: "pick",
        key: `chooseEnemy:${window.options.join(",")}`,
        step: STEP_WORDS[game.mode],
        title: window.reason === "engagement" ? "Which enemy engages" : "Which enemy attacks",
        note: "The first player chooses among enemies tied by the rules.",
        verb: "Choose",
        options: window.options.map((id) => ({ ...option(game, names, id), intent: { type: "ChooseEnemy", enemyId: id } })),
        primary: null,
        alternative: null,
      };
    case "defense":
      return defenseSheet(game, ctx, legal, names);
    case "archery":
      return archerySheet(game, ctx, names, window.total);
    case "playerAttack":
      return playerAttackSheet(game, ctx, legal, names);
    case "resolution":
      return wonSheet(game);
  }
}

/** The quest commit the bar sends: the characters dragged to the quest stage, or every legal one picked on the sheet. */
