// Rules: rr.attachment-cards, rr.restricted, rr.staging, rr.step-3-4, rr.ready, rr.cost, rr.action, rr.engaged, rr.modifiers,
// rr.lasting-effects (data/rules/entries.json).
// The Land of Shadow attachments and its event, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Staff of Lebethron 144008:A:1, Ambush 144009:A:1, Snowmane 144010:A:1 and A:3, In the Shadows 144012:A:1 and A:2. The lines of 144008,
// 144009 and 144012 are the text of data/cards/LoS.json (data/printed/the-two-towers.json holds no entry for them), so every intent goes
// through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode, type ScenarioState } from "../../rules/core/state.ts";
import { settle } from "../../rules/engine/machine.ts";
import { playCost } from "../../rules/player/attach.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { combat, hosts, passWhile, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const FARAMIR = "144002";
const STAFF = "144008";
const AMBUSH = "144009";
const SNOWMANE = "144010";
const SHADOWS = "144012";
// Core Aragorn (Leadership, Ranger), Théodred (Leadership, Rohan), Éowyn (Spirit, Rohan), Eleanor (Spirit, Gondor), Denethor (Lore, Gondor).
const ARAGORN = "01001";
const THEODRED = "01002";
const EOWYN = "01007";
const ELEANOR = "01008";
const DENETHOR = "01010";
// Snowbourn Scout: a Rohan ally. Gondorian Spearman: a Gondor ally. Wandering Took: a Hobbit ally.
const SNOWBOURN = "01016";
const SPEARMAN = "01029";
const TOOK = "01043";
const GREEN_HILL = "141036";
const WEAK = "weak";
const LOW = "low";
const HEAVY = "heavy";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [FARAMIR, STAFF, AMBUSH, SNOWMANE, SHADOWS, ARAGORN, THEODRED, EOWYN, ELEANOR, DENETHOR, SNOWBOURN, SPEARMAN, TOOK, GREEN_HILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 0, engagementCost: 30, attack: 3, defense: 2, health: 9 }));
  // Engagement cost 2, under the threat of 8.
  cards.set(LOW, definePrinted({ code: LOW, name: "Low", type: "enemy", threat: 0, engagementCost: 2, attack: 3, defense: 2, health: 9 }));
  // Threat 9 in the staging area: no hero of these tests quests past it.
  cards.set(HEAVY, definePrinted({ code: HEAVY, name: "Heavy", type: "enemy", threat: 9, engagementCost: 50, attack: 1, defense: 1, health: 9 }));
  base = { ...starter, cards };
});

// The quest phase: the characters commit, the player passes and the staging step reveals the encounter deck's top card.
function quest(tab: Table, cardIds: readonly string[], state: ScenarioState = tab.state): Run {
  const committed = sendUnledgered(begin({ ...withMode(state, "questCommit"), phase: "Quest", boundaryPhase: "Quest", window: { kind: "pass" } }), { type: "Commit", cardIds }, tab.ctx);
  return sendUnledgered(committed, { type: "Pass" }, tab.ctx);
}

describe("Staff of Lebethron (144008:A:1)", () => {
  // "Attach to a Gondor or Hobbit hero.": Denethor (Gondor hero) and a Hobbit hero are offered; Aragorn (who pays), the Gondorian Spearman
  // (a Gondor ally) and the Wandering Took (a Hobbit ally) are not.
  lineSpec("144008:A:1", "Staff of Lebethron: Attach to a Gondor or Hobbit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: PAL, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: TOOK, seat: 0 }], hand: [{ code: STAFF, seat: 0 }] });
    const staff = idsOf(tab, STAFF);
    expect(hosts(tab, staff)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, staff, idsOf(tab, PAL)).state.cards[staff]?.host).toBe(idsOf(tab, PAL));
  });
});

describe("Ambush (144009:A:1)", () => {
  // "Play Ambush into the staging area unattached. If unattached, attach Ambush to the next eligible enemy that enters the staging area.":
  // played, it sits in the staging area with no host; a location revealed does not take it; the enemy revealed next does, and a second
  // enemy revealed after that does not.
  lineSpec("144009:A:1", "Ambush: played into the staging area unattached, attached to the next enemy that enters it", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: EOWYN, seat: 0 }], hand: [{ code: AMBUSH, seat: 0 }], deck: [GREEN_HILL, WEAK, WEAK] });
    const ambush = idsOf(tab, AMBUSH);
    const [first, second] = tab.ids[WEAK] ?? [];
    expect(hosts(tab, ambush)).toEqual(["staging"]);
    const played = play(begin(tab.state), tab, ambush, "staging");
    expect(played.state.cards[ambush]).toMatchObject({ zone: "staging", host: null, controller: 0 });
    let run = quest(tab, [idsOf(tab, DENETHOR)], played.state);
    expect(run.state.cards[idsOf(tab, GREEN_HILL)]?.zone).toBe("staging");
    expect(run.state.cards[ambush]?.host).toBeNull();
    run = quest(tab, [idsOf(tab, ELEANOR)], { ...run.state, revealCursor: null });
    expect(run.state.cards[first ?? ""]?.zone).toBe("staging");
    expect(run.state.cards[ambush]).toMatchObject({ host: first, controller: 0 });
    run = quest(tab, [idsOf(tab, EOWYN)], { ...run.state, revealCursor: null });
    expect(run.state.cards[second ?? ""]?.zone).toBe("staging");
    expect(run.state.cards[ambush]?.host).toBe(first);
  });
});

describe("Snowmane (144010:A:1, A:3)", () => {
  // "Attach to a Rohan hero.": Éowyn and Théodred (Rohan heroes) are offered; Eleanor (Gondor hero) and the Snowbourn Scout (a Rohan ally) are not.
  lineSpec("144010:A:1", "Snowmane: Attach to a Rohan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: ELEANOR, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], hand: [{ code: SNOWMANE, seat: 0 }] });
    const snowmane = idsOf(tab, SNOWMANE);
    expect(hosts(tab, snowmane)).toEqual([idsOf(tab, EOWYN), idsOf(tab, THEODRED)].sort());
    expect(play(begin(tab.state), tab, snowmane, idsOf(tab, THEODRED)).state.cards[snowmane]?.host).toBe(idsOf(tab, THEODRED));
  });

  // "Response: After attached hero quests successfully, ready attached hero.": Éowyn (Willpower 4) quests with Snowmane against a Threat 0
  // reveal: the quest succeeds and she is readied.
  lineSpec("144010:A:3", "Snowmane: after the hero quests successfully, ready her", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: SNOWMANE, host: EOWYN }], deck: ["f0", "f0"] });
    const eowyn = idsOf(tab, EOWYN);
    let run = quest(tab, [eowyn]);
    run = passWhile(run, tab, (run) => !triggers(run.state, tab).includes("144010:response:1") && run.state.phase === "Quest", 10);
    expect(run.state.cards[eowyn]?.exhausted).toBe(true);
    expect(triggers(run.state, tab)).toContain("144010:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, SNOWMANE), effectId: "144010:response:1" }, tab.ctx);
    expect(run.state.cards[eowyn]?.exhausted).toBe(false);
  });

  // Snowmane is on Denethor, who stays back; Éowyn quests successfully alone: Denethor did not quest, so no Response.
  it("144010:A:3 Snowmane: not offered when the attached hero did not quest", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: SNOWMANE, host: DENETHOR }], deck: ["f0", "f0"] });
    let run = quest(tab, [idsOf(tab, EOWYN)]);
    for (let guard = 0; guard < 10 && run.state.phase === "Quest"; guard += 1) {
      expect(triggers(run.state, tab)).not.toContain("144010:response:1");
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    }
    expect(run.state.phase).not.toBe("Quest");
  });

  // The quest fails against a Threat 9 enemy in the staging area: no Response.
  it("144010:A:3 Snowmane: not offered when the quest fails", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }], attached: [{ code: SNOWMANE, host: EOWYN }], staging: [HEAVY], deck: ["f0", "f0"] });
    let run = quest(tab, [idsOf(tab, EOWYN)]);
    for (let guard = 0; guard < 10 && run.state.phase === "Quest"; guard += 1) {
      expect(triggers(run.state, tab)).not.toContain("144010:response:1");
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    }
    expect(run.state.cards[idsOf(tab, EOWYN)]?.exhausted).toBe(true);
  });
});

describe("In the Shadows (144012:A:1, A:2)", () => {
  // "Lower the cost to play In the Shadows by 1 for each Hobbit or Ranger hero you control.": Aragorn (Ranger) and a Hobbit hero lower it
  // from 3 to 1; Denethor counts for nothing, nor does the other player's Ranger hero (Faramir).
  lineSpec("144012:A:1", "In the Shadows: 1 less for each Hobbit or Ranger hero you control", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: FARAMIR, seat: 1 }], hand: [{ code: SHADOWS, seat: 0 }] });
    expect(playCost(tab.state, idsOf(tab, SHADOWS), 0, tab.ctx)).toBe(1);
  });

  // "Combat Action: Each enemy engaged with you with engagement cost higher than your threat gets -1 Attack and -1 Defense until the end of
  // the phase.": the threat is 8; the enemy engaged with you at engagement cost 30 gets -1/-1; the one at 2 does not, nor the other
  // player's enemy at 30. The penalty ends with the combat phase.
  lineSpec("144012:A:2", "In the Shadows: each enemy engaged with you with engagement cost above your threat gets -1 Attack and -1 Defense this phase", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: SHADOWS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }, { code: LOW, seat: 0 }, { code: WEAK, seat: 1 }] });
    const [mine, theirs] = tab.ids[WEAK] ?? [];
    const low = idsOf(tab, LOW);
    const run = play(combat(tab.state, tab), tab, idsOf(tab, SHADOWS));
    expect(run.state.cards[idsOf(tab, SHADOWS)]?.zone).toBe("discard");
    expect([stat(run.state, tab, mine ?? "", "attack"), stat(run.state, tab, mine ?? "", "defense")]).toEqual([2, 1]);
    expect([stat(run.state, tab, low, "attack"), stat(run.state, tab, low, "defense")]).toEqual([3, 2]);
    expect([stat(run.state, tab, theirs ?? "", "attack"), stat(run.state, tab, theirs ?? "", "defense")]).toEqual([3, 2]);
    const after = settle({ ...withMode(run.state, "refresh"), window: null }, tab.ctx, []);
    expect([stat(after, tab, mine ?? "", "attack"), stat(after, tab, mine ?? "", "defense")]).toEqual([3, 2]);
  });

  // A Combat Action: it cannot be played in the planning phase.
  it("144012:A:2 In the Shadows: not playable outside the combat phase", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: SHADOWS, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(() => play(begin(tab.state), tab, idsOf(tab, SHADOWS))).toThrow(/refused/);
  });
});
