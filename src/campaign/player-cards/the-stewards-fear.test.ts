// Rules: rr.resource-match, rr.modifiers, rr.attachment-cards, rr.restricted, rr.hit-points, rr.action, rr.cost, rr.printed, rr.drawing-cards,
// rr.triggered-ability (data/rules/entries.json).
// The Steward's Fear player cards, each line tested from the words on the card: Hirluin the Fair 06001:A:2, Warrior of Lossarnach 06002:A:1,
// Gaining Strength 06003:A:1, Knights of the Swan 06004:A:1, Gondorian Shield 06005:A:1, A:2 and A:3, Ethir Swordsman 06006:A:1, Ring of
// Barahir 06007:A:1, A:2 and A:3, Anfalas Herdsman 06008:A:1, Mithrandir's Advice 06009:A:1. The lines are the text of data/cards/TSF.json
// (data/printed holds no entry for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { refusal, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { canPlay, choices, fillers, hosts, play, playCode, playerTableFor, printed, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const HIRLUIN = "06001";
const LOSSARNACH = "06002";
const GAINING = "06003";
const KNIGHTS = "06004";
const SHIELD = "06005";
const ETHIR = "06006";
const BARAHIR = "06007";
const ANFALAS = "06008";
const ADVICE = "06009";
// The Red Arrow: a Tactics Artifact attachment for a Gondor hero (Beneath the Sands).
const ARROW = "17058";
// Core: Aragorn (Leadership, Dúnedain Ranger), Legolas (Tactics Silvan), Éowyn (Spirit Rohan), Denethor (Lore Gondor), Beravor (Lore
// Dúnedain), the Gondorian Spearman (a Tactics Gondor ally, not Outlands).
const ARAGORN = "01001";
const LEGOLAS = "01005";
const EOWYN = "01007";
const DENETHOR = "01010";
const BERAVOR = "01012";
const SPEARMAN = "01029";
const PAL = "pal";
// A Lore hero with no text, for the other seat.
const SAGE = "sage";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [HIRLUIN, LOSSARNACH, GAINING, KNIGHTS, SHIELD, ETHIR, BARAHIR, ANFALAS, ADVICE, ARROW, ARAGORN, LEGOLAS, EOWYN, DENETHOR, BERAVOR, SPEARMAN];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(SAGE, definePrinted({ code: SAGE, name: "Sage", type: "hero", sphere: "lore", threat: 8, willpower: 1, attack: 1, defense: 1, health: 3 }));
  base = { ...starter, cards };
});

// Whether the engine offers to play the card `cardId` from hand.

describe("Hirluin the Fair (06001:A:2)", () => {
  // "You may use resources from Hirluin the Fair's resource pool to pay for Outlands ally cards of any sphere.": Hirluin (Leadership) pays
  // alone for the Knights of the Swan (a Tactics Outlands ally, cost 1).
  lineSpec("06001:A:2", "Hirluin pays for an Outlands ally of another sphere", (effects) => {
    const tab = table(effects, { heroes: [{ code: HIRLUIN, seat: 0 }], hand: [{ code: KNIGHTS, seat: 0 }] });
    const [hirluin, knights] = [idsOf(tab, HIRLUIN), idsOf(tab, KNIGHTS)];
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: knights, payments: [{ heroId: hirluin, amount: 1 }] }, tab.ctx);
    expect(run.state.cards[knights]?.zone).toBe("play");
    expect(run.state.cards[hirluin]?.resources).toBe(6 - 1);
  });

  // "Outlands ally cards": the Gondorian Spearman (a Tactics ally, not Outlands) cannot be paid from his pool.
  it("06001:A:2 Hirluin does not pay for a Tactics ally that is not Outlands", () => {
    const tab = table(EFFECTS, { heroes: [{ code: HIRLUIN, seat: 0 }], hand: [{ code: SPEARMAN, seat: 0 }] });
    expect(refusal(tab.state, { type: "PlayCard", cardId: idsOf(tab, SPEARMAN), payments: [{ heroId: idsOf(tab, HIRLUIN), amount: 2 }] }, tab.ctx)).not.toBeNull();
  });
});

describe("The Outlands allies (06002:A:1, 06004:A:1, 06006:A:1, 06008:A:1)", () => {
  // Hirluin (an Outlands hero) and `payer`; the ally `code` is in hand. The other player controls the Anfalas Herdsman or the Knights of the
  // Swan (an Outlands ally) and the Pal.
  function outlands(effects: readonly Effect[], code: string, payer: string): Table {
    const other = code === ANFALAS ? KNIGHTS : ANFALAS;
    return table(effects, { seats: 2, heroes: [{ code: HIRLUIN, seat: 0 }, { code: payer, seat: 0 }, { code: PAL, seat: 1 }], allies: [{ code: other, seat: 1 }], hand: [{ code, seat: 0 }] });
  }

  const rows = [
    ["06002:A:1", "Warrior of Lossarnach", LOSSARNACH, ARAGORN, "defense", "defense"],
    ["06004:A:1", "Knights of the Swan", KNIGHTS, LEGOLAS, "attack", "attack"],
    ["06006:A:1", "Ethir Swordsman", ETHIR, EOWYN, "willpower", "willpower"],
    ["06008:A:1", "Anfalas Herdsman", ANFALAS, BERAVOR, "hitPoints", "health"],
  ] as const;

  // "Each Outlands character you control gets +1 <stat>.": the ally is played from hand; Hirluin and the ally itself (Outlands characters
  // you control) get +1, the hero who paid (not Outlands) does not, and the other player's Outlands ally does not.
  for (const [line, name, code, payer, which, field] of rows) {
    lineSpec(line, `${name}: each Outlands character you control gets +1 ${which}`, (effects) => {
      const tab = outlands(effects, code, payer);
      const other = idsOf(tab, code === ANFALAS ? KNIGHTS : ANFALAS);
      const run = playCode(tab, code);
      const ally = tab.ids[code]?.find((id) => run.state.cards[id]?.controller === 0) ?? "";
      expect(run.state.cards[ally]?.zone).toBe("play");
      expect(stat(run.state, tab, idsOf(tab, HIRLUIN), which)).toBe(printed(tab, HIRLUIN, field) + 1);
      expect(stat(run.state, tab, ally, which)).toBe(printed(tab, code, field) + 1);
      expect(stat(run.state, tab, idsOf(tab, payer), which)).toBe(printed(tab, payer, field));
      expect(stat(run.state, tab, other, which)).toBe(printed(tab, code === ANFALAS ? KNIGHTS : ANFALAS, field));
    });
  }
});

describe("Gaining Strength (06003:A:1)", () => {
  // "Action: Discard 2 resources from your hero's resource pool to add 3 resources to that hero's resource pool.": Aragorn holds 2, Beravor
  // 1, and the other player's hero 3. Aragorn is the only hero of yours with 2: he is taken without a question, ends with 3, and the
  // others keep theirs.
  lineSpec("06003:A:1", "discards 2 resources from your hero's pool to add 3 to it", (effects) => {
    const placed = table(effects, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: SAGE, seat: 1 }], hand: [{ code: GAINING, seat: 0 }] }, 2);
    const [aragorn, beravor, sage] = [idsOf(placed, ARAGORN), idsOf(placed, BERAVOR), idsOf(placed, SAGE)];
    const tab = { ...placed, state: updateCard(updateCard(placed.state, beravor, { resources: 1 }), sage, { resources: 3 }) };
    const run = play(begin(tab.state), tab, idsOf(tab, GAINING));
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.cards[aragorn]?.resources).toBe(2 - 2 + 3);
    expect(run.state.cards[beravor]?.resources).toBe(1);
    expect(run.state.cards[sage]?.resources).toBe(3);
  });

  // "your hero": with two heroes of yours holding 2, the player chooses between them; the other player's hero is not offered.
  it("06003:A:1 offers each hero of yours with 2 resources, and no other player's hero", () => {
    const tab = table(EFFECTS, { seats: 2, heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: SAGE, seat: 1 }], hand: [{ code: GAINING, seat: 0 }] }, 2);
    let run = play(begin(tab.state), tab, idsOf(tab, GAINING));
    expect(choices(run.state, tab).sort()).toEqual([idsOf(tab, ARAGORN), idsOf(tab, BERAVOR)].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: idsOf(tab, BERAVOR) }, tab.ctx);
    expect(run.state.cards[idsOf(tab, BERAVOR)]?.resources).toBe(3);
    expect(run.state.cards[idsOf(tab, ARAGORN)]?.resources).toBe(2);
  });

  // No hero of yours holds 2 resources: the cost cannot be paid, so the event is not offered.
  it("06003:A:1 is not offered when no hero of yours holds 2 resources", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }], hand: [{ code: GAINING, seat: 0 }] }, 1);
    expect(canPlay(tab.state, tab, idsOf(tab, GAINING))).toBe(false);
  });
});

describe("Gondorian Shield (06005:A:1, A:2, A:3)", () => {
  // "Attach to a hero. Restricted.": Legolas (who pays) and Denethor are offered; the Gondorian Spearman (an ally) is not.
  lineSpec("06005:A:1", "Gondorian Shield: Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }] });
    const shield = idsOf(tab, SHIELD);
    expect(hosts(tab, shield)).toEqual([idsOf(tab, LEGOLAS), idsOf(tab, DENETHOR)].sort());
    expect(play(begin(tab.state), tab, shield, idsOf(tab, DENETHOR)).state.cards[shield]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Limit 1 per hero.": Denethor already holds a Shield, so the second one is offered only for Legolas.
  lineSpec("06005:A:2", "Gondorian Shield: Limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: SHIELD, host: DENETHOR }], hand: [{ code: SHIELD, seat: 0 }] });
    const second = tab.ids[SHIELD]?.[1] ?? "";
    expect(tab.state.cards[second]?.zone).toBe("hand");
    expect(hosts(tab, second)).toEqual([idsOf(tab, LEGOLAS)]);
  });

  // "Attached hero gains +1 Defense. (+2 Defense instead if attached hero has the Gondor trait.)": played on Legolas, +1; played on
  // Denethor (Gondor), +2 and not +3.
  lineSpec("06005:A:3", "Gondorian Shield: +1 Defense, +2 instead on a Gondor hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: SHIELD, seat: 0 }, { code: SHIELD, seat: 0 }] });
    const [legolas, denethor] = [idsOf(tab, LEGOLAS), idsOf(tab, DENETHOR)];
    const [first = "", second = ""] = tab.ids[SHIELD] ?? [];
    let run = play(begin(tab.state), tab, first, legolas);
    expect(stat(run.state, tab, legolas, "defense")).toBe(printed(tab, LEGOLAS, "defense") + 1);
    expect(stat(run.state, tab, denethor, "defense")).toBe(printed(tab, DENETHOR, "defense"));
    run = play(run, tab, second, denethor);
    expect(stat(run.state, tab, denethor, "defense")).toBe(printed(tab, DENETHOR, "defense") + 2);
  });
});

describe("Ring of Barahir (06007:A:1, A:2, A:3)", () => {
  // "Attach to a hero.": Éowyn (who pays) and Denethor are offered; the Gondorian Spearman (an ally) is not.
  lineSpec("06007:A:1", "Ring of Barahir: Attach to a hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], allies: [{ code: SPEARMAN, seat: 0 }], hand: [{ code: BARAHIR, seat: 0 }] });
    const ring = idsOf(tab, BARAHIR);
    expect(hosts(tab, ring)).toEqual([idsOf(tab, EOWYN), idsOf(tab, DENETHOR)].sort());
    expect(play(begin(tab.state), tab, ring, idsOf(tab, DENETHOR)).state.cards[ring]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Attached hero gets +1 hit point for each Artifact attachment attached to it.": the Ring (an Artifact) played on Éowyn gives +1. On
  // Denethor, who holds The Red Arrow (an Artifact) and a Gondorian Shield (not an Artifact), it gives +2.
  lineSpec("06007:A:2", "Ring of Barahir: +1 hit point for each Artifact attachment on the hero", (effects) => {
    const one = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], hand: [{ code: BARAHIR, seat: 0 }] });
    const alone = play(begin(one.state), one, idsOf(one, BARAHIR), idsOf(one, EOWYN));
    expect(stat(alone.state, one, idsOf(one, EOWYN), "hitPoints")).toBe(printed(one, EOWYN, "health") + 1);
    const two = table(effects, { heroes: [{ code: EOWYN, seat: 0 }, { code: DENETHOR, seat: 0 }], attached: [{ code: ARROW, host: DENETHOR }, { code: SHIELD, host: DENETHOR }], hand: [{ code: BARAHIR, seat: 0 }] });
    const denethor = idsOf(two, DENETHOR);
    const run = play(begin(two.state), two, idsOf(two, BARAHIR), denethor);
    expect(stat(run.state, two, denethor, "hitPoints")).toBe(printed(two, DENETHOR, "health") + 2);
    expect(stat(run.state, two, idsOf(two, EOWYN), "hitPoints")).toBe(printed(two, EOWYN, "health"));
  });

  // "If attached hero is Aragorn, he also gains a Lore resource icon.": Aragorn (Leadership) with the Ring pays alone for the Anfalas
  // Herdsman (Lore, cost 1).
  lineSpec("06007:A:3", "Ring of Barahir: Aragorn gains a Lore icon and pays for a Lore card", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }], hand: [{ code: BARAHIR, seat: 0 }, { code: ANFALAS, seat: 0 }] });
    const [aragorn, herdsman] = [idsOf(tab, ARAGORN), idsOf(tab, ANFALAS)];
    const byAragorn = { type: "PlayCard", cardId: herdsman, payments: [{ heroId: aragorn, amount: 1 }] } as const;
    expect(refusal(tab.state, byAragorn, tab.ctx)).not.toBeNull();
    let run = play(begin(tab.state), tab, idsOf(tab, BARAHIR), aragorn);
    run = sendUnledgered(run, byAragorn, tab.ctx);
    expect(run.state.cards[herdsman]?.zone).toBe("play");
    expect(run.state.cards[aragorn]?.resources).toBe(6 - 1);
  });

  // "If attached hero is Aragorn": Éowyn with the Ring gains no Lore icon.
  it("06007:A:3 Ring of Barahir: a hero not named Aragorn gains no Lore icon", () => {
    const placed = table(EFFECTS, { heroes: [{ code: EOWYN, seat: 0 }, { code: ARAGORN, seat: 0 }], attached: [{ code: BARAHIR, host: EOWYN }], hand: [{ code: ANFALAS, seat: 0 }] });
    expect(placed.state.cards[idsOf(placed, BARAHIR)]?.host).toBe(idsOf(placed, EOWYN));
    expect(refusal(placed.state, { type: "PlayCard", cardId: idsOf(placed, ANFALAS), payments: [{ heroId: idsOf(placed, EOWYN), amount: 1 }] }, placed.ctx)).not.toBeNull();
  });
});

describe("Mithrandir's Advice (06009:A:1)", () => {
  // "Action: Draw 1 card for each hero you control with a printed Lore resource icon.": Beravor and Denethor (printed Lore) count; Aragorn
  // with the Ring of Barahir (a Lore icon gained, not printed) does not, nor does the other player's Lore hero. 2 cards of the 5 are drawn.
  lineSpec("06009:A:1", "draws 1 card for each hero you control with a printed Lore icon", (effects) => {
    const tab = table(effects, { seats: 2, heroes: [{ code: BERAVOR, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }, { code: SAGE, seat: 1 }], attached: [{ code: BARAHIR, host: ARAGORN }], hand: [{ code: ADVICE, seat: 0 }], playerDeck: fillers("card", 5) });
    const hand = tab.state.seats[0]?.hand.length ?? 0;
    const run = playCode(tab, ADVICE);
    expect(run.state.seats[0]?.hand).toHaveLength(hand - 1 + 2);
    expect(run.state.seats[0]?.deck).toHaveLength(3);
  });

  // No hero of yours has a printed Lore icon: the event would change nothing, so it is not offered (rr.triggered-ability). Aragorn with the
  // Ring of Barahir pays for it, but his gained icon is not printed.
  it("06009:A:1 is not offered without a hero with a printed Lore icon", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }, { code: EOWYN, seat: 0 }], attached: [{ code: BARAHIR, host: ARAGORN }], hand: [{ code: ADVICE, seat: 0 }], playerDeck: fillers("card", 5) });
    expect(canPlay(tab.state, tab, idsOf(tab, ADVICE))).toBe(false);
  });
});
