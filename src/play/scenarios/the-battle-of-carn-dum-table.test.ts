// Rules: mec108.thaurdir, mec108.indestructible, mec108.side-quests-in-play, rr.active-location, rr.attachment-cards, rr.first-player (data/rules/entries.json); ledger lines 10125:B:1, 10125:B:3, 10126:B:1, 10126:B:2, 10127:A:4, 10129:A:1, 10139:A:3, 10190:A:1, 10191:A:2.
// What the table says of The Battle of Carn Dûm's pieces: Thaurdir's side and the shadow cards dealt to him against the 3 that flip him on stage 1B (a plain count: a flip is neither good nor bad), stage 2B's progress against the 15 that take his Indestructible away (a goal), the
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
  it("10125:B:3 counts the shadow cards dealt to him against the 3 that flip him on stage 1B, a plain count that never warms, goes critical or warns", () => {
    const t = at({ staging: [CAPTAIN] });
    expect(dial(t, "angmar-side")).toMatchObject({ label: "Captain", value: 0, limit: THAURDIR_FLIP_SHADOWS, limitWords: "3 flip him", name: "Shadow cards dealt to Thaurdir, Captain side faceup:" });
    for (const count of [0, 1, 2]) {
      const shown = dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, count));
      expect(shown?.value).toBe(count);
      expect(shown?.warn).toBeUndefined();
      expect(shown?.goal).toBeUndefined();
      expect(shown && dialProps(shown).elimination).toBe(false);
    }
    expect(dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, 2))?.note).toBe("Captain side faceup, 2 shadow cards dealt to him. At 3 he flips to his Champion side.");
    expect(dial(t, "angmar-side", dealt(t, t.state, CAPTAIN, 1))?.note).toContain("1 shadow card dealt to him.");
  });

  it("10125:B:1 words the Champion side with the flip at 3 and the flip back at the end of the round, and the dial names the side he shows", () => {
    const t = at({ staging: [CHAMPION] });
    expect(dial(t, "angmar-side")).toMatchObject({ label: "Champion", name: "Shadow cards dealt to Thaurdir, Champion side faceup:" });
    expect(dial(t, "angmar-side")?.note).toBe("Champion side faceup, 0 shadow cards dealt to him. At 3 he flips to his Captain side, and at the end of the round he flips to Captain.");
  });

  it("10125:B:3 follows a flip: the dial shows the side he flips to, the count kept", () => {
    const t = at({ staging: [CAPTAIN] });
    const held = dealt(t, t.state, CAPTAIN, 3);
    const settled = settle({ ...held, window: null, mode: "stopped" }, t.ctx, []);
    // The Champion side attacks at once and is dealt a shadow card for the attack: the count is kept and grows.
    expect(dial(t, "angmar-side", settled)?.label).toBe("Champion");
    expect(dial(t, "angmar-side", settled)?.value).toBeGreaterThanOrEqual(3);
  });

  it("10126:B:1 has no limit on stage 2B, where shadow cards no longer flip him, and says when he flips", () => {
    const t = at({ stage: STAGE2, staging: [CAPTAIN] });
    const shown = dial(t, "angmar-side");
    expect(shown?.limit).toBeUndefined();
    expect(shown?.note).toBe("Captain side faceup, 0 shadow cards dealt to him. At the end of the round he flips to his Champion side. Each attack he makes is dealt a shadow card of its own.");
    expect(thaurdirDialWords("Champion", 1, null)).toContain("He stays Champion side faceup until an effect flips him.");
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
    expect(cruxWords(15, CRUX_PROGRESS, "Midwinter's Crux")).toBe("15 progress on Midwinter's Crux: Thaurdir has lost Indestructible. Damage that destroys him wins the game, and the stage cannot be defeated while he is in play.");
    const record = AUTHORED_EFFECTS.find((effect) => effect.id === "10126:constant:2");
    expect(JSON.stringify(record?.condition)).toBe(JSON.stringify({ kind: "stageProgress", min: CRUX_PROGRESS }));
  });
});

describe("the Garrison, Furious Charge and Thaurdir's previews", () => {
  it("10129:A:1 says the Garrison's Threat as the table reads it, growing with each shadow card dealt to it", () => {
    const t = at({ staging: ["10129"] });
    expect(detail(t, t.state, "10129")).toBe("Threat 1: 1 printed and 1 more for each shadow card dealt to it, 0 shadow cards now. Its Threat counts in the staging area.");
    const more = dealt(t, t.state, "10129", 2);
    const settled = settle({ ...more, window: null, mode: "stopped" }, t.ctx, []);
    expect(detail(t, settled, "10129")).toBe("Threat 3: 1 printed and 1 more for each shadow card dealt to it, 2 shadow cards now. Its Threat counts in the staging area.");
  });

  it("10139:A:3 says Furious Charge's quest points as the engine reads them and where its 10 progress goes", () => {
    const t = at({ staging: [{ code: "10139", progress: 4 }] });
    expect(detail(t, t.state, "10139")).toBe(`4 of 30 progress. When progress is placed on it each character gets -2 Defense until the end of the round, and a Captain Thaurdir flips. Defeated, it adds ${FURIOUS_CHARGE_PROGRESS} progress to the main quest, The Clutches of Carn Dûm: the active location takes none of it while another side quest is the current quest.`);
    const raised = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: idOf(t.state, "10139"), sourceId: "t", stat: "questPoints" as const, amount: 5, until: "endOfRound" as const }] };
    expect(detail(t, raised, "10139")).toContain("4 of 35 progress.");
  });

  it("10127:A:4 says Thaurdir's side, shadow cards and damage in his preview, and names the burden he carries across a flip", () => {
    const t = at({ staging: [{ code: CAPTAIN, damage: 2 }], attached: [{ code: "10168", to: CAPTAIN }] });
    expect(detail(t, t.state, CAPTAIN)).toBe("Captain side faceup: 0 shadow cards dealt to him, 2 of 9 hit points of damage. At 3 he flips to his Champion side. Carrying Thaurdir's Legacy, which stays on him when he flips.");
    const flipped = runInstruction(t.state, { verb: "FlipTwoSided", front: CAPTAIN, back: CHAMPION }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(detail(t, flipped, CHAMPION)).toContain("Champion side faceup: ");
    expect(detail(t, flipped, CHAMPION)).toContain("Carrying Thaurdir's Legacy");
    const staging = zoneSelector("staging", 0)(flipped).entries.find((one) => one.card.id === idOf(flipped, CHAMPION));
    expect(staging?.attached.map((card) => card.id)).toContain(idOf(flipped, "10168"));
    const stage2 = at({ stage: STAGE2, staging: [CHAMPION] });
    expect(detail(stage2, stage2.state, CHAMPION)).not.toContain("flips to his");
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
