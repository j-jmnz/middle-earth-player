// Rules: rr.cancel, rr.damage, rr.first-player, rr.search, rr.engagement-check, rr.optional-engagement, rr.attachment-cards, dwd.cave-torch-the-long-dark, dwd.immune-to-card-effects (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { reduce } from "../../../rules/engine/reduce.ts";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { fightEnemy, finish, idOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

// What a card-spec row cannot express in Into the Pit (spec.test.ts holds the rows): the host of an attachment, a window's options, the state in the middle of an attack, a card made exhausted before the effect.
// Each test's title starts with the line it covers.
const table = (layout: Layout): LayoutTable => tableFromLayout("into-the-pit", layout);
const codeOf = (state: ScenarioState, id: string | undefined): string | undefined => (id ? state.cards[id]?.code : undefined);
const hostOf = (state: ScenarioState, code: string): string | undefined => codeOf(state, state.cards[idOf(state, code)]?.host ?? undefined);

// The card is revealed from the top of the encounter deck and the choices it opens take `pick`'s answer.
function revealed(made: LayoutTable, code: string, pick?: (state: ScenarioState) => string): ScenarioState {
  return finish({ state: revealFromTop(made.state, made.ctx, code, []).state, steps: [] }, made.ctx, pick).state;
}

describe("03014 Patrol Leader", () => {
  // The damage is offered to its own Forced before it lands: it is placed with holdLethal as an attack's damage is, then the pass settles the window.
  const hit = (deck: readonly string[], amount: number): { before: ScenarioState; after: ScenarioState; id: string } => {
    const made = table({ phase: "Combat", engaged: ["03014"], deck });
    const id = idOf(made.state, "03014");
    const damaged = placeDamage({ ...made.state, holdLethal: true }, id, amount, made.cards, [], "framework", ruleCause("rr.damage"));
    return { before: made.state, after: expectOk(reduce(damaged, { type: "Pass" }, made.ctx)).state, id };
  };

  it("03014:A:1 an enemy on top of the encounter deck is discarded and the damage is stopped before it lands", () => {
    const { after, id } = hit(["f3", "treachery"], 3);
    expect(after.cards[id]?.damage).toBe(0);
    expect(after.encounterDiscard.map((card) => after.cards[card]?.code)).toEqual(["f3"]);
  });

  it("03014:A:1 another card on top is discarded and the damage lands", () => {
    const { after, id } = hit(["treachery", "f3"], 3);
    expect(after.cards[id]?.damage).toBe(3);
    expect(after.encounterDiscard.map((card) => after.cards[card]?.code)).toEqual(["treachery"]);
  });

  it("03014:A:1 lethal damage is stopped too when the discarded card is an enemy", () => {
    const { after, id } = hit(["f3"], 4);
    expect(after.cards[id]?.zone).toBe("engaged");
    expect(after.cards[id]?.damage).toBe(0);
  });

  it("03014:A:2 the Shadow cancels the damage dealt to the attacking enemy for the whole attack", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "03014", "f3", {});
    expect(flagged(fight.during, idOf(fight.during, "f3"), "cannotTakeDamage")).toBe(true);
    expect(flagged(fight.run.state, idOf(fight.run.state, "f3"), "cannotTakeDamage")).toBe(false);
  });
});

describe("03037 Lightless Passage", () => {
  it("03037:A:2 the Shadow cancels all combat damage dealt to the attacking enemy during the attack", () => {
    const fight = fightEnemy((layout: Layout) => table(layout), "03037", "f3", {});
    expect(flagged(fight.during, idOf(fight.during, "f3"), "combatDamageCanceled")).toBe(true);
  });
});

describe("03050 Dark and Dreadful", () => {
  // Both heroes exhausted, so the effect has something to hit.
  const exhaustedTable = (layout: Layout): LayoutTable => {
    const made = table(layout);
    return { ...made, state: [made.hero, made.hero2].reduce((state, id) => updateCard(state, id, { exhausted: true }), made.state) };
  };

  it("03050:A:1 deals 1 damage to each exhausted character", () => {
    const made = exhaustedTable({ deck: ["f0"] });
    const state = revealed(made, "03050");
    expect(state.cards[made.hero]?.damage).toBe(1);
    expect(state.cards[made.hero2]?.damage).toBe(1);
  });

  it("03050:A:1 deals 2 damage when the active location is a Dark location", () => {
    const made = exhaustedTable({ deck: ["f0"], active: "03036" });
    const state = revealed(made, "03050");
    expect(state.cards[made.hero]?.damage).toBe(2);
  });

  it("03050:A:1 deals no damage to a ready character", () => {
    const made = table({ deck: ["f0"] });
    expect(revealed(made, "03050").cards[made.hero]?.damage).toBe(0);
  });
});

describe("03052 Dreadful Gap", () => {
  it("03052:A:1 with East-gate active the travel cannot happen: no failure, East-gate stays active and the Gap stays in the staging area", () => {
    const made = table({ active: "03016", deck: ["f0"] });
    const state = revealed(made, "03052");
    expect(state.failure).toBeFalsy();
    expect(state.cards[idOf(state, "03016")]?.zone).toBe("activeLocation");
    expect(state.cards[idOf(state, "03052")]?.zone).toBe("staging");
  });

  it("03052:A:1 with another location active that one goes back to the staging area and the Gap is traveled to", () => {
    const made = table({ active: "03038", deck: ["f0"] });
    const state = revealed(made, "03052");
    expect(state.cards[idOf(state, "03052")]?.zone).toBe("activeLocation");
    expect(state.cards[idOf(state, "03038")]?.zone).toBe("staging");
  });
});

describe("03060 Goblin Scout", () => {
  it("03060:A:1 an engagement check at its engagement cost engages a player at 25 threat or more", () => {
    const made = table({ phase: "Encounter", staging: ["03060"], threat: [40, 28] });
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Engage")).toBe(false);
    const run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    expect(run.state.cards[idOf(run.state, "03060")]?.zone).toBe("engaged");
  });
});

describe("03062 Watchful Eyes", () => {
  it("03062:A:1 the first player attaches it to one of his own heroes, whoever he is", () => {
    const made = table({ seats: 2, firstPlayer: 1, deck: ["f0"] });
    expect(hostOf(revealed(made, "03062"), "03062")).toBe("dh3");
  });

  it("03062:A:1 the first player chooses the host among his heroes when the second seat reveals it", () => {
    const made = table({ seats: 2, firstPlayer: 0, deck: ["f0"] });
    const asked: number[] = [];
    const state = finish({ state: revealFromTop(made.state, made.ctx, "03062", [], 1).state, steps: [] }, made.ctx, (now) => {
      if (now.window?.kind !== "choose") return "";
      asked.push(now.window.seat);
      return now.window.options[0] ?? "";
    }).state;
    expect(asked).toEqual([0]);
    expect(["dh1", "dh2"]).toContain(hostOf(state, "03062"));
  });

  it("03062:A:1 a hero that already carries a copy is not offered: the next hero takes it", () => {
    const made = table({ attached: [{ code: "03062", to: "dh1" }], deck: ["f0"] });
    const state = revealed(made, "03062");
    const hosts = Object.values(state.cards).filter((card) => card.code === "03062").map((card) => codeOf(state, card.host ?? undefined));
    expect(hosts.sort()).toEqual(["dh1", "dh2"]);
  });
});

describe("901002 Goblin Ambush", () => {
  it("901002:A:1 the first player chooses the free Orc enemy when the second seat reveals the stage", () => {
    const made = table({ seats: 2, firstPlayer: 0, stage: "901002", deck: ["03060", "03014", "901003", "901004", "901005"] });
    const asked: number[] = [];
    const run = resolveRecords(made.state, made.ctx, "901002", "whenRevealed", undefined, (now) => {
      if (now.window?.kind !== "choose") return "";
      asked.push(now.window.seat);
      return now.window.options[0] ?? "";
    }, true, 1);
    expect(asked).toEqual([0]);
    expect(Object.values(run.state.cards).filter((card) => card.zone === "staging" && ["03060", "03014", "901003", "901004", "901005"].includes(card.code))).toHaveLength(3);
  });
});

describe("03064 Entering the Mines", () => {
  const setup = (layout: Layout, seen: string[][], choose: string): ScenarioState => {
    const made = table(layout);
    return resolveRecords(made.state, made.ctx, "03064", "setup", undefined, (state) => {
      const window = state.window;
      if (window?.kind !== "choose") return "";
      seen.push(window.options.map((option) => codeOf(state, option) ?? option));
      return window.options.find((option) => state.cards[option]?.code === choose) ?? window.options[0] ?? "";
    }).state;
  };

  it("03064:A:1 the first player offers the heroes of every player and the Torch goes to the one he chooses", () => {
    const seen: string[][] = [];
    const state = setup({ seats: 2, deck: ["f0"] }, seen, "dh3");
    expect(seen[0]).toEqual(["dh1", "dh2", "dh3"]);
    expect(hostOf(state, "03041")).toBe("dh3");
  });

  it("03064:A:1 the Torch is removed from the game when it would leave play", () => {
    const state = setup({ deck: ["f0"] }, [], "dh1");
    expect(state.cards[idOf(state, "03041")]?.temporary).toBe(true);
  });
});

describe("03065 Goblin Patrol", () => {
  const search = (seat: "seat:0" | "seat:1"): { seen: string[][]; staged: string[] } => {
    const made = table({ seats: 2, stage: "03065", deck: ["03060", "03014", "f0"] });
    const seen: string[][] = [];
    const state = resolveRecords(made.state, made.ctx, "03065", "whenRevealed", undefined, (current) => {
      const window = current.window;
      if (window?.kind !== "choose") return "";
      seen.push(window.options.map((option) => codeOf(current, option) ?? option));
      return window.options.includes(seat) ? seat : (window.options[0] ?? "");
    }).state;
    return { seen, staged: Object.values(state.cards).filter((card) => card.zone === "staging").map((card) => card.code).sort() };
  };

  it("03065:B:1 the first player names the second player: his search must take Patrol Leader, the first player's is free", () => {
    const { seen, staged } = search("seat:1");
    expect(seen[0]).toEqual(["seat:0", "seat:1"]);
    expect(seen[1]).toEqual(["03060", "03014", "f0"]);
    expect(staged).toEqual(["03014", "03060", "03065"]);
  });

  it("03065:B:1 named himself, his own search must take Patrol Leader and the second player's is free", () => {
    const { seen } = search("seat:0");
    expect(seen[1]).toEqual(["03060", "f0"]);
  });
});

describe("03066 A Way Up", () => {
  it("03066:B:2 defeating the stage wins the game", () => {
    const made = table({ stage: "03066", progress: 11 });
    const run = send(start(made.state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    let current = run;
    for (let guard = 0; guard < 12 && !current.state.stageCleared && current.state.phase === "Quest"; guard += 1) current = send(current, { type: "Pass" }, made.ctx);
    expect(current.state.stageCleared).toBe(true);
    expect(current.state.lost).toBeFalsy();
  });
});

describe("901008 Shadow-fall", () => {
  it("901008:A:2 with no non-Dark location in play it attaches to nothing and is discarded", () => {
    const made = table({ staging: ["03038"], deck: ["f0", "f0", "f0"] });
    const state = revealed(made, "901008");
    expect(state.cards[idOf(state, "901008")]?.zone).toBe("encounterDiscard");
    expect(state.cards[idOf(state, "901008")]?.host).toBeFalsy();
  });
});
