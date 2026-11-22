// Rules: rr.modifiers, rr.engaged, rr.response, rr.destroy, rr.step-3-2, rr.search, rr.enters-play, rr.drawing-cards, rr.constant-ability,
// rr.play-restrictions-and-permissions, rr.step-6-2, rr.shadow-effects, rr.optional-engagement, rr.cost, rr.step-6-8-3 (data/rules/entries.json).
// The Lost Realm heroes, allies and events, written from their card text (data/cards/TLR.json; data/printed holds no ledger for this box yet):
// Aragorn 09001:A:1 and A:2, Halbarad 09002:A:1, Weather Hills Watchman 09003:A:1, Sarn Ford Sentry 09005:A:1, Warden of Annúminas 09006:A:1,
// Ranger Summons 09007:A:1, Tireless Hunters 09008:A:1 and A:2, Expert Trackers 09009:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { attachTo, spawn } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, chooseIfAsked, combat, fillers, playCode, playerTable, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

const ARAGORN = "09001";
const HALBARAD = "09002";
const WATCHMAN = "09003";
const SENTRY = "09005";
const WARDEN = "09006";
const SUMMONS = "09007";
const HUNTERS = "09008";
const TRACKERS = "09009";
const RANGER_OF_THE_NORTH = "09015";
const VIGIL = "09012";
// Core cards: Aragorn (Leadership, Dúnedain), Glóin and Théodred (Leadership, not Dúnedain), Legolas (Tactics), Beravor (Lore, Dúnedain Ranger),
// Éowyn (Spirit), Snowbourn Scout (a Scout ally).
const CORE_ARAGORN = "01001";
const THEODRED = "01002";
const GLOIN = "01003";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const SNOWBOURN = "01016";
const GREEN_HILL = "141036";
const F3 = "f3";
const WEAK = "weak";
const FRAIL = "frail";
const PAL = "pal";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, HALBARAD, WATCHMAN, SENTRY, WARDEN, SUMMONS, HUNTERS, TRACKERS, RANGER_OF_THE_NORTH, VIGIL, CORE_ARAGORN, THEODRED, GLOIN, LEGOLAS, EOWYN, BERAVOR, SNOWBOURN, GREEN_HILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 2, health: 9 }));
  cards.set(FRAIL, definePrinted({ code: FRAIL, name: "Frail", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 1 }));
  base = { ...starter, cards };
});

function playable(state: ScenarioState, tab: Table, code: string): string | null {
  const card = idsOf(tab, code);
  return refusal(state, { type: "PlayCard", cardId: card, payments: payFor(state, tab.ctx, card) }, tab.ctx);
}

// Passes the action windows until a Response is offered or the game asks for something else.
function passTo(run: Run, tab: Table, effectId: string): Run {
  let next = run;
  for (let guard = 0; guard < 10 && !triggers(next.state, tab).includes(effectId) && (next.state.window?.kind === "frameAction" || next.state.window?.kind === "response"); guard += 1) next = sendUnledgered(next, { type: "Pass" }, tab.ctx);
  return next;
}

describe("Aragorn (09001:A:1, A:2)", () => {
  // "Each enemy engaged with you gets -1 Defense.": the enemy engaged with Aragorn's player loses 1 Defense; the staged one and the one engaged
  // with the other player do not.
  lineSpec("09001:A:1", "gives each enemy engaged with you -1 Defense, and no other enemy", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }] });
    // The scene puts the staging area's cards in before the engaged ones.
    const [staged, mine, theirs] = tab.ids[WEAK] ?? [];
    expect(stat(tab.state, tab, mine ?? "", "defense")).toBe(1);
    expect(stat(tab.state, tab, theirs ?? "", "defense")).toBe(2);
    expect(stat(tab.state, tab, staged ?? "", "defense")).toBe(2);
  });

  // "Response: After Aragorn participates in an attack that destroys an enemy, choose an enemy not engaged with you and engage that enemy."
  function destroys(effects: readonly Effect[], attacker: string, scene: Scene): { tab: Table; run: Run } {
    const tab = table(effects, scene);
    const run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, FRAIL), attackerIds: [idsOf(tab, attacker)] }, tab.ctx);
    return { tab, run: passTo(run, tab, "09001:response:1") };
  }

  lineSpec("09001:A:2", "after his attack destroys an enemy, engages an enemy from the staging area", (effects) => {
    const { tab, run: destroyed } = destroys(effects, ARAGORN, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], engaged: [{ code: FRAIL, seat: 0 }], staging: [WEAK] });
    expect(destroyed.state.cards[idsOf(tab, FRAIL)]?.zone).toBe("encounterDiscard");
    expect(triggers(destroyed.state, tab)).toContain("09001:response:1");
    let run = sendUnledgered(destroyed, { type: "Trigger", cardId: idsOf(tab, ARAGORN), effectId: "09001:response:1" }, tab.ctx);
    run = chooseIfAsked(run, tab, "staging");
    run = chooseIfAsked(run, tab, idsOf(tab, WEAK));
    expect(run.state.cards[idsOf(tab, WEAK)]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  lineSpec("09001:A:2", "after his attack destroys an enemy, engages an enemy engaged with the other player", (effects) => {
    const { tab, run: destroyed } = destroys(effects, ARAGORN, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: FRAIL, seat: 0 }, { code: WEAK, seat: 1 }] });
    let run = sendUnledgered(destroyed, { type: "Trigger", cardId: idsOf(tab, ARAGORN), effectId: "09001:response:1" }, tab.ctx);
    run = chooseIfAsked(run, tab, "otherPlayer");
    run = chooseIfAsked(run, tab, idsOf(tab, WEAK));
    expect(run.state.cards[idsOf(tab, WEAK)]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("09001:A:2 is not offered after another character's attack, or with no enemy left that is not engaged with you", () => {
    const other = destroys(EFFECTS, LEGOLAS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: LEGOLAS, seat: 0 }], engaged: [{ code: FRAIL, seat: 0 }], staging: [WEAK] });
    expect(other.run.state.cards[idsOf(other.tab, FRAIL)]?.zone).toBe("encounterDiscard");
    expect(triggers(other.run.state, other.tab)).not.toContain("09001:response:1");
    const none = destroys(EFFECTS, ARAGORN, { heroes: [{ code: ARAGORN, seat: 0 }], engaged: [{ code: FRAIL, seat: 0 }, { code: WEAK, seat: 0 }] });
    expect(none.run.state.cards[idsOf(none.tab, FRAIL)]?.zone).toBe("encounterDiscard");
    expect(triggers(none.run.state, none.tab)).not.toContain("09001:response:1");
  });
});

describe("Halbarad (09002:A:1)", () => {
  // "While you are engaged with any enemy, Halbarad does not exhaust to commit to a quest."
  lineSpec("09002:A:1", "stays ready when committed while you are engaged with an enemy, and exhausts when you are not", (effects) => {
    const engaged = table(effects, { start: "quest", heroes: [{ code: HALBARAD, seat: 0 }, { code: BERAVOR, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }], deck: ["f0", "f0"] });
    const halbarad = idsOf(engaged, HALBARAD);
    const run = sendUnledgered(begin(engaged.state), { type: "Commit", cardIds: [halbarad, idsOf(engaged, BERAVOR)] }, engaged.ctx);
    expect(run.state.cards[halbarad]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[idsOf(engaged, BERAVOR)]?.exhausted).toBe(true);
    const free = table(effects, { start: "quest", heroes: [{ code: HALBARAD, seat: 0 }], staging: [WEAK], deck: ["f0", "f0"] });
    const alone = sendUnledgered(begin(free.state), { type: "Commit", cardIds: [idsOf(free, HALBARAD)] }, free.ctx);
    expect(alone.state.cards[idsOf(free, HALBARAD)]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Halbarad (09002:A:1), an enemy engaged with another player", () => {
  // "While you are engaged with any enemy": an enemy engaged with the other player is not one engaged with Halbarad's player.
  it("09002:A:1 exhausts when only the other player is engaged with an enemy", () => {
    const tab = table(EFFECTS, { seats: 2, start: "quest", heroes: [{ code: HALBARAD, seat: 0 }, { code: PAL, seat: 1 }], engaged: [{ code: WEAK, seat: 1 }], deck: ["f0", "f0"] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, HALBARAD)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, HALBARAD)]).toMatchObject({ committed: true, exhausted: true });
  });
});

describe("Weather Hills Watchman (09003:A:1)", () => {
  // "Response: After Weather Hills Watchman enters play, search the top 5 cards of your deck for a Signal card and add it to your hand. Shuffle the
  // other cards back into your deck.": the top 5 hold one Ranger Summons (a Signal event); a second lies sixth.
  lineSpec("09003:A:1", "after it enters play, takes a Signal card from the top 5 cards into the hand and shuffles", (effects) => {
    const deck = [CARD, CARD, SUMMONS, CARD, CARD, SUMMONS].map((code) => ({ code, seat: 0 }));
    const tab = table(effects, { heroes: [{ code: CORE_ARAGORN, seat: 0 }], hand: [{ code: WATCHMAN, seat: 0 }], playerDeck: deck });
    const [near] = tab.ids[SUMMONS] ?? [];
    const cursor = tab.state.seedCursor;
    let run = playCode(tab, WATCHMAN);
    expect(triggers(run.state, tab)).toContain("09003:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, WATCHMAN), effectId: "09003:response:1" }, tab.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    run = chooseIfAsked(run, tab, near ?? "");
    expect(run.state.seats[0]?.hand).toEqual([near]);
    expect(run.state.seats[0]?.deck).toHaveLength(5);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("Sarn Ford Sentry (09005:A:1)", () => {
  // "Response: After Sarn Ford Sentry enters play, draw 1 card for each enemy engaged with you.": 2 enemies are engaged with you, 1 with the other
  // player: 2 cards.
  lineSpec("09005:A:1", "after it enters play, draws 1 card for each enemy engaged with you", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: SENTRY, seat: 0 }], playerDeck: fillers(CARD, 5), engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }] });
    let run = playCode(tab, SENTRY);
    expect(triggers(run.state, tab)).toContain("09005:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, SENTRY), effectId: "09005:response:1" }, tab.ctx);
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.seats[0]?.deck).toHaveLength(3);
  });
});

describe("Warden of Annúminas (09006:A:1)", () => {
  // "Warden of Annúminas gets +1 Willpower for each enemy engaged with you.": printed 0; one enemy is engaged with you and one with the other
  // player, so 1. The player then engages the staged enemy (optional engagement): 2, in the state the Engage intent returns.
  lineSpec("09006:A:1", "gets +1 Willpower for each enemy engaged with you", (effects) => {
    const tab = table(effects, { seats: 2, start: "encounter", heroes: [{ code: EOWYN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: WARDEN, seat: 0 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }] });
    const warden = idsOf(tab, WARDEN);
    expect(stat(tab.state, tab, warden, "willpower")).toBe(1);
    const run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, WEAK) }, tab.ctx);
    expect(stat(run.state, tab, warden, "willpower")).toBe(2);
  });
});

describe("Ranger Summons (09007:A:1)", () => {
  // "Play only if you control a Dúnedain hero.": with Aragorn (Dúnedain) it is played; with Glóin and Théodred it is not. A Ranger of the North of
  // the player's own is set aside, so the Planning Action has something to shuffle.
  lineSpec("09007:A:1", "is played only while you control a Dúnedain hero", (effects) => {
    const ready = (heroes: readonly string[]): { tab: Table; state: ScenarioState } => {
      const tab = table(effects, { heroes: heroes.map((code) => ({ code, seat: 0 })), hand: [{ code: SUMMONS, seat: 0 }], setAside: [RANGER_OF_THE_NORTH] });
      return { tab, state: updateCard(tab.state, idsOf(tab, RANGER_OF_THE_NORTH), { owner: 0 }) };
    };
    const dunedain = ready([CORE_ARAGORN, GLOIN]);
    expect(playable(dunedain.state, dunedain.tab, SUMMONS)).toBeNull();
    const none = ready([GLOIN, THEODRED]);
    expect(playable(none.state, none.tab, SUMMONS)).not.toBeNull();
  });
});

describe("Tireless Hunters (09008:A:1, A:2)", () => {
  // "Play only before the resolving enemy attacks step.": it is played in the action window before the enemies attack (6.2), not in the player
  // attacks once the enemy attacks are resolved. A staged enemy is there to engage.
  lineSpec("09008:A:1", "is played before the enemy attacks are resolved, and not after", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: HUNTERS, seat: 0 }], staging: [F3], engaged: [{ code: WEAK, seat: 0 }] });
    const before = combat(tab.state, tab);
    expect(before.state.window?.kind).toBe("frameAction");
    expect(playable(before.state, tab, HUNTERS)).toBeNull();
    // Legolas attacks once the enemy attacks are resolved. An action window opens in his attack only for a card that can be played, and
    // the Hunters are not: the attack resolves and no window holds it.
    const after = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: idsOf(tab, WEAK), attackerIds: [idsOf(tab, LEGOLAS)] }, tab.ctx);
    expect(after.state.cards[idsOf(tab, WEAK)]?.damage).toBe(1);
    expect(playable(after.state, tab, HUNTERS)).not.toBeNull();
  });

  // "Combat Action: Choose an enemy not engaged with you. Engage that enemy. Then, discard a shadow card from that enemy, if able."
  lineSpec("09008:A:2", "engages an enemy engaged with the other player and discards its shadow card", (effects) => {
    const scene = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HUNTERS, seat: 0 }], staging: [F3], engaged: [{ code: FRAIL, seat: 0 }, { code: WEAK, seat: 1 }] });
    const weak = idsOf(scene, WEAK);
    const opened = combat(scene.state, scene);
    const dealt = spawn(opened.state, CARD, { zone: "shadow", enemyId: weak }, "down");
    const tab = { ...scene, state: dealt.state };
    expect(tab.state.cards[weak]?.shadowId).toBe(dealt.id);
    let run = playCode(tab, HUNTERS, begin(tab.state));
    // The enemy already engaged with you is no choice.
    expect(choices(run.state, tab)).not.toContain(idsOf(tab, FRAIL));
    run = chooseIfAsked(run, tab, "otherPlayer");
    run = chooseIfAsked(run, tab, weak);
    expect(run.state.cards[weak]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(run.state.cards[weak]?.shadowId).toBeNull();
    expect(run.state.cards[dealt.id]?.zone).not.toBe("shadow");
    expect(run.state.cards[idsOf(tab, F3)]?.zone).toBe("staging");
  });

  lineSpec("09008:A:2", "engages a staged enemy that holds no shadow card", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: HUNTERS, seat: 0 }], staging: [F3], engaged: [{ code: FRAIL, seat: 0 }] });
    let run = playCode(tab, HUNTERS, combat(tab.state, tab));
    run = chooseIfAsked(run, tab, "staging");
    run = chooseIfAsked(run, tab, idsOf(tab, F3));
    expect(run.state.cards[idsOf(tab, F3)]).toMatchObject({ zone: "engaged", controller: 0 });
  });
});

describe("Expert Trackers (09009:A:1)", () => {
  // "Response: After you engage an enemy, exhaust a Scout or Ranger character to place X progress tokens on a location. X is the engaged enemy's
  // printed Threat.": the player engages f3 (Threat 3) and exhausts Beravor (Ranger); 3 progress go on the staged location.
  lineSpec("09009:A:1", "after you engage an enemy, exhausts a Scout or Ranger to place its printed Threat in progress on a location", (effects) => {
    const tab = table(effects, { start: "encounter", heroes: [{ code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], hand: [{ code: TRACKERS, seat: 0 }], staging: [F3, GREEN_HILL] });
    const [beravor, location, trackers] = [idsOf(tab, BERAVOR), idsOf(tab, GREEN_HILL), idsOf(tab, TRACKERS)];
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, F3) }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("09009:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: trackers, effectId: "09009:response:1", payments: payFor(run.state, tab.ctx, trackers) }, tab.ctx);
    // Glóin is neither a Scout nor a Ranger.
    expect(run.state.window?.kind).not.toBe("choose");
    run = chooseIfAsked(run, tab, beravor);
    run = chooseIfAsked(run, tab, location);
    expect(run.state.cards[beravor]?.exhausted).toBe(true);
    expect(run.state.cards[location]?.progress).toBe(3);
    expect(run.state.cards[trackers]?.zone).toBe("discard");
  });

  // X is the printed Threat: Secret Vigil (09012, "Attached enemy gets -1 Threat") on f3 does not lower it.
  it("09009:A:1 places the enemy's printed Threat, not its Threat as modified", () => {
    const scene = table(EFFECTS, { start: "encounter", heroes: [{ code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], allies: [{ code: VIGIL, seat: 0 }], hand: [{ code: TRACKERS, seat: 0 }], staging: [F3, GREEN_HILL] });
    const tab = { ...scene, state: syncConstants(attachTo(scene.state, idsOf(scene, VIGIL), idsOf(scene, F3)), scene.ctx) };
    const [location, trackers] = [idsOf(tab, GREEN_HILL), idsOf(tab, TRACKERS)];
    expect(stat(tab.state, tab, idsOf(tab, F3), "threat")).toBe(2);
    let run = sendUnledgered(begin(tab.state), { type: "Engage", enemyId: idsOf(tab, F3) }, tab.ctx);
    run = sendUnledgered(run, { type: "Trigger", cardId: trackers, effectId: "09009:response:1", payments: payFor(run.state, tab.ctx, trackers) }, tab.ctx);
    run = chooseIfAsked(chooseIfAsked(run, tab, idsOf(tab, BERAVOR)), tab, location);
    expect(run.state.cards[location]?.progress).toBe(3);
  });

  // "After you engage an enemy": the other player engaging an enemy is not the triggering condition.
  it("09009:A:1 is not offered when another player engages an enemy", () => {
    const tab = table(EFFECTS, { seats: 2, start: "encounter", heroes: [{ code: BERAVOR, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: TRACKERS, seat: 0 }], staging: [F3, GREEN_HILL] });
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = sendUnledgered(run, { type: "Engage", enemyId: idsOf(tab, F3) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, F3)]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(triggers(run.state, tab)).not.toContain("09009:response:1");
  });

  it("09009:A:1 is not offered with no ready Scout or Ranger character", () => {
    const tab = table(EFFECTS, { start: "encounter", heroes: [{ code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], hand: [{ code: TRACKERS, seat: 0 }], staging: [F3, GREEN_HILL] });
    let state = updateCard(tab.state, idsOf(tab, BERAVOR), { exhausted: true });
    state = updateCard(state, idsOf(tab, SNOWBOURN), { exhausted: true });
    const run = sendUnledgered(begin(state), { type: "Engage", enemyId: idsOf(tab, F3) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("09009:response:1");
  });
});
