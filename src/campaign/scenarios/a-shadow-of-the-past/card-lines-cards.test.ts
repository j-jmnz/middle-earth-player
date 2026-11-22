// Rules: rr.attachment-cards, rr.travel, rr.first-player, rr.forced, mec109.saga-staging-rules, mec109.hide-tests (data/rules/entries.json); ledger lines 141039:A:1, 906102:A:1, 906103:A:2, 141043:A:2, 141074:A:2,
// 141035:A:2, 141072:A:1, 141077:A:1, 141073:A:2.
// A Shadow of the Past's lines that need a player card, a choice with more than one candidate, or the second seat revealing: the Nazgûl's "Cannot have non-Morgul attachments" against a player's attachment, Have You
// Seen Baggins? as a Condition a player card can discard, its limit and its Forced, Black Steed's limit, Bucklebury Ferry's travel bar, and the first player of Gildor Inglorion and Piercing Cry.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, legalTargets, reduce } from "../../../rules/engine/reduce.ts";
import { startReveal } from "../../../rules/windows/frames.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { endPhase } from "../../../../test/harness/card-spec.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { hosts, playerTable, type PlayerBase } from "../../../../test/harness/player-table.ts";
import { begin, idsOf, send as sendScene } from "../../../../test/harness/scene.ts";
import { finish, idOf, idsOf as idsIn, revealFromTop, send, start, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { starterBase } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";

const SCENARIO = "a-shadow-of-the-past";
const DENETHOR = "01010";
const SNARE = "01069";
const ARAGORN = "01001";
const BULWARK = "17137";
const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, layout);
const zoneOf = (state: ScenarioState, code: string) => state.cards[idOf(state, code)]?.zone;

// The card is put on top of the encounter deck and revealed by `seat` (saga staging, mec109.saga-staging-rules: each player reveals in turn). A choice it opens is left open.
function revealBy(made: LayoutTable, code: string, seat: number): Run {
  const spawned = spawn({ ...made.state, window: null, mode: "stopped" }, code, { zone: "encounterDeck" }, "down");
  const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
  const steps: EngineStep[] = [];
  return { state: settle(startReveal(top, seat, made.ctx, steps), made.ctx, steps), steps };
}

let base: PlayerBase;

beforeAll(async () => {
  const starter = await starterBase();
  base = { ...starter, cards: new Map([...starter.cards, ...(await loadPrinted([DENETHOR, SNARE, ARAGORN, BULWARK, "906102", "906103"]))]) };
}, 60_000);

describe("Cannot have non-Morgul attachments", () => {
  // 141039 Black Rider ("Hide 2. Cannot have non-Morgul attachments."), 906102 Khamûl the Easterling and 906103 Dark Horseman ("Cannot have non-Morgul attachments."). Forest Snare is an Item and Trap attachment
  // that a lore player attaches "to an enemy engaged with a player"; the stand-in enemy f3 takes it.
  it.each([
    ["141039:A:1", "141039"],
    ["906102:A:1", "906102"],
    ["906103:A:2", "906103"],
  ])("%s Forest Snare cannot be attached to the Nazgûl, and can be to another engaged enemy", (_line, code) => {
    const tab = playerTable(base, EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }], hand: [{ code: SNARE, seat: 0 }], engaged: [{ code, seat: 0 }, { code: "f3", seat: 0 }] });
    expect(hosts(tab, idsOf(tab, SNARE))).toEqual([idsOf(tab, "f3")]);
  });

  // Black Steed is a Morgul treachery: "When Revealed: Attach to a Nazgûl enemy in play, if able."
  it("141039:A:1 Black Steed, a Morgul card, still attaches to the Black Rider", () => {
    const steps: EngineStep[] = [];
    const made = table({ engaged: ["141039"], deck: ["f0", "f0"] });
    const revealed = revealFromTop(start(made.state).state, made.ctx, "141074", steps);
    expect(revealed.state.cards[idOf(revealed.state, "141074")]?.host).toBe(idOf(made.state, "141039"));
  });
});

describe("141043 Have You Seen Baggins?", () => {
  // "(Counts as a Condition attachment ...)": Bulwark of the West reads "Action: Discard an ally you control to choose and discard a Condition attachment."
  // The treachery lies attached to Aragorn as its When Revealed leaves it (an encounter attachment, zone `attached`).
  function withBaggins(effects: typeof EFFECTS) {
    const tab = playerTable(base, effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: "ally", seat: 0 }], hand: [{ code: BULWARK, seat: 0 }] });
    const spawned = spawn(tab.state, "141043", { zone: "staging" });
    const state = syncConstants(attachTo(moveCard(spawned.state, spawned.id, { zone: "attached" }), spawned.id, idsOf(tab, ARAGORN)), tab.ctx);
    const bulwark = idsOf(tab, BULWARK);
    return { tab, state, baggins: spawned.id, bulwark, offered: legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === bulwark) };
  }

  it("141043:A:2 counts as a Condition attachment that Bulwark of the West can discard", () => {
    const made = withBaggins(EFFECTS);
    expect(made.offered).toBe(true);
    const played = finish(sendScene(begin(made.state), { type: "PlayCard", cardId: made.bulwark, payments: [] }, made.tab.ctx), made.tab.ctx);
    expect(played.state.cards[made.baggins]?.zone).toBe("encounterDiscard");
    // Without its Condition record nothing is a Condition attachment, and the event is not offered (rr.triggered-ability).
    expect(withBaggins(EFFECTS.filter((effect) => effect.id !== "141043:constant:1")).offered).toBe(false);
  });

  // "Limit 1 per hero.": a hero that carries one is not a candidate, so the other hero takes it without a choice.
  it("141043:A:2 a hero that already carries a copy is not offered, so the other hero takes it", () => {
    const made = table({ attached: [{ code: "141043", to: "dh1" }], deck: ["f0", "f0"] });
    const steps: EngineStep[] = [];
    const revealed = finish({ state: revealFromTop(start(made.state).state, made.ctx, "141043", steps).state, steps }, made.ctx);
    const copies = idsIn(revealed.state, "141043").map((id) => revealed.state.cards[revealed.state.cards[id]?.host ?? ""]?.code);
    expect(copies.sort()).toEqual(["dh1", "dh2"]);
  });

  // "Forced: After a player fails a Hide test, discard attached hero." Any player's failure: the second seat's hero carries it and the first seat fails.
  it("141043:A:2 the attached hero is discarded when a player fails a Hide test, the one who failed or another", () => {
    const made = table({ seats: 2, attached: [{ code: "141043", to: "dh3" }], deck: ["f3", "f3", "f0"] });
    let run = { state: revealFromTop(start(made.state).state, made.ctx, "141041", []).state, steps: [] as EngineStep[] };
    run = send(run, { type: "CommitHide", cardIds: [] }, made.ctx);
    run = finish(send(run, { type: "Pass" }, made.ctx), made.ctx);
    expect(run.state.hideFailures).toHaveLength(1);
    expect(zoneOf(run.state, "dh3")).toBe("discard");
    expect(zoneOf(run.state, "dh1")).toBe("heroes");
  });
});

describe("141074 Black Steed", () => {
  // "Attach to a Nazgûl enemy in play, if able. (... Limit 1 per enemy. ...)"
  it("141074:A:2 a Black Rider that has a Black Steed is passed by, and the second Black Rider takes the new one", () => {
    const made = table({ engaged: ["141039", "141039"], attached: [{ code: "141074", to: "141039" }], deck: ["f0", "f0"] });
    const [first, second] = idsIn(made.state, "141039");
    const steps: EngineStep[] = [];
    const revealed = finish({ state: revealFromTop(start(made.state).state, made.ctx, "141074", steps).state, steps }, made.ctx);
    expect(idsIn(revealed.state, "141074").map((id) => revealed.state.cards[id]?.host).sort()).toEqual([first, second].sort());
  });

  it("141074:A:2 with no Nazgûl enemy in play it is discarded and the engaged enemy that is not a Nazgûl takes nothing", () => {
    const made = table({ engaged: ["f3"], deck: ["f0", "f0"] });
    const steps: EngineStep[] = [];
    const revealed = finish({ state: revealFromTop(start(made.state).state, made.ctx, "141074", steps).state, steps }, made.ctx);
    expect(zoneOf(revealed.state, "141074")).toBe("encounterDiscard");
    expect(revealed.state.cards[idOf(revealed.state, "f3")]?.attachments).toEqual([]);
  });
});

describe("141074 Black Steed's Forced", () => {
  // "Forced: At the end of the refresh phase, return attached enemy to the staging area." The end of the quest phase is not that moment.
  it("141074:A:2 the attached enemy stays engaged when the quest phase ends", () => {
    const done = play(SCENARIO, { line: "", layout: { engaged: ["141039"], attached: [{ code: "141074", to: "141039" }], deck: ["f0", "f0"] }, act: endPhase, expect: [] }, EFFECTS, false);
    expect(done.run.state.phase).toBe("Travel");
    expect(zoneOf(done.run.state, "141039")).toBe("engaged");
  });
});

describe("141035 Bucklebury Ferry", () => {
  // "While there is at least 1 other location in play, the players cannot travel here."
  const travelTo = (layout: Layout) => {
    const made = table({ phase: "Travel", ...layout });
    return { made, targets: legalTargets(made.state, { type: "Travel" }, made.ctx), ferry: idOf(made.state, "141035") };
  };

  it("141035:A:2 the players cannot travel to it while another location is in the staging area or active, and can when it is the only one", () => {
    const staged = travelTo({ staging: ["141035", "place"] });
    expect(staged.targets).toEqual([idOf(staged.made.state, "place")]);
    const refused = reduce(staged.made.state, { type: "Travel", locationId: staged.ferry }, staged.made.ctx);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.reason).not.toBe("");
    expect(travelTo({ staging: ["141035"], active: "place" }).targets).toEqual([]);
    const alone = travelTo({ staging: ["141035"] });
    expect(alone.targets).toEqual([alone.ferry]);
  });
});

describe("141072 Pathless Country", () => {
  // "Pathless Country gets +4 quest points while in the staging area." As the active location it has its printed 3.
  it("141072:A:1 as the active location it has its printed 3 quest points", () => {
    const made = table({ active: "141072" });
    expect(modifiedStat(made.state, made.state.cards[idOf(made.state, "141072")]!, "questPoints", made.ctx.cards)).toBe(3);
  });
});

describe("cards revealed by the second player", () => {
  // 141077 Gildor Inglorion: "The first player gains control of Gildor Inglorion."
  it("141077:A:1 the first player gains control of it when the second player reveals it", () => {
    const made = table({ seats: 2, deck: ["f0"] });
    const run = revealBy(made, "141077", 1);
    const gildor = run.state.cards[idOf(run.state, "141077")];
    expect(gildor).toMatchObject({ zone: "play", controller: 0 });
    expect(run.state.seats[0]?.play).toContain(gildor?.id);
  });

  // 141073 Piercing Cry: "Either add it to the staging area or put it into play engaged with the first player."
  it("141073:A:2 the Black Rider is put into play engaged with the first player when the second player reveals it", () => {
    const made = table({ seats: 2, discard: ["141039"], deck: ["f0"] });
    let run = revealBy(made, "141073", 1);
    expect(run.state.window?.kind).toBe("choose");
    run = finish(send(run, { type: "Choose", optionId: "engage" }, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, "141039")]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("141073:A:2 with no Nazgûl in the encounter deck or discard pile neither option is offered", () => {
    const made = table({ engaged: ["141039"], deck: ["f0"] });
    const run = finish({ state: revealFromTop(start(made.state).state, made.ctx, "141073", []).state, steps: [] }, made.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(zoneOf(run.state, "141039")).toBe("engaged");
  });
});
