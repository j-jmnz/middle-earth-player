// Rules: rr.attachment-cards, rr.restricted, rr.ranged, rr.response, rr.damage, rr.modifiers, rr.printed, rr.cost, rr.lasting-effects
// (data/rules/entries.json).
// The City of Ulfast attachments, written from their card text (data/cards/TCoU.json; data/printed holds no ledger for this pack, so every
// intent goes through sendUnledgered): Keen Longbow 22031:A:1, A:2 and A:3, War Axe 22032:A:1 and A:3, Strength and Courage 22033:A:1, A:2
// and A:3, Horn of the Mark 22035:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attach, attacking, choices, hosts, passAll, play, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const LONGBOW = "22031";
const AXE = "22032";
const COURAGE = "22033";
const HORN = "22035";
// The One Ring (the player card, Restricted, Master).
const ONE_RING = "21001";
// Merry: an ally (21003) and a hero (141003).
const MERRY_ALLY = "21003";
const MERRY_HERO = "141003";
// Core: Aragorn (Leadership), Legolas (Tactics, Attack 3), Éowyn (Spirit, Rohan), Beravor (Lore), Snowbourn Scout (a Rohan ally), Gondorian
// Spearman (a Tactics ally), Henamarth Riversong (a Lore ally), Citadel Plate (Tactics, Restricted, cost 4). Erestor: a Lore hero.
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const SNOWBOURN = "01016";
const SPEARMAN = "01029";
const PLATE = "01040";
const HENAMARTH = "01060";
const ERESTOR = "10084";
const WALL = "wall";
const PAL = "pal";
const PLAIN = "plain";
const ONE = "one";
const TWO = "two";
const THREE = "three";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [LONGBOW, AXE, COURAGE, HORN, ONE_RING, MERRY_ALLY, MERRY_HERO, ARAGORN, LEGOLAS, EOWYN, BERAVOR, SNOWBOURN, SPEARMAN, PLATE, HENAMARTH, ERESTOR];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 20 }));
  for (const code of [ONE, TWO, THREE]) cards.set(code, definePrinted({ code, name: code, type: "event", sphere: "lore", cost: 0 }));
  base = { ...starter, cards };
});

// The player strikes of the steps after `from`, as [enemy, Attack].
const strikes = (run: Run, from: number) => run.steps.slice(from).flatMap((step) => (step.kind === "strike" && step.side === "player" ? [[step.targetId, step.attack]] : []));

describe("Keen Longbow (22031:A:1, A:2, A:3)", () => {
  // "Attach to a Lore hero. Limit 1 per hero.": Beravor and Erestor are offered, Legolas (Tactics) and Henamarth (a Lore ally) are not; with
  // one Longbow on Beravor the second copy is offered for Erestor only. Beravor (Lore) pays 2.
  lineSpec("22031:A:1", "Keen Longbow: Attach to a Lore hero, 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: ERESTOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: HENAMARTH, seat: 0 }], hand: [{ code: LONGBOW, seat: 0 }, { code: LONGBOW, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[LONGBOW] ?? [];
    const [beravor, erestor] = [idsOf(tab, BERAVOR), idsOf(tab, ERESTOR)];
    expect(hosts(tab, first)).toEqual([beravor, erestor].sort());
    const run = play(begin(tab.state), tab, first, beravor);
    expect(run.state.cards[first]?.host).toBe(beravor);
    expect(hosts(tab, second, run.state)).toEqual([erestor]);
  });

  // Two players; the other player has the Wall engaged. Beravor (with the Longbow when `bow`) and Erestor.
  function bow(effects: readonly Effect[], hand: readonly string[] = []): Table {
    const scene = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: ERESTOR, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: LONGBOW, seat: 0 }], hand: hand.map((code) => ({ code, seat: 0 })), engaged: [{ code: WALL, seat: 1 }] });
    return attach(scene, [[idsOf(scene, LONGBOW), idsOf(scene, BERAVOR)]]);
  }

  // "Restricted. Attached hero gains ranged.": Beravor with the Longbow may attack the enemy engaged with the other player (rr.ranged),
  // Erestor may not. The Longbow has the restricted keyword.
  lineSpec("22031:A:2", "Keen Longbow: the attached hero gains ranged", (effects) => {
    const tab = bow(effects);
    const declaring = attacking(tab.state);
    const wall = idsOf(tab, WALL);
    expect(hasKeyword(tab.state, idsOf(tab, LONGBOW), "restricted", tab.ctx.cards)).toBe(true);
    expect(refusal(declaring, { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, ERESTOR)] }, tab.ctx)).not.toBeNull();
    expect(refusal(declaring, { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx)).toBeNull();
  });

  // "Response: After attached hero is declared an as attacker against an enemy, discard up to 3 cards from your hand to deal 1 damage to that
  // enemy for each card discarded this way.": Beravor attacks the Wall (Defense 9) with 3 cards in hand; the player may discard 1, 2 or 3,
  // discards 2 and the Wall takes 2 damage; one card stays in hand.
  lineSpec("22031:A:3", "Keen Longbow: after the hero attacks, discard up to 3 cards to deal 1 damage each to that enemy", (effects) => {
    const tab = bow(effects, [ONE, TWO, THREE]);
    const wall = idsOf(tab, WALL);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("22031:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, LONGBOW), effectId: "22031:response:1" }, tab.ctx);
    expect(choices(run.state, tab).sort()).toEqual(["discard1", "discard2", "discard3"]);
    run = sendUnledgered(run, { type: "Choose", optionId: "discard2" }, tab.ctx);
    // The player picks the two cards.
    for (const code of [ONE, TWO]) run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, code) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ONE)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, TWO)]?.zone).toBe("discard");
    expect(run.state.cards[idsOf(tab, THREE)]?.zone).toBe("hand");
    expect(run.state.cards[wall]?.damage).toBe(2);
  });

  // "up to 3": with 1 card in hand only the discard of 1 can be made, so no question is asked.
  it("22031:A:3 Keen Longbow: with 1 card in hand only 1 can be discarded", () => {
    const tab = bow(EFFECTS, [ONE]);
    const wall = idsOf(tab, WALL);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, LONGBOW), effectId: "22031:response:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, ONE)]?.zone).toBe("discard");
    expect(run.state.cards[wall]?.damage).toBe(1);
  });

  // An empty hand: nothing to discard, so no damage can be dealt and it is not offered.
  it("22031:A:3 Keen Longbow: not offered with an empty hand", () => {
    const tab = bow(EFFECTS);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, BERAVOR)] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("22031:response:1");
  });
});

describe("War Axe (22032:A:1, A:3)", () => {
  // "Attach to a Tactics character. Limit 1 per character.": Legolas (a Tactics hero) and the Gondorian Spearman (a Tactics ally) are
  // offered, Aragorn is not; with one Axe on Legolas the second goes on the Spearman only. Legolas (Tactics) pays 1.
  lineSpec("22032:A:1", "War Axe: Attach to a Tactics character, 1 per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: AXE, seat: 0 }, { code: AXE, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[AXE] ?? [];
    const [legolas, spearman] = [idsOf(tab, LEGOLAS), idsOf(tab, SPEARMAN)];
    expect(hosts(tab, first)).toEqual([legolas, spearman].sort());
    const run = play(begin(tab.state), tab, first, legolas);
    expect(run.state.cards[first]?.host).toBe(legolas);
    expect(hosts(tab, second, run.state)).toEqual([spearman]);
  });

  // "Attached characters gets +1 Attack for each attachment it has with the restricted keyword.": played on Legolas (Attack 3), the Axe
  // (restricted) gives +1; Citadel Plate (restricted) played after gives another +1; a plain attachment gives nothing.
  lineSpec("22032:A:3", "War Axe: +1 Attack for each restricted attachment on the character", (effects) => {
    const scene = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: PLAIN, seat: 0 }], hand: [{ code: AXE, seat: 0 }, { code: PLATE, seat: 0 }] });
    const legolas = idsOf(scene, LEGOLAS);
    const tab = attach(scene, [[idsOf(scene, PLAIN), legolas]]);
    let run = play(begin(tab.state), tab, idsOf(tab, AXE), legolas);
    expect(stat(run.state, tab, legolas, "attack")).toBe(3 + 1);
    run = play(run, tab, idsOf(tab, PLATE), legolas);
    expect(run.state.cards[idsOf(tab, PLATE)]?.host).toBe(legolas);
    expect(stat(run.state, tab, legolas, "attack")).toBe(3 + 2);
  });
});

describe("Strength and Courage (22033:A:1, A:2, A:3)", () => {
  // Legolas holds The One Ring (21001), Aragorn does not; Strength and Courage in hand (or on Legolas when `on`).
  function courage(effects: readonly Effect[], on: boolean): Table {
    const scene = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ONE_RING, seat: 0 }, ...(on ? [{ code: COURAGE, seat: 0 }] : [])], hand: [{ code: COURAGE, seat: 0 }, { code: COURAGE, seat: 0 }], engaged: [{ code: WALL, seat: 0 }] });
    const legolas = idsOf(scene, LEGOLAS);
    const worn = on ? (scene.ids[COURAGE] ?? []).filter((id) => scene.state.cards[id]?.zone === "play") : [];
    return attach(scene, [[idsOf(scene, ONE_RING), legolas], ...worn.map((id) => [id, legolas] as const)]);
  }
  const inHand = (tab: Table): string[] => (tab.ids[COURAGE] ?? []).filter((id) => tab.state.cards[id]?.zone === "hand");

  // "Attach to the hero with The One Ring." "Limit 1 per hero. Attached hero gets +1 Attack.": Legolas (with the Ring) is offered and
  // Aragorn is not; on Legolas it gives +1 Attack, and the second copy then has no host.
  for (const line of ["22033:A:1", "22033:A:2"]) {
    lineSpec(line, "Strength and Courage: attach to the hero with The One Ring, 1 per hero, +1 Attack", (effects) => {
      const tab = courage(effects, false);
      const legolas = idsOf(tab, LEGOLAS);
      const [first = "", second = ""] = inHand(tab);
      expect(hosts(tab, first)).toEqual([legolas]);
      const run = play(begin(tab.state), tab, first, legolas);
      expect(run.state.cards[first]?.host).toBe(legolas);
      expect(stat(run.state, tab, legolas, "attack")).toBe(3 + 1);
      expect(hosts(tab, second, run.state)).toEqual([]);
    });
  }

  // "Response: After attached hero is declared as an attacker, exhaust The One Ring and raise your threat by 1 to double attached hero's
  // printed Attack for this attack.": Legolas (printed 3, +1) attacks; the Ring exhausts, the threat rises from 8 to 9 and the attack
  // strikes with 3 + 1 + 3. After the attack his Attack is 4 again.
  lineSpec("22033:A:3", "Strength and Courage: exhaust The One Ring and raise threat by 1 to double the printed Attack for this attack", (effects) => {
    const tab = courage(effects, true);
    const [legolas, ring, wall] = [idsOf(tab, LEGOLAS), idsOf(tab, ONE_RING), idsOf(tab, WALL)];
    const worn = (tab.ids[COURAGE] ?? []).find((id) => tab.state.cards[id]?.host === legolas) ?? "";
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: wall, attackerIds: [legolas] }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("22033:response:1");
    const before = run.steps.length;
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: worn, effectId: "22033:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[ring]?.exhausted).toBe(true);
    expect(run.state.seats[0]?.threat).toBe(9);
    expect(strikes(run, before)).toEqual([[wall, 3 + 1 + 3]]);
    expect(stat(run.state, tab, legolas, "attack")).toBe(3 + 1);
  });

  // The Ring already exhausted: the cost cannot be paid.
  it("22033:A:3 Strength and Courage: not offered while The One Ring is exhausted", () => {
    const scene = courage(EFFECTS, true);
    const tab = { ...scene, state: updateCard(scene.state, idsOf(scene, ONE_RING), { exhausted: true }) };
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WALL), attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("22033:response:1");
  });
});

describe("Horn of the Mark (22035:A:1)", () => {
  // "Attach to a Rohan hero or Merry. Restricted.": Éowyn (a Rohan hero), Merry the hero and Merry the ally are offered; the Snowbourn Scout
  // (a Rohan ally) and Aragorn are not. Éowyn (Spirit) pays 1.
  lineSpec("22035:A:1", "Horn of the Mark: Attach to a Rohan hero or Merry", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: MERRY_HERO, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: MERRY_ALLY, seat: 0 }, { code: SNOWBOURN, seat: 0 }], hand: [{ code: HORN, seat: 0 }] });
    const horn = idsOf(tab, HORN);
    expect(hosts(tab, horn)).toEqual([idsOf(tab, EOWYN), idsOf(tab, MERRY_HERO), idsOf(tab, MERRY_ALLY)].sort());
    const run = play(begin(tab.state), tab, horn, idsOf(tab, MERRY_ALLY));
    expect(run.state.cards[horn]?.host).toBe(idsOf(tab, MERRY_ALLY));
    expect(hasKeyword(run.state, horn, "restricted", tab.ctx.cards)).toBe(true);
  });
});
