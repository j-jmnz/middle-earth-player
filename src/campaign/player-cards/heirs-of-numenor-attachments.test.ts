// Rules: rr.attachment-cards, rr.restricted, rr.response, rr.action, rr.limits, rr.lasting-effects, rr.staging-area, rr.engagement-check,
// rr.step-3-3, rr.step-5-3, rr.step-6-4-1 (data/rules/entries.json).
// The Heirs of Númenor attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Spear of the
// Citadel 05009:A:2 and A:3, Blood of Númenor 05013:A:1 and A:2, Ranger Spikes 05017:A:1 to A:3. The lines are the text of
// data/cards/HoN.json (the ledger lines in data/printed are read from the scans).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { type Run, type Scene, type Table, begin, idsOf, send } from "../../../test/harness/scene.ts";
import { atDefense, attach, enter, hosts, passAll, play, playerTableFor, stat, triggers } from "../../../test/harness/player-table.ts";

const SPEAR = "05009";
const BLOOD = "05013";
const SPIKES = "05017";
// Core Aragorn (Leadership, Dúnedain), Legolas (Tactics hero), Eleanor (Spirit, Gondor), Denethor (Lore, Gondor), Guard of the Citadel
// (a Leadership Gondor ally), Gondorian Spearman (a Tactics ally).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const ELEANOR = "01008";
const DENETHOR = "01010";
const GUARD = "01013";
const SPEARMAN = "01029";
const PAL = "pal";
// A Spirit hero with no Trait; an enemy no attack here destroys; an enemy of Threat 3 and engagement cost 2 (under the threat of 8).
const SPIRIT = "spirit";
const WEAK = "weak";
const LURKER = "lurker";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SPEAR, BLOOD, SPIKES, ARAGORN, LEGOLAS, ELEANOR, DENETHOR, GUARD, SPEARMAN]))]);
  cards.set(SPIRIT, definePrinted({ code: SPIRIT, name: "Spirit", type: "hero", sphere: "spirit", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  cards.set(LURKER, definePrinted({ code: LURKER, name: "Lurker", type: "enemy", threat: 3, engagementCost: 2, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Spear of the Citadel (05009:A:2, A:3)", () => {
  // "Attach to a Tactics character. Limit 1 per character.": Legolas and a Gondorian Spearman are offered; Denethor (Lore), the Guard of
  // the Citadel (Leadership) and the Spearman that holds a Spear already are not.
  lineSpec("05009:A:2", "goes on a Tactics character, one per character", (effects) => {
    const scene = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }, { code: SPEARMAN, seat: 0 }, { code: GUARD, seat: 0 }, { code: SPEAR, seat: 0 }], hand: [{ code: SPEAR, seat: 0 }] });
    const [worn, held] = scene.ids[SPEAR] ?? [];
    const [free, armed] = scene.ids[SPEARMAN] ?? [];
    const tab = attach(scene, [[worn ?? "", armed ?? ""]]);
    expect(hosts(tab, held ?? "")).toEqual([idsOf(tab, LEGOLAS), free ?? ""].sort());
    expect(play(begin(tab.state), tab, held ?? "", free).state.cards[held ?? ""]?.host).toBe(free);
  });

  // Legolas holds the Spear; `defender` defends the Weak enemy's attack.
  function defends(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: SPEAR, host: LEGOLAS }], engaged: [{ code: WEAK, seat: 0 }] });
    let run = atDefense(tab);
    run = send(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx);
    return { tab, run };
  }

  // "Response: After attached character is declared as a defender, deal 1 damage to the attacking enemy.": Legolas defends; the Weak enemy
  // takes 1 damage.
  lineSpec("05009:A:3", "after the attached character is declared as a defender, 1 damage to the attacking enemy", (effects) => {
    const { tab, run: declared } = defends(effects, LEGOLAS);
    expect(triggers(declared.state, tab)).toContain("05009:response:1");
    const run = send(declared, { type: "Trigger", cardId: idsOf(tab, SPEAR), effectId: "05009:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, WEAK)]?.damage).toBe(1);
  });

  // Denethor defends instead: no Response.
  it("05009:A:3 is not offered when another character defends", () => {
    const { tab, run } = defends(EFFECTS, DENETHOR);
    expect(triggers(run.state, tab)).not.toContain("05009:response:1");
  });
});

describe("Blood of Númenor (05013:A:1, A:2)", () => {
  // "Attach to a Gondor or Dúnedain hero.": Denethor (Gondor), Aragorn (Dúnedain) and the other player's Eleanor (Gondor) are offered; the
  // Pal and the Guard of the Citadel (a Gondor ally) are not.
  lineSpec("05013:A:1", "goes on a Gondor or Dúnedain hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: SPIRIT, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: PAL, seat: 0 }, { code: ELEANOR, seat: 1 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: BLOOD, seat: 0 }] });
    const blood = idsOf(tab, BLOOD);
    expect(hosts(tab, blood)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, ARAGORN), idsOf(tab, ELEANOR)].sort());
    expect(play(begin(tab.state), tab, blood, idsOf(tab, ARAGORN)).state.cards[blood]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // Denethor (Defense 3) holds the Blood with `resources` in his pool.
  function scene(effects: readonly Effect[], resources: number): Table {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], attached: [{ code: BLOOD, host: DENETHOR }] });
    return { ...tab, state: updateCard(tab.state, idsOf(tab, DENETHOR), { resources }) };
  }

  // "Action: Spend 1 resource from attached hero's resource pool to give attached hero +1 Defense for each resource in its resource pool
  // until the end of the phase. (Limit once per phase.)": 4 resources, 1 spent, 3 left: Denethor has Defense 3 + 3 until the planning
  // phase ends. The Action is not offered a second time that phase, and is again in the next.
  lineSpec("05013:A:2", "spends 1 resource for +1 Defense per resource left, once per phase, until the end of the phase", (effects) => {
    const tab = scene(effects, 4);
    const denethor = idsOf(tab, DENETHOR);
    const run = send(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, BLOOD), effectId: "05013:action:1", payments: [{ heroId: denethor, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[denethor]?.resources).toBe(4 - 1);
    expect(stat(run.state, tab, denethor, "defense")).toBe(3 + 3);
    expect(triggers(run.state, tab)).not.toContain("05013:action:1");
    const next = enter(run.state, tab, "questCommit").state;
    expect(stat(next, tab, denethor, "defense")).toBe(3);
    // The limit is per phase: in the quest phase the Action is offered again.
    expect(triggers(next, tab)).toContain("05013:action:1");
  });

  // With no resource in the pool the cost cannot be paid.
  it("05013:A:2 is not offered with no resource in the pool", () => {
    const tab = scene(EFFECTS, 0);
    expect(triggers(tab.state, tab)).not.toContain("05013:action:1");
  });
});

describe("Ranger Spikes (05017:A:1 to A:3)", () => {
  // "Play Ranger Spikes into the staging area unattached.": Denethor pays; the staging area is the one place offered (no card is a host,
  // the Weak enemy there included), and the Spikes go there with no host.
  lineSpec("05017:A:1", "is played into the staging area unattached", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], staging: [WEAK], hand: [{ code: SPIKES, seat: 0 }] });
    const spikes = idsOf(tab, SPIKES);
    expect(hosts(tab, spikes)).toEqual(["staging"]);
    const run = play(begin(tab.state), tab, spikes, "staging");
    expect(run.state.cards[spikes]?.zone).toBe("staging");
    expect(run.state.cards[spikes]?.host ?? null).toBeNull();
    expect(run.state.cards[idsOf(tab, WEAK)]?.attachments ?? []).toEqual([]);
  });

  // "If unattached, attach Ranger Spikes to the next eligible enemy that enters the staging area.": the Spikes, played in the planning
  // phase, wait in the staging area beside the Weak enemy; the quest's staging reveals the Lurker, and the Spikes attach to it.
  lineSpec("05017:A:2", "attaches to the next enemy that enters the staging area", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], staging: [WEAK], deck: [LURKER, LURKER], hand: [{ code: SPIKES, seat: 0 }] });
    const spikes = idsOf(tab, SPIKES);
    const played = play(begin(tab.state), tab, spikes, "staging");
    let run = enter(played.state, tab, "questCommit");
    run = send(run, { type: "Commit", cardIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    // The commit is done; the staging step reveals the top Lurker.
    run = send(run, { type: "Pass" }, tab.ctx);
    const revealed = (tab.ids[LURKER] ?? []).filter((id) => run.state.cards[id]?.zone === "staging");
    expect(revealed).toHaveLength(1);
    expect(run.state.cards[spikes]?.host).toBe(revealed[0]);
    expect(run.state.cards[idsOf(tab, WEAK)]?.attachments ?? []).toEqual([]);
  });

  // The Lurker (Threat 3, engagement cost 2) in the staging area with the Spikes attached.
  function spiked(effects: readonly Effect[], start: Scene["start"]): Table {
    const tab = table(effects, { start, heroes: [{ code: DENETHOR, seat: 0 }], staging: [LURKER], allies: [{ code: SPIKES, seat: 0 }] });
    return attach(tab, [[idsOf(tab, SPIKES), idsOf(tab, LURKER)]]);
  }

  // "Players do not make engagement checks against attached enemy. Attached enemy gets -2 Threat.": the Lurker's Threat is 3 - 2, and when
  // the player declines the optional engagement the engagement checks leave it in the staging area (its cost 2 is under the threat of 8).
  lineSpec("05017:A:3", "no engagement checks against the attached enemy, which gets -2 Threat", (effects) => {
    const tab = spiked(effects, "encounter");
    const lurker = idsOf(tab, LURKER);
    expect(stat(tab.state, tab, lurker, "threat")).toBe(3 - 2);
    const run = passAll(send(begin(tab.state), { type: "DeclineEngage" }, tab.ctx), tab.ctx);
    expect(run.state.cards[lurker]?.zone).toBe("staging");
  });

  // The player may still engage it by choice (only engagement checks are barred).
  it("05017:A:3 the attached enemy may still be engaged by choice", () => {
    const tab = spiked(EFFECTS, "encounter");
    const lurker = idsOf(tab, LURKER);
    const run = send(begin(tab.state), { type: "Engage", enemyId: lurker }, tab.ctx);
    expect(run.state.cards[lurker]?.zone).toBe("engaged");
  });
});
