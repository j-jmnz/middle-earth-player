// Rules: rr.ownership-and-control, rr.first-player, rr.sentinel, rr.quest-phase, rr.engaged,
// rr.action, rr.active-location, rr.cost, rr.modifiers (data/rules/entries.json).
// The Flame of the West heroes and allies, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts):
// Aragorn 145001:A:1 and A:2, Grimbold 145004:A:1, Halbarad 145006:A:1 and A:2, Ghân-buri-Ghân 145007:A:1. Grimbold's line is the text of
// data/cards/FotW.json (data/printed/the-return-of-the-king.json holds no entry for him), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { ruleCause } from "../../rules/core/cause.ts";
import { hasKeyword, placeDamage } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { withMode } from "../../rules/core/state.ts";
import { attackBarred } from "../../rules/interpret/constants.ts";
import { playCost } from "../../rules/player/attach.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "145001";
const GRIMBOLD = "145004";
const HALBARAD = "145006";
const GHAN = "145007";
// Banner of Elendil: an Artifact.
const BANNER = "145013";
// Core Aragorn (Leadership), Théodred (Rohan), Éowyn, Denethor.
const CORE_ARAGORN = "01001";
const THEODRED = "01002";
const EOWYN = "01007";
const DENETHOR = "01010";
// Steward of Gondor: a Leadership attachment that is not an Artifact.
const STEWARD = "01026";
// A location with printed Threat 2 (Green Hill Country) for Ghân-buri-Ghân.
const GREEN_HILL = "141036";
const WEAK = "weak";
const PAL = "pal";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, GRIMBOLD, HALBARAD, GHAN, BANNER, CORE_ARAGORN, THEODRED, EOWYN, DENETHOR, STEWARD, GREEN_HILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Aragorn (145001:A:1, A:2)", () => {
  // "The first player gains control of Aragorn."
  lineSpec("145001:A:1", "Aragorn: the first player gains control of him", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 1 }, { code: PAL, seat: 1 }] });
    const aragorn = idsOf(tab, ARAGORN);
    let run = sendUnledgered(begin(tab.state), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[aragorn]?.controller).toBe(0);
    run = sendUnledgered(begin({ ...run.state, firstPlayer: 1 }), { type: "Pass" }, tab.ctx);
    expect(run.state.cards[aragorn]?.controller).toBe(1);
  });

  // "If Aragorn leaves play, the players lose the game.": he is destroyed by damage and the game is lost; Denethor destroyed is not a loss.
  lineSpec("145001:A:1", "Aragorn: the players lose the game when he leaves play", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }] });
    const lethal = (id: string) => sendUnledgered(begin(placeDamage(tab.state, id, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
    const other = lethal(idsOf(tab, DENETHOR));
    expect(other.state.cards[idsOf(tab, DENETHOR)]?.zone).toBe("discard");
    expect(other.state.lost).toBe(false);
    const run = lethal(idsOf(tab, ARAGORN));
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.zone).not.toBe("heroes");
    expect(run.state.lost).toBe(true);
  });

  // "While Aragorn has an Artifact attached, he gains sentinel and does not exhaust to quest.": the Banner of Elendil (an Artifact) is
  // played on him through the intent; he then has sentinel, and he commits and stays ready.
  lineSpec("145001:A:2", "Aragorn: with an Artifact attached he gains sentinel and does not exhaust to quest", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: BANNER, seat: 0 }], deck: ["f0", "f0"] });
    const aragorn = idsOf(tab, ARAGORN);
    expect(hasKeyword(tab.state, aragorn, "sentinel", tab.ctx.cards)).toBe(false);
    const played = play(begin(tab.state), tab, idsOf(tab, BANNER), aragorn);
    expect(played.state.cards[idsOf(tab, BANNER)]?.host).toBe(aragorn);
    expect(hasKeyword(played.state, aragorn, "sentinel", tab.ctx.cards)).toBe(true);
    const quest = { ...played.state, phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "questCommit" as const, window: { kind: "pass" as const } };
    const run = sendUnledgered(begin(quest), { type: "Commit", cardIds: [aragorn, idsOf(tab, DENETHOR)] }, tab.ctx);
    expect(run.state.cards[aragorn]).toMatchObject({ committed: true, exhausted: false });
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.exhausted).toBe(true);
  });

  // With an attachment that is not an Artifact (Steward of Gondor) he has no sentinel and exhausts to quest.
  it("145001:A:2 Aragorn: an attachment that is not an Artifact gives him nothing", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }], attached: [{ code: STEWARD, host: ARAGORN }], deck: ["f0", "f0"] });
    const aragorn = idsOf(tab, ARAGORN);
    expect(hasKeyword(tab.state, aragorn, "sentinel", tab.ctx.cards)).toBe(false);
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [aragorn] }, tab.ctx);
    expect(run.state.cards[aragorn]?.exhausted).toBe(true);
  });
});

describe("Grimbold (145004:A:1)", () => {
  // "Combat Action: Discard Grimbold to choose an enemy engaged with a player. That enemy cannot attack that player this phase.": in a
  // two-player game the enemy engaged with the other player is chosen; Grimbold goes to the discard pile, that enemy is barred from
  // attacking that player, the enemy engaged with the first player is not, and the bar ends with the phase.
  lineSpec("145004:A:1", "Grimbold: discard him so the chosen engaged enemy cannot attack that player this phase", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: THEODRED, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: GRIMBOLD, seat: 0 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }] });
    // The scene spawns the staging area before the engaged enemies; the staged one is no choice.
    const [, mine, theirs] = tab.ids[WEAK] ?? [];
    const grimbold = idsOf(tab, GRIMBOLD);
    let run = combat(tab.state, tab);
    run = sendUnledgered(run, { type: "Trigger", cardId: grimbold, effectId: "145004:action:1" }, tab.ctx);
    expect(run.state.cards[grimbold]?.zone).toBe("discard");
    expect(choices(run.state, tab).sort()).toEqual([mine ?? "", theirs ?? ""].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: theirs ?? "" }, tab.ctx);
    expect(attackBarred(run.state, theirs ?? "", 1)).toBe(true);
    expect(attackBarred(run.state, mine ?? "", 0)).toBe(false);
    expect(attackBarred(withMode(run.state, "refresh"), theirs ?? "", 1)).toBe(false);
  });

  // A Combat Action: not offered in the planning phase; and with no enemy engaged with a player (one in the staging area only) it is not
  // offered at all, so Grimbold is not discarded for nothing.
  it("145004:A:1 Grimbold: offered only in the combat phase, and only with an enemy engaged with a player", () => {
    const tab = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }], allies: [{ code: GRIMBOLD, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(triggers(tab.state, tab)).not.toContain("145004:action:1");
    expect(triggers(combat(tab.state, tab).state, tab)).toContain("145004:action:1");
    const staged = table(EFFECTS, { heroes: [{ code: THEODRED, seat: 0 }], allies: [{ code: GRIMBOLD, seat: 0 }], staging: [WEAK] });
    const run = combat(staged.state, staged);
    expect(triggers(run.state, staged)).not.toContain("145004:action:1");
    expect(refusal(run.state, { type: "Trigger", cardId: idsOf(staged, GRIMBOLD), effectId: "145004:action:1" }, staged.ctx)).not.toBeNull();
  });
});

describe("Halbarad (145006:A:1, A:2)", () => {
  // Two enemies engaged with the first player, one with the other player, one in the staging area.
  function halbaradTable(effects: readonly Effect[]): Table {
    return table(effects, { seats: 2, heroes: [{ code: CORE_ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], hand: [{ code: HALBARAD, seat: 0 }], staging: [WEAK], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }, { code: WEAK, seat: 1 }] });
  }

  // "Reduce the cost to play Halbarad by 1 for each enemy engaged with you.": 4 - 2; the other player's enemy and the staging area's do not count.
  lineSpec("145006:A:1", "Halbarad: costs 1 less for each enemy engaged with you", (effects) => {
    const tab = halbaradTable(effects);
    const halbarad = idsOf(tab, HALBARAD);
    expect(playCost(tab.state, halbarad, 0, tab.ctx)).toBe(2);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: halbarad, payments: [{ heroId: idsOf(tab, CORE_ARAGORN), amount: 2 }] }, tab.ctx);
    expect(run.state.cards[halbarad]?.zone).toBe("play");
    expect(run.state.cards[idsOf(tab, CORE_ARAGORN)]?.resources).toBe(4);
  });

  // "Each enemy engaged with you gets +10 engagement cost.": once he is played, the two enemies engaged with his controller get +10; the
  // other player's enemy and the one in the staging area keep their printed engagement cost.
  lineSpec("145006:A:2", "Halbarad: each enemy engaged with you gets +10 engagement cost", (effects) => {
    const tab = halbaradTable(effects);
    const [staged, first, second, theirs] = tab.ids[WEAK] ?? [];
    const run = play(begin(tab.state), tab, idsOf(tab, HALBARAD));
    expect(stat(run.state, tab, first ?? "", "engagementCost")).toBe(40);
    expect(stat(run.state, tab, second ?? "", "engagementCost")).toBe(40);
    expect(stat(run.state, tab, theirs ?? "", "engagementCost")).toBe(30);
    expect(stat(run.state, tab, staged ?? "", "engagementCost")).toBe(30);
  });
});

describe("Ghân-buri-Ghân (145007:A:1)", () => {
  // "X is the Threat of the active location.": his Willpower is X, 2 with Green Hill Country (Threat 2) active and 0 with none.
  lineSpec("145007:A:1", "Ghân-buri-Ghân: his Willpower is the Threat of the active location", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GHAN, seat: 0 }], active: GREEN_HILL });
    expect(stat(tab.state, tab, idsOf(tab, GHAN), "willpower")).toBe(tab.ctx.cards.get(GREEN_HILL)?.threat);
    expect(tab.ctx.cards.get(GREEN_HILL)?.threat).toBeGreaterThan(0);
    const none = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }], allies: [{ code: GHAN, seat: 0 }] });
    expect(stat(none.state, none, idsOf(none, GHAN), "willpower")).toBe(0);
  });
});
