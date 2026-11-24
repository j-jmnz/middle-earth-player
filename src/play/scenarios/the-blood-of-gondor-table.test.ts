// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, rr.travel, rr.lasting-effects, hon.siege (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3, 06119:A:1, 06119:A:2, 06121:A:1, 06123:A:1, 06123:A:3, 06125:A:1, 06125:A:2, 06128:A:3, 06131:A:1, 06132:A:2, 06133:A:2.
// What the table says for The Blood of Gondor: how many hidden cards each player holds and never what one is, the two stages, the two objective allies, the Travel cost of each location, The Cross-roads, Black Númenorean, Conflict at the Crossroads' lasting Threat, Brutal Uruk's attack,
// Faramir's choice of a player, the choice at the beginning of combat, the refusal of a Travel with nothing to take, the banner and the log, and the words of the hidden verbs. Each moment is real: the cards are taken by the engine's own verb.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, resolveRecords, send, start } from "../../../test/harness/scene-kit.ts";
import { CODES, drive, opened, run, table, takes } from "../../../test/scenarios/the-blood-of-gondor/table.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { cardKeywords } from "../cards/card-keywords.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { previewCards, questTitle } from "../cards/table-preview.ts";
import { defenseSheet } from "../choice/combat-sheets.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { turnReference } from "../phases/reference.ts";
import { beforeCombatNote } from "../readouts/against-the-shadow/blood.ts";
import { readoutFor } from "../readouts/readout.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { setAsideList } from "../store/set-aside.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { nextRoundSteps } from "../store/store.ts";
import { instructionWords } from "../words/instruction.ts";

const { ambusher, uruk, looms, rabble, faramir, alcaron, captured, ambush, crossroads, southern, western, eastern, darkWoods, numenorean, conflict } = CODES;

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: ScenarioState) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const describe_ = (made: Made) => (code: string) => ({ name: nameOf(made)(code), text: "", source: null }) as never;
const detail = (made: Made, state: ScenarioState, code: string) => previewCards(state, made.ctx, idOf(state, code), describe_(made), idName(made, state), [], ledgerLine).cards.find((card) => card.code === code)?.detail;
const stageLine = (made: Made, state: ScenarioState) => questTitle(state, made.ctx, state.questStage ?? "", "Stage", ledgerLine)?.detail ?? "";
const namesOf = (made: Made, state: ScenarioState): SheetNames => ({ card: idName(made, state), line: () => null });
const logNames = (made: Made, state: ScenarioState): LogNames => ({ card: idName(made, state), code: nameOf(made), effectCard: () => null, rule: () => null, line: () => null });
const marks = (made: Made, state: ScenarioState) => seatMarks(state, made.ctx).map((mark) => [mark.seat, mark.label, mark.warn?.words ?? null]);
const moment = (made: Made, before: ScenarioState, after: ScenarioState, steps: never[]) => momentOf(before, after, steps, { card: idName(made, after), typeOf: (id) => made.cards.get(after.cards[id]?.code ?? "")?.type ?? null });

describe("how many hidden cards each player holds (ats.hidden-cards)", () => {
  const made = table({ seats: 2, play: [faramir], deck: [ambusher, uruk, looms, "f0", "f0", "f0", "f0"] });
  const held = takes(made, takes(made, made.state, 0, 2), 1, 1);

  it("every seat's dial says its own count, and a total dial says them all", () => {
    expect(marks(made, held)).toEqual([[0, "P1 · Hidden 2", null], [1, "P2 · Hidden 1", null]]);
    const [dial] = scenarioDials(held, made.ctx, nameOf(made));
    expect(dial).toMatchObject({ label: "Hidden", value: 3, name: "Hidden cards in all play areas: 3. Each seat's own count is on its threat dial" });
    expect(dial?.note).toBe("Hidden cards: Player 1 holds 2, Player 2 holds 1. Nobody sees the cards, only how many each player holds.");
    expect(seatMarks(held, made.ctx)[0]?.note).toBe("Player 1's play area holds 2 hidden cards, facedown. Nobody sees which they are.");
  });

  it("a solo player's dial has no seat prefix", () => {
    const solo = table({ deck: [ambusher, "f0"] });
    expect(marks(solo, takes(solo, solo.state, 0))).toEqual([[0, "Hidden 1", null]]);
  });

  it("names no hidden card and tells no type: the dials, the notes, the Set aside list and the previews hold only counts", () => {
    const text = JSON.stringify([scenarioDials(held, made.ctx, nameOf(made)), seatMarks(held, made.ctx), setAsideList(held, made.ctx), stageLine(made, held), detail(made, held, faramir)]);
    for (const hidden of [ambusher, uruk, looms]) expect(text).not.toContain(nameOf(made)(hidden));
    expect(text).not.toMatch(/Orc Ambusher|Brutal Uruk|Mordor Looms/);
    expect(setAsideList(held, made.ctx)).toEqual({ cards: [], rows: [], facedown: 3 });
  });

  it("the banner and the log tell a card taken by its count and its source, never the card", () => {
    const before = made.state;
    const steps: never[] = [];
    const after = run(made, before, { verb: "TakeHiddenCard", amount: 2 }, { seat: 0, steps });
    const lines = moment(made, before, after, steps)?.lines.map((line) => line.text);
    expect(lines).toEqual(["Player 1 takes 2 hidden cards, holds 2 now"]);
    expect(JSON.stringify(lines)).not.toContain("Orc Ambusher");
  });

  it("holds no warning at 4 on stage 1, where nothing turns the cards at 5", () => {
    const four = table({ deck: ["f0", "f0", "f0", "f0", "f0"] });
    expect(marks(four, takes(four, four.state, 0, 4))).toEqual([[0, "Hidden 4", null]]);
  });

  it("warns at 4 on stage 2, which turns the cards at 5, for the seat that holds them and the total", () => {
    const stage = table({ seats: 2, stage: captured, deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    const four = takes(stage, takes(stage, stage.state, 0, 4), 1, 1);
    expect(marks(stage, four)).toEqual([[0, "P1 · Hidden 4", "Player 1 holds 4 hidden cards: one more turns them all faceup"], [1, "P2 · Hidden 1", null]]);
    expect(seatMarks(four, stage.ctx)[0]?.note).toBe("Player 1's play area holds 4 hidden cards, facedown. Nobody sees which they are. At 5 the player turns them all faceup.");
    expect(scenarioDials(four, stage.ctx, nameOf(stage))[0]?.warn).toEqual({ level: "near", words: "Player 1 holds 4 hidden cards: one more turns them all faceup" });
  });
});

describe("the two stages (06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3)", () => {
  it("stage 1 says what each phase does with the hidden cards, what stage 2 does when it is revealed and the loss", () => {
    const made = table({ deck: ["f0", "f0", "f0"] });
    expect(stageLine(made, takes(made, made.state, 0, 2))).toBe("You hold 2 hidden cards. At the beginning of the quest phase each player takes 1 hidden card. At the beginning of the combat phase each player, the first player first, chooses: turn each of his hidden cards faceup (an enemy engages him, any other card is discarded), or take 1 hidden card. Defeating this stage reveals Captured!: Faramir and Lord Alcaron go under it with nobody to control them, and every player turns his hidden cards faceup. The players lose if Faramir or Lord Alcaron leaves play.");
  });

  it("stage 2 says the turn at 5, the allies held under it, the win and the loss, and Siege while The Cross-roads is in play", () => {
    const made = table({ seats: 2, stage: captured, staging: [crossroads], deck: ["f0", "f0", "f0", "f0"] });
    expect(stageLine(made, made.state)).toBe("Hidden cards: Player 1 holds 0, Player 2 holds 0. At the beginning of the quest phase each player takes 1 hidden card. A player who holds 5 hidden cards turns them all faceup at once (an enemy engages him, any other card is discarded). Faramir and Lord Alcaron lie under this stage: in play, controlled by nobody, with no Action to use. The Cross-roads is in play, so this stage has Siege and no Battle: characters count Defense when questing. Defeating this stage wins the game. The players lose if either ally leaves play.");
    const bare = table({ stage: captured });
    expect(stageLine(bare, bare.state)).not.toContain("The Cross-roads");
  });
});

describe("the objective allies (06132:A:2, 06133:A:2, 06118:A:1)", () => {
  const made = table({ seats: 2, firstPlayer: 1, play: [{ code: faramir, seat: 1 }, { code: alcaron, seat: 1 }] });
  const faramirAction = "Action: exhaust it to choose a player who holds a hidden card; 1 of that player's hidden cards, picked at random, is turned faceup (an enemy takes 3 damage first, and one it destroys never engages; any other card is discarded).";

  it("Faramir's preview says whose he is, that only that player may use his Action, the loss and what the Action does", () => {
    expect(detail(made, made.state, faramir)).toBe(`Objective ally. Player 2 controls it: only Player 2 may use its Action, though it is an objective. Control passes with the first player token. The players lose if it leaves play. ${faramirAction}`);
    const solo = table({ play: [alcaron] });
    expect(detail(solo, solo.state, alcaron)).toBe("Objective ally. You control it: only you may use its Action, though it is an objective. Control passes with the first player token. The players lose if it leaves play. Action: exhaust it to return an enemy engaged with the player who controls it to the staging area.");
  });

  it("the allies under Captured! are told by the stage's pill and its preview: in play, controlled by nobody, with no Action", () => {
    const stage = table({ seats: 2, stage: captured, play: [{ code: faramir, seat: 1 }, { code: alcaron, seat: 1 }] });
    const held = run(stage, stage.state, { verb: "HoldUnderStage", codes: [faramir, alcaron] }, { sourceId: idOf(stage.state, captured) });
    expect(slotNumbers(held, stage.ctx, idOf(held, captured), 0).under).toMatchObject({ text: "2 held", speech: expect.stringContaining("Faramir") });
    expect(stageLine(stage, held)).toContain("Faramir and Lord Alcaron lie under this stage: in play, controlled by nobody, with no Action to use.");
  });

  it("the banner and the log tell the allies placed under Captured! and control passing with the first player token", () => {
    const steps: never[] = [];
    const held = run(made, made.state, { verb: "HoldUnderStage", codes: [faramir, alcaron] }, { sourceId: idOf(made.state, ambush), steps });
    expect(moment(made, made.state, held, steps)?.lines.map((line) => line.text)).toContain("Faramir and Lord Alcaron are under Captured!: in play, controlled by nobody");
    const passed = run(made, made.state, { verb: "GainControlOfSelf" }, { sourceId: idOf(made.state, faramir), steps });
    const next = { ...passed, firstPlayer: 0 };
    const again = run(made, next, { verb: "GainControlOfSelf" }, { sourceId: idOf(next, faramir) });
    expect(moment(made, next, again, [])?.lines.map((line) => line.text) ?? []).toEqual(["Faramir: Player 1 gains control, the first player token passed"]);
  });

  it("Faramir's choice names each player and how many hidden cards he holds, never a card", () => {
    const two = table({ seats: 2, phase: "Combat", play: [faramir], deck: [ambusher, uruk, "f0", "f0"] });
    const held = takes(two, takes(two, two.state, 0, 1), 1, 1);
    const at = send(opened(two, held), { type: "Trigger", cardId: idOf(held, faramir), effectId: "06132:action:1" }, two.ctx);
    const sheet = sheetFor(at.state, two.ctx, legalIntents(at.state, two.ctx), namesOf(two, at.state)) as PickSheet;
    expect(sheet.note).toBe("Faramir: choose the player whose hidden card is turned faceup. The card is picked at random from that player's hidden cards, and nobody sees which it is before it turns. An enemy takes 3 damage first, and one it destroys never engages. Any other card is discarded. Player 1 chooses.");
    expect(sheet.options.map((option) => option.label)).toEqual(["Player 1 (1 hidden card): turn 1 hidden card faceup, picked at random. An enemy takes 3 damage first", "Player 2 (1 hidden card): turn 1 hidden card faceup, picked at random. An enemy takes 3 damage first"]);
    expect(JSON.stringify(sheet)).not.toMatch(/Orc Ambusher|Brutal Uruk/);
  });
});

describe("the locations (06123:A:1, 06123:A:3, 06125:A:1, 06125:A:2, 06128:A:3, 06119:A:1)", () => {
  const made = table({ seats: 2, staging: [crossroads, southern, western, eastern, darkWoods, numenorean], deck: ["f0", "f0", "f0", "f0", "f0"] });
  const held = takes(made, made.state, 0, 2);

  it("a Travel cost is said as its consequence, with what the first player holds", () => {
    expect(detail(made, held, southern)).toBe("To travel here the first player (Player 1) takes 1 hidden card: the top of the encounter deck, facedown, not revealed (Player 1 holds 2 now).");
    expect(detail(made, held, eastern)).toBe("To travel here the first player (Player 1) takes 2 hidden cards: the top of the encounter deck, facedown, not revealed (Player 1 holds 2 now). It has +5 quest points while it is in the staging area, and loses them once it is the active location.");
  });

  it("The Cross-roads says the Siege it gives and its Threat", () => {
    expect(detail(made, held, crossroads)).toBe("To travel here the first player (Player 1) takes 1 hidden card: the top of the encounter deck, facedown, not revealed (Player 1 holds 2 now). While it is in play, in the staging area or active, the current quest stage has Siege and no Battle: characters count Defense when questing. Its Threat is 2, the number of players.");
  });

  it("the Dark Woods says who discards a hidden card at random when it is explored, and Black Númenorean its X and each player's raise", () => {
    expect(detail(made, held, darkWoods)).toBe("When it leaves play explored, the first player (Player 1) discards 1 hidden card at random, unseen: it is not turned faceup, so nothing engages and no When Revealed resolves (Player 1 holds 2 now).");
    expect(detail(made, held, numenorean)).toBe("X is 2, every hidden card in the game. At the end of the round each player raises his threat by his own hidden cards: Player 1 +2, Player 2 +0.");
  });

  it("a Travel with nothing left to take is refused with its reason, and said in the preview", () => {
    const empty = table({ phase: "Travel", staging: [crossroads], deck: [], discard: [] });
    const at = opened(empty);
    const sheet = sheetFor(at.state, empty.ctx, legalIntents(at.state, empty.ctx), namesOf(empty, at.state)) as PickSheet;
    expect(sheet.unavailable?.map((entry) => entry.reason)).toEqual(["The players cannot travel here: the encounter deck and its discard pile hold fewer than 1 hidden card to take."]);
    expect(detail(empty, at.state, crossroads)).toContain("The players cannot travel here now: the encounter deck and its discard pile hold no card.");
  });
});

describe("Conflict at the Crossroads and Brutal Uruk (06131:A:1, 06121:A:1)", () => {
  it("the quest readout says the Threat the engaged Orcs add until the end of the phase", () => {
    const made = table({ phase: "Quest", engaged: [{ code: rabble, seat: 0 }], staging: [conflict], deck: ["f0", "f0"] });
    const revealed = resolveRecords(made.state, made.ctx, conflict, "whenRevealed", idOf(made.state, conflict));
    const quest = (state: ScenarioState): ScenarioState => ({ ...state, mode: "questCommit" });
    const result = readoutFor(quest(revealed.state), made.ctx, null, null, idName(made, revealed.state))?.result ?? "";
    expect(result).toMatch(/; Conflict at the Crossroads: the engaged Orcs add 2 Threat to the staging area until the end of the phase$/);
    expect(readoutFor(quest(made.state), made.ctx, null, null, idName(made, made.state))?.result).not.toContain("Conflict at the Crossroads");
  });

  it("Brutal Uruk's attack sheet says what a destroyed character costs its controller, with the hidden cards the defender holds", () => {
    const made = table({ seats: 2, phase: "Encounter", stage: captured, engaged: [{ code: uruk, seat: 0 }], deck: ["f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 2);
    const atDefense = (state: ScenarioState) => {
      let at = send(start(state), { type: "DeclineEngage" }, made.ctx);
      for (let guard = 0; guard < 40 && at.state.window?.kind !== "defense"; guard += 1) {
        const pass = legalIntents(at.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
        if (at.state.window?.kind === "chooseEnemy") at = send(at, { type: "ChooseEnemy", enemyId: at.state.window.options[0] ?? "" }, made.ctx);
        else if (pass) at = send(at, pass as never, made.ctx);
        else break;
      }
      return at;
    };
    const at = atDefense(held);
    expect(at.state.window?.kind).toBe("defense");
    const sheet = defenseSheet(at.state, made.ctx, legalIntents(at.state, made.ctx), namesOf(made, at.state)) as PickSheet;
    expect(sheet.note).toContain("If this attack destroys a character, its controller turns all his hidden cards faceup. Each enemy turned is dealt a shadow card and attacks as normal. Player 1 holds 2 hidden cards: all are turned faceup, one at a time.");
  });
});

describe("the choice at the beginning of the combat phase (06117:B:2)", () => {
  it("says how many hidden cards the player holds and what each option does, in its own words", () => {
    const made = table({ seats: 2, firstPlayer: 1, phase: "Encounter", deck: [rabble, "f0", "f0", "f0"] });
    const held = takes(made, takes(made, made.state, 1, 1), 0, 0);
    const at = drive(made, opened(made, held), (state) => state.window?.kind === "choose");
    const sheet = sheetFor(at.state, made.ctx, legalIntents(at.state, made.ctx), namesOf(made, at.state)) as PickSheet;
    expect(sheet.note).toContain("Player 2: Beginning of combat, The Ambush: turn your hidden cards faceup, or take 1 more. Hidden cards you hold: 1. Turning engages each enemy among them whatever its engagement cost and discards any other card. Taking adds the top card of the encounter deck, facedown and unseen.");
    expect(sheet.options.map((option) => option.label)).toEqual(["Turn your hidden card faceup: an enemy engages you, any other card is discarded", "Take 1 hidden card: the top card of the encounter deck lies facedown in your play area, unseen (you hold 1 now)"]);
  });

  it("a player with none turns nothing, and the banner and the log tell the cards turned, each with its type and where it went", () => {
    const made = table({ seats: 2, firstPlayer: 1, phase: "Encounter", deck: [rabble, looms, "f0", "f0", "f0", "f0"] });
    const held = takes(made, made.state, 1, 2);
    const at = drive(made, opened(made, held), (state) => state.window?.kind === "choose");
    const turned = send(at, { type: "Choose", optionId: "turn" }, made.ctx);
    const lines = moment(made, at.state, turned.state, turned.steps as never[])?.lines.map((line) => line.text);
    expect(lines).toEqual(["Orc Rabble engages Player 2", "Hidden cards", "Player 2 turns 2 hidden cards faceup (The Ambush)", "Mordor Looms (treachery) is discarded"]);
    const log = logLines(nextRoundSteps([], at.state, turned.state, turned.steps, made.ctx), logNames(made, turned.state)).map((line) => line.text);
    expect(log).toEqual(["Orc Rabble engages Player 2", "Player 2 turns 2 hidden cards faceup (The Ambush)", "Mordor Looms (treachery) is discarded"]);
  });

  it("the turn at 5 on stage 2 is told as such, with every card it turned and what each was", () => {
    const made = table({ phase: "Quest", stage: captured, deck: [rabble, looms, "f0", "f0", "f0", "f0", "f0"] });
    const four = takes(made, made.state, 0, 4);
    const steps: never[] = [];
    const after = run(made, four, { verb: "TakeHiddenCard" }, { seat: 0, steps });
    const lines = moment(made, four, after, steps)?.lines.map((line) => line.text) ?? [];
    expect(lines).toEqual(["Orc Rabble engages you", "Hidden cards", "You hold 5 hidden cards: Captured! turns them all faceup at once", "You turn 5 hidden cards faceup", "Mordor Looms (treachery) is discarded", "And 6 more in the log"]);
    const log = logLines(nextRoundSteps([], four, after, steps, made.ctx), logNames(made, after)).map((line) => line.text);
    expect(log).toContain("You turn 5 hidden cards faceup");
    expect(log).toContain("Mordor Looms (treachery) is discarded");
  });
});

describe("the stage's keywords, the guide and the rail", () => {
  const keywords = (made: Made, state: ScenarioState, code: string) => previewCards(state, made.ctx, idOf(state, code), describe_(made), idName(made, state), [], ledgerLine).cards.find((card) => card.code === code)?.keywords?.map((word) => word.word);
  const chips = (made: Made, state: ScenarioState, code: string) => cardKeywords(state, made.ctx, idOf(state, code)).map((chip) => `${chip.word}${chip.lost ? " (struck)" : ""}`);

  it("stage 2 shows Battle alone, and Siege (with Battle struck) while The Cross-roads is in play", () => {
    const bare = table({ stage: captured });
    expect(keywords(bare, bare.state, captured)).toContain("Battle");
    expect(keywords(bare, bare.state, captured)).not.toContain("Siege");
    const roads = table({ stage: captured, staging: [crossroads] });
    expect(keywords(roads, roads.state, captured)).toContain("Siege");
    expect(chips(roads, roads.state, captured)).toEqual(["Battle (struck)", "Siege"]);
    expect(chips(bare, bare.state, captured)).toEqual(["Battle"]);
  });

  it("on stage 1 the guide and the window before combat say the choice comes before the shadow cards; stage 2 keeps the plain lines", () => {
    const one = table({ deck: ["f0"] });
    const step = (state: ScenarioState) => turnReference(state, () => null).flatMap((phase) => phase.steps).find((row) => row.id === "6.2");
    expect(step(one.state)?.decision).toBe("At the beginning of combat each player, the first player first, turns his hidden cards faceup or takes 1 hidden card. Then each engaged enemy is dealt a face-down shadow card.");
    expect(beforeCombatNote(one.state, "5.3")).toBe("Engagement is done. Each player chooses next: turn hidden cards faceup, or take 1 hidden card. Shadow cards are dealt after that, to the enemies turned too.");
    const two = table({ stage: captured });
    expect(step(two.state)?.decision).toBe("Each engaged enemy is dealt a face-down shadow card.");
    expect(beforeCombatNote(two.state, "5.3")).toBeNull();
  });
});

describe("the words of the hidden verbs", () => {
  const made = table({ seats: 2 });
  const words = (verb: object) => instructionWords(verb as never, made.state, { card: (id) => id, code: (code) => code }, null);

  it("each verb is one sentence a choice or a response can say", () => {
    expect(words({ verb: "TakeHiddenCard" })).toBe("you take 1 hidden card: the top of the encounter deck, facedown");
    expect(words({ verb: "TakeHiddenCard", who: "firstPlayer", amount: 2 })).toBe("the first player takes 2 hidden cards: the top of the encounter deck, facedown");
    expect(words({ verb: "TurnHiddenCards", who: "actor" })).toBe("you turn each hidden card faceup, one at a time (an enemy engages him, any other card is discarded)");
    expect(words({ verb: "TurnHiddenCard", damageEnemy: 3 })).toBe("turn 1 hidden card of the player chosen faceup (an enemy takes 3 damage first)");
    expect(words({ verb: "DiscardHiddenCard", who: "firstPlayer" })).toBe("the first player discards 1 hidden card at random, unseen");
    expect(words({ verb: "HoldUnderStage", codes: [faramir, alcaron] })).toBe("place Faramir and Lord Alcaron under this stage, controlled by nobody");
    expect(words({ verb: "GainControlOfSelf" })).toBe("the first player gains control of this card");
  });
});
