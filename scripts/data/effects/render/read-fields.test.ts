import { describe, expect, it } from "vitest";

import { renderAmount } from "./amounts.ts";
import { CONDITION_TEMPLATES, renderCondition } from "./conditions.ts";
import { newCtx, type Ctx, type Obj } from "./kit.ts";
import { renderPick } from "./picks.ts";
import { TEMPLATES } from "./verbs.ts";

// A field is never hidden (kit.ts): a template that names a key in `read` must say it in its text, or the key would be dropped from the reader's view with no `[also ...]` to show it. For each verb, samples that set
// every field the template reads; removing a field must change the text. A new template needs a sample here.
const HERO = { type: "hero", control: "you" };
const SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
  ModifyStat: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", holders: HERO, per: "hero", trait: "Dwarf", subtract: true }, { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfRound", target: "heroes" }],
  Pick: [{ verb: "Pick", pick: HERO }],
  FortitudeTest: [{ verb: "FortitudeTest", who: "firstPlayer", extraCards: { players: true }, extraEyes: { amount: 2, when: { kind: "firstPlayer" } } }],
  IgnoreFortitudeEyes: [{ verb: "IgnoreFortitudeEyes" }],
  FirstTreacheryImmuneSurge: [{ verb: "FirstTreacheryImmuneSurge" }],
  PlaceTokensOnCampaignCard: [{ verb: "PlaceTokensOnCampaignCard", amount: 3 }],
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
  PlaceFacedownUnder: [{ verb: "PlaceFacedownUnder", code: "144027", target: "self", afterAttack: true }],
  AttachToDial: [{ verb: "AttachToDial", code: "145016" }],
  DetachFromDial: [{ verb: "DetachFromDial", code: "145016" }],
  RemoveSetAside: [{ verb: "RemoveSetAside", code: "145016" }],
  DiscardHand: [{ verb: "DiscardHand" }],
  SetPursuit: [{ verb: "SetPursuit", value: 10 }],
  RaisePursuit: [{ verb: "RaisePursuit", amount: 3 }],
  LowerPursuit: [{ verb: "LowerPursuit", amount: 1 }],
  Time: [{ verb: "Time", amount: 4 }],
  RemoveTimeCounters: [{ verb: "RemoveTimeCounters" }],
  HoldUnder: [{ verb: "HoldUnder", code: "09016" }],
  DiscardHeld: [{ verb: "DiscardHeld" }],
  PlaceHandUnderSelf: [{ verb: "PlaceHandUnderSelf" }],
  ChooseCurrentQuest: [{ verb: "ChooseCurrentQuest" }],
  AttachNewTo: [{ verb: "AttachNewTo", code: "10157", to: "Iârion" }],
  TradeDamageForResources: [{ verb: "TradeDamageForResources", code: "10158", damage: 4, resources: 1 }],
  FirstTraitSurge: [{ verb: "FirstTraitSurge", trait: "Weather", type: "enemy" }],
  FlipTimeObjective: [{ verb: "FlipTimeObjective", to: "other" }, { verb: "FlipTimeObjective", to: "night" }],
  RecordStartingThreat: [{ verb: "RecordStartingThreat", amount: -2 }],
  RecordDetermined: [{ verb: "RecordDetermined", code: "10172" }],
  GainsDoomed: [{ verb: "GainsDoomed", amount: 1, pick: HERO }],
  ChangeControl: [{ verb: "ChangeControl", to: "eventSeat" }],
  EngageNextPlayer: [{ verb: "EngageNextPlayer" }],
  DealShadowTo: [{ verb: "DealShadowTo", target: "picked" }],
  AttachSelfToPicked: [{ verb: "AttachSelfToPicked" }, { verb: "AttachSelfToPicked", unlimited: true }],
  RemoveAllQuestProgress: [{ verb: "RemoveAllQuestProgress", of: "stage" }],
  PutTopmostFromEncounterDiscard: [{ verb: "PutTopmostFromEncounterDiscard", type: "enemy", trait: "Warg", dealShadow: true }],
  EnterSetAsideStaging: [{ verb: "EnterSetAsideStaging", code: "09033" }],
  AddSetAsideToStaging: [{ verb: "AddSetAsideToStaging", code: "09033", all: true }, { verb: "AddSetAsideToStaging", trait: "Orc" }],
  DiscardFromDeck: [{ verb: "DiscardFromDeck", amount: 2, shuffle: true, count: HERO, costAtLeast: 2 }],
  MoveCard: [{ verb: "MoveCard", card: "self", from: ["discard"], to: "deckShuffle" }],
  PickDiscardTop: [{ verb: "PickDiscardTop", types: ["enemy"], trait: "Undead" }],
  MoveEncounterCard: [{ verb: "MoveEncounterCard", card: "deckTop", to: "staging" }],
  GainSurge: [{ verb: "GainSurge" }],
  CountsAs: [{ verb: "CountsAs", cardType: "attachment", trait: "Sorcery" }],
  IncreaseCost: [{ verb: "IncreaseCost", amount: 1, pick: HERO }],
  RaiseStagingThreat: [{ verb: "RaiseStagingThreat", amount: 2, until: "endOfRound" }],
  PutSetAsideInPlay: [{ verb: "PutSetAsideInPlay", name: "Iârion", to: "lastPlayer" }, { verb: "PutSetAsideInPlay", name: "Calaerion", withCard: "Dream-chaser" }],
  AttachRandomBurden: [{ verb: "AttachRandomBurden", codes: ["10168", "10169"], to: "self" }],
  MoveToHero: [{ verb: "MoveToHero", most: "damage" }],
  AttachSelfToNamed: [{ verb: "AttachSelfToNamed", name: "Thaurdir", outOfPlay: true }],
  MoveDamageTo: [{ verb: "MoveDamageTo", from: "self", to: "other", amount: 1 }],
  EndPhase: [{ verb: "EndPhase" }],
  PlaceLoggedDamageOn: [{ verb: "PlaceLoggedDamageOn", code: "10158" }],
  ChooseBoon: [{ verb: "ChooseBoon", codes: ["10161", "10162"], seat: 1 }],
  RemoveResourceTokens: [{ verb: "RemoveResourceTokens", code: "09072", amount: 1 }, { verb: "RemoveResourceTokens", on: "picked", amount: 1 }],
  SearchMove: [{ verb: "SearchMove", trait: "Orc", type: "enemy", code: "09043", to: "engagedFirstPlayer", each: true, deckOnly: true, victory: true }, { verb: "SearchMove", code: "09061", to: "engaged", discardOnly: true }, { verb: "SearchMove", to: "engaged" }, { verb: "SearchMove", to: "stormcallerArea" }],
  AssignDamage: [{ verb: "AssignDamage", amount: 2, pick: HERO, who: "eachSeat", left: 1, of: 2 }],
  ExhaustEach: [{ verb: "ExhaustEach", pick: HERO }],
  RemoveFromQuest: [{ verb: "RemoveFromQuest" }],
  AttachToQuest: [{ verb: "AttachToQuest" }],
  ShufflePile: [{ verb: "ShufflePile", pile: "angmarOrcs" }],
  AddFromPile: [{ verb: "AddFromPile", pile: "angmarOrcs", to: "engaged", count: 2, who: "firstPlayer", attachSource: true }, { verb: "AddFromPile", pile: "angmarOrcs", to: "engaged", reveal: true, who: "firstPlayer" }],
  ShufflePileIntoEncounterDeck: [{ verb: "ShufflePileIntoEncounterDeck", pile: "angmarOrcs" }],
  StageSetAside: [{ verb: "StageSetAside", code: "09046", remember: true }, { verb: "StageSetAside", name: "Orc Ambush" }, { verb: "StageSetAside", code: "09046", reveal: true }],
  ResolveWhenRevealed: [{ verb: "ResolveWhenRevealed", card: "self" }],
  RevealMore: [{ verb: "RevealMore", amount: 1 }],
  FlipInPlace: [{ verb: "FlipInPlace", code: "09071", into: "09072", attachTo: "picked", entersPlay: true }],
  AddToPool: [{ verb: "AddToPool", code: "10160", eachPlayer: true }],
  ShuffleIntoEncounterDeck: [{ verb: "ShuffleIntoEncounterDeck", code: "10160" }],
  AddToStaging: [{ verb: "AddToStaging", code: "10158" }],
  RecordDamageOn: [{ verb: "RecordDamageOn", codes: ["10158"] }],
  EarnAttached: [{ verb: "EarnAttached", codes: ["10161", "10162"] }],
  RemoveFromCampaignPool: [{ verb: "RemoveFromCampaignPool" }],
  CancelDamage: [{ verb: "CancelDamage", amount: 2, target: "host" }, { verb: "CancelDamage", all: true }],
  ChooseX: [{ verb: "ChooseX", min: 2, max: [{ stat: "damage", of: "picked" }] }, { verb: "ChooseX", max: [3, { stat: "resources", of: "picked" }] }],
  MoveDamage: [{ verb: "MoveDamage", amount: 2 }, { verb: "MoveDamage", all: true }],
  TakeLoggedCaptives: [{ verb: "TakeLoggedCaptives", under: "143022" }],
  FreeRingBearer: [{ verb: "FreeRingBearer" }],
  AttachToHeroWith: [{ verb: "AttachToHeroWith", code: "144052", with: "146014" }],
  SetAsideBoon: [{ verb: "SetAsideBoon", trait: "Item", except: "142014" }],
  GuardWithSetAside: [{ verb: "GuardWithSetAside", host: "146020", kind: "boon" }],
  MoveAttachment: [{ verb: "MoveAttachment", code: "144052", to: "ringBearer" }],
  ReturnFromVictory: [{ verb: "ReturnFromVictory", code: "146071", into: "146070" }],
  ResolveAttackAgainst: [{ verb: "ResolveAttackAgainst" }],
  MakeCaptive: [{ verb: "MakeCaptive", under: "143022" }],
  HoldCaptive: [{ verb: "HoldCaptive" }],
  ReturnCaptive: [{ verb: "ReturnCaptive", under: "143022" }],
  DamageHeldCaptive: [{ verb: "DamageHeldCaptive", amount: 1 }],
  DiscardRandomFromHand: [{ verb: "DiscardRandomFromHand", amount: 2, who: "eachSeat", remember: true }],
  SearchReveal: [{ verb: "SearchReveal", trait: "Uruk-hai", type: "enemy", who: "firstPlayer", to: "engaged", cost: true }],
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
  DiscardUntilEnemies: [{ verb: "DiscardUntilEnemies", perPlayer: 2, to: "staging", trait: "Warg", less: 1 }],
  RevealEncounter: [{ verb: "RevealEncounter", who: "firstPlayer" }, { verb: "RevealEncounter", times: 2 }],
  AdvanceStage: [{ verb: "AdvanceStage" }],
  WinGame: [{ verb: "WinGame" }],
  LoseGame: [{ verb: "LoseGame", reason: "the ring is lost" }],
  StageDiscarded: [{ verb: "StageDiscarded", type: "enemy" }],
  SearchStageCard: [{ verb: "SearchStageCard", code: "12345" }],
  SearchBoonOrTreasureToHand: [{ verb: "SearchBoonOrTreasureToHand" }],
  RemoveFromEncounterDeckIfLogged: [{ verb: "RemoveFromEncounterDeckIfLogged", line: "A line", count: 2, cardType: "enemy", nonUnique: true, except: ["Urdug"] }],
  IgnoreKeyword: [{ verb: "IgnoreKeyword", keywords: ["Surge"] }],
  AttackFromStaging: [{ verb: "AttackFromStaging", who: "firstPlayer", target: "self", orEngaged: true, undefendedToStage: true }],
  PlaceMireToken: [{ verb: "PlaceMireToken", on: "activeLocation", amount: 1 }],
  ReturnRandomVictoryLocation: [{ verb: "ReturnRandomVictoryLocation" }],
  ShuffleVictoryIntoEncounterDeck: [{ verb: "ShuffleVictoryIntoEncounterDeck" }],
  FlipGollum: [{ verb: "FlipGollum", to: "smeagol" }, { verb: "FlipGollum", to: "gollum" }],
  FollowFirstPlayer: [{ verb: "FollowFirstPlayer" }],
  GollumAttacks: [{ verb: "GollumAttacks" }],
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

// A key whose value in a sample reads as its absence does (the only value of `to` on Travel is "self"; `to: "play"` is what a MovePicked without `to` words; a FlipGollum without `to` words as its "gollum" side).
const SAME_EITHER_WAY = new Set(["Travel.to", "MovePicked[1].to", "FlipGollum[1].to"]);
// Keys that hold instructions: the renderer prints them beneath, not in the line.
const NESTED = new Set(["instructions", "options"]);

const textOf = (verb: string, ins: Obj): { text: string; read: readonly string[] } => {
  const made = TEMPLATES[verb]?.(ins, newCtx());
  if (!made) throw new Error(`${verb} has no template`);
  return made;
};

describe("effects render read fields", () => {
  it("has a sample for every verb with a template, and none for a verb without", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(TEMPLATES).sort());
  });

  it("prints every field a template says it reads, in each sample that sets it", () => {
    const hidden: string[] = [];
    for (const [verb, samples] of Object.entries(SAMPLES)) {
      samples.forEach((sample, index) => {
        const full = textOf(verb, sample);
        for (const key of full.read) {
          if (!(key in sample) || NESTED.has(key) || SAME_EITHER_WAY.has(`${verb}.${key}`) || SAME_EITHER_WAY.has(`${verb}[${index}].${key}`)) continue;
          const { [key]: _removed, ...rest } = sample;
          let without: string | null = null;
          try {
            without = textOf(verb, rest).text;
          } catch {
            // A template that cannot run without the key reads it for its text.
          }
          // Removing the key must change the text: otherwise the sample's value is not said.
          if (without === full.text) hidden.push(`${verb}[${index}].${key}`);
        }
      });
    }
    expect(hidden).toEqual([]);
  });

  it("claims for Restrict only the keys its branch says", () => {
    expect(textOf("Restrict", { verb: "Restrict", what: "advance" }).read).toEqual(["what"]);
    expect(textOf("Restrict", { verb: "Restrict", what: "travel" }).read).not.toContain("allies");
    expect(textOf("Restrict", { verb: "Restrict", what: "defend" }).read).not.toContain("location");
  });

  it("says the fields the review found dropped", () => {
    const say = (verb: string, ins: Obj) => textOf(verb, ins).text;
    expect(say("RaiseThreat", { verb: "RaiseThreat", who: "eachSeat", perCommitted: { type: "hero", exceptSphere: "fellowship" } })).toBe("raise threat by 1 (each player) for each non-fellowship hero committed to the quest");
    expect(say("MovePicked", { verb: "MovePicked", to: "hand", who: "firstPlayer" })).toContain("the first player's hand");
    expect(say("Delay", { verb: "Delay", until: "endOfRound", subject: "picked", instructions: [] })).toContain("the card last picked");
    expect(say("Each", { verb: "Each", pick: HERO, upTo: 2, totalCost: 5, instructions: [] })).toContain("adding up to at most 5");
  });
});

// The same check for the conditions, picks and amounts: each renders through `done`, which records the keys a template claims in `ctx.reads`. A sample sets the keys the piece reads; a claimed key no sample sets, or one
// whose removal leaves the English as it was, fails; so does a sample that prints `[also ...]`, a key the template does not claim.
type Render = (value: Obj, ctx: Ctx) => string;

function checkPiece(render: Render, samples: readonly Obj[], skip: ReadonlySet<string> = new Set()): { hidden: string[]; unsampled: string[]; unclaimed: string[] } {
  const claimed = new Set<string>();
  const sampled = new Set<string>();
  const shown = new Set<string>();
  const unclaimed: string[] = [];
  for (const sample of samples) {
    const ctx: Ctx = { ...newCtx(), reads: [] };
    const full = render(sample, ctx);
    for (const key of ctx.reads?.at(-1) ?? []) claimed.add(key);
    if (full.includes("[also ")) unclaimed.push(full);
    for (const key of Object.keys(sample)) {
      sampled.add(key);
      const { [key]: _removed, ...rest } = sample;
      let without: string | null = null;
      try {
        without = render(rest, newCtx());
      } catch {
        // A template that cannot run without the key reads it for its text.
      }
      if (without !== full) shown.add(key);
    }
  }
  return {
    hidden: [...claimed].filter((key) => sampled.has(key) && !shown.has(key) && !skip.has(key)),
    unsampled: [...claimed].filter((key) => !sampled.has(key)),
    unclaimed,
  };
}

describe("effects render read fields, conditions", () => {
  const SAMPLES: Readonly<Record<string, readonly Obj[]>> = {
    sourceIn: [{ kind: "sourceIn", zone: "staging" }],
    less: [{ kind: "less", left: 2, right: 3 }],
    subjectExplored: [{ kind: "subjectExplored" }],
    x: [{ kind: "x", min: 2 }],
    shadowBlank: [{ kind: "shadowBlank" }],
    namedFlag: [{ kind: "namedFlag", name: "A Card", stat: "blankText" }],
    flag: [{ kind: "flag", stat: "blankText", holder: "seat", is: false }],
    canPick: [{ kind: "canPick", pick: { type: "hero", control: "you" } }],
    attackedThisPhase: [{ kind: "attackedThisPhase", name: "A Card" }],
    phase: [{ kind: "phase", is: "combat" }],
    hasEngaged: [{ kind: "hasEngaged", trait: "Orc" }],
    exhausted: [{ kind: "exhausted", code: "12345", is: true }],
    count: [{ kind: "count", pick: { type: "hero", control: "you" }, min: 1, max: 3 }],
    threat: [{ kind: "threat", min: 20, max: 30 }],
    inPlay: [{ kind: "inPlay", code: "12345", is: true }],
    faceUp: [{ kind: "faceUp", side: "B" }],
    firstPlayer: [{ kind: "firstPlayer" }],
    otherPlayer: [{ kind: "otherPlayer" }],
    handHasCard: [{ kind: "handHasCard" }],
    undefended: [{ kind: "undefended" }],
    questSucceeded: [{ kind: "questSucceeded" }],
    questFailed: [{ kind: "questFailed" }],
    logged: [{ kind: "logged", line: "A line", is: false }],
    onStage: [{ kind: "onStage", stage: 2 }],
    onDial: [{ kind: "onDial", code: "145016" }],
    canAttachToDial: [{ kind: "canAttachToDial", code: "145016" }],
    pursuit: [{ kind: "pursuit", min: 3, max: 6 }],
    tokens: [{ kind: "tokens", code: "09072", min: 1, perPlayer: true }],
    currentQuest: [{ kind: "currentQuest", is: "side" }, { kind: "currentQuest", is: "self" }, { kind: "currentQuest", is: "other" }],
    questLeads: [{ kind: "questLeads" }],
    timeOfDay: [{ kind: "timeOfDay", is: "day" }, { kind: "timeOfDay", is: "night" }],
    stageProgress: [{ kind: "stageProgress", min: 5 }],
    hitPointsLeft: [{ kind: "hitPointsLeft", code: "09033" }],
    pileHas: [{ kind: "pileHas", pile: "harad", min: 1, max: 3 }],
    facedownUnder: [{ kind: "facedownUnder", code: "144027", min: 3, max: 8, players: true }],
    soleAttacker: [{ kind: "soleAttacker" }],
    lastFortitudeFailed: [{ kind: "lastFortitudeFailed" }],
    lastFortitudePassed: [{ kind: "lastFortitudePassed" }],
    fortitudeFailed: [{ kind: "fortitudeFailed", scope: "round", who: "any" }],
    hostControlledByActor: [{ kind: "hostControlledByActor" }],
    captives: [{ kind: "captives", min: 1, max: 2, of: "actor" }],
    matches: [{ kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: false }],
    controls: [{ kind: "controls", code: "12345" }],
    // The combinators are not in the table: renderCondition words them.
    not: [{ kind: "not", condition: { kind: "firstPlayer" } }],
    all: [{ kind: "all", conditions: [{ kind: "firstPlayer" }, { kind: "otherPlayer" }] }],
    any: [{ kind: "any", conditions: [{ kind: "firstPlayer" }, { kind: "otherPlayer" }] }],
  };
  const render: Render = (value, ctx) => renderCondition(value, ctx);

  it("has a sample for every condition kind with a template", () => {
    expect(Object.keys(SAMPLES).filter((kind) => !["not", "all", "any"].includes(kind)).sort()).toEqual(Object.keys(CONDITION_TEMPLATES).sort());
  });

  it("says every field a template claims", () => {
    const found = Object.entries(SAMPLES).map(([kind, samples]) => [kind, checkPiece(render, samples)] as const);
    expect(found.filter(([, result]) => result.hidden.length > 0 || result.unsampled.length > 0 || result.unclaimed.length > 0)).toEqual([]);
  });
});

describe("effects render read fields, picks", () => {
  // Every key renderPick words, spread over samples because `captive` replaces the control words.
  const BIG: Obj = {
    type: "enemy",
    control: "any",
    state: "exhausted",
    sphere: "tactics",
    spheres: ["tactics", "spirit"],
    unique: true,
    nonUnique: true,
    trait: "Orc",
    traits: ["Orc", "Goblin"],
    damaged: true,
    from: "discard",
    top: 3,
    bottom: 2,
    staging: true,
    stagingOnly: true,
    engaged: "other",
    names: ["Urdug"],
    exceptNames: ["Ufthak"],
    notTraits: ["Elite"],
    nonObjective: true,
    objective: true,
    cardType: "hero",
    committed: true,
    attacking: true,
    defending: true,
    hasResources: true,
    progress: true,
    exceptSphere: "lore",
    who: "firstPlayer",
    engagedEnemies: true,
    hasShadow: true,
    copyInDiscard: true,
    looked: true,
    lowestAttack: true,
    lowestThreat: true,
    highestCost: true,
    fortitudeDiscarded: true,
    isHost: true,
    determined: true,
    hasAttachment: { names: ["Wormsbane"] },
  };
  const SAMPLES: readonly Obj[] = [
    BIG,
    { type: "hero", control: "you", captive: "only" },
    { type: "hero", control: "you", captive: "free" },
    { type: "hero", control: "you", captive: "include" },
    { type: "hero", control: "you", committed: false, progress: false, damaged: false },
  ];
  const render: Render = (value, ctx) => renderPick(value, ctx);

  it("says every field the template claims", () => {
    const result = checkPiece(render, SAMPLES);
    expect(result.unsampled).toEqual([]);
    expect(result.unclaimed).toEqual([]);
    expect(result.hidden).toEqual([]);
  });

  it("claims no field whose value it leaves unsaid", () => {
    // A false the template has no words for stays out of its claim, so it prints as `[also {...}]` in place of vanishing.
    for (const key of ["unique", "nonUnique", "hasResources", "attacking", "defending", "staging", "stagingOnly", "hasShadow", "copyInDiscard", "looked", "engagedEnemies", "objective", "nonObjective"]) {
      expect(renderPick({ type: "hero", control: "you", [key]: false }, newCtx()), key).toContain(`[also {"${key}":false}]`);
    }
  });
});

describe("effects render read fields, amounts", () => {
  const PICK = { type: "hero", control: "you" };
  const SAMPLES: readonly Obj[] = [
    { count: PICK, distinct: true, every: 2, times: 3, plus: 1, limit: 5 },
    { stat: "attack", of: "host", printed: true, negative: true },
    { stat: "willpower", ofNamed: "A Card" },
    { players: true },
    { highestThreat: true },
    { playersAtThreat: 35 },
    { pursuit: true },
    { questCards: true },
    { pile: "harad" },
    { x: true },
    { stage: true },
    { threat: "tens" },
    { hand: true },
    { dealt: true },
    { resourcesOn: PICK, max: true },
    { damageOn: PICK },
  ];
  const render: Render = (value, ctx) => renderAmount(value, ctx, renderPick);

  it("says every field the template claims", () => {
    const result = checkPiece(render, SAMPLES);
    expect(result.unclaimed).toEqual([]);
    expect(result.hidden).toEqual([]);
    expect(result.unsampled).toEqual([]);
  });
});
