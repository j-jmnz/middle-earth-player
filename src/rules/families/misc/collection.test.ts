// Rules: rr.hero-cards, rr.unique-cards, rr.attachment-cards, rr.gains, rr.the-word-choose (data/rules/entries.json).
// The collection cards of the misc family, run through its real records: Helm of Secrecy swaps a hero for one from the
// collection, Thorongil attaches another version of its host and lends its game text and resource icon.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/misc.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { grantedIcons } from "../../interpret/conditions.ts";
import { cardMap } from "../../core/test-fixture.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { definePrinted, type PrintedCard } from "../../core/printed.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo } from "../../core/zones.ts";
import { choices } from "./fixture.ts";
import { play, put, run, seat, send, trigger, triggers } from "../play/fixture.ts";

const hero = (code: string, name: string, sphere: PrintedCard["sphere"], threat: number, traits: string[] = []) =>
  definePrinted({ code, name, type: "hero", sphere, threat, willpower: 2, attack: 2, defense: 2, health: 4, traits, isUnique: true });

const CARDS = cardMap([
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  hero("h1", "Hero One", "tactics", 9, ["Noble"]),
  hero("h2", "Hero Two", "spirit", 9),
  hero("c1", "Collected One", "lore", 8),
  hero("c2", "Collected Two", "leadership", 9),
  hero("c3", "Too Dear", "spirit", 12),
  hero("cf", "Fellowship Hero", "fellowship", 5),
  hero("cb", "Baggins Hero", "baggins", 5),
  hero("cu", "Hero Two", "lore", 5),
  hero("lo", "Low One", "leadership", 4),
  hero("h1b", "Hero One", "lore", 9),
  hero("h1c", "Hero One", "spirit", 7),
  hero("h1f", "Hero One", "fellowship", 7),
  definePrinted({ code: "22090", name: "Helm of Secrecy", type: "event", sphere: "neutral", cost: 0 }),
  definePrinted({ code: "22146", name: "Thorongil", type: "attachment", sphere: "neutral", cost: 0, traits: ["Title"] }),
  definePrinted({ code: "blade", name: "Blade", type: "attachment", sphere: "neutral", cost: 0, traits: ["Item"] }),
  definePrinted({ code: "noble-only", name: "Noble Crown", type: "attachment", sphere: "neutral", cost: 0, traits: ["Item"] }),
]);
const crown: Effect = { id: "noble-only:constant:1", cardCode: "noble-only", lines: ["noble-only:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", hosts: [{ type: "hero", control: "you", trait: "Noble" }] }] };
const lent: Effect = { id: "h1b:constant:1", cardCode: "h1b", lines: ["h1b:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 3, until: "whileSourceInPlay" }] };
const ctx = { effects: [...RECORDS, crown, lent], cards: CARDS };

describe("Helm of Secrecy (22090:A:2)", () => {
  it("swaps a chosen hero for one from the collection: no more Threat cost, no Fellowship or Baggins, no title in play", () => {
    const table = seat(1, ["h1", "h2"]);
    const [one, two] = table.heroes;
    const helm = put(table.state, "22090", "hand");
    const blade = put(helm.state, "blade", "play");
    const crownCard = put(blade.state, "noble-only", "play");
    let state = attachTo(attachTo(crownCard.state, blade.id, one ?? ""), crownCard.id, one ?? "");
    state = updateCard(state, one ?? "", { damage: 2, resources: 3 });
    state = play(state, helm.id, ctx);
    // Which hero: both are offered.
    expect(state.window).toMatchObject({ kind: "choose" });
    state = send(state, { type: "Choose", optionId: one ?? "" }, ctx);
    // The tokens are gone; the collection offers c1, c2 and lo (c3 costs too much, cf and cb are Fellowship and Baggins, cu shares a title in play).
    expect(state.cards[one ?? ""]).toMatchObject({ damage: 0, resources: 0 });
    const names = choices(state).map((id) => state.cards[id]?.code).sort();
    expect(names).toEqual(["c1", "c2", "lo"]);
    const wanted = choices(state).find((id) => state.cards[id]?.code === "c1") ?? "";
    state = send(state, { type: "Choose", optionId: wanted }, ctx);
    // The new hero took the old one's place; the old one left the game; the other candidates never existed.
    expect(state.seats[0]?.heroes).toEqual([wanted, two]);
    expect(state.cards[wanted]?.zone).toBe("heroes");
    expect(state.cards[one ?? ""]?.zone).toBe("removed");
    expect(Object.values(state.cards).filter((card) => card.zone === "setAside")).toEqual([]);
    expect(Object.values(state.cards).some((card) => card.code === "c2")).toBe(false);
    // The Blade moved with the hero; the Noble Crown could not, and was discarded.
    expect(state.cards[blade.id]?.host).toBe(wanted);
    expect(state.cards[crownCard.id]?.zone).toBe("discard");
    expect(state.cards[helm.id]?.zone).toBe("discard");
  });
});

describe("Helm of Secrecy, the hero it can change (rr.the-word-choose, rr.triggered-ability)", () => {
  // The hero chosen must be one the effect can act on: with no token to discard and no hero of the collection at its Threat cost or less, a hero is not offered.
  const offered = (tokens: boolean) => {
    const table = seat(1, ["h1", "lo"]);
    const [one, low] = table.heroes;
    const helm = put(table.state, "22090", "hand");
    // The fixture's heroes hold resources: the swap is read with none on the low hero, and then with some.
    const state = updateCard(updateCard(helm.state, low ?? "", { resources: tokens ? 2 : 0 }), one ?? "", { resources: 0 });
    const played = play(state, helm.id, ctx);
    return { one, low, ids: choices(played), zones: choices(played).map((id) => played.cards[id]?.zone) };
  };
  it("takes the hero with a collection hero to swap in without asking when the other has no tokens: the next choice is a collection hero", () => {
    const made = offered(false);
    expect(made.zones.length).toBeGreaterThan(0);
    expect(made.zones.every((zone) => zone === "setAside")).toBe(true);
  });
  it("offers the hero with tokens to discard too", () => {
    const made = offered(true);
    expect(made.ids.sort()).toEqual([made.one, made.low].sort());
  });
});

describe("Thorongil (22146:A:2)", () => {
  it("attaches another version of its host, which lends its game text and its resource icon while Thorongil is in play", () => {
    const table = seat(1, ["h1", "h2"]);
    const one = table.heroes[0] ?? "";
    const thorongil = put(table.state, "22146", "hand");
    let state = play(thorongil.state, thorongil.id, ctx, [], one);
    state = run(state, ctx);
    expect(triggers(state, ctx, "22146:response:1")).toHaveLength(1);
    state = trigger(state, thorongil.id, "22146:response:1", ctx);
    // h1b and h1c are other versions; the Fellowship one is not in the collection.
    expect(choices(state).map((id) => state.cards[id]?.code).sort()).toEqual(["h1b", "h1c"]);
    const wanted = choices(state).find((id) => state.cards[id]?.code === "h1b") ?? "";
    state = send(state, { type: "Choose", optionId: wanted }, ctx);
    expect(state.cards[thorongil.id]?.lends).toBe(wanted);
    expect(Object.values(state.cards).some((card) => card.code === "h1c")).toBe(false);
    // The host has the lent card's text (+3 Willpower) and its Lore icon.
    const synced = syncConstants(state, ctx);
    expect(modifiedStat(synced, synced.cards[one]!, "willpower", ctx.cards)).toBe(2 + 3);
    expect(grantedIcons(synced, one, ctx)).toContain("lore");
    // Once Thorongil is gone, so is it.
    const without = syncConstants({ ...synced, cards: { ...synced.cards, [one]: { ...synced.cards[one]!, attachments: [] } } }, ctx);
    expect(modifiedStat(without, without.cards[one]!, "willpower", ctx.cards)).toBe(2);
    expect(grantedIcons(without, one, ctx)).not.toContain("lore");
  });
});
