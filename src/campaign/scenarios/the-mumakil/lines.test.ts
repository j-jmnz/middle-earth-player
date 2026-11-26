// Rules: rr.response, rr.victory, rr.engaged, rr.staging, rr.attachment-cards, rr.shadow-effects, rr.explored, rr.cannot (data/rules/entries.json); ledger lines of The Mûmakil (data/printed/haradrim.json).
// The cases a spec row cannot hold (spec.test.ts): a row passes the same without the records, or needs an event no row action makes (damage dealt to an enemy by an effect). Each test is titled with its line id.
import { describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/damage.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { attack, defend, endRound, quest, respond, reveal, travel } from "../../../../test/harness/card-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { fightEnemy, idOf, opened, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { MUMAK, captures } from "../../../../test/scenarios/the-mumakil/kit.ts";

const TRAIL = "17020";
const table = (layout: Layout) => tableFromLayout("the-mumakil", { stage: "17027", side: "B", ...layout });
const zoneOf = (state: ScenarioState, code: string): string | undefined => Object.values(state.cards).find((card) => card.code === code)?.zone;
const offered = (state: ScenarioState, made: ReturnType<typeof table>, code: string) => legalIntents(state, made.ctx).filter((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code));

// Damage dealt to the Mûmak the way an effect deals it, the events settled: the Responses are offered at once.
function hit(layout: Layout, amount: number, round = 0) {
  const made = table(layout);
  const steps: EngineStep[] = [];
  const start = opened(made).state;
  const placed = placeDamage({ ...start, roundDamage: round > 0 ? { [idOf(start, MUMAK)]: round } : start.roundDamage }, idOf(start, MUMAK), amount, made.ctx.cards, steps, "framework", UNATTRIBUTED);
  return { made, state: settle({ ...placed, window: null, mode: "stopped" }, made.ctx, steps) };
}
const use = (made: ReturnType<typeof table>, state: ScenarioState, code: string): ScenarioState => {
  const intent = offered(state, made, code)[0];
  if (!intent) throw new Error(`no Response of ${code}`);
  const sent = send({ state, steps: [] }, intent as PlayerIntent, made.ctx);
  return settle({ ...sent.state, mode: "stopped" }, made.ctx, []);
};

describe("17011:A:1 Horse-hair Lasso: the Lasso and the Mûmak go to the victory display together", () => {
  const layout = { engaged: [{ code: MUMAK, seat: 0, damage: 5 }], attached: captures("17011", "17013"), deckOf: ["c3"] } as const;

  it("17011:A:1 a discarded card that costs the remaining hit points sends the Lasso and the Mûmak to the victory display; the other Capture on the Mûmak goes to the encounter discard pile", () => {
    const { made, state } = hit(layout, 1);
    const done = use(made, state, "17011");
    expect(zoneOf(done, "17011")).toBe("victory");
    expect(zoneOf(done, MUMAK)).toBe("victory");
    expect(zoneOf(done, "17013")).toBe("encounterDiscard");
    expect(zoneOf(done, "c3")).toBe("discard");
  });

  it("17011:A:1 a card that costs less than the remaining hit points captures nothing, and an empty deck discards nothing", () => {
    const cheap = hit({ ...layout, deckOf: ["c2"] }, 1);
    const cheapDone = use(cheap.made, cheap.state, "17011");
    expect([zoneOf(cheapDone, "17011"), zoneOf(cheapDone, MUMAK), zoneOf(cheapDone, "c2")]).toEqual(["attached", "engaged", "discard"]);
    const empty = hit({ ...layout, deckOf: [] }, 1);
    const emptyDone = use(empty.made, empty.state, "17011");
    expect([zoneOf(emptyDone, "17011"), zoneOf(emptyDone, MUMAK)]).toEqual(["attached", "engaged"]);
  });

  it("17011:A:1 damage the cap takes away is no damage dealt: the Response is not offered", () => {
    const capped = hit(layout, 1, 3);
    expect(offered(capped.state, capped.made, "17011")).toEqual([]);
    expect(offered(hit(layout, 1).state, hit(layout, 1).made, "17011")).toHaveLength(1);
  });

  it("17011:A:1 a Mûmak in the staging area is no one's: no player is offered the Response", () => {
    const { made, state } = hit({ ...layout, engaged: [], staging: [{ code: MUMAK, damage: 5 }] }, 1);
    expect(offered(state, made, "17011")).toEqual([]);
  });
});

// The seat whose window is open: the player the Response is offered to.
const windowSeat = (state: ScenarioState): number | null => (state.window?.kind === "response" ? state.window.seat : null);

describe("17011:A:1, 17013:A:1 Capture Responses: offered to the player the Mûmak is engaged with, whoever is the first player", () => {
  it("17011:A:1 a Mûmak engaged with the second player offers the Lasso to him alone, and the first player's deck is not touched", () => {
    const { made, state } = hit({ seats: 2, engaged: [{ code: MUMAK, seat: 1, damage: 5 }], attached: captures("17011"), deckOf: ["c3"], deck: [] }, 1);
    expect(windowSeat(state)).toBe(1);
    expect(offered(state, made, "17011")).toHaveLength(1);
    const done = use(made, state, "17011");
    expect([zoneOf(done, "17011"), zoneOf(done, MUMAK)]).toEqual(["victory", "victory"]);
  });

  it("17013:A:1 a Mûmak engaged with the second player offers the Pit Trap to him", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", seats: 2, phase: "Travel", staging: [TRAIL], engaged: [{ code: MUMAK, seat: 1, damage: 7 }], attached: captures("17013") }, [travel(TRAIL)]);
    expect(windowSeat(done.run.state)).toBe(1);
  });
});

describe("17012:A:1 Poisoned Spear: the engaged player answers, whichever seat it is", () => {
  const layout = { seats: 2, engaged: [{ code: MUMAK, seat: 1, damage: 6 }], attached: captures("17012"), deck: ["f0", "f0", "f3", "f0"] } as const;

  it("17012:A:1 the Spear and the Mûmak go to the victory display when the discarded Threat reaches the remaining hit points; a lower Threat captures nothing", () => {
    const won = playedLayout("the-mumakil", { stage: "17027", side: "B", ...layout }, [quest("success"), respond("17012")]);
    expect([zoneOf(won.run.state, "17012"), zoneOf(won.run.state, MUMAK), zoneOf(won.run.state, "f3")]).toEqual(["victory", "victory", "encounterDiscard"]);
    const first = playedLayout("the-mumakil", { stage: "17027", side: "B", ...layout, engaged: [{ code: MUMAK, seat: 0, damage: 6 }] }, [quest("success"), respond("17012")]);
    expect([zoneOf(first.run.state, "17012"), zoneOf(first.run.state, MUMAK)]).toEqual(["victory", "victory"]);
    const missed = playedLayout("the-mumakil", { stage: "17027", side: "B", ...layout, engaged: [{ code: MUMAK, seat: 1, damage: 2 }] }, [quest("success"), respond("17012")]);
    expect([zoneOf(missed.run.state, "17012"), zoneOf(missed.run.state, MUMAK)]).toEqual(["attached", "engaged"]);
  });

  it("17012:A:1 an empty encounter deck is refilled from the discard pile before the top card goes", () => {
    const refilled = playedLayout("the-mumakil", { stage: "17027", side: "B", ...layout, deck: ["f0", "f0"], discard: ["f3"] }, [quest("success"), respond("17012")]);
    expect([zoneOf(refilled.run.state, "17012"), zoneOf(refilled.run.state, MUMAK)]).toEqual(["victory", "victory"]);
  });
});

describe("17013:A:1 Pit Trap: the engaged player answers; a Mûmak in the staging area does nothing", () => {
  it("17013:A:1 a Mûmak in the staging area is not offered the Response, and a location with less Threat than its remaining hit points captures nothing", () => {
    const staged = playedLayout("the-mumakil", { stage: "17027", side: "B", phase: "Travel", staging: [TRAIL, { code: MUMAK, damage: 7 }], attached: captures("17013") }, [travel(TRAIL), respond("17013")], EFFECTS, true);
    expect([zoneOf(staged.run.state, "17013"), zoneOf(staged.run.state, MUMAK)]).toEqual(["attached", "staging"]);
    const strong = playedLayout("the-mumakil", { stage: "17027", side: "B", phase: "Travel", staging: [TRAIL], engaged: [{ code: MUMAK, seat: 0, damage: 0 }], attached: captures("17013") }, [travel(TRAIL), respond("17013")]);
    expect([zoneOf(strong.run.state, "17013"), zoneOf(strong.run.state, MUMAK)]).toEqual(["attached", "engaged"]);
  });

  it("17013:A:1 the Pit Trap and the Mûmak go to the victory display together, the other Capture on the Mûmak to the encounter discard pile", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", phase: "Travel", staging: [TRAIL], engaged: [{ code: MUMAK, seat: 0, damage: 7 }], attached: captures("17013", "17011") }, [travel(TRAIL), respond("17013")]);
    expect([zoneOf(done.run.state, "17013"), zoneOf(done.run.state, MUMAK), zoneOf(done.run.state, "17011")]).toEqual(["victory", "victory", "encounterDiscard"]);
  });
});

describe("17014:A:1 Noose of Vines: a defender the attack destroys does not qualify", () => {
  it("17014:A:1 the Noose and the Mûmak go to the victory display when the surviving defender has more remaining hit points", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", engaged: [{ code: MUMAK, seat: 0, damage: 8 }], attached: captures("17014", "17012"), deck: ["f0", "f0"] }, [attack(MUMAK), respond("17014")]);
    expect([zoneOf(done.run.state, "17014"), zoneOf(done.run.state, MUMAK), zoneOf(done.run.state, "17012")]).toEqual(["victory", "victory", "encounterDiscard"]);
  });

  it("17014:A:1 a defender the attack destroys reads as no defender: nothing is captured", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", play: ["ally"], engaged: [{ code: MUMAK, seat: 0, damage: 8 }], attached: captures("17014"), deck: ["f0", "f0"] }, [attack(MUMAK), defend("ally"), respond("17014")], EFFECTS, true);
    expect([zoneOf(done.run.state, "ally"), zoneOf(done.run.state, "17014"), zoneOf(done.run.state, MUMAK)]).toEqual(["discard", "attached", "engaged"]);
  });
});

describe("17014:A:1 Noose of Vines: offered to the defender's controller, after an attack that had a defender", () => {
  it("17014:A:1 a Mûmak attacking from the staging area, with a defender, offers the Noose to the defender's controller", () => {
    const opening = playedLayout("the-mumakil", { stage: "17027", side: "B", seats: 2, staging: [{ code: MUMAK, damage: 8 }], attached: captures("17014"), deck: ["f0", "f0"] }, reveal("17021"));
    expect(opening.run.state.window?.kind).toBe("defense");
    const sent = send(opening.run, { type: "DeclareDefender", defenderId: opening.table.hero }, opening.table.ctx);
    const state = settle({ ...sent.state, mode: "stopped" }, opening.table.ctx, []);
    expect(windowSeat(state)).toBe(0);
    const done = use(opening.table, state, "17014");
    expect([zoneOf(done, "17014"), zoneOf(done, MUMAK)]).toEqual(["victory", "victory"]);
  });

  it("17014:A:1 a Mûmak engaged with the second player, defended by his hero, offers the Noose to him and not to the first player", () => {
    const layout = { seats: 2, engaged: [{ code: MUMAK, seat: 1, damage: 8 }], attached: captures("17014"), deck: ["f0", "f0", "f0"] } as const;
    const fought = fightEnemy(table, "f0", MUMAK, layout, { defender: (made) => made.state.seats[1]?.heroes[0] ?? "" });
    expect(windowSeat(fought.run.state)).toBe(1);
    expect(offered(fought.run.state, fought.made, "17014")).toHaveLength(1);
  });

  it("17014:A:1 an undefended attack has no defender: the Noose is offered to nobody, the first player included", () => {
    const hero = playedLayout("the-mumakil", { stage: "17027", side: "B", seats: 2, engaged: [{ code: MUMAK, seat: 0, damage: 8 }], attached: captures("17014"), deck: ["f0", "f0"] }, [attack(MUMAK, { undefended: true })]);
    expect(offered(hero.run.state, hero.table, "17014")).toEqual([]);
    expect([zoneOf(hero.run.state, "17014"), zoneOf(hero.run.state, MUMAK)]).toEqual(["attached", "engaged"]);
  });
});

describe("17015:A:2 Wild Mûmak: the damage cap", () => {
  it("17015:A:2 5 damage in one round leaves 3, and no more is dealt that round", () => {
    const made = table({ engaged: [MUMAK] });
    const steps: EngineStep[] = [];
    const start = opened(made).state;
    const first = placeDamage(start, idOf(start, MUMAK), 5, made.ctx.cards, steps, "framework", UNATTRIBUTED);
    const second = placeDamage(first, idOf(first, MUMAK), 2, made.ctx.cards, steps, "framework", UNATTRIBUTED);
    expect(second.cards[idOf(second, MUMAK)]?.damage).toBe(3);
  });
});

describe("17017:A:2 Territorial Ape: the shadow gives +2 Attack once a location was explored this round", () => {
  it("17017:A:2 an enemy that attacks with the Ape's shadow deals 1 more damage when the table notes an explored location", () => {
    const fight = (noted: boolean) =>
      fightEnemy((layout: Layout) => table(layout), "17017", "f0", {}, { undefended: true, tweak: (state) => (noted ? { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "x", stat: "exploredThisRound", amount: 1, until: "endOfRound" }] } : state) });
    const damage = (noted: boolean) => {
      const run = fight(noted).run.state;
      return run.cards[run.seats[0]?.heroes[0] ?? ""]?.damage;
    };
    expect([damage(false), damage(true)]).toEqual([2, 3]);
  });
});

describe("17018:A:2 Strangling Python: a character the damage destroys cannot take it", () => {
  it("17018:A:2 the Python stays an enemy engaged with the player when the ally it damaged is destroyed", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", play: ["ally"], deck: ["f0"] }, [attack("17018"), defend("ally")]);
    expect([zoneOf(done.run.state, "ally"), zoneOf(done.run.state, "17018")]).toEqual(["discard", "engaged"]);
  });
});

describe("17019:A:1, 17019:A:2, 17023:A:2 until the end of the round: the effect ends when the round does", () => {
  const rows = [
    { line: "17019:A:1", stat: "blankText", act: (): Parameters<typeof playedLayout>[2] => attack("17019", { undefended: true }), layout: { stage: "17027", side: "B", deck: ["f0"] } },
    { line: "17019:A:2", stat: "blankText", act: (): Parameters<typeof playedLayout>[2] => attack("f0", { shadow: "17019" }), layout: { deck: ["f0"] } },
    { line: "17023:A:2", stat: "cannotReady", act: (): Parameters<typeof playedLayout>[2] => attack("f0", { shadow: "17023" }), layout: { deck: ["f0"] } },
  ] as const;
  for (const row of rows) {
    it(`${row.line} the effect holds through the round and is gone at the end of the round`, () => {
      const during = playedLayout("the-mumakil", { ...row.layout }, row.act());
      expect(flagged(during.run.state, idOf(during.run.state, "dh1"), row.stat), "during the round").toBe(true);
      const ended = playedLayout("the-mumakil", { ...row.layout }, [row.act(), endRound].flat());
      expect(flagged(ended.run.state, idOf(ended.run.state, "dh1"), row.stat), "after the end of the round").toBe(false);
    });
  }
});

describe("17022:A:1 The Savage South: a hero shares a title with a discarded card", () => {
  it("17022:A:1 a hero the player controls whose title is one of the 5 discarded cards is discarded", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", deckOf: ["dh1", "filler", "filler", "filler", "filler", "filler"] }, reveal("17022"));
    expect(zoneOf(done.run.state, "dh1")).not.toBe("heroes");
  });
});

describe("17023:A:1 Terrible Fever: no hero is committed", () => {
  it("17023:A:1 with no committed hero the Fever attaches to nothing and is discarded", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", phase: "Quest", deck: ["f0"] }, reveal("17023"));
    expect(zoneOf(done.run.state, "17023")).toBe("encounterDiscard");
  });
});

describe("17024:A:1 Biting Insects: a player with an empty hand", () => {
  it("17024:A:1 the second player has no card to discard and takes no damage; the first player's damage still lands", () => {
    const done = playedLayout("the-mumakil", { stage: "17027", side: "B", seats: 2, hand: [{ code: "c2", seat: 0 }] }, reveal("17024"));
    expect(done.run.state.cards[done.table.hero]?.damage).toBe(2);
    expect(done.run.state.cards[done.table.seat1Hero ?? ""]?.damage).toBe(0);
  });
});
