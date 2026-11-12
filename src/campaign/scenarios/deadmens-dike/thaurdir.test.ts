// Rules: rr.player-elimination, rr.constant-ability, rr.triggered-ability, rr.travel, rr.blank, rr.first-player, rr.effects, rr.modifiers, rr.surge, rr.then, rr.destroy, rr.campaign-pool, rr.ownership-and-control, faq.first-player-elimination, mec108.indestructible, mec108.side-quests, mec108.time-x (data/rules/entries.json); ledger lines 09074:A:1, 09074:B:1.
// Deadmen's Dike, part 3: stage 2A's "then" (the reveals only when Thaurdir was added) and stage 2B's Forced effect (the characters Thaurdir's attack destroyed, their controller's choice). Each test starts its title with the line it covers.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, idOf, idsOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "deadmens-dike";
const THAURDIR = "09033";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "09073", phase: "Refresh", ...layout });
// A card of the seat's discard pile.
const discarded = (state: ScenarioState, code: string, seat = 0): ScenarioState => spawn(state, code, { zone: "discard", seat }).state;

describe("09074:A:1 reveals the encounter cards only when Thaurdir was added to the staging area", () => {
  it("09074:A:1 adds Thaurdir to the staging area and then reveals 1 card for each player", () => {
    const t = at({ stage: "09074", phase: "Quest", seats: 2, setAside: [THAURDIR], deck: ["f0", "f0", "f0"], deckOf: ["filler"] });
    const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
    expect(run.state.cards[idOf(run.state, THAURDIR)]?.zone).toBe("staging");
    expect(run.state.encounterDeck).toHaveLength(1);
  });

  it("09074:A:1 reveals nothing with no Thaurdir to add (rr.then: the second part resolves only when the first did)", () => {
    const t = at({ stage: "09074", phase: "Quest", seats: 2, deck: ["f0", "f0", "f0"], deckOf: ["filler"] });
    const run = resolveRecords(t.state, t.ctx, "09074", "whenRevealed");
    expect(run.state.encounterDeck).toHaveLength(3);
  });
});

describe("09074:B:1 hears a character that Thaurdir's attack destroyed, and only that", () => {
  const stage = (layout: Layout = {}) => ({ stage: "09074", deckOf: ["filler", "filler", "filler", "filler", "filler"], ...layout });

  it("09074:B:1 asks the controller of a hero an undefended attack of Thaurdir destroyed, and the discard takes 3 cards from his deck only", () => {
    const asked: { seat: number; options: string[] }[] = [];
    const run = fightEnemy((made: Layout) => at(made), "f0", THAURDIR, stage({ seats: 2 }), {
      undefended: true,
      pick: (state) => {
        if (state.window?.kind === "choose") asked.push({ seat: state.activeSeat, options: [...state.window.options] });
        return "discard";
      },
    });
    expect(run.run.state.cards[run.made.hero]?.zone).toBe("discard");
    expect(asked).toEqual([{ seat: 0, options: ["discard", "return"] }]);
    expect(run.run.state.seats[0]?.deck).toHaveLength(2);
    expect(run.run.state.seats[1]?.deck).toHaveLength(5);
  });

  it("09074:B:1 puts the choice to the destroyed character's controller: the event seat is his, not the first player's", () => {
    const t = at(stage({ seats: 2, phase: "Combat", engaged: [{ code: THAURDIR, seat: 1 }], firstPlayer: 0 }));
    const steps: never[] = [];
    const base = { ...t.state, window: null, mode: "stopped" as const };
    const heard = settle(fireForced(base, { trigger: "characterDestroyedByAttack", seat: 1, subject: t.seat1Hero ?? "", other: idOf(base, THAURDIR) }, t.ctx, steps), t.ctx, steps);
    expect(heard.window?.kind).toBe("choose");
    expect(heard.activeSeat).toBe(1);
  });

  it("09074:B:1 does not offer the 3-card discard with an empty deck (Reading 23): the controller's only option is to return Thaurdir", () => {
    const t = at(stage({ seats: 2, phase: "Combat", engaged: [{ code: THAURDIR, seat: 1 }], firstPlayer: 0 }));
    const steps: never[] = [];
    const base = { ...t.state, window: null, mode: "stopped" as const, seats: t.state.seats.map((seat, index) => (index === 1 ? { ...seat, deck: [] } : seat)) as unknown as ScenarioState["seats"] };
    const heard = settle(fireForced(base, { trigger: "characterDestroyedByAttack", seat: 1, subject: t.seat1Hero ?? "", other: idOf(base, THAURDIR) }, t.ctx, steps), t.ctx, steps);
    const options = heard.window?.kind === "choose" ? heard.window.options : [];
    expect(options).not.toContain("discard");
    expect(heard.cards[idOf(heard, THAURDIR)]?.zone === "staging" || options.includes("return")).toBe(true);
  });

  it("09074:B:1 returns Thaurdir to the staging area when the controller chooses that, and offers nothing to return when he is staged", () => {
    const run = fightEnemy((made: Layout) => at(made), "f0", THAURDIR, stage(), { undefended: true, pick: () => "return" });
    expect(run.run.state.cards[idOf(run.run.state, THAURDIR)]?.zone).toBe("staging");
  });

  it("09074:B:1 does not hear a character that was discarded and not destroyed: Dark Sorcery's shadow discards the defender and the attack goes on", () => {
    const asked: string[][] = [];
    const run = fightEnemy((made: Layout) => at(made), "09065", THAURDIR, stage({ play: ["ally"] }), {
      defender: (made) => idOf(made.state, "ally"),
      // A copy of the ally lies in its owner's discard pile, and Thaurdir's Attack is taken to 0 so that nothing is destroyed when the attack goes on without its defender.
      tweak: (state) => ({ ...discarded(state, "ally", 0), modifiers: [...state.modifiers, { instanceId: idOf(state, THAURDIR), sourceId: "t", stat: "attack" as const, amount: -6, until: "endOfRound" as const }] }),
      pick: (state) => {
        if (state.window?.kind === "choose") asked.push([...state.window.options]);
        return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
      },
    });
    expect(run.run.state.cards[idsOf(run.run.state, "ally")[0] ?? ""]?.zone).not.toBe("play");
    expect(asked.filter((options) => options.includes("return"))).toEqual([]);
  });

  it("09074:B:1 does not hear another enemy's attack that destroys a character", () => {
    const run = fightEnemy((made: Layout) => at(made), "f0", "f3", stage({ staging: [THAURDIR] }), {
      undefended: true,
      tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }),
      pick: () => "discard",
    });
    expect(run.run.state.seats[0]?.deck).toHaveLength(5);
  });
});
