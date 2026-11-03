import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { enemy as seaEnemy, hero as seaHero, seaTable, send, ship as seaShip, shipEnemy, until } from "../../rules/families/sea/table.ts";

import { actionsSheet, commitSheet, windowSheet } from "./bar-sheets.ts";
import { sailingTable, seaFixture, seaViews } from "../dream-chaser/sea-fixture.ts";
import { dropTargets, draggableIds } from "../store/selection.ts";
import { whyNotChosen } from "./why.ts";
import { highlightKeys, highlightOf } from "../canvas/highlight-of.ts";
import { momentOf } from "../store/outcome.ts";
import { tableLayout } from "../layout/layout.ts";
import { readoutFor } from "../readouts/readout.ts";
import { actingSeat, lookedOf, onTableFor, PILES, pileSelector, shownSeat, TABLE_ZONES, zoneSelector, type PileId, type PileView, type ZoneId, type ZoneView } from "../store/selectors.ts";
import { twoHanded } from "../store/seat-fixture.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import { createTableStore } from "../store/store.ts";
import { tapAction, tileAction, trayTiles } from "./tray-logic.ts";
import { choiceFor, dockFor, onlyAnswer, onTheTable, primaryReady, tap, tappable, type Choice, type Dock, type TapContext } from "./table-choice.ts";

// Rules: rr.action-windows, rr.step-3-4, rr.step-6-4-3 (data/rules/entries.json). The table answers every moment of whole
// starter games: a tap on a card only picks it (or opens the question it leads to), the dock's buttons send intents the
// reducer accepts, every button that would send one with nothing picked must be armed first (unless the moment has only one
// answer, which is picked already and sends on one tap), and the numbers beside the quest are the ones the engine then
// resolves it with.
let ctx: ReduceContext;
const names: SheetNames = { card: (id) => id, line: () => null };

beforeAll(async () => {
  ctx = (await starterWorld("wisdom-and-wizardry")).ctx;
});

function accepted(state: ScenarioState, intent: PlayerIntent): boolean {
  return reduce(state, intent, ctx).ok;
}

function sheetOf(state: ScenarioState): Sheet {
  const legal = legalIntents(state, ctx);
  return sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
}

type Seen = { taps: number; opened: number; sent: number; armed: number; single: number; done: number };

function buttonsOf(dock: Dock) {
  return [...(dock.primary ? [{ button: dock.primary, ready: primaryReady(dock) }] : []), ...dock.secondary.map((button) => ({ button, ready: true }))];
}

// Each button of the dock that sends an intent: the reducer takes it. `fresh` is true for the sheet the window opened with
// nothing picked yet: there, every button that sends an intent must be armed first.
function checkDock(state: ScenarioState, sheet: Sheet, held: Choice | null, table: TapContext, overlay: boolean, fresh: boolean, seen: Seen): void {
  const passLegal = table.legal.some((intent) => intent.type === "Pass");
  const only = onlyAnswer(sheet, table.legal);
  const single = only != null;
  const dock = dockFor(sheet, choiceFor(sheet, held, only), table, { overlay, passLegal, surface: "table", single });
  // A sheet opened from the table always has the window's other answers behind it.
  if (overlay) expect(single, `${sheet.kind} ${sheet.key} opened from the table counts as one answer`).toBe(false);
  if (single && held == null) {
    // The one answer is picked already: the primary is ready, sends on one tap, and is the engine's only legal intent.
    expect(primaryReady(dock), `${sheet.kind} ${sheet.key} has one answer and its primary waits`).toBe(true);
    expect(dock.primary?.arm, `${sheet.kind} ${sheet.key} has one answer and arms`).toBe(false);
    expect(table.legal).toHaveLength(1);
    if (dock.primary?.action.kind === "intent") {
      expect(dock.primary.action.intent.type).toBe(table.legal[0]?.type);
      seen.single += 1;
    }
  }
  for (const { button, ready } of buttonsOf(dock)) {
    if (!ready || button.action.kind !== "intent") continue;
    expect(accepted(state, button.action.intent), `${sheet.kind} ${button.label} ${JSON.stringify(button.action.intent)}`).toBe(true);
    seen.sent += 1;
    if (fresh && !single) {
      expect(button.arm, `${sheet.kind} ${button.label} sends an intent with nothing picked`).toBe(true);
      seen.armed += 1;
    }
  }
}

function checkSheet(state: ScenarioState, sheet: Sheet, table: TapContext, overlay: boolean, depth: number, seen: Seen): void {
  checkDock(state, sheet, null, table, overlay, !overlay && sheet.kind !== "distribute", seen);
  for (const cardId of [...tappable(sheet)].slice(0, 4)) {
    const result = tap(sheet, null, cardId, table);
    seen.taps += 1;
    // A tap never changes the game.
    expect(result.kind).not.toBe("intent");
    if (result.kind === "choice") checkDock(state, sheet, result.choice, table, overlay, false, seen);
    if (result.kind === "open" && depth < 2) {
      seen.opened += 1;
      checkSheet(state, result.sheet, table, true, depth + 1, seen);
    }
  }
}

describe("the table answers each moment", () => {
  it("with taps that only pick and buttons the reducer accepts, the ones that send with nothing picked armed, in whole games", () => {
    const seen: Seen = { taps: 0, opened: 0, sent: 0, armed: 0, single: 0, done: 0 };
    for (const seed of STARTER_SEEDS) {
      let state = startScenario(starterStart("wisdom-and-wizardry", seed), ctx);
      for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
        const legal = legalIntents(state, ctx);
        const sheet = sheetOf(state);
        const table: TapContext = { game: state, ctx, legal, names };
        checkSheet(state, sheet, table, false, 0, seen);
        // The panels the dock's List and Actions (n) open over the window.
        if (sheet.kind === "window" && sheet.commit) checkSheet(state, commitSheet(state, ctx, names), table, true, 1, seen);
        if (sheet.kind === "window" && sheet.triggers.length > 0) checkSheet(state, actionsSheet(state, ctx, legal, names), table, true, 1, seen);
        // The commit window's pass says Done once a character of the seat is committed.
        if (sheet.kind === "window" && sheet.commit) {
          const committed = Object.values(state.cards).some((card) => card.committed && card.controller === state.activeSeat);
          expect(sheet.pass).toBe(committed ? "Done" : "Commit no one");
          seen.done += committed ? 1 : 0;
        }
        // A sheet answered on the table names only cards the layout draws whole: a card slot (or the playable top of the
        // deck), never an attachment strip or a card that is not drawn at all.
        const seat = shownSeat(state, null);
        if (onTheTable(sheet, onTableFor(state, seat))) {
          const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat)(state)])) as Record<ZoneId, ZoneView>;
          const piles = Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, seat)(state)])) as Record<PileId, PileView>;
          const deckTop = state.seats[seat]?.deck[0];
          const layout = tableLayout(560, 330, views, piles, { deckTop: deckTop && legal.some((intent) => intent.type === "PlayCard" && intent.cardId === deckTop) ? state.cards[deckTop] : null });
          const whole = new Set(layout.slots.filter((slot) => slot.kind === "card").map((slot) => slot.id));
          // In the action window an attachment's Action peeks out on a strip; the dock's Actions list names it on paper.
          const listed = new Set(sheet.kind === "window" ? sheet.triggers.map((item) => item.cardId) : []);
          for (const id of tappable(sheet)) expect(whole.has(id) || listed.has(id), `${sheet.kind} ${id} is not drawn whole`).toBe(true);
        }
        state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx)).state;
      }
    }
    expect(seen.taps).toBeGreaterThan(50);
    expect(seen.opened).toBeGreaterThan(0);
    expect(seen.sent).toBeGreaterThan(100);
    expect(seen.armed).toBeGreaterThan(50);
    expect(seen.single).toBeGreaterThan(0);
    expect(seen.done).toBeGreaterThan(0);
  });

  it("a choice belongs to its sheet: a new sheet starts empty, a payment starts from the first guess", () => {
    const state = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
    const sheet = sheetOf(state);
    const stale: Choice = { key: "something else", ids: ["x"], shares: [] };
    expect(choiceFor(sheet, stale)).toEqual({ key: sheet.key, ids: [], shares: [] });
  });
});

describe("numbers beside the quest", () => {
  it("are the willpower and threat the engine resolves the quest with, and the banner says how it went", async () => {
    let compared = 0;
    let quests = 0;
    for (const [deck, seed] of ["stealth-and-steadfastness", "wisdom-and-wizardry"].flatMap((id) => STARTER_SEEDS.map((value) => [id, value] as const))) {
      const ctx = (await starterWorld(deck)).ctx;
      const sheetOf = (state: ScenarioState): Sheet => {
        const legal = legalIntents(state, ctx);
        return sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
      };
      let state = expectOk(reduce(startScenario(starterStart(deck, seed), ctx), { type: "Keep" }, ctx)).state;
      for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
        const before = state;
        const readout = readoutFor(before, ctx, sheetOf(before), null, (id) => id);
        const result = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx));
        const quest = result.steps.find((step) => step.kind === "quest");
        if (quest?.kind === "quest") {
          quests += 1;
          // Shown after staging, while the window before quest resolution was open: the same numbers.
          if (before.mode === "resolution" && readout?.kind === "quest") {
            expect(readout.stats.map((stat) => stat.value)).toEqual([quest.willpower, quest.threat]);
            compared += 1;
          }
          const moment = momentOf(before, result.state, result.steps, names);
          expect(moment?.lines[0]?.text).toBe(`Willpower ${quest.willpower} against threat ${quest.threat}`);
          expect(moment?.title).toBe(quest.willpower > quest.threat ? "Quest succeeded" : quest.willpower < quest.threat ? "Quest failed" : "Quest held even");
          const raised = result.steps.some((step) => step.kind === "threat" && "rule" in step.cause && step.cause.rule === "rr.step-3-4");
          expect(raised).toBe(quest.willpower < quest.threat);
        }
        state = result.state;
      }
    }
    expect(quests).toBeGreaterThan(5);
    expect(compared).toBeGreaterThan(0);
  });
});

describe("numbers beside an attack", () => {
  it("are the attack and the defense the engine then strikes with, a defender's defending-only bonus included", async () => {
    let compared = 0;
    for (const deck of ["stealth-and-steadfastness", "wisdom-and-wizardry"]) {
      const ctx = (await starterWorld(deck)).ctx;
      for (const seed of STARTER_SEEDS) {
        let state = expectOk(reduce(startScenario(starterStart(deck, seed), ctx), { type: "Keep" }, ctx)).state;
        for (let turn = 0; turn < 900 && !state.lost && !state.stageCleared; turn += 1) {
          const legal = legalIntents(state, ctx);
          let intent: PlayerIntent = nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true });
          // Keep characters back from the quest so that defenders exist, and defend with the first one the rules allow.
          if (state.mode === "questCommit" && state.window?.kind === "pass" && legal.some((item) => item.type === "Commit")) intent = { type: "Pass" };
          const sheet = sheetFor(state, ctx, legal, names);
          if (state.window?.kind === "defense" && sheet?.kind === "pick") {
            const option = sheet.options.find((item) => "intent" in item && item.intent.type === "DeclareDefender");
            if (option && "intent" in option) {
              const readout = readoutFor(state, ctx, sheet, { key: sheet.key, ids: [option.id], shares: [] }, (id) => id);
              const result = expectOk(reduce(state, option.intent, ctx));
              const strike = result.steps.find((step) => step.kind === "strike" && step.targetId === option.id);
              // A shadow effect may change the numbers after the pick; compare only attacks whose shadow card has none.
              const shadowCode = state.cards[state.cards[state.window.enemyId]?.shadowId ?? ""]?.code;
              const shadowed = ctx.effects.some((effect) => effect.cardCode === shadowCode && effect.timing === "shadow");
              if (strike?.kind === "strike" && !shadowed) {
                expect(readout?.stats.map((stat) => stat.value)).toEqual([strike.attack, strike.defense]);
                expect(strike.undefended).toBe(false);
                compared += 1;
              }
              state = result.state;
              continue;
            }
          }
          state = expectOk(reduce(state, intent, ctx)).state;
        }
      }
    }
    expect(compared).toBeGreaterThan(0);
  }, 120_000);

  it("say a defended attack against 0 defense was defended, in the banner and in the log", async () => {
    const { logLines } = await import("../store/log.ts");
    const state = startScenario(starterStart("wisdom-and-wizardry", 1), ctx);
    const cause = { rule: "rr.step-6-4-3" };
    const strike = { kind: "strike" as const, side: "enemy" as const, enemyId: "rider", targetId: "pony", attack: 2, defense: 0, undefended: false, cause };
    const steps = [strike, { kind: "damage" as const, targetId: "pony", amount: 2, cause }];
    const moment = momentOf(state, state, steps, names);
    expect(moment?.lines[0]?.text).toBe("Attack 2 against pony's defense 0");
    const words = (id: string) => id;
    const lines = logLines(steps, { card: words, code: words, effectCard: () => null, rule: () => null, line: () => null });
    expect(lines[0]?.text).toBe("Attack 2 against defense 0 on pony");
    const undefended = logLines([{ ...strike, undefended: true }], { card: words, code: words, effectCard: () => null, rule: () => null, line: () => null });
    expect(undefended[0]?.text).toBe("Attack 2, undefended, on pony");
  });
});

// Peeking at the other seat (phase 26): the table draws it, the acting seat still picks, and a card tap only previews.
describe("a peek at the other seat", () => {
  const duo = twoHanded();
  const sheetOfDuo = (state: ScenarioState): Sheet => sheetFor(state, duo.ctx, legalIntents(state, duo.ctx), names) ?? windowSheet(state, duo.ctx, legalIntents(state, duo.ctx), names);
  const tapping = (cardId: string, over: Partial<Parameters<typeof tapAction>[0]> = {}) => ({ panelOpen: false, reader: false, cardId, peeking: false, faceDown: false, ...over });

  it("turns a tap on any card into its preview, never a pick, and sends nothing", () => {
    const store = createTableStore({ ctx: duo.ctx, game: duo.state });
    store.getState().peek(1);
    const peeking = store.getState().viewedSeat === 1;
    const pick = vi.fn(() => true);
    for (const cardId of [...duo.seats[1].hand, duo.seats[1].hero, ...duo.seats[1].engaged, ...duo.staging, ...duo.seats[0].hand]) expect(tapAction(tapping(cardId, { peeking }), pick), cardId).toBe("preview");
    // A face-down card shows nothing, a pile still lists, a screen reader still previews, and the open tray still folds.
    expect(tapAction(tapping("c", { peeking, faceDown: true }), pick)).toBe("none");
    expect(tapAction(tapping("pile:discard", { peeking }), pick)).toBe("pile");
    expect(tapAction(tapping("c", { peeking, reader: true, panelOpen: true }), pick)).toBe("preview");
    expect(tapAction(tapping("c", { peeking, panelOpen: true }), pick)).toBe("fold");
    expect(pick).not.toHaveBeenCalled();
    // Not peeking, the same tap is offered to the pick, and a card it does not take is previewed.
    expect(tapAction(tapping("c"), pick)).toBe("picked");
    expect(tapAction(tapping("c"), () => false)).toBe("preview");
    expect(store.getState().game).toBe(duo.state);
    expect([store.getState().history.length, store.getState().moment]).toEqual([0, null]);
  });

  it("leaves every pick the acting seat's: the seat that picks, the cards that glow and mute, and what a tap may pick", () => {
    const store = createTableStore({ ctx: duo.ctx, game: duo.state });
    store.getState().peek(1);
    const { game, viewedSeat } = store.getState();
    const sheet = sheetOfDuo(game);
    expect([shownSeat(game, viewedSeat), actingSeat(game)]).toEqual([1, 0]);
    const keys = (seat: number) => highlightKeys({ game, seat, sheet, choice: choiceFor(sheet, null), panel: false });
    // Planning mutes seat 0's hand card no hero can pay for; read for the seat drawn it would mute all of seat 1's hand instead.
    expect(keys(actingSeat(game)).muted).toBe(duo.seats[0].hand.at(-1));
    expect(keys(shownSeat(game, viewedSeat)).muted).toBe(duo.seats[1].hand.join(","));
    for (const id of tappable(sheet)) expect(duo.seats[0].hand.includes(id), `${id} is seat 0's`).toBe(true);
    const onTable = onTableFor(game, actingSeat(game));
    expect([...duo.seats[0].hand.map(onTable), ...duo.seats[1].hand.map(onTable)]).toEqual([true, true, true, false, false, false]);
    const play = legalIntents(game, duo.ctx).find((intent) => intent.type === "PlayCard");
    expect(play?.type === "PlayCard" ? duo.seats[0].hand.includes(play.cardId) : false).toBe(true);
  });

  it("is kept out of the hook that picks: use-table-choice.ts never reads the seat drawn", () => {
    const source = readFileSync(new URL("./use-table-choice.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/shownSeat|viewedSeat/);
    expect(source).toMatch(/actingSeat\(game\)/);
  });

  it("ends on a new sheet key and on a change of the acting seat", () => {
    const store = createTableStore({ ctx: duo.ctx, game: duo.state });
    const firstKey = sheetOfDuo(store.getState().game).key;
    store.getState().peek(1);
    // Seat 0 passes: the engine asks seat 1, a new sheet key and a new acting seat; the peek is over.
    expect(store.getState().dispatch({ type: "Pass" })).toBe(true);
    expect(sheetOfDuo(store.getState().game).key).not.toBe(firstKey);
    expect(actingSeat(store.getState().game)).toBe(1);
    expect(store.getState().viewedSeat).toBeNull();
    // Peeking at seat 0 now, any new state ends it too.
    store.getState().peek(0);
    expect(store.getState().viewedSeat).toBe(0);
    store.getState().dispatch({ type: "Pass" });
    expect(store.getState().viewedSeat).toBeNull();
  });
});

// Rules: dcce.ship-enemies, dcce.ship-objectives, dcce.sailing-tests (data/rules/entries.json). How the table answers the sea family's moments: a defender pick that glows the
// ships and veils the rest with the engine's own refusal, the Sailing commit with its readout, a pick that reaches a folded card, and no sheet that asks for a number.
describe("the sea family's moments on the table", () => {
  const SEA_NAMES: SheetNames = { card: (id) => id, line: () => null };
  const sea = (seed: Parameters<typeof seaTable>[0]) => seaTable(seed);

  function underShipAttack() {
    const built = sea({ cards: [seaHero("aragorn"), seaShip("dc", "Dream-chaser"), seaShip("ds", "Dawn Star"), shipEnemy("corsair")], effects: [], heroes: [{ code: "aragorn" }], allies: [{ code: "dc" }, { code: "ds" }], enemies: [{ code: "corsair" }] });
    return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense") };
  }

  it("glows the ships and veils every other character in a ship-enemy's defender pick, with the engine's reason on the veiled card", () => {
    const { state, ids, ctx: seaCtx } = underShipAttack();
    const legal = legalIntents(state, seaCtx);
    const sheet = sheetFor(state, seaCtx, legal, SEA_NAMES);
    expect(sheet?.kind).toBe("pick");
    const glow = tappable(sheet as Sheet);
    expect([...glow].sort()).toEqual([ids.dc, ids.ds].sort());
    const keys = highlightKeys({ game: state, seat: 0, sheet: sheet as Sheet, choice: { key: (sheet as Sheet).key, ids: [], shares: [] }, panel: false });
    expect(keys.dim).toBe(true);
    expect(whyNotChosen(state, seaCtx, ids.aragorn!, sheet)).toBe("Only a ship-objective can defend against a ship-enemy's attack.");
    // A ship that can be chosen carries no refusal.
    expect(whyNotChosen(state, seaCtx, ids.dc!, sheet)).toBeNull();
  });

  it("says nothing on a veiled card outside the sea family: the same pick in a game with no sea state has no refusal", () => {
    const { state, ids, ctx: seaCtx } = underShipAttack();
    const sheet = sheetFor(state, seaCtx, legalIntents(state, seaCtx), SEA_NAMES);
    expect(whyNotChosen(state, seaCtx, ids.aragorn!, sheet)).not.toBeNull();
    expect(whyNotChosen({ ...state, sea: undefined }, seaCtx, ids.aragorn!, sheet)).toBeNull();
  });

  it("keeps the moment's cards on the table while the tray is open or the table peeks: the fold reads the sheet, not the glow", () => {
    const fixture = seaFixture({ staging: 12, engaged: 0 });
    const { views, piles } = seaViews(fixture);
    const first = fixture.ids.staged0!;
    const pick: Sheet = { kind: "multi", key: "k", step: "Quest", title: "Pick", note: null, verb: "Pick", options: [{ id: first, label: "first", code: "galley" }], build: { kind: "Commit" }, allowEmpty: false, preselected: [], alternative: null };
    const keys = highlightKeys({ game: fixture.state, seat: 0, sheet: pick, choice: { key: "k", ids: [], shares: [] }, panel: true });
    // The tray is open: nothing glows, yet the option card is still kept.
    expect(keys.glow).toBe("");
    const highlight = highlightOf(keys);
    expect(highlight.tappable.size).toBe(0);
    expect([...highlight.keep]).toEqual([first]);
    const folded = (keep: ReadonlySet<string>) => (tableLayout(591, 338, views, piles, { scale: 1.15, keep }).folds ?? []).flatMap((fold) => fold.cards);
    expect(folded(new Set())).toContain(first);
    expect(folded(highlight.keep)).not.toContain(first);
  });

  it("veils the ships when the attack is not a ship-enemy's, and an attack on a non-ship enemy refuses the ships with the engine's words", () => {
    const built = sea({ cards: [seaHero("aragorn"), seaShip("dc", "Dream-chaser"), seaEnemy("raider")], effects: [], heroes: [{ code: "aragorn" }], allies: [{ code: "dc" }], enemies: [{ code: "raider" }] });
    const state = { ...built.state, phase: "Combat" as const, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const }, boundaryPhase: "Combat" as const };
    const picking: Sheet = { kind: "multi", key: "attack", step: "Combat", title: "Attack", note: null, verb: "Attack", options: [{ id: built.ids.aragorn!, label: "aragorn", code: "aragorn" }], build: { kind: "attack", enemyId: built.ids.raider! }, allowEmpty: false, preselected: [], alternative: null };
    expect(whyNotChosen(state, built.ctx, built.ids.dc!, picking)).toBe("A ship-objective can only attack a ship-enemy.");
    expect(whyNotChosen(state, built.ctx, built.ids.aragorn!, picking)).toBeNull();
  });

  it("refuses a character that cannot attack with the engine's reason, the path Raider Flagship's own line takes (phase 47)", () => {
    const built = sea({ cards: [seaHero("aragorn"), seaHero("boromir"), shipEnemy("flagship")], effects: [], heroes: [{ code: "aragorn" }, { code: "boromir" }], enemies: [{ code: "flagship" }] });
    const bar = { ...built.state, modifiers: [...built.state.modifiers, { instanceId: built.ids.boromir!, stat: "cannotAttack" as const, amount: 1, until: "endOfPhase" as const, sourceId: built.ids.flagship! }] };
    const state = { ...bar, phase: "Combat" as const, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const }, boundaryPhase: "Combat" as const };
    const picking: Sheet = { kind: "multi", key: "attack", step: "Combat", title: "Attack", note: null, verb: "Attack", options: [{ id: built.ids.aragorn!, label: "aragorn", code: "aragorn" }], build: { kind: "attack", enemyId: built.ids.flagship! }, allowEmpty: false, preselected: [], alternative: null };
    expect(whyNotChosen(state, built.ctx, built.ids.boromir!, picking)).toMatch(/^.+\.$/);
  });

  it("opens a pick that reaches a folded card as the choice tray, and as the table when the card is drawn whole", () => {
    const { state, ids, ctx: seaCtx } = underShipAttack();
    const sheet = sheetFor(state, seaCtx, legalIntents(state, seaCtx), SEA_NAMES) as Sheet;
    expect(onTheTable(sheet, onTableFor(state, 0))).toBe(true);
    expect(onTheTable(sheet, onTableFor(state, 0, new Set([ids.dc!])))).toBe(false);
    expect(onTableFor(state, 0, new Set([ids.ds!]))(ids.ds!)).toBe(false);
    expect(onTableFor(state, 0, new Set([ids.ds!]))(ids.dc!)).toBe(true);
  });

  function atSailing() {
    const f = sailingTable();
    return { ...f, sheet: sheetFor(f.state, f.ctx, legalIntents(f.state, f.ctx), SEA_NAMES) as Sheet };
  }

  it("asks the Sailing commit as a pick of characters with no willpower pill, and counts the Dream-chaser as 2 from the engine", () => {
    const { state, ids, ctx: seaCtx, sheet } = atSailing();
    expect(sheet.kind).toBe("multi");
    if (sheet.kind !== "multi") return;
    expect(sheet.title).toBe("Commit to the Sailing test");
    expect(sheet.options.map((item) => item.id).sort()).toEqual([ids.aragorn, ids.dc].sort());
    for (const item of sheet.options) expect(item.stats).toBeUndefined();
    const picked = (list: readonly string[]) => readoutFor(state, seaCtx, sheet, { key: sheet.key, ids: list, shares: [] }, (id) => (id === ids.dc ? "Dream-chaser" : id));
    expect(picked([ids.aragorn!])?.result).toBe("Looks at 1 card");
    expect(picked([ids.aragorn!, ids.dc!])?.result).toBe("Looks at 3 cards · the Dream-chaser counts as 2");
    expect(picked([])?.kind).toBe("sailing");
    // The primary counts the picks and is the quest commit's intent, which the engine reads as the test's.
    const table: TapContext = { game: state, ctx: seaCtx, legal: legalIntents(state, seaCtx), names: SEA_NAMES };
    const dock = dockFor(sheet, { key: sheet.key, ids: [ids.aragorn!, ids.dc!], shares: [] }, table, { overlay: false, passLegal: true, surface: "table" });
    expect(dock.primary?.label).toBe("Commit 2");
    expect(dock.primary?.action).toEqual({ kind: "intent", intent: { type: "Commit", cardIds: [ids.aragorn, ids.dc] } });
    expect(accepted2(state, seaCtx, dock.primary?.action)).toBe(true);
  });

  it("holds the strip with a single Done when the answers bring the heading back to Sun, then discards it", () => {
    const { state, ids, ctx: seaCtx } = atSailing();
    const asked = send(state, { type: "Commit", cardIds: [ids.aragorn!, ids.dc!] }, seaCtx);
    const held = send(asked, { type: "Choose", optionId: "shift" }, seaCtx);
    // Cloud to Sun with two symbols unanswered: the same cards stay up, one answer.
    expect(lookedOf(held)).toHaveLength(3);
    const sheet = sheetFor(held, seaCtx, legalIntents(held, seaCtx), SEA_NAMES) as Sheet;
    expect(sheet.kind).toBe("pick");
    if (sheet.kind !== "pick") return;
    expect(sheet.look).toHaveLength(3);
    expect(sheet.title).toBe("Sailing test · 3 successes");
    expect(sheet.primary).toEqual({ label: "Done", intent: { type: "Choose", optionId: "done" } });
    expect(sheet.alternative).toBeNull();
    expect(legalIntents(held, seaCtx)).toEqual([{ type: "Choose", optionId: "done" }]);
    expect(readoutFor(held, seaCtx, sheet, null, (id) => id)?.result).toBe("Sun, no change");
    const done = send(held, { type: "Choose", optionId: "done" }, seaCtx);
    expect(lookedOf(done)).toHaveLength(0);
    expect(done.encounterDiscard).toHaveLength(3);
  });

  it("names the commit's Pass once, saying nobody looks and the heading stays shifted", () => {
    const { state, ids, ctx: seaCtx, sheet } = atSailing();
    const table: TapContext = { game: state, ctx: seaCtx, legal: legalIntents(state, seaCtx), names: SEA_NAMES };
    const dock = dockFor(sheet, { key: sheet.key, ids: [], shares: [] }, table, { overlay: false, passLegal: true, surface: "table" });
    const passes = dock.secondary.filter((button) => button.action.kind === "intent" && button.action.intent.type === "Pass");
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ label: "Pass", arm: true, armed: "Tap again: nobody looks, and the heading stays shifted" });
    expect(accepted2(state, seaCtx, passes[0]?.action)).toBe(true);
    expect(ids.aragorn).toBeDefined();
  });

  it("reads what one shift does, and how many symbols would still be asked after it", () => {
    const rain = sailingTable({ heading: "Rain" });
    // The shift as the test opens leaves Storm; the look is 3 symbols (1, 0 and 2).
    const asked = send(rain.state, { type: "Commit", cardIds: [rain.ids.aragorn!, rain.ids.dc!] }, rain.ctx);
    const sheet = sheetFor(asked, rain.ctx, legalIntents(asked, rain.ctx), SEA_NAMES) as Sheet;
    expect(readoutFor(asked, rain.ctx, sheet, null, (id) => id)?.result).toBe("Storm to Rain · 2 more symbols");
  });

  it("answers each symbol found with a shift or a keep, lists the cards looked at, and reads the heading change the engine would make", () => {
    const { state, ids, ctx: seaCtx } = atSailing();
    const asked = send(state, { type: "Commit", cardIds: [ids.aragorn!, ids.dc!] }, seaCtx);
    const sheet = sheetFor(asked, seaCtx, legalIntents(asked, seaCtx), SEA_NAMES) as Sheet;
    expect(sheet.kind).toBe("pick");
    if (sheet.kind !== "pick") return;
    expect(sheet.title).toBe("Sailing test · 3 successes");
    expect(sheet.look?.map((row) => row.success)).toEqual([1, 0, 2]);
    expect(sheet.primary?.intent).toEqual({ type: "Choose", optionId: "shift" });
    expect(sheet.alternative && "intent" in sheet.alternative && sheet.alternative.intent).toEqual({ type: "Choose", optionId: "keep" });
    const readout = readoutFor(asked, seaCtx, sheet, null, (id) => id);
    // The commit shifted the heading off-course to Cloud; three symbols could bring it back to Sun, and no further.
    expect(readout?.result).toBe("Cloud to Sun");
    expect(readout?.stats).toEqual([{ icon: "sailingSuccess", value: 3, word: "Success" }]);
    expect(accepted2(asked, seaCtx, { kind: "intent", intent: { type: "Choose", optionId: "shift" } })).toBe(true);
    // The rows the dock's List opens, read-only, each with its symbols.
    const tiles = trayTiles(sheet);
    expect(tiles.map((tile) => tile.look)).toEqual([1, 0, 2]);
    expect(tiles.map((tile) => tile.detail)).toEqual(["Success", null, "Success ×2"]);
    // A look row is no choice: a tap on it reads the card, and every other tile picks.
    expect(tiles.map(tileAction)).toEqual(["read", "read", "read"]);
    expect(tileAction({})).toBe("pick");
  });

  it("offers every sea sheet's options as cards or answers, never a number to type", () => {
    const sheets: Sheet[] = [];
    const commit = atSailing();
    sheets.push(commit.sheet);
    const asked = send(commit.state, { type: "Commit", cardIds: [commit.ids.aragorn!] }, commit.ctx);
    sheets.push(sheetFor(asked, commit.ctx, legalIntents(asked, commit.ctx), SEA_NAMES) as Sheet);
    const under = underShipAttack();
    sheets.push(sheetFor(under.state, under.ctx, legalIntents(under.state, under.ctx), SEA_NAMES) as Sheet);
    for (const sheet of sheets) {
      expect(sheet.kind === "distribute", sheet.key).toBe(false);
      if (sheet.kind === "multi" || sheet.kind === "pick") {
        // Each option is a card of the table or an answer the engine lists; nothing is a count to enter.
        for (const item of sheet.options) expect(Number.isNaN(Number(item.id)), `${sheet.key} ${item.id}`).toBe(true);
      }
      const intents = [sheet.kind === "pick" ? sheet.primary?.intent : null, sheet.kind === "pick" && sheet.alternative && "intent" in sheet.alternative ? sheet.alternative.intent : null].filter((intent) => intent != null);
      for (const intent of intents) expect(JSON.stringify(intent)).not.toMatch(/"amount"|"threat"|"damage"|"progress"|"resources"|"life"/);
    }
  });
});

function accepted2(state: ScenarioState, seaCtx: ReduceContext, action: Dock["primary"] extends infer P ? (P extends { action: infer A } ? A : never) | undefined : never): boolean {
  return action?.kind === "intent" && reduce(state, action.intent, seaCtx).ok;
}

describe("no quest drag during the Sailing commit (dcce.sailing-tests)", () => {
  it("lets no character be dragged onto the quest while the first player is asked what to commit to the test, and still drags to the quest after it", () => {
    const f = sailingTable();
    const legal = legalIntents(f.state, f.ctx);
    expect(legal).toContainEqual({ type: "Commit" });
    expect(draggableIds(f.state, f.ctx, legal)).toEqual([]);
    expect(dropTargets(f.state, f.ctx, legal, f.ids.aragorn!)).toEqual([]);
    // After the test the quest commitment is open as ever.
    const after = send(f.state, { type: "Pass" }, f.ctx);
    const next = legalIntents(after, f.ctx);
    expect(draggableIds(after, f.ctx, next)).toContain(f.ids.aragorn);
    expect(dropTargets(after, f.ctx, next, f.ids.aragorn!)).toEqual([{ kind: "zone", zone: "questStage" }]);
  });
});
