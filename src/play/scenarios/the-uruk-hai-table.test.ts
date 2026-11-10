// Rules: mec112.pursuit, rr.player-elimination, rr.first-player (data/rules/entries.json); ledger lines 143022:A:2, 143024:A:1, 143025:A:2, 143029:A:2, 143030:A:1, 143063:A:2, 143069:A:1. What the table says of The Uruk-hai's pieces: the pursuit dial, the Captives under
// To Isengard! and the enemy that holds one, the dial of each seat that has a Captive, and the choices that name the pursuit value. The engine decided each; nothing here changes one.
import { describe, expect, it } from "vitest";

import { fightEnemy, idOf, revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { scenarioDefinition } from "../../catalog/scenario-data.ts";
import { holdCaptive } from "../../rules/families/captives/index.ts";
import { captivesOf } from "../../rules/families/captives/values.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { updateCard } from "../../rules/core/state.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";

import { cardEffects, slotNumbers } from "../cards/card-effects.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { captiveLabel } from "../choice/sheet-parts.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { threatLevel, threatMeter } from "../readouts/threat-level.ts";
import { heldDials, pursuitReadout } from "../readouts/widgets.ts";
import { zoneSelector } from "../store/selectors.ts";

const PURSUING = { staging: ["143022", "143024"], pursuit: 10, captive: { hero: "dh2", under: "143022" } } as const;
const two = () => tableFromLayout("the-uruk-hai", { ...PURSUING, seats: 2 }, {});
const namesOf = (state: ReturnType<typeof two>["state"], cards: ReturnType<typeof two>["cards"]): SheetNames => ({ card: (id) => cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });
const isEnemy = (cards: ReturnType<typeof two>["cards"]) => (code: string) => cards.get(code)?.type === "enemy";

describe("the pursuit dial", () => {
  it("is declared by the scenario's definition with the value at which the players lose, and a scenario with no tracker declares none", () => {
    const made = two();
    expect(made.definition.widgets.pursuitTracker).toBe(30);
    const scenario = loadScenario("the-oath");
    expect(scenarioDefinition(scenario, loadCampaign(), []).widgets).not.toHaveProperty("pursuitTracker");
  });

  it("reads the pursuit value the engine holds, and is none before the Setup sets it or for a scenario that declares no tracker", () => {
    const made = two();
    expect(pursuitReadout(made.state)).toEqual({ value: 10, limit: 30 });
    expect(pursuitReadout({ ...made.state, pursuit: 27 })).toEqual({ value: 27, limit: 30 });
    expect(pursuitReadout({ ...made.state, pursuit: undefined })).toBeNull();
    expect(pursuitReadout({ ...made.state, widgets: { ...made.state.widgets, pursuitTracker: undefined } })).toBeNull();
  });

  it("warms toward 30 as the threat dial warms toward 50: its meter fills against the limit, near from 24 and critical from 27", () => {
    expect(threatMeter(15, 30)).toBe(0.5);
    expect(threatMeter(45, 30)).toBe(1);
    expect(threatLevel(23, 30)).toBe("calm");
    expect(threatLevel(24, 30)).toBe("near");
    expect(threatLevel(27, 30)).toBe("critical");
    // The threat dial is as it was.
    expect(threatLevel(39)).toBe("calm");
    expect(threatLevel(40)).toBe("near");
    expect(threatLevel(45)).toBe("critical");
    expect(threatMeter(25)).toBe(0.5);
  });
});

describe("the Captives on the table", () => {
  it("every Captive lies under its host in the host's entry, To Isengard! holding both and Grishnákh, engaged, the one he holds", () => {
    const made = two();
    const isengard = idOf(made.state, "143022");
    const grishnakh = idOf(made.state, "143024");
    const seat1 = made.seat1Hero ?? "";
    const both = holdCaptive(made.state, seat1, isengard);
    const staging = zoneSelector("staging", 0)(both).entries.find((entry) => entry.card.id === isengard);
    expect(staging?.attached.map((card) => card.id).sort()).toEqual(captivesOf(both).map((card) => card.id).sort());
    expect(staging?.attached).toHaveLength(2);
    // Grishnákh holds the second seat's hero and is engaged with the first player: the Captive stays drawn under him there.
    const held = holdCaptive(both, seat1, grishnakh);
    const engaged = updateCard(moveCard(held, grishnakh, { zone: "engaged", seat: 0 }), grishnakh, {});
    expect(zoneSelector("engaged", 0)(engaged).entries.find((entry) => entry.card.id === grishnakh)?.attached.map((card) => card.id)).toEqual([seat1]);
    expect(zoneSelector("staging", 0)(engaged).entries.find((entry) => entry.card.id === isengard)?.attached.map((card) => card.id)).toEqual([idOf(made.state, "dh2")]);
    // The host's pill counts them: "2 held" under To Isengard!, "1 held" under Grishnákh.
    expect(slotNumbers(both, made.ctx, isengard).under?.text).toBe("2 held");
    expect(slotNumbers(engaged, made.ctx, grishnakh).under).toMatchObject({ text: "1 held" });
    expect(cardEffects(both, made.ctx, isengard)).toBeDefined();
  });

  it("each seat that has a Captive wears a held dial saying whose it is and where it lies", () => {
    const made = two();
    const seat1 = made.seat1Hero ?? "";
    const names = (code: string) => made.cards.get(code)?.name ?? code;
    const both = holdCaptive(made.state, seat1, idOf(made.state, "143024"));
    const dials = heldDials(both, names, isEnemy(made.cards));
    expect(dials.map((dial) => dial.seat)).toEqual([0, 1]);
    expect(dials[0]?.words).toBe(`${names("dh2")} is a Captive under To Isengard!`);
    expect(dials[1]?.words).toBe(`${names(both.cards[seat1]?.code ?? "")} is a Captive held by Grishnákh`);
    expect(dials.every((dial) => dial.mark === "hero")).toBe(true);
    expect(heldDials(made.state, names, isEnemy(made.cards)).map((dial) => dial.seat)).toEqual([0]);
  });

  it("Grishnákh's pick names the owner of each Captive when the options hold more than one seat's, and the note leads with the player in lower case", () => {
    const made = two();
    const seat1 = made.seat1Hero ?? "";
    const both = holdCaptive(made.state, seat1, idOf(made.state, "143022"));
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(both, made.ctx, "143024", steps);
    const window = revealed.state.window;
    expect(window?.kind).toBe("choose");
    const sheet = sheetFor(revealed.state, made.ctx, legalIntents(revealed.state, made.ctx), namesOf(revealed.state, made.cards)) as PickSheet;
    expect(sheet.options.map((option) => option.label)).toEqual([`${made.cards.get("dh2")?.name} · Captive · 0 of 6 damage · Player 1`, `${made.cards.get(both.cards[seat1]?.code ?? "")?.name} · Captive · 0 of 6 damage · Player 2`]);
    expect(sheet.note).toContain("choose 1 Captive for Grishnákh to hold");
    expect(sheet.note?.startsWith("Player 1: choose")).toBe(true);
    // The damage on a Captive is against its hit points.
    const hurt = updateCard(both, idOf(both, "dh2"), { damage: 2 });
    const hurtReveal = revealFromTop(hurt, made.ctx, "143024", []);
    const hurtSheet = sheetFor(hurtReveal.state, made.ctx, legalIntents(hurtReveal.state, made.ctx), namesOf(hurtReveal.state, made.cards)) as PickSheet;
    expect(hurtSheet.options[0]?.label).toBe("dh2 · Captive · 2 of 6 damage · Player 1");
    // One seat's Captives only: no owner is added.
    const mine = tableFromLayout("the-uruk-hai", { ...PURSUING, seats: 2 }, {});
    const twice = holdCaptive(mine.state, mine.hero, idOf(mine.state, "143022"));
    const own = revealFromTop(twice, mine.ctx, "143024", []);
    const ownSheet = sheetFor(own.state, mine.ctx, legalIntents(own.state, mine.ctx), namesOf(own.state, mine.cards));
    expect(ownSheet?.kind === "pick" ? ownSheet.options.map((option) => option.label) : []).toEqual([`${made.cards.get("dh1")?.name} · Captive · 0 of 6 damage`, `${made.cards.get("dh2")?.name} · Captive · 0 of 6 damage`]);
  });

  it("a pick that mixes a Captive with a hero the player controls (Hands of a Healer, 143016:A:3) reads the Captive as one and the hero as a plain row", () => {
    const made = two();
    const captive = idOf(made.state, "dh2");
    const hero = idOf(made.state, "dh1");
    const labels = [captive, hero].map((id) => captiveLabel(made.state, made.ctx, namesOf(made.state, made.cards), id, [captive, hero]));
    expect(labels).toEqual([`${made.cards.get("dh2")?.name} · Captive · 0 of 6 damage`, undefined]);
  });

  it("the preview of a Captive says who holds it and that its text box is blank; the card that holds Captives names them", () => {
    const made = two();
    const seat1 = made.seat1Hero ?? "";
    const isengard = idOf(made.state, "143022");
    const grishnakh = idOf(made.state, "143024");
    const name = (id: string) => made.cards.get(made.state.cards[id]?.code ?? "")?.name ?? id;
    const under = dungeonDetail(made.state, made.ctx, idOf(made.state, "dh2"), name);
    expect(under).toBe("Player 1's hero, a Captive held under To Isengard! No one controls it and its text box is blank until the players win.");
    const both = holdCaptive(made.state, seat1, grishnakh);
    expect(dungeonDetail(both, made.ctx, seat1, name)).toBe("Player 2's hero, a Captive held by Grishnákh. No one controls it and its text box is blank. It takes 1 damage at the end of each quest phase until Grishnákh leaves play.");
    expect(dungeonDetail(both, made.ctx, isengard, name)).toBe("Holds dh2 as a Captive. No one controls it, and its text box is blank until the players win.");
    expect(dungeonDetail(both, made.ctx, grishnakh, name)).toBe(`Holds ${name(seat1)}, a Captive. It takes 1 damage at the end of each quest phase until Grishnákh leaves play.`);
    expect(dungeonDetail(made.state, made.ctx, grishnakh, name)).toBeNull();
  });
});

describe("the choices that name the pursuit value", () => {
  const WORDS = "The pursuit value is 27. At 30 at the end of the refresh phase, the players lose.";
  const layout = { staging: ["143022"], pursuit: 27, captive: { hero: "dh2", under: "143022" } } as const;

  it.each(["143025", "143030", "143063"])("%s's sheet says where the pursuit value stands and when the players lose", (code) => {
    const made = tableFromLayout("the-uruk-hai", layout, {});
    const revealed = revealFromTop(made.state, made.ctx, code, []);
    expect(revealed.state.window?.kind).toBe("choose");
    const sheet = sheetFor(revealed.state, made.ctx, legalIntents(revealed.state, made.ctx), namesOf(revealed.state, made.cards));
    const note = sheet?.kind === "pick" ? sheet.note : "";
    expect(note).toContain(WORDS);
    if (code === "143030") expect(note).toContain("This effect cannot be canceled.");
  });

  it("143025's rows name the value each leaves: the raise to 30, and the other card", () => {
    const made = tableFromLayout("the-uruk-hai", layout, {});
    const revealed = revealFromTop(made.state, made.ctx, "143025", []);
    const sheet = sheetFor(revealed.state, made.ctx, legalIntents(revealed.state, made.ctx), namesOf(revealed.state, made.cards));
    const labels = sheet?.kind === "pick" ? sheet.options.map((option) => option.label) : [];
    expect(labels[0]).toBe("Increase the pursuit value by 3, to 30");
    expect(labels).toHaveLength(2);
  });

  it("143029's Shadow choice does as well", () => {
    const notes: string[] = [];
    fightEnemy((made: Layout) => tableFromLayout("the-uruk-hai", made, {}), "143029", "f3", layout, {
      pick: (state) => {
        const made = tableFromLayout("the-uruk-hai", layout, {});
        const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesOf(state, made.cards));
        notes.push(sheet?.kind === "pick" ? (sheet.note ?? "") : "");
        return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
      },
    });
    expect(notes.some((note) => note.includes(WORDS))).toBe(true);
  });
});
