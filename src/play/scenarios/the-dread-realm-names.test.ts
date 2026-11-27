// Rules: mec108.reanimated-dead, rr.engaged, rr.effects (data/rules/entries.json); ledger lines 101163:A:1, 101162:A:2.
// A Reanimated Dead is named "Reanimated Dead" on every path that names a card (the engage banner, a pick row, the log, the reader's "attached to"), through the lookup the table uses (shownName by picture key), never by its raw code and never by the card it was.
// A commit window that still owes a hero (A Fell Dread) has no Pass: the dock offers Commit only, the note names the hero and the card, and the engine's refusal says the same.
import { describe, expect, it } from "vitest";

import { A_FELL_DREAD, POSSESSION } from "../../effects/authored/angmar-awakened/the-dread-realm.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { rejectionReason } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { idOf, legalIntents, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { nameOfCard, pictureCode } from "../canvas/picture-key.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { shownName } from "../cards/shown-name.ts";
import { windowSheet } from "../choice/bar-sheets.ts";
import { dockFor, startChoice } from "../choice/table-choice.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames, WindowSheet } from "../choice/sheet-types.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { momentOf } from "../store/outcome.ts";
import { logLines } from "../store/log.ts";
import { cardSpeech, type CardSpeechDeps } from "../words/card-speech.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-dread-realm", { phase: "Quest", deck: ["f0", "f0", "f0", "f0"], ...layout });
type Made = ReturnType<typeof built>;

// The lookups of the table (screens/table/card-lookups.ts): a name by picture key through shownName, a card's by instance id through nameOfCard.
const nameOfKey = (made: Made) => (key: string) => shownName(key, made.cards.get(pictureCode(key)));
const sheetNames = (made: Made, state: ScenarioState): SheetNames => ({ card: (id) => nameOfCard(state.cards, id, nameOfKey(made)), line: () => null });
const deadIn = (state: ScenarioState, seat = 0): string => state.seats[seat]?.engaged.find((id) => state.cards[id]?.code.endsWith("~dead")) ?? "";
const reanimated = (made: Made, seat = 0): ScenarioState => runInstruction(made.state, { verb: "Reanimate", from: "deckTop" }, { seat, sourceId: null }, made.ctx, []);

describe("a Reanimated Dead is named Reanimated Dead on every path", () => {
  it("mec108.reanimated-dead is named by its picture key, whatever card it was, never by its raw code", () => {
    const made = built({ seats: 1, deckOf: ["10179"] });
    const state = reanimated(made);
    const key = `${state.cards[deadIn(state)]?.code}`;
    expect(key.endsWith("~dead")).toBe(true);
    expect(nameOfKey(made)(key)).toBe("Reanimated Dead");
    expect(nameOfKey(made)(`${key}.B`)).toBe("Reanimated Dead");
    expect(nameOfCard(state.cards, deadIn(state), nameOfKey(made))).toBe("Reanimated Dead");
  });

  it("rr.engaged says a dead's engagement in the banner by its name", () => {
    const made = built({ seats: 2, deckOf: ["10179"] });
    const after = reanimated(made);
    const dead = deadIn(after);
    const moment = momentOf(made.state, after, [{ kind: "engage", seat: 0, enemyId: dead }], { card: sheetNames(made, after).card });
    expect(moment?.title).toBe("Reanimated Dead engages");
    expect(moment?.lines.map((line) => line.text)).toEqual(["Engaged with Player 1"]);
  });

  it("names a dead in the row of a pick (the enemy a player attacks) and in the attackers' sheet", () => {
    const made = built({ seats: 1, phase: "PlayerAttacks", deckOf: ["10179"], play: ["10179"] });
    const state = reanimated(made);
    const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), sheetNames(made, state)) as PickSheet;
    const row = sheet.options.find((item) => item.id === deadIn(state));
    expect(row?.label).toBe("Reanimated Dead");
    expect(row && "next" in row && row.next.kind === "multi" ? row.next.title : "").toBe("Attack Reanimated Dead");
    const chosen = sheetFor({ ...state, window: { kind: "chooseEnemy", reason: "attack", seat: 0, options: [deadIn(state)] } }, made.ctx, [{ type: "ChooseEnemy" }], sheetNames(made, state)) as PickSheet;
    expect(chosen.options.map((item) => item.label)).toEqual(["Reanimated Dead"]);
  });

  it("names a dead in the log", () => {
    const made = built({ seats: 1, deckOf: ["10179"] });
    const state = reanimated(made);
    const dead = deadIn(state);
    const names = { card: sheetNames(made, state).card, code: nameOfKey(made), effectCard: () => null, rule: () => null, line: () => null };
    const lines = logLines([{ kind: "damage", targetId: dead, amount: 2, cause: { rule: "rr.damage" } }], names);
    expect(lines.map((line) => line.text)).toEqual(["2 damage on Reanimated Dead"]);
  });

  it("101162:A:2 says Possession is attached to the Reanimated Dead, never to its raw code", () => {
    const made = built({ seats: 1, play: ["10179"] });
    const run = resolveRecords(made.state, made.ctx, POSSESSION, "whenRevealed");
    const state = settle({ ...run.state, window: null, mode: "stopped" }, made.ctx, []);
    const deps: CardSpeechDeps = {
      nameOf: nameOfKey(made),
      inactive: () => false,
      facts: { typeOf: (code) => made.cards.get(code)?.type ?? null, shipRank: () => null },
      info: (game, seat, cardId) => slotNumbers(game, made.ctx, cardId, seat),
      highlight: NO_HIGHLIGHT,
      cards: made.cards,
      sheet: null,
      peeking: false,
    };
    const label = cardSpeech(state, 0, idOf(state, POSSESSION), deps).label;
    expect(label).toContain("attached to Reanimated Dead");
    expect(label).not.toContain("~dead");
  });
});

describe("a commit window that still owes a hero offers Commit only", () => {
  const owing = () => built({ seats: 1, attached: [{ code: A_FELL_DREAD, to: "dh1" }] });
  const windowOf = (made: Made, state: ScenarioState): WindowSheet => windowSheet(state, made.ctx, legalIntents(state, made.ctx), sheetNames(made, state));

  it("101163:A:1 leaves no Pass among the legal intents and the dock's primary waits for a pick, saying who must commit", () => {
    const made = owing();
    const legal = legalIntents(made.state, made.ctx);
    expect(legal.some((intent) => intent.type === "Pass")).toBe(false);
    expect(legal.some((intent) => intent.type === "Commit")).toBe(true);
    const sheet = windowOf(made, made.state);
    expect(sheet.pass).toBeNull();
    expect(sheet.mustCommit).toBe("dh1 must commit to the quest (A Fell Dread)");
    const table = { game: made.state, ctx: made.ctx, legal, names: { ...sheetNames(made, made.state), facedown: (id: string) => id } };
    const empty = dockFor(sheet, startChoice(sheet), table, { overlay: false, passLegal: false, surface: "table" });
    expect(empty.primary).toMatchObject({ label: "Commit", action: { kind: "clear" } });
    expect(empty.why).toBe("dh1 must commit to the quest (A Fell Dread)");
    expect([empty.primary, ...empty.secondary].some((button) => button?.action.kind === "intent" && button.action.intent.type === "Pass")).toBe(false);
    const picked = dockFor(sheet, { key: sheet.key, ids: [idOf(made.state, "dh1")], shares: [] }, table, { overlay: false, passLegal: false, surface: "table" });
    expect(picked.primary?.label).toBe("Commit 1");
    expect(picked.primary?.action).toMatchObject({ kind: "intent", intent: { type: "Commit" } });
  });

  it("101163:A:1 refuses a Pass naming the hero and the card, and offers Pass again once the hero has committed", () => {
    const made = owing();
    expect(rejectionReason(made.state, { type: "Pass" }, made.ctx)).toBe("dh1 must commit to the quest (A Fell Dread)");
    const none = built({ seats: 1 });
    expect(rejectionReason(none.state, { type: "Pass" }, none.ctx)).toBeNull();
  });
});
