// Rules: ats.controlling-locations, ats.losing-control-of-locations, rr.winning-the-game, rr.in-play-and-out-of-play, hon.siege (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06091:B:3, 06096:A:2, 06097:A:2, 06098:A:3, 06099:A:3, 06100:A:1, 06102:A:1, 06103:A:1, 06103:A:2, 06104:A:1, 06095:A:1, 06106:A:1.
// What the table says for Assault on Osgiliath: a location a player controls (whose it is, what control gives), the dial of the win, stage 1B's lines, each unique location's undefended line, Ruined Tower, Pinned Down and Southron Commander, the attack sheet, readout and
// turn reference when the defending player controls locations, the banner and log for control taken and lost, the words of the control verbs and the choice sheets. Each moment is a real one from the engine; each hook keys on the scenario, so the last tests read the same state as another scenario's.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, revealFromTop, send, start } from "../../../test/harness/scene-kit.ts";
import { BOROMIR, CODES, EVIL_CROW, controlling, drive, opened, table } from "../../../test/scenarios/assault-on-osgiliath/table.ts";

import { cardKeywords } from "../cards/card-keywords.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { previewCards, questTitle } from "../cards/table-preview.ts";
import { defenseSheet } from "../choice/combat-sheets.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { turnReference } from "../phases/reference.ts";
import { readoutFor } from "../readouts/readout.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { momentOf } from "../store/outcome.ts";
import { nextRoundSteps } from "../store/store.ts";
import { pictureCode } from "../canvas/picture-key.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { instructionWords } from "../words/instruction.ts";
import { cardSpeech, type CardSpeechDeps } from "../words/card-speech.ts";

const { retake, harbor, library, westQuarter, tower, pinned, commander, square, counter } = CODES;

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: ScenarioState) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const describe_ = (made: Made) => (code: string) => ({ name: nameOf(made)(code), text: "", source: null }) as never;
const preview = (made: Made, state: ScenarioState, code: string) => previewCards(state, made.ctx, idOf(state, code), describe_(made), idName(made, state), [], ledgerLine).cards[0];
const detail = (made: Made, state: ScenarioState, code: string) => preview(made, state, code)?.detail;
const stageLine = (made: Made, state: ScenarioState) => questTitle(state, made.ctx, state.questStage ?? "", "Stage", ledgerLine)?.detail ?? "";
const namesOf = (made: Made, state: ScenarioState): SheetNames => ({ card: idName(made, state), line: () => null });
const logNames = (made: Made, state: ScenarioState): LogNames => ({ card: idName(made, state), code: nameOf(made), effectCard: () => null, rule: () => null, line: () => null });
const speechDeps = (made: Made): CardSpeechDeps => ({
  nameOf: (key) => made.cards.get(pictureCode(key))?.name ?? key,
  inactive: () => false,
  facts: { typeOf: (code) => made.cards.get(code)?.type ?? null, shipRank: () => null },
  info: (game, seat, cardId) => slotNumbers(game, made.ctx, cardId, seat),
  highlight: NO_HIGHLIGHT,
  cards: made.cards,
  sheet: null,
  peeking: false,
});
// The quest phase played out: the committed heroes quest and the game goes on to the travel phase.
const quested = (made: Made) => drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase !== "Quest");

// The combat step where the enemy's attack waits for the defending player.
function atDefense(made: Made, state: ScenarioState) {
  let run = send(start(state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (run.state.window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: run.state.window.options[0] ?? "" }, made.ctx);
    else if (pass) run = send(run, pass as never, made.ctx);
    else break;
  }
  return run;
}

describe("a location a player controls (06091:B:2, ats.controlling-locations)", () => {
  const made = table({ staging: [harbor, library, tower] });
  const held = controlling(made, made.state, [harbor]);

  it("its preview says whose it is, where it lies and what control gives, and its undefended Forced line as a consequence for that player", () => {
    expect(detail(made, held, harbor)).toBe("You control it: it lies in your play area, ready, with its text working. Losing control puts it in the staging area with its progress removed. If you leave an attack undefended, it returns to the staging area with its progress removed.");
  });

  it("two-handed it names the player", () => {
    const two = table({ seats: 2, firstPlayer: 1, staging: [harbor] });
    const state = controlling(two, two.state, [harbor]);
    expect(detail(two, state, harbor)).toBe("Player 2 controls it: it lies in Player 2's play area, ready, with its text working. Losing control puts it in the staging area with its progress removed. If player 2 leaves an attack undefended, it returns to the staging area with its progress removed.");
  });

  it("a unique location in the staging area says what happens once a player controls it", () => {
    expect(detail(made, held, library)).toBe("Once a player controls it: if that player leaves an attack undefended, it returns to the staging area with its progress removed.");
  });

  it("the spoken label says who controls it, and a location still in the staging area says nothing of control", () => {
    expect(cardSpeech(held, 0, idOf(held, harbor), speechDeps(made)).label).toContain("controlled by you");
    expect(cardSpeech(held, 0, idOf(held, library), speechDeps(made)).label).not.toMatch(/controlled/);
  });

  it("says nothing in another scenario", () => {
    const other = { ...held, scenarioId: "the-stewards-fear" };
    expect(detail(made, other, harbor)).toBeUndefined();
    expect(cardSpeech(other, 0, idOf(other, harbor), speechDeps(made)).label).not.toMatch(/controlled/);
    expect(scenarioDials(other, made.ctx, nameOf(made)).map((dial) => dial.id)).not.toContain("osgiliath");
  });
});

describe("the win and stage 1B (06091:B:1, 06091:B:2, 06091:B:3)", () => {
  const made = table({ staging: [harbor, library, tower], active: westQuarter });
  const state = controlling(made, made.state, [harbor]);

  it("the stage's preview says what blocks the win now, the bar on player card progress and who takes control, with no final period on a line the join ends", () => {
    expect(stageLine(made, state)).toBe(
      "To win: at the end of the round, no Osgiliath location is in the staging area or active. 3 left: The King's Library, Ruined Tower and West Quarter. 1 location controlled. No player card effect can place progress on a location in the staging area. The active location, a controlled location and any card effect of the encounter deck are not barred. An Osgiliath location that leaves play explored goes to the first player's play area, ready and with no progress. The first player controls it",
    );
  });

  it("with none left the line says the end of the round wins, and with none in play it says so", () => {
    const won = table({ staging: [] });
    expect(stageLine(won, won.state)).toBe("To win: at the end of the round, no Osgiliath location is in the staging area or active. None is in play, so the players win at the end of this round. No player card effect can place progress on a location in the staging area. The active location, a controlled location and any card effect of the encounter deck are not barred. An Osgiliath location that leaves play explored goes to the first player's play area, ready and with no progress. The first player controls it");
    const all = controlling(made, made.state, [harbor, library, tower]);
    const rest = { ...all, activeLocation: null };
    expect(stageLine(made, rest)).toContain("3 locations controlled, none is left, so the players win at the end of this round");
  });

  it("the dial counts the locations controlled over every Osgiliath location in play, and a tap opens the stage", () => {
    const [dial] = scenarioDials(state, made.ctx, nameOf(made));
    expect(dial).toMatchObject({ label: "Controlled", word: "1/4", value: 1, limit: 4, goal: true, cardId: idOf(state, retake) });
    expect(dial?.name).toBe("Osgiliath locations: 1 controlled, 3 still in the staging area or active. The players win at the end of the round when none is left");
  });

  it("the quest shows Siege while West Quarter is the active location and Surge on Ruined Square and Counter-attack", () => {
    const synced = drive(made, opened(made), () => true).state;
    expect(cardKeywords(synced, made.ctx, idOf(synced, retake)).map((chip) => chip.word)).toContain("Siege");
    const more = table({ staging: [square, counter] });
    expect(cardKeywords(more.state, more.ctx, idOf(more.state, square)).map((chip) => chip.word)).toContain("Surge");
    expect(cardKeywords(more.state, more.ctx, idOf(more.state, counter)).map((chip) => chip.word)).toContain("Surge");
  });
});

describe("Ruined Tower, Pinned Down and Southron Commander (06103:A:1, 06104:A:1, 06095:A:1)", () => {
  const made = table({ staging: [tower, pinned, commander, harbor, library], active: westQuarter });
  const state = controlling(made, made.state, [harbor, library]);

  it("Ruined Tower says it is a second active location with 1 active, and how many are active otherwise", () => {
    expect(detail(made, state, tower)).toBe("Travel here by exhausting a character: it becomes a second active location, and the first player divides progress between the two. 1 location is active now.");
    const none = table({ staging: [tower] });
    expect(detail(none, none.state, tower)).toBe("Travel here needs exactly 1 active location. 0 locations are active now.");
  });

  it("Pinned Down says X is the locations controlled now and its surge, and loses the surge at 4", () => {
    expect(detail(made, state, pinned)).toBe("X is the number of locations the players control: 2 now. It adds X to this round's archery total, and surge brings another card while fewer than 4 are controlled.");
    const four = table({ staging: [pinned, harbor, library, tower, square] });
    const all = controlling(four, four.state, [harbor, library, tower, square]);
    expect(detail(four, all, pinned)).toBe("X is the number of locations the players control: 4 now. It adds X to this round's archery total.");
  });

  it("Southron Commander names the players it attacks when revealed", () => {
    expect(detail(made, state, commander)).toBe("When revealed it attacks each player who controls a location, first player first. Now it attacks you.");
    expect(detail(made, made.state, commander)).toBe("When revealed it attacks each player who controls a location, first player first. No player controls one now, so it attacks no one.");
  });
});

describe("the attack sheet, the readout and the turn reference (06096:A:2, 06097:A:2, 06098:A:3, 06099:A:3)", () => {
  const made = table({ phase: "Encounter", engaged: [{ code: EVIL_CROW, seat: 0 }], staging: [library, harbor, westQuarter], deck: ["f0", "f0"], heroes: [{ code: BOROMIR, seat: 0 }] }, undefined, [BOROMIR, EVIL_CROW]);
  const held = controlling(made, made.state, [library, harbor, westQuarter]);

  it("the sheet says a hero still takes the damage and which of the defending player's locations return, never the one with no such line", () => {
    const run = atDefense(made, held);
    expect(run.state.window?.kind).toBe("defense");
    const sheet = defenseSheet(run.state, made.ctx, legalIntents(run.state, made.ctx), namesOf(made, run.state)) as PickSheet;
    expect(sheet.note).toContain("Undefended: a hero takes all of it. The King's Library and Ancient Harbor, which you control, return to the staging area afterwards with their progress removed.");
    expect(sheet.note).not.toContain("West Quarter");
  });

  it("the readout of the undefended attack says the same, and says nothing with no such location controlled", () => {
    const run = atDefense(made, held);
    const state = { ...run.state, pendingAttack: { ...run.state.pendingAttack!, undefended: true, heroId: made.hero } };
    expect(readoutFor(state, made.ctx, null, null, idName(made, state))?.result).toMatch(/; The King's Library and Ancient Harbor return to the staging area if nothing changes$/);
    const bare = atDefense(made, controlling(made, made.state, [westQuarter]));
    const plain = { ...bare.state, pendingAttack: { ...bare.state.pendingAttack!, undefended: true, heroId: made.hero } };
    expect(readoutFor(plain, made.ctx, null, null, idName(made, plain))?.result).not.toMatch(/return/);
  });

  it("the readout of an attack that no defender or hero answers yet says which locations return too", () => {
    const run = atDefense(made, held);
    expect(readoutFor(run.state, made.ctx, null, null, idName(made, run.state))?.result).toMatch(/^Undefended, a hero takes \d+; The King's Library and Ancient Harbor return to the staging area if nothing changes$/);
    const bare = atDefense(made, controlling(made, made.state, [westQuarter]));
    expect(readoutFor(bare.state, made.ctx, null, null, idName(made, bare.state))?.result).toMatch(/^Undefended, a hero takes \d+$/);
  });

  it("the turn reference's 6.E step says the locations return, and is the ordinary step in another scenario", () => {
    const decision = (state: ScenarioState) => turnReference(state, () => null).flatMap((phase) => phase.steps).find((step) => step.id === "6.E")?.decision;
    expect(decision(held)).toBe("Each enemy attacks: declare one defender, or leave it undefended on a hero: West Gate, The King's Library, Ancient Harbor and The Old Bridge return to the staging area if you control them.");
    expect(decision({ ...held, scenarioId: "the-stewards-fear" })).toBe("Each enemy attacks: declare one defender, or take it undefended on a hero.");
  });

  it("the banner and the log tell the control lost by the real undefended attack, with its progress removed", () => {
    const loaded = updateCard(held, idOf(held, library), { progress: 2 });
    const run = atDefense(made, loaded);
    // The undefended attack is answered, the Forced effects of the locations resolve, and the game goes on to the next window with no control left of those two.
    const after = drive(made, send(run, { type: "Undefended", heroId: made.hero }, made.ctx), (state) => state.cards[idOf(state, library)]?.zone === "staging" && state.cards[idOf(state, harbor)]?.zone === "staging");
    const lines = momentOf(loaded, after.state, after.steps, { card: idName(made, after.state) })?.lines.map((line) => line.text) ?? [];
    expect(lines).toContain("The King's Library: You lose control, back in the staging area, 2 progress tokens removed");
    expect(lines).toContain("Ancient Harbor: You lose control, back in the staging area");
    expect(lines.join(" ")).not.toContain("West Quarter");
    const log = logLines(nextRoundSteps([], run.state, after.state, after.steps, made.ctx), logNames(made, after.state)).map((line) => line.text);
    expect(log).toContain("The King's Library: You lose control, back in the staging area, 2 progress tokens removed");
  });
});

describe("control taken by an explored location (06091:B:2)", () => {
  it("the banner and the log say it is explored and taken, never destroyed, and another scenario says neither", () => {
    const made = table({ phase: "Quest", active: { code: westQuarter, progress: 1 }, committed: ["dh1", "dh2"] });
    const run = quested(made);
    const lines = momentOf(made.state, run.state, run.steps, { card: idName(made, run.state) })?.lines.map((line) => line.text) ?? [];
    expect(lines).toContain("West Quarter is explored");
    expect(lines).toContain("West Quarter: You take control");
    const log = logLines(nextRoundSteps([], made.state, run.state, run.steps, made.ctx), logNames(made, run.state)).map((line) => line.text);
    expect(log).toContain("West Quarter is explored");
    expect(log).toContain("West Quarter: You take control");
    expect(log.join(" ")).not.toContain("destroyed");
    const other = { ...run.state, scenarioId: "the-stewards-fear" };
    const plain = logLines(nextRoundSteps([], { ...made.state, scenarioId: "the-stewards-fear" }, other, run.steps, made.ctx), logNames(made, other)).map((line) => line.text);
    expect(plain.some((line) => /control/.test(line))).toBe(false);
  });
});

describe("the banner of an intent that takes control of several locations (06091:B:2)", () => {
  it("never cuts a control line: the quest's own lines give way and the banner says how many it left out", () => {
    const made = table({ phase: "Quest", active: { code: westQuarter, progress: 3 }, committed: ["dh1", "dh2"], staging: [harbor, library, CODES.bridge] });
    const run = quested(made);
    // Three more locations taken in the same intent (Street Fighting's, an Action): four control lines with the quest's own lines are over the banner's five.
    const state = controlling(made, run.state, [harbor, library, CODES.bridge]);
    const banner = momentOf(made.state, state, run.steps, { card: idName(made, state) });
    const lines = banner?.lines.map((line) => line.text) ?? [];
    for (const name of ["West Quarter", "Ancient Harbor", "The King's Library", "The Old Bridge"]) expect(lines, name).toContain(`${name}: You take control`);
    expect(lines.filter((line) => /take control/.test(line))).toHaveLength(4);
    expect(lines.at(-1)).toMatch(/^And \d+ more in the log$/);
    expect(lines.length).toBeLessThanOrEqual(6);
  });
});

describe("the words of the control records and the choice sheets (06093:A:1, 06105:A:1, 06106:A:2)", () => {
  const made = table({ staging: [harbor] });
  const words = (verb: Parameters<typeof instructionWords>[0]) => instructionWords(verb, made.state, { card: idName(made, made.state), code: nameOf(made), line: () => null } as never, null);

  it("the verbs that take and lose control are said as taking control and returning to the staging area", () => {
    expect(words({ verb: "TakeControlOfLocation" })).toBe("the first player takes control of the explored location: it lies in that player's play area with no progress");
    expect(words({ verb: "TakeControlOfLocation", card: "previous" })).toBe("the first player takes control of the discarded location: it lies in that player's play area with no progress");
    expect(words({ verb: "LoseControlOfLocation", card: "picked" })).toBe("return the location you chose to the staging area, with its progress removed");
    expect(words({ verb: "LoseControlOfLocation", card: "self" })).toBe("return this card to the staging area, with its progress removed");
  });

  it("Counter-attack's choice and its location pick name the player's own branches", () => {
    const scene = table({ staging: [harbor, library], deck: ["f0"], heroes: [{ code: BOROMIR, seat: 0 }] }, undefined, [BOROMIR]);
    const state = controlling(scene, scene.state, [harbor, library]);
    const revealed = revealFromTop(state, scene.ctx, counter, []).state;
    expect(revealed.window?.kind).toBe("choose");
    const choose = sheetFor(revealed, scene.ctx, legalIntents(revealed, scene.ctx), namesOf(scene, revealed)) as PickSheet;
    expect(choose.note).toBe("Counter-attack: return your highest-Threat location to the staging area, or raise your threat by the Threat of all your locations.");
    expect(choose.options.map((option) => option.label)).toEqual(["Return your highest-Threat location to the staging area", "Raise your threat by the total Threat of your locations"]);
  });

  it("Street Fighting's choice says what each branch does to the location the discard stopped at", () => {
    const scene = table({ staging: [], deck: [square, "f0"], heroes: [{ code: BOROMIR, seat: 0 }] }, undefined, [BOROMIR]);
    const revealed = revealFromTop(scene.state, scene.ctx, CODES.street, []).state;
    expect(revealed.window?.kind).toBe("choose");
    const choose = sheetFor(revealed, scene.ctx, legalIntents(revealed, scene.ctx), namesOf(scene, revealed)) as PickSheet;
    expect(choose.note).toBe("Street Fighting: the discarded Osgiliath location is the last card discarded. Exhaust a hero to take control of it, or add it to the staging area.");
    expect(choose.options.map((option) => option.label)).toEqual(["Exhaust a hero: you control the discarded location, with no progress", "Do not exhaust: add the discarded location to the staging area"]);
  });
});
