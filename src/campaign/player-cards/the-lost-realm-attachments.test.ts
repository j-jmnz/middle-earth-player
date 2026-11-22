// Rules: rr.attachment-cards, rr.modifiers, rr.staging, rr.staging-area, rr.deckbuilding (data/rules/entries.json).
// The Lost Realm attachments and player side quest, written from their card text (data/cards/TLR.json; data/printed holds no ledger for this box
// yet): Heir of Valandil 09010:A:1, Athelas 09011:A:1, Secret Vigil 09012:A:1 and A:2, Star Brooch 09013:A:1, Gather Information 09014:A:1.
import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../../catalog/deck-save.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { attachTo } from "../../rules/core/zones.ts";
import { legalTargets } from "../../rules/engine/reduce.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { stagingThreat } from "../../rules/quest/quest.ts";
import { payFor, starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Scene, type Table } from "../../../test/harness/scene.ts";
import { playerTable, sendUnledgered, stat } from "../../../test/harness/player-table.ts";

const HEIR = "09010";
const ATHELAS = "09011";
const VIGIL = "09012";
const BROOCH = "09013";
const GATHER = "09014";
// Dúnedain: Aragorn (Leadership hero), Beravor (Lore hero), Son of Arnor (ally). Erestor: a Noldor hero. Imladris Caregiver: a Healer ally.
// Glóin and Éowyn are neither.
const ARAGORN = "01001";
const GLOIN = "01003";
const LEGOLAS = "01005";
const EOWYN = "01007";
const BERAVOR = "01012";
const SON_OF_ARNOR = "01015";
const ERESTOR = "10084";
const CAREGIVER = "12008";
const F3 = "f3";
const WEAK = "weak";
const ALLY = "ally";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = (effects: readonly Effect[], scene: Scene = {}, resources = 6): Table => playerTable(base, effects, scene, resources);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([HEIR, ATHELAS, VIGIL, BROOCH, GATHER, ARAGORN, GLOIN, LEGOLAS, EOWYN, BERAVOR, SON_OF_ARNOR, ERESTOR, CAREGIVER]))]);
  cards.set(WEAK, definePrinted({ code: WEAK, name: "Weak", type: "enemy", threat: 2, engagementCost: 40, attack: 1, defense: 0, health: 9 }));
  base = { ...starter, cards };
});

function hosts(tab: Table, cardId: string): string[] {
  return [...legalTargets(tab.state, { type: "PlayCard", cardId }, tab.ctx)].sort();
}

// Attaches cards the scene put in play to the hosts named, then brings the constants up to date.
function attach(tab: Table, pairs: readonly (readonly [string, string])[]): Table {
  let state = tab.state;
  for (const [id, host] of pairs) state = attachTo(state, id, host);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

const sorted = (tab: Table, codes: readonly string[]) => codes.map((code) => idsOf(tab, code)).sort();

describe("Heir of Valandil (09010:A:1)", () => {
  // "Attach to a Dúnedain hero.": Aragorn and Beravor are offered; Glóin (not Dúnedain) and Son of Arnor (a Dúnedain ally) are not.
  lineSpec("09010:A:1", "goes on a Dúnedain hero only", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], allies: [{ code: SON_OF_ARNOR, seat: 0 }], hand: [{ code: HEIR, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, HEIR))).toEqual(sorted(tab, [ARAGORN, BERAVOR]));
  });
});

describe("Athelas (09011:A:1)", () => {
  // "Attach to a Dúnedain or Healer character.": Beravor (Dúnedain hero), Son of Arnor (Dúnedain ally) and the Imladris Caregiver (Healer ally)
  // are offered; Glóin and a plain ally are not.
  lineSpec("09011:A:1", "goes on a Dúnedain or Healer character only", (effects) => {
    const tab = table(effects, { heroes: [{ code: BERAVOR, seat: 0 }, { code: GLOIN, seat: 0 }], allies: [{ code: SON_OF_ARNOR, seat: 0 }, { code: CAREGIVER, seat: 0 }, { code: ALLY, seat: 0 }], hand: [{ code: ATHELAS, seat: 0 }] });
    expect(hosts(tab, idsOf(tab, ATHELAS))).toEqual(sorted(tab, [BERAVOR, SON_OF_ARNOR, CAREGIVER]));
  });
});

describe("Secret Vigil (09012:A:1, A:2)", () => {
  // "Attach to an enemy. Limit 1 per enemy.": the staged enemy and the one engaged with you are offered; a hero and an enemy that already holds a
  // Secret Vigil are not.
  lineSpec("09012:A:1", "goes on an enemy that holds no Secret Vigil yet", (effects) => {
    const scene = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], allies: [{ code: VIGIL, seat: 0 }], hand: [{ code: VIGIL, seat: 0 }], staging: [F3, WEAK], engaged: [{ code: "f0", seat: 0 }] });
    const [held, inHand] = scene.ids[VIGIL] ?? [];
    const tab = attach(scene, [[held ?? "", idsOf(scene, WEAK)]]);
    expect(hosts(tab, inHand ?? "")).toEqual(sorted(tab, [F3, "f0"]));
  });

  // "Attached enemy gets -1 Threat.": played on f3 (Threat 3) in the staging area, the enemy's Threat is 2 and the staging area's total falls by 1,
  // in the state the PlayCard intent returns.
  lineSpec("09012:A:2", "gives the attached enemy -1 Threat", (effects) => {
    const tab = table(effects, { heroes: [{ code: LEGOLAS, seat: 0 }], hand: [{ code: VIGIL, seat: 0 }], staging: [F3, WEAK] });
    const [vigil, f3] = [idsOf(tab, VIGIL), idsOf(tab, F3)];
    const before = stagingThreat(tab.state, tab.ctx.cards);
    const run = sendUnledgered(begin(tab.state), { type: "PlayCard", cardId: vigil, hostId: f3, payments: payFor(tab.state, tab.ctx, vigil) }, tab.ctx);
    expect(run.state.cards[vigil]?.host).toBe(f3);
    expect(stat(run.state, tab, f3, "threat")).toBe(2);
    expect(stat(run.state, tab, idsOf(tab, WEAK), "threat")).toBe(2);
    expect(stagingThreat(run.state, tab.ctx.cards)).toBe(before - 1);
  });
});

describe("Star Brooch (09013:A:1)", () => {
  // "Attach to a Dúnedain or Noldor hero. Limit 1 per hero.": Aragorn (Dúnedain) and Erestor (Noldor) are offered; Éowyn (neither), Son of Arnor
  // (a Dúnedain ally) and Beravor, who already wears a Star Brooch, are not.
  lineSpec("09013:A:1", "goes on a Dúnedain or Noldor hero that wears no Star Brooch yet", (effects) => {
    const scene = table(effects, {
      heroes: [{ code: ARAGORN, seat: 0 }, { code: ERESTOR, seat: 0 }, { code: EOWYN, seat: 0 }, { code: BERAVOR, seat: 0 }],
      allies: [{ code: SON_OF_ARNOR, seat: 0 }, { code: BROOCH, seat: 0 }],
      hand: [{ code: BROOCH, seat: 0 }],
    });
    const [worn, inHand] = scene.ids[BROOCH] ?? [];
    const tab = attach(scene, [[worn ?? "", idsOf(scene, BERAVOR)]]);
    expect(hosts(tab, inHand ?? "")).toEqual(sorted(tab, [ARAGORN, ERESTOR]));
  });
});

describe("Gather Information (09014:A:1)", () => {
  // "Limit 1 per deck." The deck check reads the card's deck limit (data/cards/TLR.json), which the DeckLimit record restates, so this is a
  // plain test: a deck with two copies is refused, one with one copy is not.
  it("09014:A:1 a deck holds at most 1 copy", () => {
    const rows = JSON.parse(readFileSync(new URL("../../../data/cards/TLR.json", import.meta.url), "utf8")) as { code: string; name: string; type: string; sphere: string | null; deckLimit: number | null }[];
    const row = rows.find((card) => card.code === GATHER);
    expect(row?.deckLimit).toBe(1);
    const fact = (name: string, typeCode: string, sphereCode: string | null, deckLimit: number | null): DeckSaveCard => ({ name, typeCode, sphereCode, deckLimit, deckLegal: true, traits: null });
    const facts = new Map<string, DeckSaveCard>([["h1", fact("Hero", "hero", "leadership", null)], [GATHER, fact(row?.name ?? "", row?.type ?? "", row?.sphere ?? null, row?.deckLimit ?? null)]]);
    for (let index = 0; index < 50; index += 1) facts.set(`e${index}`, fact(`Event ${index}`, "event", "leadership", 3));
    const events = Array.from({ length: 50 }, (_, index) => ({ code: `e${index}`, count: 1 }));
    expect(deckSaveRefusal(["h1"], [...events, { code: GATHER, count: 1 }], facts)).toBeNull();
    expect(deckSaveRefusal(["h1"], [...events, { code: GATHER, count: 2 }], facts)).toMatchObject({ cardCode: GATHER });
  });
});
