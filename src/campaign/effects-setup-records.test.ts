import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { scenarioCards } from "../catalog/scenario-data.ts";
import { hasTrait } from "../rules/interpret/conditions.ts";
import { byCode, expectOk } from "../rules/core/test-fixture.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { campaign, codesOf, FRODO, loadWorld, MERRY, RING, SAM, scenario, type World } from "../../scripts/past-scene.ts";
import { buildStart } from "./start.ts";

let world: World;

beforeAll(async () => {
  world = await loadWorld();
});

describe("setup records", () => {
  const SETUP_CODES = ["141022", "141078", "141017"];

  function isSubsequence(part: readonly unknown[], whole: readonly unknown[]): boolean {
    let at = 0;
    for (const item of whole) {
      if (at < part.length && JSON.stringify(item) === JSON.stringify(part[at])) at += 1;
    }
    return at === part.length;
  }

  it("mirror the instructions the definition and the script already run", () => {
    const start = buildStart({ campaign, scenario, seatCount: 1, seed: 5, threatModifier: 0, seats: [{ heroes: [FRODO, SAM], deck: [] }], effects: EFFECTS });
    const run = start.definition.setup;
    for (const code of SETUP_CODES) {
      const record = EFFECTS.find((effect) => effect.cardCode === code && effect.timing === "setup");
      expect(record, code).toBeDefined();
      expect(isSubsequence(record?.instructions ?? [], run), code).toBe(true);
    }
    // The campaign script, not the definition, runs the 141085 Setup record.
    expect(start.definition.setup.filter((instruction) => "code" in instruction && instruction.code === RING)).toHaveLength(1);
  });

  it("never place a card a second time", () => {
    const start = buildStart({ campaign, scenario,
      seatCount: 1,
      seed: 5,
      threatModifier: 0,
      seats: [{ heroes: [FRODO, SAM], deck: [] }],
      effects: EFFECTS,
    });
    const ctx: ReduceContext = { effects: EFFECTS, cards: world.cards };
    const started = startScenario(start, ctx);
    const kept = expectOk(reduce(started, { type: "Keep" }, ctx)).state;
    for (const code of ["141078", "141017", "141031", "141035"]) {
      expect(byCode(kept, code), code).toHaveLength(1);
    }
    expect(codesOf(kept, kept.staging).sort()).toEqual(["141039", "141078"]);
    expect(kept.encounterDeck).toHaveLength(42);
  });
});

describe("Gandalf's Delay", () => {
  const STARTER = Array.from({ length: 14 }, () => "f0");
  function begin(seed: number, seats: 1 | 2 = 1) {
    const start = buildStart({ campaign, scenario,
      seatCount: seats,
      seed,
      threatModifier: 0,
      seats: seats === 1
        ? [{ heroes: [FRODO, SAM], deck: STARTER }]
        : [{ heroes: [FRODO, SAM], deck: STARTER }, { heroes: [MERRY], deck: STARTER }],
      effects: EFFECTS,
    });
    const ctx: ReduceContext = { effects: EFFECTS, cards: world.cards };
    return { started: startScenario(start, ctx), ctx };
  }

  it("has two setup records, the second lowering the starting hand", () => {
    const records = EFFECTS.filter((effect) => effect.cardCode === "141078" && effect.timing === "setup");
    expect(records).toHaveLength(2);
    expect(records[1]?.instructions).toEqual([{ verb: "ReduceOpeningHand", amount: 1 }]);
  });

  it("deals every seat a starting hand of five on a fixed seed", () => {
    for (const seats of [1, 2] as const) {
      const { started } = begin(11, seats);
      expect(started.openingHandReduction).toBe(1);
      for (let seat = 0; seat < seats; seat += 1) expect(started.seats[seat]?.hand, `seat ${seat}`).toHaveLength(5);
    }
  });

  it("redraws five on a mulligan and still stages the card once", () => {
    const { started, ctx } = begin(11);
    const mulled = expectOk(reduce(started, { type: "Mulligan" }, ctx)).state;
    expect(mulled.seats[0]?.hand.slice(0, 5)).toHaveLength(5);
    expect(codesOf(mulled, mulled.staging)).toContain("141078");
    expect(byCode(mulled, "141078")).toHaveLength(1);
  });
});

// The four boons 141044's Resolution attaches (141018-141021). Their Setup line (A:2) is a record that attaches the card to
// a hero of the seat whose deck holds it; the Campaign Setup Checklist step 5 has already put an earned one on its hero
// (rr.campaign-setup-checklist, mec109.permanent), so the Setup search does not find it and it is placed once. Line A:3
// is the stat and the trait (template attached-gets-stat-and-gains-trait).
describe("the A Knife in the Dark boons", () => {
  const knife = loadScenario("a-knife-in-the-dark");
  const BOONS = { "141018": ["defense", 1, "Ranger"], "141019": ["hitPoints", 2, "Healer"], "141020": ["attack", 1, "Warrior"], "141021": ["willpower", 1, "Noble"] } as const;

  it("each has a Setup record that attaches it to a hero, and a constant with its stat and trait", () => {
    for (const [code, [stat, amount, trait]] of Object.entries(BOONS)) {
      expect(EFFECTS.find((effect) => effect.id === `${code}:setup:1`)?.instructions).toEqual([{ verb: "AttachSelf", to: { kind: "hero" } }]);
      expect(EFFECTS.find((effect) => effect.id === `${code}:constant:1`)?.instructions).toEqual([
        { verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "host" },
        { verb: "GrantTrait", trait },
      ]);
    }
  });

  it("an earned boon starts on its hero once, giving that hero the stat and the trait", async () => {
    const cards = new Map([...world.cards, ...(await loadPrinted([...scenarioCards(knife).map((card) => card.code), ...knife.campaignPlaced]))]);
    const ctx: ReduceContext = { effects: EFFECTS, cards };
    const attachments = Object.keys(BOONS).map((code, at) => ({ host: at % 2 === 0 ? SAM : FRODO, code }));
    const start = buildStart({ campaign, scenario: knife, seatCount: 1, seed: 5, threatModifier: 0, seats: [{ heroes: [FRODO, SAM], deck: [], attachments }], effects: EFFECTS });
    const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
    for (const [at, [code, [stat, amount, trait]]] of Object.entries(BOONS).entries()) {
      const copies = byCode(kept, code);
      expect(copies, code).toHaveLength(1);
      const hostId = kept.cards[copies[0] ?? ""]?.host ?? "";
      const host = kept.cards[hostId];
      expect(host?.code, code).toBe(at % 2 === 0 ? SAM : FRODO);
      if (!host) continue;
      const printed = cards.get(host.code);
      const base = stat === "hitPoints" ? printed?.health : printed?.[stat];
      // Sam carries Defense and Attack, Frodo hit points and Willpower: no two boons on one hero share a stat.
      expect(modifiedStat(kept, host, stat, cards), `${code} ${stat}`).toBe((base ?? 0) + amount);
      expect(hasTrait(kept, hostId, trait, ctx), `${code} ${trait}`).toBe(true);
    }
  });
});
