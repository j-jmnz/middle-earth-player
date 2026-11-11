import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as JOURNEY_TO_THE_CROSS_ROADS } from "./journey-to-the-cross-roads.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for Shelob's Lair (the-two-towers part 6, campaign card 144073, whose records are in the-two-towers.ts): Shelob and her resource tokens, the Great Spider set lying beside the encounter deck (the wilderland pile `greatSpider`), the locations'
// Travel costs, the quest stages and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/the-two-towers.json); a line a template already writes (pnpm data build) or another card prints word for word
// needs no record here. See docs/brief.md, The Two Towers, for each reading.
// Rules: mec112.setup-shelobs-lair, mec112.gollum-smeagol, mec112.saga-staging-rules, mec112.multiplayer-the-one-ring, rr.forced, rr.travel, rr.cannot, rr.first-player, rr.effects, rr.then, rr.search, rr.reveal, rr.cancel, rr.damage, rr.victory,
// rr.explored, rr.active-location, rr.attachment-cards, rr.play-and-put-into-play, rr.in-player-order, faq.enemy-attacks-outside-combat, faq.additional-attacks (data/rules/entries.json).
const SHELOB = "144040";
const CLEFT = "144045";
const SECRET_WAY = "144044";
const MORGUL_WRAITH = "144053";
const ONE_RING = "144063";
const GOLLUM = "144075";
const SMEAGOL = "144076";
type Cond = NonNullable<Effect["condition"]>;
// An instruction a choice's option may hold (a simple verb), which a record's own instructions may hold too.
type Simple = Extract<Instruction, { verb: "Choose" }>["options"][number]["instructions"][number];
// Shelob in play, in the staging area or engaged with a player.
const SHELOB_IN_PLAY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Shelob"] };
const SHELOB_PLAYING: Cond = { kind: "canPick", pick: SHELOB_IN_PLAY };
const SHELOB_IS_ATTACKER: Cond = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: ["Shelob"] } };
const STAGING_LOCATIONS: PickSpec = { type: "location", control: "any", stagingOnly: true };
const WHEN_EXPLORED = { trigger: "leftPlay", subject: "self", condition: { kind: "subjectExplored" } } as const satisfies Partial<Effect>;
const RING_READY: Cond = { kind: "exhausted", code: ONE_RING, is: false };
const SOME_HAND_HOLDS_A_CARD: Cond = { kind: "anyHand", min: 1 };
const EVERY_HAND_HOLDS_A_CARD: Cond = { kind: "anyHand", min: 1, every: true };
const EACH_PLAYER_DISCARDS_ONE: Simple = { verb: "DiscardRandomFromHand", amount: 1, who: "eachSeat" };
// "Place 1 resource on Shelob": Shelob is picked first, the resource goes on the picked card (nothing when she is out of play).
const PLACE_ON_SHELOB: Simple[] = [{ verb: "Pick", pick: SHELOB_IN_PLAY }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }];
// "Shelob makes an immediate attack against" the actor (the player who revealed the card), as she is, engaged or not; she is dealt a shadow card (faq.enemy-attacks-outside-combat).
const SHELOB_ATTACKS: Simple[] = [{ verb: "Pick", pick: SHELOB_IN_PLAY }, { verb: "AttackFromStaging", orEngaged: true }];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 144040 Shelob (Indestructible and Cannot have attachments are keywords). +1 Threat for each resource on her. Forced at the beginning of the quest phase: the first player chooses to place 1 resource on her, or to be attacked by her now
    // (the attack is dealt a shadow card; an enemy engaged with the first player attacks as she is).
    { id: "144040:constant:2", cardCode: SHELOB, lines: ["144040:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay" }] },
    {
      id: "144040:forced:1",
      cardCode: SHELOB,
      lines: ["144040:A:3"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "place", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },
            { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer", orEngaged: true }] },
          ],
        },
      ],
    },

    // 144041 Morgul Orc (Peril). When Revealed: the revealing player discards 1 random card (an option only while the hand holds one) or reveals an additional encounter card. Shadow: when the attack destroys a character, the defending player discards 1 random card.
    {
      id: "144041:whenRevealed:1",
      cardCode: "144041",
      lines: ["144041:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "discard", requires: { kind: "handHasCard" }, instructions: [{ verb: "DiscardRandomFromHand" }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
    },
    { id: "144041:shadow:1", cardCode: "144041", lines: ["144041:A:3"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "DiscardRandomFromHand", when: { kind: "x", min: 1 } }] }] },

    // 144042 Orc of Cirith Ungol (Peril). When Revealed: the revealing player chooses each player discarding 1 random card (an option only while some hand holds one, a player with none discards nothing), or the Orc attacking them.
    {
      id: "144042:whenRevealed:1",
      cardCode: "144042",
      lines: ["144042:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "discard", requires: SOME_HAND_HOLDS_A_CARD, instructions: [EACH_PLAYER_DISCARDS_ONE] }, { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self" }] }] }],
    },

    // 144043 Morgul Vale. Forced after it is explored: a Morgul Wraith is searched from the encounter deck and discard pile and added to the staging area (not revealed), the deck is shuffled, and then, found or not, the first player chooses
    // to exhaust The One Ring (an option only while it is ready) or each player discards 1 random card (an option only while some hand holds one).
    {
      id: "144043:forced:1",
      cardCode: "144043",
      lines: ["144043:A:2"],
      timing: "forced",
      ...WHEN_EXPLORED,
      instructions: [
        { verb: "SearchMove", code: MORGUL_WRAITH, to: "staging" },
        { verb: "ShuffleEncounterDeck" },
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "exhaust", requires: RING_READY, instructions: [{ verb: "Exhaust", target: { kind: "byCode", code: ONE_RING } }] },
            { id: "discard", requires: SOME_HAND_HOLDS_A_CARD, instructions: [EACH_PLAYER_DISCARDS_ONE] },
          ],
        },
      ],
    },

    // 144044 Sméagol's Secret Way. Travel: the first player chooses the cost, exhausting Sméagol (while he is in play and ready) or each player discarding 1 random card (while every hand holds one); with neither payable the players cannot travel here.
    // Forced after it is explored: each player in order chooses to exhaust a ready character they control (Sméagol is the first player's) or to discard 1 random card.
    {
      id: "144044:travel:1",
      cardCode: SECRET_WAY,
      lines: ["144044:A:2"],
      timing: "travel",
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "exhaust", requires: { kind: "exhausted", code: SMEAGOL, is: false }, instructions: [{ verb: "Exhaust", target: { kind: "byCode", code: SMEAGOL } }] },
            { id: "discard", requires: EVERY_HAND_HOLDS_A_CARD, instructions: [EACH_PLAYER_DISCARDS_ONE] },
          ],
        },
      ],
    },
    {
      id: "144044:forced:1",
      cardCode: SECRET_WAY,
      lines: ["144044:A:3"],
      timing: "forced",
      ...WHEN_EXPLORED,
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "exhaust", requires: { kind: "canPick", pick: { type: "character", control: "you", state: "ready" } }, instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] },
                { id: "discard", requires: { kind: "handHasCard" }, instructions: [{ verb: "DiscardRandomFromHand" }] },
              ],
            },
          ],
        },
      ],
    },

    // 144045 Cleft of Cirith Ungol. While it is in the victory display Shelob gets +2 Attack, loses Indestructible and is engaged with the first player, moving with the token (as Gollum is). Travel: place 1 resource on Shelob (payable
    // only while she is in play, as 144049:A:2 prints the same).
    {
      id: "144045:constant:1",
      cardCode: CLEFT,
      lines: ["144045:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "victory" },
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", holders: SHELOB_IN_PLAY },
        { verb: "ModifyStat", stat: "losesKeywords", amount: 1, until: "whileSourceInPlay", holders: SHELOB_IN_PLAY },
        { verb: "ModifyStat", stat: "engagedWithFirst", amount: 1, until: "whileSourceInPlay", holders: SHELOB_IN_PLAY },
      ],
    },
    { id: "144045:travel:1", cardCode: CLEFT, lines: ["144045:A:3"], timing: "travel", instructions: PLACE_ON_SHELOB },
    copyLine("144045:A:3", "144049:A:2"),

    // 144046 The Spider's Lair. When explored 1 resource comes off Shelob; after it becomes the active location Shelob attacks the first player (she is dealt a shadow card), neither while she is out of play.
    { id: "144046:forced:1", cardCode: "144046", lines: ["144046:A:1"], timing: "forced", ...WHEN_EXPLORED, instructions: [{ verb: "RemoveResourceTokens", code: SHELOB, amount: 1 }] },
    {
      id: "144046:forced:2",
      cardCode: "144046",
      lines: ["144046:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "Pick", pick: SHELOB_IN_PLAY }, { verb: "AttackFromStaging", who: "firstPlayer", orEngaged: true, when: SHELOB_PLAYING }],
    },

    // 144047 The Under-way. While it is in the staging area each Orc enemy gets -5 engagement cost and gains the Forced effect "after this enemy engages a player, deal it a shadow card" (each copy in the staging area gives one).
    // Shadow: the attacking enemy is dealt 2 additional shadow cards, which resolve after the ones it has.
    {
      id: "144047:constant:1",
      cardCode: "144047",
      lines: ["144047:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -5, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, trait: "Orc" } }],
    },
    {
      id: "144047:forced:1",
      cardCode: "144047",
      lines: ["144047:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: { type: "enemy", control: "any", trait: "Orc" },
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "DealShadowTo", target: "subject" }],
    },
    { id: "144047:shadow:1", cardCode: "144047", lines: ["144047:A:2"], timing: "shadow", instructions: [{ verb: "DealShadowTo", target: "attacker" }, { verb: "DealShadowTo", target: "attacker" }] },

    // 144048 Deep Dark Passage (Travel: exhaust Sméagol is a template). While it is in the staging area each placement of progress on a location in the staging area, itself included, is reduced by 1; copies in the staging area add up.
    {
      id: "144048:constant:1",
      cardCode: "144048",
      lines: ["144048:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "progressReduced", amount: 1, until: "whileSourceInPlay", holders: STAGING_LOCATIONS }],
    },

    // 144049 Den of Night. While it is in the staging area, after the effects of an encounter card are canceled (We Hates Them!'s own cancel counts), 1 resource goes on Shelob; each copy in the staging area places one. Travel is a copy of Cleft's.
    {
      id: "144049:forced:1",
      cardCode: "144049",
      lines: ["144049:A:1"],
      timing: "forced",
      trigger: "whenRevealedCanceled",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: PLACE_ON_SHELOB,
    },

    // 144050 Exhalation of Decay. When Revealed: each player in order discards 1 random card and 1 non-objective attachment they control (each only when they have one). Shadow is Hills of Ithilien's.
    {
      id: "144050:whenRevealed:1",
      cardCode: "144050",
      lines: ["144050:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardRandomFromHand" }, { verb: "Pick", pick: { type: "attachment", control: "you", nonObjective: true } }, { verb: "DiscardPicked" }] }],
    },
    copyLine("144035:A:2", "144050:A:2"),

    // 144051 Many Openings (Surge is not printed). When Revealed: each location in the staging area, those that arrive later in the round too, gets +1 Threat until the end of the round; then, with fewer locations in the staging area than
    // players, the revealing player reveals an additional encounter card. Shadow: the attacking enemy gets +X Attack, X the active location's Threat (0 with none).
    {
      id: "144051:whenRevealed:1",
      cardCode: "144051",
      lines: ["144051:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfRound", holders: STAGING_LOCATIONS },
        { verb: "RevealEncounter", when: { kind: "less", left: { count: STAGING_LOCATIONS }, right: { players: true } } },
      ],
    },
    { id: "144051:shadow:1", cardCode: "144051", lines: ["144051:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "threat", of: "activeLocation" }, until: "endOfAttack", target: "attacker" }] },

    // 144052 A Heavy Burden (Permanent; its Setup is the campaign card's). Forced at the end of the planning phase: the first player (who controls the Ring-bearer) chooses to raise each player's threat by 1 or to exhaust the Ring-bearer (while it is ready).
    {
      id: "144052:forced:1",
      cardCode: "144052",
      lines: ["144052:A:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Planning" },
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },
            { id: "exhaust", requires: { kind: "matches", card: "host", pick: { type: "hero", control: "any", state: "ready" } }, instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "host" } }] },
          ],
        },
      ],
    },

    // 144059 Blocked Tunnel (the Great Spider set). When Revealed it becomes the active location, the old one returning to the staging area with its progress (no Travel cost). Action, any player: exhaust a ready character they control with a Weapon
    // attachment to place 3 progress on it, in the staging area or active, before any reduction.
    { id: "144059:whenRevealed:1", cardCode: "144059", lines: ["144059:A:1"], timing: "whenRevealed", instructions: [{ verb: "MakeActive", target: "self" }] },
    {
      id: "144059:action:1",
      cardCode: "144059",
      lines: ["144059:A:2"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "canPick", pick: { type: "character", control: "you", state: "ready", hasAttachment: { trait: "Weapon" } } },
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready", hasAttachment: { trait: "Weapon" } } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "PlaceProgressOn", amount: 3, target: "self" }],
    },

    // 144060 Shelob's Poison. When Revealed: it attaches to a hero its player controls that carries none (Limit 1 per hero) and exhausts that hero; with no such hero it is discarded. Attached, it counts as a Condition: the hero's text box is blank
    // except for Traits and it cannot ready. Shadow: with Shelob attacking, its When Revealed effect resolves for the defending player, and the card stays on the hero.
    {
      id: "144060:whenRevealed:1",
      cardCode: "144060",
      lines: ["144060:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "you" } }, { verb: "Exhaust", target: { kind: "ref", ref: "host" } }],
    },
    {
      id: "144060:constant:1",
      cardCode: "144060",
      lines: ["144060:A:1"],
      timing: "constant",
      instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" }],
    },
    { id: "144060:shadow:1", cardCode: "144060", lines: ["144060:A:2"], timing: "shadow", instructions: [{ verb: "ResolveWhenRevealed", card: "self", when: SHELOB_IS_ATTACKER }] },

    // 144061 Lurking Malice (Peril, Surge). When Revealed: the revealing player chooses to place 1 resource on Shelob or to be attacked by her, each only while she is in play. Shadow: with Shelob attacking, 1 resource goes on her, then she
    // gets +1 Attack for each resource on her until the end of the attack.
    {
      id: "144061:whenRevealed:1",
      cardCode: "144061",
      lines: ["144061:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "place", requires: SHELOB_PLAYING, instructions: PLACE_ON_SHELOB }, { id: "attack", requires: SHELOB_PLAYING, instructions: SHELOB_ATTACKS }] }],
    },
    {
      id: "144061:shadow:1",
      cardCode: "144061",
      lines: ["144061:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "PlaceResourceTokens", amount: 1, on: "attacker", when: SHELOB_IS_ATTACKER },
        { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "attacker" }, until: "endOfAttack", target: "attacker", when: SHELOB_IS_ATTACKER },
      ],
    },

    // 144062 Rage and Hunger. When Revealed: Shelob gets +2 Attack until the end of the phase and attacks each player in player order, each attack dealt a shadow card; nothing while she is out of play. Shadow: with Shelob attacking, she makes
    // an additional attack against the defending player after this one, dealt a new shadow card (faq.additional-attacks).
    {
      id: "144062:whenRevealed:1",
      cardCode: "144062",
      lines: ["144062:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", holders: SHELOB_IN_PLAY },
        { verb: "Pick", pick: SHELOB_IN_PLAY },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "AttackFromStaging", orEngaged: true, when: SHELOB_PLAYING }] },
      ],
    },
    { id: "144062:shadow:1", cardCode: "144062", lines: ["144062:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true, when: SHELOB_IS_ATTACKER }] },

    // 144070 The Stairs of Cirith Ungol (stage 1). Setup: Cleft, Shelob and the Great Spider set are set aside, Morgul Vale is active and the Secret Way is in the staging area by the data; Sméagol enters play under the first player's control and the
    // encounter deck is shuffled. Progress cannot be placed on Underground locations. Response: after the Secret Way is explored, with a Nazgûl enemy in the staging area and every hand holding 3 cards, every player discards 3 random cards to
    // discard each Nazgûl enemy in the staging area (the cost is paid in full). Forced: at the end of the quest phase with the Secret Way in the victory display the quest advances to stage 2.
    { id: "144070:setup:1", cardCode: "144070", lines: ["144070:A:1"], timing: "setup", instructions: [{ verb: "TakeControlOfSetAside", code: SMEAGOL }, { verb: "ShuffleEncounterDeck" }] },
    { id: "144070:constant:1", cardCode: "144070", lines: ["144070:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", trait: "Underground" } }] },
    {
      id: "144070:response:1",
      cardCode: "144070",
      lines: ["144070:B:2"],
      timing: "response",
      trigger: "locationExplored",
      subject: { type: "location", control: "any", names: ["Sméagol's Secret Way"] },
      anyPlayer: true,
      condition: { kind: "all", conditions: [{ kind: "canPick", pick: { type: "enemy", control: "any", stagingOnly: true, trait: "Nazgûl" } }, { kind: "anyHand", min: 3, every: true }] },
      instructions: [{ verb: "DiscardRandomFromHand", amount: 3, who: "eachSeat" }, { verb: "Each", pick: { type: "enemy", control: "any", stagingOnly: true, trait: "Nazgûl" }, instructions: [{ verb: "Discard", target: { kind: "picked" } }] }],
    },
    { id: "144070:forced:1", cardCode: "144070", lines: ["144070:B:3"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "inVictory", code: SECRET_WAY, is: true }] }, instructions: [{ verb: "AdvanceStage" }] },

    // 144071 The Spider's Pass (stage 2). When Revealed: Shelob joins the staging area and the Great Spider set and the encounter discard pile are shuffled into the encounter deck (Gollum / Sméagol is never among them). Shelob cannot leave the staging
    // area; Sméagol cannot attack or defend. Each player cannot play or put into play more than 1 ally each round. No more than 4 progress can be placed on this stage each round.
    {
      id: "144071:whenRevealed:1",
      cardCode: "144071",
      lines: ["144071:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AddSetAsideToStaging", code: SHELOB }, { verb: "ShuffleEncounterDiscard" }, { verb: "ShufflePileIntoEncounterDeck", pile: "greatSpider" }],
    },
    {
      id: "144071:constant:1",
      cardCode: "144071",
      lines: ["144071:B:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", holders: SHELOB_IN_PLAY },
        { verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any", names: ["Sméagol"] } },
        { verb: "ModifyStat", stat: "cannotDefend", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any", names: ["Sméagol"] } },
      ],
    },
    { id: "144071:constant:2", cardCode: "144071", lines: ["144071:B:2"], timing: "constant", instructions: [{ verb: "LimitEntries", cardType: "ally", max: 1, perPlayer: true }] },
    { id: "144071:constant:3", cardCode: "144071", lines: ["144071:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 4, until: "whileSourceInPlay", target: "table" }] },

    // 144072 Gollum's Betrayal (stage 3). When Revealed: Cleft joins the staging area, Sméagol flips to Gollum (engaged with the first player), all damage is healed from Shelob and each player places 1 resource on her. Defeated, Gollum goes to the
    // victory display as he is, not flipped (144075:A:3's flip does not apply on this stage). While Shelob holds a resource, damage she would be dealt, all of one instance, is canceled for 1 resource. The stage cannot be defeated unless Shelob and
    // Gollum are in the victory display; defeating it, the last stage, wins the game (rr.winning-the-game).
    {
      id: "144072:whenRevealed:1",
      cardCode: "144072",
      lines: ["144072:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "AddSetAsideToStaging", code: CLEFT },
        { verb: "FlipGollum", to: "gollum" },
        { verb: "Pick", pick: SHELOB_IN_PLAY },
        { verb: "Heal", all: true, target: "picked", when: SHELOB_PLAYING },
        { verb: "PlaceResourceTokens", amount: { players: true }, on: "picked" },
      ],
    },
    { id: "144072:forced:1", cardCode: "144072", lines: ["144072:B:1"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", names: ["Gollum"] }, instructions: [{ verb: "AddToVictory", target: "subject" }] },
    { id: "144072:constant:1", cardCode: "144072", lines: ["144072:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "resourceCancel", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Shelob"], hasResources: true } }] },
    {
      id: "144072:constant:2",
      cardCode: "144072",
      lines: ["144072:B:3"],
      timing: "constant",
      condition: { kind: "any", conditions: [{ kind: "inVictory", code: SHELOB, is: false }, { kind: "inVictory", code: GOLLUM, is: false }] },
      instructions: [{ verb: "Restrict", what: "advance" }],
    },
  ],
  { pool: JOURNEY_TO_THE_CROSS_ROADS },
);

export const AUTHORED_REPLACES: readonly string[] = [];
