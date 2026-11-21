// Rules: rr.modifiers, rr.constant-ability, rr.restricted, rr.attachment-cards, rr.lasting-effects, rr.cost,
// rr.resource-match (data/rules/entries.json).
// The constants and events of the misc family, run through its real records (src/effects/authored/families/misc.ts).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/misc.ts";
import { hasTrait, holds } from "../../interpret/conditions.ts";

import { countMatching } from "../../interpret/pick.ts";
import { enforceRestricted, playCost } from "../../player/attach.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { updateCard, withThreat, type ScenarioState } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { attach, miscCtx } from "./fixture.ts";
import { offered, play, put, run, seat, send, trigger } from "../play/fixture.ts";

// The fixture event has an Action that does nothing: an event with no record at all cannot be played (rr.triggered-ability).
const SECRET: Effect = { id: "secret:action:1", cardCode: "secret", lines: ["secret:A:1"], timing: "action", instructions: [] };
const ctx = miscCtx([...RECORDS, SECRET]);

// The state with the constant records brought up to date (the engine does this as the phase moves).
function sync(state: ScenarioState): ScenarioState {
  return syncConstants(run(state, ctx), ctx);
}

function stat(state: ScenarioState, id: string, name: Parameters<typeof modifiedStat>[2]): number {
  return modifiedStat(state, state.cards[id]!, name, ctx.cards);
}

describe("stats read from the table", () => {
  it("Denethor gets -1 Willpower for each damaged hero you control (06057:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const denethor = put(table.state, "06057", "play");
    let state = sync(denethor.state);
    expect(stat(state, denethor.id, "willpower")).toBe(1);
    state = sync(updateCard(state, table.heroes[0] ?? "", { damage: 1 }));
    expect(stat(state, denethor.id, "willpower")).toBe(0);
    state = sync(updateCard(state, table.heroes[1] ?? "", { damage: 2 }));
    // A stat below 0 reads as 0 on the card; the modifier is -2.
    expect(stat(state, denethor.id, "willpower")).toBeLessThanOrEqual(0);
  });

  it("Eagles of the Misty Mountains gets +1 Attack and Defense for each facedown attachment (02119:A:1)", () => {
    const table = seat();
    const eagles = put(table.state, "02119", "play");
    const first = spawn(eagles.state, "item1", { zone: "under", locationId: eagles.id });
    const second = spawn(first.state, "item2", { zone: "under", locationId: eagles.id });
    const state = sync(second.state);
    expect(stat(state, eagles.id, "attack")).toBe(3);
    expect(stat(state, eagles.id, "defense")).toBe(3);
    expect(run(eagles.state, ctx).cards[eagles.id]).toBeDefined();
    expect(stat(sync(eagles.state), eagles.id, "attack")).toBe(1);
  });

  it("Guardian of Esgaroth gets +1 for each different player card attachment, to at most +3 (19002:A:1)", () => {
    const table = seat();
    const guardian = put(table.state, "19002", "play");
    let state = guardian.state;
    for (const code of ["item1", "item2", "blade", "sword"]) {
      const made = spawn(state, code, { zone: "play", seat: 0 });
      state = attachTo(made.state, made.id, guardian.id);
    }
    // Two attachments of the same name count once.
    const copy = spawn(state, "item1", { zone: "play", seat: 0 });
    state = sync(attachTo(copy.state, copy.id, guardian.id));
    expect(stat(state, guardian.id, "willpower")).toBe(3);
    expect(stat(state, guardian.id, "hitPoints")).toBe(4);
  });

  it("Keeping Count gets +1 Attack for each token another copy holds above its own (04005:A:2)", () => {
    const table = seat();
    const hero = table.heroes[0] ?? "";
    const other = table.heroes[1] ?? "";
    const mine = put(table.state, "04005", "play");
    const theirs = put(mine.state, "04005", "play");
    let state = attachTo(attachTo(theirs.state, mine.id, hero), theirs.id, other);
    state = sync(updateCard(updateCard(state, theirs.id, { resources: 3 }), mine.id, { resources: 1 }));
    expect(stat(state, hero, "attack")).toBe(2 + 2);
    expect(stat(state, other, "attack")).toBe(2);
  });

  it("Bombur counts as two when Dwarf characters are counted (132005:A:1)", () => {
    const table = seat(1, ["132005", "rohan"]);
    const state = sync(table.state);
    expect(countMatching(state, { type: "character", control: "you", trait: "Dwarf" }, 0, null, ctx)).toBe(2);
    expect(countMatching(state, { type: "character", control: "you", trait: "Rohan" }, 0, null, ctx)).toBe(1);
  });

  it("Friend of Friends gives +1 to each stat only while another hero has a copy attached (146012:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const [one, two] = table.heroes;
    const first = put(table.state, "146012", "play");
    const second = put(first.state, "146012", "play");
    let state = sync(attachTo(second.state, first.id, one ?? ""));
    expect(stat(state, one ?? "", "willpower")).toBe(2);
    state = sync(attachTo(state, second.id, two ?? ""));
    expect(stat(state, one ?? "", "willpower")).toBe(3);
    expect(stat(state, one ?? "", "attack")).toBe(3);
    expect(stat(state, one ?? "", "defense")).toBe(3);
    expect(stat(state, one ?? "", "hitPoints")).toBe(6);
    expect(stat(state, two ?? "", "hitPoints")).toBe(6);
  });
});

describe("Traits gained", () => {
  it("Lothíriel has the Rohan trait only while Éomer is in play (22027:A:1)", () => {
    const table = seat(1, ["22027", "dwarf"]);
    const lothiriel = table.heroes[0] ?? "";
    let state = sync(table.state);
    expect(hasTrait(state, lothiriel, "Rohan", ctx)).toBe(false);
    const eomer = put(state, "07001", "heroes");
    state = sync(eomer.state);
    expect(hasTrait(state, lothiriel, "Rohan", ctx)).toBe(true);
  });

  it("A Rohan ally shares a Trait with Lothíriel while Éomer is in play (22027:A:1, 22027:A:2)", () => {
    const table = seat(1, ["22027", "dwarf"]);
    const lothiriel = table.heroes[0] ?? "";
    const rider = put(table.state, "rider", "hand");
    const shares = { type: "card", control: "you", from: "hand", cardType: "ally", sharesTrait: "self" } as const;
    let state = sync(rider.state);
    expect(countMatching(state, shares, 0, lothiriel, ctx)).toBe(0);
    state = sync(put(state, "07001", "heroes").state);
    expect(countMatching(state, shares, 0, lothiriel, ctx)).toBe(1);
  });

  it("Mutual Accord swaps the Gondor and Rohan traits for the phase (05005:A:1)", () => {
    const table = seat(1, ["gondor", "rohan"]);
    const accord = put(table.state, "05005", "hand");
    let state = play(accord.state, accord.id, ctx);
    state = run(state, ctx);
    const [gondor, rohan] = table.heroes;
    expect(hasTrait(state, gondor ?? "", "Rohan", ctx)).toBe(true);
    expect(hasTrait(state, rohan ?? "", "Gondor", ctx)).toBe(true);
  });

  it("The Free Peoples needs 9 different Traits between the characters you control (17064:A:1, 17064:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const event = put(table.state, "17064", "hand");
    expect(holds(event.state, { kind: "distinctTraits", min: 9 }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(false);
    expect(() => play(event.state, event.id, ctx)).toThrow();
    // Dwarf, Noble, Rohan, Warrior, Dúnedain, Ranger, Gondor, Hobbit: add allies to reach 9.
    let state = event.state;
    for (const code of ["ranger", "gondor", "lore", "helper", "eagle"]) state = put(state, code, "heroes").state;
    state = put(state, "eagle", "play").state;
    expect(holds(state, { kind: "distinctTraits", min: 9 }, { actor: 0, sourceId: null, returned: 0 }, ctx)).toBe(true);
    const played = run(play(state, event.id, ctx), ctx);
    expect(played.cards[event.id]?.zone).toBe("discard");
  });
});

describe("Restricted attachments", () => {
  it("Raiment of War counts as 2 Restricted attachments, so a third one is too many (12034:A:1)", () => {
    const table = seat();
    const hero = table.heroes[0] ?? "";
    const raiment = put(table.state, "12034", "play");
    const other = put(raiment.state, "restricted1", "play");
    let state = sync(attachTo(attachTo(other.state, raiment.id, hero), other.id, hero));
    // Two restricted attachments counting 3: one has to go.
    const next = enforceRestricted(state, hero, ctx, []);
    expect(next.stack.length).toBeGreaterThan(state.stack.length);
    void state;
    state = next;
  });

  it("Snowmane loses the restricted keyword on Théoden only (144010:A:2)", () => {
    const table = seat(1, ["06134", "rohan"]);
    const one = put(table.state, "restricted1", "play");
    const two = put(one.state, "restricted2", "play");
    const snowmane = put(two.state, "144010", "play");
    const theoden = table.heroes[0] ?? "";
    let state = sync(attachTo(attachTo(attachTo(snowmane.state, one.id, theoden), two.id, theoden), snowmane.id, theoden));
    expect(enforceRestricted(state, theoden, ctx, []).stack.length).toBe(state.stack.length);
    const other = table.heroes[1] ?? "";
    state = sync(attachTo(attachTo(attachTo(snowmane.state, one.id, other), two.id, other), snowmane.id, other));
    expect(enforceRestricted(state, other, ctx, []).stack.length).toBeGreaterThan(state.stack.length);
  });
});

describe("play restrictions and costs", () => {
  it("Gildor's Counsel is played before characters are committed to the quest (02080:A:1)", () => {
    const table = seat();
    const counsel = put(table.state, "02080", "hand");
    const questing: ScenarioState = { ...counsel.state, phase: "Quest", mode: "questCommit", boundaryPhase: "Quest" };
    expect(offered(questing, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === counsel.id)).toBe(true);
    const committed = updateCard(questing, table.heroes[0] ?? "", { committed: true });
    expect(offered(committed, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === counsel.id)).toBe(false);
    const planning = counsel.state;
    expect(offered(planning, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === counsel.id)).toBe(false);
  });

  it("The White Council costs one resource for each player (08010:A:1)", () => {
    const one = seat(1);
    const council = put(one.state, "08010", "hand");
    expect(playCost(council.state, council.id, 0, ctx)).toBe(1);
    const two = seat(2);
    const second = put(two.state, "08010", "hand");
    expect(playCost(second.state, second.id, 0, ctx)).toBe(2);
    // Overpaying or underpaying is refused.
    const [first, other] = two.heroes;
    expect(() => play(second.state, second.id, ctx, [{ heroId: first ?? "", amount: 1 }])).toThrow();
    expect(() => play(second.state, second.id, ctx, [{ heroId: first ?? "", amount: 3 }])).toThrow();
    const played = play(second.state, second.id, ctx, [{ heroId: first ?? "", amount: 1 }, { heroId: other ?? "", amount: 1 }]);
    expect(played.cards[second.id]?.zone).toBe("discard");
  });

  it("Leaf Brooch gives the first event of the hero's sphere Secrecy 1 each round, while threat is 20 or less (08034:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const brooch = put(table.state, "08034", "play");
    const first = put(brooch.state, "secret", "hand");
    const second = put(first.state, "secret", "hand");
    // dwarf: leadership; the event is spirit, so no secrecy for it. Attach to the spirit hero.
    let state = run(attachTo(second.state, brooch.id, table.heroes[1] ?? ""), ctx);
    state = withThreat(state, 0, 20);
    expect(playCost(state, first.id, 0, ctx)).toBe(1);
    const played = run(play(state, first.id, ctx, [{ heroId: table.heroes[1] ?? "", amount: 1 }]), ctx);
    expect(playCost(played, second.id, 0, ctx)).toBe(2);
    // A threat above 20 gives none.
    const high = withThreat(state, 0, 30);
    expect(playCost(high, first.id, 0, ctx)).toBe(2);
  });

  it("A Good Harvest lets any resource pay for cards of the named sphere until the end of the phase (06010:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const harvest = put(table.state, "06010", "hand");
    const ally = put(harvest.state, "rider", "hand");
    const dwarf = table.heroes[0] ?? "";
    // The Rohan rider is Spirit: the Leadership hero cannot pay.
    expect(() => play(ally.state, ally.id, ctx, [{ heroId: dwarf, amount: 1 }])).toThrow();
    let state = play(ally.state, harvest.id, ctx);
    expect(state.window).toMatchObject({ kind: "choose" });
    state = send(state, { type: "Choose", optionId: "spirit" }, ctx);
    const paid = play(state, ally.id, ctx, [{ heroId: dwarf, amount: 1 }]);
    expect(paid.cards[ally.id]?.zone).toBe("play");
    expect(paid.cards[dwarf]?.resources).toBe(4);
  });
});

describe("events", () => {
  it("Hidden Cache spends 1 resource to draw 1 card (06143:A:2)", () => {
    const table = seat();
    const cache = put(table.state, "06143", "hand");
    const deck = put(cache.state, "filler", "deck");
    let state = run(play(deck.state, cache.id, ctx), ctx);
    if (state.window?.kind === "choose") state = send(state, { type: "Choose", optionId: table.heroes[0] ?? "" }, ctx);
    expect(state.seats[0]?.hand).toContain(deck.id);
    expect((table.heroes.map((id) => state.cards[id]?.resources ?? 0)).reduce((sum, value) => sum + value, 0)).toBe(9);
  });

  it("Straight Shot exhausts a Weapon to discard a non-unique enemy with 0 Defense (132009:A:1)", () => {
    const table = seat();
    const shot = put(table.state, "132009", "hand");
    const sword = put(shot.state, "sword", "play");
    const brute = put(sword.state, "brute", "engaged");
    const grunt = put(brute.state, "grunt", "engaged");
    const state0 = attachTo(grunt.state, sword.id, table.heroes[0] ?? "");
    let state = run(play(state0, shot.id, ctx), ctx);
    expect(state.cards[sword.id]?.exhausted).toBe(true);
    expect(state.cards[brute.id]?.zone).not.toBe("engaged");
    expect(state.cards[grunt.id]?.zone).toBe("engaged");
    state = run(state, ctx);
  });

  it("Revealed in Wrath blanks a non-unique enemy's text box until the end of the phase (12061:A:2)", () => {
    const table = seat(1, ["11001", "rohan"]);
    const wrath = put(table.state, "12061", "hand");
    const grunt = put(wrath.state, "grunt", "engaged");
    const state = run(play(grunt.state, wrath.id, ctx), ctx);
    expect(state.modifiers.some((modifier) => modifier.stat === "blankText" && modifier.instanceId === grunt.id)).toBe(true);
  });

  it("Spare Hood and Cloak readies another character and moves to it (131012:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const hood = put(table.state, "131012", "play");
    const hero = table.heroes[0] ?? "";
    const other = table.heroes[1] ?? "";
    let state = updateCard(attach(hood.state, hood.id, hero), other, { exhausted: true });
    state = trigger(state, hood.id, "131012:action:1", ctx);
    expect(state.cards[other]?.exhausted).toBe(false);
    expect(state.cards[hero]?.exhausted).toBe(true);
    expect(state.cards[hood.id]?.host).toBe(other);
    expect(state.cards[hood.id]?.exhausted).toBe(true);
  });

  it("Tale of Tinúviel exhausts a Noldor to ready a Dúnedain and adds the exhausted one's printed Willpower (10146:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const tale = put(table.state, "10146", "hand");
    const noldor = put(tale.state, "noldor", "play");
    const dunedain = put(noldor.state, "dunedain", "play");
    let state = updateCard(dunedain.state, dunedain.id, { exhausted: true });
    state = run(play(state, tale.id, ctx), ctx);
    // Only one direction is possible, so no choice is asked.
    expect(state.cards[noldor.id]?.exhausted).toBe(true);
    expect(state.cards[dunedain.id]?.exhausted).toBe(false);
    expect(stat(state, dunedain.id, "willpower")).toBe(1 + 3);
    expect(stat(state, dunedain.id, "attack")).toBe(1 + 3);
    expect(stat(state, dunedain.id, "defense")).toBe(1 + 3);
  });
});
