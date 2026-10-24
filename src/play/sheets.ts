// Rules: rr.action, rr.response, rr.cancel, rr.mulligan, mec109.hide-x, mec109.hide-tests, rr.travel,
// rr.optional-engagement, rr.step-6-2, rr.step-6-4-3, mec109.archery (data/rules/entries.json).
//
// What the choice sheet over the rail asks, for the window the engine has open. Every option is an intent legalIntents and
// legalTargets list, or a number the engine computed (the Hide numbers, an attack and a defense). Nothing here writes a
// number: a sheet names who does something, the reducer decides what happens.
import type { Effect } from "../catalog/boundary.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { hideWillpower } from "../rules/hide.ts";
import { legalTargets, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import type { Frame } from "../rules/state.ts";
import { topFrame } from "../rules/windows.ts";

import { cancelRequest, triggerRequest } from "./pay.ts";
import { STEP_WORDS } from "./rail.ts";
import { TIMING_WORDS, type Alternative, type HideNumbers, type MultiSheet, type Sheet, type SheetNames, type SheetOption, type TriggerOption } from "./sheet-types.ts";

export function step(game: ScenarioState): string {
  return STEP_WORDS[game.mode] ?? game.phase;
}

export function option(game: ScenarioState, names: SheetNames, id: string): SheetOption {
  if (id.startsWith("seat:")) return { id, label: `Player ${Number(id.slice(5)) + 1}`, code: null };
  const card = game.cards[id];
  if (card) return { id, label: names.card(id), code: card.code };
  // A branch of a Choose instruction is named by its id in the effect record.
  return { id, label: id.charAt(0).toUpperCase() + id.slice(1), code: null };
}

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

function has(legal: readonly LegalIntent[], type: LegalIntent["type"]): boolean {
  return legal.some((intent) => intent.type === type);
}

/** The heroes an undefended attack can land on, when there is more than one to choose from. */
function undefendedSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames, title: string, note: string): Sheet | PlayerIntent {
  const heroes = legalTargets(game, { type: "Undefended" }, ctx);
  if (heroes.length <= 1) return heroes[0] ? { type: "Undefended", heroId: heroes[0] } : { type: "Undefended" };
  return {
    kind: "pick",
    key: `undefended:${game.pendingAttack?.enemyId ?? ""}`,
    step: "Combat",
    title,
    note: `${note} Undefended: a hero takes all of it.`,
    verb: "Damage to",
    options: heroes.map((id) => ({ ...option(game, names, id), intent: { type: "Undefended", heroId: id } })),
    primary: null,
    alternative: null,
  };
}

function attackNumbers(game: ScenarioState, ctx: ReduceContext): { attack: number; enemyId: string } | null {
  const enemyId = game.pendingAttack?.enemyId;
  const enemy = enemyId ? game.cards[enemyId] : undefined;
  return enemy && enemyId ? { attack: modifiedStat(game, enemy, "attack", ctx.cards), enemyId } : null;
}

/** The attackers that can join an attack on one enemy, for the second half of the player-attack sheet. */
function attackersSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames, enemyId: string): MultiSheet {
  const enemy = game.cards[enemyId];
  const defense = enemy ? modifiedStat(game, enemy, "defense", ctx.cards) : 0;
  const seat = game.activeSeat;
  const characters = [...(game.seats[seat]?.heroes ?? []), ...(game.seats[seat]?.play ?? [])].filter((id) =>
    legalTargets(game, { type: "DeclareAttackers", cardId: id }, ctx).includes(enemyId),
  );
  return {
    kind: "multi",
    key: `attackers:${enemyId}`,
    step: "Combat",
    title: `Attack ${names.card(enemyId)}`,
    note: `Defense ${defense}. Choose the characters that attack it.`,
    verb: "Attack",
    options: characters.map((id) => option(game, names, id)),
    build: { kind: "attack", enemyId },
    allowEmpty: false,
    preselected: [],
    alternative: { label: "No attack", intent: { type: "DeclineAttack" } },
  };
}

/**
 * The sheet for the open window, or null when the bar alone answers it (an ordinary action window, where Pass and the
 * Actions list sit on the bar).
 */
export function sheetFor(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): Sheet | null {
  if (game.lost) {
    return { kind: "outcome", key: "lost", result: "lost", title: "Defeat", note: game.lossReason ? `${game.lossReason}.` : "The scenario is lost." };
  }
  if (game.stageCleared) return { kind: "outcome", key: "won", result: "won", title: "Victory", note: "The scenario is won. Choose the rewards the campaign card offers." };
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
        options: legalTargets(game, { type: "CommitHide" }, ctx).map((id) => option(game, names, id)),
        build: { kind: "CommitHide" },
        allowEmpty: true,
        preselected: [],
        alternative: null,
      };
    }
    case "frameAction": {
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
      return {
        kind: "pick",
        key: `choose:${frame?.id ?? ""}:${window.options.join(",")}`,
        step: effect ? TIMING_WORDS[effect.timing] : step(game),
        title: source ? names.card(source) : "Choose",
        note: lineOf(effect, names),
        verb: "Choose",
        options: window.options.map((id) => ({ ...option(game, names, id), intent: { type: "Choose", optionId: id } })),
        primary: null,
        alternative: null,
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
        note: cancel ? "The first player may pay to cancel this effect before it resolves." : "A Response may be used now, or passed.",
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
        note: "The top of the encounter deck. Nothing moves.",
        verb: "",
        options: [],
        primary: { label: "Done", intent: { type: "Pass" } },
        alternative: null,
      };
    case "travel": {
      const targets = has(legal, "Travel") ? legalTargets(game, { type: "Travel" }, ctx) : [];
      return {
        kind: "pick",
        key: `travel:${game.round}`,
        step: "Travel",
        title: targets.length > 0 ? "Travel to a location" : "No location to travel to",
        note: targets.length > 0 ? "The location becomes active and leaves staging." : null,
        verb: "Travel to",
        options: targets.map((id) => ({ ...option(game, names, id), intent: { type: "Travel", locationId: id } })),
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
        note: "You may engage one enemy in staging.",
        verb: "Engage",
        options: targets.map((id) => ({ ...option(game, names, id), intent: { type: "Engage", enemyId: id } })),
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
    case "defense": {
      const numbers = attackNumbers(game, ctx);
      const title = numbers ? `${names.card(numbers.enemyId)} attacks` : "An enemy attacks";
      const note = numbers ? `Attack ${numbers.attack}.` : "";
      const defenders = has(legal, "DeclareDefender") ? legalTargets(game, { type: "DeclareDefender" }, ctx) : [];
      const undefended = undefendedSheet(game, ctx, names, title, note);
      const leave: Alternative = "kind" in undefended ? { label: "Leave undefended", next: undefended } : { label: "Leave undefended", intent: undefended };
      return {
        kind: "pick",
        key: `defense:${numbers?.enemyId ?? ""}:${game.pendingAttack?.undefended ? "u" : "d"}`,
        step: "Combat",
        title,
        note: game.pendingAttack?.undefended ? `${note} This attack is undefended.` : `${note} Choose a defender, or leave it undefended.`,
        verb: "Defend with",
        options: defenders.map((id) => {
          const defender = game.cards[id];
          const defense = defender ? modifiedStat(game, defender, "defense", ctx.cards) : 0;
          return { ...option(game, names, id), label: `${names.card(id)} · defense ${defense}`, intent: { type: "DeclareDefender", defenderId: id } };
        }),
        primary: null,
        alternative: leave,
      };
    }
    case "archery": {
      const recipients = legalTargets(game, { type: "Distribute" }, ctx);
      return {
        kind: "distribute",
        key: `archery:${game.round}:${window.total}`,
        step: "Combat",
        title: `Archery ${window.total}`,
        note: `Assign ${window.total} damage among your characters. Defense does not stop it.`,
        total: window.total,
        exact: true,
        options: recipients.map((id) => {
          const card = game.cards[id];
          const health = card ? modifiedStat(game, card, "hitPoints", ctx.cards) - card.damage : 0;
          return { ...option(game, names, id), label: `${names.card(id)} · ${health} hit points left`, max: window.total };
        }),
        purpose: { kind: "archery" },
      };
    }
    case "playerAttack": {
      if (!has(legal, "DeclareAttackers")) {
        return {
          kind: "pick",
          key: `playerAttack:${game.round}:none`,
          step: "Combat",
          title: "No attack is possible",
          note: null,
          verb: "",
          options: [],
          primary: { label: "Continue", intent: { type: "DeclineAttack" } },
          alternative: null,
        };
      }
      const seat = game.activeSeat;
      const enemies = new Set<string>();
      for (const id of [...(game.seats[seat]?.heroes ?? []), ...(game.seats[seat]?.play ?? [])]) {
        for (const enemyId of legalTargets(game, { type: "DeclareAttackers", cardId: id }, ctx)) enemies.add(enemyId);
      }
      return {
        kind: "pick",
        key: `playerAttack:${game.round}:${[...enemies].join(",")}`,
        step: "Combat",
        title: "Attack an enemy",
        note: "Choose the enemy, then the characters that attack it.",
        verb: "Attack",
        options: [...enemies].map((id) => ({ ...option(game, names, id), next: attackersSheet(game, ctx, names, id) })),
        primary: null,
        alternative: { label: "No attack", intent: { type: "DeclineAttack" } },
      };
    }
    case "resolution":
      return { kind: "outcome", key: "won", result: "won", title: "Victory", note: "The scenario is won. Choose the rewards the campaign card offers." };
  }
}

/** The quest commit the bar sends: the characters dragged to the quest stage, or every legal one picked on the sheet. */
