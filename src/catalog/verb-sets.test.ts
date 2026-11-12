import { describe, expect, it } from "vitest";

import { collectionVerbs, setupRoleVerbs, setupRunVerbs, verbsRunningInFrame } from "./verb-sets.ts";

// The verbs of each flag, as src/rules/combat/shadow.ts, src/rules/families/quest/setup.ts and src/campaign/world.ts listed them by name before each schema entry carried its flag.
const sorted = (verbs: ReadonlySet<string>) => [...verbs].sort();

describe("verb flags", () => {
  it("mark exactly the verbs a Shadow effect runs in a frame for", () => {
    expect(sorted(verbsRunningInFrame())).toEqual(["AssignDamage", "Choose", "DiscardBottom", "EngageOrGrapple", "Each", "ImmediateAttack", "Pick", "Repeat", "ResolveGrapple", "ResolveWhenRevealed", "RevealEncounter", "SearchMove"].sort());
  });

  it("mark exactly the verbs that make a quest card's Setup run", () => {
    expect(sorted(setupRunVerbs("top"))).toEqual(["AttachSetAside", "DiscardUntilAflame", "DiscardUntilEnemies", "PlaceDamageOn", "PrepareFleet", "PrepareGrottoDeck", "PrepareIslandMap", "PrepareUnchartedDeck", "PutSetAsideInPlay", "ShufflePile", "TakeControlOfSetAside", "TakeLoggedCaptives"]);
    expect(sorted(setupRunVerbs("inForEachPlayer"))).toEqual(["AttachToDial", "RevealEncounter", "SearchMove"]);
    expect(sorted(setupRunVerbs("inChoose"))).toEqual(["ShuffleCopyIntoEachDeck"]);
    expect(sorted(setupRunVerbs("inEach"))).toEqual(["GuardObjective"]);
  });

  it("mark exactly the verbs the start deals in Setup", () => {
    expect(sorted(setupRoleVerbs("dealt"))).toEqual(["AddToStaging", "AddToStagingWithResources", "AttachToRingBearer", "PlaceTokensOnCampaignCard", "PutObjectiveAllyIntoPlay", "SetAside", "SetAsideEachPlayer", "SetAsideHeroWithAttachments", "SetAsideLogged"]);
  });

  it("mark exactly the verbs the start resolves after the quest card's Setup", () => {
    expect(sorted(setupRoleVerbs("afterSetup"))).toEqual(["AttachNewTo", "AttachSetAsideTo", "AttachToHeroWith", "FitShips", "FlipSetAside", "FlipStormcaller", "PlaceLoggedDamageOn", "PlaceLoggedHeroDamage", "PlaceSecrets", "PutSetAsideInPlay", "PutTrust", "RaiseThreatToAttach", "SearchGuardForTreasure", "ShuffleIntoPile", "TradeDamageForResources", "TradeDamageForThreat", "TradeShipDamage"]);
  });

  it("mark exactly the verbs that reach into the collection", () => {
    expect(sorted(collectionVerbs("hero"))).toEqual(["AttachCollectionHero", "SwapHero", "TakeHeroFromCollection"]);
    expect(sorted(collectionVerbs("card"))).toEqual(["TakeCardFromCollection"]);
    expect(sorted(collectionVerbs("treasure"))).toEqual(["AttachRandomTreasure", "ChooseRandomTreasure", "ClaimRandomTreasure", "SearchGuardForTreasure"]);
  });
});
