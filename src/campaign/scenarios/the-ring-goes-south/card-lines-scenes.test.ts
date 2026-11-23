// Rules: rr.attachment-cards, rr.traits, rr.forced, rr.engaged, rr.explored, rr.active-location, rr.travel, rr.lasting-effects, rr.in-play-and-out-of-play, rr.then,
// rr.shadow-effects, rr.destroy (data/rules/entries.json).
// The Ring Goes South lines a single card-spec row cannot show: attachment targets, a false case (a row that would pass without its records), a duration and a second player.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/keywords.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { attack, defend, endPhase, endRound, quest, reveal, announce, type Act } from "../../../../test/harness/card-spec.ts";
import { finish, idOf, idsOf, type Layout, type LayoutTable, legalIntents, send, start, statOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-ring-goes-south";
const played = (layout: Layout, act: Act | readonly Act[]) => play(SCENARIO, { line: "", layout, act, expect: [] }, EFFECTS, false).run.state;
const zonesOf = (state: ScenarioState, code: string) => idsOf(state, code).map((id) => state.cards[id]?.zone);

// A table with these player cards among its cards, `heroes` among the first seat's heroes (after the stand-ins).
function withHeroes(layout: Layout, heroes: readonly string[], extra: readonly string[] = []): LayoutTable {
  const made = tableFromLayout(SCENARIO, layout, { extra: [...heroes, ...extra] });
  let state = made.state;
  for (const code of heroes) state = spawn(state, code, { zone: "heroes", seat: 0 }).state;
  return { ...made, state: syncConstants(state, made.ctx) };
}

// The codes of the cards the attachment in hand may be played on.
const targetCodes = (made: LayoutTable, attachment: string, state: ScenarioState = made.state) => attachmentTargets({ ...state, activeSeat: 0 }, idOf(state, attachment), made.ctx).map((id) => state.cards[id]?.code).sort();

describe("the boons' attachment restrictions", () => {
  // 142012 Mithril Shirt: "Attach to the Ring-bearer." Frodo Baggins (141001) has the Ring-bearer trait.
  it("142012:A:1 goes on the Ring-bearer and on no other hero", () => {
    const made = withHeroes({ hand: ["142012"] }, ["141001"], ["142012"]);
    expect(targetCodes(made, "142012")).toEqual(["141001"]);
  });

  // 142013 Glamdring: "Attach to a Warrior hero or Gandalf." Beregond (05001) is a Warrior hero, Gandalf a hero (142002) and an ally (01073); the Warrior ally Glorfindel (12006), the Noble hero Prince Imrahil (02050) and the stand-ins are neither.
  it("142013:A:1 goes on a Warrior hero or a Gandalf, hero or ally, and not on a Warrior ally or another hero", () => {
    const made = withHeroes({ hand: ["142013"], play: ["01073", "12006"] }, ["05001", "142002", "02050"], ["142013", "01073", "12006"]);
    expect(targetCodes(made, "142013")).toEqual(["01073", "05001", "142002"]);
  });

  // 142014 Andúril: "Attach to a Noble hero or Aragorn." Prince Imrahil (02050) is a Noble hero, Aragorn (04053) is not Noble; the Noble ally Faramir (01014) and the Warrior hero Beregond (05001) are neither.
  it("142014:A:1 goes on a Noble hero or Aragorn, and not on a Noble ally or another hero", () => {
    const made = withHeroes({ hand: ["142014"], play: ["01014"] }, ["02050", "04053", "05001"], ["142014", "01014"]);
    expect(targetCodes(made, "142014")).toEqual(["02050", "04053"]);
  });
});

describe("enemies that cannot have attachments", () => {
  // Forest Snare (01069): "Attach to an enemy engaged with a player."
  for (const [line, code] of [["142025:A:1", "142025"], ["906402:A:1", "906402"], ["906403:A:1", "906403"]] as const) {
    it(`${line} is no target for an attachment that goes on an engaged enemy, and another engaged enemy is`, () => {
      const made = tableFromLayout(SCENARIO, { engaged: [code, "f0"], hand: ["01069"] }, { extra: ["01069"] });
      expect(targetCodes(made, "01069")).toEqual(["f0"]);
    });
  }
});

describe("Forced effects after an enemy engages a player", () => {
  // 142025 Great Warg Chief: "Forced: After Great Warg Chief engages you, discard cards from the encounter deck until a Warg enemy is discarded. Put that enemy into play engaged with you." Howling Warg (142027) is a Warg.
  it("142025:A:2 puts the first Warg discarded into play engaged with the player it engaged, the other cards discarded before it", () => {
    const state = played({ seats: 2, engaged: [{ code: "142025", seat: 1 }], deck: ["place", "f0", "142027", "f3"] }, announce("engaged", "142025", { seat: 1 }));
    expect(state.seats[1]?.engaged.map((id) => state.cards[id]?.code).sort()).toEqual(["142025", "142027"]);
    expect(state.seats[0]?.engaged).toEqual([]);
    expect(state.encounterDiscard.map((id) => state.cards[id]?.code).sort()).toEqual(["f0", "place"]);
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).toEqual(["f3"]);
  });

  it("142025:A:2 discards the whole encounter deck and puts nothing into play when it holds no Warg", () => {
    const state = played({ engaged: ["142025"], deck: ["place", "f0"] }, announce("engaged", "142025"));
    expect(state.encounterDeck).toEqual([]);
    expect(zonesOf(state, "f0")).toEqual(["encounterDiscard"]);
    expect(state.seats[0]?.engaged.map((id) => state.cards[id]?.code)).toEqual(["142025"]);
  });

  // 142028 Crebain from Dunland: "After Crebain from Dunland engages a player": another enemy engaging reveals nothing.
  it("142028:A:3 reveals nothing when another enemy engages a player", () => {
    const state = played({ staging: ["142028"], engaged: ["f0"], deck: ["f3"] }, announce("engaged", "f0"));
    expect(zonesOf(state, "f3")).toEqual(["encounterDeck"]);
  });
});

describe("the false cases and durations of the encounter cards", () => {
  // 142021 The Nine Walkers: "the players must travel to a location, if able": with no location in the staging area they may decline.
  it("142021:B:1 lets the players decline to travel when no location is in the staging area", () => {
    const made = tableFromLayout(SCENARIO, { stage: "142021", phase: "Travel", staging: ["f0"] });
    expect(legalIntents(made.state, made.ctx).map((intent) => intent.type)).toContain("DeclineTravel");
  });

  // 142022 The Hunt is Up!: "After a location enters play, place 1 damage on it": an enemy that enters play gets none.
  it("142022:B:2 places no damage on an enemy that enters play", () => {
    const state = played({ stage: "142022", deck: ["f0"] }, reveal("f3"));
    expect(state.cards[idOf(state, "f3")]?.damage).toBe(0);
  });

  // 142031 Tree-crowned Hill: "While Tree-crowned Hill is the active location": in the staging area it gives no -1 Threat.
  it("142031:A:1 gives no enemy -1 Threat while it is in the staging area", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["142031", "f3"] });
    expect(statOf(made.state, made.cards, "f3", "threat")).toBe(3);
  });

  // 142032 Hills of Hollin: "While Hills of Hollin is the active location": in the staging area it gives no +5 engagement cost.
  it("142032:A:1 gives no enemy +5 engagement cost while it is in the staging area", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["142032", "f0"] });
    expect(statOf(made.state, made.cards, "f0", "engagementCost")).toBe(50);
  });

  // 142033 Redhorn Foothills: "-5 engagement cost until the end of the round", and only while it is the active location.
  it("142033:A:1 lasts until the end of the round, and an enemy added while it is in the staging area gets nothing", () => {
    const made = tableFromLayout(SCENARIO, { active: "142033", deck: ["f0", "f0", "f0"] });
    const round = play(SCENARIO, { line: "", layout: { active: "142033", deck: ["f0", "f0", "f0"] }, act: [reveal("f3"), endPhase, endRound], expect: [] }, EFFECTS, false).run.state;
    expect(round.round).toBe(made.state.round + 1);
    expect(zonesOf(round, "f3")).toEqual(["staging"]);
    expect(statOf(round, made.cards, "f3", "engagementCost")).toBe(50);
    const staged = played({ staging: ["142033"], deck: ["f0"] }, reveal("f3"));
    expect(statOf(staged, made.cards, "f3", "engagementCost")).toBe(50);
  });

  // 142036 Snowdrifts: "No more than 3 progress can be placed on attached location each round": the next round takes 3 more.
  it("142036:A:1 caps the progress of each round, so the next round places progress on the location again", () => {
    const layout: Layout = { active: "142031", attached: [{ code: "142036", to: "142031" }], deck: ["f0", "f0", "f0", "f0"] };
    const made = tableFromLayout(SCENARIO, layout);
    const next = play(SCENARIO, { line: "", layout, act: [quest("success"), endRound], expect: [] }, EFFECTS, false).run.state;
    const hill = idOf(next, "142031");
    expect(next.cards[hill]?.progress).toBe(3);
    const placed = settle(syncConstants(runInstruction({ ...next, window: null }, { verb: "ProgressQuest", amount: 2 }, { seat: 0, sourceId: next.questStage }, made.ctx, []), made.ctx), made.ctx, []);
    expect(placed.cards[hill]?.progress).toBe(5);
  });

  // 906402 Pale-green Tentacle: "After Pale-green Tentacle attacks and destroys a character": a defender that survives keeps it engaged.
  it("906402:A:3 stays engaged when its attack destroys no character", () => {
    const state = play(SCENARIO, { line: "", layout: {}, act: [attack("906402"), defend("dh1")], expect: [] }, EFFECTS, false).run.state;
    expect(state.cards[idOf(state, "dh1")]?.damage).toBe(3);
    expect(zonesOf(state, "906402")).toEqual(["engaged"]);
  });

  // 906404 Misty Mountain Warg: "Shadow: If this attack destroys a character": a hero that survives places no damage on the active location.
  it("906404:A:2 places no damage on the active location when the attack destroys no character", () => {
    const state = play(SCENARIO, { line: "", layout: { active: "place" }, act: [attack("142026", { shadow: "906404" }), defend("dh1")], expect: [] }, EFFECTS, false).run.state;
    expect(state.cards[idOf(state, "dh1")]?.damage).toBe(2);
    expect(state.cards[idOf(state, "place")]?.damage).toBe(0);
  });

  // 906408 Shelterless Land: "Until the end of the phase, add 1 to the total Threat in the staging area for each damage on each active location."
  it("906408:A:2 adds to the staging area's Threat until the end of the phase only", () => {
    const made = tableFromLayout(SCENARIO, {});
    const layout: Layout = { stage: "142022", phase: "Planning", active: { code: "place", damage: 2 }, deck: ["f0", "f0", "f0", "f0", "f0"] };
    const during = played(layout, reveal("906408"));
    expect(stagingThreat(during, made.cards)).toBe(2);
    // Every other card is the 0-Threat f0, so only the effect could add Threat once the planning phase is over (stage 3 has no Forced effect at its end).
    const after = played(layout, [reveal("906408"), endPhase]);
    expect(after.phase).not.toBe("Planning");
    expect(stagingThreat(after, made.cards)).toBe(0);
  });
});

describe("Pale-green Tentacle and the Watcher in the Water", () => {
  const hit = (made: LayoutTable, state: ScenarioState, code: string, amount: number) => settle(syncConstants(placeDamage(state, idOf(state, code), amount, made.cards, [], "combat", ruleCause("rr.step-6-8-3")), made.ctx), made.ctx, []);

  it("906402:A:2 keeps damage off the Watcher in the Water while it is in play", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["142024"], engaged: ["906402"] });
    const struck = hit(made, made.state, "142024", 3);
    expect(struck.cards[idOf(struck, "142024")]?.damage).toBe(0);
  });

  // Only the Watcher is named: another enemy takes damage while a Tentacle is in play.
  it("906402:A:2 keeps no damage off another enemy", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["142024"], engaged: ["906402", "f3"] });
    expect(hit(made, made.state, "f3", 1).cards[idOf(made.state, "f3")]?.damage).toBe(1);
  });
});

describe("Hunting Hawk (906403:A:2)", () => {
  // "While Hunting Hawk is in the staging area it gains, 'Forced: After a player plays an ally, he must either exhaust it, or place 1 damage on an active location.'"
  function playAlly(layout: Layout, option?: string): ScenarioState {
    const made = tableFromLayout(SCENARIO, { phase: "Planning", hand: ["ally"], heroResources: 1, ...layout });
    const sent = send(start(made.state), { type: "PlayCard", cardId: idOf(made.state, "ally"), payments: [{ heroId: made.hero, amount: 1 }] } as PlayerIntent, made.ctx);
    expect(sent.state.window?.kind === "choose" ? [...sent.state.window.options].sort() : [], "the options offered").toEqual(option ? ["damage", "exhaust"] : []);
    return finish(sent, made.ctx, () => option ?? "").state;
  }

  it("906403:A:2 makes the player who played an ally exhaust it, or place 1 damage on the active location", () => {
    const tired = playAlly({ staging: ["906403"], active: "place" }, "exhaust");
    expect(tired.cards[idOf(tired, "ally")]?.exhausted).toBe(true);
    expect(tired.cards[idOf(tired, "place")]?.damage).toBe(0);
    const hurt = playAlly({ staging: ["906403"], active: "place" }, "damage");
    expect(hurt.cards[idOf(hurt, "ally")]?.exhausted).toBe(false);
    expect(hurt.cards[idOf(hurt, "place")]?.damage).toBe(1);
  });

  it("906403:A:2 does nothing while Hunting Hawk is engaged with a player", () => {
    const state = playAlly({ engaged: ["906403"], active: "place" });
    expect(state.cards[idOf(state, "ally")]?.exhausted).toBe(false);
    expect(state.cards[idOf(state, "place")]?.damage).toBe(0);
  });
});

describe("Expanse of Hollin (906405)", () => {
  it("906405:A:1 counts the enemies in the staging area as well as the engaged ones", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["906405", "f0"], engaged: ["f3"] });
    expect(statOf(made.state, made.cards, "906405", "threat")).toBe(3);
  });

  it("906405:A:1 counts an enemy engaged with a player", () => {
    const made = tableFromLayout(SCENARIO, { staging: ["906405"], engaged: ["f3", "f0"] });
    expect(statOf(made.state, made.cards, "906405", "threat")).toBe(3);
  });

  // "Forced: When Expanse of Hollin is explored, shuffle the encounter discard pile into the encounter deck. Then, discard the top card of the encounter deck for each damage here. Add each enemy discarded by this effect to the staging area."
  // The quest card places the progress, so no staging step reveals a card first.
  // Reading (agent recommendation, docs/scenarios/nightmare.md): "When ... is explored" interrupts the move to the discard pile, so the Forced effect resolves while Expanse of Hollin is still in play: it is not shuffled into the deck, and goes to the encounter discard pile after the effect.
  it("906405:A:2 shuffles the discard pile into the deck without the explored Expanse, discards 2 cards for its 2 damage and adds the enemies among them to the staging area", () => {
    const made = tableFromLayout(SCENARIO, { active: { code: "906405", damage: 2, progress: 5 }, deck: ["f0", "treachery"], discard: ["f3"] });
    const state = settle(syncConstants(runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: 1 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []), made.ctx), made.ctx, []);
    // 3 cards are shuffled in, not 4: the explored Expanse stays out, in the encounter discard pile; 2 of the 3 are discarded.
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.cards[idOf(state, "906405")]?.zone).toBe("encounterDiscard");
    const gone = ["f0", "f3", "treachery"].flatMap((code) => idsOf(state, code)).filter((id) => state.cards[id]?.zone !== "encounterDeck");
    expect(gone).toHaveLength(2);
    const enemy = (id: string) => made.cards.get(state.cards[id]?.code ?? "")?.type === "enemy";
    expect(gone.filter(enemy).map((id) => state.cards[id]?.zone)).toEqual(gone.filter(enemy).map(() => "staging"));
    expect(gone.filter((id) => !enemy(id)).map((id) => state.cards[id]?.zone)).toEqual(gone.filter((id) => !enemy(id)).map(() => "encounterDiscard"));
  });
});
