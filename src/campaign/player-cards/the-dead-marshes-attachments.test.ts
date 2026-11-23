// Rules: rr.attachment-cards, rr.ranged, rr.resource-match, rr.action, rr.cost, rr.triggered-ability, rr.ready, rr.damage,
// rr.combat-phase (data/rules/entries.json).
// The Dead Marshes attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Dúnedain Cache
// 02097:A:1, A:2 and A:3, Song of Mocking 02099:A:1 and A:2, Fast Hitch 02103:A:1 and A:2, Song of Battle 02104:A:1 and A:2. The lines are
// the text of data/cards/TDM.json (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered. The other
// cards are in the-dead-marshes.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { hasKeyword } from "../../rules/core/keywords.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Table } from "../../../test/harness/scene.ts";
import { attacking, choices, combat, hosts, passAll, play, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const CACHE = "02097";
const MOCKING = "02099";
const HITCH = "02103";
const BATTLE = "02104";
// Core Aragorn (Leadership), Théodred (Leadership), Gimli (Tactics), Denethor (Lore); the Wandering Took (a Hobbit ally); Citadel Plate
// (Tactics, restricted, cost 4).
const ARAGORN = "01001";
const THEODRED = "01002";
const GIMLI = "01004";
const DENETHOR = "01010";
const TOOK = "01043";
const PLATE = "01040";
// The Pal (a Leadership Hobbit hero) and a plain Leadership ally, from the scene kit.
const PAL = "pal";
const ALLY = "ally";
// An enemy of Attack 2 and one of Attack 4, neither engaging by the engagement check.
const BRUTE = "brute";
const HAMMER = "hammer";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([CACHE, MOCKING, HITCH, BATTLE, ARAGORN, THEODRED, GIMLI, DENETHOR, TOOK, PLATE]))]);
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 50, attack: 2, defense: 0, health: 9 }));
  cards.set(HAMMER, definePrinted({ code: HAMMER, name: "Hammer", type: "enemy", threat: 1, engagementCost: 50, attack: 4, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Dúnedain Cache (02097:A:1, A:2, A:3)", () => {
  // Aragorn and Théodred for the first player with an ally, the Pal for the second; the Brute is engaged with the second player.
  const cache = (effects: readonly Effect[]): Table =>
    table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: CACHE, seat: 0 }], engaged: [{ code: BRUTE, seat: 1 }] });

  // "Attach to a hero.": the three heroes, the other player's too, are offered; the ally is not.
  lineSpec("02097:A:1", "Attach to a hero", (effects) => {
    const tab = cache(effects);
    const card = idsOf(tab, CACHE);
    expect(hosts(tab, card)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, THEODRED), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, ARAGORN)).state.cards[card]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // "Attached hero gains ranged.": Aragorn, with the Cache played on him, may attack the enemy engaged with the second player; Théodred
  // (no ranged) may not.
  lineSpec("02097:A:2", "the attached hero gains ranged", (effects) => {
    const tab = cache(effects);
    const aragorn = idsOf(tab, ARAGORN);
    const played = play(begin(tab.state), tab, idsOf(tab, CACHE), aragorn);
    expect(hasKeyword(played.state, aragorn, "ranged", tab.ctx.cards)).toBe(true);
    const state = attacking(played.state);
    expect(refusal(state, { type: "DeclareAttackers", enemyId: idsOf(tab, BRUTE), attackerIds: [idsOf(tab, THEODRED)] }, tab.ctx)).not.toBeNull();
    sendUnledgered(begin(state), { type: "DeclareAttackers", enemyId: idsOf(tab, BRUTE), attackerIds: [aragorn] }, tab.ctx);
  });

  // "Action: Pay 1 resource from attached hero's pool to attach Dúnedain Cache to another hero.": Aragorn pays 1 of his 6; Théodred and the
  // other player's Pal are offered (not Aragorn, not the ally); the Cache moves to the Pal, who gains ranged, and Aragorn loses it.
  lineSpec("02097:A:3", "pay 1 from the attached hero's pool to move it to another hero", (effects) => {
    const tab = cache(effects);
    const [card, aragorn, pal] = [idsOf(tab, CACHE), idsOf(tab, ARAGORN), idsOf(tab, PAL)];
    const played = play(begin(tab.state), tab, card, aragorn);
    const before = played.state.cards[aragorn]?.resources ?? 0;
    expect(triggers(played.state, tab)).toContain("02097:action:1");
    let run = sendUnledgered(played, { type: "Trigger", cardId: card, effectId: "02097:action:1", payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[aragorn]?.resources).toBe(before - 1);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, THEODRED), pal].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[card]?.host).toBe(pal);
    expect(hasKeyword(run.state, pal, "ranged", tab.ctx.cards)).toBe(true);
    expect(hasKeyword(run.state, aragorn, "ranged", tab.ctx.cards)).toBe(false);
  });

  // "from attached hero's pool": with Aragorn's pool empty it is not offered, and Théodred cannot pay for him.
  it("02097:A:3 only the attached hero's pool pays", () => {
    const tab = cache(EFFECTS);
    const [card, aragorn] = [idsOf(tab, CACHE), idsOf(tab, ARAGORN)];
    const played = play(begin(tab.state), tab, card, aragorn);
    const empty = updateCard(played.state, aragorn, { resources: 0 });
    expect(triggers(empty, tab)).not.toContain("02097:action:1");
    expect(refusal(empty, { type: "Trigger", cardId: card, effectId: "02097:action:1", payments: [{ heroId: idsOf(tab, THEODRED), amount: 1 }] }, tab.ctx)).not.toBeNull();
  });
});

describe("Song of Mocking (02099:A:1, A:2)", () => {
  // "Attach to a hero.": Aragorn and Gimli (Tactics, who pays) are offered; the ally is not.
  lineSpec("02099:A:1", "Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: MOCKING, seat: 0 }] });
    const card = idsOf(tab, MOCKING);
    expect(hosts(tab, card)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, GIMLI)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, ARAGORN)).state.cards[card]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // Aragorn holds the Song; Théodred and Gimli are the other heroes, the Hammer (Attack 4) is engaged. The combat phase begins.
  function mocking(effects: readonly Effect[]): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: MOCKING, host: ARAGORN }], engaged: [{ code: HAMMER, seat: 0 }] });
    const song = idsOf(tab, MOCKING);
    const run = combat(tab.state, tab);
    expect(triggers(run.state, tab)).toContain("02099:action:1");
    return { tab, run: sendUnledgered(run, { type: "Trigger", cardId: song, effectId: "02099:action:1" }, tab.ctx) };
  }

  // "Action: Exhaust Song of Mocking to choose another hero. Until the end of the phase, attached hero takes all damage assigned to the
  // chosen hero.": the Song exhausts and Théodred is chosen. Théodred (Defense 1) defends the Hammer's attack (4): the 3 damage goes to
  // Aragorn, none to Théodred.
  lineSpec("02099:A:2", "exhaust it so the attached hero takes the damage assigned to the chosen hero", (effects) => {
    const { tab, run: asked } = mocking(effects);
    const [aragorn, theodred] = [idsOf(tab, ARAGORN), idsOf(tab, THEODRED)];
    expect(asked.state.cards[idsOf(tab, MOCKING)]?.exhausted).toBe(true);
    expect(asked.state.window?.kind).toBe("choose");
    expect(choices(asked.state, tab)).toContain(theodred);
    let run = passAll(sendUnledgered(asked, { type: "Choose", optionId: theodred }, tab.ctx), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: theodred }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[theodred]?.damage).toBe(0);
    expect(run.state.cards[aragorn]?.damage).toBe(4 - 1);
  });

  lineSpec("02099:A:2", "the attached hero is not a choice (another hero)", (effects) => {
    const { tab, run } = mocking(effects);
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, THEODRED), idsOf(tab, GIMLI)].sort());
  });
});

describe("Fast Hitch (02103:A:1, A:2)", () => {
  // "Attach to a Hobbit character.": the Pal (a Hobbit hero) and the Wandering Took (a Hobbit ally) are offered; Denethor (Lore, who pays)
  // and the plain ally are not.
  lineSpec("02103:A:1", "Attach to a Hobbit character", (effects) => {
    const tab = table(effects, { heroes: [{ code: PAL, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: TOOK, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HITCH, seat: 0 }] });
    const card = idsOf(tab, HITCH);
    expect(hosts(tab, card)).toEqual([idsOf(tab, PAL), idsOf(tab, TOOK)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, TOOK)).state.cards[card]?.host).toBe(idsOf(tab, TOOK));
  });

  // "Action: Exhaust Fast Hitch to ready attached character.": the exhausted Pal readies and the Hitch is exhausted.
  lineSpec("02103:A:2", "exhaust it to ready the attached character", (effects) => {
    const start = table(effects, { heroes: [{ code: PAL, seat: 0 }], attached: [{ code: HITCH, host: PAL }] });
    const [pal, hitch] = [idsOf(start, PAL), idsOf(start, HITCH)];
    const tab = { ...start, state: updateCard(start.state, pal, { exhausted: true }) };
    expect(triggers(tab.state, tab)).toContain("02103:action:1");
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: hitch, effectId: "02103:action:1" }, tab.ctx);
    expect(run.state.cards[pal]?.exhausted).toBe(false);
    expect(run.state.cards[hitch]?.exhausted).toBe(true);
  });

  // The Pal is ready: nothing to ready, so it is not offered.
  it("02103:A:2 is not offered while the attached character is ready", () => {
    const tab = table(EFFECTS, { heroes: [{ code: PAL, seat: 0 }], attached: [{ code: HITCH, host: PAL }] });
    expect(triggers(tab.state, tab)).not.toContain("02103:action:1");
  });
});

describe("Song of Battle (02104:A:1, A:2)", () => {
  // "Attach to a hero.": Aragorn and Denethor are offered; the ally is not.
  lineSpec("02104:A:1", "Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: BATTLE, seat: 0 }] });
    const card = idsOf(tab, BATTLE);
    expect(hosts(tab, card)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, DENETHOR)].sort());
    expect(play(begin(tab.state), tab, card, idsOf(tab, DENETHOR)).state.cards[card]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Attached hero gains a Tactics resource icon.": Aragorn alone cannot pay for Citadel Plate (Tactics); once the Song is played on him
  // he pays its 4. Denethor, without the Song, still cannot.
  lineSpec("02104:A:2", "the attached hero gains a Tactics resource icon", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: BATTLE, seat: 0 }, { code: PLATE, seat: 0 }] });
    const [aragorn, denethor, plate] = [idsOf(tab, ARAGORN), idsOf(tab, DENETHOR), idsOf(tab, PLATE)];
    const by = (heroId: string) => ({ type: "PlayCard" as const, cardId: plate, hostId: aragorn, payments: [{ heroId, amount: 4 }] });
    expect(refusal(tab.state, by(aragorn), tab.ctx)).not.toBeNull();
    const sung = play(begin(tab.state), tab, idsOf(tab, BATTLE), aragorn);
    expect(refusal(sung.state, by(denethor), tab.ctx)).not.toBeNull();
    const run = sendUnledgered(sung, by(aragorn), tab.ctx);
    expect(run.state.cards[plate]?.host).toBe(aragorn);
  });
});
