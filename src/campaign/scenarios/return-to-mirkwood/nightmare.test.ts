// Rules: sotm.guarding-gollum, rr.forced, rr.then, rr.cannot, rr.destroy, rr.shadow-effects, rr.active-location, rr.staging, rr.first-player, sotm.removed-from-game (data/rules/entries.json); ledger lines 900901:A:2, 900901:A:3, 900902:A:1, 900903:A:1, 900903:A:2, 900904:A:1, 900904:A:2, 900905:A:1, 900905:A:2, 900906:A:1, 900906:A:2,
// 900907:A:2, 900908:A:1, 900908:A:2, 900909:A:1, 900909:A:2.
// The Nightmare deck of Return to Mirkwood (the setup card 900901 and the eight cards the recipe adds, docs/brief.md, Nightmare). Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { guardianCanChange, guardianSeat } from "../../../rules/families/guardian/seats.ts";
import { hasKeyword } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, finish, first, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const GOLLUM = "02130";
const table = (layout: Layout = {}) => tableFromLayout("return-to-mirkwood", { seats: 2, play: [{ code: GOLLUM, seat: 0 }], ...layout });
const threat = (state: ScenarioState, seat: number) => state.seats[seat]?.threat ?? 0;
const zoneOf = (state: ScenarioState, code: string) => state.cards[first(state, code)]?.zone;
const answer = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
const exhaustAll = (state: ScenarioState, seat: number) => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, card.zone === "heroes" && card.controller === seat ? { ...card, exhausted: true } : card])) }) as ScenarioState;
// The setup card lies beside the quest deck.
const nightmare = (layout: Layout = {}) => {
  const made = table(layout);
  const setup = spawn(made.state, "900901", { zone: "nightmare" });
  return { ...made, state: syncConstants(setup.state, made.ctx), setupId: setup.id };
};
const revealed = (made: ReturnType<typeof table>, code: string, pick?: (state: ScenarioState) => string) => finish({ state: revealFromTop(made.state, made.ctx, code, [] as EngineStep[]).state, steps: [] }, made.ctx, pick).state;
const offered = (state: ScenarioState): readonly string[] => (state.window?.kind === "choose" ? state.window.options : []);

describe("900901 Return to Mirkwood Nightmare", () => {
  const begin = (layout: Layout, pick?: (state: ScenarioState) => string) => {
    const made = nightmare({ play: [{ code: GOLLUM, seat: 1 }], ...layout });
    return { made, ...resolveRecords(made.state, made.ctx, "900901", "forced", made.setupId, pick) };
  };

  it("900901:A:2 at the beginning of the quest phase the guard chooses: exhaust a hero he controls, or resolve the When Revealed of the topmost Tantrum in the encounter discard pile", () => {
    const asked: (readonly string[])[] = [];
    begin({ discard: ["02135"] }, (state) => {
      asked.push(offered(state));
      return "exhaust";
    });
    expect(asked[0]).toEqual(["exhaust", "tantrum"]);
  });

  it("900901:A:2 exhausting a hero takes the guard's only ready hero", () => {
    const { run, made } = { run: begin({ discard: ["02135"] }, answer("exhaust")), made: nightmare() };
    expect(run.state.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect(run.state.cards[made.hero]?.exhausted).toBeFalsy();
  });

  it("900901:A:2 the Tantrum's When Revealed resolves for the guard and the card stays in the discard pile; its choice of a new guard resolves too", () => {
    const run = begin({ discard: ["02135", "f0"], threat: [28, 30] }, answer("tantrum"));
    expect(threat(run.state, 1)).toBe(38);
    expect(threat(run.state, 0)).toBe(28);
    expect(guardianSeat(run.state)).toBe(0);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toContain("02135");
  });

  it("900901:A:2 an option that cannot be fully resolved is not offered: with no Tantrum he exhausts a hero, with no ready hero he resolves the Tantrum, with neither nothing is asked", () => {
    const noTantrum: (readonly string[])[] = [];
    begin({ discard: ["f0"] }, (state) => {
      noTantrum.push(offered(state));
      return "";
    });
    expect(noTantrum).toEqual([]);
    const tired = nightmare({ play: [{ code: GOLLUM, seat: 1 }], discard: ["02135"], threat: [28, 30] });
    const tiredRun = resolveRecords(exhaustAll(tired.state, 1), tired.ctx, "900901", "forced", tired.setupId, (state) => {
      throw new Error(`asked ${JSON.stringify(state.window)}`);
    });
    expect(threat(tiredRun.state, 1)).toBe(38);
    const neither = nightmare({ play: [{ code: GOLLUM, seat: 1 }], discard: ["f0"], threat: [28, 30] });
    const nothing = resolveRecords(exhaustAll(neither.state, 1), neither.ctx, "900901", "forced", neither.setupId);
    expect(threat(nothing.state, 1)).toBe(30);
  });

  it("900901:A:3 when stage 4A is revealed one Attercop is searched in the encounter deck and its discard pile and added to the staging area, not revealed, then the deck is shuffled", () => {
    const made = nightmare({ stage: "02129", deck: ["f0", "f0"], discard: ["02139"] });
    const stage = first(made.state, "02129");
    const state = settle(fireForced({ ...made.state, window: null }, { trigger: "stageRevealed", seat: null, subject: stage }, made.ctx, []), made.ctx, []);
    expect(zoneOf(state, "02139")).toBe("staging");
    const inDeck = nightmare({ stage: "02129", deck: ["f0", "02139", "f0"] });
    const found = settle(fireForced({ ...inDeck.state, window: null }, { trigger: "stageRevealed", seat: null, subject: first(inDeck.state, "02129") }, inDeck.ctx, []), inDeck.ctx, []);
    expect(zoneOf(found, "02139")).toBe("staging");
    expect(found.encounterDeck).toHaveLength(2);
  });

  it("900901:A:3 is not heard for another stage", () => {
    const made = nightmare({ stage: "02128", deck: ["02139"] });
    const state = settle(fireForced({ ...made.state, window: null }, { trigger: "stageRevealed", seat: null, subject: first(made.state, "02128") }, made.ctx, []), made.ctx, []);
    expect(zoneOf(state, "02139")).toBe("encounterDeck");
  });
});

describe("900902 Ambushing Orcs", () => {
  const fight = (enemy: string) => fightEnemy((layout: Layout) => table(layout), "02135", enemy, { threat: [28, 30] }, { undefended: true, lands: { [enemy]: GOLLUM } });

  it("900902:A:1 a shadow card it is dealt that targets the guard also targets each other player", () => {
    const state = fight("900902").run.state;
    expect(threat(state, 0)).toBe(32);
    expect(threat(state, 1)).toBe(34);
  });

  it("900902:A:1 another enemy's shadow card targets the guard alone", () => {
    const state = fight("f3").run.state;
    expect(threat(state, 0)).toBe(32);
    expect(threat(state, 1)).toBe(30);
  });
});

describe("900903 Pursuing Warg-rider", () => {
  it("900903:A:1 cannot be optionally engaged", () => {
    const made = table({ staging: ["900903"] });
    expect(flagged(made.state, first(made.state, "900903"), "cannotBeOptionallyEngaged")).toBe(true);
  });

  it("900903:A:2 after the guard changes it engages the guard, from the staging area or from another player, and makes an immediate attack against him", () => {
    const made = table({ staging: ["900903"], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), answer("change"), false);
    expect(guardianSeat(run.state)).toBe(1);
    const warg = run.state.cards[first(run.state, "900903")];
    expect(warg?.zone).toBe("engaged");
    expect(warg?.controller).toBe(1);
    expect(run.state.pendingAttack?.enemyId).toBe(warg?.id);
    expect(run.state.pendingAttack?.seat).toBe(1);
    const moved = table({ engaged: [{ code: "900903", seat: 0 }], phase: "Encounter" });
    const from = resolveRecords(moved.state, moved.ctx, GOLLUM, "forced", first(moved.state, GOLLUM), answer("change"), false);
    expect(from.state.cards[first(from.state, "900903")]?.controller).toBe(1);
  });

  it("900903:A:2 does nothing when the guard does not change", () => {
    const made = table({ staging: ["900903"], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, GOLLUM, "forced", first(made.state, GOLLUM), answer("keep"), false);
    expect(run.state.cards[first(run.state, "900903")]?.zone).toBe("staging");
    expect(run.state.pendingAttack).toBeFalsy();
  });
});

describe("900904 Web-spinner", () => {
  it("900904:A:1 the guard exhausts a hero or Web-spinner gains surge, as he chooses", () => {
    const made = table({ play: [{ code: GOLLUM, seat: 1 }], deck: ["f0", "f0", "f0"] });
    const asked: (readonly string[])[] = [];
    const exhausted = revealed(made, "900904", (state) => {
      asked.push(offered(state));
      return "exhaust";
    });
    expect(asked[0]).toEqual(["exhaust", "surge"]);
    expect(exhausted.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
    const surged = revealed(made, "900904", answer("surge"));
    expect(surged.cards[made.seat1Hero ?? ""]?.exhausted).toBeFalsy();
    // Surge reveals one more card.
    expect(surged.staging.length).toBe(exhausted.staging.length + 1);
  });

  it("900904:A:1 with no ready hero only surge can be resolved and the guard is not asked", () => {
    const made = table({ play: [{ code: GOLLUM, seat: 1 }], deck: ["f0", "f0", "f0"] });
    const tired = { ...made, state: exhaustAll(made.state, 1) };
    const state = revealed(tired, "900904", (window) => {
      throw new Error(`asked ${JSON.stringify(window.window)}`);
    });
    expect(state.staging.length).toBeGreaterThan(1);
  });

  it("900904:A:2 the shadow makes the guard exhaust a character he controls: a ready one, Gollum counting as one", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "900904", "f3", {}, { undefended: true, lands: { f3: GOLLUM } });
    const ids = [fight.made.hero, fight.made.hero2, first(fight.run.state, GOLLUM)];
    expect(ids.filter((id) => fight.run.state.cards[id]?.exhausted)).toHaveLength(1);
    expect(fight.run.state.cards[fight.made.seat1Hero ?? ""]?.exhausted).toBeFalsy();
  });
});

describe("900905 Deceptive Path", () => {
  it("900905:A:1 takes no progress while it is in the staging area", () => {
    const made = table({ staging: ["900905"] });
    expect(flagged(made.state, first(made.state, "900905"), "noProgressPlaced")).toBe(true);
    const active = table({ active: "900905" });
    expect(flagged(active.state, first(active.state, "900905"), "noProgressPlaced")).toBe(false);
  });

  const becameActive = (layout: Layout) => {
    const made = table(layout);
    const path = first(made.state, "900905");
    return { made, state: settle(fireForced({ ...made.state, window: null }, { trigger: "becameActive", seat: null, cardId: path }, made.ctx, []), made.ctx, []) };
  };

  it("900905:A:2 after it becomes the active location the discard pile is shuffled into the deck, cards are discarded until a location is, that location is revealed and made the active location, then Deceptive Path is discarded", () => {
    const { state } = becameActive({ active: "900905", deck: ["f0", "place"], discard: ["f3"] });
    expect(zoneOf(state, "place")).toBe("activeLocation");
    expect(zoneOf(state, "900905")).toBe("encounterDiscard");
    expect(state.activeLocation).toBe(first(state, "place"));
  });

  it("900905:A:2 with no location in the deck every card is discarded, nothing becomes active and Deceptive Path is still discarded", () => {
    const { state } = becameActive({ active: "900905", deck: ["f0", "f0"] });
    expect(state.activeLocation).toBeNull();
    expect(zoneOf(state, "900905")).toBe("encounterDiscard");
    expect(state.encounterDeck).toEqual([]);
  });
});

describe("900906 Web-wall", () => {
  it("900906:A:1 the topmost Spider enemy in the encounter discard pile is revealed and added to the staging area", () => {
    const made = table({ discard: ["02139", "f0"], deck: ["f0"] });
    const state = revealed(made, "900906");
    expect(zoneOf(state, "02139")).toBe("staging");
    // The card below it stays in the pile.
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toContain("f0");
  });

  it("900906:A:1 does nothing with no Spider in the discard pile", () => {
    const made = table({ discard: ["f0"], deck: ["f0"] });
    const state = revealed(made, "900906");
    // Web-wall is a location: it goes to the staging area and nothing else joins it.
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code)).toEqual(["f0"]);
    expect(state.staging.map((id) => state.cards[id]?.code)).toEqual(["900906"]);
  });

  it("900906:A:2 the shadow makes the guard discard every resource from each of his heroes' pools, and no one else's", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "900906", "f3", { heroResources: 3 }, { undefended: true, lands: { f3: GOLLUM } });
    expect(fight.run.state.cards[fight.made.hero]?.resources).toBe(0);
    expect(fight.run.state.cards[fight.made.hero2]?.resources).toBe(0);
    expect(fight.run.state.cards[fight.made.seat1Hero ?? ""]?.resources).toBe(3);
  });
});

describe("900907 Isolation", () => {
  it("900907:A:2 attaches to the current quest: characters lose ranged and sentinel and the guard cannot change", () => {
    const made = table({ deck: ["f0"] });
    expect(guardianCanChange(made.state)).toBe(true);
    const state = syncConstants(revealed(made, "900907"), made.ctx);
    const card = state.cards[first(state, "900907")];
    expect(card?.zone).toBe("attached");
    expect(card?.host).toBe(state.questStage);
    expect(guardianCanChange(state)).toBe(false);
    expect(hasKeyword(state, made.hero, "sentinel", made.ctx.cards)).toBe(false);
    expect(flagged(state, made.hero, "loseSentinel")).toBe(true);
    expect(flagged(state, made.hero, "loseRanged")).toBe(true);
  });

  it("900907:A:2 a Tantrum's choice of a new guard is blocked too: cannot is absolute", () => {
    const made = table({ deck: ["f0"] });
    const locked = syncConstants(revealed(made, "900907"), made.ctx);
    const after = revealed({ ...made, state: { ...locked, encounterDeck: [] } }, "02135");
    expect(guardianSeat(after)).toBe(0);
  });
});

describe("900908 Befouled Equipment", () => {
  const withDiscard = (made: ReturnType<typeof table>, seat: number, codes: readonly string[]) => codes.reduce((state, code) => spawn(state, code, { zone: "discard", seat }).state, made.state);

  it("900908:A:1 the guard discards every attachment he controls, then every card in his discard pile is removed from the game, the attachments just discarded included", () => {
    const made = table({ attached: [{ code: "attachment", to: "dh1" }], deck: ["f0", "f0"] });
    const prepared = { ...made, state: withDiscard(made, 0, ["filler", "filler"]) };
    const other = spawn(prepared.state, "filler", { zone: "discard", seat: 1 }).state;
    const state = revealed({ ...prepared, state: other }, "900908");
    expect(state.seats[0]?.discard).toEqual([]);
    expect(zoneOf(state, "attachment")).toBe("removed");
    expect(state.seats[0]?.discard).toHaveLength(0);
    expect(state.seats[1]?.discard).toHaveLength(1);
    expect(state.removed.length).toBe(3);
  });

  it("900908:A:1 with no attachment discarded it gains surge, but the discard pile is still removed", () => {
    const made = table({ deck: ["f0", "f0"] });
    const prepared = { ...made, state: withDiscard(made, 0, ["filler"]) };
    const state = revealed(prepared, "900908");
    expect(state.seats[0]?.discard).toEqual([]);
    expect(state.removed).toHaveLength(1);
    expect(state.staging.length).toBe(1);
  });

  it("900908:A:2 the shadow discards every attachment the guard controls", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "900908", "f3", { attached: [{ code: "attachment", to: "dh1" }] }, { undefended: true, lands: { f3: GOLLUM } });
    expect(zoneOf(fight.run.state, "attachment")).not.toBe("play");
    expect(fight.run.state.seats[0]?.discard.some((id) => fight.run.state.cards[id]?.code === "attachment")).toBe(true);
  });
});

describe("900909 Wickedness and Mischief", () => {
  it("900909:A:1 the guard reveals the topmost Tantrum in the encounter discard pile (it goes back to the pile) or 2 more encounter cards", () => {
    const made = table({ play: [{ code: GOLLUM, seat: 1 }], discard: ["02135"], deck: ["f0", "f0", "f0"], threat: [28, 30] });
    const asked: (readonly string[])[] = [];
    const tantrum = revealed(made, "900909", (state) => {
      asked.push(offered(state));
      return "tantrum";
    });
    expect(asked[0]).toEqual(["tantrum", "reveal"]);
    expect(threat(tantrum, 1)).toBe(38);
    expect(tantrum.encounterDiscard.map((id) => tantrum.cards[id]?.code)).toContain("02135");
    const more = revealed(made, "900909", answer("reveal"));
    expect(more.staging).toHaveLength(2);
  });

  it("900909:A:1 with no Tantrum in the discard pile only the two cards can be resolved", () => {
    const made = table({ deck: ["f0", "f0", "f0"] });
    const state = revealed(made, "900909", (window) => {
      throw new Error(`asked ${JSON.stringify(window.window)}`);
    });
    expect(state.staging).toHaveLength(2);
  });

  it("900909:A:2 the shadow deals the topmost Tantrum in the discard pile as a new shadow card for this attack, which is resolved: it is no longer in the pile", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "900909", "f3", { discard: ["02135"], threat: [28, 30] }, { undefended: true, lands: { f3: GOLLUM } });
    // Gollum's Anguish as a shadow: the guard raises his threat by 4.
    expect(threat(fight.run.state, 0)).toBe(32);
    expect(zoneOf(fight.run.state, "02135")).not.toBe("encounterDiscard");
  });
});
