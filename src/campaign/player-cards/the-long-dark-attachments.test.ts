// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.travel-phase, rr.cost, rr.limits (data/rules/entries.json).
// The Long Dark attachments, each printed line tested from the words on the card (lineSpec, test/harness/line-spec.ts): Ring Mail 04080:A:1
// and A:2, Ever My Heart Rises 04082:A:1 and A:2, Love of Tales 04085:A:1 and A:2. The lines are the text of data/cards/TLD.json
// (data/printed holds no ledger for this pack), so every intent goes through sendUnledgered.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Run, type Scene, type Table } from "../../../test/harness/scene.ts";
import { choices, fillers, hosts, play, playerTable, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const MAIL = "04080";
const HEART = "04082";
const TALES = "04085";
// Song of Travel (The Hills of Emyn Muil): a Song attachment, neutral, cost 1.
const SONG = "02081";
// Core cards: Gimli (Dwarf hero, Tactics), Denethor and Beravor (Lore heroes), Eleanor (Spirit), Aragorn (Leadership), Round Shield
// ("Attach to a character. Restricted.").
const GIMLI = "01004";
const DENETHOR = "01010";
const BERAVOR = "01012";
const ELEANOR = "01008";
const ARAGORN = "01001";
const SHIELD = "19118";
// Hobbit hero with no text (scene.ts), Leadership; an ally with no text.
const PAL = "pal";
const ALLY = "ally";
// A Dwarf ally with no text, Tactics, cost 1.
const DWARF = "dwarf";
// An enemy no attack of these tests destroys.
const WALL = "wall";
// Locations with no text: a Mountain one, an Underground one, a plain one.
const PEAK = "peak";
const CAVE = "cave";
const FIELD = "field";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const codes = [MAIL, HEART, TALES, SONG, GIMLI, DENETHOR, BERAVOR, ELEANOR, ARAGORN, SHIELD];
  const cards = new Map([...starter.cards, ...(await loadPrinted(codes))]);
  cards.set(DWARF, definePrinted({ code: DWARF, name: "Dwarf", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2, traits: ["Dwarf"] }));
  cards.set(WALL, definePrinted({ code: WALL, name: "Wall", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 9, health: 99 }));
  cards.set(PEAK, definePrinted({ code: PEAK, name: "Peak", type: "location", traits: ["Mountain"], threat: 1, questPoints: 3 }));
  cards.set(CAVE, definePrinted({ code: CAVE, name: "Cave", type: "location", traits: ["Underground"], threat: 1, questPoints: 3 }));
  cards.set(FIELD, definePrinted({ code: FIELD, name: "Field", type: "location", traits: ["Plains"], threat: 1, questPoints: 3 }));
  base = { ...starter, cards };
});

describe("Ring Mail (04080:A:1, A:2)", () => {
  // "Attach to a Dwarf or Hobbit character.": Gimli (Dwarf hero), the Pal (Hobbit hero) and a Dwarf ally are offered; Aragorn and a plain
  // ally are not.
  lineSpec("04080:A:1", "Ring Mail: attach to a Dwarf or Hobbit character", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: DWARF, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: MAIL, seat: 0 }] });
    const mail = idsOf(tab, MAIL);
    expect(hosts(tab, mail)).toEqual([idsOf(tab, GIMLI), idsOf(tab, PAL), idsOf(tab, DWARF)].sort());
    expect(play(begin(tab.state), tab, mail, idsOf(tab, DWARF)).state.cards[mail]?.host).toBe(idsOf(tab, DWARF));
  });

  // "Attached character gets +1 hit point and +1 Defense.": played on Gimli, his hit points and Defense are 1 more in the state that intent
  // returns.
  lineSpec("04080:A:2", "Ring Mail: the attached character gets +1 hit point and +1 Defense", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }], hand: [{ code: MAIL, seat: 0 }] });
    const gimli = idsOf(tab, GIMLI);
    const run = play(begin(tab.state), tab, idsOf(tab, MAIL), gimli);
    expect(stat(run.state, tab, gimli, "hitPoints")).toBe(printed(tab, GIMLI, "health") + 1);
    expect(stat(run.state, tab, gimli, "defense")).toBe(printed(tab, GIMLI, "defense") + 1);
  });

  // "Restricted.": Ring Mail played on Gimli, who holds two Round Shields, is a third restricted attachment: the player picks one of the
  // three and it goes to the discard pile (rr.restricted).
  it("04080:A:1 Ring Mail: restricted, a third restricted attachment on Gimli sends one to the discard pile", () => {
    const tab = table(EFFECTS, { heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: SHIELD, host: GIMLI }, { code: SHIELD, host: GIMLI }], hand: [{ code: MAIL, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[SHIELD] ?? [];
    const mail = idsOf(tab, MAIL);
    let run = play(begin(tab.state), tab, mail, idsOf(tab, GIMLI));
    expect(run.state.window?.kind).toBe("choose");
    expect(choices(run.state, tab).sort()).toEqual([first, second, mail].sort());
    run = sendUnledgered(run, { type: "Choose", optionId: first }, tab.ctx);
    expect(run.state.cards[first]?.zone).toBe("discard");
    expect(run.state.cards[mail]?.host).toBe(idsOf(tab, GIMLI));
    expect(run.state.cards[second]?.host).toBe(idsOf(tab, GIMLI));
  });
});

describe("Ever My Heart Rises (04082:A:1, A:2)", () => {
  // "Attach a Dwarf character.": Gimli and a Dwarf ally are offered; the Pal (Hobbit), Eleanor (who pays) and a plain ally are not.
  lineSpec("04082:A:1", "Ever My Heart Rises: attach to a Dwarf character", (effects) => {
    const tab = table(effects, { heroes: [{ code: GIMLI, seat: 0 }, { code: PAL, seat: 0 }, { code: ELEANOR, seat: 0 }], allies: [{ code: DWARF, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: HEART, seat: 0 }] });
    const heart = idsOf(tab, HEART);
    expect(hosts(tab, heart)).toEqual([idsOf(tab, GIMLI), idsOf(tab, DWARF)].sort());
    expect(play(begin(tab.state), tab, heart, idsOf(tab, GIMLI)).state.cards[heart]?.host).toBe(idsOf(tab, GIMLI));
  });

  // The travel phase with `place` in the staging area; Gimli, who holds the card, is exhausted. The Wall engaged with the player stops the
  // game at its attack, before the refresh phase.
  function travel(effects: readonly Effect[], place: string): { tab: Table; run: Run; gimli: string } {
    const scene = table(effects, { start: "travel", heroes: [{ code: GIMLI, seat: 0 }], attached: [{ code: HEART, host: GIMLI }], staging: [place], engaged: [{ code: WALL, seat: 0 }] });
    const gimli = idsOf(scene, GIMLI);
    const tab = { ...scene, state: updateCard(scene.state, gimli, { exhausted: true }) };
    return { tab, gimli, run: sendUnledgered(begin(tab.state), { type: "Travel", locationId: idsOf(tab, place) }, tab.ctx) };
  }

  // "Response: After you travel to a Mountain or Underground location, ready attached character and reduce your threat by 1.": the player
  // travels to the Peak (Mountain), and to the Cave (Underground): Gimli is readied and the threat goes from 8 to 7.
  lineSpec("04082:A:2", "Ever My Heart Rises: after you travel to a Mountain or Underground location, ready the character and reduce your threat by 1", (effects) => {
    for (const place of [PEAK, CAVE]) {
      const { tab, run: travelled, gimli } = travel(effects, place);
      expect(travelled.state.activeLocation).toBe(idsOf(tab, place));
      expect(triggers(travelled.state, tab)).toContain("04082:response:1");
      const run = sendUnledgered(travelled, { type: "Trigger", cardId: idsOf(tab, HEART), effectId: "04082:response:1" }, tab.ctx);
      expect(run.state.cards[gimli]?.exhausted).toBe(false);
      // The game runs on to the next window: the Wall's attack in the combat phase, before the refresh phase readies anyone.
      expect(run.state.window?.kind).toBe("defense");
      expect(run.state.seats[0]?.threat).toBe(7);
    }
  });

  // A location with neither trait: no Response.
  it("04082:A:2 Ever My Heart Rises: not offered after travel to a location that is neither Mountain nor Underground", () => {
    const { tab, run } = travel(EFFECTS, FIELD);
    expect(run.state.activeLocation).toBe(idsOf(tab, FIELD));
    expect(triggers(run.state, tab)).not.toContain("04082:response:1");
  });
});

describe("Love of Tales (04085:A:1, A:2)", () => {
  // "Attach to a Lore hero. Limit 1 per hero.": Denethor and Beravor (Lore heroes) are offered, Aragorn and an ally are not; once it is on
  // Denethor, a second copy has only Beravor.
  lineSpec("04085:A:1", "Love of Tales: attach to a Lore hero, limit 1 per hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: DENETHOR, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: ARAGORN, seat: 0 }], allies: [{ code: ALLY, seat: 0 }], hand: fillers(TALES, 2) });
    const [first = "", second = ""] = tab.ids[TALES] ?? [];
    const denethor = idsOf(tab, DENETHOR);
    expect(hosts(tab, first)).toEqual([denethor, idsOf(tab, BERAVOR)].sort());
    const run = play(begin(tab.state), tab, first, denethor);
    expect(run.state.cards[first]?.host).toBe(denethor);
    expect(hosts(tab, second, run.state)).toEqual([idsOf(tab, BERAVOR)]);
  });

  // Love of Tales on Denethor; Song of Travel (a Song) and a plain attachment in hand; Aragorn pays.
  const tales = (effects: readonly Effect[], seats: 1 | 2 = 1): Table =>
    table(effects, { seats, heroes: [{ code: DENETHOR, seat: 0 }, { code: ARAGORN, seat: 0 }, ...(seats === 2 ? [{ code: PAL, seat: 1 }] : [])], attached: [{ code: TALES, host: DENETHOR }], hand: [{ code: SONG, seat: seats === 2 ? 1 : 0 }, { code: "plain", seat: 0 }] });

  // "Response: After a Song card is played, exhaust Love of Tales to add 1 resource to attached hero's resource pool.": Song of Travel is
  // played on Aragorn; Love of Tales is exhausted and Denethor has 1 resource more.
  lineSpec("04085:A:2", "Love of Tales: after a Song card is played, exhaust it to add 1 resource to the attached hero", (effects) => {
    const tab = tales(effects);
    const denethor = idsOf(tab, DENETHOR);
    let run = play(begin(tab.state), tab, idsOf(tab, SONG), idsOf(tab, ARAGORN));
    const before = run.state.cards[denethor]?.resources ?? 0;
    expect(triggers(run.state, tab)).toContain("04085:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: idsOf(tab, TALES), effectId: "04085:response:1" }, tab.ctx);
    expect(run.state.cards[idsOf(tab, TALES)]?.exhausted).toBe(true);
    expect(run.state.cards[denethor]?.resources).toBe(before + 1);
  });

  // "a Song card": any player's. The other player plays Song of Travel on his hero: the Response is offered.
  it("04085:A:2 Love of Tales: offered when another player plays a Song card", () => {
    const tab = tales(EFFECTS, 2);
    const song = idsOf(tab, SONG);
    // The second player's planning turn.
    const run = sendUnledgered(begin({ ...tab.state, planningSeat: 1, activeSeat: 1 }), { type: "PlayCard", cardId: song, hostId: idsOf(tab, PAL), payments: payFor(tab.state, tab.ctx, song, 1) }, tab.ctx);
    expect(run.state.cards[song]?.host).toBe(idsOf(tab, PAL));
    expect(triggers(run.state, tab)).toContain("04085:response:1");
  });

  // A card that is not a Song: no Response.
  it("04085:A:2 Love of Tales: not offered after a card that is not a Song is played", () => {
    const tab = tales(EFFECTS);
    const run = play(begin(tab.state), tab, idsOf(tab, "plain"), idsOf(tab, ARAGORN));
    expect(run.state.cards[idsOf(tab, "plain")]?.host).toBe(idsOf(tab, ARAGORN));
    expect(triggers(run.state, tab)).not.toContain("04085:response:1");
  });
});
