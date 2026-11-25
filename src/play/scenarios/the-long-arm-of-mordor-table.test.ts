// Rules: hrd.heroes-in-the-staging-area, hrd.guarded-heroes, hrd.objective-heroes, hrd.objective-hero-elimination, hrd.stage-number, rr.blank, rr.immune (data/rules/entries.json); ledger lines 16071:A:1, 16071:B:3, 16072:B:3, 16073:A:1, 16073:B:2, 16031:A:2, 16035:A:1 (docs/scenarios/haradrim/the-long-arm-of-mordor.md, Table).
// What the table says of The Long Arm of Mordor's pieces: the heroes in the staging area drawn there with their tokens and attachments and the owner named, the hero an Orc guards drawn under it, the objective-heroes' loss, and the Enforcers' X.
// The engine decided each fact; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { heroGuardedBy } from "../../rules/families/wilderland/carried.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { slotNumbers } from "../cards/card-effects.ts";
import { whyNotPlayable } from "../choice/why.ts";
import { previewCards } from "../cards/table-preview.ts";
import { heldDials } from "../readouts/widgets.ts";
import { stagedHeroes } from "../readouts/haradrim/staged.ts";
import { zoneSelector } from "../store/selectors.ts";

const ORC = "16062";
const KAHLIEL = "16031";
const FIRYAL = "16032";
const at = (layout: Layout = {}) => tableFromLayout("the-long-arm-of-mordor", { phase: "Quest", stage: "16071", side: "B", ...layout });
// What the settle sweep leaves on a hero in the staging area (the haradrim family's markStagedHeroes): the blank text box and the immunity.
const MARKS = (code: string) => ({ code, from: code, stats: [["blankText", 1], ["immuneToPlayerCards", 1]] as const });
const OBJECTIVES = { heroes: [{ code: KAHLIEL, seat: 0, resources: 2 }, { code: FIRYAL, seat: 1, resources: 2 }], modified: [KAHLIEL, FIRYAL].map((code) => ({ code, from: code, stats: [["heroType", 1]] as const })) };
const stagedLayout = (extra: Layout = {}): Layout => ({ seats: 2, staging: [ORC], staged: [{ hero: "dh1" }, { hero: "dh2" }], modified: [MARKS("dh1"), MARKS("dh2")], ...extra });
const preview = (t: ReturnType<typeof at>, code: string) => {
  const name = (id: string) => t.ctx.cards.get(t.state.cards[id]?.code ?? code)?.name ?? code;
  return JSON.stringify(previewCards(t.state, t.ctx, idOf(t.state, code), (one) => ({ name: t.ctx.cards.get(one)?.name ?? one, source: null, text: "" }), name));
};

describe("the heroes in the staging area", () => {
  it("16071:A:1 draws each hero a Setup moved there in the staging area, beside the cards, with its attachments and tokens", () => {
    const t = at(stagedLayout());
    const entries = zoneSelector("staging", 0)(t.state).entries;
    const heroes = entries.filter((entry) => entry.card.zone === "captive").map((entry) => entry.card.code);
    expect(heroes).toEqual(["dh1", "dh2"]);
    expect(entries.map((entry) => entry.card.code).slice(0, 1)).toEqual([ORC]);
    expect(stagedHeroes(t.state).map((card) => card.owner)).toEqual([0, 0]);
  });

  it("16071:A:1 draws no hero in the staging area in a game that moved none", () => {
    const t = at({ staging: [ORC] });
    expect(zoneSelector("staging", 0)(t.state).entries.map((entry) => entry.card.code)).toEqual([ORC]);
  });

  it("16071:A:1 marks a hero in the staging area Blank, with the pill of a blank text box", () => {
    const t = at(stagedLayout());
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, "dh1")).determined?.word).toBe("Blank");
  });

  it("16071:A:1 names the owner and says in the preview that it is blank, immune and given back, exhausted, by a quest stage (16071:B:3, 16072:B:3)", () => {
    const t = at(stagedLayout());
    const text = preview(t, "dh2");
    expect(text).toContain("Player 1's hero, in play in the staging area under no player's control.");
    expect(text).toContain("Its text box is blank. It is immune to player card effects.");
    expect(text).toContain("A quest stage gives it back to Player 1's, exhausted, with its tokens and attachments.");
  });

  it("16071:A:1 says in the dial of its seat that it is in the staging area, not that it is a Captive", () => {
    const t = at(stagedLayout());
    const dials = heldDials(t.state, (code) => (code === "dh1" ? "Hero One" : code), () => false);
    expect(dials.find((dial) => dial.seat === 0)?.words).toContain("is in the staging area");
    expect(JSON.stringify(dials)).not.toContain("Captive");
  });
});

describe("the hero an Orc guards", () => {
  const guarded = () => at({ seats: 2, staging: [ORC], staged: [{ hero: "dh1", under: ORC }], modified: [MARKS("dh1")] });

  it("16073:A:1 draws the hero under its guard, faceup, and the guard wears the pill that counts what it holds", () => {
    const t = guarded();
    const guard = zoneSelector("staging", 0)(t.state).entries.find((entry) => entry.card.code === ORC);
    expect(guard?.attached.map((card) => card.code)).toEqual(["dh1"]);
    expect(guard?.attached[0]?.face).toBe("up");
    expect(heroGuardedBy(t.state, idOf(t.state, ORC))).toBe(idOf(t.state, "dh1"));
    expect(slotNumbers(t.state, t.ctx, idOf(t.state, ORC)).under).toMatchObject({ text: "1 held" });
    expect(zoneSelector("staging", 0)(t.state).entries.some((entry) => entry.card.code === "dh1")).toBe(false);
  });

  it("16073:B:2 says in the preview of the hero who guards it and that it returns, exhausted, when the guard leaves play, and in the guard's who it holds", () => {
    const t = guarded();
    expect(preview(t, "dh1")).toContain("guarded by Uruk of Mordor. No player controls it, its text box is blank and it is immune to player card effects. It returns to its owner, exhausted, when Uruk of Mordor leaves play.");
    expect(preview(t, ORC)).toContain("Guards dh1, Player 1's hero. dh1 returns to its owner, exhausted, when Uruk of Mordor leaves play in any way.");
    expect(preview(t, ORC)).not.toContain("Captive");
  });
});

describe("the objective-heroes", () => {
  it("16031:A:2 says in each objective-hero's preview that its seat is eliminated if it leaves play, read from its own record", () => {
    const two = at({ seats: 2, ...OBJECTIVES });
    expect(preview(two, KAHLIEL)).toContain("If it leaves play, Player 1 is eliminated from the game, however it leaves play.");
    expect(preview(two, FIRYAL)).toContain("If it leaves play, Player 2 is eliminated from the game");
    const solo = at({ heroes: [OBJECTIVES.heroes[0]!], modified: [OBJECTIVES.modified[0]!] });
    expect(preview(solo, KAHLIEL)).toContain("If it leaves play, you are eliminated from the game");
  });

  it("16031:A:2 says it of no other hero", () => {
    const t = at({ seats: 2, ...OBJECTIVES });
    expect(preview(t, "dh1")).not.toContain("eliminated");
  });
});

describe("Sauron's Enforcers", () => {
  it("16035:A:1 says in its preview what X, its Threat, Attack and Defense, is now: the stage number of the main quest", () => {
    for (const [stage, number] of [["16072", 2], ["16073", 3]] as const) {
      const t = at({ stage, side: "A", staging: ["16035"] });
      expect(preview({ ...t, state: settle(t.state, t.ctx, []) }, "16035")).toContain(`X is the stage number of the main quest: Threat ${number}, Attack ${number}, Defense ${number} now.`);
    }
  });

  it("16036:A:1 says it of Southron Boma's Threat only, and of no card with a printed number", () => {
    const t = at({ stage: "16073", side: "A", staging: ["16036", ORC] });
    const settled = { ...t, state: settle(t.state, t.ctx, []) };
    expect(preview(settled, "16036")).toContain("X is the stage number of the main quest: Threat 3 now.");
    expect(preview(settled, ORC)).not.toContain("stage number");
  });
});

describe("the first card each player plays", () => {
  // Stages 1B and 2B (16071:B:2, 16072:B:2): the first card each player plays each phase needs no resource match. The table adds no widget: the hand glows and the refusal reads what the engine allows, so a card of a sphere no hero has is playable.
  const lookout = (stage: string, side: "A" | "B") => tableFromLayout("the-long-arm-of-mordor", { stage, side, phase: "Planning", hand: ["17062"], heroes: [{ code: "01001", seat: 0, resources: 3 }] }, { extra: ["17062", "01001"] });
  const refusal = (t: ReturnType<typeof lookout>) => whyNotPlayable(t.state, t.ctx, idOf(t.state, "17062"), () => "Dunedain Lookout");

  it("16071:B:2 offers a card whose sphere no hero of the player has, and says why it cannot be played once a stage without the line is current", () => {
    expect(refusal(lookout("16071", "B"))).toBeNull();
    expect(refusal(lookout("16073", "A"))).toBe("No Lore hero is in play to pay for it.");
  });
});
