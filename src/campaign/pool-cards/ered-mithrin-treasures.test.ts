// Rules: emce.treasure, rr.attachment-cards, rr.restricted, rr.modifiers, rr.sentinel, rr.ranged, rr.first-player (data/rules/entries.json).
// The Ered Mithrin treasures' Attach to lines and constants, each tested from the line read from its scan (data/printed/ered-mithrin.json;
// lineSpec, test/harness/line-spec.ts): 12196:A:1, 12197:A:1, 12197:A:2, 12198:A:1, 12198:A:2, 12199:A:1, 12200:A:1, 12200:A:2, 12201:A:1,
// 12201:A:2, 12202:A:1, 12202:A:2, 12203:A:1, 12203:A:2, 12204:A:1, 12204:A:2. A treasure reaches a character in two ways: the players claim
// it once it is free of encounters (emce.treasure: "the players claim it"; the first player picks the character, docs/scenarios/ered-mithrin.md),
// or a player who has it in their deck plays it from the hand ("add a treasure card to their player deck"). The claim is the
// table's way in here (`claimed`); the play from the hand is the fault at the end of the file.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { settle } from "../../rules/engine/machine.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, send, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, hosts, passAll, type PlayerBase, playerTableFor, stat } from "../../../test/harness/player-table.ts";

const ANVIL = "12196";
const AXE = "12197";
const DAGGER = "12198";
const CROWN = "12199";
const LUTE = "12200";
const SHIELD = "12201";
const HELM = "12202";
const JEWELS = "12203";
const BOW = "12204";
const ALL = [ANVIL, AXE, DAGGER, CROWN, LUTE, SHIELD, HELM, JEWELS, BOW];
// Core heroes: Gimli (Attack 2, Defense 2), Legolas (Attack 3, Defense 1). Veteran Axehand: a Dwarf ally (Willpower 0, Attack 2, Defense 1).
const GIMLI = "01004";
const LEGOLAS = "01005";
const AXEHAND = "01028";
// Citadel Plate: "Attach to a hero. Restricted.", a Tactics Item of cost 4.
const PLATE = "01040";
const PAL = "pal";
// A stand-in enemy that attacks for 1 and is hard to kill.
const WEAK = "weak";

let base: PlayerBase;

const table = playerTableFor(() => base);

// The scene with the treasure `code` in the staging area, guarded by nothing: the settle sweep claims it and asks the first player for the
// character (freeTreasures, src/rules/families/wilderland/mirkwood.ts) as the engine settles after an intent (the window cleared).
const unguarded = (effects: readonly Effect[], code: string, scene: Scene): { tab: Table; run: Run } => {
  const tab = table(effects, { ...scene, staging: [...(scene.staging ?? []), code] });
  return { tab, run: begin(settle({ ...tab.state, window: null }, tab.ctx, [])) };
};

// The treasure claimed and put on `host` (a code of the scene) by the first player's choice.
const claimed = (effects: readonly Effect[], code: string, host: string, scene: Scene): { tab: Table; run: Run } => {
  const { tab, run } = unguarded(effects, code, scene);
  return { tab, run: send(run, { type: "Choose", optionId: idsOf(tab, host) }, tab.ctx) };
};

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([...ALL, GIMLI, LEGOLAS, AXEHAND, PLATE]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Attach to a character (12196:A:1, 12197:A:1, 12198:A:1, 12200:A:1, 12201:A:1, 12202:A:1, 12203:A:1, 12204:A:1)", () => {
  // "Attach to a character.": a hero (Gimli), an ally (the Veteran Axehand) and the other player's hero are offered (rr.attachment-cards:
  // "A player has the option to play attachments by attaching them to another player's character"); the enemy engaged is not. Put on the
  // ally, the treasure is attached to it and the first player controls it.
  const rows = [
    ["12196:A:1", ANVIL],
    ["12197:A:1", AXE],
    ["12198:A:1", DAGGER],
    ["12200:A:1", LUTE],
    ["12201:A:1", SHIELD],
    ["12202:A:1", HELM],
    ["12203:A:1", JEWELS],
    ["12204:A:1", BOW],
  ] as const;
  for (const [line, code] of rows) {
    lineSpec(line, "Attach to a character: any player's hero or ally, not an enemy; the hand play offers the same hosts", (effects) => {
      const { tab, run } = unguarded(effects, code, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: AXEHAND, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
      expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GIMLI), idsOf(tab, PAL), idsOf(tab, AXEHAND)].sort());
      const done = send(run, { type: "Choose", optionId: idsOf(tab, AXEHAND) }, tab.ctx);
      expect(done.state.cards[idsOf(tab, code)]).toMatchObject({ host: idsOf(tab, AXEHAND), controller: 0 });
      // The hand play is what tests the line (without its record every character of the seat is offered, not every seat's): the same three hosts are offered when a player plays the treasure from the hand.
      const held = table(effects, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: AXEHAND, seat: 0 }], hand: [{ code, seat: 0 }] });
      expect(hosts(held, idsOf(held, code))).toEqual([idsOf(held, GIMLI), idsOf(held, PAL), idsOf(held, AXEHAND)].sort());
    });
  }
});

describe("Dwarf-Lord's Crown (12199:A:1)", () => {
  // "Attach to a hero.": Gimli and the other player's hero are offered, the Veteran Axehand (an ally) is not.
  lineSpec("12199:A:1", "Dwarf-Lord's Crown: Attach to a hero", (effects) => {
    const { tab, run } = unguarded(effects, CROWN, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: AXEHAND, seat: 0 }] });
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, GIMLI), idsOf(tab, PAL)].sort());
    const done = send(run, { type: "Choose", optionId: idsOf(tab, PAL) }, tab.ctx);
    expect(done.state.cards[idsOf(tab, CROWN)]?.host).toBe(idsOf(tab, PAL));
  });
});

describe("Restricted (12197:A:1, 12200:A:1, 12201:A:1, 12202:A:1, 12204:A:1)", () => {
  // "Restricted.": Gimli holds Citadel Plate and one restricted treasure; a third restricted attachment, the claimed treasure, is put on him
  // and one of the three must go to the discard pile (rr.restricted), which the player chooses.
  const thirdRestricted = (worn: string, code: string) => {
    const { tab, run } = claimed(EFFECTS, code, GIMLI, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: PLATE, host: GIMLI }, { code: worn, host: GIMLI }] });
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, PLATE), idsOf(tab, worn), idsOf(tab, code)].sort());
    const done = send(run, { type: "Choose", optionId: idsOf(tab, PLATE) }, tab.ctx);
    expect(done.state.cards[idsOf(tab, PLATE)]?.zone).toBe("discard");
    expect(done.state.cards[idsOf(tab, GIMLI)]?.attachments).toHaveLength(2);
  };
  const rows = [
    ["12197:A:1", HELM, AXE],
    ["12200:A:1", AXE, LUTE],
    ["12201:A:1", LUTE, SHIELD],
    ["12202:A:1", SHIELD, HELM],
  ] as const;
  for (const [line, worn, code] of rows) it(`${line} a third restricted attachment, beside Citadel Plate and ${worn}, sends one to the discard pile`, () => thirdRestricted(worn, code));

  it("12204:A:1 a third restricted attachment, beside Citadel Plate and Helm of Heroes, sends one to the discard pile", () => thirdRestricted(HELM, BOW));

  // Anvil of Gundabad and Jewels of Wilderland print no Restricted: beside two restricted attachments they ask nothing.
  for (const code of [ANVIL, JEWELS]) {
    it(`${code}:A:1 an attachment that is not restricted is a third attachment with no discard`, () => {
      const { tab, run } = claimed(EFFECTS, code, GIMLI, { heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: PLATE, host: GIMLI }, { code: AXE, host: GIMLI }] });
      expect(run.state.window?.kind).not.toBe("choose");
      expect(run.state.cards[idsOf(tab, GIMLI)]?.attachments).toHaveLength(3);
    });
  }
});

describe("Stat bonuses (12197:A:2, 12198:A:2, 12200:A:2, 12202:A:2, 12203:A:2)", () => {
  // "Attached character gets +2 Attack." and the like: on the Veteran Axehand the stat rises by the printed amount and the others stay;
  // Gimli, beside it, gets nothing.
  const bonuses = [
    [AXE, "attack", 2],
    [DAGGER, "attack", 1],
    [LUTE, "willpower", 2],
    [HELM, "defense", 2],
    [JEWELS, "willpower", 1],
  ] as const;
  const keys = ["willpower", "attack", "defense"] as const;
  for (const [code, which, amount] of bonuses) {
    lineSpec(`${code}:A:2`, `attached character gets +${amount} ${which}`, (effects) => {
      const { tab, run } = claimed(effects, code, AXEHAND, { heroes: [{ code: GIMLI, seat: 0 }], allies: [{ code: AXEHAND, seat: 0 }] });
      const [axehand, gimli] = [idsOf(tab, AXEHAND), idsOf(tab, GIMLI)];
      expect(run.state.cards[idsOf(tab, code)]?.host).toBe(axehand);
      const printed = keys.map((key) => stat(tab.state, tab, axehand, key));
      expect(keys.map((key) => stat(run.state, tab, axehand, key))).toEqual(printed.map((value, at) => (keys[at] === which ? value + amount : value)));
      expect(stat(run.state, tab, gimli, which)).toBe(stat(tab.state, tab, gimli, which));
    });
  }
});

describe("Gondolin Shield (12201:A:2)", () => {
  // "Attached character gets +1 Defense and gains sentinel.": on Gimli (Defense 2) he has Defense 3 and sentinel, so he may defend the
  // attack of the enemy engaged with the other player (rr.sentinel); Legolas, with no sentinel, may not.
  lineSpec("12201:A:2", "Gondolin Shield: +1 Defense and sentinel", (effects) => {
    const { tab, run: held } = claimed(effects, SHIELD, GIMLI, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WEAK, seat: 1 }] });
    const [gimli, legolas] = [idsOf(tab, GIMLI), idsOf(tab, LEGOLAS)];
    expect(stat(held.state, tab, gimli, "defense")).toBe(2 + 1);
    expect(hasKeyword(held.state, gimli, "sentinel", tab.ctx.cards)).toBe(true);
    const run = passAll(combat(held.state, tab), tab.ctx);
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: gimli }, tab.ctx)).toBeNull();
    expect(refusal(run.state, { type: "DeclareDefender", defenderId: legolas }, tab.ctx)).not.toBeNull();
  });
});

describe("Masterwork Bow (12204:A:2)", () => {
  // "Attached character gets +1 Attack and gains ranged.": on Gimli (Attack 2) he has Attack 3 and ranged, so he may attack the enemy
  // engaged with the other player (rr.ranged); the Veteran Axehand, with no ranged, may not (Legolas prints Ranged, so he is not the case).
  lineSpec("12204:A:2", "Masterwork Bow: +1 Attack and ranged", (effects) => {
    const { tab, run } = claimed(effects, BOW, GIMLI, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: AXEHAND, seat: 0 }], engaged: [{ code: WEAK, seat: 1 }] });
    const [gimli, axehand, weak] = [idsOf(tab, GIMLI), idsOf(tab, AXEHAND), idsOf(tab, WEAK)];
    expect(run.state.cards[idsOf(tab, BOW)]?.host).toBe(gimli);
    expect(stat(run.state, tab, gimli, "attack")).toBe(2 + 1);
    expect(hasKeyword(run.state, gimli, "ranged", tab.ctx.cards)).toBe(true);
    const state = attacking(run.state);
    expect(refusal(state, { type: "DeclareAttackers", enemyId: weak, attackerIds: [gimli] }, tab.ctx)).toBeNull();
    expect(refusal(state, { type: "DeclareAttackers", enemyId: weak, attackerIds: [axehand] }, tab.ctx)).not.toBeNull();
  });
});
