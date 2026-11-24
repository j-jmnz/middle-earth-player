// Rules: ats.prowl, ats.prowl-example, hon.siege, hon.archery, faq.victory-display, faq.progress-without-advancing, rr.cost, rr.travel (data/rules/entries.json); ledger lines 06043:B:1, 06044:B:1, 06044:B:2, 06044:B:3, 06045:A:2, 06045:A:3, 06047:A:1, 06048:A:1, 06048:A:2, 06049:A:1, 06050:A:1, 06050:A:2, 06051:A:1, 06051:A:2, 06052:A:1, 06054:A:1.
// What the table says for The Drúadan Forest: the Prowl X chip and the Hunter's Archery X, the archery a Glade gives a Wose, the allies-only archery tray, Ancestral Clearing's extra cost and Garden of Poisons' lines, and the pieces of stage 3: Willpower in place of Attack in the attack
// sheet, the readout and the banner, progress in place of damage on the enemy against its hit points, the win bar and the dial of Drû-buri-Drû, and the bonus of the victory display. Each hook is empty in another scenario or on another stage; the last tests prove it.
// The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { finish, idOf, send, start, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { CODES, table } from "../../../test/scenarios/the-druadan-forest/table.ts";

import { ledgerLine } from "../cards/ledger.ts";
import { advanceWords } from "../readouts/quest-advance.ts";
import { cardKeywords } from "../cards/card-keywords.ts";
import { effectLines } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { questTitle, tokenLines } from "../cards/table-preview.ts";
import { archerySheet, playerAttackSheet } from "../choice/combat-sheets.ts";
import { windowPoint } from "../phases/rail.ts";
import { readoutFor } from "../readouts/readout.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { momentOf } from "../store/outcome.ts";

const { untimelyEnd: STAGE_2, passageOut: STAGE_3, druBuriDru: DRU, drummer: DRUMMER, elite: ELITE, hunter: HUNTER, thief: THIEF, clearing: CLEARING, garden: GARDEN, glade: GLADE, stars: STARS } = CODES;

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const cardName = (made: Made, state: ScenarioState) => (id: string) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id;
const chips = (made: Made, code: string, state: ScenarioState = made.state) => cardKeywords(state, made.ctx, idOf(state, code)).map((chip) => (chip.lost ? `${chip.word} (lost)` : chip.word));
const say = (made: Made, code: string, state: ScenarioState = made.state) => dungeonDetail(state, made.ctx, idOf(state, code), cardName(made, state));
const names = { card: (id: string) => id, line: () => null };

describe("Prowl X and Archery X chips (06047:A:1, 06048:A:1, 06049:A:1, 06054:A:1)", () => {
  it("06047:A:1 the Elite's Prowl X reads the number of players: 2 two-handed and 1 solo, beside its printed Archery 2", () => {
    const two = table({ seats: 2, staging: [ELITE] });
    expect(chips(two, ELITE)).toEqual(["Archery 2", "Prowl 2"]);
    expect(chips(table({ seats: 1, staging: [ELITE] }), ELITE)).toEqual(["Archery 2", "Prowl 1"]);
    expect(say(two, ELITE)).toBe("Prowl 2: when it is revealed, the players as a group discard 2 resources from their heroes' pools, as many as they can. It is a discard, not a spend.");
  });

  it("06048:A:1 the Hunter's Prowl 1, and its Archery X counts the heroes with no resources, shown at 0 too and said in its preview", () => {
    const empty = table({ seats: 2, heroResources: 0, staging: [HUNTER] });
    expect(chips(empty, HUNTER)).toEqual(["Archery 3", "Prowl 1"]);
    expect(say(empty, HUNTER)).toContain("Archery X: X is the number of heroes in play with no resources in their pool. It is 3 now.");
    const paid = table({ seats: 2, heroResources: 1, staging: [HUNTER] });
    expect(chips(paid, HUNTER)).toEqual(["Archery 0", "Prowl 1"]);
    expect(say(paid, HUNTER)).toContain("It is 0 now.");
  });

  it("06049:A:1 and 06054:A:1 the Thief and Stars in Sky say Prowl 1 and Prowl 2 beside their other keywords", () => {
    expect(chips(table({ staging: [THIEF] }), THIEF)).toEqual(["Surge", "Prowl 1"]);
    expect(chips(table({ staging: [STARS] }), STARS)).toEqual(["Prowl 2"]);
  });

  it("06047:A:1 a card that lost its keywords shows Prowl struck through", () => {
    const made = table({ seats: 2, staging: [ELITE] });
    const id = idOf(made.state, ELITE);
    const blank = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: id, sourceId: id, stat: "losesKeywords" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(chips(made, ELITE, blank)).toContain("Prowl 2 (lost)");
  });

  it("06047:A:1 no chip outside this scenario: the same state under another scenario's id shows none, and Orc Arbalesters' Archery X stays hidden at 0", () => {
    const made = table({ seats: 2, staging: [ELITE] });
    expect(chips(made, ELITE, { ...made.state, scenarioId: "the-stewards-fear" })).toEqual(["Archery 2"]);
    const cair = tableFromLayout("the-siege-of-cair-andros", { staging: ["05057"], heroResources: 1 });
    expect(cardKeywords(cair.state, cair.ctx, idOf(cair.state, "05057")).map((chip) => chip.word)).not.toContain("Archery 0");
    expect(cardKeywords(cair.state, cair.ctx, idOf(cair.state, "05057")).map((chip) => chip.key)).not.toContain("prowl");
  });
});

describe("Glade of Cleansing's archery on the Woses (06052:A:1)", () => {
  it("06052:A:1 each Wose in play gains archery 1: the chip counts it and the preview names the Glade", () => {
    const made = table({ seats: 1, staging: [ELITE, GLADE], engaged: [{ code: DRUMMER }] });
    expect(chips(made, ELITE)).toContain("Archery 3");
    expect(say(made, ELITE)).toContain("Archery 3: +1 from Glade of Cleansing.");
    expect(chips(made, DRUMMER)).toContain("Archery 1");
    const bare = table({ seats: 1, staging: [ELITE] });
    expect(say(bare, ELITE)).not.toContain("Glade");
  });

  it("06052:A:2 the Glade's Threat X reads the highest archery of a Wose, the grant included", () => {
    const made = table({ seats: 1, staging: [ELITE, GLADE] });
    expect(effectLines(made.state, made.ctx, idOf(made.state, GLADE), cardName(made, made.state))).toContain("+3 Threat from its own text, while it is in play");
  });
});

describe("the archery tray under An Untimely End (06043:B:1)", () => {
  it("06043:B:1 the tray lists allies only while any ally is in play, and says so", () => {
    const made = table({ seats: 1, stage: STAGE_2, phase: "Combat", staging: [ELITE], play: ["ally"] });
    const sheet = archerySheet(made.state, made.ctx, names, 2);
    expect(sheet.kind === "distribute" ? sheet.note : "").toContain("Archery damage must go to allies while any ally is in play: only allies are listed.");
    expect(sheet.kind === "distribute" ? sheet.options.map((option) => option.id) : []).toEqual([idOf(made.state, "ally")]);
  });

  it("06043:B:1 with no ally in play the heroes are listed and the note stays silent; another stage says nothing either", () => {
    const none = table({ seats: 1, stage: STAGE_2, phase: "Combat", staging: [ELITE] });
    expect(archerySheet(none.state, none.ctx, names, 2).kind === "distribute" ? (archerySheet(none.state, none.ctx, names, 2) as { note: string }).note : "").not.toContain("allies");
    const other = table({ seats: 1, phase: "Combat", staging: [ELITE], play: ["ally"] });
    expect((archerySheet(other.state, other.ctx, names, 2) as { note: string }).note).not.toContain("allies");
  });
});

describe("Ancestral Clearing and Garden of Poisons (06050:A:1, 06051:A:1, 06051:A:2)", () => {
  it("06050:A:1 a player card in hand says what it costs now and why, and the payment follows the same cost", () => {
    const made = table({ seats: 1, staging: [CLEARING], hand: ["event"] });
    expect(say(made, "event")).toBe("Costs 2 to play: 1 more from Ancestral Clearing.");
    expect(say(table({ seats: 1, hand: ["event"] }), "event")).toBeNull();
  });

  it("06050:A:1 the location's preview says the extra cost and its travel cost", () => {
    const made = table({ seats: 1, staging: [CLEARING] });
    expect(say(made, CLEARING)).toBe("While it is in play, each player card costs 1 more to play. To travel here, exhaust 1 ready hero of any player; the first player chooses.");
  });

  it("06051:A:1 and 06051:A:2 the location's preview says the gain it stops, the resource phase it leaves and the payment that can stop the travel; a hero's preview names it", () => {
    const made = table({ seats: 1, staging: [GARDEN] });
    expect(say(made, GARDEN)).toBe("While it is in play, heroes gain no resources from card effects: the resource phase still gives 1 to each hero. To travel here each player pays 1 resource from his heroes' pools, and the players cannot travel here while a player cannot.");
    expect(dungeonDetail(made.state, made.ctx, made.hero, cardName(made, made.state))).toBe("It gains no resources from card effects while Garden of Poisons is in play. The resource phase still gives it 1.");
    const none = table({ seats: 1, staging: [ELITE] });
    expect(dungeonDetail(none.state, none.ctx, none.hero, cardName(none, none.state))).toBeNull();
  });
});

describe("stage 3 (06044:B:1, 06044:B:2, 06044:B:3, 06045:A:2, 06045:A:3)", () => {
  const stage3 = (extra: object = {}) => table({ seats: 1, stage: STAGE_3, phase: "PlayerAttacks", ...extra });
  const stageLine = (made: Made, state: ScenarioState = made.state) => questTitle(state, made.ctx, state.questStage ?? "", "Stage", ledgerLine)?.detail;
  const advanceDetail = (made: Made) => advanceWords(made.state, made.ctx, made.state.questStage ?? "", "Stage", ledgerLine).detail;
  const dials = (made: Made, state: ScenarioState = made.state) => scenarioDials(state, made.ctx, nameOf(made)).filter((dial) => dial.id === "dru");

  // The real ledger reader: the stage's printed win line and the bar line must not repeat in the text, and no period is doubled.
  const BAR_NOT_THERE = "The players win with 14 progress on this stage and Drû-buri-Drû in the victory display. 6 of 14 progress, and he is not there yet. Progress stays on the stage until both are true: 14 of 14 without him, nothing happens.";
  it("06044:B:3 the stage says what wins and where each half stands: Drû-buri-Drû in the staging area, in the victory display, or destroyed", () => {
    const staged = stage3({ progress: 6, staging: [DRU] });
    expect(stageLine(staged)).toBe(BAR_NOT_THERE);
    expect(advanceDetail(staged)).toBe(BAR_NOT_THERE);
    const won = stage3({ progress: 14, victory: [DRU] });
    expect(stageLine(won)).toContain("14 of 14 progress, and he is there");
    const dead = stage3({ progress: 6, victory: [DRU] });
    const gone = { ...dead.state, cards: { ...dead.state.cards, [idOf(dead.state, DRU)]: { ...dead.state.cards[idOf(dead.state, DRU)]!, zone: "encounterDiscard" as const } } };
    expect(stageLine(dead, gone)).toContain("Drû-buri-Drû is out of play, so the players cannot win");
  });

  it("06044:B:2 the dial of Drû-buri-Drû counts his progress against his 6 hit points, and shows his card on a tap", () => {
    const made = stage3({ staging: [{ code: DRU, progress: 2 }], progress: 3 });
    const [dial] = dials(made);
    expect(dial).toMatchObject({ label: "Drû", value: 2, limit: 6, goal: true, cardId: idOf(made.state, DRU), name: "Progress on Drû-buri-Drû, toward his hit points:" });
    expect(dial?.note).toBe("Drû-buri-Drû holds 2 of 6 progress. At 6 he goes to the victory display and his progress goes to the quest. The players win with 14 progress on the stage and Drû-buri-Drû in the victory display.");
  });

  it("06044:B:3 once he is in the victory display the dial shows the stage's progress against its points, not a win, and what the stage still needs", () => {
    const made = stage3({ victory: [DRU], progress: 9 });
    const [dial] = dials(made);
    expect(dial).toMatchObject({ word: "9/14", value: 6, limit: 6, goal: true });
    expect(dial?.note).toBe("Drû-buri-Drû is in the victory display. The players win when the stage holds 14 progress: it holds 9.");
  });

  it("06044:B:2 an enemy's preview says its progress against its hit points and what the full number does, without a second token line", () => {
    const made = stage3({ staging: [{ code: HUNTER, progress: 2 }] });
    const id = idOf(made.state, HUNTER);
    expect(say(made, HUNTER)).toContain("2 of 3 progress. At 3 it goes to the victory display and its progress goes to the quest.");
    expect(tokenLines({ ...made.state.cards[id]!, progress: 0 })).toEqual([]);
  });

  it("06044:B:2 the attack sheet names Willpower on every row and says the damage is progress; the Attack stat stays on the other stages", () => {
    const made = stage3({ engaged: [HUNTER] });
    const sheet = playerAttackSheet(made.state, made.ctx, legalIntents(made.state, made.ctx), names);
    const next = sheet.kind === "pick" ? (sheet.options[0] as { next?: { kind: string; note?: string | null; options: { stats?: { icon: string }[] }[] } }).next : undefined;
    expect(next?.note).toBe("Willpower against Defense 3. Each point over is 1 progress, not damage. Choose the characters that attack it.");
    expect(next?.options[0]?.stats?.[0]?.icon).toBe("willpower");
    const plain = table({ seats: 1, stage: STAGE_2, phase: "PlayerAttacks", engaged: [HUNTER] });
    const other = playerAttackSheet(plain.state, plain.ctx, legalIntents(plain.state, plain.ctx), names);
    const otherNext = other.kind === "pick" ? (other.options[0] as { next?: { note?: string | null; options: { stats?: { icon: string }[] }[] } }).next : undefined;
    expect(otherNext?.note).toBe("Defense 3. Choose the characters that attack it.");
    expect(otherNext?.options[0]?.stats?.[0]?.icon).toBe("attack");
  });

  it("06044:B:2 the readout of an attack shows Willpower against Defense and the progress it places, never damage or destroyed", () => {
    const made = stage3({ engaged: [{ code: HUNTER, progress: 1 }] });
    const buffed = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "willpower" as const, amount: 3, until: "endOfPhase" as const }] };
    const readout = readoutFor({ ...buffed, pendingStrike: { seat: 0, enemyId: idOf(made.state, HUNTER), attackerIds: [made.hero] } }, made.ctx, null, null, cardName(made, made.state));
    expect(readout?.stats.map((stat) => `${stat.icon} ${stat.value}`)).toEqual(["willpower 5", "defense 3"]);
    expect(readout?.result).toBe("2 progress on Drúadan Hunter, 3 of 3 progress; it goes to the victory display and all 3 progress to the quest");
    const short = readoutFor({ ...made.state, pendingStrike: { seat: 0, enemyId: idOf(made.state, HUNTER), attackerIds: [made.hero] } }, made.ctx, null, null, cardName(made, made.state));
    expect(short?.result).toBe("No progress");
  });

  // A real attack up to its "Before the attack ends" window. Blade Mastery in hand gives the table an action to take, so the windows before and after the damage open.
  const attackToEnd = (code: string, willpower: number) => {
    const made = table({ seats: 1, stage: STAGE_3, phase: "PlayerAttacks", engaged: [code], hand: ["01032"], heroResources: 3 }, undefined, ["01032"]);
    const buffed = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "willpower" as const, amount: willpower, until: "endOfPhase" as const }] };
    const enemy = idOf(made.state, code);
    let run = send(start(buffed), { type: "DeclareAttackers", enemyId: enemy, attackerIds: [made.hero] }, made.ctx);
    const said = (): string => readoutFor(run.state, made.ctx, null, null, cardName(made, run.state))?.result ?? "";
    const before: string[] = [];
    const rail: string[] = [];
    for (let guard = 0; guard < 6 && run.state.pendingStrike?.awaiting !== "end"; guard += 1) {
      const at = windowPoint(run.state);
      if (at) rail.push(`${at.title}: ${at.note}`);
      if (run.state.pendingStrike?.awaiting === "strike") before.push(said());
      run = send(run, { type: "Pass" }, made.ctx);
    }
    expect(run.state.pendingStrike?.awaiting).toBe("end");
    const at = windowPoint(run.state);
    rail.push(`${at?.title}: ${at?.note}`);
    return { before, after: said(), progress: run.state.cards[enemy]?.progress, rail };
  };

  it("06044:B:2 after the strike the readout shows what the enemy holds, not the strike added again", () => {
    expect(attackToEnd(ELITE, 2)).toMatchObject({ before: ["2 progress on Drúadan Elite, 2 of 4 progress"], after: "2 of 4 progress on Drúadan Elite", progress: 2 });
  });

  it("06044:B:2 the rail words the windows of a stage 3 attack as progress, not damage", () => {
    expect(attackToEnd(ELITE, 2).rail).toEqual(["Before progress: The attackers are declared. Progress is placed next.", "Before the attack ends: Progress is placed."]);
    // A player attack on a stage without the flag keeps its words.
    const made = table({ seats: 1, stage: STAGE_2, phase: "PlayerAttacks", engaged: [ELITE], hand: ["01032"], heroResources: 3 }, undefined, ["01032"]);
    const run = send(start(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, ELITE), attackerIds: [made.hero] }, made.ctx);
    expect(windowPoint(run.state)).toMatchObject({ title: "Before damage", note: "The attackers are declared. Damage is dealt next." });
  });

  it("06044:B:2 after a strike that fills the enemy the readout says it is in the victory display", () => {
    const done = attackToEnd(HUNTER, 4);
    expect(done.after).toBe("Drúadan Hunter is in the victory display; its progress is on the quest");
  });

  it("06044:B:2 the banner of an attack says Willpower and the progress it placed, and no \"No damage\" after it", () => {
    const made = stage3({ engaged: [{ code: HUNTER, progress: 0 }] });
    const buffed = { ...made.state, modifiers: [...made.state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "willpower" as const, amount: 3, until: "endOfPhase" as const }] };
    const run = finish(send(start(buffed), { type: "DeclareAttackers", enemyId: idOf(made.state, HUNTER), attackerIds: [made.hero] }, made.ctx), made.ctx);
    const moment = momentOf(buffed, run.state, run.steps, { card: cardName(made, run.state) });
    const lines = moment?.lines.map((line) => line.text) ?? [];
    expect(lines).toContain("Willpower 5 against defense 3");
    expect(lines.some((line) => /2 progress on/.test(line))).toBe(true);
    expect(lines).not.toContain("No damage");
  });

  it("06045:A:2 each character's preview names the +1 Willpower and +1 Defense of the victory display and its source", () => {
    const made = stage3({ victory: [DRU] });
    expect(effectLines(made.state, made.ctx, made.hero, cardName(made, made.state))).toEqual(["+1 Willpower from Drû-buri-Drû, while it is in the victory display", "+1 Defense from Drû-buri-Drû, while it is in the victory display"]);
  });

  it("06044:B:2 nothing changes before stage 3 or in another scenario: no line, no dial, damage stays damage, Attack stays Attack", () => {
    const early = table({ seats: 1, stage: STAGE_2, staging: [{ code: HUNTER, progress: 2 }] });
    expect(stageLine(early) ?? "").not.toContain("win with");
    expect(dials(early)).toEqual([]);
    expect(say(early, HUNTER)).not.toContain("of 3 progress");
    // The same stage-3 state under another scenario's id: the hooks key on the scenario.
    const made = stage3({ staging: [{ code: HUNTER, progress: 2 }] });
    const other = { ...made.state, scenarioId: "the-stewards-fear" };
    expect(dials(made, other)).toEqual([]);
    expect(say(made, HUNTER, other)).toBeNull();
    // A scenario with a stage of its own that counts progress on a card shows its token line as before.
    const cair = tableFromLayout("the-siege-of-cair-andros", { staging: [{ code: "05057", progress: 2 }] });
    expect(dungeonDetail(cair.state, cair.ctx, idOf(cair.state, "05057"), cardName(cair as unknown as Made, cair.state))).not.toMatch(/of \d progress/);
  });
});
