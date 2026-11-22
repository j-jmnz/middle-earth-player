// Rules: mec108.reanimated-dead, mec108.indestructible, rr.attachment-cards, rr.removed-from-game, rr.winning-the-game, rr.first-player (data/rules/entries.json); ledger lines 10152:B:3, 10153:A:2, 10153:A:3, 10154:A:1, 101157:A:1, 101160:A:1, 101161:A:1, 101162:A:2, 101163:A:1.
// What the table says of The Dread Realm's pieces: a Reanimated Dead drawn facedown in its engaged row or the staging area (never showing or naming the face, with a preview, the reader's words and the web list's saying what it is, whose card it is and where it goes when it leaves play), each seat's count,
// the Wraith lying on a character, Possession on its Reanimated Dead, A Fell Dread's mark on its hero, Daechanar with the Sorcery cards in play, stage 3's locations in play against the 0 at which the players win, and the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one.
// No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { A_FELL_DREAD, DAECHANAR, POSSESSION, WRAITH_OF_CARN_DUM } from "../../effects/authored/angmar-awakened/the-dread-realm.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { destroyCard } from "../../rules/core/keywords.ts";
import { settle } from "../../rules/engine/machine.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { idOf, legalIntents, resolveRecords, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { cardEffects, slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { previewCards } from "../cards/table-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import { seatedLabel } from "../choice/sheet-parts.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { slotOf } from "../layout/slots.ts";
import { scenarioDials, seatMarks } from "../readouts/scenario-dials.ts";
import { hidesFace, isDead, zoneSelector } from "../store/selectors.ts";
import { pictureCode } from "../canvas/picture-key.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { cardSpeech, type CardSpeechDeps } from "../words/card-speech.ts";
import { islandOptionLabel, islandPickWords } from "../words/scenarios/island.ts";
import { deadSeatWords, escapeNear } from "../words/scenarios/angmar/dread-realm-table.ts";

const ID = "the-dread-realm";
const STAGE2 = "10151";
const STAGE3 = "10152";
const HALLS = "101160";
const CRYPT = "101161";
const ENCOUNTER = ["f0", "f0", "f0", "f0", "f0", "f0"];
// The scenario deals encounter side quests (Seal the Tomb, The Power of Angmar), so a game of it notes `sideQuests` as the Setup does.
const built = (layout: Layout = {}) => {
  const t = tableFromLayout(ID, { phase: "Quest", deck: ENCOUNTER, ...layout });
  return { ...t, state: { ...t.state, sideQuests: true } as ScenarioState };
};
type Made = ReturnType<typeof built>;
const NAMES: Record<string, string> = { "10150": "Overwhelmed", "10151": "Daechanar's Sorcery", "10152": "Escape from Carn Dûm", "10153": "Daechanar", "10154": "Altar of Midwinter", "101157": "Wraith of Carn Dûm", "101160": "Dark Halls", "101161": "Unholy Crypt", "101162": "Possession", "101163": "A Fell Dread", "10179": "Laermuin", place: "Some Place" };
const codeName = (code: string) => NAMES[code] ?? code;
const idName = (state: ScenarioState) => (id: string) => codeName(state.cards[id]?.code ?? id);
const deadOf = (state: ScenarioState, seat: number) => state.seats[seat]?.engaged.filter((id) => state.cards[id]?.code.endsWith("~dead")) ?? [];
const speechDeps = (made: Made): CardSpeechDeps => ({
  nameOf: (key) => codeName(pictureCode(key)),
  inactive: () => false,
  facts: { typeOf: (code) => made.cards.get(code)?.type ?? null, shipRank: () => null },
  info: (game, seat, cardId) => slotNumbers(game, made.ctx, cardId, seat),
  highlight: NO_HIGHLIGHT,
  cards: made.cards,
  sheet: null,
  peeking: false,
});
const reanimated = (made: Made, seat = 0, to?: "staging"): ScenarioState => runInstruction(made.state, { verb: "Reanimate", from: "deckTop", ...(to ? { to } : {}) }, { seat, sourceId: null }, made.ctx, []);
// The preview of a card, with a describe that fails when the face is asked for: a Reanimated Dead never asks.
const noFace = (code: string) => {
  if (code.endsWith("~dead")) throw new Error("the face of a Reanimated Dead was asked for");
  return { name: codeName(code), source: null };
};
const previewOf = (made: Made, state: ScenarioState, id: string) => previewCards(state, made.ctx, id, noFace, idName(state)).cards[0];

describe("a Reanimated Dead on the table", () => {
  const solo = () => built({ seats: 1, deckOf: ["10179"] });
  const pair = () => built({ seats: 2, deckOf: [{ code: "10179", seat: 1 }] });

  it("mec108.reanimated-dead is drawn facedown in its engaged row, as a card back that names no card, and its tap and hold open a preview", () => {
    const made = solo();
    const state = reanimated(made);
    const [id] = deadOf(state, 0);
    const card = state.cards[id!]!;
    const slot = slotOf(card, "engaged", "card", { x: 0, y: 0, w: 50, h: 70 });
    expect(slot).toMatchObject({ faceDown: true, dead: true });
    expect(zoneSelector("engaged", 0)(state).entries.map((entry) => entry.card.id)).toContain(id);
    // The face stays hidden to every picture and name; only the preview, the reader and the list open on it.
    expect(hidesFace(card)).toBe(true);
    expect(isDead(card)).toBe(true);
    expect(isDead(state.cards[made.hero])).toBe(false);
  });

  it("mec108.reanimated-dead has a preview that says what it is (Undead, 0 engagement cost, 2 Threat, 2 Attack, 2 Defense, 2 hit points), whose card it is and where it goes, without its face", () => {
    const made = solo();
    const state = reanimated(made);
    const [id] = deadOf(state, 0);
    const shown = previewOf(made, state, id!);
    expect(shown).toMatchObject({ name: "Reanimated Dead", source: null, faceless: true });
    expect(shown?.text).toBe("A facedown card acting as an Undead enemy: engagement cost 0, Threat 2, Attack 2, Defense 2, 2 hit points. Engaged with you. It is your card, and goes to your discard pile when it leaves play.");
    expect(JSON.stringify(shown)).not.toContain("Laermuin");
    const two = pair();
    const dealt = reanimated(two, 1);
    const [other] = deadOf(dealt, 1);
    expect(previewOf(two, dealt, other!)?.text).toContain("Engaged with Player 2. It is Player 2's card, and goes to Player 2's discard pile when it leaves play.");
  });

  it("mec108.reanimated-dead in the staging area says so in its preview, and a Dark Halls there raises its Attack and Defense as the engine reads them", () => {
    const made = built({ seats: 1, deckOf: ["10179"], staging: [HALLS] });
    const state = reanimated(made, 0, "staging");
    const staged = state.staging.find((id) => state.cards[id]?.code.endsWith("~dead"))!;
    const settledState = settle({ ...state, window: null, mode: "stopped" }, made.ctx, []);
    expect(previewOf(made, settledState, staged)?.text).toBe("A facedown card acting as an Undead enemy: engagement cost 0, Threat 2, Attack 3, Defense 3, 2 hit points. In the staging area, adding its Threat there. It is your card, and goes to your discard pile when it leaves play.");
  });

  it("mec108.reanimated-dead is spoken as what it is and whose card it is by the reader and the slot, never as the card behind it", () => {
    const made = solo();
    const state = reanimated(made);
    const [id] = deadOf(state, 0);
    const said = "a facedown Undead enemy engaged with you: engagement cost 0, Threat 2, Attack 2, Defense 2, 2 hit points. Your card, it goes to your discard pile when it leaves play";
    expect(slotNumbers(state, made.ctx, id!, 0).dead).toBe(said);
    expect(cardSpeech(state, 0, id!, speechDeps(made)).label).toBe(`Reanimated Dead, ${said}`);
    expect(cardSpeech(state, 0, id!, speechDeps(made)).hint).toBe("Double tap to show the card");
    expect(cardSpeech(state, 0, id!, speechDeps(made)).label).not.toContain("Laermuin");
  });

  it("mec108.reanimated-dead gives each seat a count of the Reanimated Dead engaged with it, and a Reanimated Dead leaving play leaves it", () => {
    const made = built({ seats: 2, deckOf: ["filler", "filler"], staging: [CRYPT] });
    const state = reanimated({ ...made, state: reanimated(made, 0) }, 1);
    const marks = seatMarks(state, made.ctx);
    expect(marks.map((mark) => [mark.seat, mark.label])).toEqual([[0, "P1 · Dead"], [1, "P2 · Dead"]]);
    expect(marks[0]?.note).toBe("1 Reanimated Dead engaged, an Undead enemy. Each adds 1 Threat to every Unholy Crypt in the staging area.");
    const [gone] = deadOf(state, 0);
    expect(seatMarks(destroyCard(state, gone!, made.ctx.cards, []), made.ctx).map((mark) => mark.seat)).toEqual([1]);
    // The note gives no Attack or Defense: a Dark Halls in the staging area changes them, and the preview reads them as the engine does.
    expect(deadSeatWords(2, 0)).toBe("2 Reanimated Dead engaged, each an Undead enemy.");
    expect(marks[0]?.note).not.toMatch(/Attack|Defense/);
    const solo = reanimated(built({ seats: 1, deckOf: ["filler"] }));
    expect(seatMarks(solo, built({ seats: 1 }).ctx)[0]?.label).toBe("Dead");
  });

  it("101162:A:2 draws Possession under its Reanimated Dead in the staging area and its preview says it discards the dead with it", () => {
    const made = built({ seats: 1, play: ["10179"] });
    const run = resolveRecords(made.state, made.ctx, "101162", "whenRevealed");
    const state = settle({ ...run.state, window: null, mode: "stopped" }, made.ctx, []);
    const dead = Object.values(state.cards).find((card) => card.code.endsWith("~dead"))!;
    expect(zoneSelector("staging", 0)(state).entries.find((entry) => entry.card.id === dead.id)?.attached.map((card) => card.id)).toContain(run.id);
    expect(angmarDetail(state, made.ctx, run.id, idName(state))).toBe("Attached to a Reanimated Dead (your card). Counts as a Sorcery Condition attachment. Discarding it discards the Reanimated Dead to its owner's discard pile; removing it from the game leaves the Reanimated Dead in play.");
    expect(previewOf(made, state, dead.id)?.text).toContain("Possession is attached to it: when Possession is discarded this card is discarded too.");
    expect(dungeonDetail(state, made.ctx, run.id, idName(state))).toContain("Reanimated Dead");
  });
});

describe("the Wraith, A Fell Dread and Daechanar on the table", () => {
  it("101157:A:1 draws the Wraith attached to its character with the attachment's text and says it returns when the character leaves play", () => {
    const made = built({ seats: 1, staging: [WRAITH_OF_CARN_DUM], play: ["10179"] });
    const wraith = idOf(made.state, WRAITH_OF_CARN_DUM);
    const ally = idOf(made.state, "10179");
    const watched = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
    const left = settle(destroyCard(watched, wraith, made.ctx.cards, []), made.ctx, []);
    const onAlly = runInstruction(updateCard(left, wraith, {}), { verb: "Pick", pick: { type: "character", control: "any" } }, { seat: 0, sourceId: wraith }, made.ctx, []);
    expect(onAlly.cards[ally]).toBeDefined();
    const attached = built({ seats: 1, play: ["10179"], attached: [{ code: WRAITH_OF_CARN_DUM, to: "10179" }] });
    const state = updateCard(attached.state, idOf(attached.state, WRAITH_OF_CARN_DUM), { zone: "attached", asAttachment: true });
    expect(angmarDetail(state, attached.ctx, idOf(state, WRAITH_OF_CARN_DUM), idName(state))).toBe("Attached to Laermuin as a Sorcery attachment: Laermuin has -1 Willpower, -1 Attack and -1 Defense. When Laermuin leaves play the Wraith returns to the staging area as an enemy.");
    expect(zoneSelector("play", 0)(state).entries.find((entry) => entry.card.id === idOf(state, "10179"))?.attached.map((card) => card.id)).toContain(idOf(state, WRAITH_OF_CARN_DUM));
  });

  it("101163:A:1 marks the hero A Fell Dread is attached to: Willpower 0 as a changed number and a must-commit pill, and its preview says both", () => {
    const made = built({ seats: 2, attached: [{ code: A_FELL_DREAD, to: "dh1" }] });
    const state = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
    const effects = cardEffects(state, made.ctx, made.hero);
    expect(effects.stats.find((badge) => badge.stat === "willpower")).toMatchObject({ value: 0 });
    expect(effects.flags.map((flag) => flag.word)).toContain("Must commit to the quest");
    const dread = idOf(state, A_FELL_DREAD);
    expect(angmarDetail(state, made.ctx, dread, idName(state))).toBe("Attached to dh1 (Player 1's hero): Willpower 0, and dh1 must commit to the quest each round, if able. Counts as a Sorcery Condition attachment.");
    expect(cardSpeech(state, 0, made.hero, speechDeps(made)).label).toContain("must commit to the quest");
  });

  it("10153:A:2 says Daechanar's Attack with the Sorcery cards in play and that damage to him is canceled while one is, and what changes with none", () => {
    const made = built({ stage: STAGE2, staging: [DAECHANAR], attached: [{ code: POSSESSION, to: STAGE2 }, { code: A_FELL_DREAD, to: "dh1" }] });
    const state = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
    const dial = scenarioDials(state, made.ctx, codeName).find((one) => one.testID === "angmar-sorcery");
    expect(dial).toMatchObject({ label: "Sorcery", value: 2, name: "Sorcery cards in play:" });
    expect(dial?.limit).toBeUndefined();
    expect(dial?.note).toBe("Daechanar cancels all damage while a Sorcery card is in play, removing one from the game each time. 2 Sorcery cards in play.");
    expect(angmarDetail(state, made.ctx, idOf(state, DAECHANAR), idName(state))).toBe("2 Sorcery cards in play: 6 Attack, Indestructible, and each time he is damaged all the damage just dealt is canceled and the first player removes a Sorcery card from the game.");
    const bare = built({ stage: STAGE2, staging: [DAECHANAR] });
    const none = settle({ ...bare.state, window: null, mode: "stopped" }, bare.ctx, []);
    expect(scenarioDials(none, bare.ctx, codeName).find((one) => one.testID === "angmar-sorcery")).toMatchObject({ value: 0, note: "Daechanar takes damage now, and destroying him advances the quest." });
    expect(angmarDetail(none, bare.ctx, idOf(none, DAECHANAR), idName(none))).toBe("No Sorcery card is in play: 4 Attack, and damage to him lands. Destroying him advances the quest.");
    expect(scenarioDials(built({ stage: "10150" }).state, bare.ctx, codeName).some((one) => one.testID === "angmar-sorcery")).toBe(false);
  });

  it("10154:A:1 says no progress can be placed on the Altar of Midwinter while Daechanar is in play, and that it can once he is gone", () => {
    const made = built({ stage: STAGE2, active: "10154", staging: [DAECHANAR] });
    expect(angmarDetail(made.state, made.ctx, idOf(made.state, "10154"), idName(made.state))).toBe("No progress can be placed here while Daechanar is in play.");
    const gone = built({ stage: STAGE2, active: "10154" });
    expect(angmarDetail(gone.state, gone.ctx, idOf(gone.state, "10154"), idName(gone.state))).toBe("Progress can be placed here: Daechanar is not in play.");
  });
});

describe("stage 3's locations in play", () => {
  const dial = (made: Made, state: ScenarioState = made.state) => scenarioDials(state, made.ctx, codeName).find((one) => one.testID === "angmar-escape");

  it("10152:B:3 counts the locations in the staging area and the active location against the 0 at which the players win, with a fixed label and no limit", () => {
    const made = built({ stage: STAGE3, staging: ["place", "place"], active: "place" });
    expect(dial(made)).toMatchObject({ label: "Locations", name: "Locations in play:", value: 3 });
    expect(dial(made)?.limit).toBeUndefined();
    expect(dial(made)?.note).toBe("3 locations in play, in the staging area or active. At the end of the quest phase every character takes 1 damage while any location is in play; the players win once none is.");
    const staged = built({ stage: STAGE3, staging: ["place"] });
    expect(dial(staged)?.value).toBe(1);
    const none = built({ stage: STAGE3 });
    expect(dial(none)).toMatchObject({ value: 0, note: "If none is in play at the end of the quest phase, the players escape Carn Dûm and win." });
    expect(dial(none)?.warn).toBeUndefined();
    expect(dial(built({ stage: STAGE2, staging: ["place"] }))).toBeUndefined();
  });

  it("10152:B:3 warns only when the damage at the end of the quest phase would destroy a character, and says who, and never when no location is in play", () => {
    const made = built({ stage: STAGE3, staging: ["place"] });
    expect(dial(made)?.warn).toBeUndefined();
    const hurt = updateCard(made.state, made.hero, { damage: 99 });
    const warned = dial(made, hurt);
    expect(warned?.warn?.level).toBe("near");
    expect(warned?.warn?.words).toBe("At the end of the quest phase 1 damage destroys dh1.");
    const clear = built({ stage: STAGE3 });
    expect(dial(clear, updateCard(clear.state, clear.hero, { damage: 99 }))?.warn).toBeUndefined();
  });

  it("10152:B:3 names the owner of each character the damage would destroy two-handed, says a repeated name once with its count, and joins the list with and", () => {
    const made = built({ seats: 2, stage: STAGE3, staging: ["place"] });
    const hurt = updateCard(updateCard(made.state, idOf(made.state, "dh1"), { damage: 99 }), idOf(made.state, "dh3"), { damage: 99 });
    expect(dial(made, hurt)?.warn?.words).toBe("At the end of the quest phase 1 damage destroys Player 1's dh1 and Player 2's dh3.");
    expect(escapeNear([{ name: "Laermuin", owner: "Player 1's" }, { name: "Laermuin", owner: "Player 1's" }, { name: "Aragorn", owner: "Player 2's" }])).toBe("At the end of the quest phase 1 damage destroys Player 1's Laermuin (x2) and Player 2's Aragorn.");
    expect(escapeNear([{ name: "Laermuin", owner: null }])).toBe("At the end of the quest phase 1 damage destroys Laermuin.");
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  const sheetOf = (made: Made, state: ScenarioState): PickSheet | null => {
    const names: SheetNames = { card: (id) => idName(state)(id), line: () => null };
    return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names) as PickSheet | null;
  };

  it("10153:A:3 offers each Sorcery card in play, any player's, to the first player, each row naming whose it is", () => {
    const made = built({ seats: 2, firstPlayer: 1, stage: STAGE2, staging: [DAECHANAR], attached: [{ code: A_FELL_DREAD, to: "dh1" }, { code: A_FELL_DREAD, to: "dh3" }] });
    const effects = made.ctx.effects.filter((effect) => effect.cardCode === DAECHANAR && effect.timing === "forced" && effect.trigger === "damaged");
    // A card attached by an effect lies in the zone `attached` (the layout spawns it in play).
    const attached = Object.values(made.state.cards).filter((card) => card.code === A_FELL_DREAD).reduce((state, card) => updateCard(state, card.id, { zone: "attached" }), made.state);
    const pushed = pushCardEffects({ ...attached, window: null, mode: "stopped" }, "forced", idOf(made.state, DAECHANAR), 1, false, effects, made.ctx, []);
    const asked = settle(pushed, made.ctx, []);
    const sheet = sheetOf(made, asked);
    expect((sheet?.options ?? []).length).toBeGreaterThanOrEqual(2);
    expect((sheet?.options ?? []).map((option) => option.label).sort()).toEqual(["A Fell Dread · on dh1, Player 1's hero", "A Fell Dread · on dh3, Player 2's hero"]);
  });

  it("101163:A:1 names the card a row lies on, an enemy host by the player it is engaged with, and gives no label to one lying on a card no seat owns", () => {
    const made = built({ seats: 2, engaged: [{ code: "f0", seat: 1 }], staging: ["f0"], attached: [{ code: A_FELL_DREAD, to: "dh1" }] });
    const [engagedEnemy, stagedEnemy] = [made.state.seats[1]?.engaged[0] ?? "", made.state.staging.find((id) => made.state.cards[id]?.code === "f0") ?? ""];
    const fell = idOf(made.state, A_FELL_DREAD);
    const names: SheetNames = { card: idName(made.state), line: () => null };
    const onEnemy = updateCard(updateCard(made.state, fell, { zone: "attached", host: engagedEnemy }), engagedEnemy, { attachments: [fell] });
    expect(seatedLabel(onEnemy, made.ctx, names, fell, [fell, idOf(made.state, "dh1")])).toBe("A Fell Dread · on f0, enemy engaged with Player 2");
    const onStaged = updateCard(updateCard(made.state, fell, { zone: "attached", host: stagedEnemy }), stagedEnemy, { attachments: [fell] });
    expect(seatedLabel(onStaged, made.ctx, names, fell, [fell, idOf(made.state, "dh1")])).toBeUndefined();
  });

  it("101157:A:1 offers each hero and ally in play, any player's, to the first player for the Wraith, each row naming whose it is", () => {
    const made = built({ seats: 2, staging: [WRAITH_OF_CARN_DUM], play: [{ code: "10179", seat: 1 }] });
    const wraith = idOf(made.state, WRAITH_OF_CARN_DUM);
    const watched = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
    const asked = settle(destroyCard(watched, wraith, made.ctx.cards, []), made.ctx, []);
    const options = (sheetOf(made, asked)?.options ?? []).map((option) => option.label);
    expect(options).toContain("Laermuin · Player 2's ally");
    expect(options.filter((label) => /Player [12]'s hero/.test(label))).toHaveLength(3);
  });

  it("101162:A:2 names whose ally each row is when allies of two players tie for the highest cost and the first player chooses which is destroyed", () => {
    const made = built({ seats: 2, firstPlayer: 1, play: ["10179", { code: "10179", seat: 1 }] });
    let asked = 0;
    const run = resolveRecords(made.state, made.ctx, "101162", "whenRevealed", undefined, (state) => {
      if (state.window?.kind === "choose") {
        asked += 1;
        const labels = (sheetOf(made, state)?.options ?? []).map((option) => option.label);
        expect(labels.sort()).toEqual(["Laermuin · Player 1's ally", "Laermuin · Player 2's ally"]);
      }
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(asked).toBeGreaterThan(0);
    expect(Object.values(run.state.cards).filter((card) => card.code.endsWith("~dead"))).toHaveLength(1);
  });
});

describe("stage 3's division of progress reads what it does", () => {
  it("10152:B:2 marks the amount that explores the location, and says that what no location can take is lost", () => {
    const made = built({ stage: STAGE3, staging: ["place", "place"] });
    const at = made.state.staging.find((id) => made.state.cards[id]?.code === "place") ?? "";
    const names = { card: idName(made.state), code: codeName };
    const instruction = { verb: "PlaceProgressInStaging", left: 4, divided: true, at } as const;
    expect(islandOptionLabel(instruction, "1", made.state, names, made.ctx.cards)).toBe("1 of the 4 progress");
    expect(islandOptionLabel(instruction, "2", made.state, names, made.ctx.cards)).toBe("2 of the 4 progress \u00b7 explores it");
    expect(islandPickWords(instruction, undefined, names, STAGE3, made.state)?.prompt).toContain("anything no location can take is lost");
    expect(islandPickWords({ verb: "PlaceProgressInStaging", left: 4, divided: true }, undefined, names, STAGE3, made.state)?.prompt).toContain("anything no location can take is lost");
  });
});
