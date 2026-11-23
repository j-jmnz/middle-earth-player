// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.resource-match, rr.quest-phase (data/rules/entries.json).
// The Flame of the West attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Golden
// Shield 145010:A:1 and A:2, Livery of the Tower 145011:A:1, Roheryn 145012:A:1 and A:2, Banner of Elendil 145013:A:1 and A:2. The lines
// of 145011 and 145012 are the text of data/cards/FotW.json (data/printed/the-return-of-the-king.json holds no entry for them), so every
// intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf } from "../../../test/harness/scene.ts";
import { atDefense, combat, hosts, passAll, play, playerTableFor, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const ARAGORN = "145001";
const HALBARAD = "145006";
const SHIELD = "145010";
const LIVERY = "145011";
const ROHERYN = "145012";
const BANNER = "145013";
// Core Aragorn (Leadership, Dúnedain), Théodred (Rohan), Legolas (Tactics, not Rohan), Éowyn (Rohan, Willpower 4), Eleanor and Denethor (Gondor), Beravor (Dúnedain).
const CORE_ARAGORN = "01001";
const THEODRED = "01002";
const LEGOLAS = "01005";
const EOWYN = "01007";
const ELEANOR = "01008";
const DENETHOR = "01010";
const BERAVOR = "01012";
// Snowbourn Scout: a Rohan ally. Gondorian Spearman: a Gondor ally.
const SNOWBOURN = "01016";
const SPEARMAN = "01029";
// Citadel Plate: a Tactics attachment, "Attach to a hero. Restricted.", cost 4.
const PLATE = "01040";
const WEAK = "weak";
const PAL = "pal";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [ARAGORN, HALBARAD, SHIELD, LIVERY, ROHERYN, BANNER, CORE_ARAGORN, THEODRED, LEGOLAS, EOWYN, ELEANOR, DENETHOR, BERAVOR, SNOWBOURN, SPEARMAN, PLATE];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 30, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Golden Shield (145010:A:1, A:2)", () => {
  // "Attach to a Rohan hero.": Théodred and Éowyn (Rohan heroes) are offered; Legolas (the Tactics hero who pays) and the Snowbourn
  // Scout (a Rohan ally) are not.
  lineSpec("145010:A:1", "Golden Shield: Attach to a Rohan hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: THEODRED, seat: 0 }, { code: EOWYN, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: SNOWBOURN, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    expect(hosts(tab, shield)).toEqual([idsOf(tab, THEODRED), idsOf(tab, EOWYN)].sort());
    expect(play(begin(tab.state), tab, shield, idsOf(tab, EOWYN)).state.cards[shield]?.host).toBe(idsOf(tab, EOWYN));
  });

  // "Response: After attached hero is declared as a defender, exhaust Golden Shield to add attached hero's Willpower to its Defense for this
  // Théodred defends while Éowyn holds the Shield: no Response.
  it("145010:A:2 Golden Shield: not offered when another character defends", () => {
    const tab = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }, { code: THEODRED, seat: 0 }], attached: [{ code: SHIELD, host: EOWYN }], engaged: [{ code: WEAK, seat: 0 }] });
    let run = atDefense(tab);
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, THEODRED) }, tab.ctx);
    expect(triggers(run.state, tab)).not.toContain("145010:response:1");
  });

  // attack.": Éowyn (Willpower 4, Defense 1) defends the first of two attacks with the Shield: that attack strikes Defense 5 and the
  // Shield is exhausted. When the second enemy attacks, her Defense is 1 again.
  lineSpec("145010:A:2", "Golden Shield: after the hero is declared as a defender, exhaust it to add her Willpower to her Defense", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }], attached: [{ code: SHIELD, host: EOWYN }], engaged: [{ code: WEAK, seat: 0 }, { code: WEAK, seat: 0 }] });
    const [eowyn, shield, first] = [idsOf(tab, EOWYN), idsOf(tab, SHIELD), idsOf(tab, WEAK)];
    let run = passAll(combat(tab.state, tab), tab.ctx);
    // The player picks which engaged enemy attacks first.
    expect(run.state.window?.kind).toBe("chooseEnemy");
    run = passAll(sendUnledgered(run, { type: "ChooseEnemy", enemyId: first }, tab.ctx), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = sendUnledgered(run, { type: "DeclareDefender", defenderId: eowyn }, tab.ctx);
    expect(triggers(run.state, tab)).toContain("145010:response:1");
    const before = run.steps.length;
    run = passAll(sendUnledgered(run, { type: "Trigger", cardId: shield, effectId: "145010:response:1" }, tab.ctx), tab.ctx);
    expect(run.state.window?.kind).not.toBe("chooseEnemy");
    const strikes = run.steps.slice(before).filter((step) => step.kind === "strike" && step.side === "enemy");
    expect(strikes.map((step) => (step.kind === "strike" ? [step.targetId, step.defense] : []))).toEqual([[eowyn, 1 + 4]]);
    expect(run.state.window?.kind).toBe("defense");
    expect(run.state.cards[shield]?.exhausted).toBe(true);
    expect(stat(run.state, tab, eowyn, "defense")).toBe(1);
  });
});

describe("Livery of the Tower (145011:A:1)", () => {
  // "Attach to a Gondor hero.": Denethor and Eleanor (Gondor heroes) are offered; Théodred (Rohan hero) and the Gondorian Spearman (a Gondor ally) are not.
  lineSpec("145011:A:1", "Livery of the Tower: Attach to a Gondor hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: THEODRED, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: LIVERY, seat: 0 }] });
    const livery = idsOf(tab, LIVERY);
    expect(hosts(tab, livery)).toEqual([idsOf(tab, DENETHOR), idsOf(tab, ELEANOR)].sort());
    expect(play(begin(tab.state), tab, livery, idsOf(tab, ELEANOR)).state.cards[livery]?.host).toBe(idsOf(tab, ELEANOR));
  });
});

describe("Roheryn (145012:A:1, A:2)", () => {
  // "Attach to a Dúnedain hero.": Aragorn and Beravor (Dúnedain heroes) are offered; Denethor and Halbarad (a Dúnedain ally) are not.
  lineSpec("145012:A:1", "Roheryn: Attach to a Dúnedain hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: CORE_ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: HALBARAD, seat: 0 }], hand: [{ code: ROHERYN, seat: 0 }] });
    const roheryn = idsOf(tab, ROHERYN);
    expect(hosts(tab, roheryn)).toEqual([idsOf(tab, CORE_ARAGORN), idsOf(tab, BERAVOR)].sort());
    expect(play(begin(tab.state), tab, roheryn, idsOf(tab, BERAVOR)).state.cards[roheryn]?.host).toBe(idsOf(tab, BERAVOR));
  });

  // "If the attached hero is Aragorn, he gains a Tactics icon.": Aragorn (Fellowship) with Roheryn pays for Citadel Plate (Tactics) alone.
  lineSpec("145012:A:2", "Roheryn: Aragorn gains a Tactics icon and pays for a Tactics card", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: ROHERYN, seat: 0 }, { code: PLATE, seat: 0 }] });
    const [aragorn, plate] = [idsOf(tab, ARAGORN), idsOf(tab, PLATE)];
    const cost = tab.ctx.cards.get(PLATE)?.cost ?? 0;
    const intent = { type: "PlayCard" as const, cardId: plate, hostId: aragorn, payments: [{ heroId: aragorn, amount: cost }] };
    expect(refusal(tab.state, intent, tab.ctx)).not.toBeNull();
    // Roheryn is Leadership: Aragorn (Fellowship) cannot pay for it, so it is put on him directly.
    const state = syncConstants(attachTo(tab.state, idsOf(tab, ROHERYN), aragorn), tab.ctx);
    const run = sendUnledgered(begin(state), intent, tab.ctx);
    expect(run.state.cards[plate]?.host).toBe(aragorn);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - cost);
  });

  // On Beravor (not Aragorn) Roheryn gives no Tactics icon.
  it("145012:A:2 Roheryn: a hero not named Aragorn gains no Tactics icon", () => {
    const tab = table(EFFECTS, { heroes: [{ code: BERAVOR, seat: 0 }], attached: [{ code: ROHERYN, host: BERAVOR }], hand: [{ code: PLATE, seat: 0 }] });
    const [beravor, plate] = [idsOf(tab, BERAVOR), idsOf(tab, PLATE)];
    const cost = tab.ctx.cards.get(PLATE)?.cost ?? 0;
    expect(refusal(tab.state, { type: "PlayCard", cardId: plate, hostId: beravor, payments: [{ heroId: beravor, amount: cost }] }, tab.ctx)).not.toBeNull();
  });
});

describe("Banner of Elendil (145013:A:1, A:2)", () => {
  // "Attach to Aragorn.": the Fellowship Aragorn and the other player's core Aragorn are offered; Denethor and an ally are not.
  lineSpec("145013:A:1", "Banner of Elendil: Attach to Aragorn", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: CORE_ARAGORN, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: BANNER, seat: 0 }] });
    const banner = idsOf(tab, BANNER);
    expect(hosts(tab, banner)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, CORE_ARAGORN)].sort());
    expect(play(begin(tab.state), tab, banner, idsOf(tab, ARAGORN)).state.cards[banner]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // "While Aragorn is committed to the quest, each other questing character you control gets +1 Willpower.": Aragorn, Denethor and the ally
  // commit; Denethor and the ally get +1, Aragorn does not, and Éowyn, who stays back, does not.
  lineSpec("145013:A:2", "Banner of Elendil: while Aragorn quests, each other questing character you control gets +1 Willpower", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: BANNER, host: ARAGORN }], allies: [{ code: ALLY, seat: 0 }], deck: ["f0", "f0"] });
    const [aragorn, denethor, eowyn, ally] = [idsOf(tab, ARAGORN), idsOf(tab, DENETHOR), idsOf(tab, EOWYN), idsOf(tab, ALLY)];
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [aragorn, denethor, ally] }, tab.ctx);
    expect(run.state.cards[ally]?.committed).toBe(true);
    expect(stat(run.state, tab, denethor, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, ally, "willpower")).toBe(1 + 1);
    expect(stat(run.state, tab, aragorn, "willpower")).toBe(2);
    expect(stat(run.state, tab, eowyn, "willpower")).toBe(4);
  });

  // In a two-player game the other player's questing hero is not a character you control: it gets nothing.
  it("145013:A:2 Banner of Elendil: the other player's questing character gets no bonus", () => {
    const tab = table(EFFECTS, { seats: 2, start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: BANNER, host: ARAGORN }], deck: ["f0", "f0"] });
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, ARAGORN)] }, tab.ctx);
    // The first player passes the commit to the second.
    run = sendUnledgered(run, { type: "Pass" }, tab.ctx);
    expect(run.state.activeSeat).toBe(1);
    run = sendUnledgered(run, { type: "Commit", cardIds: [idsOf(tab, PAL)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.committed).toBe(true);
    expect(run.state.cards[idsOf(tab, PAL)]?.committed).toBe(true);
    expect(stat(run.state, tab, idsOf(tab, PAL), "willpower")).toBe(1);
  });

  // With Aragorn not committed, the characters that quest get nothing.
  it("145013:A:2 Banner of Elendil: no bonus while Aragorn is not committed", () => {
    const tab = table(EFFECTS, { start: "quest", heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: BANNER, host: ARAGORN }], deck: ["f0", "f0"] });
    const run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [idsOf(tab, DENETHOR)] }, tab.ctx);
    expect(run.state.cards[idsOf(tab, DENETHOR)]?.committed).toBe(true);
    expect(stat(run.state, tab, idsOf(tab, DENETHOR), "willpower")).toBe(1);
  });
});
