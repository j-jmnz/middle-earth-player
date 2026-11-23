// Rules: rr.in-play-and-out-of-play, dcce.campaign-setup-the-city-of-corsairs (data/rules/entries.json); ledger lines 50701:A:1, 12148:B:1, 19024:A:1, 51241:A:1, 51001:A:1, 40005:B:2 (docs/design-system-table.md, Reading panels).
// The Set aside list: the cards the players may read, the count of the facedown ones, and nothing else of those. Built with the scene kit, no game is played.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { idOf, idsOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { ASIDE_SECRETS } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard } from "../../rules/core/state.ts";
import { earlierStages } from "../cards/earlier-stages.ts";
import { ponyDials } from "../readouts/standalone-scenarios/pony.ts";
import { khazadDials } from "../readouts/standalone-scenarios/khazad.ts";
import { asideSorter, setAsideCount, setAsideFromKey, setAsideKey, setAsideList } from "./set-aside.ts";

const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const namesOf = (made: ReturnType<typeof tableFromLayout>, ids: readonly string[]) => ids.map((id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name);

describe("the Set aside list", () => {
  it("is empty, and the same object, while nothing is set aside", () => {
    const made = tableFromLayout("passage-through-mirkwood");
    expect(setAsideList(made.state, made.ctx)).toEqual({ cards: [], rows: [], facedown: 0 });
    expect(setAsideCount(made.state, made.ctx)).toBe(0);
    expect(setAsideList(made.state, made.ctx)).toBe(setAsideList({ ...made.state }, made.ctx));
  });

  it("names the cards the Setup set aside, by name and not in the order they were set aside, and keeps Durin's Bane's dial", () => {
    const made = tableFromLayout("escape-from-khazad-dum", { setAside: ["51311"] });
    const list = setAsideList(made.state, made.ctx);
    expect(list).toMatchObject({ cards: [idOf(made.state, "51311")], facedown: 0 });
    expect(khazadDials(made.state, made.ctx, nameOfIn(made)).find((dial) => dial.id === "bane")?.cardId).toBe(list.cards[0]);
    const heath = tableFromLayout("the-withered-heath", { setAside: ["19012", "19011", "12176"] });
    expect(namesOf(heath, setAsideList(heath.state, heath.ctx).cards)).toEqual(["Cold-Drake", "Dragon Sign", "Master of the Hunt"]);
  });

  it("returns its earlier result for the same game, and an equal key for a game that changes nothing the panel draws", () => {
    const made = tableFromLayout("the-withered-heath", { setAside: ["19011"] });
    const first = setAsideList(made.state, made.ctx);
    expect(setAsideList(made.state, made.ctx)).toBe(first);
    const other = { ...made.state, round: made.state.round + 1 };
    expect(setAsideList(other, made.ctx)).not.toBe(first);
    expect(setAsideKey(other, made.ctx)).toBe(setAsideKey(made.state, made.ctx));
    // 19024:A:1: the damage Cold-Drake keeps is on its row, and changes the key.
    const hurt = updateCard(made.state, idOf(made.state, "19011"), { damage: 3, keepsDamage: true });
    expect(setAsideList(hurt, made.ctx).rows).toEqual([{ id: idOf(hurt, "19011"), code: "19011", picture: "19011", kept: 3, count: 1 }]);
    expect(setAsideKey(hurt, made.ctx)).not.toBe(setAsideKey(made.state, made.ctx));
    expect(setAsideFromKey(setAsideKey(hurt, made.ctx))).toEqual({ rows: setAsideList(hurt, made.ctx).rows, facedown: 0, total: 1 });
  });

  it("puts the copies of one printed card on one row with their count, and a copy that keeps damage on its own row", () => {
    const made = tableFromLayout("foundations-of-stone", { setAside: ["04123", "04121", "04123", "04123", "04123"] });
    const list = setAsideList(made.state, made.ctx);
    expect(list.cards).toHaveLength(5);
    expect(list.rows.map((row) => [made.cards.get(row.code)?.name, row.count])).toEqual([["Deep Deep Dark", 4], ["Drowned Treasury", 1]]);
    expect(list.rows[0]?.id).toBe(list.cards[0]);
    expect(setAsideFromKey(setAsideKey(made.state, made.ctx)).total).toBe(5);
    const heath = tableFromLayout("the-withered-heath", { setAside: ["19011", "19011"] });
    const [, second] = idsOf(heath.state, "19011");
    const hurt = updateCard(heath.state, second ?? "", { damage: 15, keepsDamage: true });
    expect(setAsideList(hurt, heath.ctx).rows.map((row) => [row.kept, row.count])).toEqual([[0, 1], [15, 1]]);
  });

  it("leaves the defeated stages to the quest card's preview", () => {
    const made = tableFromLayout("passage-through-mirkwood", { stage: "01121" });
    expect(made.state.setAside.length).toBeGreaterThan(0);
    expect(earlierStages(made.state, made.ctx, made.state.questStage ?? "").length).toBeGreaterThan(0);
    expect(setAsideList(made.state, made.ctx)).toEqual({ cards: [], rows: [], facedown: 0 });
  });

  it("50701:A:1 counts the hidden Suspect and Hideout and names neither, whichever pair it is", () => {
    for (const pair of [["50710", "50705"], ["50713", "50704"]]) {
      const made = tableFromLayout("murder-at-the-prancing-pony", { piles: { investigationDeck: ["50709", "50706"] }, setAside: pair } as Layout);
      const list = setAsideList(made.state, made.ctx);
      // The list of one pair is the list of any other: nothing in it depends on which cards are hidden.
      expect(JSON.stringify(list)).toBe('{"cards":[],"rows":[],"facedown":2}');
      expect(setAsideKey(made.state, made.ctx)).toBe("2");
      expect(setAsideCount(made.state, made.ctx)).toBe(2);
      // The Investigation List still checks neither off.
      expect(ponyDials(made.state, nameOfIn(made))[0]?.value).toBe(0);
    }
  });

  it("dcce.campaign-setup-the-city-of-corsairs counts each Send for Help set aside facedown, beside the cards the Setup names", () => {
    const made = tableFromLayout("the-city-of-corsairs", { setAside: ["11211", "11213", "11214", "11210", "11216"] });
    const list = setAsideList(made.state, made.ctx);
    expect(namesOf(made, list.cards)).toEqual(["Gavin", "The Black Sword"]);
    expect(list.facedown).toBe(3);
  });

  it("40005:B:2 names the Gondorian Warships set aside by name: a random pick among copies of one card hides nothing", () => {
    const made = tableFromLayout("the-hunt-for-the-dreadnaught", { stage: "40005", setAside: ["40012", "40012", "40012", "40012"] });
    // The record that shuffles a random one in is in the game (its quest card is the stage).
    expect(JSON.stringify(made.ctx.effects.filter((effect) => effect.cardCode === "40005"))).toContain("ShuffleRandomSetAside");
    const list = setAsideList(made.state, made.ctx);
    expect(list.facedown).toBe(0);
    expect(list.rows.map((row) => [made.cards.get(row.code)?.name, row.count])).toEqual([["Gondorian Warship", 4]]);
  });

  // The game deals the campaign's reprint of a card in place of the first printing (data/scenarios, `reprints`): the codes the table knows.
  const corsairs = () => {
    const data = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../data/scenarios/the-city-of-corsairs.json"), "utf8")) as { cards: { code: string; pile: string }[] };
    const world = tableFromLayout("the-city-of-corsairs");
    const pile = (name: string) => data.cards.filter((card) => card.pile === name && world.cards.has(card.code)).map((card) => card.code);
    return { first: pile("encounter"), second: pile("encounterDeck2") };
  };

  it("names every card before The City of Corsairs sets its first deck aside: the second deck's set and the Setup's objectives wait there, named", () => {
    const { first, second } = corsairs();
    expect(first.length).toBeGreaterThan(10);
    expect(second.length).toBeGreaterThan(5);
    const made = tableFromLayout("the-city-of-corsairs", { deck: first, setAside: [...second, "11210", "11216"] });
    const list = setAsideList(made.state, made.ctx);
    expect(list.facedown).toBe(0);
    expect(list.cards.map((id) => made.state.cards[id]?.code).sort()).toEqual([...second, "11210", "11216"].sort());
  });

  it("12148:B:1 counts the first deck once the second has taken its place, Gavin with it, and names no card of it", () => {
    const { first, second } = corsairs();
    // The second deck's cards are in the encounter deck; the first deck lies set aside, and Gavin, an objective his own Action shuffled into it, with it.
    const made = tableFromLayout("the-city-of-corsairs", { deck: second, setAside: [...first, "11210", "11216", "11174"] });
    const list = setAsideList(made.state, made.ctx);
    expect(list.facedown).toBe(first.length + 1);
    // The Black Sword is a card of the open set and Enlarged Quarters a player card: neither was in the deck.
    expect(namesOf(made, list.cards)).toEqual(["Enlarged Quarters", "The Black Sword"]);
  });

  it("51241:A:1 counts a card Hidden Threat hid while it waits set aside for its reveal, in its own kit and in any other game", () => {
    // The kit kept the sets of Many-pillared Hall and Hidden Threat (their cards are in the deck); the set of Cobwebbed Cavern was left out.
    const kit = tableFromLayout("the-mines-of-moria", { deck: ["51241", "51213"], setAside: ["51214", "51231", "51231"] });
    expect(setAsideList(kit.state, kit.ctx)).toEqual({ cards: [], rows: [], facedown: 1 });
    const other = tableFromLayout("passage-through-mirkwood", { deck: ["51241"], setAside: ["01096"] }, { extra: ["51241"] });
    expect(setAsideList(other.state, other.ctx)).toEqual({ cards: [], rows: [], facedown: 1 });
  });

  it("51001:A:1 leaves out the cards of the encounter sets a kit's Quick-build did not keep, and still names the card the Setup set aside", () => {
    const made = tableFromLayout("escape-from-khazad-dum", { setAside: ["51311", "51312", "51312"] });
    expect(namesOf(made, setAsideList(made.state, made.ctx).cards)).toEqual(["Durin's Bane"]);
    expect(setAsideCount(made.state, made.ctx)).toBe(1);
  });

  it("lists no card a choice offers out of the collection and no card of a loot deck", () => {
    const made = tableFromLayout("escape-from-khazad-dum", { setAside: ["51311", "51311"] });
    const [bane, other] = idsOf(made.state, "51311");
    const offered = updateCard(made.state, other ?? "", { collection: "source" });
    expect(setAsideList(offered, made.ctx).cards).toEqual([bane]);
    expect(setAsideList({ ...made.state, lootDecks: [[other ?? ""]] }, made.ctx).cards).toEqual([bane]);
  });
});

describe("the verbs that hide a set-aside card", () => {
  it("each find a card to hide in the authored records, so a declaration that reads the wrong field fails here", () => {
    for (const secret of ASIDE_SECRETS) {
      const records = EFFECTS.filter((effect) => JSON.stringify(effect.instructions).includes(`"verb":"${secret.verb}"`));
      expect(records.length, `${secret.verb} has no authored record`).toBeGreaterThan(0);
      for (const record of records) {
        const text = JSON.stringify(record.instructions);
        for (const field of [...(secret.codes ?? []), ...(secret.names ?? [])]) expect(text, `${record.id} has no ${field}`).toContain(`"${field}":`);
        if (secret.openSets) expect(text, `${record.id} names no open set`).toContain(`"verb":"${secret.openSets.verb}"`);
      }
    }
  });

  it("hide nothing in a game that holds none of their cards", () => {
    const made = tableFromLayout("passage-through-mirkwood", { setAside: ["01096"] });
    const sort = asideSorter(made.state, made.ctx);
    expect(sort(made.cards.get("01096"), "01096")).toBe("open");
    // A card the table has no printing of is counted: it could not be named.
    expect(sort(undefined, "nope")).toBe("facedown");
  });
});
