import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

// Records for the Drowned Ruins boons of the Dream-chaser Campaign Expansion: Command (11201 to 11204) and Círdan's Blessing (11205 to 11208), read from the scan ledger
// (data/printed/dream-chaser.json). Rules: dcce.scalable-upgradable, dcce.encounter-cards (data/rules/entries.json). The rest of the expansion's cards are in DCCE.ts.

type Options = Extract<Effect["instructions"][number], { verb: "Choose" }>["options"];
type Amount = Extract<Effect["instructions"][number], { verb: "DamageCard" }>["amount"];
const LEVEL_PLUS_CHOSEN: Amount = { level: true, plusChosen: true };

// 11201 to 11204 Command (events the campaign card of The Drowned Ruins lets each player take into hand; Scalable): "Action: Add Command to the victory display to choose up to X options, where X is
// its level" (plus 1 for each copy the Setup chose, "0 in any other game"). The actor takes options one at a time, each once, and may stop (Choose `upTo`). Every option names the cards it picks.
const BLESSING = "Cirdan's Blessing";
const ANY_HERO = { type: "hero", control: "any" } as const;
const ANY_ENEMY = { type: "enemy", control: "any", staging: true } as const;
const WITH_BLESSING: PickSpec = { type: "character", control: "any", hasAttachment: { names: [BLESSING] } };
const heroGets = (id: string, stat: "defense" | "willpower" | "attack"): Options[number] => ({
  id,
  instructions: [{ verb: "Pick", pick: ANY_HERO }, { verb: "ModifyStat", stat, amount: 2, until: "endOfRound", target: "picked" }],
});
const enemyGets = (id: string, stat: "defense" | "attack"): Options[number] => ({
  id,
  requires: { kind: "canPick", pick: ANY_ENEMY },
  instructions: [{ verb: "Pick", pick: ANY_ENEMY }, { verb: "ModifyStat", stat, amount: -2, until: "endOfRound", target: "picked" }],
});
const command = (code: string, options: Options): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [1, 2, 3, 4, 5].map((line) => `${code}:A:${line}`),
  timing: "action",
  cost: { kind: "playEvent" },
  instructions: [{ verb: "Choose", who: "actor", upTo: LEVEL_PLUS_CHOSEN, options }, { verb: "AddSourceToVictory" }],
});
// 11201:A:5 "Put an ally with cost X or less in your discard pile into play. Discard it at the end of the phase."
const CHEAP_ALLY = { type: "ally", control: "you", from: "discard", maxCost: { level: true, plusChosen: true }, intoPlay: true } as const;
// 11202:A:3 and 11203:A:5: every copy of the player's own cards the options name.
const SPYGLASS = "11180";
const SPYGLASS_FROM = (from: "hand" | "deck" | "discard"): PickSpec => ({ type: "card", control: "you", from, names: ["Spyglass"] });
// In campaign mode the Spyglass is the campaign's own card, which sits outside the game until a setup or this option puts it into play (dcce.campaign-mode, rr.play-and-put-into-play: "put into play" works from any out-of-play area):
// the option offers the copy from outside the game while none is in play, on its Upgraded side when the Campaign Log marks its boxes (the collection card is dealt as an upgraded card is). A standalone game has no such copy.
const SPYGLASS_OUTSIDE = { kind: "campaignCopyOutside", code: SPYGLASS } as const;
const BLESSINGS: PickSpec = { type: "attachment", control: "any", names: [BLESSING] };
const BOTTOM_CARD = { type: "card", control: "you", from: "deck", bottom: 1 } as const;
const ANY_LOCATION_NON_UNIQUE = { type: "location", control: "any", nonUnique: true } as const;
const ANY_ATTACHMENT = { type: "attachment", control: "any" } as const;
type InnerOptions = Extract<Options[number]["instructions"][number], { verb: "Choose" }>["options"];
const putSpyglass = (from: "hand" | "deck" | "discard"): InnerOptions[number] => ({
  id: `spyglass${from.charAt(0).toUpperCase()}${from.slice(1)}`,
  requires: { kind: "canPick", pick: SPYGLASS_FROM(from) },
  instructions: [{ verb: "Pick", pick: SPYGLASS_FROM(from) }, { verb: "PutIntoPlay", card: "picked", host: ANY_HERO }, ...(from === "deck" ? [{ verb: "ShuffleDeck" } as const] : [])],
});

const putSpyglassOutside: InnerOptions[number] = {
  id: "spyglassOutside",
  requires: SPYGLASS_OUTSIDE,
  instructions: [{ verb: "TakeCardFromCollection", code: SPYGLASS }, { verb: "PutIntoPlay", card: "picked", host: ANY_HERO }],
};

// 11205 to 11208 Círdan's Blessing (the boon the campaign card of The Drowned Ruins lets one player take into hand; Scalable): it enters play with X resources on it, X one more than its level in the Campaign
// Log (dcce.scalable-upgradable). The Leadership copy adds +3 Defense to the attached character as it defends, the Tactics copy +3 Attack as it attacks (both remove a resource from the card), the Spirit copy
// gives +3 Willpower for the phase (it exhausts and removes a resource), the Lore copy moves a resource to the attached hero's pool and heals it after the active location is explored.
const blessingResources = (code: string): Effect => ({
  id: `${code}:triggered:1`,
  cardCode: code,
  lines: [`${code}:A:2`],
  timing: "triggered",
  trigger: "enteredPlay",
  subject: "self",
  instructions: [{ verb: "AddResources", amount: { level: true, plus: 1 }, to: "self" }],
});
const blessingBoost = (code: string, trigger: "declaredDefender" | "declaredAttacker", stat: "defense" | "attack"): Effect => ({
  id: `${code}:response:1`,
  cardCode: code,
  lines: [`${code}:A:3`],
  timing: "response",
  trigger,
  subject: "host",
  cost: { kind: "resources", amount: 1, from: "self" },
  instructions: [{ verb: "ModifyStat", stat, amount: 3, until: "endOfAttack", target: "host" }],
});

export const RECORDS: readonly Effect[] = [
  // 11201 Command (Leadership), 11202 (Lore), 11203 (Spirit), 11204 (Tactics).
  command("11201", [
    heroGets("defense", "defense"),
    enemyGets("enemyDefense", "defense"),
    { id: "ready", requires: { kind: "canPick", pick: WITH_BLESSING }, instructions: [{ verb: "Pick", pick: WITH_BLESSING }, { verb: "Ready", target: "picked" }] },
    { id: "ally", requires: { kind: "canPick", pick: CHEAP_ALLY }, instructions: [{ verb: "Pick", pick: CHEAP_ALLY }, { verb: "PutIntoPlay", card: "picked", until: "endOfPhase", then: "discard" }] },
  ]),
  command("11202", [
    {
      id: "resources",
      requires: { kind: "canPick", pick: { ...ANY_ENEMY, nonUnique: true, hasResources: true } },
      instructions: [{ verb: "Pick", pick: { ...ANY_ENEMY, nonUnique: true, hasResources: true } }, { verb: "DiscardResources", amount: LEVEL_PLUS_CHOSEN, target: "picked" }],
    },
    { id: "blessings", requires: { kind: "canPick", pick: BLESSINGS }, instructions: [{ verb: "Each", pick: BLESSINGS, instructions: [{ verb: "AddResources", amount: 2, to: "picked" }] }] },
    { id: "bottom", requires: { kind: "canPick", pick: BOTTOM_CARD }, instructions: [{ verb: "Pick", pick: BOTTOM_CARD }, { verb: "MovePicked", to: "hand" }] },
    {
      id: "encounter",
      instructions: [
        { verb: "LookAtTop", count: 10 },
        { verb: "Each", pick: { type: "card", control: "any", from: "encounterDeck", looked: true }, upTo: "any", instructions: [{ verb: "MoveEncounterCard", to: "discard" }] },
        { verb: "ShuffleEncounterDeck" },
      ],
    },
  ]),
  command("11203", [
    heroGets("willpower", "willpower"),
    { id: "noExhaust", requires: { kind: "canPick", pick: WITH_BLESSING }, instructions: [{ verb: "Each", pick: WITH_BLESSING, instructions: [{ verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "endOfRound", target: "picked" }] }] },
    { id: "progress", requires: { kind: "canPick", pick: ANY_LOCATION_NON_UNIQUE }, instructions: [{ verb: "Pick", pick: ANY_LOCATION_NON_UNIQUE }, { verb: "PlaceProgressOn", amount: 2, target: "picked" }] },
    { id: "spyglass", requires: { kind: "any", conditions: [...(["hand", "deck", "discard"] as const).map((from) => ({ kind: "canPick" as const, pick: SPYGLASS_FROM(from) })), SPYGLASS_OUTSIDE] }, instructions: [{ verb: "Choose", who: "actor", options: [putSpyglass("hand"), putSpyglass("deck"), putSpyglass("discard"), putSpyglassOutside] }] },
  ]),
  command("11204", [
    heroGets("attack", "attack"),
    enemyGets("enemyAttack", "attack"),
    {
      id: "damage",
      requires: { kind: "canPick", pick: ANY_ENEMY },
      instructions: [
        { verb: "Pick", pick: ANY_ENEMY },
        { verb: "DamageCard", amount: 2, target: "picked" },
        { verb: "Choose", who: "actor", options: [{ id: "engageIt", requires: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", stagingOnly: true } }, instructions: [{ verb: "Engage", target: "picked" }] }, { id: "noEngage", instructions: [] }] },
      ],
    },
    {
      id: "attachment",
      requires: { kind: "canPick", pick: ANY_ATTACHMENT },
      instructions: [{ verb: "Pick", pick: ANY_ATTACHMENT }, { verb: "Ready", target: "picked" }, { verb: "Choose", who: "actor", options: [{ id: "moveIt", instructions: [{ verb: "Reattach", card: "picked" }] }, { id: "stayPut", instructions: [] }] }],
    },
  ]),

  // 11205 Círdan's Blessing (Leadership), 11206 (Tactics), 11207 (Spirit), 11208 (Lore).
  blessingResources("11205"),
  blessingBoost("11205", "declaredDefender", "defense"),
  blessingResources("11206"),
  blessingBoost("11206", "declaredAttacker", "attack"),
  blessingResources("11207"),
  {
    id: "11207:action:1",
    cardCode: "11207",
    lines: ["11207:A:3"],
    timing: "action",
    cost: [{ kind: "exhaustSelf" }, { kind: "resources", amount: 1, from: "self" }],
    instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 3, until: "endOfPhase", target: "host" }],
  },
  blessingResources("11208"),
  {
    id: "11208:response:1",
    cardCode: "11208",
    lines: ["11208:A:3"],
    timing: "response",
    trigger: "activeExplored",
    // "Move 1 resource ... Then, heal 1 damage" (rr.then): with no resource on the Blessing there is nothing to move, so the Response is not offered.
    condition: { kind: "matches", card: "self", pick: { type: "card", control: "any", minResources: 1 } },
    instructions: [
      { verb: "AddResources", amount: 1, to: "host" },
      { verb: "DiscardResources", amount: 1, target: "self" },
      { verb: "Heal", amount: 1, target: "host" },
    ],
  },
];

export const REPLACES: readonly string[] = [];
