// Rules: mec108.thaurdir, mec108.indestructible, mec108.side-quests-in-play, rr.active-location, rr.attachment-cards, rr.first-player (data/rules/entries.json); ledger lines 10125:B:1, 10125:B:3, 10126:B:1, 10126:B:2, 10127:A:4, 10129:A:1, 10139:A:3, 10190:A:1, 10191:A:2.
// What the table says of The Battle of Carn Dûm's pieces: Thaurdir's side and the shadow cards dealt to him against the 3 that flip him on stage 1B (a count; each flip does something, which the note says), stage 2B's progress against the 15 that take his Indestructible away (a goal), the
// Garrison's Threat that grows with its shadow cards, Furious Charge's 10 progress for the main quest, the burden Thaurdir carries across a flip and a boon on its hero, and the owner named on a pick each player makes from their own pile. The engine decided each; nothing here changes one.
// No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { CRUX_PROGRESS, FURIOUS_CHARGE_PROGRESS, THAURDIR_FLIP_SHADOWS, AUTHORED_EFFECTS } from "../../effects/authored/angmar-awakened/the-battle-of-carn-dum.ts";
import { type ScenarioState } from "../../rules/core/state.ts";
import { moveCard, spawn } from "../../rules/core/zones.ts";
import { settle } from "../../rules/engine/machine.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { zoneSelector } from "../store/selectors.ts";
import { idOf, legalIntents, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { dialProps } from "../readouts/dials.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";
import { cruxWords, thaurdirDialWords } from "../words/scenarios/angmar/carn-dum-table.ts";

const ID = "the-battle-of-carn-dum";
const STAGE1 = "10125";
const STAGE2 = "10126";
const CAPTAIN = "10127";
const CHAMPION = "10128";
const at = (layout: Layout = {}) => {
  const t = tableFromLayout(ID, { stage: STAGE1, phase: "Quest", deck: ["f0", "f0", "f0", "f0", "f0", "f0"], ...layout });
  return { ...t, state: { ...t.state, sideQuests: true as const } };
};
const NAMES: Record<string, string> = { "10125": "The Clutches of Carn Dûm", "10126": "Midwinter's Crux", "10127": "Thaurdir", "10128": "Thaurdir", "10129": "Carn Dûm Garrison", "10139": "Furious Charge", "10168": "Thaurdir's Legacy", "10191": "Raiment of the Second Age" };
const codeName = (code: string) => NAMES[code] ?? code;
const nameOf = (state: ScenarioState) => (id: string) => codeName(state.cards[id]?.code ?? id);
const dials = (t: ReturnType<typeof at>, state: ScenarioState = t.state) => scenarioDials(state, t.ctx, codeName);
const dial = (t: ReturnType<typeof at>, id: string, state: ScenarioState = t.state) => dials(t, state).find((one) => one.testID === id);
const detail = (t: ReturnType<typeof at>, state: ScenarioState, code: string) => angmarDetail(state, t.ctx, idOf(state, code), nameOf(state));
const dealt = (t: ReturnType<typeof at>, state: ScenarioState, code: string, times: number): ScenarioState =>
  Array.from({ length: times }).reduce<ScenarioState>((next) => runInstruction(next, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: idOf(next, code) }, t.ctx, []), state);

describe("Thaurdir's side and shadow cards", () => {
  const CAPTAIN_HOLDING_THREE = "Captain side faceup, 3 shadow cards dealt to him. Holding 3, more shadow cards do not flip him until these are discarded.";
  const FLIP_TO_CHAMPION = "he heals 3 damage and attacks the first player at once";
  const FLIP_TO_CAPTAIN = "each enemy in play is dealt a shadow card, which stays on it and raises the Garrison's Threat";

  it("10125:B:3 counts the shadow cards dealt to him against the 3 that flip him on stage 1B, a count that never warms or goes critical, with a fixed label so the dials after it stay put", () => {
    const t = at({ staging: [CAPTAIN] });
    expect(dial(t, "angmar-side")).toMatchObject({ label: "Thaurdir", value: 0, limit: THAURDIR_FLIP_SHADOWS, limitWords: "3 flip him", name: "Shadow cards dealt to Thaurdir, Captain side faceup:" });
    for (const count of [0, 1, 2]) {
      const shown = dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, count));
      expect(shown?.value).toBe(count);
      expect(shown?.goal).toBeUndefined();
      expect(shown && dialProps(shown).elimination).toBe(false);
      expect(shown?.warn?.level === "critical").toBe(false);
    }
    expect(dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, 1))?.note).toBe(`Captain side faceup, 1 shadow card dealt to him. At 3 he flips to his Champion side: ${FLIP_TO_CHAMPION}.`);
  });

  it("10125:B:3 warns near on a Captain one shadow card short of flipping to Champion, which attacks at once, and on nothing else", () => {
    const t = at({ staging: [CAPTAIN] });
    const two = dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, 2));
    expect(two?.warn).toEqual({ level: "near", words: "One more shadow card flips him to Champion: he heals 3 damage and attacks the first player at once." });
    expect(two?.note).toBe(`Captain side faceup, 2 shadow cards dealt to him. At 3 he flips to his Champion side: ${FLIP_TO_CHAMPION}.`);
    for (const count of [0, 1]) expect(dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, count))?.warn).toBeUndefined();
    const champion = at({ staging: [CHAMPION] });
    expect(dial(champion, "angmar-side", dealt(champion, champion.state, CHAMPION, 2))?.warn).toBeUndefined();
  });

  it("10125:B:3 drops the limit at 3 or more shadow cards, since a fourth does not flip him (it fires on exactly 3), on both sides", () => {
    const captain = at({ staging: [CAPTAIN] });
    const champion = at({ staging: [CHAMPION] });
    for (const count of [3, 4]) {
      const held = dial(captain, "angmar-side", dealt(captain, captain.state, CAPTAIN, count));
      expect(held?.value).toBe(count);
      expect(held?.limit).toBeUndefined();
      expect(held?.limitWords).toBeUndefined();
      expect(held?.warn).toBeUndefined();
      expect(held?.note).toBe(`Captain side faceup, ${count} shadow cards dealt to him. Holding ${count}, more shadow cards do not flip him until these are discarded.`);
      const flipped = dial(champion, "angmar-side", dealt(champion, champion.state, CHAMPION, count));
      expect(flipped?.limit).toBeUndefined();
      expect(flipped?.note).toBe(`Champion side faceup, ${count} shadow cards dealt to him. Holding ${count}, more shadow cards do not flip him until these are discarded. At the end of the round he flips to Captain: ${FLIP_TO_CAPTAIN}.`);
    }
    expect(dial(champion, "angmar-side", dealt(champion, champion.state, CHAMPION, 2))).toMatchObject({ limit: 3, limitWords: "3 flip him" });
    expect(dial(captain, "angmar-side", dealt(captain, captain.state, CAPTAIN, 3))?.note).toBe(CAPTAIN_HOLDING_THREE);
  });

  it("10125:B:1 says what each flip does: the Champion flips to Captain at the end of the round and at 3, dealing each enemy a shadow card", () => {
    const t = at({ staging: [CHAMPION] });
    expect(dial(t, "angmar-side")).toMatchObject({ label: "Thaurdir", name: "Shadow cards dealt to Thaurdir, Champion side faceup:" });
    expect(dial(t, "angmar-side")?.note).toBe(`Champion side faceup, 0 shadow cards dealt to him. At 3 he flips to his Captain side: ${FLIP_TO_CAPTAIN}. At the end of the round he flips to Captain: ${FLIP_TO_CAPTAIN}.`);
  });

  it("10125:B:3 follows a flip: the dial shows the side he flips to, the count kept, and a fourth card on that side flips nobody", () => {
    const t = at({ staging: [CAPTAIN] });
    const held = dealt(t, t.state, CAPTAIN, 3);
    const settled = settle({ ...held, window: null, mode: "stopped" }, t.ctx, []);
    // The Champion side attacks at once and is dealt a shadow card for the attack: the count is kept and grows.
    expect(dial(t, "angmar-side", settled)?.label).toBe("Thaurdir");
    expect(dial(t, "angmar-side", settled)?.name).toBe("Shadow cards dealt to Thaurdir, Champion side faceup:");
    expect(dial(t, "angmar-side", settled)?.value).toBeGreaterThanOrEqual(3);
    expect(dial(t, "angmar-side", settled)?.limit).toBeUndefined();
  });

  it("10126:B:1 has no limit on stage 2B, where shadow cards no longer flip him, and says when he flips and that he attacks each player", () => {
    const t = at({ stage: STAGE2, staging: [CAPTAIN] });
    const shown = dial(t, "angmar-side");
    expect(shown?.limit).toBeUndefined();
    expect(shown?.note).toBe(
      `Captain side faceup, 0 shadow cards dealt to him. At the end of the round he flips to his Champion side: ${FLIP_TO_CHAMPION}. Engaged with each player: he attacks each player in turn in the combat phase, and any player's characters can attack him. Each attack he makes is dealt a shadow card of its own.`,
    );
    expect(thaurdirDialWords("Champion", 1, null, 3)).toContain(`He stays Champion side faceup until an effect flips him to Captain: ${FLIP_TO_CAPTAIN}.`);
  });

  it("10125:B:3 reads the number that flips him from the records", () => {
    const flip = AUTHORED_EFFECTS.find((effect) => effect.id === "10125:forced:2");
    expect(JSON.stringify(flip?.condition)).toBe(JSON.stringify({ kind: "all", conditions: [{ kind: "less", left: THAURDIR_FLIP_SHADOWS - 1, right: { stat: "shadowCards", of: "subject" } }, { kind: "less", left: { stat: "shadowCards", of: "subject" }, right: THAURDIR_FLIP_SHADOWS + 1 }] }));
  });
});

describe("Midwinter's Crux", () => {
  it("10126:B:2 draws a goal dial for the progress on the stage against the 15 that take his Indestructible away, on stage 2B only", () => {
    const t = at({ stage: STAGE2, staging: [CHAMPION], progress: 6 });
    expect(dial(t, "angmar-crux")).toMatchObject({ label: "Crux", value: 6, limit: CRUX_PROGRESS, goal: true, limitWords: "15 takes away his Indestructible", name: "Progress on Midwinter's Crux:" });
    expect(dial(t, "angmar-crux")?.warn).toBeUndefined();
    expect(dial(t, "angmar-crux")?.note).toBe("6 of 15 progress on Midwinter's Crux. At 15 Thaurdir loses Indestructible, so damage can destroy him and win the game. The stage cannot be defeated while he is in play.");
    expect(dialProps(dial(t, "angmar-crux")!).elimination).toBe(false);
    expect(dial(at({ staging: [CAPTAIN] }), "angmar-crux")).toBeUndefined();
  });

  it("10126:B:2 says it truly at the limit, and the number is the one the record reads", () => {
    expect(cruxWords(15, CRUX_PROGRESS, "Midwinter's Crux", null)).toBe("15 progress on Midwinter's Crux: Thaurdir has lost Indestructible. Damage that destroys him wins the game. The stage cannot be defeated while he is in play.");
    const record = AUTHORED_EFFECTS.find((effect) => effect.id === "10126:constant:2");
    expect(JSON.stringify(record?.condition)).toBe(JSON.stringify({ kind: "stageProgress", min: CRUX_PROGRESS }));
  });
});

describe("Midwinter's Crux at 15 progress", () => {
  it("10126:B:2 names the next goal, the damage on Thaurdir against his hit points as the engine reads them, once his Indestructible has lapsed", () => {
    const t = at({ stage: STAGE2, staging: [{ code: CHAMPION, damage: 4 }], progress: 15 });
    expect(dial(t, "angmar-crux")?.note).toBe("15 progress on Midwinter's Crux: Thaurdir has lost Indestructible. Damage that destroys him wins the game: he has 4 of 9 hit points of damage. The stage cannot be defeated while he is in play.");
    const raised = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: idOf(t.state, CHAMPION), sourceId: "t", stat: "hitPoints" as const, amount: 2, until: "endOfRound" as const }] };
    expect(dial(t, "angmar-crux", raised)?.note).toContain("4 of 11 hit points");
    const below = at({ stage: STAGE2, staging: [{ code: CHAMPION, damage: 4 }], progress: 14 });
    expect(dial(below, "angmar-crux")?.note).not.toContain("hit points");
  });
});

describe("the Garrison, Furious Charge and Thaurdir's previews", () => {
  it("10129:A:1 says the Garrison's Threat as the table reads it, growing with each shadow card dealt to it", () => {
    const t = at({ staging: ["10129"] });
    expect(detail(t, t.state, "10129")).toBe("Threat 1 now: 1 printed and 1 more for each shadow card dealt to it, 0 shadow cards now. Its Threat counts in the staging area.");
    const more = dealt(t, t.state, "10129", 2);
    const settled = settle({ ...more, window: null, mode: "stopped" }, t.ctx, []);
    expect(detail(t, settled, "10129")).toBe("Threat 3 now: 1 printed and 1 more for each shadow card dealt to it, 2 shadow cards now. Its Threat counts in the staging area.");
    // Engaged, it is no longer in the staging area: the line does not say its Threat counts there.
    const engaged = at({ engaged: ["10129"] });
    expect(detail(engaged, engaged.state, "10129")).toBe("Threat 1 now: 1 printed and 1 more for each shadow card dealt to it, 0 shadow cards now.");
  });

  it("10139:A:3 says Furious Charge's quest points as the engine reads them and where its 10 progress goes", () => {
    const t = at({ staging: [{ code: "10139", progress: 4 }] });
    expect(detail(t, t.state, "10139")).toBe(`4 of 30 progress. When progress is placed on it each character gets -2 Defense until the end of the round, and Thaurdir flips if he is Captain side faceup. Defeated, it adds ${FURIOUS_CHARGE_PROGRESS} progress to the main quest, The Clutches of Carn Dûm: the active location takes its share first, unless another side quest is the current quest.`);
    const raised = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: idOf(t.state, "10139"), sourceId: "t", stat: "questPoints" as const, amount: 5, until: "endOfRound" as const }] };
    expect(detail(t, raised, "10139")).toContain("4 of 35 progress.");
  });

  it("10127:A:4 says Thaurdir's side, shadow cards and damage in his preview, and names the burden he carries across a flip", () => {
    const t = at({ staging: [{ code: CAPTAIN, damage: 2 }], attached: [{ code: "10168", to: CAPTAIN }] });
    expect(detail(t, t.state, CAPTAIN)).toBe("Captain side faceup: 0 shadow cards dealt to him, 2 of 9 hit points of damage. He cannot take damage on this stage. At 3 he flips to his Champion side. Carrying Thaurdir's Legacy, which stays on him when he flips.");
    const flipped = runInstruction(t.state, { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(detail(t, flipped, CHAMPION)).toContain("Champion side faceup: ");
    expect(detail(t, flipped, CHAMPION)).toContain("Carrying Thaurdir's Legacy");
    const staging = zoneSelector("staging", 0)(flipped).entries.find((one) => one.card.id === idOf(flipped, CHAMPION));
    expect(staging?.attached.map((card) => card.id)).toContain(idOf(flipped, "10168"));
    const stage2 = at({ stage: STAGE2, staging: [CHAMPION] });
    expect(detail(stage2, stage2.state, CHAMPION)).not.toContain("flips to his");
    // Stage 2B: Indestructible until 15 progress, and he attacks each player; no flip at a count of shadow cards.
    expect(detail(stage2, stage2.state, CHAMPION)).toBe("Champion side faceup: 0 shadow cards dealt to him, 0 of 9 hit points of damage. He is Indestructible until Midwinter's Crux holds 15 progress. Engaged with each player: he attacks each player in turn in the combat phase, and any player's characters can attack him.");
    const lapsed = at({ stage: STAGE2, staging: [CHAMPION], progress: 15 });
    expect(detail(lapsed, lapsed.state, CHAMPION)).toContain("He has lost Indestructible: damage can destroy him.");
    // Holding 3 or more on stage 1B: more cards do not flip him.
    const held = dealt(t, t.state, CAPTAIN, 4);
    expect(detail(t, held, CAPTAIN)).toContain("Holding 4, more shadow cards do not flip him until these are discarded.");
    expect(detail(t, held, CAPTAIN)).not.toContain("At 3 he flips");
  });

  it("10191:A:2 draws a boon on its hero as any attachment is", () => {
    const t = at({ play: [], attached: [{ code: "10191", to: "dh1" }] });
    const hero = zoneSelector("play", 0)(t.state).entries.find((one) => one.card.id === idOf(t.state, "dh1"));
    expect(hero?.attached.map((card) => card.id)).toContain(idOf(t.state, "10191"));
  });
});

describe("a pick each player makes from their own pile names its owner", () => {
  it("10190:A:1 leads Lore of Ancient Arnor's pick with the player two-handed, and each row is a card of that player's own discard pile", () => {
    const t = at({ seats: 2, deckOf: [{ code: "c1", seat: 0 }, { code: "c2", seat: 0 }, { code: "c3", seat: 1 }], hand: [] });
    let state: ScenarioState = t.state;
    for (const seat of [0, 1]) for (const id of [...state.seats[seat]!.deck]) state = moveCard(state, id, { zone: "discard", seat });
    const effects = t.ctx.effects.filter((effect) => effect.cardCode === "10190" && effect.timing === "action");
    const lore = spawn(state, "10190", { zone: "play", seat: 0 });
    const asked = settle(pushCardEffects({ ...lore.state, window: null, mode: "stopped" }, "forced", lore.id, 0, false, effects, t.ctx, []), t.ctx, []);
    const names: SheetNames = { card: (id) => asked.cards[id]?.code ?? id, line: () => null };
    const sheet = sheetFor(asked, t.ctx, legalIntents(asked, t.ctx), names) as PickSheet | null;
    expect(asked.window?.kind, JSON.stringify(sheet)).toBe("choose");
    expect(sheet?.options.map((option) => option.label).sort()).toEqual(["c1", "c2"]);
    expect(JSON.stringify(sheet)).toContain("Player 1");
    expect(JSON.stringify(sheet)).toContain("Lore of Ancient Arnor");
  });
});
