// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.action, rr.response, rr.ready, rr.step-3-3, rr.step-5-2, rr.step-5-3,
// rr.step-6-8-2, wor.guarded-x (data/rules/entries.json).
// The Fire in the Night attachments, written from their card text (data/cards/FitN.json; data/printed holds no ledger for these cards
// yet): The Elvenking 19057:A:1 and A:2, Orcrist 19058:A:1 to A:4, Leather Boots 19060:A:1 and A:2, Outmatched 19062:A:2.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, hosts, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ELVENKING = "19057";
const ORCRIST = "19058";
const BOOTS = "19060";
const OUTMATCHED = "19062";
// Lórien Guide: a Silvan ally. Northern Tracker: a Spirit Ranger ally. Dúnhere: a Spirit hero that is not a Ranger.
const GUIDE = "01044";
const TRACKER = "01045";
const DUNHERE = "01009";
// A treachery and a location of scenario 1's encounter deck.
const CRAWLING = "141041";
const GREEN_HILL = "141036";
const ALLY = "ally";
const PAL = "pal";
// A Silvan hero and a Lore hero with no text; an enemy one attack destroys and one that survives.
const SILVAN = "silvan-lord";
const SAGE = "sage";
const WEAK = "weak";
const TOUGH = "tough";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ELVENKING, ORCRIST, BOOTS, OUTMATCHED, GUIDE, TRACKER, DUNHERE, CRAWLING, GREEN_HILL]))]);
  cards.set(SILVAN, definePrinted({ code: SILVAN, name: "Silvan Lord", type: "hero", sphere: "leadership", threat: 9, willpower: 1, attack: 2, defense: 2, health: 4, traits: ["Silvan"] }));
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 2, attack: 1, defense: 1, health: 3 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  cards.set(TOUGH, definePrinted({ code: TOUGH, name: "Tough", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 20 }));
  base = { ...starter, cards };
});

describe("The Elvenking (19057)", () => {
  // "Attach to a Silvan hero.": the Silvan Lord; not the Sage, nor the Lórien Guide (a Silvan ally).
  lineSpec("19057:A:1", "goes on a Silvan hero, not on another hero or a Silvan ally", (effects) => {
    const tab = table(effects, { heroes: [{ code: SILVAN, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }], hand: [{ code: ELVENKING, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, ELVENKING))).toEqual([idsOf(tab, SILVAN)]);
  });

  // "Action: Exhaust The Elvenking and return a Silvan ally you control to your hand to ready attached hero.": the Lórien Guide is the
  // only choice (the plain ally is not Silvan); it goes to the hand, the Elvenking exhausts and the Silvan Lord readies.
  lineSpec("19057:A:2", "exhausts and returns a Silvan ally to the hand to ready the attached hero", (effects) => {
    const scene = table(effects, { heroes: [{ code: SILVAN, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: GUIDE, seat: 0 }, { code: ALLY, seat: 0 }], attached: [{ code: ELVENKING, host: SILVAN }] });
    const [lord, king, guide] = [idsOf(scene, SILVAN), idsOf(scene, ELVENKING), idsOf(scene, GUIDE)];
    const tab = { ...scene, state: updateCard(scene.state, lord, { exhausted: true }) };
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: king, effectId: "19057:action:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[guide]?.zone).toBe("hand");
    expect(run.state.cards[idsOf(tab, ALLY)]?.zone).toBe("play");
    expect(run.state.cards[king]?.exhausted).toBe(true);
    expect(run.state.cards[lord]?.exhausted).toBe(false);
  });

  // With no Silvan ally to return (the other player's Lórien Guide is not one you control), the Action is not offered.
  it("19057:A:2 is not offered without a Silvan ally you control", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: SILVAN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: GUIDE, seat: 1 }], attached: [{ code: ELVENKING, host: SILVAN }] });
    expect(triggers(updateCard(tab.state, idsOf(tab, SILVAN), { exhausted: true }), tab)).not.toContain("19057:action:1");
  });
});

describe("Orcrist (19058)", () => {
  // Played, Orcrist goes to the staging area's pseudo host and searches for its guard: the encounter deck holds a treachery over the guard.
  function guarded(effects: readonly Effect[], guard: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: SILVAN, seat: 0 }, { code: SAGE, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: ORCRIST, seat: 0 }], deck: [CRAWLING, guard] });
    const sword = idsOf(tab, ORCRIST);
    const [hostId] = hosts(tab, sword);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: sword, hostId, payments: payFor(tab.state, tab.ctx, sword) }, tab.ctx);
    return { tab, run };
  }

  // "Guarded (enemy or location).": the location under the treachery guards it in the staging area (wor.guarded-x).
  lineSpec("19058:A:1", "is guarded by the first enemy or location of the encounter deck", (effects) => {
    const { tab, run } = guarded(effects, GREEN_HILL);
    const sword = idsOf(tab, ORCRIST);
    const location = idsOf(tab, GREEN_HILL);
    expect(run.state.cards[idsOf(tab, CRAWLING)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[location]?.zone).toBe("staging");
    expect(run.state.cards[location]?.attachments).toEqual([sword]);
  });

  // "Attach to a hero.": once its guarding enemy is destroyed, it goes on the hero the player picks; the ally is not offered.
  lineSpec("19058:A:2", "once free of encounters, goes on a hero of the player's choice", (effects) => {
    const { tab, run: played } = guarded(effects, "f3");
    const sword = idsOf(tab, ORCRIST);
    const enemy = idsOf(tab, "f3");
    let run = sendUnledgered(begin(placeDamage(played.state, enemy, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, SILVAN), idsOf(tab, SAGE)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, SAGE) }, tab.ctx);
    expect(run.state.cards[sword]).toMatchObject({ host: idsOf(tab, SAGE), zone: "play" });
  });

  // "Attached hero gets +2 Attack."
  lineSpec("19058:A:3", "the attached hero gets +2 Attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: SILVAN, seat: 0 }, { code: SAGE, seat: 0 }], attached: [{ code: ORCRIST, host: SILVAN }] });
    expect(stat(tab.state, tab, idsOf(tab, SILVAN), "attack")).toBe((tab.ctx.cards.get(SILVAN)?.attack ?? 0) + 2);
    expect(stat(tab.state, tab, idsOf(tab, SAGE), "attack")).toBe(tab.ctx.cards.get(SAGE)?.attack ?? 0);
  });

  // "Response: After attached hero destroys an enemy, add 1 resource to attached hero's pool."
  lineSpec("19058:A:4", "after the attached hero destroys an enemy, 1 resource to his pool", (effects) => {
    const tab = table(effects, { heroes: [{ code: SILVAN, seat: 0 }, { code: SAGE, seat: 0 }], attached: [{ code: ORCRIST, host: SILVAN }], engaged: [{ code: WEAK, seat: 0 }] });
    const lord = idsOf(tab, SILVAN);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [lord] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    const pool = run.state.cards[lord]?.resources ?? 0;
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, ORCRIST), effectId: "19058:response:1" }, tab.ctx);
    expect(run.state.cards[lord]?.resources).toBe(pool + 1);
    expect(run.state.cards[idsOf(tab, SAGE)]?.resources).toBe(tab.state.cards[idsOf(tab, SAGE)]?.resources);
  });

  // An enemy that survives, or one another hero destroys, gives no Response.
  it("19058:A:4 is not offered when the enemy survives or another hero destroys it", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SILVAN, seat: 0 }, { code: SAGE, seat: 0 }], attached: [{ code: ORCRIST, host: SILVAN }], engaged: [{ code: TOUGH, seat: 0 }, { code: WEAK, seat: 0 }] });
    const survived = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, TOUGH), attackerIds: [idsOf(tab, SILVAN)] }, tab.ctx);
    expect(triggers(survived.state, tab)).not.toContain("19058:response:1");
    const other = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, SAGE)] }, tab.ctx);
    expect(other.state.cards[idsOf(tab, WEAK)]?.zone).not.toBe("engaged");
    expect(triggers(other.state, tab)).not.toContain("19058:response:1");
  });
});

describe("Leather Boots (19060)", () => {
  // "Attach to a Lore or Ranger character. Limit 1 per character.": the Sage (Lore) and the Northern Tracker (a Spirit Ranger); not
  // Dúnhere (Spirit) or the plain ally, nor a second Tracker that wears Boots already.
  lineSpec("19060:A:1", "goes on a Lore or a Ranger character, one per character", (effects) => {
    const scene = table(effects, { heroes: [{ code: SAGE, seat: 0 }, { code: DUNHERE, seat: 0 }], allies: [{ code: TRACKER, seat: 0 }, { code: TRACKER, seat: 0 }, { code: ALLY, seat: 0 }, { code: BOOTS, seat: 0 }], hand: [{ code: BOOTS, seat: 0 }] });
    const [worn, held] = scene.ids[BOOTS] ?? [];
    const [tracker, booted] = scene.ids[TRACKER] ?? [];
    const tab = attach(scene, [[worn ?? "", booted ?? ""]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, SAGE), tracker ?? ""].sort());
  });

  // The Sage wears the Boots and commits to the quest (exhausting); the encounter deck reveals `top` in the staging step.
  function staged(effects: readonly Effect[], top: string): { tab: Table; run: Run } {
    const tab = table(effects, { start: "quest", heroes: [{ code: SAGE, seat: 0 }, { code: DUNHERE, seat: 0 }], attached: [{ code: BOOTS, host: SAGE }], deck: [top, CRAWLING] });
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, SAGE)] }, tab.ctx);
    for (let guard = 0; guard < 20 && run.state.cards[idsOf(tab, top)]?.zone === "encounterDeck" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"); guard += 1) {
      run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    }
    return { tab, run };
  }

  // "Response: After a location is revealed from the encounter deck, exhaust Leather Boots to ready attached character.": Green Hill
  // Country is revealed; the Boots exhaust and the Sage readies.
  lineSpec("19060:A:2", "after a location is revealed, exhausts to ready the attached character", (effects) => {
    const { tab, run: revealed } = staged(effects, GREEN_HILL);
    expect(revealed.state.cards[idsOf(tab, GREEN_HILL)]?.zone).toBe("staging");
    expect(revealed.state.cards[idsOf(tab, SAGE)]?.exhausted).toBe(true);
    const run = sendUnledgered(revealed, { type: "Trigger", cardId: idsOf(tab, BOOTS), effectId: "19060:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BOOTS)]?.exhausted).toBe(true);
    expect(run.state.cards[idsOf(tab, SAGE)]?.exhausted).toBe(false);
  });

  it("19060:A:2 is not offered after a treachery is revealed", () => {
    const { tab, run } = staged(EFFECTS, CRAWLING);
    expect(triggers(run.state, tab)).not.toContain("19060:response:1");
  });
});

describe("Outmatched (19062:A:2)", () => {
  // "If unattached, attach to the next eligible enemy that engages you.": Outmatched lies unattached in the first player's play area. The
  // first player declines the optional engagement and the second engages the Weak enemy, which does not take Outmatched. The engagement
  // checks then engage the Cheap enemy (engagement cost 2) with the first player, and Outmatched attaches to it.
  lineSpec("19062:A:2", "attaches to the next enemy that engages its player, not to one that engages another player", (effects) => {
    const tab = table(effects, { seats: 2, start: "encounter", heroes: [{ code: SAGE, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: OUTMATCHED, seat: 0 }], staging: [WEAK, "cheap"] });
    const [trap, weak, cheap] = [idsOf(tab, OUTMATCHED), idsOf(tab, WEAK), idsOf(tab, "cheap")];
    expect(tab.state.cards[trap]).toMatchObject({ zone: "play", host: null });
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = sendUnledgered(run, { type: "Engage", enemyId: weak }, tab.ctx);
    // The second player engages the Weak enemy; the engagement checks follow and engage the Cheap enemy with the first player.
    expect(run.state.seats[1]?.engaged).toEqual([weak]);
    expect(run.state.seats[0]?.engaged).toEqual([cheap]);
    expect(run.state.cards[cheap]?.zone).toBe("engaged");
    expect(run.state.cards[trap]?.host).toBe(cheap);
    expect(run.state.cards[cheap]?.attachments).toContain(trap);
    expect(run.state.cards[weak]?.attachments).toEqual([]);
  });
});
