// Rules: mec112.pursuit, rr.player-elimination (data/rules/entries.json); ledger lines 143069:A:1, 143022:A:1, 143024:A:1. What the table draws of The Uruk-hai's own pieces: every Captive faceup under the card that holds it (To Isengard!
// holds one for each player), the Captive Grishnákh holds under him, and the pursuit value as a readout the engine's number feeds.
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, haiTable, loadHaiWorld, type HaiWorld } from "../../../test/scenarios/the-uruk-hai/scene.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { holdCaptive } from "../../rules/families/uruk/captive.ts";
import { EFFECTS } from "../../effects/index.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { cardLabel } from "../choice/sheet-parts.ts";
import { threatLevel, threatMeter } from "../readouts/threat-level.ts";
import { heldDials, PURSUIT_LOSS_AT, pursuitWords, widgetReadouts } from "../readouts/widgets.ts";
import { zoneSelector } from "./selectors.ts";

let world: HaiWorld;
beforeAll(async () => {
  world = await loadHaiWorld();
  world.cards.set("att", definePrinted({ code: "att", name: "att", type: "attachment", sphere: "neutral", cost: 0 }));
});

const facts = { typeOf: () => "enemy", shipRank: () => null } as const;

describe("the pieces of The Uruk-hai on the table", () => {
  it("draws each Captive under To Isengard!, all of them in two-handed play", () => {
    const { state, hero2, seat1Hero } = haiTable(world, { seats: 2, captives: ["hero2", "seat1"], staging: [CODES.ugluk] });
    const view = zoneSelector("staging", 0, facts)(state);
    const isengard = view.entries.find((entry) => entry.card.code === CODES.toIsengard);
    expect(isengard?.attached.map((card) => card.id).sort()).toEqual([hero2, seat1Hero ?? ""].sort());
    // Uglúk beside it holds nothing.
    expect(view.entries.find((entry) => entry.card.code === CODES.ugluk)?.attached).toEqual([]);
  });

  it("draws the Captive Grishnákh holds under him, in the staging area and engaged", () => {
    const staged = haiTable(world, { staging: [CODES.grishnakh] });
    const stagedId = Object.values(staged.state.cards).find((card) => card.code === CODES.grishnakh)?.id ?? "";
    const stagedView = zoneSelector("staging", 0, facts)(holdCaptive(staged.state, staged.hero2, stagedId));
    expect(stagedView.entries.find((entry) => entry.card.code === CODES.grishnakh)?.attached.map((card) => card.id)).toEqual([staged.hero2]);

    const engaged = haiTable(world, { engaged: [CODES.grishnakh] });
    const engagedId = Object.values(engaged.state.cards).find((card) => card.code === CODES.grishnakh)?.id ?? "";
    const engagedView = zoneSelector("engaged", 0, facts)(holdCaptive(engaged.state, engaged.hero2, engagedId));
    expect(engagedView.entries.find((entry) => entry.card.code === CODES.grishnakh)?.attached.map((card) => card.id)).toEqual([engaged.hero2]);
  });

  it("shows the pursuit value only while the engine holds one", () => {
    const { state } = haiTable(world, { pursuit: 14 });
    expect(widgetReadouts(state).pursuit).toBe(14);
    expect(widgetReadouts({ ...state, pursuit: 0 }).pursuit).toBe(0);
    const { pursuit: _gone, ...without } = state;
    expect(widgetReadouts(without).pursuit).toBeUndefined();
  });

  it("gives each seat whose hero is a Captive a dial that says where it is, and the Captive's owner is told apart in a pick", () => {
    const { state, ctx, hero2, seat1Hero } = haiTable(world, { seats: 2, captives: ["hero2", "seat1"], staging: [CODES.grishnakh] });
    const names: Record<string, string> = { [CODES.toIsengard]: "To Isengard!", [CODES.grishnakh]: "Grishnákh" };
    const name = (code: string): string => names[code] ?? code;
    const heroCode = (id: string | null): string => state.cards[id ?? ""]?.code ?? "";
    expect(heldDials(state, name)).toEqual([
      { seat: 0, words: `${heroCode(hero2)} is a Captive under To Isengard!`, mark: "hero" },
      { seat: 1, words: `${heroCode(seat1Hero)} is a Captive under To Isengard!`, mark: "hero" },
    ]);
    const grishnakh = Object.values(state.cards).find((card) => card.code === CODES.grishnakh)?.id ?? "";
    expect(heldDials(holdCaptive(state, hero2, grishnakh), name)[0]).toEqual({ seat: 0, words: `${heroCode(hero2)} is a Captive held by Grishnákh`, mark: "hero" });
    // A pick of Captives names whose hero each row is two-handed, and a solo row stays its name.
    const names2 = { card: (id: string) => heroCode(id), line: () => null };
    expect(cardLabel(state, names2, hero2)).toBe(`${heroCode(hero2)} · Player 1`);
    expect(cardLabel(state, names2, seat1Hero ?? "")).toBe(`${heroCode(seat1Hero)} · Player 2`);
    const solo = haiTable(world, { captives: ["hero2"] });
    expect(cardLabel(solo.state, { card: () => "Gimli", line: () => null }, solo.hero2)).toBe("Gimli");
    // The preview of a Captive says it is one, whose it is, who holds it, that its text box is blank, and what is attached to it.
    const att = spawn(state, "att", { zone: "play", seat: 0 });
    const withAttachment = holdCaptive(attachTo(att.state, att.id, hero2), hero2, grishnakh);
    const detail = (game: typeof state, id: string): string | null => dungeonDetail(game, ctx, id, (card) => game.cards[card]?.code ?? card);
    expect(detail(state, hero2)).toBe(`A Captive: Player 1's hero, under ${CODES.toIsengard}. Its text box is blank and no one controls it.`);
    expect(detail(withAttachment, hero2)).toBe(`A Captive: Player 1's hero, held by ${CODES.grishnakh}. Its text box is blank and no one controls it. Attached: att.`);
    expect(detail(haiTable(world, { seats: 1, captives: ["hero2"] }).state, hero2)).toContain("your hero");
    // No Captive: no dial.
    expect(heldDials(haiTable(world, { seats: 2 }).state, name)).toEqual([]);
  });

  it("says the loss beside the pursuit value, pinned to To Isengard!'s record, and warms the dial toward 30 as the threat dial does toward 50", () => {
    expect(pursuitWords(14)).toBe("Pursuit value 14, the players lose at 30");
    const loses = EFFECTS.find((effect) => effect.id === "143022:forced:1")?.instructions.flatMap((instruction) => ("when" in instruction && instruction.when?.kind === "pursuit" ? [instruction.when.min] : []));
    expect(loses).toEqual([PURSUIT_LOSS_AT]);
    expect([19, 20, 24, 25].map((value) => threatLevel(value, PURSUIT_LOSS_AT))).toEqual(["calm", "near", "near", "critical"]);
    expect([39, 40, 44, 45].map((value) => threatLevel(value))).toEqual(["calm", "near", "near", "critical"]);
    expect(threatMeter(15, PURSUIT_LOSS_AT)).toBe(0.5);
    expect(threatMeter(25)).toBe(0.5);
  });
});
