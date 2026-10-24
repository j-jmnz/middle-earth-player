import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../scripts/starter-game.ts";

import { railFor, STEP_WORDS } from "./rail.ts";
import { firstShares, playRequest, sharesReady, tapShare } from "./pay.ts";
import { dropTargets } from "./selection.ts";
import { actionsSheet, commitSheet, distributeIntent, multiIntent, paySheet, sheetFor, type Sheet, type SheetNames } from "./sheets.ts";

// Rules: rr.framework-steps, mec109.hide-tests, rr.step-6-4-3 (data/rules/entries.json). Every choice a sheet offers is an
// intent the reducer accepts, in every window two starter decks meet in whole games of A Shadow of the Past; the rail names
// the engine's step and never another one.
let ctx: ReduceContext;
const names: SheetNames = { card: (id) => id, line: () => null };

function accepted(state: ScenarioState, intent: PlayerIntent): boolean {
  return reduce(state, intent, ctx).ok;
}

// The intents a sheet can send without the player building anything further.
function intentsOf(state: ScenarioState, sheet: Sheet): PlayerIntent[] {
  switch (sheet.kind) {
    case "pick": {
      const out: PlayerIntent[] = [];
      for (const option of sheet.options) {
        if ("intent" in option) out.push(option.intent);
        else out.push(...intentsOf(state, option.next));
      }
      if (sheet.primary) out.push(sheet.primary.intent);
      if (sheet.alternative && "intent" in sheet.alternative) out.push(sheet.alternative.intent);
      if (sheet.alternative && "next" in sheet.alternative) out.push(...intentsOf(state, sheet.alternative.next));
      return out;
    }
    case "multi": {
      const out: PlayerIntent[] = [];
      if (sheet.allowEmpty) out.push(multiIntent(sheet, []));
      if (sheet.options[0]) out.push(multiIntent(sheet, [sheet.options[0].id]));
      if (sheet.alternative && "intent" in sheet.alternative) out.push(sheet.alternative.intent);
      return out;
    }
    case "distribute": {
      const first = sheet.options[0];
      return first ? [distributeIntent(sheet, [{ id: first.id, amount: sheet.total }])] : [];
    }
    case "trigger":
      return [
        ...(sheet.pass ? [{ type: "Pass" } as PlayerIntent] : []),
        ...sheet.options.filter((option) => !option.pay).map((option): PlayerIntent => ({ type: "Trigger", cardId: option.cardId, effectId: option.effectId })),
      ];
    case "outcome":
      return [];
  }
}

beforeAll(async () => {
  ctx = (await starterWorld("wisdom-and-wizardry")).ctx;
});

describe("choice sheets", () => {
  it("offer only intents the reducer accepts, in every window of whole games", () => {
    const seen = new Set<string>();
    for (const seed of STARTER_SEEDS) {
      let state = startScenario(starterStart("wisdom-and-wizardry", seed), ctx);
      for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
        const legal = legalIntents(state, ctx);
        const sheet = sheetFor(state, ctx, legal, names);
        if (sheet) {
          seen.add(sheet.kind === "outcome" ? sheet.result : `${state.window?.kind}:${sheet.kind}`);
          for (const intent of intentsOf(state, sheet)) expect(accepted(state, intent), `${state.window?.kind} ${JSON.stringify(intent)}`).toBe(true);
        } else {
          expect(state.window?.kind).toBe("pass");
          if (state.mode === "questCommit" && legal.some((intent) => intent.type === "Commit")) {
            for (const intent of intentsOf(state, commitSheet(state, ctx, names, []))) expect(accepted(state, intent)).toBe(true);
          }
          for (const intent of intentsOf(state, actionsSheet(state, ctx, legal, names))) expect(accepted(state, intent)).toBe(true);
        }
        state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx)).state;
      }
      const end = sheetFor(state, ctx, legalIntents(state, ctx), names);
      expect(end?.kind).toBe("outcome");
      if (end?.kind === "outcome") seen.add(end.result);
    }
    // The windows these games reach: the opening hand, the Hide test, an attack, travel and the loss.
    for (const key of ["mulligan:pick", "hideCommit:multi", "defense:pick", "travel:pick", "lost"]) expect(seen, key).toContain(key);
  });

  it("the mulligan sheet keeps or redraws once", () => {
    const state = startScenario(starterStart("wisdom-and-wizardry", 1), ctx);
    const sheet = sheetFor(state, ctx, legalIntents(state, ctx), names);
    expect(sheet?.kind).toBe("pick");
    if (sheet?.kind !== "pick") return;
    expect(sheet.primary?.intent).toEqual({ type: "Keep" });
    expect(sheet.alternative && "intent" in sheet.alternative ? sheet.alternative.intent : null).toEqual({ type: "Mulligan" });
  });
});

describe("phase rail", () => {
  it("names the engine's step and its neighbours, Defeat after a loss", () => {
    let state = startScenario(starterStart("wisdom-and-wizardry", 2), ctx);
    expect(railFor(state).current).toBe("Mulligan");
    state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let turn = 0; turn < 600 && !state.lost; turn += 1) {
      const rail = railFor(state);
      expect(rail.current).toBe(STEP_WORDS[state.mode]);
      expect(rail.previous).not.toBe("");
      expect(rail.next).not.toBe("");
      state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER }), ctx)).state;
    }
    expect(state.lost).toBe(true);
    expect(railFor(state).current).toBe("Defeat");
    expect(railFor({ ...state, lost: false, stageCleared: true }).current).toBe("Victory");
  });
});

describe("pay sheet", () => {
  it("the first guess pays the printed cost from pools that may pay it, and the reducer accepts it", () => {
    let state = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
    let checked = 0;
    for (let turn = 0; turn < 600 && !state.lost && checked < 3; turn += 1) {
      const legal = legalIntents(state, ctx);
      if (state.mode === "planning") {
        for (const intent of legal) {
          if (intent.type !== "PlayCard") continue;
          const request = playRequest(state, ctx, intent.cardId);
          if (!request || !request.exact) continue;
          const shares = firstShares(request);
          if (!sharesReady(shares, request.total, request.exact)) continue;
          // An attachment with no legal host is listed but has nowhere to drop: the table offers no drop for it.
          const targets = dropTargets(state, ctx, legal, intent.cardId);
          if (targets.length === 0) continue;
          const host = targets.find((target) => target.kind === "card");
          const sheet = paySheet(state, names, request, { kind: "play", cardId: intent.cardId, hostId: host?.kind === "card" ? host.cardId : null });
          expect(accepted(state, distributeIntent(sheet, shares))).toBe(true);
          checked += 1;
        }
      }
      state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER }), ctx)).state;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("a tap adds one up to the pool and the total, then clears", () => {
    expect(tapShare([], "a", 2, 3)).toEqual([{ id: "a", amount: 1 }]);
    expect(tapShare([{ id: "a", amount: 2 }], "a", 2, 3)).toEqual([]);
    expect(tapShare([{ id: "a", amount: 2 }, { id: "b", amount: 1 }], "b", 2, 3)).toEqual([{ id: "a", amount: 2 }]);
    expect(sharesReady([{ id: "a", amount: 2 }], 3, true)).toBe(false);
    expect(sharesReady([{ id: "a", amount: 2 }], 3, false)).toBe(true);
  });
});
