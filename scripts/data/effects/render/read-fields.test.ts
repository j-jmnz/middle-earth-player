import { describe, expect, it } from "vitest";

import { newCtx, type Obj } from "./kit.ts";
import { TEMPLATES } from "./verbs.ts";

// A field is never hidden (kit.ts): a template that names a key in `read` must say it in its text, or the key would be dropped from the reader's view with no `[also ...]` to show it. For each verb, samples that set
// every field the template reads; removing a field must change the text. A new template needs a sample here.
const HERO = { type: "hero", control: "you" };
const SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  ModifyStat: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", holders: HERO, per: "hero", trait: "Dwarf", subtract: true }, { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "heroes" }],
  Pick: [{ verb: "Pick", pick: HERO }],
  PlaceProgressOn: [{ verb: "PlaceProgressOn", amount: 2, target: "self" }],
  RemoveProgressFrom: [{ verb: "RemoveProgressFrom", amount: 2, named: "Camp" }],
  PlaceResourceTokens: [{ verb: "PlaceResourceTokens", amount: 2, on: "self" }],
  AddResources: [{ verb: "AddResources", amount: 2, to: "self" }],
  DealDamage: [{ verb: "DealDamage" }],
  DamageCard: [{ verb: "DamageCard", amount: 2, target: "self" }],
  Heal: [{ verb: "Heal", amount: 2, target: "self" }, { verb: "Heal", all: true, target: "self" }],
  Exhaust: [{ verb: "Exhaust", target: "picked", who: "actor" }],
  Ready: [{ verb: "Ready", target: "picked" }],
  Discard: [{ verb: "Discard", target: "picked" }],
  DiscardFromHand: [{ verb: "DiscardFromHand", amount: 2 }],
  Draw: [{ verb: "Draw", who: "firstPlayer", amount: 2, perHero: "Dwarf", from: "bottom" }],
  RaiseThreat: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat", perCommitted: { type: "hero", exceptSphere: "fellowship" } }],
  LowerThreat: [{ verb: "LowerThreat", amount: 2, who: "eachSeat" }],
  ReturnToStaging: [{ verb: "ReturnToStaging", target: "picked" }],
  SetPursuit: [{ verb: "SetPursuit", value: 10 }],
  RaisePursuit: [{ verb: "RaisePursuit", amount: 3 }],
  LowerPursuit: [{ verb: "LowerPursuit", amount: 1 }],
  TakeLoggedCaptives: [{ verb: "TakeLoggedCaptives", under: "143022" }],
  MakeCaptive: [{ verb: "MakeCaptive", under: "143022" }],
  HoldCaptive: [{ verb: "HoldCaptive" }],
  ReturnCaptive: [{ verb: "ReturnCaptive", under: "143022" }],
  DamageHeldCaptive: [{ verb: "DamageHeldCaptive", amount: 1 }],
  DiscardRandomFromHand: [{ verb: "DiscardRandomFromHand", amount: 2, who: "eachSeat", remember: true }],
  SearchReveal: [{ verb: "SearchReveal", trait: "Uruk-hai", type: "enemy", who: "firstPlayer", to: "engaged" }],
  AttachSelf: [{ verb: "AttachSelf", to: { kind: "hero", trait: "Warrior" } }],
  EndQuestPhase: [{ verb: "EndQuestPhase" }],
  ImmediateAttack: [{ verb: "ImmediateAttack", shadow: false }],
  ConsiderUndefended: [{ verb: "ConsiderUndefended" }],
  DiscardShadowOf: [{ verb: "DiscardShadowOf", target: "other" }],
  DamageEach: [{ verb: "DamageEach", amount: 1, pick: HERO }],
  Restrict: [
    { verb: "Restrict", what: "advance" },
    { verb: "Restrict", what: "defend", allies: true },
    { verb: "Restrict", what: "defend", maxWillpower: 1, exceptTrait: "Hobbit" },
    { verb: "Restrict", what: "defend", belowSourceHitPoints: true },
    { verb: "Restrict", what: "travel", location: "18068", guarding: "Tiny" },
  ],
  ShuffleEncounterDeck: [{ verb: "ShuffleEncounterDeck" }],
  ShuffleEncounterDiscard: [{ verb: "ShuffleEncounterDiscard" }],
  DiscardEncounterTop: [{ verb: "DiscardEncounterTop", count: 2 }],
  DiscardUntilEnemies: [{ verb: "DiscardUntilEnemies", perPlayer: 2, to: "staging" }],
  RevealEncounter: [{ verb: "RevealEncounter", who: "firstPlayer" }],
  AdvanceStage: [{ verb: "AdvanceStage" }],
  WinGame: [{ verb: "WinGame" }],
  LoseGame: [{ verb: "LoseGame", reason: "the ring is lost" }],
  StageDiscarded: [{ verb: "StageDiscarded", type: "enemy" }],
  SearchStageCard: [{ verb: "SearchStageCard", code: "12345" }],
  SearchBoonOrTreasureToHand: [{ verb: "SearchBoonOrTreasureToHand" }],
  RemoveFromEncounterDeckIfLogged: [{ verb: "RemoveFromEncounterDeckIfLogged", line: "A line", count: 2, cardType: "enemy", nonUnique: true, except: ["Urdug"] }],
  IgnoreKeyword: [{ verb: "IgnoreKeyword", keywords: ["Surge"] }],
  AttackFromStaging: [{ verb: "AttackFromStaging", who: "firstPlayer", target: "self", orEngaged: true, undefendedToStage: true }],
  DiscardPicked: [{ verb: "DiscardPicked" }],
  Engage: [{ verb: "Engage", target: "self" }],
  Travel: [{ verb: "Travel" }],
  Attack: [{ verb: "Attack" }],
  MovePicked: [{ verb: "MovePicked", to: "hand", who: "firstPlayer" }, { verb: "MovePicked", to: "play", who: "actor" }],
  Choose: [{ verb: "Choose", who: "firstPlayer", different: true, options: [] }, { verb: "Choose", who: "actor", upTo: 2, options: [] }],
  Each: [{ verb: "Each", pick: HERO, upTo: 2, totalCost: 5, taken: ["i1"], instructions: [] }],
  Delay: [{ verb: "Delay", until: "endOfRound", uncancelable: { kind: "firstPlayer" }, subject: "picked", instructions: [] }],
  AfterAttack: [{ verb: "AfterAttack", instructions: [] }],
  Repeat: [{ verb: "Repeat", times: 2, instructions: [] }],
  ForEachPlayer: [{ verb: "ForEachPlayer", order: "lastFirst", instructions: [] }],
};

// A key whose every value reads alike (the only value of `to` on Travel is "self", also what its absence means).
const SAME_EITHER_WAY = new Set(["Travel.to"]);
// Keys that hold instructions: the renderer prints them beneath, not in the line.
const NESTED = new Set(["instructions", "options"]);

const textOf = (verb: string, ins: Obj): { text: string; read: readonly string[] } => {
  const made = TEMPLATES[verb]?.(ins, newCtx());
  if (!made) throw new Error(`${verb} has no template`);
  return made;
};

describe("effects:render read fields", () => {
  it("has a sample for every verb with a template, and none for a verb without", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(TEMPLATES).sort());
  });

  it("prints every field a template says it reads", () => {
    const hidden: string[] = [];
    for (const [verb, samples] of Object.entries(SAMPLES)) {
      const read = new Set<string>();
      const shown = new Set<string>();
      for (const sample of samples) {
        const full = textOf(verb, sample);
        for (const key of full.read) {
          read.add(key);
          if (!(key in sample)) continue;
          const { [key]: _removed, ...rest } = sample;
          let without: string | null = null;
          try {
            without = textOf(verb, rest).text;
          } catch {
            // A template that cannot run without the key reads it for its text.
          }
          if (without !== full.text) shown.add(key);
        }
      }
      // A key shows in some sample: the text changes when it is removed. A key no sample sets cannot be checked.
      for (const key of read) if (!NESTED.has(key) && !SAME_EITHER_WAY.has(`${verb}.${key}`) && !shown.has(key)) hidden.push(`${verb}.${key}`);
    }
    expect(hidden).toEqual([]);
  });

  it("says the fields the review found dropped", () => {
    const say = (verb: string, ins: Obj) => textOf(verb, ins).text;
    expect(say("RaiseThreat", { verb: "RaiseThreat", who: "eachSeat", perCommitted: { type: "hero", exceptSphere: "fellowship" } })).toBe("raise threat by 1 (each player) for each non-fellowship hero committed to the quest");
    expect(say("MovePicked", { verb: "MovePicked", to: "hand", who: "firstPlayer" })).toContain("the first player's hand");
    expect(say("Delay", { verb: "Delay", until: "endOfRound", subject: "picked", instructions: [] })).toContain("the card last picked");
    expect(say("Each", { verb: "Each", pick: HERO, upTo: 2, totalCost: 5, instructions: [] })).toContain("adding up to at most 5");
  });
});
