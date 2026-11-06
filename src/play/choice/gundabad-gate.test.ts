// Rules: rr.first-player, rr.search, rr.cancel, rr.damage (data/rules/entries.json); ledger lines 11176:A:3, 18060:A:1, 01089:A:1.
// The words of Mount Gundabad are told only in Mount Gundabad (words/gundabad.ts, inGundabad). Each expectation below is what the sheet said before Mount Gundabad had words (run against the commit before it). The cards below share the shape of one of its choices with a record of another game, and their sheets read as they did before Mount Gundabad had words: the Choose that discards
// to add a card to the victory display (Ominous Fate, Dream-chaser), the "may" that searches the deck for an attachment (Lost Armory, The King's Quest and The Withered Heath), and the pick of a questing character that is damaged (Passage Through Mirkwood).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { OMINOUS_FATE, loadVoyageWorld, voyageTable, type VoyageWorld } from "../../../test/scenarios/voyage-across-belegaer/scene.ts";
import { CODES as HEATH, heathTable, loadHeathWorld, type HeathWorld } from "../../../test/scenarios/the-withered-heath/scene.ts";
import { loadMirkwoodWorld, mirkwoodTable, type MirkwoodWorld } from "../../../test/scenarios/passage-through-mirkwood/scene.ts";
import { send } from "../../../test/harness/scene-kit.ts";

import { sheetFor } from "./sheets.ts";

let voyage: VoyageWorld;
let heath: HeathWorld;
let mirkwood: MirkwoodWorld;
beforeAll(async () => {
  [voyage, heath, mirkwood] = await Promise.all([loadVoyageWorld(), loadHeathWorld(), loadMirkwoodWorld()]);
}, 120_000);

type Scene = { state: ScenarioState; ctx: Parameters<typeof settle>[1] };

// The card's records of one timing are pushed and settled until the engine opens a window: the live state the sheet is built from.
function opened(scene: Scene, code: string, timing: Effect["timing"], zone: "staging" | "activeLocation"): ScenarioState {
  const spawned = spawn(scene.state, code, { zone });
  const effects = scene.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(spawned.state, "forced", spawned.id, spawned.state.firstPlayer, false, effects, scene.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, scene.ctx, []);
}

const sheetOf = (scene: Scene, state: ScenarioState, name: (code: string) => string) => {
  const sheet = sheetFor(state, scene.ctx, legalIntents(state, scene.ctx), { card: (id) => name(state.cards[id]?.code ?? id), line: () => null });
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return { note: sheet.note, labels: sheet.options.map((option) => option.label), cautions: sheet.options.map((option) => ("caution" in option ? option.caution : undefined)), marks: sheet.options.map((option) => ("mark" in option ? option.mark : undefined)) };
};

describe("another game's choices keep their ordinary words", () => {
  it("Ominous Fate (11176): the Choose that adds it to the victory display or discards it", () => {
    const scene = voyageTable(voyage);
    const first = opened(scene, OMINOUS_FATE, "whenRevealed", "staging");
    const threat = send({ state: first, steps: [] }, { type: "Choose", optionId: "threat" }, scene.ctx).state;
    expect(sheetOf(scene, threat, (code) => voyage.cards.get(code)?.name ?? code)).toEqual({ note: "Choose one.", labels: ["Add this card to the victory display", "Do nothing"], cautions: [undefined, undefined], marks: [undefined, undefined] });
  });

  it("Lost Armory (18060): the may that searches the deck for a Weapon or Armor attachment", () => {
    heath.cards.set("blade", definePrinted({ code: "blade", name: "blade", type: "attachment", sphere: "neutral", cost: 1, traits: ["Weapon"] }));
    const scene = heathTable(heath, { phase: "Travel", deckOf: ["blade", "f0"] });
    const state = opened(scene, HEATH.lostArmory, "response", "activeLocation");
    expect(sheetOf(scene, state, (code) => heath.cards.get(code)?.name ?? code)).toEqual({ note: "Choose one.", labels: ["Search your deck for a Weapon or Armor attachment and put it into your hand", "Do nothing"], cautions: [undefined, undefined], marks: [undefined, undefined] });
  });

  it("Passage Through Mirkwood (01089): the first player's pick of a questing character that is damaged", () => {
    const table = mirkwoodTable(mirkwood, { phase: "Quest", seats: 2 });
    const committed = [table.hero, table.hero2, table.seat1Hero ?? ""].reduce((state, id) => updateCard(state, id, { committed: true }), table.state);
    const state = opened({ ...table, state: committed }, "01089", "whenRevealed", "staging");
    const scene = table;
    expect(sheetOf(scene, state, (code) => mirkwood.cards.get(code)?.name ?? code)).toEqual({ note: "Choose a questing character to take 2 damage. Player 1 chooses.", labels: ["mh1", "mh2", "mh3"], cautions: [undefined, undefined, undefined], marks: [undefined, undefined, undefined] });
  });
});
