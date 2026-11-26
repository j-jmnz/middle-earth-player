import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Dunland Trap (The Ring-maker part 4, The Dunland Trap, no campaign card): the three quest stages with Time 2 and Time X (5 times the players), Chief Turch, who engages the first player and takes a time counter off the quest each time an enemy engages, Old South Road, the Boar Clan enemies and the draw
// triggers (Stalker, Warrior, Foothills, Hills of Dunland), the locations that change the resource-phase draw and the encounter cards no template reads. The Dunland Warriors (07046 to 07049), Low on Provisions and the Weary Travelers (07056 to 07058) keep the records of their own files.
// Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Time X is the angmar family's (`Time`, with `perPlayer` for stage 3B); the draw is heard by the dreamchaser family's `cardsDrawn`;
// the flag Hills of Dunland uses to act once is in src/catalog/families/ring-maker.ts.
// Rules: rm.time-x, rm.does-not-stack, rr.engaged, rr.forced, rr.drawing-cards, rr.first-player, rr.cannot, rr.attachment-cards, rr.active-location, rr.search, rr.setup, rr.shadow-effects, rr.step-5-3, faq.enemy-attacks-outside-combat, faq.simultaneous-effects (data/rules/entries.json).
const TURCH = "08014";
const RAVINE = "08015";
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const SHUFFLED: Instruction = { verb: "ShuffleEncounterDeck" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const REFRESH: Condition = { kind: "phase", is: "Refresh" };
// Dunland enemies in play, staged or engaged (the Ravine's +1 Attack and +1 Defense).
const DUNLAND: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Dunland" };
// Each player searches the encounter deck and (unless the Setup) its discard pile for a Boar Clan enemy and puts it into play engaged with him; a card taken is gone for the next player, and the printed line says no "different", so a second player may take a second copy of a title.
const boarClan = (deckOnly: boolean): Instruction => EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Boar Clan", to: "engaged", ...(deckOnly ? { deckOnly: true as const } : {}) }]);
// "Each player discards each Item attachment and each Mount attachment he controls" (08012:A:1): the attachments he controls on any card.
const OWN_ATTACHMENT = (trait: string): PickSpec => ({ type: "attachment", control: "you", controlled: true, trait });
const OWN_ALLY: PickSpec = { type: "ally", control: "you" };
const ALLY_IN_HAND: PickSpec = { type: "ally", control: "you", from: "hand" };
const HAND_CARD: PickSpec = { type: "card", control: "you", from: "hand" };
// The draw triggers of the Boar Clan enemies fire only for the player the enemy is engaged with.
const ENGAGED_DRAW: Condition = { kind: "engagedWithActor" };
// "Draw" shapes of the resource phase: a location that is the active location changes how many cards each player draws.
const extraDraw = (code: string, amount: number, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "extraDraw", amount, until: "whileSourceInPlay", target: "eachSeat" }] });
const ATTACK_PLUS = (amount: number, when?: Condition): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 08011 The Road to Tharbad (stage 1). Setup: each player (in player order) searches the encounter deck for a Boar Clan enemy and puts it into play engaged with him; the deck is shuffled (Turch and the Ravine are set aside, Old South Road is the active location: the piles). Side B: Time 2; after the last counter each player discards his hand
  // and draws 2 cards (a draw each, heard after the effect), and 2 time counters go on the stage.
  { id: "08011:setup:1", cardCode: "08011", lines: ["08011:A:1"], timing: "setup", instructions: [boarClan(true), SHUFFLED] },
  { id: "08011:constant:1", cardCode: "08011", lines: ["08011:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 2 }] },
  {
    id: "08011:forced:1",
    cardCode: "08011",
    lines: ["08011:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    holdsEvents: true,
    instructions: [EACH_PLAYER([{ verb: "DiscardEach", pick: HAND_CARD }, { verb: "Draw", amount: 2 }]), { verb: "PlaceResourceTokens", amount: 2, on: "self" }],
  },

  // 08012 A Well Laid Trap (stage 2). A: the Ravine becomes the active location (the old one returns to the staging area); each player discards each Item and each Mount attachment he controls, then keeps 1 ally of his choice and discards the others (a player with no ally picks nothing: an empty pick would leave a blank pick in the frame that stage 2B's search shares). B: each player searches the encounter deck and discard pile for a Boar Clan enemy and puts it into
  // play engaged with him; the deck is shuffled; each player shuffles his discard pile into his deck and draws 1. Forced: at the end of the combat phase advance to stage 3A (stage 2B prints no Time).
  {
    id: "08012:whenRevealed:1",
    cardCode: "08012",
    lines: ["08012:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "MakeSetAsideActive", code: RAVINE },
      EACH_PLAYER([
        { verb: "DiscardEach", pick: OWN_ATTACHMENT("Item") },
        { verb: "DiscardEach", pick: OWN_ATTACHMENT("Mount") },
        { verb: "Pick", pick: OWN_ALLY, when: { kind: "canPick", pick: OWN_ALLY } },
        { verb: "DiscardEach", pick: { ...OWN_ALLY, different: true } },
      ]),
    ],
  },
  { id: "08012:whenRevealed:2", cardCode: "08012", lines: ["08012:B:1"], timing: "whenRevealed", holdsEvents: true, instructions: [boarClan(false), SHUFFLED, EACH_PLAYER([{ verb: "ShuffleDiscardIntoDeck" }, { verb: "Draw", amount: 1 }])] },
  { id: "08012:forced:1", cardCode: "08012", lines: ["08012:B:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Combat" }, instructions: [{ verb: "AdvanceStage" }] },

  // 08013 No Way Out (stage 3). A: Chief Turch is put into play engaged with the first player. B: Time X, X 5 times the players when the stage turns; a hero destroyed loses the game; after the last counter the players make engagement checks, each engaged enemy attacks (dealt a shadow card, outside the combat phase) and, no hero destroyed, the players win.
  { id: "08013:whenRevealed:1", cardCode: "08013", lines: ["08013:A:1"], timing: "whenRevealed", instructions: [{ verb: "ActAs", who: "firstPlayer" }, { verb: "EngageSetAside", code: TURCH }] },
  { id: "08013:constant:1", cardCode: "08013", lines: ["08013:B:1"], timing: "constant", instructions: [{ verb: "Time", amount: 5, perPlayer: true }] },
  { id: "08013:forced:1", cardCode: "08013", lines: ["08013:B:2"], timing: "forced", trigger: "characterDestroyed", subject: { type: "hero", control: "any" }, instructions: [{ verb: "LoseGame", reason: "A hero was destroyed" }] },
  { id: "08013:forced:2", cardCode: "08013", lines: ["08013:B:3"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "MakeEngagementChecks" }, { verb: "ImmediateAttackEach" }, { verb: "WinGame" }] },

  // 08014 Chief Turch. Cannot have attachments; cannot leave play (and, as the reading takes it, cannot be destroyed: `indestructible`). He engages the first player: in the staging area at once, and when the first player token passes he follows it. Forced: after any enemy engages a player (he is one) a time counter comes off the current quest.
  {
    id: "08014:constant:1",
    cardCode: TURCH,
    lines: ["08014:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotLeavePlay", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "08014:forced:1", cardCode: TURCH, lines: ["08014:A:2"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },
  { id: "08014:forced:2", cardCode: TURCH, lines: ["08014:A:2"], timing: "forced", trigger: "returnedToStaging", subject: "self", instructions: [{ verb: "EngageFirstPlayer" }] },
  { id: "08014:triggered:1", cardCode: TURCH, lines: ["08014:A:2"], timing: "triggered", trigger: "firstPlayerTokenPassed", instructions: [{ verb: "FollowFirstPlayer" }] },
  { id: "08014:forced:3", cardCode: TURCH, lines: ["08014:A:3"], timing: "forced", trigger: "engaged", subject: { type: "enemy", control: "any" }, instructions: [{ verb: "RemoveTimeFromQuest", amount: 1 }] },

  // 08015 Munuv Dûv Ravine. Every Dunland enemy in play, staged or engaged, gets +1 Attack and +1 Defense while it is in play (active, or back in the staging area).
  {
    id: "08015:constant:1",
    cardCode: RAVINE,
    lines: ["08015:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: DUNLAND },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: DUNLAND },
    ],
  },

  // 08016 Old South Road. Forced: at the end of each refresh phase, wherever it lies in play, a time counter comes off the current quest.
  { id: "08016:forced:1", cardCode: "08016", lines: ["08016:A:1"], timing: "forced", trigger: "endOfPhase", condition: REFRESH, instructions: [{ verb: "RemoveTimeFromQuest", amount: 1 }] },

  // 08017 Boar Clan Stalker. +1 Attack and +1 Defense for each resource token on it, at most +4. Forced: after the player it is engaged with draws, it gets a resource token.
  {
    id: "08017:constant:1",
    cardCode: "08017",
    lines: ["08017:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: { stat: "resources", of: "self", limit: 4 }, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "defense", amount: { stat: "resources", of: "self", limit: 4 }, until: "whileSourceInPlay", target: "self" },
    ],
  },
  { id: "08017:forced:1", cardCode: "08017", lines: ["08017:A:2"], timing: "forced", trigger: "cardsDrawn", condition: ENGAGED_DRAW, instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },

  // 08018 Boar Clan Warrior. Forced: after the player it is engaged with draws, it is dealt one more shadow card (it keeps it until it attacks). Shadow: +1 Attack for each shadow card on the attacker.
  { id: "08018:forced:1", cardCode: "08018", lines: ["08018:A:1"], timing: "forced", trigger: "cardsDrawn", condition: ENGAGED_DRAW, instructions: [{ verb: "DealShadow", additional: true }] },
  { id: "08018:shadow:1", cardCode: "08018", lines: ["08018:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { stat: "shadowCards", of: "attacker" }, until: "endOfAttack", target: "attacker" }] },

  // 08019 Hithaeglir Foothills. Surge is its keyword. Its Threat X is the resource tokens on it; each draw by any player puts 1 token on it.
  { id: "08019:constant:1", cardCode: "08019", lines: ["08019:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  { id: "08019:forced:1", cardCode: "08019", lines: ["08019:A:3"], timing: "forced", trigger: "cardsDrawn", instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }] },

  // 08020 Hills of Dunland. In the staging area it holds the flag `huntsOnDraw` (the oldest copy there alone: the clause does not stack); the holder's Forced effect, after a player draws, discards the top card of the encounter deck and puts it into play engaged with that player when it is a Dunland enemy.
  // Travel: each player draws a card (heard while the card is still in the staging area).
  { id: "08020:constant:1", cardCode: "08020", lines: ["08020:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "huntsOnDraw", amount: 1, until: "whileSourceInPlay", target: "self", doesNotStack: true }] },
  { id: "08020:forced:1", cardCode: "08020", lines: ["08020:A:1"], timing: "forced", trigger: "cardsDrawn", condition: { kind: "flag", stat: "huntsOnDraw", holder: "self" }, instructions: [{ verb: "DiscardEncounterTop", count: 1 }, { verb: "EngageTopDiscarded", trait: "Dunland" }] },
  { id: "08020:travel:1", cardCode: "08020", lines: ["08020:A:2"], timing: "travel", holdsEvents: true, instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }])] },

  // 08021 Plains of Enedwaith and 08022 Hithaeglir Stream. While active the players draw no card (Plains), or 2 instead of 1 (Stream), in the resource phase. Shadow: +1 Attack, +3 instead when undefended (Plains); +1 Attack and one more shadow card dealt to the attacker (Stream).
  extraDraw("08021", -1, "08021:A:1"),
  {
    id: "08021:shadow:1",
    cardCode: "08021",
    lines: ["08021:A:2"],
    timing: "shadow",
    instructions: [ATTACK_PLUS(1, { kind: "not", condition: { kind: "undefended" } }), ATTACK_PLUS(3, { kind: "undefended" })],
  },
  extraDraw("08022", 1, "08022:A:1"),
  { id: "08022:shadow:1", cardCode: "08022", lines: ["08022:A:2"], timing: "shadow", instructions: [ATTACK_PLUS(1), { verb: "DealShadow", additional: true }] },

  // 08023 Frenzied Attack. When Revealed: each player draws a card, then each discards each ally in his hand; with no ally discarded it gains surge. Shadow: the attacker cannot take damage until the end of the round.
  {
    id: "08023:whenRevealed:1",
    cardCode: "08023",
    lines: ["08023:A:1"],
    timing: "whenRevealed",
    holdsEvents: true,
    instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }]), EACH_PLAYER([{ verb: "DiscardEach", pick: ALLY_IN_HAND }]), { verb: "GainSurge", when: { kind: "noneDiscarded" } }],
  },
  { id: "08023:shadow:1", cardCode: "08023", lines: ["08023:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "attacker" }] },

  // 08024 Dunlending Ambush. Surge is its keyword. When Revealed: it attaches to the active location (a Condition attachment, limit 1 per location; with none, or a copy there, it is discarded). Forced: after the attached location is explored (the host leaving play explored: the attachment hears it as it is discarded) each player searches the encounter deck and discard pile for a Dunland enemy and puts it into play engaged with him; the deck is shuffled.
  { id: "08024:whenRevealed:1", cardCode: "08024", lines: ["08024:A:2"], timing: "whenRevealed", instructions: [{ verb: "AttachToActiveLocation" }] },
  { id: "08024:constant:1", cardCode: "08024", lines: ["08024:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "08024:forced:1",
    cardCode: "08024",
    lines: ["08024:A:2"],
    timing: "forced",
    trigger: "hostLeftPlay",
    condition: { kind: "subjectExplored" },
    instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Dunland", to: "engaged" }]), SHUFFLED],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
