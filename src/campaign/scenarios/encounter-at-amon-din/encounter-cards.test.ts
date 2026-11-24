// Rules: rr.reveal, rr.surge, rr.doomed-x, faq.simultaneous-effects, rr.first-player, rr.response, ats.villagers (data/rules/entries.json).
// The encounter cards of Encounter at Amon Dîn that a spec row cannot show: Craven Eagle's tie and its choices (06074:A:1), the Forced effects of the locations (06075:A:2, 06076:A:2), Orc Ravager and Lord Alcaron (06073:A:1), the keywords of Burnt Homestead and Trapped Inside (06078:A:1, 06079:A:1) and Panicked! (06080:A:1) for two players.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { idOf, legalIntents, revealFromTop, send } from "../../../../test/harness/scene-kit.ts";
import { CODES, damageOn, table, villagers } from "../../../../test/scenarios/encounter-at-amon-din/table.ts";

const { protect, rescued, dead, alcaron, eagle, ravager, farmhouse, hamlet, secluded, homestead, trapped, panicked } = CODES;

const options = (state: ScenarioState): readonly string[] => (state.window?.kind === "choose" ? state.window.options : []);
const reveal = (made: ReturnType<typeof table>, code: string) => revealFromTop(made.state, made.ctx, code, []).state;

describe("06074:A:1 Craven Eagle", () => {
  const hand = (cards: number) => Array.from({ length: cards }, () => "filler");

  it("06074:A:1 a tie for the fewest hit points left (the heroes of two players, all with 6) is chosen by the first player, and the card goes to the player who owns it", () => {
    const made = table({ seats: 2, stage: protect, staging: [rescued, dead], hand: hand(3), deck: ["f0", "f0"] });
    const asked = reveal(made, eagle);
    const tied = options(asked);
    // The tie is for the three heroes of the table: the first player picks one of them.
    expect(tied.length).toBeGreaterThanOrEqual(2);
    expect(tied.every((id) => asked.cards[id]?.zone === "heroes")).toBe(true);
    const second = made.state.seats[1]?.heroes[0] ?? "";
    expect(tied).toContain(second);
    const picked = send({ state: asked, steps: [] }, { type: "Choose", optionId: second }, made.ctx).state;
    expect(options(picked)).toEqual(["prevent", "allow"]);
    const done = send({ state: picked, steps: [] }, { type: "Choose", optionId: "allow" }, made.ctx).state;
    expect(done.cards[second]?.zone).not.toBe("heroes");
  });

  it("06074:A:1 a hero with damage has fewer hit points left: with 4 damage on a hero with 6 it is the one discarded and no tie is asked", () => {
    const made = table({ stage: protect, staging: [rescued, dead], hand: hand(3), deck: ["f0", "f0"], heroes: [] });
    const hurt = { ...made.state, cards: { ...made.state.cards, [made.hero2]: { ...made.state.cards[made.hero2]!, damage: 4 } } };
    const asked = revealFromTop(hurt, made.ctx, eagle, []).state;
    expect(options(asked)).toEqual(["prevent", "allow"]);
    const done = send({ state: asked, steps: [] }, { type: "Choose", optionId: "allow" }, made.ctx).state;
    expect(done.cards[made.hero2]?.zone).not.toBe("heroes");
    expect(done.cards[made.hero]?.zone).toBe("heroes");
  });

  it("06074:A:1 an ally can be the character with the fewest hit points left: the stand-in ally (2 hit points) is discarded when its controller does not discard 3 cards", () => {
    const made = table({ stage: protect, staging: [rescued, dead], hand: hand(3), play: ["ally"], deck: ["f0", "f0"] });
    const asked = reveal(made, eagle);
    const done = send({ state: asked, steps: [] }, { type: "Choose", optionId: "allow" }, made.ctx).state;
    expect(done.cards[idOf(made.state, "ally")]?.zone).not.toBe("play");
    expect(done.cards[made.hero]?.zone).toBe("heroes");
  });

  it("06074:A:1 the controller discards 3 cards at random from his hand to prevent: with fewer than 3 he is offered no prevention", () => {
    const made = table({ stage: protect, staging: [rescued, dead], hand: hand(2), play: ["ally"], deck: ["f0", "f0"] });
    const done = reveal(made, eagle);
    expect(options(done)).toEqual([]);
    expect(done.cards[idOf(made.state, "ally")]?.zone).not.toBe("play");
  });

  it("06074:A:1 the discard of Lord Alcaron (3 hit points, an objective ally) makes the players lose at once, because he left play", () => {
    const made = table({ stage: protect, staging: [rescued, dead], hand: hand(0), play: [alcaron], deck: ["f0", "f0"] });
    expect(reveal(made, eagle).lost).toBe(true);
  });
});

describe("the locations' Forced effects", () => {
  it("06076:A:2 Gondorian Hamlet as the active location does not discard a token when a treachery is revealed: the Forced effect is for the staging area only", () => {
    const made = table({ stage: protect, active: { code: hamlet, resources: 3 }, staging: [rescued, dead], deck: ["f0", "f0"] });
    const done = reveal(made, "treachery");
    expect(villagers(done, hamlet)).toBe(3);
    expect(damageOn(done, dead)).toBe(0);
  });

  it("06076:A:2 a treachery with surge counts, and an enemy revealed does not: Burnt Homestead (Surge) takes 1 token off the Hamlet, the enemy takes none", () => {
    const made = table({ stage: protect, staging: [{ code: hamlet, resources: 3 }, rescued, dead], deck: ["f0", "f0", "f0"] });
    expect(villagers(reveal(made, homestead), hamlet)).toBe(2);
    const enemy = table({ stage: protect, staging: [{ code: hamlet, resources: 3 }, rescued, dead], deck: ["f0", "f0", "f0"] });
    expect(villagers(reveal(enemy, "f0"), hamlet)).toBe(3);
  });

  it("06077:A:2 Travel: the players reveal the top encounter card and it resolves as any reveal (a When Revealed: Burnt Homestead raises threat and gains surge); with an empty deck they cannot travel", () => {
    const made = table({ stage: protect, phase: "Travel", staging: [{ code: secluded, resources: 2 }, rescued, { code: dead, damage: 2 }], deck: [homestead, "f3", "f0"] });
    const traveled = send({ state: made.state, steps: [] }, { type: "Travel", locationId: idOf(made.state, secluded) }, made.ctx).state;
    // A treachery goes to the discard pile once it resolved; its Surge revealed the enemy after it.
    expect(traveled.cards[idOf(traveled, homestead)]?.zone).toBe("encounterDiscard");
    expect(traveled.seats[0]?.threat).toBe(made.state.seats[0]!.threat + 2);
    expect(traveled.cards[idOf(traveled, "f3")]?.zone).toBe("staging");
    const empty = table({ stage: protect, phase: "Travel", staging: [{ code: secluded, resources: 2 }, rescued, dead], deck: [] });
    expect(legalIntents(empty.state, empty.ctx).some((intent) => intent.type === "Travel")).toBe(false);
  });
});

describe("06073:A:1 Orc Ravager and Lord Alcaron", () => {
  it("06073:A:1 when Lord Alcaron saves the discarded token afterwards the token was still discarded: no surge, and Dead Villagers keeps its damage token", () => {
    const made = table({ stage: protect, active: { code: farmhouse, resources: 1 }, staging: [rescued, dead, hamlet], play: [alcaron], deck: ["f3", "f0", "f0"] });
    const asked = reveal(made, ravager);
    expect(asked.window?.kind).toBe("response");
    const use = legalIntents(asked, made.ctx).find((intent) => intent.type === "Trigger");
    let run = send({ state: asked, steps: [] }, use as never, made.ctx);
    if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
    expect(damageOn(run.state, dead)).toBe(1);
    // No surge: the enemy of the deck is still there.
    expect(run.state.cards[idOf(run.state, "f3")]?.zone).toBe("encounterDeck");
  });
});

describe("06078:A:1 and 06079:A:1 the keywords", () => {
  it("06078:A:1 Burnt Homestead has Surge: the next card of the encounter deck is revealed too", () => {
    const made = table({ stage: protect, staging: [rescued, dead], deck: ["f3", "f0", "f0"] });
    expect(reveal(made, homestead).cards[idOf(made.state, "f3")]?.zone).toBe("staging");
  });

  it("06079:A:1 Trapped Inside has Doomed 2: each player raises his threat by 2", () => {
    const made = table({ seats: 2, stage: protect, active: { code: farmhouse, resources: 3 }, staging: [rescued, dead], deck: ["f0", "f0"] });
    const done = reveal(made, trapped);
    expect(done.seats.map((seat) => seat.threat)).toEqual(made.state.seats.map((seat) => seat.threat + 2));
  });
});

describe("06080:A:1 Panicked! for two players", () => {
  it("06080:A:1 the first player places a token first; the second player is unable once Rescued Villagers is empty, and no surge follows because a token was placed", () => {
    const made = table({ seats: 2, stage: protect, staging: [{ code: rescued, resources: 1 }, dead, secluded, hamlet], deck: ["f3", "f0", "f0"] });
    let state = reveal(made, panicked);
    expect(options(state).length).toBeGreaterThan(0);
    state = send({ state, steps: [] }, { type: "Choose", optionId: options(state)[0] ?? "" }, made.ctx).state;
    expect(villagers(state, rescued)).toBe(0);
    expect(state.cards[idOf(made.state, "f3")]?.zone).toBe("encounterDeck");
  });

  it("06080:A:1 with 2 tokens both players place one: the first player first, each on a location in the staging area, and the move is no discard", () => {
    const made = table({ seats: 2, stage: protect, staging: [{ code: rescued, resources: 2 }, dead, secluded], deck: ["f3", "f0", "f0"] });
    const done = reveal(made, panicked);
    expect(villagers(done, rescued)).toBe(0);
    expect(villagers(done, secluded)).toBe(2);
    expect(damageOn(done, dead)).toBe(0);
  });

  it("06080:A:1 the active location is not in the staging area: with Rescued Villagers holding tokens and no location in the staging area nobody can place one and Panicked! gains surge", () => {
    const made = table({ stage: protect, active: farmhouse, staging: [{ code: rescued, resources: 2 }, dead], deck: ["f3", "f0", "f0"] });
    const done = reveal(made, panicked);
    expect(villagers(done, rescued)).toBe(2);
    expect(done.cards[idOf(made.state, "f3")]?.zone).toBe("staging");
  });
});
