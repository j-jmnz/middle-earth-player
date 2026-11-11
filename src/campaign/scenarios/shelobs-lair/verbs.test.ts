// Rules: mec112.setup-shelobs-lair, mec112.gollum-smeagol, rr.play-and-put-into-play, rr.damage, rr.cancel, rr.travel, rr.effects, rr.forced, rr.explored (data/rules/entries.json); ledger lines 144040:A:3, 144044:A:2, 144045:A:3,
// 144048:A:1, 144049:A:1, 144055:A:2, 144071:A:1, 144071:B:2, 144072:B:1, 144072:B:2, 144070:B:2. The vocabulary Shelob's Lair adds: the Great Spider set as a pile beside the encounter deck, the per-player limit on allies entering play, the
// damage canceled for a resource, the Travel costs the players may not be able to pay, a progress reduction on each placement, a When Revealed effect that cancels itself and the stage that keeps a defeated Gollum. Each test title starts with
// the line id it covers (scripts/checks/spec-coverage.test.ts).
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { restricted, travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { questRoom } from "../../../rules/families/caves/progress.ts";
import { putOnStage } from "../../../rules/quest/quest.ts";
import { pileOf } from "../../../rules/core/piles.ts";
import { flagged, updateCard, withMode, withSeat, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { entriesBarred, noteEntries } from "../../../rules/families/sea/entries.ts";
import { fightEnemy, finish, idOf, legalIntents, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SHELOB = "144040";
const SMEAGOL = "144076";
const GOLLUM = "144075";
const ID = "shelobs-lair";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const hit = (made: ReturnType<typeof table>, state: ScenarioState, id: string, amount: number): ScenarioState => placeDamage(state, id, amount, made.ctx.cards, [], "combat", ruleCause("rr.step-6-8-3"));

describe("the Great Spider set as a pile", () => {
  it("144071:A:1 shuffles the pile and the encounter discard pile into the encounter deck and adds Shelob, leaving the pile empty", () => {
    const made = table({ ...{ stage: "144071" }, setAside: [SHELOB], discard: ["144041"], piles: { greatSpiderDeck: ["144059", "144060", "144061", "144062"] } });
    const pile = pileOf(made.state, "greatSpiderDeck");
    expect(pile).toHaveLength(4);
    expect(made.state.encounterDeck.some((id) => pile.includes(id))).toBe(false);
    const run = resolveRecords(made.state, made.ctx, "144071", "whenRevealed", idOf(made.state, "144071"));
    expect(pileOf(run.state, "greatSpiderDeck")).toEqual([]);
    for (const id of pile) expect(run.state.encounterDeck).toContain(id);
    expect(run.state.encounterDiscard).toEqual([]);
    expect(run.state.cards[idOf(run.state, SHELOB)]?.zone).toBe("staging");
  });
});

describe("a limit on the allies each player brings into play", () => {
  // Two seats, the Pass stage (the limit's source) current and an ally in each hand (the first seat holds two).
  const limited = () => {
    const made = table({ seats: 2, stage: "144071", hand: ["ally", { code: "ally", seat: 0 }] });
    const ids = Object.keys(made.state.cards).filter((id) => made.state.cards[id]?.code === "ally");
    const mine = ids.filter((id) => made.state.cards[id]?.controller === 0 || made.state.cards[id]?.owner === 0);
    return { made, state: noteEntries(syncConstants(made.state, made.ctx), made.ctx), first: mine[0] ?? "", second: mine[1] ?? "", other: ids.find((id) => !mine.includes(id)) ?? "" };
  };

  it("144071:B:2 bars a player's second ally in a round, played or put into play, while another player may still bring one in", () => {
    const { made, state, first, second, other } = limited();
    expect(entriesBarred(state, second, made.ctx, 0)).toBe(false);
    const entered = noteEntries(moveCard(state, first, { zone: "play", seat: 0 }), made.ctx);
    expect(entriesBarred(entered, second, made.ctx, 0)).toBe(true);
    expect(entriesBarred(entered, other, made.ctx, 1)).toBe(false);
    const both = noteEntries(moveCard(entered, other, { zone: "play", seat: 1 }), made.ctx);
    expect(both.entries?.bySeat).toEqual([1, 1]);
  });

  it("144071:B:2 counts an ally that left play again, and counts again in the next round", () => {
    const { made, state, first, second } = limited();
    const entered = noteEntries(moveCard(state, first, { zone: "play", seat: 0 }), made.ctx);
    const gone = noteEntries(moveCard(entered, first, { zone: "discard", seat: 0 }), made.ctx);
    expect(entriesBarred(gone, second, made.ctx, 0)).toBe(true);
    const later = noteEntries({ ...gone, round: gone.round + 1 }, made.ctx);
    expect(entriesBarred(later, second, made.ctx, 0)).toBe(false);
  });
});

describe("damage canceled for a resource", () => {
  const shelob = (resources: number) => {
    const made = table({ stage: "144072", staging: [{ code: SHELOB, resources }] });
    return { made, id: idOf(made.state, SHELOB) };
  };

  it("144072:B:2 cancels all the damage of one instance and discards 1 resource, however much damage it was", () => {
    const { made, id } = shelob(3);
    const struck = hit(made, made.state, id, 7);
    expect(struck.cards[id]?.damage).toBe(0);
    expect(struck.cards[id]?.resources).toBe(2);
  });

  it("144072:B:2 takes the damage in full once the resources are gone", () => {
    const { made, id } = shelob(1);
    const first = hit(made, made.state, id, 2);
    expect(first.cards[id]?.damage).toBe(0);
    expect(first.cards[id]?.resources).toBe(0);
    expect(hit(made, first, id, 2).cards[id]?.damage).toBe(2);
  });
});

describe("Travel costs that may not be payable", () => {
  it("144045:A:3 cannot be paid while Shelob is out of play, and can once she is in play, in the staging area or engaged", () => {
    const out = table({ staging: ["144045"] });
    expect(travelCostUnpayable(out.state, out.ctx, idOf(out.state, "144045"))).toBe(true);
    const staged = table({ staging: ["144045", SHELOB] });
    expect(travelCostUnpayable(staged.state, staged.ctx, idOf(staged.state, "144045"))).toBe(false);
    const engaged = table({ staging: ["144045"], engaged: [SHELOB] });
    expect(travelCostUnpayable(engaged.state, engaged.ctx, idOf(engaged.state, "144045"))).toBe(false);
  });

  it("144045:A:3 places 1 resource on Shelob when the players travel", () => {
    const made = table({ staging: ["144045", SHELOB] });
    const run = resolveRecords(made.state, made.ctx, "144045", "travel", idOf(made.state, "144045"));
    expect(run.state.cards[idOf(run.state, SHELOB)]?.resources).toBe(1);
  });

  it("144049:A:2 (Den of Night, the same cost as Cleft) cannot be paid while Shelob is out of play, and can once she is in the staging area", () => {
    const out = table({ staging: ["144049"] });
    expect(travelCostUnpayable(out.state, out.ctx, idOf(out.state, "144049"))).toBe(true);
    const staged = table({ staging: ["144049", SHELOB] });
    expect(travelCostUnpayable(staged.state, staged.ctx, idOf(staged.state, "144049"))).toBe(false);
  });

  it("144048:A:2 (Deep Dark Passage) cannot be paid without a ready Sméagol in play, and can with one", () => {
    const absent = table({ staging: ["144048"] });
    expect(travelCostUnpayable(absent.state, absent.ctx, idOf(absent.state, "144048"))).toBe(true);
    const ready = table({ staging: ["144048"], play: [SMEAGOL] });
    const way = idOf(ready.state, "144048");
    expect(travelCostUnpayable(ready.state, ready.ctx, way)).toBe(false);
    const tired = updateCard(ready.state, idOf(ready.state, SMEAGOL), { exhausted: true });
    expect(travelCostUnpayable(tired, ready.ctx, way)).toBe(true);
  });

  it("144044:A:2 can be paid by exhausting a ready Sméagol, or by every hand holding a card, and by neither when he is exhausted and a hand is empty", () => {
    const made = table({ staging: ["144044"], play: [SMEAGOL] });
    const way = idOf(made.state, "144044");
    const smeagol = idOf(made.state, SMEAGOL);
    expect(travelCostUnpayable(made.state, made.ctx, way)).toBe(false);
    const tired = updateCard(made.state, smeagol, { exhausted: true });
    const empty = withSeat(tired, 0, { ...tired.seats[0]!, hand: [] });
    expect(travelCostUnpayable(empty, made.ctx, way)).toBe(true);
    expect(travelCostUnpayable(updateCard(empty, smeagol, { exhausted: false }), made.ctx, way)).toBe(false);
    const handed = table({ staging: ["144044"], play: [SMEAGOL], hand: ["filler"] });
    const worn = updateCard(handed.state, idOf(handed.state, SMEAGOL), { exhausted: true });
    expect(travelCostUnpayable(worn, handed.ctx, idOf(handed.state, "144044"))).toBe(false);
  });
});

describe("a progress reduction on each placement", () => {
  const passage = (copies: number) => {
    const made = table({ stage: "144072", staging: ["144046", ...Array.from({ length: copies }, () => "144048")] });
    return { made, target: idOf(made.state, "144046") };
  };
  const placeOn = (made: ReturnType<typeof table>, id: string, amount: number): ScenarioState => placeProgress(made.state, id, amount, made.ctx, []);

  it("144048:A:1 reduces each placement of progress on a location in the staging area by 1, a placement of 1 becoming 0", () => {
    const { made, target } = passage(1);
    expect(placeOn(made, target, 1).cards[target]?.progress).toBe(0);
    expect(placeOn(made, target, 3).cards[target]?.progress).toBe(2);
  });

  it("144048:A:1 adds up for each copy in the staging area, and holds only while it is in the staging area", () => {
    const { made, target } = passage(2);
    expect(placeOn(made, target, 3).cards[target]?.progress).toBe(1);
    const none = passage(0);
    expect(placeOn(none.made, none.target, 3).cards[none.target]?.progress).toBe(3);
  });
});

describe("a When Revealed effect that cancels itself", () => {
  it("144055:A:2 is heard by Den of Night as a canceled effect and places 1 resource on Shelob", () => {
    const made = table({ stage: "144070", staging: ["144049", SHELOB], play: ["144063"], heroResources: 1, engaged: [GOLLUM] });
    // The first hero stand-in is a Fellowship hero, as the saga's Frodo is, so its resource pays the cancel.
    made.cards.set("dh1", { ...made.cards.get("dh1")!, sphere: "fellowship" });
    const answer = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options.includes("cancel") ? "cancel" : "") : "");
    const run = resolveRecords(made.state, made.ctx, "144055", "whenRevealed", undefined, answer, false);
    expect(run.state.cards[idOf(run.state, SHELOB)]?.resources).toBe(1);
  });
});

describe("a stage that keeps a defeated Gollum", () => {
  const defeat = (stage: string) => {
    const made = table({ stage, engaged: [GOLLUM] });
    const id = idOf(made.state, GOLLUM);
    return { made, id, state: settle({ ...hit(made, made.state, id, 99), window: null, mode: "stopped" }, made.ctx, []) };
  };

  it("144072:B:1 adds him to the victory display as Gollum, not flipped, instead of flipping him to Sméagol", () => {
    const { id, state } = defeat("144072");
    expect(state.victory).toContain(id);
    expect(state.cards[id]?.code).toBe(GOLLUM);
  });

  it("144072:B:1 leaves the flip to Sméagol of 144075:A:3 on every other stage", () => {
    const { id, state } = defeat("144071");
    expect(state.victory).not.toContain(id);
    expect(state.cards[id]?.code).toBe(SMEAGOL);
  });
});

describe("a Condition attachment from the encounter deck that stays on a hero", () => {
  const attachedTo = (state: ScenarioState, code: string): string | undefined => {
    const poison = state.cards[idOf(state, code)];
    return poison?.zone === "attached" ? state.cards[poison.host ?? ""]?.code : undefined;
  };

  it("144060:A:1 attaches to a hero its player controls, exhausts it, blanks its text box and keeps it from readying", () => {
    const made = table({ stage: "144072" });
    const run = resolveRecords(made.state, made.ctx, "144060", "whenRevealed");
    const host = attachedTo(run.state, "144060");
    expect(host === "dh1" || host === "dh2").toBe(true);
    const hero = run.state.cards[run.state.cards[idOf(run.state, "144060")]?.host ?? ""];
    expect(hero?.exhausted).toBe(true);
    expect(flagged(run.state, hero?.id ?? "", "blankText")).toBe(true);
    expect(flagged(run.state, hero?.id ?? "", "cannotReady")).toBe(true);
  });

  it("144060:A:1 is not attached to a hero that carries one already, and is discarded with no hero left", () => {
    const made = table({ stage: "144072", attached: [{ code: "144060", to: "dh1" }, { code: "144060", to: "dh2" }] });
    const run = resolveRecords(made.state, made.ctx, "144060", "whenRevealed");
    expect(run.state.cards[run.id]?.zone).not.toBe("attached");
    for (const hero of [idOf(made.state, "dh1"), idOf(made.state, "dh2")]) expect(run.state.cards[hero]?.attachments.length).toBe(1);
  });

  it("144060:A:2 resolves its When Revealed effect for the defending player when Shelob attacks, and stays attached after the attack", () => {
    const fight = fightEnemy((layout: Layout) => table({ stage: "144072", ...layout }), "144060", SHELOB, {}, { undefended: true });
    const poison = fight.run.state.cards[idOf(fight.run.state, "144060")];
    expect(poison?.zone).toBe("attached");
    expect(fight.run.state.cards[poison?.host ?? ""]?.code).toMatch(/^dh[12]$/);
    expect(fight.run.state.cards[poison?.host ?? ""]?.exhausted).toBe(true);
  });

  it("144060:A:2 does nothing when the attacker is not Shelob", () => {
    const fight = fightEnemy((layout: Layout) => table({ stage: "144072", ...layout }), "144060", "f0", {}, { undefended: true });
    expect(fight.run.state.cards[idOf(fight.run.state, "144060")]?.zone).not.toBe("attached");
  });
});

describe("a Response to the exploring of a location that every hand pays for", () => {
  // The Secret Way is explored by progress; the stage's Response is then offered to any player.
  const explored = (hand: number) => {
    const made = table({ seats: 2, staging: ["144044", "144053"], hand: Array.from({ length: hand }, () => "filler") });
    const placed = placeProgress(made.state, idOf(made.state, "144044"), 99, made.ctx, []);
    const state = settle({ ...placed, window: null, mode: "stopped" }, made.ctx, []);
    const stage = idOf(made.state, "144070");
    return { made, state, intent: legalIntents(state, made.ctx).find((offered) => offered.type === "Trigger" && offered.cardId === stage) };
  };

  it("144070:B:2 is offered once every hand holds 3 cards, and every player discards 3 random cards to discard the Nazgûl enemies in the staging area", () => {
    const { made, state, intent } = explored(3);
    expect(intent).toBeDefined();
    const run = finish(send({ state, steps: [] }, intent as PlayerIntent, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, "144053")]?.zone).toBe("encounterDiscard");
    expect(run.state.seats.map((seat) => seat.hand.length)).toEqual([0, 0]);
  });

  it("144070:B:2 is not offered while some hand holds fewer than 3 cards", () => {
    expect(explored(2).intent).toBeUndefined();
  });
});

describe("an Action that needs a Weapon, a cap on the quest's progress and a stage that cannot be defeated", () => {
  // The attachment stand-in is a Weapon here (the scenario deals none); it lies on the first hero.
  const armed = (weapon: boolean) => {
    const made = table({ stage: "144072", staging: ["144059"], attached: [{ code: "attachment", to: "dh1" }] });
    if (weapon) made.cards.set("attachment", definePrinted({ code: "attachment", name: "attachment", type: "attachment", sphere: "neutral", cost: 0, traits: ["Weapon"] }));
    return made;
  };
  const offered = (made: ReturnType<typeof table>): boolean => legalIntents(made.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(made.state, "144059"));

  it("144059:A:2 is offered while a ready character the player controls carries a Weapon, and places 3 progress on Blocked Tunnel for exhausting it", () => {
    const made = armed(true);
    expect(offered(made)).toBe(true);
    const run = finish(send({ state: made.state, steps: [] }, legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(made.state, "144059")) as PlayerIntent, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, "144059")]?.progress).toBe(3);
    expect(run.state.cards[idOf(run.state, "dh1")]?.exhausted).toBe(true);
  });

  it("144059:A:2 is not offered when no character carries a Weapon, or the one that does is exhausted", () => {
    expect(offered(armed(false))).toBe(false);
    const made = armed(true);
    const tired = updateCard(made.state, idOf(made.state, "dh1"), { exhausted: true });
    expect(offered({ ...made, state: tired })).toBe(false);
  });

  it("144071:B:3 holds the quest card to 4 progress for the round, however the progress comes, and the count starts again the next round", () => {
    const made = table({ stage: "144071" });
    const stage = idOf(made.state, "144071");
    expect(questRoom(made.state)).toBe(4);
    const placed = putOnStage(made.state, stage, 3, 16, made.ctx.cards, [], () => true, ruleCause("rr.step-3-4"), true);
    expect(placed.cards[stage]?.progress).toBe(3);
    expect(questRoom(placed)).toBe(1);
    expect(placed.modifiers.find((modifier) => modifier.stat === "questProgressPlaced")?.until).toBe("endOfRound");
    const next = withMode({ ...placed, mode: "refresh", phase: "Refresh" }, "beginRound");
    expect(questRoom(next)).toBe(4);
  });

  it("144072:B:3 bars defeating the stage until both Shelob and Gollum are in the victory display", () => {
    const rule = (layout: Layout) => {
      const made = table({ stage: "144072", ...layout });
      return restricted(made.state, made.ctx, "advance").length;
    };
    expect(rule({})).toBe(1);
    expect(rule({ victory: [SHELOB] })).toBe(1);
    expect(rule({ victory: [GOLLUM] })).toBe(1);
    expect(rule({ victory: [SHELOB, GOLLUM] })).toBe(0);
  });
});
