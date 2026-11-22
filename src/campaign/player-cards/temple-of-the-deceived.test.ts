// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.lasting-effects, rr.response, rr.action, rr.cancel, rr.shadow-effects,
// rr.sentinel, rr.play-restrictions-and-permissions, rr.quest-phase, rr.explored, rr.staging-area, rr.step-5-3, rr.engagement-check,
// rr.play-and-put-into-play, rr.triggered-ability (data/rules/entries.json).
// The Temple of the Deceived player cards, written from their card text (data/cards/TotD.json; data/printed holds no ledger for these cards
// yet, so every intent goes through sendUnledgered): Elfhelm 12057:A:1, A:2 and A:3, Armored Destrier 12059:A:1, Déorwine 12060:A:2,
// Revealed in Wrath 12061:A:1, Rhovanion Outrider 12062:A:1, Scouting Party 12063:A:1, Entangling Nets 12064:A:1, A:2 and A:3, Arrows from
// the Trees 12065:A:1 and A:2, Ered Luin Miner 12066:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, choices, combat, fillers, hosts, passAll, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ELFHELM = "12057";
const DESTRIER = "12059";
const DEORWINE = "12060";
const WRATH = "12061";
const OUTRIDER = "12062";
const PARTY = "12063";
const NETS = "12064";
const ARROWS = "12065";
const MINER = "12066";
// Elladan: a Noldor Tactics hero. Veteran Sword-elf: a Noldor Tactics ally. Longbeard Sentry: "Action: Discard 2 cards from the top of your
// deck to ...". The Black Rider (Attack 5), and Green Hill Country (Shadow: +1 Attack) for its shadow card.
const ELLADAN = "04028";
const SWORD_ELF = "12112";
const SENTRY = "10057";
const RIDER = "141039";
const GREEN_HILL = "141036";
// Heroes with no text: Spirit, Tactics, Lore, and a Tactics hero with sentinel. The Pal is a Leadership Hobbit hero (test/harness/scene.ts).
const SPIRIT = "spirit-hero";
const TACTICS = "tactics-hero";
const SAGE = "sage";
const SENTINEL = "sentinel-hero";
const PAL = "pal";
const ALLY = "ally";
const SPIRIT_ALLY = "spirit-ally";
// A Mount attachment and an attachment that is not a Mount, neutral, cost 0, with no text.
const MOUNT = "mount";
const PLAIN = "plain";
// Enemies: one of Attack 3 and Defense 3 that engages nobody; Dear (engagement cost 50) and Cheap (2) from the starter scene. Locations of
// 3 quest points and of 1.
const BRUTE = "brute";
const DEAR = "dear";
const CHEAP = "cheap";
const FIELD = "field";
const HILL = "hill";
const SMALL = "small";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([ELFHELM, DESTRIER, DEORWINE, WRATH, OUTRIDER, PARTY, NETS, ARROWS, MINER, ELLADAN, SWORD_ELF, SENTRY, RIDER, GREEN_HILL]))]);
  const hero = (code: string, sphere: "spirit" | "tactics" | "lore", keywords = {}) => definePrinted({ code, name: code, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 2, health: 5, keywords });
  cards.set(SPIRIT, hero(SPIRIT, "spirit"));
  cards.set(TACTICS, hero(TACTICS, "tactics"));
  cards.set(SAGE, hero(SAGE, "lore"));
  cards.set(SENTINEL, hero(SENTINEL, "tactics", { sentinel: true }));
  cards.set(SPIRIT_ALLY, definePrinted({ code: SPIRIT_ALLY, name: "Spirit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  cards.set(MOUNT, definePrinted({ code: MOUNT, name: "Steed", type: "attachment", cost: 0, traits: ["Mount"] }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 3, defense: 3, health: 9 }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", threat: 1, questPoints: 3 }));
  cards.set(HILL, definePrinted({ code: HILL, name: "Hill", type: "location", threat: 1, questPoints: 3 }));
  cards.set(SMALL, definePrinted({ code: SMALL, name: "Small", type: "location", threat: 1, questPoints: 1 }));
  base = { ...starter, cards };
});

const playable = (state: Table["state"], tab: Table, id: string): boolean => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);

describe("Elfhelm (12057:A:1, A:2, A:3)", () => {
  // Elfhelm (Leadership), a Spirit and a Tactics hero, two Mounts and the Plain attachment in hand.
  const scene = (effects: readonly Effect[]): Table => table(effects, { heroes: [{ code: ELFHELM, seat: 0 }, { code: SPIRIT, seat: 0 }, { code: TACTICS, seat: 0 }], hand: [{ code: MOUNT, seat: 0 }, { code: PLAIN, seat: 0 }] });
  // `code`'s stats as the game reads them, less the printed ones.
  const bonus = (run: Run, tab: Table, code: string) => (["willpower", "attack", "defense"] as const).map((which) => stat(run.state, tab, idsOf(tab, code), which) - printed(tab, code, which));

  // "Each Spirit hero with an attached Mount gets +1 Willpower.": the Mount played on the Spirit hero gives +1 Willpower and nothing else;
  // the Tactics hero, with the Plain attachment (no Mount), gets nothing.
  lineSpec("12057:A:1", "Elfhelm: each Spirit hero with an attached Mount gets +1 Willpower", (effects) => {
    const tab = scene(effects);
    let run = play(begin(tab.state), tab, idsOf(tab, MOUNT), idsOf(tab, SPIRIT));
    run = play(run, tab, idsOf(tab, PLAIN), idsOf(tab, TACTICS));
    expect(bonus(run, tab, SPIRIT)).toEqual([1, 0, 0]);
    expect(bonus(run, tab, TACTICS)).toEqual([0, 0, 0]);
  });

  // "Each Tactics hero with an attached Mount gets +1 Attack.": the Spirit hero, with the Plain attachment, gets nothing.
  lineSpec("12057:A:2", "Elfhelm: each Tactics hero with an attached Mount gets +1 Attack", (effects) => {
    const tab = scene(effects);
    let run = play(begin(tab.state), tab, idsOf(tab, MOUNT), idsOf(tab, TACTICS));
    run = play(run, tab, idsOf(tab, PLAIN), idsOf(tab, SPIRIT));
    expect(bonus(run, tab, TACTICS)).toEqual([0, 1, 0]);
    expect(bonus(run, tab, SPIRIT)).toEqual([0, 0, 0]);
  });

  // "Each Leadership hero with an attached Mount gets +1 Defense.": the Mount on Elfhelm himself.
  lineSpec("12057:A:3", "Elfhelm: each Leadership hero with an attached Mount gets +1 Defense", (effects) => {
    const tab = scene(effects);
    const run = play(begin(tab.state), tab, idsOf(tab, MOUNT), idsOf(tab, ELFHELM));
    expect(bonus(run, tab, ELFHELM)).toEqual([0, 0, 1]);
    expect(bonus(run, tab, SPIRIT)).toEqual([0, 0, 0]);
  });

  // "hero": a Spirit ally with a Mount gets nothing; "Each": the other player's Spirit hero with a Mount gets +1 Willpower.
  it("12057:A:1 Elfhelm: a Spirit ally with a Mount gets nothing, the other player's Spirit hero gets +1", () => {
    const start = table(EFFECTS, { seats: 2, heroes: [{ code: ELFHELM, seat: 0 }, { code: SPIRIT, seat: 1 }], allies: [{ code: SPIRIT_ALLY, seat: 0 }], hand: [{ code: MOUNT, seat: 0 }, { code: MOUNT, seat: 0 }] });
    const [first = "", second = ""] = start.ids[MOUNT] ?? [];
    const tab = attach(start, [[first, idsOf(start, SPIRIT_ALLY)], [second, idsOf(start, SPIRIT)]]);
    expect(stat(tab.state, tab, idsOf(tab, SPIRIT_ALLY), "willpower")).toBe(1);
    expect(stat(tab.state, tab, idsOf(tab, SPIRIT), "willpower")).toBe(2 + 1);
  });
});

describe("Armored Destrier (12059:A:1)", () => {
  // "Attach to a Leadership or sentinel hero. Restricted.": the Pal (Leadership) and the sentinel hero (Tactics) are offered; the Spirit hero
  // and the Ally (a Leadership ally) are not.
  lineSpec("12059:A:1", "Armored Destrier: Attach to a Leadership or sentinel hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SENTINEL, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: DESTRIER, seat: 0 }] });
    const destrier = idsOf(tab, DESTRIER);
    expect(hosts(tab, destrier)).toEqual([idsOf(tab, PAL), idsOf(tab, SENTINEL)].sort());
    expect(play(begin(tab.state), tab, destrier, idsOf(tab, SENTINEL)).state.cards[destrier]?.host).toBe(idsOf(tab, SENTINEL));
  });
});

describe("Déorwine (12060:A:2)", () => {
  // The Black Rider attacks with Green Hill Country as its shadow card; `defender` defends. The Pal pays.
  function defended(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: DEORWINE, seat: 0 }], engaged: [{ code: RIDER, seat: 0 }], deck: [GREEN_HILL] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
    return { tab, run };
  }
  const strikes = (run: Run, from: number) => run.steps.slice(from).flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.attack] : []));

  // "While Déorwine is defending, he gains: "Response: Spend 1 Leadership resource to cancel a shadow effect just triggered."": the Pal
  // spends 1 and the Rider strikes with its printed Attack 5, not 6.
  lineSpec("12060:A:2", "Déorwine: while defending, spend 1 Leadership resource to cancel a shadow effect", (effects) => {
    const { tab, run: pending } = defended(effects, DEORWINE);
    expect(triggers(pending.state, tab)).toContain("12060:response:1");
    const from = pending.steps.length;
    const run = passAll(sendUnledgered(pending, { type: "Trigger", cardId: idsOf(tab, DEORWINE), effectId: "12060:response:1", payments: [{ heroId: idsOf(tab, PAL), amount: 1 }] }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, PAL)]?.resources).toBe(6 - 1);
    expect(strikes(run, from)).toEqual([printed(tab, RIDER, "attack")]);
  });

  // Not defending, Déorwine has no Response: the Spirit hero defends and the shadow effect is not cancelled.
  it("12060:A:2 Déorwine: no Response while another character defends", () => {
    const { tab, run } = defended(EFFECTS, SPIRIT);
    expect(triggers(run.state, tab)).not.toContain("12060:response:1");
  });

  // "Any player may trigger this response.": the first player has no Leadership hero; the second player's Pal spends the resource.
  it("12060:A:2 Déorwine: another player may trigger the Response and pay for it", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: SPIRIT, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: DEORWINE, seat: 0 }], engaged: [{ code: RIDER, seat: 0 }], deck: [GREEN_HILL] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, DEORWINE) }, tab.ctx), tab.ctx);
    expect(triggers(run.state, tab)).toContain("12060:response:1");
    const from = run.steps.length;
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, DEORWINE), effectId: "12060:response:1", payments: [{ heroId: idsOf(tab, PAL), amount: 1 }] }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[idsOf(tab, PAL)]?.resources).toBe(6 - 1);
    expect(strikes(run, from)).toEqual([printed(tab, RIDER, "attack")]);
  });
});

describe("Revealed in Wrath (12061:A:1)", () => {
  // "Play only if you control a Noldor hero.": with Elladan it can be played; with a Noldor ally (the Veteran Sword-elf) and a Tactics hero
  // it cannot. A non-unique enemy is in the staging area for the Action to choose.
  lineSpec("12061:A:1", "Revealed in Wrath: play only if you control a Noldor hero", (effects) => {
    const noldor = table(effects, { heroes: [{ code: ELLADAN, seat: 0 }], hand: [{ code: WRATH, seat: 0 }], staging: [DEAR] });
    expect(playable(noldor.state, noldor, idsOf(noldor, WRATH))).toBe(true);
    const ally = table(effects, { heroes: [{ code: TACTICS, seat: 0 }], allies: [{ code: SWORD_ELF, seat: 0 }], hand: [{ code: WRATH, seat: 0 }], staging: [DEAR] });
    expect(playable(ally.state, ally, idsOf(ally, WRATH))).toBe(false);
  });

  // "you control": the other player's Noldor hero does not count.
  it("12061:A:1 Revealed in Wrath: another player's Noldor hero does not count", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: TACTICS, seat: 0 }, { code: ELLADAN, seat: 1 }], hand: [{ code: WRATH, seat: 0 }], staging: [DEAR] });
    expect(playable(tab.state, tab, idsOf(tab, WRATH))).toBe(false);
  });
});

describe("Rhovanion Outrider (12062:A:1)", () => {
  // The Outrider and the Spirit hero at the commit step, `staging` in the staging area.
  const scene = (effects: readonly Effect[], staging: readonly string[]): Table => table(effects, { start: "quest", heroes: [{ code: SPIRIT, seat: 0 }], allies: [{ code: OUTRIDER, seat: 0 }], staging });
  const committed = (tab: Table, ids: readonly string[]): Run => sendUnledgered(begin(tab.state), { type: "Commit", cardIds: ids }, tab.ctx);

  // "Response: After Rhovanion Outrider commits to the quest, place 1 progress on a location in the staging area. If that location is not
  // explored by this effect, give Rhovanion Outrider +1 Willpower until the end of the phase.": the Hill takes 1 progress (of 3), the Field
  // none, and the Outrider has +1 Willpower until the quest phase ends.
  lineSpec("12062:A:1", "Rhovanion Outrider: 1 progress on a location in the staging area, and +1 Willpower if it is not explored", (effects) => {
    const tab = scene(effects, [FIELD, HILL]);
    const [outrider, hill] = [idsOf(tab, OUTRIDER), idsOf(tab, HILL)];
    let run = committed(tab, [outrider]);
    expect(triggers(run.state, tab)).toContain("12062:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: outrider, effectId: "12062:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, FIELD), hill].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: hill }, tab.ctx);
    expect(run.state.cards[hill]?.progress).toBe(1);
    expect(run.state.cards[idsOf(tab, FIELD)]?.progress ?? 0).toBe(0);
    expect(stat(run.state, tab, outrider, "willpower")).toBe(printed(tab, OUTRIDER, "willpower") + 1);
    expect(stat(withMode(run.state, "travel"), tab, outrider, "willpower")).toBe(printed(tab, OUTRIDER, "willpower"));
  });

  // The Small location (1 quest point) is explored by the progress: no +1 Willpower.
  lineSpec("12062:A:1", "Rhovanion Outrider: no +1 Willpower when the progress explores the location", (effects) => {
    const tab = scene(effects, [SMALL]);
    const outrider = idsOf(tab, OUTRIDER);
    const run = sendUnledgered(committed(tab, [outrider]), { type: "Trigger", cardId: outrider, effectId: "12062:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, SMALL)]?.zone).not.toBe("staging");
    expect(stat(run.state, tab, outrider, "willpower")).toBe(printed(tab, OUTRIDER, "willpower"));
  });

  it("12062:A:1 Rhovanion Outrider: not offered with no location in the staging area", () => {
    const tab = scene(EFFECTS, [DEAR]);
    expect(triggers(committed(tab, [idsOf(tab, OUTRIDER)]).state, tab)).not.toContain("12062:response:1");
  });

  // "After Rhovanion Outrider commits": only the Spirit hero commits.
  it("12062:A:1 Rhovanion Outrider: not offered when another character commits", () => {
    const tab = scene(EFFECTS, [FIELD]);
    const run = committed(tab, [idsOf(tab, SPIRIT)]);
    expect(run.state.cards[idsOf(tab, SPIRIT)]?.committed).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("12062:response:1");
  });
});

describe("Scouting Party (12063:A:1)", () => {
  // Elfhelm (a Scout hero), the Spirit hero (not a Scout, who pays) and the Outrider (a Scout ally) at the commit step; Scouting Party in hand.
  const scene = (effects: readonly Effect[]): Table => table(effects, { start: "quest", heroes: [{ code: ELFHELM, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: OUTRIDER, seat: 0 }], hand: [{ code: PARTY, seat: 0 }] });

  // "Response: After you commit characters to the quest, if each character you have committed to the quest is a Scout, each of those
  // characters gets +2 Willpower until the end of the phase.": Elfhelm and the Outrider commit, each gets +2 until the quest phase ends;
  // the Spirit hero, who pays, gets nothing.
  lineSpec("12063:A:1", "Scouting Party: each committed character gets +2 Willpower when all are Scouts", (effects) => {
    const tab = scene(effects);
    const [elfhelm, outrider, party] = [idsOf(tab, ELFHELM), idsOf(tab, OUTRIDER), idsOf(tab, PARTY)];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [elfhelm, outrider] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("12063:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: party, effectId: "12063:response:1", payments: payFor(run.state, tab.ctx, party) }, tab.ctx);
    expect(run.state.cards[party]?.zone).toBe("discard");
    for (const [id, code] of [[elfhelm, ELFHELM], [outrider, OUTRIDER]] as const) {
      expect(stat(run.state, tab, id, "willpower")).toBe(printed(tab, code, "willpower") + 2);
      expect(stat(withMode(run.state, "travel"), tab, id, "willpower")).toBe(printed(tab, code, "willpower"));
    }
    expect(stat(run.state, tab, idsOf(tab, SPIRIT), "willpower")).toBe(2);
  });

  // "if each character you have committed to the quest is a Scout": Elfhelm and the Spirit hero commit.
  it("12063:A:1 Scouting Party: not offered when a committed character is not a Scout", () => {
    const tab = scene(EFFECTS);
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, ELFHELM), idsOf(tab, SPIRIT)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, SPIRIT)]?.committed).toBe(true);
    expect(triggers(run.state, tab)).not.toContain("12063:response:1");
  });
});

describe("Entangling Nets (12064:A:1, A:2, A:3)", () => {
  // The Sage plays the Nets in the planning phase; the Brute is the top card of the encounter deck.
  const scene = (effects: readonly Effect[]): Table => table(effects, { heroes: [{ code: SAGE, seat: 0 }], hand: [{ code: NETS, seat: 0 }], deck: [BRUTE] });
  // The Nets played, the planning phase passed, the Sage committed: the staging step reveals the Brute.
  const revealed = (tab: Table): Run => {
    let run = play(begin(tab.state), tab, idsOf(tab, NETS), "staging");
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.mode).toBe("questCommit");
    run = sendUnledgered(run, { type: "Commit", cardIds: [idsOf(tab, SAGE)] }, tab.ctx);
    // The commit step ends with a Pass; the staging step reveals the top card.
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx, { responses: true });
    return run;
  };

  // "Play Entangling Nets into the staging area unattached.": its only place is the staging area, and it lies there with no host.
  lineSpec("12064:A:1", "Entangling Nets: played into the staging area unattached", (effects) => {
    const tab = scene(effects);
    const nets = idsOf(tab, NETS);
    expect(hosts(tab, nets)).toEqual(["staging"]);
    const run = play(begin(tab.state), tab, nets, "staging");
    expect(run.state.cards[nets]).toMatchObject({ zone: "staging", host: null });
  });

  // "If unattached, attach Entangling Nets to the next eligible enemy that enters the staging area.": the Brute is revealed and takes it.
  lineSpec("12064:A:2", "Entangling Nets: attaches to the next enemy that enters the staging area", (effects) => {
    const tab = scene(effects);
    const run = revealed(tab);
    expect(run.state.cards[idsOf(tab, BRUTE)]?.zone).toBe("staging");
    expect(run.state.cards[idsOf(tab, NETS)]?.host).toBe(idsOf(tab, BRUTE));
  });

  // "Attached enemy gets –2 Attack and –2 Defense.": the Brute has 1 and 1.
  lineSpec("12064:A:3", "Entangling Nets: attached enemy gets -2 Attack and -2 Defense", (effects) => {
    const tab = scene(effects);
    const run = revealed(tab);
    expect(stat(run.state, tab, idsOf(tab, BRUTE), "attack")).toBe(3 - 2);
    expect(stat(run.state, tab, idsOf(tab, BRUTE), "defense")).toBe(3 - 2);
  });
});

describe("Arrows from the Trees (12065:A:1, A:2)", () => {
  // The Sage (Lore) pays, the Tactics hero holds `tactics` resources; `staging` enemies at the optional engagement step, and the Brute
  // engaged with the player since an earlier phase.
  function scene(effects: readonly Effect[], staging: readonly string[], tactics = 6): Table {
    const tab = table(effects, { start: "encounter", heroes: [{ code: SAGE, seat: 0 }, { code: TACTICS, seat: 0 }], hand: [{ code: ARROWS, seat: 0 }], staging, engaged: [{ code: BRUTE, seat: 0 }] });
    return { ...tab, state: { ...tab.state, cards: { ...tab.state.cards, [idsOf(tab, TACTICS)]: { ...tab.state.cards[idsOf(tab, TACTICS)]!, resources: tactics } } } };
  }
  const checked = (tab: Table): Run => sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
  const damage = (run: Run, ids: readonly string[]) => ids.map((id) => run.state.cards[id]?.damage ?? 0);

  // "Play only after making engagement checks.": it cannot be played at the optional engagement step, and can once the checks are made.
  // The engine opens no player window in the encounter phase before the checks, so the line is tested on all records only.
  it("12065:A:1 Arrows from the Trees: play only after making engagement checks", () => {
    const tab = scene(EFFECTS, [DEAR]);
    expect(playable(tab.state, tab, idsOf(tab, ARROWS))).toBe(false);
    expect(playable(checked(tab).state, tab, idsOf(tab, ARROWS))).toBe(true);
  });

  // "Encounter Action: If no enemies were engaged this phase, deal 1 damage to each enemy in the staging area. Then, the players as a group
  // may spend 3 Tactics resources to deal 2 additional damage to each enemy in the staging area.": the two Dears take 1 each, the engaged
  // Brute none; the players keep their resources.
  lineSpec("12065:A:2", "Arrows from the Trees: 1 damage to each enemy in the staging area, keeping the Tactics resources", (effects) => {
    const tab = scene(effects, [DEAR, DEAR]);
    const dears = tab.ids[DEAR] ?? [];
    let run = play(checked(tab), tab, idsOf(tab, ARROWS));
    expect(choices(run.state, tab).sort()).toEqual(["keep", "spend"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "keep" }, tab.ctx);
    expect(damage(run, [...dears, idsOf(tab, BRUTE)])).toEqual([1, 1, 0]);
    expect(run.state.cards[idsOf(tab, TACTICS)]?.resources).toBe(6);
  });

  // Spending 3 Tactics resources: 1 + 2 damage on each enemy in the staging area, 3 resources gone from the Tactics hero.
  lineSpec("12065:A:2", "Arrows from the Trees: 3 Tactics resources spent for 2 additional damage", (effects) => {
    const tab = scene(effects, [DEAR, DEAR]);
    const dears = tab.ids[DEAR] ?? [];
    let run = play(checked(tab), tab, idsOf(tab, ARROWS));
    run = sendUnledgered(run, { type: "Choose", optionId: "spend" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(damage(run, [...dears, idsOf(tab, BRUTE)])).toEqual([3, 3, 0]);
    expect(run.state.cards[idsOf(tab, TACTICS)]?.resources).toBe(6 - 3);
  });

  // With 2 Tactics resources the players cannot spend 3: only "keep" is offered.
  it("12065:A:2 Arrows from the Trees: no spend with fewer than 3 Tactics resources", () => {
    const tab = scene(EFFECTS, [DEAR], 2);
    const run = play(checked(tab), tab, idsOf(tab, ARROWS));
    expect(choices(run.state, tab)).not.toContain("spend");
  });

  // No enemy is in the staging area: neither part can deal damage, so the event is not offered (rr.triggered-ability).
  it("12065:A:2 Arrows from the Trees: not offered with no enemy in the staging area", () => {
    const tab = scene(EFFECTS, []);
    expect(playable(checked(tab).state, tab, idsOf(tab, ARROWS))).toBe(false);
  });

  // "If no enemies were engaged this phase": the Cheap enemy (engagement cost 2) engages at the checks; Arrows cannot be played.
  it("12065:A:2 Arrows from the Trees: not offered after an enemy engaged this phase", () => {
    const tab = scene(EFFECTS, [CHEAP, DEAR]);
    const run = checked(tab);
    expect(run.state.cards[idsOf(tab, CHEAP)]?.zone).toBe("engaged");
    expect(playable(run.state, tab, idsOf(tab, ARROWS))).toBe(false);
  });
});

describe("Ered Luin Miner (12066:A:1)", () => {
  // "Response: After Ered Luin Miner is discarded from your deck, put it into play under your control.": the Longbeard Sentry discards the
  // top 2 cards of the deck, the Miner among them; the Miner comes into play under the first player's control.
  lineSpec("12066:A:1", "Ered Luin Miner: after it is discarded from your deck, put it into play under your control", (effects) => {
    const tab = table(effects, { heroes: [{ code: TACTICS, seat: 0 }], allies: [{ code: SENTRY, seat: 0 }], playerDeck: [{ code: MINER, seat: 0 }, ...fillers("card", 3)] });
    const miner = idsOf(tab, MINER);
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, SENTRY), effectId: "10057:action:1" }, tab.ctx);
    expect(run.state.cards[miner]?.zone).toBe("discard");
    expect(triggers(run.state, tab)).toContain("12066:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: miner, effectId: "12066:response:1" }, tab.ctx);
    expect(run.state.cards[miner]).toMatchObject({ zone: "play", controller: 0, exhausted: false });
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });
});
