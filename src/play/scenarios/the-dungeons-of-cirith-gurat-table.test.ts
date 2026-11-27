// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.blank (data/rules/entries.json); ledger lines 17119:A:1, 17120:A:1, 17131:A:1, 17132:A:1, 17134:A:1 (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Table).
// What the table says of The Dungeons of Cirith Gurat's pieces: the allies, Abaan and heroes an enemy, a location or the side quest Captured! holds, drawn under it in every zone it can be in, named, with the owner shown, and the dial of the seat that lost one.
// The engine decided each fact; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import type { Instruction } from "../../catalog/boundary.ts";
import { updateCard } from "../../rules/core/state.ts";
import { idOf, legalIntents, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { settle } from "../../rules/engine/machine.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";

import { previewCards } from "../cards/table-preview.ts";
import { heldDials } from "../readouts/widgets.ts";
import { capturedHands, heldCharactersUnder, heldSeatChip } from "../readouts/haradrim/captured.ts";
import { deepestUnder, HELD_STRIP, placeUnder } from "../layout/slots.ts";
import type { CardSlot } from "../layout/layout.ts";
import { zoneSelector } from "../store/selectors.ts";
import { discardValues, pickedValues, whoseWords } from "../words/asks-held.ts";
import { asksOption } from "../words/asks.ts";
import { ASKS } from "../words/asks/the-dungeons-of-cirith-gurat.ts";
import { effectById } from "../../rules/windows/listen.ts";
import { walk } from "../../../test/harness/record-walk.ts";
import { attachedWords } from "../words/scenarios/haradrim/capture.ts";

const ABAAN = "17120";
const CELL = "17125";
const JAILER = "17121";
const CAPTURED = "17131";
const GANDALF = "01073";
const withdrawn = (t: ReturnType<typeof at>) => ({ ...t, state: updateCard(t.state, idOf(t.state, ABAAN), { owner: undefined }) });
const at = (layout: Layout = {}) => tableFromLayout("the-dungeons-of-cirith-gurat", { phase: "Quest", stage: "17132", seats: 2, ...layout }, { extra: [GANDALF] });
// Setup attaches Abaan from the set-aside cards, so he has no owner; the kit spawns him in a play area, so the test clears it.
const held = () => withdrawn(at({ staging: [CELL, CAPTURED], engaged: [JAILER], play: [ABAAN, GANDALF], captive: [{ hero: ABAAN, under: CELL }, { hero: GANDALF, under: CAPTURED }], staged: [{ hero: "dh1", under: JAILER }] }));
const name = (t: ReturnType<typeof at>) => (id: string) => t.ctx.cards.get(t.state.cards[id]?.code ?? id)?.name ?? id;
const preview = (t: ReturnType<typeof at>, code: string) => JSON.stringify(previewCards(t.state, t.ctx, idOf(t.state, code), (one) => ({ name: t.ctx.cards.get(one)?.name ?? one, source: null, text: "" }), name(t)));

describe("the characters an encounter card holds", () => {
  it("17119:A:1 draws Abaan under Dungeon Cell and the ally under Captured!, in the staging area, each faceup", () => {
    const t = held();
    const entries = zoneSelector("staging", 0)(t.state).entries;
    expect(entries.find((entry) => entry.card.code === CELL)?.attached.map((card) => card.code)).toEqual([ABAAN]);
    expect(entries.find((entry) => entry.card.code === CAPTURED)?.attached.map((card) => card.code)).toEqual([GANDALF]);
    expect(entries.some((entry) => entry.card.code === ABAAN || entry.card.code === GANDALF)).toBe(false);
  });

  it("17119:A:1 gives a held character a strip 2.6 peeks tall, counted in the row's depth, with its owner's chip and none for Abaan", () => {
    const t = held();
    const entries = zoneSelector("staging", 0)(t.state).entries;
    const cell = entries.find((entry) => entry.card.code === CELL);
    const captured = entries.find((entry) => entry.card.code === CAPTURED);
    const out: CardSlot[] = [];
    placeUnder(captured!, "staging", { x: 0, y: 0, w: 50, h: 70 }, out, [], 10);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "attachment", strip: HELD_STRIP, y: HELD_STRIP * 10 });
    expect(deepestUnder([cell!, captured!])).toBe(HELD_STRIP);
    expect(heldSeatChip(t.state, idOf(t.state, GANDALF))).toEqual({ chip: "P1", speech: "Player 1's ally" });
    expect(heldSeatChip(t.state, idOf(t.state, ABAAN))).toBeNull();
    const solo = at({ seats: 1, staging: [CAPTURED], play: [GANDALF], captive: [{ hero: GANDALF, under: CAPTURED }] });
    expect(solo.state.cards[idOf(solo.state, GANDALF)]?.owner).toBe(0);
    expect(heldSeatChip(solo.state, idOf(solo.state, GANDALF))).toBeNull();
  });

  it("17119:A:1 draws the hero an engaged enemy holds under it, in the engagement area", () => {
    const t = held();
    const jailer = zoneSelector("engaged", 0)(t.state).entries.find((entry) => entry.card.code === JAILER);
    expect(jailer?.attached.map((card) => card.code)).toEqual(["dh1"]);
  });

  it("17119:A:1 draws what the active location holds under it too (Dungeon Cell travelled to)", () => {
    const t = at({ active: CELL, play: [ABAAN], captive: [{ hero: ABAAN, under: CELL }] });
    const cell = zoneSelector("activeLocation", 0)(t.state).entries.find((entry) => entry.card.code === CELL);
    expect(cell?.attached.map((card) => card.code)).toEqual([ABAAN]);
  });

  it("17119:A:1 lists a held ally and Abaan after their host in its preview, not a held hero", () => {
    const t = held();
    expect(heldCharactersUnder(t.state, idOf(t.state, CELL))).toEqual([idOf(t.state, ABAAN)]);
    expect(heldCharactersUnder(t.state, idOf(t.state, JAILER))).toEqual([]);
    expect(preview(t, CELL)).toContain("Holds Abaan. The first player (Player 1) gains control of Abaan when Dungeon Cell leaves play.");
    expect(preview(t, CAPTURED)).toContain("Holds Gandalf (Player 1's ally). Gandalf returns to its owner, exhausted, when Captured! leaves play.");
  });

  it("17131:A:1 names the owner of a held ally in its preview, its holder, and that it returns exhausted", () => {
    const t = held();
    const text = preview(t, GANDALF);
    expect(text).toContain("Player 1's ally, held by Captured!. No player controls it, its text box is blank and it is a guarded objective. It returns to its owner, exhausted, when Captured! leaves play.");
    expect(text).toContain("Captured ally");
  });

  it("17131:A:1 names the held ally and its owner in its holder's preview, and says alone \"Your ally\" and \"You gain\"", () => {
    const t = held();
    expect(preview(t, CAPTURED)).toContain("Holds Gandalf (Player 1's ally). Gandalf returns to its owner, exhausted, when Captured! leaves play.");
    const solo = withdrawn(at({ seats: 1, staging: [CELL, CAPTURED], play: [ABAAN, GANDALF], captive: [{ hero: ABAAN, under: CELL }, { hero: GANDALF, under: CAPTURED }] }));
    expect(preview(solo, CAPTURED)).toContain("Holds Gandalf (your ally).");
    expect(preview(solo, GANDALF)).toContain("Your ally, held by Captured!.");
    expect(preview(solo, CELL)).toContain("You gain control of Abaan when Dungeon Cell leaves play.");
  });

  it("17120:A:1 says in Abaan's preview who holds him, that the first player gains him and that the players lose if he leaves play", () => {
    const t = held();
    const text = preview(t, ABAAN);
    expect(text).toContain("Held by Dungeon Cell, a guarded objective with a blank text box. The first player (Player 1) gains control of him when Dungeon Cell leaves play. If he leaves play, the players lose the game.");
    expect(text).toContain("Captured objective");
  });

  it("17134:A:1 says of a captured hero that its guard holds it and it returns exhausted, as of any guarded hero", () => {
    const t = held();
    expect(preview(t, "dh1")).toContain("guarded by Jailer of Cirith Gurat");
    expect(preview(t, "dh1")).toContain("Guarded hero");
  });

  it("17121:A:1 says in the dial of the seat that lost an ally which card holds it, and names no Captive of the Uruk-hai", () => {
    const t = held();
    const dials = heldDials(t.state, (code) => t.ctx.cards.get(code)?.name ?? code, () => false);
    const words = dials.find((dial) => dial.seat === 0)?.words ?? "";
    expect(words).toContain("Gandalf is captured by Captured!");
    expect(words).toContain("dh1 is guarded by Jailer of Cirith Gurat");
    expect(words).not.toContain("Captive");
    // A seat that holds an ally and a hero wears the mark of the one whose words come last, not of the first it found.
    const mark = dials.find((dial) => dial.seat === 0)?.mark;
    expect(mark).toBe(words.endsWith("Gandalf is captured by Captured!") ? "ally" : "hero");
    expect(words.indexOf("Gandalf")).not.toBe(words.indexOf("dh1"));
  });

  it("17121:A:1 gives the dial of a seat that lost only an ally the ally mark, with the words it says, and a held hero the hero mark", () => {
    const ally = at({ staging: [CAPTURED], play: [GANDALF], captive: [{ hero: GANDALF, under: CAPTURED }] });
    const cardName = (code: string) => ally.ctx.cards.get(code)?.name ?? code;
    expect(heldDials(ally.state, cardName, () => false)).toEqual([{ seat: 0, words: "Gandalf is captured by Captured!", mark: "ally" }]);
    const hero = at({ stage: "17134", side: "A", staging: [JAILER], staged: [{ hero: "dh1", under: JAILER }] });
    expect(heldDials(hero.state, (code) => hero.ctx.cards.get(code)?.name ?? code, () => false).map((dial) => dial.mark)).toEqual(["hero"]);
  });

  it("17120:A:3 marks the dial of the seat that controls a freed Abaan, as Derufin's is, two-handed and alone", () => {
    const two = at({ stage: "17133", staging: ["17119"], play: [ABAAN] });
    expect(capturedHands(at({ stage: "17133", play: [ABAAN] }).state), "without The Captives of Cirith Gurat in play").toEqual([]);
    expect(capturedHands(two.state)).toEqual([{ seat: 0, label: "P1 · Abaan", note: "Abaan: if he leaves play the players lose the game." }]);
    expect(capturedHands(at({ seats: 1, stage: "17133", staging: ["17119"], play: [ABAAN] }).state).map((mark) => mark.label)).toEqual(["Abaan"]);
    expect(capturedHands(held().state)).toEqual([]);
  });

  it("17119:A:1 draws and says nothing in a game that holds no character", () => {
    const t = at({ staging: [CELL] });
    expect(zoneSelector("staging", 0)(t.state).entries[0]?.attached).toEqual([]);
    expect(preview(t, CELL)).not.toContain("Holds");
  });
});

describe("Captured! as a side quest", () => {
  it("17131:A:1 lies in the staging area as a side quest, which holds the ally attached to it", () => {
    const t = held();
    expect(t.state.cards[idOf(t.state, CAPTURED)]?.zone).toBe("staging");
    expect(t.state.sideQuests).toBe(true);
  });
});

describe("the words of the choices that capture and discard", () => {
  const names = (t: ReturnType<typeof at>) => ({ card: name(t), code: (code: string) => t.ctx.cards.get(code)?.name ?? code });
  const wanted = () => true;

  it("17124:A:2 names the card just discarded and its Threat (none printed: no Threat) for the cost the first player pays", () => {
    const t = at({ staging: [CAPTURED, "16062"] });
    const top = (code: string) => ({ ...t.state, encounterDiscard: [idOf(t.state, code)] });
    expect(discardValues(top(CAPTURED), t.ctx, names(t), wanted, 0)).toMatchObject({ threat: 0, discarded: "Captured! has no Threat" });
    const enemy = discardValues(top("16062"), t.ctx, names(t), wanted, 0);
    expect(enemy.threat).toBe(t.ctx.cards.get("16062")?.threat);
    expect(String(enemy.discarded)).toMatch(/^Uruk of Mordor has Threat \d+$/);
  });

  it("17124:A:2 names each living player the raise of 3 takes to the elimination level", () => {
    const t = at({ threat: [48, 30] });
    expect(discardValues(t.state, t.ctx, names(t), wanted, 3).eliminated).toBe("Player 1");
    const both = at({ threat: [48, 49] });
    expect(discardValues(both.state, both.ctx, names(both), wanted, 3).eliminated).toBe("Player 1 and Player 2");
    const solo = at({ seats: 1, threat: [48, 0] });
    expect(discardValues(solo.state, solo.ctx, names(solo), wanted, 3).eliminated).toBe("you");
    expect(discardValues(t.state, t.ctx, names(t), wanted, 0).eliminated).toBe("nobody");
  });

  it("17124:A:2 warns of the elimination only for a seat the raise of 3 takes to its own level, with the names the same reader gives", () => {
    const gate = (layout: Layout) => {
      const t = at(layout);
      let choose: Instruction | undefined;
      walk(effectById(t.ctx, "17124:travel:1")!.instructions, (instruction, _next, _after, path) => {
        if (path === "2" && instruction.verb === "Choose") choose = instruction;
      });
      return asksOption({ game: t.state, ctx: t.ctx, names: names(t), instruction: choose!, source: idOf(t.state, "17124"), effectId: "17124:travel:1", options: [] }, "threat", ASKS)?.caution;
    };
    expect(gate({ staging: ["17124"], threat: [30, 28] })).toBeUndefined();
    expect(gate({ staging: ["17124"], threat: [46, 28] })).toBeUndefined();
    expect(gate({ staging: ["17124"], threat: [47, 28] })).toBe("Tap again: this takes the threat of Player 1 to the elimination level and eliminates them. If no player is left, the game is lost");
    expect(gate({ staging: ["17124"], threat: [47, 47] })).toContain("of Player 1 and Player 2 to");
    expect(gate({ staging: ["17124"], seats: 1, threat: [47, 0] })).toContain("of you to");
    // A level lowered by 5 (45): 43 plus 3 eliminates there, and 41 plus 3 does not.
    expect(gate({ staging: ["17124"], threat: [43, 28], eliminationReduction: 5 })).toContain("of Player 1 to");
    expect(gate({ staging: ["17124"], threat: [41, 28], eliminationReduction: 5 })).toBeUndefined();
  });

  it("17131:A:1 says whose a picked ally is and what it costs, two-handed and alone", () => {
    const t = at({ play: [GANDALF] });
    const gandalf = idOf(t.state, GANDALF);
    expect(whoseWords(t.state, gandalf, 0)).toBe("Player 1's");
    expect(pickedValues(t.state, t.ctx, gandalf, 0)).toEqual({ whose: "Player 1's", pickedCost: t.ctx.cards.get(GANDALF)?.cost ?? 0 });
    const solo = at({ seats: 1, play: [GANDALF] });
    expect(whoseWords(solo.state, idOf(solo.state, GANDALF), 0)).toBe("your");
  });
});

describe("the Setup's search for an Orc enemy", () => {
  it("17132:A:1 shows each enemy it offers with its Threat and engagement cost", () => {
    const t = at({ seats: 1, stage: "17132", side: "A", staging: ["17119", CELL], setAside: [ABAAN, "16061"], deck: ["16062", "16063", "f0"], deckOf: [GANDALF, "f0"] });
    const effects = t.ctx.effects.filter((effect) => effect.cardCode === "17132" && effect.timing === "setup");
    const pushed = pushCardEffects(t.state, "setup", idOf(t.state, "17132"), 0, false, effects, t.ctx, []);
    let state = settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
    // Dungeon Cell is the only card to hold Abaan: the first pick (if one opens) takes it; the search for an Orc enemy is the pick that follows.
    for (let guard = 0; guard < 3 && state.window?.kind === "choose" && !state.window.options.some((id) => state.cards[id]?.code === "16062"); guard += 1) {
      state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, t.ctx)).state;
    }
    const run = { state };
    const names: SheetNames = { card: name({ ...t, state }), line: () => null };
    const sheet = sheetFor(run.state, t.ctx, legalIntents(run.state, t.ctx), names) as PickSheet;
    expect(sheet.options.length).toBeGreaterThan(1);
    for (const option of sheet.options) {
      const printed = t.ctx.cards.get(run.state.cards[option.id]?.code ?? "");
      expect(option.stats, option.label).toEqual([{ icon: "threat", value: printed?.threat, word: "Threat" }, { icon: "engagementCost", value: printed?.engagementCost, word: "Engagement cost" }]);
    }
  });
});

describe("the banner and the log of a capture, a rescue and the freeing of Abaan", () => {
  const say = (event: "captured" | "rescued" | "free", seat: number | null, seats: number) => attachedWords({ kind: "captive", event, cardId: "ally", hostId: "host", seat }, (id) => (id === "ally" ? "Guard of the Citadel" : "Jailer of Cirith Gurat"), seats);

  it("17121:A:1 names the character and its holder when it is captured", () => {
    expect(say("captured", null, 2)).toBe("Guard of the Citadel is captured by Jailer of Cirith Gurat.");
  });

  it("17119:A:3 names who takes control of a rescued character, exhausted, and says Abaan is free", () => {
    expect(say("rescued", 0, 2)).toBe("Guard of the Citadel is rescued: Player 1 takes control of it, exhausted.");
    expect(say("rescued", 0, 1)).toBe("Guard of the Citadel is rescued: You take control of it, exhausted.");
    expect(say("rescued", null, 2)).toBe("Guard of the Citadel is rescued: its owner has left the game, so it goes to the discard pile.");
    expect(say("free", 0, 2)).toBe("Guard of the Citadel is free: Player 1 takes control of him.");
  });
});
