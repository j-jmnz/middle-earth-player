// Rules: rr.action, rr.response, rr.lasting-effects, rr.step-3-2, rr.step-5-2, rr.search, rr.play-and-put-into-play
// (data/rules/entries.json).
// The Mountain of Fire events, each printed line tested from the words on the card: Captains of the West 146010:A:1, Raise the Shire
// 146013:A:1. Neither has a ledger entry, so their lines are the text of data/cards/MoF.json and the steps go through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode, type ScenarioState } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, playerTable, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const ARAGORN_CORE = "01001";
const GIMLI = "01004";
const THEODRED = "01002";
const ROSIE = "146005";
const CAPTAINS = "146010";
const RAISE = "146013";
// Stand-in: a Leadership Hobbit ally.
const HOBBIT = "hobbit";
const CHEAP = "cheap";
const DEAR = "dear";
const ALLY = "ally";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN_CORE, GIMLI, THEODRED, ROSIE, CAPTAINS, RAISE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(HOBBIT, definePrinted({ code: HOBBIT, name: "Hobbit", type: "ally", traits: ["Hobbit"], sphere: "leadership", cost: 1, willpower: 1, attack: 1, defense: 1, health: 1 }));
  base = { ...starter, cards };
});

function play(run: Run, tab: Table, cardId: string, hostId?: string): Run {
  return sendUnledgered(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId), ...(hostId ? { hostId } : {}) }, tab.ctx);
}

// The engine moves on to `mode` (its phase begins) and runs to its next window.
function enter(state: ScenarioState, tab: Table, mode: Parameters<typeof withMode>[1]): Run {
  return begin(settle({ ...withMode(state, mode), window: null }, tab.ctx, []));
}

// The end of the round: its action window is passed, so the round ends.
function endRound(state: ScenarioState, tab: Table): Run {
  let run = enter(state, tab, "endRound");
  for (let guard = 0; guard < 10 && run.state.window?.kind === "frameAction"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
  return run;
}

const printed = (tab: Table, code: string, which: "attack" | "defense" | "willpower"): number => tab.ctx.cards.get(code)?.[which] ?? 0;

describe("Captains of the West (146010:A:1)", () => {
  // "Quest Action: Until the end of the phase, each Noble hero gets +1 Willpower and does not exhaust to commit to the quest.":
  // Aragorn and Théodred (Noble) get +1 Willpower and stay ready when they commit; Pal (a Hobbit) exhausts as usual.
  lineSpec("146010:A:1", "Captains of the West: each Noble hero gets +1 Willpower and does not exhaust to commit", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: ARAGORN_CORE, seat: 0 }, { code: THEODRED, seat: 0 }, { code: PAL, seat: 0 }], hand: [{ code: CAPTAINS, seat: 0 }] });
    const [aragorn, theodred, pal] = [idsOf(tab, ARAGORN_CORE), idsOf(tab, THEODRED), idsOf(tab, PAL)];
    let run = play(begin(tab.state), tab, idsOf(tab, CAPTAINS));
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(printed(tab, ARAGORN_CORE, "willpower") + 1);
    expect(stat(run.state, tab, theodred, "willpower")).toBe(printed(tab, THEODRED, "willpower") + 1);
    expect(stat(run.state, tab, pal, "willpower")).toBe(printed(tab, PAL, "willpower"));
    run = sendUnledgered(run, { type: "Commit", cardIds: [aragorn, theodred, pal] }, tab.ctx);
    expect(run.state.cards[aragorn]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[theodred]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[pal]).toMatchObject({ committed: true, exhausted: true });
  });

  it("146010:A:1 Captains of the West: not playable in the planning phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN_CORE, seat: 0 }], hand: [{ code: CAPTAINS, seat: 0 }] });
    const offered = legalIntents(tab.state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));
    expect(offered).not.toContain(idsOf(tab, CAPTAINS));
  });
});

describe("Raise the Shire (146013:A:1)", () => {
  // "Response: After you engage an enemy, search the top 5 cards of your deck for a Hobbit ally and put it into play (search you entire
  // deck instead if that enemy's engagement cost is higher than your threat). Shuffle your deck. At the end of the round, if that ally
  // is still in play, return it to your hand.": the deck holds a Hobbit ally second and Rosie Cotton sixth.
  function raised(effects: readonly Effect[], enemy: string): { tab: Table; run: Run } {
    const deck = [{ code: "card", seat: 0 }, { code: HOBBIT, seat: 0 }, { code: "card", seat: 0 }, { code: ALLY, seat: 0 }, { code: "card", seat: 0 }, { code: ROSIE, seat: 0 }];
    // Gimli (Tactics) pays; Tom Cotton would answer the Hobbit's entry with his own Response.
    const tab = table(effects, { start: "encounter", heroes: [{ code: GIMLI, seat: 0 }], staging: [enemy], hand: [{ code: RAISE, seat: 0 }], playerDeck: deck });
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, enemy) }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, RAISE), effectId: "146013:response:1", payments: [{ heroId: idsOf(tab, GIMLI), amount: 1 }] }, tab.ctx);
    return { tab, run };
  }

  // The Cheap enemy (2) is no dearer than the threat (8): the top 5 only, so the Hobbit ally is the one choice; it comes back to the hand
  // at the end of the round.
  lineSpec("146013:A:1", "Raise the Shire: a Hobbit ally from the top 5 into play, back to the hand at the end of the round", (effects) => {
    const { tab, run: played } = raised(effects, CHEAP);
    const hobbit = idsOf(tab, HOBBIT);
    let run = played;
    if (run.state.window?.kind === "choose") {
      expect(choices(run.state, tab)).toEqual([hobbit]);
      run = sendUnledgered(run, { type: "Choose", optionId: hobbit }, tab.ctx);
    }
    expect(run.state.cards[hobbit]).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.cards[idsOf(tab, ROSIE)]?.zone).toBe("deck");
    expect(run.state.seats[0]?.deck).toHaveLength(5);
    expect(run.state.cards[idsOf(tab, RAISE)]?.zone).toBe("discard");
    const ended = endRound(run.state, tab);
    expect(ended.state.cards[hobbit]?.zone).toBe("hand");
  });

  // The Dear enemy (50) is dearer than the threat: the whole deck, so Rosie Cotton (sixth) is a choice too.
  lineSpec("146013:A:1", "Raise the Shire: the whole deck when the enemy's engagement cost is higher than your threat", (effects) => {
    const { tab, run: played } = raised(effects, DEAR);
    expect(choices(played.state, tab).sort()).toEqual([idsOf(tab, HOBBIT), idsOf(tab, ROSIE)].sort());
    const run = sendUnledgered(played, { type: "Choose", optionId: idsOf(tab, ROSIE) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ROSIE)]?.zone).toBe("play");
  });
});
