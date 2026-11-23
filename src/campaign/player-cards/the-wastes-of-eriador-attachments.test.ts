// Rules: rr.attachment-cards, rr.restricted, rr.response, rr.cost, rr.cancel, rr.sentinel, rr.damage (data/rules/entries.json).
// The Wastes of Eriador attachments, written from their card text (data/cards/WoE.json; data/printed holds no ledger for this pack, so the
// lines are the text of data/cards and every intent goes through sendUnledgered): Raven-winged Helm 10005:A:1 and A:2, Hobbit Pony
// 10007:A:1. The allies, events and side quest are in the-wastes-of-eriador.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { atDefense, chooseIfAsked, hosts, passAll, play, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const HELM = "10005";
const PONY = "10007";
// Sam (a Hobbit hero), the Pal (a Leadership Hobbit hero, test/harness/scene.ts), Aragorn (not a Hobbit).
const SAM = "141002";
const ARAGORN = "01001";
const PAL = "pal";
// Heroes with no text: a Tactics hero with sentinel, a Tactics hero without, a Spirit hero, all of 9 hit points.
const SENTINEL = "sentinel-hero";
const TACTICS = "tactics-hero";
const SPIRIT = "spirit-hero";
// A Hobbit ally and an ally with sentinel.
const HOBBIT_ALLY = "hobbit-ally";
const WATCH_ALLY = "watch-ally";
// An enemy that engages nobody, Attack 4, which the tests' attacks do not destroy.
const BRUTE = "brute";
// A neutral restricted attachment of cost 0 with no text.
const GEAR = "gear";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([HELM, PONY, SAM, ARAGORN]))]);
  const hero = (code: string, sphere: "tactics" | "spirit", keywords = {}) => definePrinted({ code, name: code, type: "hero", sphere, threat: 9, willpower: 2, attack: 2, defense: 1, health: 9, keywords });
  cards.set(SENTINEL, hero(SENTINEL, "tactics", { sentinel: true }));
  cards.set(TACTICS, hero(TACTICS, "tactics"));
  cards.set(SPIRIT, hero(SPIRIT, "spirit"));
  cards.set(HOBBIT_ALLY, definePrinted({ code: HOBBIT_ALLY, name: "Hobbit Ally", type: "ally", sphere: "spirit", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Hobbit"] }));
  cards.set(WATCH_ALLY, definePrinted({ code: WATCH_ALLY, name: "Watch Ally", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, keywords: { sentinel: true } }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 4, defense: 9, health: 9 }));
  cards.set(GEAR, definePrinted({ code: GEAR, name: "Gear", type: "attachment", cost: 0, keywords: { restricted: true } }));
  base = { ...starter, cards };
});

// The combat phase on `tab`: its windows passed to the first defense, `defender` declared, and the run back at the Response window that
// follows the damage.
function defended(tab: Table, defender: string): Run {
  const run = atDefense(tab);
  return passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
}

describe("Raven-winged Helm (10005:A:1, A:2)", () => {
  // "Attach a hero with Sentinel. Limit 1 per hero.": the hero with sentinel is offered; the hero without it and the ally with sentinel are
  // not. Once the Helm is on her, a second Helm has no host.
  lineSpec("10005:A:1", "Raven-winged Helm: attach to a hero with sentinel, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: SENTINEL, seat: 0 }, { code: TACTICS, seat: 0 }], allies: [{ code: WATCH_ALLY, seat: 0 }], hand: [{ code: HELM, seat: 0 }, { code: HELM, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[HELM] ?? [];
    const sentinel = idsOf(tab, SENTINEL);
    expect(hosts(tab, first)).toEqual([sentinel]);
    const run = play(begin(tab.state), tab, first, sentinel);
    expect(run.state.cards[first]?.host).toBe(sentinel);
    expect(hosts(tab, second, run.state)).toEqual([]);
  });

  // "Response: Exhaust Raven-winged Helm to prevent 1 point of damage just dealt to attached character.": the hero with the Helm defends the
  // Brute (4 against Defense 1) and takes 2 damage, not 3; the Helm is exhausted.
  lineSpec("10005:A:2", "Raven-winged Helm: exhaust it to prevent 1 damage just dealt to the attached hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: SENTINEL, seat: 0 }, { code: TACTICS, seat: 0 }], attached: [{ code: HELM, host: SENTINEL }], engaged: [{ code: BRUTE, seat: 0 }] });
    const [sentinel, helm] = [idsOf(tab, SENTINEL), idsOf(tab, HELM)];
    let run = defended(tab, SENTINEL);
    expect(triggers(run.state, tab)).toContain("10005:response:1");
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: helm, effectId: "10005:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[sentinel]?.damage).toBe(3 - 1);
    expect(run.state.cards[helm]?.exhausted).toBe(true);
  });

  // "attached character": damage dealt to the other hero offers no Response.
  it("10005:A:2 Raven-winged Helm: no Response for damage dealt to another character", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SENTINEL, seat: 0 }, { code: TACTICS, seat: 0 }], attached: [{ code: HELM, host: SENTINEL }], engaged: [{ code: BRUTE, seat: 0 }] });
    const run = defended(tab, TACTICS);
    expect(run.state.cards[idsOf(tab, TACTICS)]?.damage).toBe(3);
    expect(triggers(run.state, tab)).not.toContain("10005:response:1");
  });
});

describe("Hobbit Pony (10007:A:1)", () => {
  // "Attach to a Hobbit hero.": Sam and the Pal (Hobbit heroes) are offered; Aragorn and the Hobbit ally are not. The Spirit hero pays.
  lineSpec("10007:A:1", "Hobbit Pony: attach to a Hobbit hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: SAM, seat: 0 }, { code: PAL, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: SPIRIT, seat: 0 }], allies: [{ code: HOBBIT_ALLY, seat: 0 }], hand: [{ code: PONY, seat: 0 }] });
    const pony = idsOf(tab, PONY);
    expect(hosts(tab, pony)).toEqual([idsOf(tab, SAM), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, pony, idsOf(tab, PAL)).state.cards[pony]?.host).toBe(idsOf(tab, PAL));
  });

  // "Restricted.": played on Sam, who has two restricted attachments already, it leaves him with two.
  it("10007:A:1 Hobbit Pony: restricted, a third restricted attachment on the hero does not stay", () => {
    const tab = table(EFFECTS, { heroes: [{ code: SAM, seat: 0 }, { code: SPIRIT, seat: 0 }], attached: [{ code: GEAR, host: SAM }, { code: GEAR, host: SAM }], hand: [{ code: PONY, seat: 0 }] });
    const sam = idsOf(tab, SAM);
    let run = play(begin(tab.state), tab, idsOf(tab, PONY), sam);
    run = chooseIfAsked(run, tab, idsOf(tab, GEAR));
    const on = Object.values(run.state.cards).filter((card) => card.host === sam);
    expect(on).toHaveLength(2);
    expect(run.state.seats[0]?.discard).toHaveLength(1);
  });
});
