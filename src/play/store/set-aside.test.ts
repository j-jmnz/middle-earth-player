// Rules: rr.in-play-and-out-of-play, dcce.campaign-setup-the-city-of-corsairs (data/rules/entries.json); ledger lines 50701:A:1, 12148:B:1, 19024:A:1 (docs/design-system-table.md, Reading panels).
// The Set aside list: the cards the players may read, the count of the facedown ones, and nothing else of those. Built with the scene kit, no game is played.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { idOf, idsOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { ASIDE_SECRETS } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { updateCard } from "../../rules/core/state.ts";
import { keptDamageWords } from "../cards/dungeon-preview.ts";
import { earlierStages } from "../cards/earlier-stages.ts";
import { ponyDials } from "../readouts/standalone-scenarios/pony.ts";
import { khazadDials } from "../readouts/standalone-scenarios/khazad.ts";
import { secretAside, setAsideCount, setAsideList } from "./set-aside.ts";

const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const namesOf = (made: ReturnType<typeof tableFromLayout>, ids: readonly string[]) => ids.map((id) => made.cards.get(made.state.cards[id]?.code ?? "")?.name);

describe("the Set aside list", () => {
  it("is empty, and the same object, while nothing is set aside", () => {
    const made = tableFromLayout("passage-through-mirkwood");
    expect(setAsideList(made.state, made.ctx)).toEqual({ cards: [], facedown: 0 });
    expect(setAsideCount(made.state, made.ctx)).toBe(0);
    expect(setAsideList(made.state, made.ctx)).toBe(setAsideList({ ...made.state }, made.ctx));
  });

  it("names the cards the Setup set aside, by name and not in the order they were set aside, and keeps Durin's Bane's dial", () => {
    const made = tableFromLayout("escape-from-khazad-dum", { setAside: ["51311"] });
    const list = setAsideList(made.state, made.ctx);
    expect(list).toEqual({ cards: [idOf(made.state, "51311")], facedown: 0 });
    expect(khazadDials(made.state, made.ctx, nameOfIn(made)).find((dial) => dial.id === "bane")?.cardId).toBe(list.cards[0]);
    const heath = tableFromLayout("the-withered-heath", { setAside: ["19012", "19011", "12176"] });
    expect(namesOf(heath, setAsideList(heath.state, heath.ctx).cards)).toEqual(["Cold-Drake", "Dragon Sign", "Master of the Hunt"]);
  });

  it("returns its earlier result for the same game, and a new one when the game changes", () => {
    const made = tableFromLayout("the-withered-heath", { setAside: ["19011"] });
    const first = setAsideList(made.state, made.ctx);
    expect(setAsideList(made.state, made.ctx)).toBe(first);
    const hurt = updateCard(made.state, idOf(made.state, "19011"), { damage: 3, keepsDamage: true });
    expect(setAsideList(hurt, made.ctx)).not.toBe(first);
    expect(setAsideList(hurt, made.ctx)).toEqual(first);
    // 19024:A:1: the damage Cold-Drake keeps is the row's second half.
    expect(keptDamageWords(hurt.cards[idOf(hurt, "19011")])).toBe("Set aside with 3 damage, which it keeps when it returns.");
    expect(keptDamageWords(made.state.cards[idOf(made.state, "19011")])).toBeNull();
  });

  it("leaves the defeated stages to the quest card's preview", () => {
    const made = tableFromLayout("passage-through-mirkwood", { stage: "01121" });
    expect(made.state.setAside.length).toBeGreaterThan(0);
    expect(earlierStages(made.state, made.ctx, made.state.questStage ?? "").length).toBeGreaterThan(0);
    expect(setAsideList(made.state, made.ctx)).toEqual({ cards: [], facedown: 0 });
  });

  it("50701:A:1 counts the hidden Suspect and Hideout and names neither, whichever pair it is", () => {
    for (const pair of [["50710", "50705"], ["50713", "50704"]]) {
      const made = tableFromLayout("murder-at-the-prancing-pony", { piles: { investigationDeck: ["50709", "50706"] }, setAside: pair } as Layout);
      const list = setAsideList(made.state, made.ctx);
      expect(list).toEqual({ cards: [], facedown: 2 });
      // The list of one pair is the list of any other: nothing in it depends on which cards are hidden.
      expect(JSON.stringify(list)).toBe('{"cards":[],"facedown":2}');
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

  it("12148:B:1 counts the first encounter deck of The City of Corsairs once it lies set aside, and names the second deck's set that waits there", () => {
    const data = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../data/scenarios/the-city-of-corsairs.json"), "utf8")) as { cards: { code: string; pile: string }[] };
    // The game deals the campaign's reprint of a card in place of the first printing (data/scenarios, `reprints`): the codes the table knows.
    const world = tableFromLayout("the-city-of-corsairs");
    const first = data.cards.filter((card) => card.pile === "encounter" && world.cards.has(card.code)).map((card) => card.code);
    const second = data.cards.filter((card) => card.pile === "encounterDeck2" && world.cards.has(card.code)).map((card) => card.code);
    expect(first.length).toBeGreaterThan(10);
    expect(second.length).toBeGreaterThan(5);
    const made = tableFromLayout("the-city-of-corsairs", { setAside: [...first, ...second] });
    const list = setAsideList(made.state, made.ctx);
    expect(list.facedown).toBe(first.length);
    expect(list.cards.map((id) => made.state.cards[id]?.code).sort()).toEqual([...second].sort());
  });

  it("51241:A:1 names none of the cards Hidden Threat hid while they wait set aside for their reveal", () => {
    // In its own kit the cards are of the Quick-build's sets, which the list leaves out whole.
    const kit = tableFromLayout("the-mines-of-moria", { deck: ["51241"], setAside: ["51213", "51214"] });
    expect(setAsideList(kit.state, kit.ctx)).toEqual({ cards: [], facedown: 0 });
    // In a game with no Quick-build, a set-aside encounter card is counted while Hidden Threat is in the game.
    const other = tableFromLayout("passage-through-mirkwood", { deck: ["51241"], setAside: ["01096"] }, { extra: ["51241"] });
    expect(setAsideList(other.state, other.ctx)).toEqual({ cards: [], facedown: 1 });
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
    const secret = secretAside(made.state, made.ctx);
    expect(secret(made.cards.get("01096"), "01096")).toBe(false);
    // A card the table has no printing of is counted: it could not be named.
    expect(secret(undefined, "nope")).toBe(true);
  });
});
