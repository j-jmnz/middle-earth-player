// Rules: rr.attachment-cards, rr.modifiers, rr.action, rr.response, rr.cost, rr.cancel, rr.shadow-effects, rr.triggered-ability,
// rr.resource-match, rr.ownership-and-control (data/rules/entries.json).
// The Conflict at the Carrock attachments, written from their card text (data/cards/CatC.json; data/printed holds no ledger for this pack,
// so the lines are the text of data/cards and every intent goes through sendUnledgered): Dúnedain Warning 02026:A:1, A:2 and A:3, Born
// Aloft 02029:A:1 and A:2, A Burning Brand 02033:A:1 and A:2, Song of Wisdom 02034:A:1 and A:2. Nor am I a Stranger is in
// conflict-at-the-carrock.test.ts, beside Éomund.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, combat, hosts, passAll, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const WARNING = "02026";
const ALOFT = "02029";
const BRAND = "02033";
const SONG = "02034";
// Core Aragorn and Théodred (Leadership heroes), Legolas (Tactics), Beravor (Lore), Gondorian Spearman (Tactics ally). The Black Rider
// (Attack 5), and Green Hill Country (Shadow: +1 Attack) for its shadow card.
const ARAGORN = "01001";
const THEODRED = "01002";
const LEGOLAS = "01005";
const BERAVOR = "01012";
const SPEARMAN = "01029";
const RIDER = "141039";
const GREEN_HILL = "141036";
const PAL = "pal";
const ALLY = "ally";
// A Lore ally with no text.
const LORE_ALLY = "lore-ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [WARNING, ALOFT, BRAND, SONG, ARAGORN, THEODRED, LEGOLAS, BERAVOR, SPEARMAN, RIDER, GREEN_HILL];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(LORE_ALLY, definePrinted({ code: LORE_ALLY, name: "Lore Ally", type: "ally", sphere: "lore", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  base = { ...starter, cards };
});

describe("Dúnedain Warning (02026:A:1, A:2, A:3)", () => {
  // "Attach to a hero.": Aragorn and the other player's hero are offered; the ally is not.
  lineSpec("02026:A:1", "Dúnedain Warning: attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: WARNING, seat: 0 }] });
    const warning = idsOf(tab, WARNING);
    expect(hosts(tab, warning)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, warning, idsOf(tab, ARAGORN)).state.cards[warning]?.host).toBe(idsOf(tab, ARAGORN));
  });

  // "Attached hero gains +1 Defense": played on Aragorn, his Defense is his printed 2 + 1.
  lineSpec("02026:A:2", "Dúnedain Warning: the attached hero gains +1 Defense", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: WARNING, seat: 0 }] });
    const aragorn = idsOf(tab, ARAGORN);
    const run = play(begin(tab.state), tab, idsOf(tab, WARNING), aragorn);
    expect(stat(run.state, tab, aragorn, "defense")).toBe(printed(tab, ARAGORN, "defense") + 1);
  });

  // "Action: Pay 1 resource from attached hero's pool to attach Dúnedain Warning to another hero.": on Aragorn, the Warning is moved to
  // Théodred for 1 of Aragorn's resources; the ally is not offered. The +1 Defense moves with it.
  lineSpec("02026:A:3", "Dúnedain Warning: pay 1 from the attached hero's pool to attach it to another hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], attached: [{ code: WARNING, host: ARAGORN }] });
    const [aragorn, theodred, warning] = [idsOf(tab, ARAGORN), idsOf(tab, THEODRED), idsOf(tab, WARNING)];
    expect(triggers(tab.state, tab)).toContain("02026:action:1");
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: warning, effectId: "02026:action:1", payments: [{ heroId: aragorn, amount: 1 }] }, tab.ctx);
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab)).toContain(theodred);
    expect(choices(run.state, tab)).not.toContain(idsOf(tab, ALLY));
    run = sendUnledgered(run, { type: "Choose", optionId: theodred }, tab.ctx);
    expect(run.state.cards[warning]?.host).toBe(theodred);
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 1);
    expect(stat(run.state, tab, theodred, "defense")).toBe(printed(tab, THEODRED, "defense") + 1);
    expect(stat(run.state, tab, aragorn, "defense")).toBe(printed(tab, ARAGORN, "defense"));
  });

  // FAULT: the card prints "attach Dúnedain Warning to another hero", and the engine offers the hero it is already on (Aragorn) as the hero
  // to attach it to.
  it.fails("02026:A:3 Dúnedain Warning: the hero it is attached to is not another hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }], attached: [{ code: WARNING, host: ARAGORN }] });
    const run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: idsOf(tab, WARNING), effectId: "02026:action:1", payments: [{ heroId: idsOf(tab, ARAGORN), amount: 1 }] }, tab.ctx);
    // Théodred is the only other hero, so no question is asked.
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[idsOf(tab, WARNING)]?.host).toBe(idsOf(tab, THEODRED));
  });

  // FAULT: alone on the table, Aragorn has no other hero to send the Warning to, so the Action can change nothing but its cost
  // (rr.triggered-ability), and the engine offers it.
  it.fails("02026:A:3 Dúnedain Warning: not offered with no other hero", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], attached: [{ code: WARNING, host: ARAGORN }] });
    expect(triggers(tab.state, tab)).not.toContain("02026:action:1");
  });

  // "from attached hero's pool": with no resource on Aragorn, Théodred's resources do not pay, and the Action is not offered.
  it("02026:A:3 Dúnedain Warning: not offered when the attached hero's pool is empty", () => {
    const placed = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: THEODRED, seat: 0 }], attached: [{ code: WARNING, host: ARAGORN }] });
    const tab = { ...placed, state: updateCard(placed.state, idsOf(placed, ARAGORN), { resources: 0 }) };
    expect(triggers(tab.state, tab)).not.toContain("02026:action:1");
  });

  // Any hero is another hero: in a two-player game the Warning goes to the other player's hero.
  it("02026:A:3 Dúnedain Warning: attaches to another player's hero", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], attached: [{ code: WARNING, host: ARAGORN }] });
    const [warning, pal] = [idsOf(tab, WARNING), idsOf(tab, PAL)];
    let run = sendUnledgered(begin(tab.state), { type: "Trigger", cardId: warning, effectId: "02026:action:1", payments: [{ heroId: idsOf(tab, ARAGORN), amount: 1 }] }, tab.ctx);
    expect(choices(run.state, tab)).toContain(pal);
    run = sendUnledgered(run, { type: "Choose", optionId: pal }, tab.ctx);
    expect(run.state.cards[warning]?.host).toBe(pal);
  });
});

describe("Born Aloft (02029:A:1, A:2)", () => {
  // "Attach to an ally.": the player's ally and the other player's ally are offered; the heroes are not. Legolas (Tactics) pays 0.
  lineSpec("02029:A:1", "Born Aloft: attach to an ally", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }, { code: SPEARMAN, seat: 1 }], hand: [{ code: ALOFT, seat: 0 }] });
    const aloft = idsOf(tab, ALOFT);
    expect(hosts(tab, aloft)).toEqual([idsOf(tab, ALLY), idsOf(tab, SPEARMAN)].sort());
    expect(play(begin(tab.state), tab, aloft, idsOf(tab, SPEARMAN)).state.cards[aloft]?.host).toBe(idsOf(tab, SPEARMAN));
  });

  // "Action: Discard Born Aloft from play to return attached ally to its owner's hand.": the ally goes back to the hand and Born Aloft to
  // the discard pile.
  lineSpec("02029:A:2", "Born Aloft: discard it to return the attached ally to its owner's hand", (effects) => {
    const placed = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: ALOFT, seat: 0 }] });
    const [ally, aloft] = [idsOf(placed, ALLY), idsOf(placed, ALOFT)];
    const played = play(begin(placed.state), placed, aloft, ally);
    expect(triggers(played.state, placed)).toContain("02029:action:1");
    const run = sendUnledgered(played, { type: "Trigger", cardId: aloft, effectId: "02029:action:1" }, placed.ctx);
    expect(run.state.cards[ally]?.zone).toBe("hand");
    expect(run.state.seats[0]?.hand).toEqual([ally]);
    expect(run.state.cards[aloft]?.zone).toBe("discard");
    expect(run.state.seats[0]?.discard).toEqual([aloft]);
  });

  // "its owner's hand": Born Aloft played on the other player's ally is his to control (rr.attachment-cards); when the first player passes
  // the planning phase, he discards it and the ally goes to his hand, Born Aloft to its owner's discard pile.
  it("02029:A:2 Born Aloft: another player's ally goes to its owner's hand", () => {
    const placed = table(EFFECTS, { seats: 2, heroes: [{ code: LEGOLAS, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: SPEARMAN, seat: 1 }], hand: [{ code: ALOFT, seat: 0 }] });
    const [spearman, aloft] = [idsOf(placed, SPEARMAN), idsOf(placed, ALOFT)];
    let run = play(begin(placed.state), placed, aloft, spearman);
    expect(run.state.cards[aloft]?.controller).toBe(1);
    run = sendUnledgered(run, { type: "Pass" }, placed.ctx);
    expect(run.state.activeSeat).toBe(1);
    expect(triggers(run.state, placed)).toContain("02029:action:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: aloft, effectId: "02029:action:1" }, placed.ctx);
    expect(run.state.seats[1]?.hand).toEqual([spearman]);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.seats[0]?.discard).toEqual([aloft]);
  });
});

describe("A Burning Brand (02033:A:1, A:2)", () => {
  // "Attach to a Lore character.": Beravor and the Lore ally are offered; Legolas (Tactics) and the Leadership ally are not. Beravor pays.
  lineSpec("02033:A:1", "A Burning Brand: attach to a Lore character", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: LORE_ALLY, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: BRAND, seat: 0 }] });
    const brand = idsOf(tab, BRAND);
    expect(hosts(tab, brand)).toEqual([idsOf(tab, BERAVOR), idsOf(tab, LORE_ALLY)].sort());
    expect(play(begin(tab.state), tab, brand, idsOf(tab, LORE_ALLY)).state.cards[brand]?.host).toBe(idsOf(tab, LORE_ALLY));
  });

  // The Black Rider attacks with Green Hill Country (Shadow: +1 Attack) as its shadow card; `defender` defends; Beravor holds the Brand.
  function defended(effects: readonly Effect[], defender: string): { tab: Table; run: Run } {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: BRAND, host: BERAVOR }], engaged: [{ code: RIDER, seat: 0 }], deck: [GREEN_HILL] });
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: idsOf(tab, defender) }, tab.ctx), tab.ctx);
    return { tab, run };
  }
  const strikes = (run: Run, from: number) => run.steps.slice(from).flatMap((step) => (step.kind === "strike" && step.side === "enemy" ? [step.attack] : []));

  // "Response: Exhaust A Burning Brand to cancel a shadow effect just triggered during an attack that attached character is defending.":
  // Beravor defends, the Brand is exhausted, and the Rider strikes with its printed Attack 5, not 6.
  lineSpec("02033:A:2", "A Burning Brand: exhaust it to cancel a shadow effect during an attack the attached character defends", (effects) => {
    const { tab, run: pending } = defended(effects, BERAVOR);
    const brand = idsOf(tab, BRAND);
    expect(triggers(pending.state, tab)).toContain("02033:response:1");
    const from = pending.steps.length;
    const run = passAll(sendUnledgered(pending, { type: "Trigger", cardId: brand, effectId: "02033:response:1" }, tab.ctx), tab.ctx, { responses: true });
    expect(run.state.cards[brand]?.exhausted).toBe(true);
    expect(strikes(run, from)).toEqual([printed(tab, RIDER, "attack")]);
  });

  // "an attack that attached character is defending": Legolas defends, the Brand offers no Response, and the Rider strikes for 5 + 1.
  it("02033:A:2 A Burning Brand: no Response while another character defends", () => {
    const { tab, run: pending } = defended(EFFECTS, LEGOLAS);
    expect(triggers(pending.state, tab)).not.toContain("02033:response:1");
    expect(strikes(passAll(pending, tab.ctx, { responses: true }), 0)).toEqual([printed(tab, RIDER, "attack") + 1]);
  });
});

describe("Song of Wisdom (02034:A:1, A:2)", () => {
  // "Attach to a hero.": Aragorn and the other player's hero are offered; the ally is not.
  lineSpec("02034:A:1", "Song of Wisdom: attach to a hero", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: ALLY, seat: 0 }], hand: [{ code: SONG, seat: 0 }] });
    const song = idsOf(tab, SONG);
    expect(hosts(tab, song)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, PAL)].sort());
    expect(play(begin(tab.state), tab, song, idsOf(tab, PAL)).state.cards[song]?.host).toBe(idsOf(tab, PAL));
  });

  // "Attached hero gains a Lore resource icon.": Aragorn (Leadership) cannot pay for the Lore ally; once the Song is played on him, his
  // resources pay for it.
  lineSpec("02034:A:2", "Song of Wisdom: the attached hero gains a Lore resource icon and pays for a Lore card", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: SONG, seat: 0 }, { code: LORE_ALLY, seat: 0 }] });
    const [aragorn, ally] = [idsOf(tab, ARAGORN), idsOf(tab, LORE_ALLY)];
    const intent = { type: "PlayCard" as const, cardId: ally, payments: [{ heroId: aragorn, amount: 1 }] };
    expect(refusal(tab.state, intent, tab.ctx)).not.toBeNull();
    let run = play(begin(tab.state), tab, idsOf(tab, SONG), aragorn);
    run = sendUnledgered(run, intent, tab.ctx);
    expect(run.state.cards[ally]?.zone).toBe("play");
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 1 - 1);
  });
});
