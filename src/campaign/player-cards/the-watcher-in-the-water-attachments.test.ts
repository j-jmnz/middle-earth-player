// Rules: rr.attachment-cards, rr.ranged, rr.printed, rr.gains, rr.resource-match, rr.response, rr.triggered-ability, rr.ownership-and-control,
// rr.step-1-2, rr.step-6-8-2 (data/rules/entries.json).
// The Watcher in the Water attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Sword
// that was Broken 04055:A:1 to A:3, Rivendell Bow 04057:A:1 and A:2, Legacy of Durin 04061:A:1 and A:2, Resourceful 04062:A:2 and A:3.
// The lines are the text of data/cards/WitW.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, enter, fillers, hosts, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SWORD = "04055";
const BOW = "04057";
const LEGACY = "04061";
const RESOURCEFUL = "04062";
// Core Aragorn (Leadership), Gimli (Tactics Dwarf hero), Legolas (Tactics Silvan, printed ranged), Denethor (Lore Gondor), Glorfindel
// (Lore Noldor), Lórien Guide (a Spirit Silvan ally).
const ARAGORN = "01001";
const GIMLI = "01004";
const LEGOLAS = "01005";
const DENETHOR = "01010";
const GLORFINDEL = "01011";
const GUIDE = "01044";
const ALLY = "ally";
const PAL = "pal";
// A Dwarf ally and an ally that is not a Dwarf (Lore, cost 1), a Spirit hero with no text, an enemy that no attack here destroys.
const DWARF = "dwarf";
const ELF = "elf";
const SPIRIT = "spirit";
const WEAK = "weak";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SWORD, BOW, LEGACY, RESOURCEFUL, ARAGORN, GIMLI, LEGOLAS, DENETHOR, GLORFINDEL, GUIDE]))]);
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(ELF, definePrinted({ code: ELF, name: "Elf", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Silvan"] }));
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Sword that was Broken (04055:A:1 to A:3)", () => {
  // "Attach to a hero.": Aragorn and Glorfindel are offered, the ally is not.
  lineSpec("04055:A:1", "goes on a hero and not on an ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GLORFINDEL, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });
    const sword = idsOf(tab, SWORD);
    expect(hosts(tab, sword)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, GLORFINDEL)].sort());
    expect(play(begin(tab.state), tab, sword, idsOf(tab, GLORFINDEL)).state.cards[sword]?.host).toBe(idsOf(tab, GLORFINDEL));
  });

  // "Attached hero gains a Leadership resource icon.": Aragorn pays for the Sword on Glorfindel (Lore); in the state that intent returns,
  // Glorfindel alone pays for a Leadership ally, which he could not before.
  lineSpec("04055:A:2", "the attached hero gains a Leadership resource icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GLORFINDEL, seat: 0 }], hand: [{ code: SWORD, seat: 0 }, { code: ALLY, seat: 0 }] });
    const [glorfindel, ally] = [idsOf(tab, GLORFINDEL), idsOf(tab, ALLY)];
    const byGlorfindel = { type: "PlayCard", cardId: ally, payments: [{ heroId: glorfindel, amount: 1 }] } as const;
    expect(refusal(tab.state, byGlorfindel, tab.ctx)).not.toBeNull();
    let run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, SWORD), hostId: glorfindel, payments: [{ heroId: idsOf(tab, ARAGORN), amount: 3 }] }, tab.ctx);
    run = sendUnledgered(run, byGlorfindel, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(run.state.cards[glorfindel]?.resources).toBe(6 - 1);
  });

  // "If attached hero is Aragorn, each character you control gets +1 Willpower.": the Sword played on Aragorn gives him, Denethor and the
  // ally +1 Willpower; the other player's hero gets nothing.
  lineSpec("04055:A:3", "on Aragorn, each character you control gets +1 Willpower", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });
    const [aragorn, denethor, ally, spirit] = [idsOf(tab, ARAGORN), idsOf(tab, DENETHOR), idsOf(tab, ALLY), idsOf(tab, SPIRIT)];
    const run = play(begin(tab.state), tab, idsOf(tab, SWORD), aragorn);
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(2 + 1);
    expect(stat(run.state, tab, denethor, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, ally, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, spirit, "willpower")).toBe(1);
  });

  // On Glorfindel (not Aragorn) the Sword gives no Willpower.
  it("04055:A:3 gives no Willpower on a hero not named Aragorn", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GLORFINDEL, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });
    const run = play(begin(tab.state), tab, idsOf(tab, SWORD), idsOf(tab, GLORFINDEL));
    expect(stat(run.state, tab, idsOf(tab, ARAGORN), "willpower")).toBe(2);
    expect(stat(run.state, tab, idsOf(tab, GLORFINDEL), "willpower")).toBe(3);
    expect(stat(run.state, tab, idsOf(tab, ALLY), "willpower")).toBe(1);
  });
});

describe("Rivendell Bow (04057:A:1, A:2)", () => {
  // "Attach to a Noldor or Silvan character, or to Aragorn. Limit 1 per character.": Glorfindel (Noldor), Legolas (Silvan), Aragorn and a
  // Lórien Guide (a Silvan ally) are offered; Denethor, the plain ally and the Guide that holds a Bow already are not.
  lineSpec("04057:A:1", "goes on a Noldor or Silvan character or Aragorn, one per character", (effects) => {
    const scene = table(effects, { heroes: [{ code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }, { code: GUIDE, seat: 0 }, { code: ALLY, seat: 0 }, { code: BOW, seat: 0 }], hand: [{ code: BOW, seat: 0 }] });
    const [worn, held] = scene.ids[BOW] ?? [];
    const [guide, armed] = scene.ids[GUIDE] ?? [];
    const tab = attach(scene, [[worn ?? "", armed ?? ""]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, GLORFINDEL), idsOf(tab, LEGOLAS), idsOf(tab, ARAGORN), guide ?? ""].sort());
  });

  // "Attached character gains ranged.": Legolas pays for the Bow on Glorfindel; Glorfindel then attacks the Weak enemy engaged with the
  // other player, which he could not do before (rr.ranged).
  lineSpec("04057:A:2", "the attached character gains ranged", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: GLORFINDEL, seat: 0 }, { code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WEAK, seat: 1 }], hand: [{ code: BOW, seat: 0 }] });
    const [glorfindel, weak] = [idsOf(tab, GLORFINDEL), idsOf(tab, WEAK)];
    const declare = { type: "DeclareAttackers", enemyId: weak, attackerIds: [glorfindel] } as const;
    expect(refusal(attacking(tab.state), declare, tab.ctx)).not.toBeNull();
    const played = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: idsOf(tab, BOW), hostId: glorfindel, payments: [{ heroId: idsOf(tab, LEGOLAS), amount: 1 }] }, tab.ctx);
    const run = sendUnledgered(begin(attacking(played.state)), declare, tab.ctx);
    expect(run.state.cards[glorfindel]?.exhausted).toBe(true);
    expect(run.steps.some((step) => step.kind === "strike" && step.side === "player" && step.enemyId === weak)).toBe(true);
  });

  // The gained ranged keyword is not printed (rr.printed), so the Bow's +1 Attack for a printed ranged keyword (04057:A:3) does not
  // reach Glorfindel: his ranged attack is made at his printed 3.
  it("04057:A:2 Glorfindel's ranged attack with the Bow is made at his own Attack", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GLORFINDEL, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: BOW, host: GLORFINDEL }], engaged: [{ code: WEAK, seat: 1 }] });
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, GLORFINDEL)] }, tab.ctx);
    const strikes = run.steps.flatMap((step) => (step.kind === "strike" && step.side === "player" ? [step.attack] : []));
    expect(strikes).toEqual([3]);
  });
});

describe("Legacy of Durin (04061:A:1, A:2)", () => {
  // "Attach to a Dwarf hero.": Gimli is offered; Denethor (not a Dwarf) and the Dwarf ally are not.
  lineSpec("04061:A:1", "goes on a Dwarf hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: DWARF, seat: 0 }], hand: [{ code: LEGACY, seat: 0 }] });
    const legacy = idsOf(tab, LEGACY);
    expect(hosts(tab, legacy)).toEqual([idsOf(tab, GIMLI)]);
    expect(play(begin(tab.state), tab, legacy, idsOf(tab, GIMLI)).state.cards[legacy]?.host).toBe(idsOf(tab, GIMLI));
  });

  // Gimli holds Legacy of Durin, Denethor pays; `hand` is in the first player's hand and the deck has 3 cards.
  const scene = (effects: readonly Effect[], hand: readonly string[], deck = 3) =>
    table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: LEGACY, host: GIMLI }], hand: hand.map((code) => ({ code, seat: 0 })), playerDeck: fillers("card", deck) });

  // "Response: After you play a Dwarf character from your hand, exhaust Legacy of Durin to draw 1 card.": the Dwarf ally is played; the
  // Legacy exhausts and 1 card is drawn.
  lineSpec("04061:A:2", "after a Dwarf character is played from hand, exhaust it to draw 1 card", (effects) => {
    const tab = scene(effects, [DWARF]);
    let run = play(begin(tab.state), tab, idsOf(tab, DWARF));
    expect(triggers(run.state, tab)).toContain("04061:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, LEGACY), effectId: "04061:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, LEGACY)]?.exhausted).toBe(true);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  // A character that is not a Dwarf offers nothing.
  it("04061:A:2 is not offered after a character that is not a Dwarf is played", () => {
    const tab = scene(EFFECTS, [ELF]);
    const run = play(begin(tab.state), tab, idsOf(tab, ELF));
    expect(run.state.cards[idsOf(tab, ELF)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("04061:response:1");
  });

  // "you play": the other player's Dwarf ally played from their hand offers nothing.
  it("04061:A:2 is not offered when another player plays a Dwarf", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: GIMLI, seat: 0 }, { code: DENETHOR, seat: 1 }], attached: [{ code: LEGACY, host: GIMLI }], hand: [{ code: DWARF, seat: 1 }], playerDeck: fillers("card", 3) });
    const dwarf = idsOf(tab, DWARF);
    // Both players pass the first player's planning window; in the second player's own window, that player plays the Dwarf.
    let run = sendUnledgered(sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx), { type: "Pass" }, tab.ctx);
    expect(run.state.planningSeat).toBe(1);
    run = sendUnledgered(run, { type: "PlayCard", cardId: dwarf, payments: [{ heroId: idsOf(tab, DENETHOR), amount: 1 }] }, tab.ctx);
    expect(run.state.cards[dwarf]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("04061:response:1");
  });

  it("04061:A:2 is not offered when the deck is empty", () => {
    const tab = scene(EFFECTS, [DWARF], 0);
    const run = play(begin(tab.state), tab, idsOf(tab, DWARF));
    expect(run.state.cards[idsOf(tab, DWARF)]?.zone).toBe("play");
    expect(triggers(run.state, tab)).not.toContain("04061:response:1");
  });
});

describe("Resourceful (04062:A:2, A:3)", () => {
  // "Attach to a hero you control.": the player's own heroes are offered; the other player's hero and the ally are not.
  lineSpec("04062:A:2", "goes on a hero you control", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 0 }, { code: DENETHOR, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: RESOURCEFUL, seat: 0 }] });
    const resourceful = idsOf(tab, RESOURCEFUL);
    expect(hosts(tab, resourceful)).toEqual([idsOf(tab, PAL), idsOf(tab, SPIRIT)].sort());
  });

  // "Attached hero collects 1 additional resource during the resource phase each round.": played on the Pal, which then gains 2 in the
  // resource phase while the Spirit hero gains 1.
  lineSpec("04062:A:3", "the attached hero collects 1 additional resource in the resource phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 0 }], hand: [{ code: RESOURCEFUL, seat: 0 }], playerDeck: fillers("card", 3) });
    const [pal, spirit] = [idsOf(tab, PAL), idsOf(tab, SPIRIT)];
    const played = play(begin(tab.state), tab, idsOf(tab, RESOURCEFUL), pal);
    const before = { pal: played.state.cards[pal]?.resources ?? 0, spirit: played.state.cards[spirit]?.resources ?? 0 };
    const run = enter(played.state, tab, "resourceGrant");
    expect(run.state.cards[pal]?.resources).toBe(before.pal + 2);
    expect(run.state.cards[spirit]?.resources).toBe(before.spirit + 1);
  });
});
