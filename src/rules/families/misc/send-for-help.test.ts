// Rules: rr.search, rr.unique-cards, rr.play-and-put-into-play, rr.framework-steps, rr.delayed-effects (data/rules/entries.json); ledger lines 11212:A:2, 11213:A:2, 11214:A:2.
// The three Send for Help events that take a card from the collection or add a phase, run through their real records on the table of A Storm on Cobas Haven (test/scenarios/a-storm-on-cobas-haven/scene.ts).
// The Upgraded clauses ("If Send for Help (...) is upgraded") are in none of the records: no source prints an Upgraded side (the header of src/effects/authored/pool/DCCEHaven.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { addStandIns } from "../../../../test/harness/scene-kit.ts";
import { finish, havenTable, idOf, idsOf, legalIntents, loadHavenWorld, resolveRecords, send, type HavenLayout, type HavenWorld, type Run } from "../../../../test/scenarios/a-storm-on-cobas-haven/scene.ts";
import { destroyCard } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { moveCard } from "../../core/zones.ts";
import { syncConstants } from "../../interpret/constants.ts";

// Aragorn (01001) and Théodred (01002) are in the collection; Gandalf is 01073.
const ARAGORN = "01001";
const THEODRED = "01002";
const GANDALF = "01073";

let world: HavenWorld;
beforeAll(async () => {
  world = await loadHavenWorld();
  for (const [code, card] of await loadPrinted([ARAGORN, THEODRED, GANDALF])) world.cards.set(code, card);
  addStandIns(world.cards, ["mild"]);
});
const make = (layout: HavenLayout = {}) => havenTable(world, layout);
const settled = (state: ScenarioState, ctx: ReturnType<typeof make>["ctx"]) => syncConstants(settle({ ...state, window: state.window }, ctx, []), ctx);
// Each question is answered by the first of `answers` among its options, else its first option.
const answers = (list: readonly string[]) => (current: ScenarioState): string => {
  const options = current.window?.kind === "choose" ? current.window.options : [];
  return list.find((answer) => options.includes(answer)) ?? options[0] ?? "";
};
// Gandalf's Response is offered as he enters play: it is used with the option given, or declined.
const respond = (run: ReturnType<typeof resolveRecords>, ctx: ReturnType<typeof make>["ctx"], option: string | null) => {
  let current: Run = run;
  if (current.state.window?.kind !== "response") return run;
  const use = legalIntents(current.state, ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "01073:response:1");
  current = option != null && use?.type === "Trigger" ? send(current, use, ctx) : send(current, { type: "Pass" }, ctx);
  return { ...finish(current, ctx, answers(option ? [option] : [])), id: run.id };
};
const cardsOf = (state: ScenarioState, code: string) => idsOf(state, code).map((id) => state.cards[id]).filter((card) => card != null);

describe("11212:A:2 Send for Help (Tactics): put a hero from the collection into play under any player's control", () => {
  it("offers the collection's heroes whose title is not in play, and puts the chosen one among the chosen player's heroes", () => {
    const made = make({ staging: ["11212"], seats: 2 });
    const id = idOf(made.state, "11212");
    // The first question is the hero: the candidates are cards made for it, set aside.
    let offered: (string | undefined)[] = [];
    resolveRecords(made.state, made.ctx, "11212", "whenRevealed", id, (current) => {
      const options = current.window?.kind === "choose" ? current.window.options : [];
      if (offered.length === 0 && options.length > 0) offered = options.map((option) => current.cards[option]?.code);
      return options[0] ?? "";
    });
    expect(offered).toContain(ARAGORN);
    expect(offered).toContain(THEODRED);
    // The stand-in heroes the seats already have are not offered a second time.
    expect(offered).not.toContain("dh1");
    const done = resolveRecords(made.state, made.ctx, "11212", "whenRevealed", id, (current) => {
      const choices = current.window?.kind === "choose" ? current.window.options : [];
      return choices.find((option) => option === "seat:1") ?? choices.find((option) => current.cards[option]?.code === ARAGORN) ?? choices[0] ?? "";
    });
    const aragorn = cardsOf(done.state, ARAGORN);
    expect(aragorn).toHaveLength(1);
    expect(aragorn[0]?.zone).toBe("heroes");
    expect(aragorn[0]?.controller).toBe(1);
    expect(done.state.seats[1]?.heroes).toContain(aragorn[0]?.id);
    expect(aragorn[0]?.temporary).toBe(true);
    // The other candidates never existed, and Send for Help leaves the game.
    expect(cardsOf(done.state, THEODRED)).toHaveLength(0);
    expect(done.state.cards[id]?.zone).toBe("removed");
  });

  it("takes the only player's control without asking whom", () => {
    const made = make({ staging: ["11212"] });
    const done = resolveRecords(made.state, made.ctx, "11212", "whenRevealed", idOf(made.state, "11212"), answers([]));
    const hero = cardsOf(done.state, ARAGORN)[0];
    expect(hero?.zone).toBe("heroes");
    expect(hero?.controller).toBe(0);
  });

  it("removes the hero from the game when it leaves play before the end of the round", () => {
    const made = make({ staging: ["11212"] });
    const done = resolveRecords(made.state, made.ctx, "11212", "whenRevealed", idOf(made.state, "11212"), answers([]));
    const hero = cardsOf(done.state, ARAGORN)[0];
    if (!hero) throw new Error("no hero");
    const gone = settled(destroyCard(done.state, hero.id, made.ctx.cards, []), made.ctx);
    expect(gone.cards[hero.id]?.zone).toBe("removed");
  });

  it("removes the hero from the game when it leaves play by any route: to a hand, to a deck, to the discard pile", () => {
    const made = make({ staging: ["11212"] });
    const done = resolveRecords(made.state, made.ctx, "11212", "whenRevealed", idOf(made.state, "11212"), answers([]));
    const hero = cardsOf(done.state, ARAGORN)[0];
    if (!hero) throw new Error("no hero");
    for (const destination of [{ zone: "hand", seat: 0 }, { zone: "deck", seat: 0 }, { zone: "discard", seat: 0 }] as const) {
      expect(moveCard(done.state, hero.id, destination).cards[hero.id]?.zone, destination.zone).toBe("removed");
    }
  });

  it("removes the hero from the game at the end of the round", () => {
    const made = make({ staging: ["11212"], phase: "Refresh" });
    const done = resolveRecords(made.state, made.ctx, "11212", "whenRevealed", idOf(made.state, "11212"), answers([]), false);
    // The round went on to the next one: the hero is out of the game with the end of the round.
    const hero = cardsOf(done.state, ARAGORN)[0];
    expect(done.state.round).toBe(made.state.round + 1);
    expect(hero?.zone).toBe("removed");
  });

  it("11212:A:3 Shadow: resolves its when revealed effect", () => {
    const made = make({ staging: ["11212"] });
    const record = made.ctx.effects.find((effect) => effect.cardCode === "11212" && effect.timing === "shadow");
    expect(record?.instructions).toEqual([{ verb: "ResolveWhenRevealed", card: "self" }]);
    const done = resolveRecords(made.state, made.ctx, "11212", "shadow", idOf(made.state, "11212"), answers([]));
    expect(cardsOf(done.state, ARAGORN)[0]?.zone).toBe("heroes");
    expect(done.state.cards[done.id]?.zone).toBe("removed");
  });
});

describe("11213:A:2 Send for Help (Spirit): choose resource, planning, combat or refresh; after the current phase there is an additional instance of it", () => {
  it("offers the four phases, and the chosen one is owed after the current phase; Send for Help leaves the game", () => {
    const made = make({ staging: ["11213"] });
    const id = idOf(made.state, "11213");
    let offered: string[] = [];
    const done = resolveRecords(made.state, made.ctx, "11213", "whenRevealed", id, (current) => {
      const options = current.window?.kind === "choose" ? current.window.options : [];
      if (offered.length === 0) offered = [...options];
      return options.includes("combat") ? "combat" : (options[0] ?? "");
    });
    expect(offered).toEqual(["resource", "planning", "combat", "refresh"]);
    expect(done.state.extraPhases).toEqual(["Combat"]);
    expect(done.state.cards[id]?.zone).toBe("removed");
    // The phase in progress goes on: nothing about the round moved yet.
    expect(done.state.extraResume).toBeUndefined();
  });

  it.each([["resource", "Resource"], ["planning", "Planning"], ["refresh", "Refresh"]])("choosing %s owes the %s phase", (option, phase) => {
    const made = make({ staging: ["11213"] });
    const done = resolveRecords(made.state, made.ctx, "11213", "whenRevealed", idOf(made.state, "11213"), answers([option]));
    expect(done.state.extraPhases).toEqual([phase]);
  });

  it("11213:A:3 Shadow: resolves its when revealed effect, so the phase is owed after the combat phase", () => {
    const made = make({ staging: ["11213"], phase: "Combat" });
    const record = made.ctx.effects.find((effect) => effect.cardCode === "11213" && effect.timing === "shadow");
    expect(record?.instructions).toEqual([{ verb: "ResolveWhenRevealed", card: "self" }]);
    const done = resolveRecords(made.state, made.ctx, "11213", "shadow", idOf(made.state, "11213"), answers(["refresh"]));
    expect(done.state.extraPhases).toEqual(["Refresh"]);
    expect(done.state.phase).toBe("Combat");
  });
});

describe("11214:A:2 Send for Help (Lore): put Gandalf from the collection into play, ignoring uniqueness", () => {
  it("puts Gandalf into play and answers his Response as he enters; Send for Help leaves the game", () => {
    const made = make({ staging: ["11214"], deckOf: ["filler", "filler", "filler", "filler"] });
    const id = idOf(made.state, "11214");
    const done = respond(resolveRecords(made.state, made.ctx, "11214", "whenRevealed", id, answers(["draw"])), made.ctx, "draw");
    const gandalf = cardsOf(done.state, GANDALF);
    expect(gandalf).toHaveLength(1);
    expect(gandalf[0]?.zone).toBe("play");
    expect(gandalf[0]?.controller).toBe(0);
    expect(done.state.cards[id]?.zone).toBe("removed");
    expect(done.state.seats[0]?.hand.length).toBe((made.state.seats[0]?.hand.length ?? 0) + 3);
  });

  it("enters play although a Gandalf is in play already", () => {
    const made = make({ staging: ["11214"], play: [GANDALF] });
    const first = idOf(made.state, GANDALF);
    const done = respond(resolveRecords(made.state, made.ctx, "11214", "whenRevealed", idOf(made.state, "11214"), answers(["threat"])), made.ctx, null);
    const inPlay = cardsOf(done.state, GANDALF).filter((card) => card.zone === "play");
    expect(inPlay).toHaveLength(2);
    expect(inPlay.map((card) => card.id)).toContain(first);
  });

  it("11214:A:3 Shadow: resolves its when revealed effect", () => {
    const made = make({ staging: ["11214"] });
    const record = made.ctx.effects.find((effect) => effect.cardCode === "11214" && effect.timing === "shadow");
    expect(record?.instructions).toEqual([{ verb: "ResolveWhenRevealed", card: "self" }]);
  });

  it("does nothing when the game does not know the card", () => {
    const made = make({ staging: ["11214"] });
    const cards = new Map(made.ctx.cards);
    cards.delete(GANDALF);
    const done = resolveRecords(made.state, { ...made.ctx, cards }, "11214", "whenRevealed", idOf(made.state, "11214"), answers([]));
    expect(cardsOf(done.state, GANDALF)).toHaveLength(0);
    expect(done.state.cards[idOf(made.state, "11214")]?.zone).toBe("removed");
  });
});
