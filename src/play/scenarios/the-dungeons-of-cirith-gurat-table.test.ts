// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.blank (data/rules/entries.json); ledger lines 17119:A:1, 17120:A:1, 17131:A:1, 17132:A:1, 17134:A:1 (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Table).
// What the table says of The Dungeons of Cirith Gurat's pieces: the allies, Abaan and heroes an enemy, a location or the side quest Captured! holds, drawn under it in every zone it can be in, named, with the owner shown, and the dial of the seat that lost one.
// The engine decided each fact; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { previewCards } from "../cards/table-preview.ts";
import { heldDials } from "../readouts/widgets.ts";
import { heldCharactersUnder } from "../readouts/haradrim/captured.ts";
import { zoneSelector } from "../store/selectors.ts";

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
    expect(preview(t, CELL)).toContain("Holds Abaan. The first player gains control of Abaan when Dungeon Cell leaves play.");
    expect(preview(t, CAPTURED)).toContain("Holds Gandalf. Gandalf returns to its owner, exhausted, when Captured! leaves play.");
  });

  it("17131:A:1 names the owner of a held ally in its preview, its holder, and that it returns exhausted", () => {
    const t = held();
    const text = preview(t, GANDALF);
    expect(text).toContain("Player 1's ally, held by Captured!. No player controls it, its text box is blank and it is a guarded objective. It returns to its owner, exhausted, when Captured! leaves play.");
    expect(text).toContain("Captured ally");
  });

  it("17120:A:1 says in Abaan's preview who holds him, that the first player gains him and that the players lose if he leaves play", () => {
    const t = held();
    const text = preview(t, ABAAN);
    expect(text).toContain("Held by Dungeon Cell, a guarded objective with a blank text box. The first player gains control of him when Dungeon Cell leaves play. If he leaves play, the players lose the game.");
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
