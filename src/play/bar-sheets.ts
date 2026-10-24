// The sheets the bar opens (the quest commit, the Actions list, a pay sheet) and the intents a multi-choice or distribute
// sheet sends for what the player picked. The reducer still checks every intent.
import type { PlayerIntent, LegalIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { legalTargets } from "../rules/reduce.ts";

import type { PayRequest, Share } from "./pay.ts";
import { STEP_WORDS } from "./rail.ts";
import type { DistributePurpose, DistributeSheet, MultiSheet, SheetNames, TriggerSheet } from "./sheet-types.ts";
import { option, step, triggerOptions } from "./sheets.ts";

export function commitSheet(game: ScenarioState, ctx: ReduceContext, names: SheetNames, pendingCommit: readonly string[]): MultiSheet {
  return {
    kind: "multi",
    key: `commit:${game.round}`,
    step: "Quest",
    title: "Commit to the quest",
    note: "Committed characters exhaust and add their willpower against the threat in staging.",
    verb: "Commit",
    options: legalTargets(game, { type: "Commit" }, ctx).map((id) => option(game, names, id)),
    build: { kind: "Commit" },
    allowEmpty: false,
    preselected: pendingCommit,
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

/** The intent a multi-choice sheet sends for the chosen ids. */
export function multiIntent(sheet: MultiSheet, ids: readonly string[]): PlayerIntent {
  switch (sheet.build.kind) {
    case "Commit":
      return { type: "Commit", cardIds: [...ids] };
    case "CommitHide":
      return { type: "CommitHide", cardIds: [...ids] };
    case "attack":
      return { type: "DeclareAttackers", enemyId: sheet.build.enemyId, attackerIds: [...ids] };
  }
}

/** The pay sheet for a card or an effect whose cost takes resources. */
export function paySheet(game: ScenarioState, names: SheetNames, request: PayRequest, purpose: DistributePurpose): DistributeSheet {
  const source = names.card(request.cardId);
  return {
    kind: "distribute",
    key: `pay:${request.cardId}:${purpose.kind}`,
    step: STEP_WORDS[game.mode],
    title: request.exact ? `Pay ${request.total} for ${source}` : `Pay for ${source}`,
    note: request.exact ? "Tap a hero to take one resource from its pool." : "X is what you pay. Tap a hero to take one resource from its pool.",
    total: request.total,
    exact: request.exact,
    options: request.pools.map((pool) => ({ ...option(game, names, pool.heroId), max: pool.max })),
    purpose,
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
