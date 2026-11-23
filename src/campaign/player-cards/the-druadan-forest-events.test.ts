// Rules: rr.printed, rr.resource-match, rr.play-restrictions-and-permissions, rr.action, rr.lasting-effects, rr.ready, hon.battle,
// rr.engagement-check, rr.optional-engagement, rr.triggered-ability (data/rules/entries.json).
// The Drúadan Forest events, written from their card text (data/cards/TDF.json; data/printed holds no ledger for this pack, so the lines
// are the text of data/cards and every intent goes through sendUnledgered): Strength of Arms 06034:A:1 and A:2, Trained for War 06036:A:1
// and A:2, Against the Shadow 06038:A:1 and A:2, Advance Warning 06040:A:1 and A:2. The heroes, allies and attachment are in
// the-druadan-forest.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { combat, enter, passAll, play, playerTableFor, sendUnledgered } from "../../../test/harness/player-table.ts";

const STRENGTH = "06034";
const TRAINED = "06036";
const AGAINST = "06038";
const WARNING = "06040";
// Core Aragorn and Théodred (Leadership), Legolas and Gimli (Tactics), Éowyn and Eleanor (Spirit), Beravor and Denethor (Lore); Song of
// Wisdom ("Attached hero gains a Lore resource icon.").
const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const LEGOLAS = "01005";
const EOWYN = "01007";
const ELEANOR = "01008";
const DENETHOR = "01010";
const BERAVOR = "01012";
const SONG = "02034";
const PAL = "pal";
const ALLY = "ally";
// A Leadership ally of Willpower 3 and Defense 0, and a Spirit ally of Willpower 3 and Defense 0, both of 9 hit points.
const DREAMER = "dreamer";
const SPIRIT_DREAMER = "spirit-dreamer";
// Enemies: a Brute (Attack 4) that engages nobody; Cheap (engagement cost 2) from the starter scene, which a threat of 8 engages.
const BRUTE = "brute";
const CHEAP = "cheap";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);
const playable = (state: Table["state"], tab: Table, id: string): boolean => legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === id);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([STRENGTH, TRAINED, AGAINST, WARNING, ARAGORN, THEODRED, GIMLI, LEGOLAS, EOWYN, ELEANOR, DENETHOR, BERAVOR, SONG]))]);
  cards.set(DREAMER, definePrinted({ code: DREAMER, name: "Dreamer", type: "ally", sphere: "leadership", cost: 1, willpower: 3, attack: 1, defense: 0, health: 9 }));
  cards.set(SPIRIT_DREAMER, definePrinted({ code: SPIRIT_DREAMER, name: "Spirit Dreamer", type: "ally", sphere: "spirit", cost: 1, willpower: 3, attack: 1, defense: 0, health: 9 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 4, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

// Whether `code` can be played from the hand with the heroes `heroes` (codes, first seat) and `theirs` (codes, second seat); `song` puts
// Song of Wisdom on the first hero. An exhausted ally is in play so each event has something to do.
function playableWith(effects: readonly Effect[], code: string, heroes: readonly string[], theirs: readonly string[] = [], song = false): boolean {
  const seats = theirs.length > 0 ? 2 : 1;
  const tab = table(effects, { seats, heroes: [...heroes.map((hero) => ({ code: hero, seat: 0 })), ...theirs.map((hero) => ({ code: hero, seat: 1 }))], allies: [{ code: ALLY, seat: 0 }], hand: [{ code, seat: 0 }], attached: song ? [{ code: SONG, host: heroes[0] ?? "" }] : [] });
  const state = updateCard(tab.state, idsOf(tab, ALLY), { exhausted: true });
  return playable(state, tab, idsOf(tab, code));
}

describe("Strength of Arms (06034:A:1, A:2)", () => {
  // "Play only if each hero you control has a printed Leadership resource icon.": with Aragorn and Théodred it can be played, beside the
  // other player's Legolas too; with Aragorn and Legolas it cannot.
  lineSpec("06034:A:1", "Strength of Arms: play only if each hero you control has a printed Leadership icon", (effects) => {
    expect(playableWith(effects, STRENGTH, [ARAGORN, THEODRED])).toBe(true);
    expect(playableWith(effects, STRENGTH, [ARAGORN, THEODRED], [LEGOLAS])).toBe(true);
    expect(playableWith(effects, STRENGTH, [ARAGORN, LEGOLAS])).toBe(false);
  });

  // "Action: Ready each ally in play.": the player's exhausted ally and the other player's are readied; the exhausted hero is not.
  lineSpec("06034:A:2", "Strength of Arms: ready each ally in play", (effects) => {
    const placed = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: DREAMER, seat: 1 }], hand: [{ code: STRENGTH, seat: 0 }] });
    let state = placed.state;
    for (const id of [idsOf(placed, ALLY), idsOf(placed, DREAMER), idsOf(placed, THEODRED)]) state = updateCard(state, id, { exhausted: true });
    const tab = { ...placed, state };
    const run = play(begin(tab.state), tab, idsOf(tab, STRENGTH));
    expect(run.state.cards[idsOf(tab, ALLY)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, DREAMER)]?.exhausted).toBe(false);
    expect(run.state.cards[idsOf(tab, THEODRED)]?.exhausted).toBe(true);
  });

  // With every ally ready the Action can ready nothing, so it is not played (rr.triggered-ability).
  it("06034:A:2 Strength of Arms: not played with no exhausted ally", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: STRENGTH, seat: 0 }] });
    expect(playable(tab.state, tab, idsOf(tab, STRENGTH))).toBe(false);
  });
});

describe("Trained for War (06036:A:1, A:2)", () => {
  // "Play only if each hero you control has the printed Tactics resource icon.": with Legolas and Gimli it can be played; with Legolas and
  // Aragorn it cannot.
  lineSpec("06036:A:1", "Trained for War: play only if each hero you control has the printed Tactics icon", (effects) => {
    expect(playableWith(effects, TRAINED, [LEGOLAS, GIMLI])).toBe(true);
    expect(playableWith(effects, TRAINED, [LEGOLAS, ARAGORN])).toBe(false);
  });

  // "Action: Until the end of the phase, if the current quest does not have Siege, it gains Battle.": played in the quest phase before the
  // commit, Legolas (Willpower 1, Attack 3) and Gimli (Willpower 2, Attack 2) quest with their Attack (hon.battle): 5 progress, not 3.
  lineSpec("06036:A:2", "Trained for War: the current quest gains Battle until the end of the phase", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }], hand: [{ code: TRAINED, seat: 0 }], deck: ["f0", "f0"] });
    const stage = tab.state.questStage ?? "";
    let run = play(begin(tab.state), tab, idsOf(tab, TRAINED));
    run = sendUnledgered(run, { type: "Commit", cardIds: [idsOf(tab, LEGOLAS), idsOf(tab, GIMLI)] }, tab.ctx);
    for (let guard = 0; guard < 5 && run.state.mode === "questCommit"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.mode).toBe("travel");
    expect(run.state.cards[stage]?.progress).toBe(3 + 2);
  });

  // Without the event the same two heroes quest with their Willpower: 3 progress.
  it("06036:A:2 Trained for War: without it the heroes quest with their Willpower", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: LEGOLAS, seat: 0 }, { code: GIMLI, seat: 0 }], deck: ["f0", "f0"] });
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, LEGOLAS), idsOf(tab, GIMLI)] }, tab.ctx);
    for (let guard = 0; guard < 5 && run.state.mode === "questCommit"; guard += 1) run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[tab.state.questStage ?? ""]?.progress).toBe(1 + 2);
  });
});

describe("Against the Shadow (06038:A:1, A:2)", () => {
  // "Play only if each hero you control has the printed Spirit resource icon.": with Éowyn and Eleanor it can be played; with Éowyn and
  // Beravor it cannot.
  lineSpec("06038:A:1", "Against the Shadow: play only if each hero you control has the printed Spirit icon", (effects) => {
    expect(playableWith(effects, AGAINST, [EOWYN, ELEANOR])).toBe(true);
    expect(playableWith(effects, AGAINST, [EOWYN, BERAVOR])).toBe(false);
  });

  // "Action: Until the end of the phase, Spirit characters use their Willpower instead of Defense.": played in the combat phase's action
  // window, Éowyn (Willpower 4, Defense 1) defends the first Brute with Defense 4 and takes no damage; the Spirit ally (Willpower 3,
  // Defense 0) defends the second with 3; the Leadership ally (Willpower 3, Defense 0) defends the third with 0.
  lineSpec("06038:A:2", "Against the Shadow: Spirit characters use their Willpower instead of Defense this phase", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: ELEANOR, seat: 0 }], allies: [{ code: SPIRIT_DREAMER, seat: 0 }, { code: DREAMER, seat: 0 }], hand: [{ code: AGAINST, seat: 0 }], engaged: [{ code: BRUTE, seat: 0 }, { code: BRUTE, seat: 0 }, { code: BRUTE, seat: 0 }] });
    const [first = "", second = "", third = ""] = tab.ids[BRUTE] ?? [];
    let run = combat(tab.state, tab);
    expect(playable(run.state, tab, idsOf(tab, AGAINST))).toBe(true);
    run = passAll(play(run, tab, idsOf(tab, AGAINST)), tab.ctx);
    for (const [enemy, defender] of [[first, EOWYN], [second, SPIRIT_DREAMER], [third, DREAMER]] as const) {
      if (run.state.window?.kind === "chooseEnemy") run = passAll(sendUnledgered(run, { type: "ChooseEnemy", enemyId: enemy }, tab.ctx), tab.ctx);
      expect(run.state.window?.kind).toBe("defense");
      run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx, { responses: true });
    }
    const strikes = run.steps.flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [[step.targetId, step.defense]] : []));
    expect(strikes).toEqual([[idsOf(tab, EOWYN), 4], [idsOf(tab, SPIRIT_DREAMER), 3], [idsOf(tab, DREAMER), 0]]);
    expect(run.state.cards[idsOf(tab, EOWYN)]?.damage).toBe(0);
  });
});

describe("Advance Warning (06040:A:1, A:2)", () => {
  // "Play only if each hero you control has a printed Lore resource icon.": with Beravor and Denethor it can be played; with Beravor and
  // Aragorn it cannot, nor with Aragorn holding Song of Wisdom (a Lore icon that is not printed) beside Beravor.
  lineSpec("06040:A:1", "Advance Warning: play only if each hero you control has a printed Lore icon", (effects) => {
    expect(playableWith(effects, WARNING, [BERAVOR, DENETHOR])).toBe(true);
    expect(playableWith(effects, WARNING, [BERAVOR, ARAGORN])).toBe(false);
    expect(playableWith(effects, WARNING, [ARAGORN, BERAVOR], [], true)).toBe(false);
  });

  // The encounter phase opens on its optional engagement, the Cheap enemy (engagement cost 2) in the staging area and the threat at 8.
  const encounter = (effects: readonly Effect[]) => table(effects, { start: "encounter", heroes: [{ code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: WARNING, seat: 0 }], staging: [CHEAP] });

  // "Action: Until the end of the phase, enemies do not make engagement checks.": the player declines to engage, plays the event in the
  // action window before the engagement checks (rr.framework-steps, 5.2), and the Cheap enemy stays in the staging area once the phase is
  // over. In the next encounter phase its engagement check engages it.
  lineSpec("06040:A:2", "Advance Warning: enemies make no engagement checks this phase", (effects) => {
    const tab = encounter(effects);
    let run = sendUnledgered(begin(tab.state), { type: "DeclineEngage" }, tab.ctx);
    expect(run.state.window?.kind).toBe("frameAction");
    expect(playable(run.state, tab, idsOf(tab, WARNING))).toBe(true);
    run = passAll(play(run, tab, idsOf(tab, WARNING)), tab.ctx);
    expect(run.state.phase).not.toBe("Encounter");
    expect(run.state.cards[idsOf(tab, CHEAP)]?.zone).toBe("staging");
    const next = passAll(enter(run.state, tab, "engagement"), tab.ctx);
    expect(next.state.cards[idsOf(tab, CHEAP)]?.zone).toBe("engaged");
  });

  // Without the event the engagement check engages the Cheap enemy.
  it("06040:A:2 Advance Warning: without it the engagement check engages the enemy", () => {
    const tab = encounter(EFFECTS);
    const run = passAll(begin(tab.state), tab.ctx, { engage: true });
    expect(run.state.phase).toBe("Combat");
    expect(run.state.cards[idsOf(tab, CHEAP)]?.zone).toBe("engaged");
  });
});
