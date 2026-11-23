// Rules: rr.attachment-cards, rr.action, rr.cost, rr.resources, rr.drawing-cards, rr.traits, rr.gains (data/rules/entries.json).
// The Flight of the Stormcaller attachments, written from their card text (data/cards/FotS.json; data/printed holds no ledger for this pack yet):
// Rod of the Steward 12002:A:1 and A:2, In Service of the Steward 12003:A:1 and A:2.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { hasTrait } from "../../rules/interpret/conditions.ts";
import { payFor, refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf } from "../../../test/harness/scene.ts";
import { fillers, hosts, playerTableFor, sendUnledgered, triggers } from "../../../test/harness/player-table.ts";

const DENETHOR = "12001";
const ROD = "12002";
const SERVICE = "12003";
// Core cards: Glóin (Leadership, Dwarf), Eleanor (Spirit, Gondor), Guard of the Citadel (a Gondor ally).
const GLOIN = "01003";
const ELEANOR = "01008";
const GUARD = "01013";
const WEAK = "weak";
const CARD = "card";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([DENETHOR, ROD, SERVICE, GLOIN, ELEANOR, GUARD]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

describe("Rod of the Steward (12002:A:1, A:2)", () => {
  // "Attach to a Gondor hero.": Denethor and Eleanor are offered; Glóin (not Gondor) and the Guard of the Citadel (a Gondor ally) are not.
  lineSpec("12002:A:1", "goes on a Gondor hero only", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }, { code: GLOIN, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: ROD, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, ROD))).toEqual([idsOf(tab, DENETHOR), idsOf(tab, ELEANOR)].sort());
  });

  // "Action: Spend 2 resources from attached hero's resource pool to draw 1 card.": Denethor holds the Rod and 3 resources; Eleanor's pool is
  // not touched.
  lineSpec("12002:A:2", "spends 2 resources from the attached hero's pool to draw 1 card", (effects) => {
    const scene = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }], attached: [{ code: ROD, host: DENETHOR }], playerDeck: fillers(CARD, 3) }, 3);
    const [rod, denethor, eleanor] = [idsOf(scene, ROD), idsOf(scene, DENETHOR), idsOf(scene, ELEANOR)];
    // The cost is paid from the attached hero's pool only: Eleanor's resources are refused.
    expect(refusal(scene.state, { type: "Trigger", cardId: rod, effectId: "12002:action:1", payments: [{ heroId: eleanor, amount: 2 }] }, scene.ctx)).not.toBeNull();
    const run = sendUnledgered(begin(scene.state), { type: "Trigger", cardId: rod, effectId: "12002:action:1", payments: [{ heroId: denethor, amount: 2 }] }, scene.ctx);
    expect(run.state.cards[denethor]?.resources).toBe(1);
    expect(run.state.cards[eleanor]?.resources).toBe(3);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.deck).toHaveLength(2);
  });

  it("12002:A:2 is not offered while the attached hero holds fewer than 2 resources, whatever the other heroes hold", () => {
    const tab = table(EFFECTS, { heroes: [{ code: DENETHOR, seat: 0 }, { code: ELEANOR, seat: 0 }], attached: [{ code: ROD, host: DENETHOR }], playerDeck: fillers(CARD, 3) }, 5);
    expect(triggers(updateCard(tab.state, idsOf(tab, DENETHOR), { resources: 1 }), tab)).not.toContain("12002:action:1");
  });
});

describe("In Service of the Steward (12003:A:1, A:2)", () => {
  // "Attach to a character." The engine's default attach rule already admits a character and refuses an enemy, so the record changes nothing a
  // table shows and this is a plain test.
  it("12003:A:1 goes on a hero or an ally and not on an enemy", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GLOIN, seat: 0 }], allies: [{ code: GUARD, seat: 0 }], hand: [{ code: SERVICE, seat: 0 }], engaged: [{ code: WEAK, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, SERVICE))).toEqual([idsOf(tab, GLOIN), idsOf(tab, GUARD)].sort());
  });

  // "Attached character gains the Gondor trait.": played on Glóin, he is Gondor in the state the PlayCard intent returns, and the Rod of the
  // Steward (Gondor hero) can go on him.
  lineSpec("12003:A:2", "the attached character gains the Gondor trait", (effects) => {
    const tab = table(effects, { heroes: [{ code: GLOIN, seat: 0 }, { code: ELEANOR, seat: 0 }], hand: [{ code: SERVICE, seat: 0 }, { code: ROD, seat: 0 }] });
    const [gloin, service] = [idsOf(tab, GLOIN), idsOf(tab, SERVICE)];
    expect(hosts(tab, idsOf(tab, ROD))).not.toContain(gloin);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: service, hostId: gloin, payments: payFor(tab.state, tab.ctx, service) }, tab.ctx);
    expect(hasTrait(run.state, gloin, "Gondor", tab.ctx)).toBe(true);
    expect(hosts(tab, idsOf(tab, ROD), run.state)).toContain(gloin);
  });
});
