// Rules: ats.villagers, ats.villager-tokens-discarded, rr.cannot, rr.winning-the-game, rr.response (data/rules/entries.json); ledger lines 06066:B:1, 06066:B:2, 06066:B:3, 06067:B:1, 06067:B:2, 06068:A:2, 06069:A:1, 06069:A:2, 06070:A:1, 06070:A:3, 06071:A:1, 06071:A:3, 06075:A:1, 06076:A:1, 06077:A:1.
// What the table says for Encounter at Amon Dîn: the villager tokens as villager tokens (never resources), the Villagers X chip, the two dials that compare Rescued Villagers with Dead Villagers, stage 1B's moves, stage 2B's undefended attack and its held end,
// Lord Alcaron's and Ghulat's lines, and the dock's warning before Lord Alcaron leaves play. Each moment is a real one from the engine. Each hook keys on the scenario, so the last tests build a card of another scenario that holds resource tokens.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { idOf, send, start, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { CODES, quested, runSettled, table, undefendedAtRescued, withVillagers } from "../../../test/scenarios/encounter-at-amon-din/table.ts";

import { cardKeywords } from "../cards/card-keywords.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { previewCards, questTitle } from "../cards/table-preview.ts";
import { defenseSheet } from "../choice/combat-sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { instructionWords } from "../words/instruction.ts";
import { readoutFor } from "../readouts/readout.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { discardLoss, damageOutcome, lossWords, outcomeWords } from "../store/foresight.ts";
import { momentOf } from "../store/outcome.ts";
import { pictureCode } from "../canvas/picture-key.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { cardSpeech, type CardSpeechDeps } from "../words/card-speech.ts";

const { savagery, protect, rescued, dead, alcaron, ghulat, marauding, farmhouse, hamlet, secluded } = CODES;

type Made = ReturnType<typeof table>;
const nameOf = (made: Made) => (code: string) => made.cards.get(code)?.name ?? code;
const idName = (made: Made, state: ScenarioState) => (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
const describe_ = (made: Made) => (code: string) => ({ name: nameOf(made)(code), text: "", source: null }) as never;
const preview = (made: Made, state: ScenarioState, code: string) => previewCards(state, made.ctx, idOf(state, code), describe_(made), idName(made, state)).cards[0];
const chips = (made: Made, state: ScenarioState, code: string) => cardKeywords(state, made.ctx, idOf(state, code)).map((chip) => chip.word);
const say = (made: Made, state: ScenarioState, code: string) => dungeonDetail(state, made.ctx, idOf(state, code), idName(made, state));
const dialsOf = (made: Made, state: ScenarioState) => scenarioDials(state, made.ctx, nameOf(made));
const stageLine = (made: Made, state: ScenarioState) => questTitle(state, made.ctx, state.questStage ?? "", "Stage", () => null)?.detail ?? "";
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
// The quest after the two heroes committed (4 Willpower), at the step the quest total is shown: the staging area has been revealed and the players may still act.
const resolving = (made: Made, state: ScenarioState): ScenarioState => ({ ...send(start(state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx).state, mode: "resolution" });
const namesOf = (made: Made, state: ScenarioState): SheetNames => ({ card: idName(made, state), line: () => null });

describe("villager tokens are never resources (06066:B:1, 06075:A:1, 06076:A:1, 06077:A:1, ats.villagers)", () => {
  const made = table({ staging: [{ code: rescued, resources: 4 }, dead, { code: hamlet, resources: 3 }], active: { code: farmhouse, resources: 1 } });
  const state = withVillagers(made.state, savagery, 5);

  it("a location, the quest card and Rescued Villagers say villager tokens in the preview and in the spoken label, one counter for each", () => {
    expect(preview(made, state, hamlet)?.tokens).toEqual(["3 villager tokens"]);
    expect(preview(made, state, farmhouse)?.tokens).toEqual(["1 villager token"]);
    expect(preview(made, state, rescued)?.tokens).toEqual(["4 villager tokens"]);
    expect(preview(made, state, savagery)?.tokens).toEqual(["5 villager tokens"]);
    expect(cardSpeech(state, 0, idOf(state, hamlet), speechDeps(made)).label).toContain("3 villager tokens");
    expect(cardSpeech(state, 0, idOf(state, hamlet), speechDeps(made)).label).not.toMatch(/resource/);
  });

  it("a hero's resources are still resources, and the tokens of another scenario's stage still say resources", () => {
    const hero = updateCard(state, made.hero, { resources: 2 });
    expect(preview(made, hero, "dh1")?.tokens).toEqual(["2 resources"]);
    const fear = tableFromLayout("the-stewards-fear", { stage: "06011", staging: [] });
    const tokens = updateCard(fear.state, idOf(fear.state, "06011"), { resources: 2 });
    const stage = previewCards(tokens, fear.ctx, idOf(tokens, "06011"), (code) => ({ name: code, text: "", source: null }) as never, () => "").cards[0];
    expect(stage?.tokens).toEqual(["2 resources"]);
    // The same card of this scenario on a game of another scenario says resources.
    expect(previewCards({ ...state, scenarioId: "the-stewards-fear" }, made.ctx, idOf(state, hamlet), describe_(made), idName(made, state)).cards[0]?.tokens).toEqual(["3 resources"]);
  });

  it("the words of a record say villager tokens: Villagers X and the Setup place them, and the verbs discard and move them", () => {
    const place = { verb: "PlaceResourceTokens", amount: 4, on: "self" } as const;
    const words = (verb: Parameters<typeof instructionWords>[0], game: ScenarioState = state) => instructionWords(verb, game, { card: idName(made, game), code: nameOf(made), line: () => null } as never, null);
    expect(words(place)).toBe("place 4 villager tokens on this card");
    expect(words({ verb: "PlaceResourceTokens", amount: 4, on: "activeLocation" })).toBe("place 4 villager tokens on the active location");
    expect(words({ verb: "PlaceResourceTokens", amount: 1, on: "picked" })).toBe("place 1 villager token on the card you chose");
    expect(words({ verb: "DiscardVillagerTokens", from: "self", amount: 1 })).toBe("discard 1 villager token from this card");
    expect(words({ verb: "MoveVillagerTokens", from: "self", to: { code: "06068" }, amount: 2 })).toBe("move 2 villager tokens from this card to Rescued Villagers");
    expect(words({ verb: "PickFewestHitPointsLeft" })).toBe("choose the character with the fewest remaining hit points");
    // Another scenario's PlaceResourceTokens keeps its word.
    expect(words(place, { ...state, scenarioId: "the-stewards-fear" })).toBe("place 4 resources on this card");
  });
});

describe("Villagers X (06066:B:1, 06075:A:1, 06076:A:1, 06077:A:1)", () => {
  it("each location that prints it, and stage 1B, wears a Villagers chip with the value its own record places; no other card does", () => {
    const made = table({ staging: [{ code: hamlet, resources: 3 }, { code: secluded, resources: 2 }, rescued, dead], active: { code: farmhouse, resources: 4 } });
    expect(chips(made, made.state, farmhouse)).toEqual(["Villagers 4"]);
    expect(chips(made, made.state, hamlet)).toEqual(["Villagers 3"]);
    expect(chips(made, made.state, secluded)).toContain("Villagers 2");
    expect(chips(made, made.state, savagery)).toEqual(["Villagers 5"]);
    expect(chips(made, made.state, rescued)).toEqual([]);
    // Another scenario's game shows no such chip on the same cards.
    const other = { ...made.state, scenarioId: "the-stewards-fear" };
    expect(chips(made, other, hamlet)).toEqual([]);
    expect(chips(made, other, savagery)).toEqual([]);
  });
});

describe("the comparison that decides the game (06068:A:2, 06069:A:2)", () => {
  const made = table({ stage: protect, staging: [{ code: rescued, resources: 4 }, { code: dead, damage: 3 }] });

  it("two dials in the top bar, Rescued and Dead, read the villager tokens and the damage tokens and open their cards", () => {
    const dials = dialsOf(made, made.state);
    expect(dials.map((dial) => [dial.label, dial.value, dial.icon ?? null, dial.cardId])).toEqual([["Rescued", 4, null, idOf(made.state, rescued)], ["Dead", 3, "damage", idOf(made.state, dead)]]);
    expect(dials[0]?.note).toBe("4 villager tokens on Rescued Villagers, against 3 damage tokens on Dead Villagers. The players win at the end of the game with more villager tokens than damage tokens. A tie loses.");
    expect(dials[1]?.note).toBe("3 damage tokens on Dead Villagers, against 4 villager tokens on Rescued Villagers. Each villager token discarded adds 1, and none comes off. The players lose at the end of the game with as many or more damage tokens than villager tokens. A tie loses.");
  });

  it("the two objectives' previews say the win line and the loss line with the other count, and a tie loses", () => {
    expect(say(made, made.state, rescued)).toBe("At the end of the game the players win with more villager tokens here than damage tokens on Dead Villagers (3 now). A tie loses.");
    expect(say(made, made.state, dead)).toBe("Each villager token discarded puts 1 damage token here, and none comes off. At the end of the game the players lose with as many or more damage tokens here than villager tokens on Rescued Villagers (4 now). A tie loses.");
    // The token line of Dead Villagers says damage tokens, never villager tokens.
    expect(preview(made, made.state, dead)?.tokens).toEqual(["3 damage"]);
  });

  it("no dial and no line in another scenario", () => {
    expect(dialsOf(made, { ...made.state, scenarioId: "the-stewards-fear" }).filter((dial) => dial.id === "rescued" || dial.id === "dead")).toEqual([]);
    expect(say(made, { ...made.state, scenarioId: "the-stewards-fear" }, rescued)).toBeNull();
  });
});

describe("stage 1B moves villager tokens (06066:B:2, 06066:B:3)", () => {
  const made = table({ staging: [rescued, dead] });
  const state = withVillagers(made.state, savagery, 5);

  it("a dial reads the villager tokens left on the quest card, and is gone once stage 2B is current", () => {
    const dial = dialsOf(made, state).find((one) => one.id === "quest-villagers");
    expect(dial).toMatchObject({ label: "Stage", value: 5, cardId: idOf(state, savagery), note: "5 villager tokens left on the quest card. Each point of progress moves 1 to Rescued Villagers, and the stage advances when the last one leaves." });
    const two = table({ stage: protect, staging: [rescued, dead] });
    expect(dialsOf(two, two.state).some((one) => one.id === "quest-villagers")).toBe(false);
  });

  it("the stage's preview says progress moves tokens to Rescued Villagers, the surplus is lost and the last token advances it", () => {
    expect(stageLine(made, state)).toBe("No quest points. Progress is not placed on this stage: each point moves 1 villager token from here to Rescued Villagers, and progress beyond the tokens it holds is lost. The stage advances when its last token leaves.");
  });

  it("the quest readout says tokens move, not progress, with the surplus lost and the stage advancing", () => {
    const readout = readoutFor(resolving(made, state), made.ctx, null, null, idName(made, state));
    expect(readout?.result).toBe("No progress is placed on the quest: 4 villager tokens move to Rescued Villagers if nothing changes");
    const few = withVillagers(resolving(made, state), savagery, 3);
    expect(readoutFor(few, made.ctx, null, null, idName(made, few))?.result).toBe("No progress is placed on the quest: 3 villager tokens move to Rescued Villagers; the last token leaves and the stage advances; the other 1 progress is lost if nothing changes");
  });

  it("the active location takes its share first and the readout says it", () => {
    const here = table({ staging: [rescued, dead], active: { code: farmhouse, progress: 3, resources: 2 } });
    const held = withVillagers(here.state, savagery, 5);
    expect(readoutFor(resolving(here, held), here.ctx, null, null, idName(here, held))?.result).toBe("2 progress on Burning Farmhouse; no progress is placed on the quest: 2 villager tokens move to Rescued Villagers if nothing changes");
  });

  it("the banner lists each card whose tokens changed, with no progress placed on the stage", () => {
    const run = quested(made, state);
    const moment = momentOf(state, run.state, run.steps, { card: idName(made, run.state) });
    expect(moment?.lines.map((line) => line.text)).toEqual(["Willpower 4 against threat 0", "Villager tokens", "Savagery of the Orcs: 5 → 1 villager token", "Rescued Villagers: 0 → 4 villager tokens"]);
    expect(moment?.lines.some((line) => /progress/.test(line.text) && !/Willpower/.test(line.text))).toBe(false);
  });
});

// The combat step where the enemy's attack waits for the defending player: the window is the defender pick.
function atDefense(made: Made) {
  let run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
  for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
    if (run.state.window?.kind === "chooseEnemy") run = send(run, { type: "ChooseEnemy", enemyId: run.state.window.options[0] ?? "" }, made.ctx);
    else if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
    else if (pass) run = send(run, pass as never, made.ctx);
    else break;
  }
  return run;
}

describe("stage 2B: the undefended attack (06067:B:1)", () => {
  const orc = (tokens: number) => table({ phase: "Encounter", stage: protect, engaged: [{ code: marauding, seat: 0 }], staging: [{ code: rescued, resources: tokens }, dead], deck: ["f0", "f0"] });
  const legal = (made: Made, state: ScenarioState) => legalIntents(state, made.ctx);

  it("the stage's preview says where the damage goes and what the end is, before any attack", () => {
    const made = orc(4);
    expect(stageLine(made, made.state)).toContain("An undefended attack discards 1 villager token from Rescued Villagers for each point of damage, and no hero is damaged. Each token discarded puts 1 damage token on Dead Villagers.");
    expect(stageLine(made, made.state)).toContain("At the end of the game: the players win if nothing changes (4 villager tokens on Rescued Villagers, 0 damage tokens on Dead Villagers; a tie loses).");
  });

  it("the attack sheet's Undefended line says the tokens and the damage tokens before the tap, and also with no token left", () => {
    for (const [tokens, line] of [[4, "Undefended: no hero takes it. Each point of damage discards 1 villager token from Rescued Villagers (it holds 4), and each token discarded puts 1 damage token on Dead Villagers."], [0, "Undefended: no hero takes it. Rescued Villagers holds no villager token, so none is discarded."]] as const) {
      const made = orc(tokens);
      const run = atDefense(made);
      expect(run.state.window?.kind).toBe("defense");
      const sheet = defenseSheet(run.state, made.ctx, legal(made, run.state), namesOf(made, run.state)) as PickSheet;
      expect(sheet.note).toContain(line);
    }
  });

  it("the dock readout of the undefended attack says the tokens discarded, fewer when it holds fewer, and no hero takes damage", () => {
    for (const [tokens, words] of [[6, "Undefended: 4 villager tokens discarded from Rescued Villagers, each a damage token on Dead Villagers, shadow card next"], [1, "Undefended: 1 villager token discarded from Rescued Villagers, each a damage token on Dead Villagers, shadow card next"], [0, "Undefended: no villager token to discard, shadow card next"]] as const) {
      const made = orc(tokens);
      const waiting = atDefense(made).state;
      // The moment after the Leave undefended tap: the engine marks the attack undefended and aimed at Rescued Villagers.
      const state = { ...waiting, pendingAttack: { ...waiting.pendingAttack!, undefended: true, heroId: idOf(waiting, rescued) } };
      expect(readoutFor(state, made.ctx, null, null, idName(made, state))?.result).toBe(words);
    }
  });

  it("the banner after the attack lists Rescued Villagers and Dead Villagers, and no hero", () => {
    const made = orc(6);
    const run = undefendedAtRescued(made);
    const lines = momentOf(made.state, run.state, run.steps, { card: idName(made, run.state) })?.lines.map((line) => line.text) ?? [];
    expect(lines).toEqual(["Attack 4 on Rescued Villagers, undefended", "No hero takes damage", "Villager tokens", "Rescued Villagers: 6 → 2 villager tokens", "Dead Villagers: 0 → 4 damage tokens"]);
  });

  it("another scenario's undefended attack keeps its hero line", () => {
    const made = orc(4);
    const other = { ...made.state, scenarioId: "the-stewards-fear" };
    expect(readoutFor({ ...other, pendingAttack: { enemyId: idOf(other, marauding), undefended: true, heroId: made.hero } as never }, made.ctx, null, null, idName(made, other))?.result).toMatch(/^Undefended: 4 damage on /);
  });
});

describe("Lord Alcaron (06070:A:1, 06070:A:3)", () => {
  const scene = (extra: Parameters<typeof table>[0] = {}) => table({ stage: protect, staging: [{ code: rescued, resources: 2 }, dead], play: [alcaron], ...extra });

  it("his preview says whose he is and that the players lose when he leaves play", () => {
    const made = scene();
    expect(say(made, made.state, alcaron)).toBe("Objective ally under your control. If he leaves play, the players lose the game.");
    const two = scene({ seats: 2 });
    expect(say(two, two.state, alcaron)).toBe("Objective ally under Player 1's control. If he leaves play, the players lose the game.");
  });

  it("with Ghulat in play the preview says the loss waits for him", () => {
    const made = scene({ staging: [{ code: rescued, resources: 2 }, dead, ghulat] });
    expect(say(made, made.state, alcaron)).toBe("Objective ally under your control. If he leaves play, the players lose the game, once Ghulat has left play.");
  });

  it("the dock's warning before a move that takes him out of play reads his own line: the loss at once, or the loss that waits for Ghulat", () => {
    const made = scene();
    const id = idOf(made.state, alcaron);
    expect(discardLoss(made.state, made.ctx, id)).toBe("Lord Alcaron left play");
    expect(lossWords("Lord Alcaron left play")).toBe("Lord Alcaron leaves play and the game is lost");
    const held = scene({ staging: [{ code: rescued, resources: 2 }, dead, ghulat] });
    const reason = discardLoss(held.state, held.ctx, idOf(held.state, alcaron));
    expect(lossWords(reason ?? "")).toBe("Lord Alcaron leaves play: the players lose once Ghulat leaves play");
    // Damage that destroys him (3 hit points) says the same, and 2 damage does not.
    expect(outcomeWords(damageOutcome(made.state, made.ctx, id, 3), "Lord Alcaron", false)).toBe("Lord Alcaron is destroyed: Lord Alcaron leaves play and the game is lost");
    expect(damageOutcome(made.state, made.ctx, id, 2).loss).toBeNull();
    // Another card of a game of another scenario that leaves play loses nothing.
    expect(discardLoss({ ...made.state, scenarioId: "the-stewards-fear" }, made.ctx, id)).toBe("Lord Alcaron left play");
  });
});

describe("Ghulat and the held end (06071:A:1, 06071:A:3, 06067:B:2)", () => {
  const scene = (dead_ = 0, extra: Parameters<typeof table>[0] = {}) => table({ stage: protect, staging: [{ code: rescued, resources: 4 }, { code: dead, damage: dead_ }, ghulat], play: [alcaron], ...extra });

  it("his preview says Attack X counts the damage tokens on Dead Villagers now, and that the game cannot end while he is in play; his chip shows that number", () => {
    const made = scene(3);
    expect(say(made, made.state, ghulat)).toBe("Attack X: X is the number of damage tokens on Dead Villagers (3 now). While Ghulat is in play the game cannot end.");
    expect(modifiedStat(made.state, made.state.cards[idOf(made.state, ghulat)]!, "attack", made.cards)).toBe(3);
    const more = scene(5);
    expect(modifiedStat(more.state, more.state.cards[idOf(more.state, ghulat)]!, "attack", more.cards)).toBe(5);
  });

  it("when stage 2B is defeated with Ghulat in play the stage and the banner say the game goes on, and the result with the counts as they stand", () => {
    const made = scene(3);
    const after = runSettled(made, made.state, { verb: "ProgressQuest", amount: 20 });
    expect(after.lost).toBeFalsy();
    expect(stageLine(made, after)).toContain("This stage is defeated, but the game cannot end while Ghulat is in play. It goes on until he leaves play. Then the players win: 4 villager tokens on Rescued Villagers against 3 damage tokens on Dead Villagers.");
    const moment = momentOf(made.state, after, [], { card: idName(made, after) });
    expect(moment?.title).toBe("The game goes on");
    expect(moment?.lines.map((line) => line.text)).toEqual(["This stage is defeated, but the game cannot end while Ghulat is in play. It goes on until he leaves play. Then the players win: 4 villager tokens on Rescued Villagers against 3 damage tokens on Dead Villagers."]);
    // A tie loses.
    const tie = scene(4);
    expect(stageLine(tie, runSettled(tie, tie.state, { verb: "ProgressQuest", amount: 20 }))).toContain("Then the players lose: 4 villager tokens on Rescued Villagers against 4 damage tokens on Dead Villagers, and a tie loses.");
  });

  it("with Lord Alcaron gone and Ghulat in play the stage and the banner say the players lose when Ghulat leaves play", () => {
    const made = scene(3);
    const gone = runSettled(made, made.state, { verb: "Discard", target: { kind: "self" } }, idOf(made.state, alcaron));
    expect(gone.lost).toBeFalsy();
    expect(stageLine(made, gone)).toContain("Lord Alcaron left play. The players lose once Ghulat leaves play, because the game cannot end while he is in play.");
    const moment = momentOf(made.state, gone, [], { card: idName(made, gone) });
    expect(moment?.title).toBe("The game goes on");
    expect(moment?.lines.map((line) => line.text)).toEqual(["Lord Alcaron left play. The players lose once Ghulat leaves play, because the game cannot end while he is in play."]);
  });

  it("with Alcaron gone and the stage defeated too, the held end names Alcaron as the reason", () => {
    const made = scene(0);
    const gone = runSettled(made, made.state, { verb: "Discard", target: { kind: "self" } }, idOf(made.state, alcaron));
    const done = runSettled(made, gone, { verb: "ProgressQuest", amount: 20 });
    expect(stageLine(made, done)).toContain("Then the players lose: Lord Alcaron left play.");
  });

  it("no line in a game of another scenario", () => {
    const made = scene(3);
    const after = runSettled(made, made.state, { verb: "ProgressQuest", amount: 20 });
    const other = { ...after, scenarioId: "the-stewards-fear" };
    expect(momentOf(made.state, other, [], { card: idName(made, other) })).toBeNull();
    expect(say(made, other, ghulat)).toBeNull();
  });
});
