// Rules: rr.attachment-cards, rr.restricted, rr.modifiers (data/rules/entries.json).
// The Sands of Harad attachments, written from their card text (data/cards/TSoH.json; data/printed holds no ledger for this box, so every
// intent goes through sendUnledgered): Dwarven Shield 16010:A:1 and A:2, Mirkwood Long-knife 16011:A:1 and A:2, The Road Goes Ever On
// 16012:A:1. The heroes, allies, events and side quest are in the-sands-of-harad.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, hosts, play, playerTable, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const GIMLI = "16001";
const LEGOLAS = "16002";
const SHIELD = "16010";
const KNIFE = "16011";
const ROAD = "16012";
// Core: Aragorn (Leadership, not a Dwarf or Silvan), Legolas (Tactics Silvan hero), Thalin (Tactics Dwarf hero), Glorfindel (Lore),
// Silverlode Archer (a Silvan ally), Longbeard Orc Slayer (a Dwarf ally), Citadel Plate (a restricted attachment).
const ARAGORN = "01001";
const CORE_LEGOLAS = "01005";
const THALIN = "01006";
const GLORFINDEL = "01011";
const SILVERLODE = "01017";
const SLAYER = "01018";
const PLATE = "01040";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([GIMLI, LEGOLAS, SHIELD, KNIFE, ROAD, ARAGORN, CORE_LEGOLAS, THALIN, GLORFINDEL, SILVERLODE, SLAYER, PLATE]))]);
  base = { ...starter, cards };
});

describe("Dwarven Shield (16010:A:1, A:2)", () => {
  // Gimli (Leadership) pays 2. Thalin is a Dwarf hero, Aragorn is not, the Orc Slayer is a Dwarf ally.
  const shield = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: THALIN, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SLAYER, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });

  // "Attach to a Dwarf hero.": Gimli and Thalin are offered; Aragorn and the Dwarf ally are not.
  lineSpec("16010:A:1", "Dwarven Shield: Attach to a Dwarf hero", (effects) => {
    const tab = shield(effects);
    const card = idsOf(tab, SHIELD);
    expect(hosts(tab, card)).toEqual([idsOf(tab, GIMLI), idsOf(tab, THALIN)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, THALIN)).state.cards[card]?.host).toBe(idsOf(tab, THALIN));
  });

  // "Restricted.": Thalin already holds two Citadel Plates; the Shield is a third restricted attachment, so one of the three goes to the
  // discard pile (the player picks which) and Thalin keeps two.
  it("16010:A:1 Dwarven Shield: a third restricted attachment sends one to the discard pile", () => {
    const scene = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }, { code: THALIN, seat: 0 }], attached: [{ code: PLATE, host: THALIN }, { code: PLATE, host: THALIN }], hand: [{ code: SHIELD, seat: 0 }] });
    const thalin = idsOf(scene, THALIN);
    const [first = "", second = ""] = scene.ids[PLATE] ?? [];
    let run = play(begin(scene.state), scene, idsOf(scene, SHIELD), thalin);
    expect(choices(run.state, scene).sort()).toEqual([first, second, idsOf(scene, SHIELD)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: first }, scene.ctx);
    expect(run.state.cards[thalin]?.attachments.slice().sort()).toEqual([second, idsOf(scene, SHIELD)].sort());
    expect(run.state.seats[0]?.discard).toEqual([first]);
  });

  // "Attached hero gets +1 Defense.": Thalin, Defense 2, has 3 once the Shield is played on him.
  lineSpec("16010:A:2", "Dwarven Shield: the attached hero gets +1 Defense", (effects) => {
    const tab = shield(effects);
    const thalin = idsOf(tab, THALIN);
    expect(stat(play(begin(tab.state), tab, idsOf(tab, SHIELD), thalin).state, tab, thalin, "defense")).toBe(2 + 1);
  });
});

describe("Mirkwood Long-knife (16011:A:1, A:2)", () => {
  // Legolas (Spirit, Silvan) pays 2. Core Legolas is a Silvan hero, Aragorn is not, the Silverlode Archer is a Silvan ally.
  const knife = (effects: readonly Effect[]): Table =>
    table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: CORE_LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SILVERLODE, seat: 0 }], hand: [{ code: KNIFE, seat: 0 }] });

  // "Attach to a Silvan hero. Restricted.": both Legolas are offered; Aragorn and the Silvan ally are not.
  lineSpec("16011:A:1", "Mirkwood Long-knife: Attach to a Silvan hero", (effects) => {
    const tab = knife(effects);
    const [legolas, core] = [idsOf(tab, LEGOLAS), idsOf(tab, CORE_LEGOLAS)];
    expect(hosts(tab, idsOf(tab, KNIFE))).toEqual([legolas, core].sort());
    expect(play(begin(tab.state), tab, idsOf(tab, KNIFE), core).state.cards[idsOf(tab, KNIFE)]?.host).toBe(core);
  });

  // "Attached hero gets +1 Willpower and +1 Attack.": core Legolas (Willpower 1, Attack 3) has 2 and 4 with the knife.
  lineSpec("16011:A:2", "Mirkwood Long-knife: the attached hero gets +1 Willpower and +1 Attack", (effects) => {
    const tab = knife(effects);
    const core = idsOf(tab, CORE_LEGOLAS);
    const run = play(begin(tab.state), tab, idsOf(tab, KNIFE), core);
    expect(stat(run.state, tab, core, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, core, "attack")).toBe(3 + 1);
  });
});

describe("The Road Goes Ever On (16012:A:1)", () => {
  // "Attach to a quest card in play.": Glorfindel (Lore) pays 0; the quest card is offered, the heroes are not, and the Song is played on it.
  lineSpec("16012:A:1", "The Road Goes Ever On: Attach to a quest card in play", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: ARAGORN, seat: 0 }], hand: [{ code: ROAD, seat: 0 }] });
    const [road, quest] = [idsOf(tab, ROAD), tab.state.questStage ?? ""];
    expect(quest).not.toBe("");
    expect(hosts(tab, road)).toEqual([quest]);
    expect(play(begin(tab.state), tab, road, quest).state.cards[road]?.host).toBe(quest);
  });
});
