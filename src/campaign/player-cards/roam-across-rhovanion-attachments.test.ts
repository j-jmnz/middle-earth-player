// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.hit-points, rr.active-location, rr.step-3-4, rr.travel, wor.guarded-x,
// rr.guarded, rr.destroy, rr.response (data/rules/entries.json).
// Roam Across Rhovanion attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Ancestral
// Armor 19028:A:1, A:2 and A:3, Glamdring 19029:A:1, A:2, A:3 and A:4, Woodmen's Path 19030:A:1 and A:2. The lines are the text of
// data/cards/RAR.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, hosts, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARMOR = "19028";
const GLAMDRING = "19029";
const PATH = "19030";
// Core Aragorn (Leadership, Noble), Théodred (Leadership, Noble), Éowyn (Spirit, Noble), Thalin (Tactics, Dwarf Warrior), Denethor (Lore).
const ARAGORN = "01001";
const THEODRED = "01002";
const THALIN = "01006";
const EOWYN = "01007";
const DENETHOR = "01010";
// Snowbourn Scout: a Leadership ally, not Noble. Wandering Took: a Spirit Hobbit ally. Gandalf: the core Gandalf ally.
const SNOWBOURN = "01016";
const TOOK = "01043";
const GANDALF = "01073";
// Crawling Towards Him: a treachery of scenario 1's encounter deck, for Glamdring's guard.
const CRAWLING = "141041";
const GLADE = "glade";
const WEAK = "weak";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARMOR, GLAMDRING, PATH, ARAGORN, THEODRED, THALIN, EOWYN, DENETHOR, SNOWBOURN, TOOK, GANDALF, CRAWLING];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  // A location with no Travel effect, quest points 5.
  cards.set(GLADE, definePrinted({ code: GLADE, name: "Glade", type: "location", threat: 1, questPoints: 5 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  base = { ...starter, cards };
});

describe("Ancestral Armor (19028:A:1, A:2, A:3)", () => {
  // Aragorn pays; Théodred already wears an Armor.
  function armorTable(effects: readonly Effect[]): { tab: Table; held: string } {
    const scene = table(effects, {
      heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }, { code: THALIN, seat: 0 }, { code: THEODRED, seat: 0 }],
      allies: [{ code: SNOWBOURN, seat: 0 }, { code: TOOK, seat: 0 }, { code: ARMOR, seat: 0 }],
      hand: [{ code: ARMOR, seat: 0 }],
    });
    const [worn, held] = scene.ids[ARMOR] ?? [];
    const state = syncConstants(attachTo(scene.state, worn ?? "", idsOf(scene, THEODRED)), scene.ctx);
    return { tab: { ...scene, state }, held: held ?? "" };
  }

  // "Attach to a Leadership or Noble character.": Aragorn (Leadership and Noble), Éowyn (Noble, Spirit) and the Snowbourn Scout (a
  // Leadership ally, not Noble) are offered; Thalin and the Wandering Took (neither) are not.
  lineSpec("19028:A:1", "Ancestral Armor: Attach to a Leadership or Noble character", (effects) => {
    const { tab, held } = armorTable(effects);
    const offered = hosts(tab, held);
    expect(offered).toContain(idsOf(tab, ARAGORN));
    expect(offered).toContain(idsOf(tab, EOWYN));
    expect(offered).toContain(idsOf(tab, SNOWBOURN));
    expect(offered).not.toContain(idsOf(tab, THALIN));
    expect(offered).not.toContain(idsOf(tab, TOOK));
  });

  // "Limit 1 per character": Théodred, who already wears one, is not offered.
  lineSpec("19028:A:2", "Ancestral Armor: Limit 1 per character", (effects) => {
    const { tab, held } = armorTable(effects);
    expect(hosts(tab, held)).not.toContain(idsOf(tab, THEODRED));
    expect(hosts(tab, held)).toContain(idsOf(tab, ARAGORN));
  });

  // "Attached characters gets +2 Defense and +2 hit points.": played on Aragorn through the intent.
  lineSpec("19028:A:3", "Ancestral Armor: +2 Defense and +2 hit points", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: ARMOR, seat: 0 }] });
    const aragorn = idsOf(tab, ARAGORN);
    const run = play(begin(tab.state), tab, idsOf(tab, ARMOR), aragorn);
    expect(stat(run.state, tab, aragorn, "defense")).toBe(2 + 2);
    expect(stat(run.state, tab, aragorn, "hitPoints")).toBe(5 + 2);
  });
});

describe("Glamdring (19029)", () => {
  // Glamdring is played from the hand; the encounter deck holds a treachery over the enemy that guards it. Denethor (Lore) pays.
  function guarded(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }], allies: [{ code: GANDALF, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: GLAMDRING, seat: 0 }], deck: [CRAWLING, "f3"] });
    const glamdring = idsOf(tab, GLAMDRING);
    const [hostId] = hosts(tab, glamdring);
    return { tab, run: play(begin(tab.state), tab, glamdring, hostId) };
  }

  // "Guarded (enemy or location)": cards are discarded from the encounter deck until an enemy, which is added to the staging area with
  // Glamdring attached to it (wor.guarded-x); the treachery above it is discarded.
  lineSpec("19029:A:1", "Glamdring: Guarded (enemy or location)", (effects) => {
    const { tab, run } = guarded(effects);
    const [glamdring, enemy] = [idsOf(tab, GLAMDRING), idsOf(tab, "f3")];
    expect(run.state.cards[idsOf(tab, CRAWLING)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[enemy]?.zone).toBe("staging");
    expect(run.state.cards[enemy]?.attachments).toEqual([glamdring]);
    expect(run.state.cards[glamdring]?.host).toBe(enemy);
  });

  // Once free of encounters its owner attaches it to an eligible card (wor.guarded-x). "Attach to a hero or Gandalf.": the guarding enemy
  // is destroyed; Denethor, Éowyn and the Gandalf ally are offered, the plain ally is not.
  lineSpec("19029:A:2", "Glamdring: once free of its guard, attached to a hero or Gandalf", (effects) => {
    const { tab, run: played } = guarded(effects);
    const [glamdring, enemy] = [idsOf(tab, GLAMDRING), idsOf(tab, "f3")];
    let run = sendUnledgered(begin(placeDamage(played.state, enemy, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, DENETHOR), idsOf(tab, EOWYN), idsOf(tab, GANDALF)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, GANDALF) }, tab.ctx);
    expect(run.state.cards[glamdring]).toMatchObject({ zone: "play", host: idsOf(tab, GANDALF) });
  });

  // "Attached character gets +2 Attack"
  lineSpec("19029:A:3", "Glamdring: attached character gets +2 Attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: GLAMDRING, host: DENETHOR }] });
    const state = syncConstants(tab.state, tab.ctx);
    expect(stat(state, tab, idsOf(tab, DENETHOR), "attack")).toBe(1 + 2);
    expect(stat(state, tab, idsOf(tab, EOWYN), "attack")).toBe(1);
  });

  // "Response: After attached character destroys an enemy, draw 1 card.": Denethor with Glamdring (Attack 3) destroys the Weak enemy and
  // his player draws 1. Éowyn, who holds no Glamdring, destroying one gives no Response.
  lineSpec("19029:A:4", "Glamdring: after the attached character destroys an enemy, draw 1 card", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: GLAMDRING, host: DENETHOR }], engaged: [{ code: WEAK, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }] });
    const weak = idsOf(tab, WEAK);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    expect(run.state.cards[weak]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).toContain("19029:response:1");
    const hand = run.state.seats[0]?.hand.length ?? 0;
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, GLAMDRING), effectId: "19029:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand.length).toBe(hand + 1);
    let other = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [idsOf(tab, EOWYN)] }, tab.ctx);
    // Éowyn's own Action opens a framework action window first.
    for (let guard = 0; guard < 10 && other.state.window?.kind === "frameAction"; guard += 1) other = sendUnledgered(other, { type: "Pass" }, tab.ctx);
    expect(other.state.cards[weak]?.zone).toBe("encounterDiscard");
    expect(triggers(other.state, tab)).not.toContain("19029:response:1");
  });
});

// Reading (docs/brief.md, Three layers): an attack the attached character takes part in counts, so the Response is offered when
// he and another character attack one enemy together and destroy it.
describe("Glamdring (19029:A:4), an attack together", () => {
  it("19029:A:4 Glamdring: offered when the attached character and another attack one enemy together and destroy it", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: GLAMDRING, host: DENETHOR }], engaged: [{ code: WEAK, seat: 0 }], playerDeck: [{ code: "card", seat: 0 }, { code: "card", seat: 0 }] });
    const weak = idsOf(tab, WEAK);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: weak, attackerIds: [idsOf(tab, DENETHOR), idsOf(tab, EOWYN)] }, tab.ctx);
    // Éowyn's own Action opens a framework action window first.
    for (let guard = 0; guard < 10 && run.state.window?.kind === "frameAction" && !triggers(run.state, tab).includes("19029:response:1"); guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.cards[weak]?.zone).toBe("encounterDiscard");
    expect(triggers(run.state, tab)).toContain("19029:response:1");
  });
});

describe("Woodmen's Path (19030:A:1, A:2)", () => {
  // "Attach to a location with no progress tokens on it.": the staging area's location with no progress and the active location with none
  // are offered; a location with 1 progress, an enemy and a hero are not.
  lineSpec("19030:A:1", "Woodmen's Path: Attach to a location with no progress tokens on it", (effects) => {
    const scene = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: PATH, seat: 0 }], staging: [GLADE, GLADE, WEAK], active: GLADE });
    const [clear, marked, active] = scene.ids[GLADE] ?? [];
    const tab = { ...scene, state: updateCard(scene.state, marked ?? "", { progress: 1 }) };
    expect(hosts(tab, idsOf(tab, PATH))).toEqual([clear ?? "", active ?? ""].sort());
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, PATH), hostId: idsOf(tab, DENETHOR), payments: payFor(tab.state, tab.ctx, idsOf(tab, PATH)) }, tab.ctx)).not.toBeNull();
    expect(play(begin(tab.state), tab, idsOf(tab, PATH), clear).state.cards[idsOf(tab, PATH)]?.host).toBe(clear);
  });

  // "While attached location is the active location, reduce its quest point value to 1.": played on a Glade in the staging area (5 quest
  // points), it keeps 5 there; once the players travel to it, 1.
  lineSpec("19030:A:2", "Woodmen's Path: while the attached location is active, its quest point value is 1", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: PATH, seat: 0 }], staging: [GLADE, GLADE] });
    const [glade, other] = tab.ids[GLADE] ?? [];
    const played = play(begin(tab.state), tab, idsOf(tab, PATH), glade);
    expect(stat(played.state, tab, glade ?? "", "questPoints")).toBe(5);
    const travel = { ...played.state, phase: "Travel" as const, boundaryPhase: "Travel" as const, mode: "travel" as const, window: { kind: "travel" as const } };
    const run = sendUnledgered(begin(travel), { type: "Travel", locationId: glade ?? "" }, tab.ctx);
    expect(run.state.cards[glade ?? ""]?.zone).toBe("activeLocation");
    expect(stat(run.state, tab, glade ?? "", "questPoints")).toBe(1);
    expect(stat(run.state, tab, other ?? "", "questPoints")).toBe(5);
  });

  // The other Glade, active with no Path, keeps its 5.
  it("19030:A:2 Woodmen's Path: an active location without it keeps its quest points", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], active: GLADE });
    expect(stat(tab.state, tab, idsOf(tab, GLADE), "questPoints")).toBe(5);
  });
});
