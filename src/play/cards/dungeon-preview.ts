// Rules: rr.guarded, rr.attachment-cards, rr.in-play-and-out-of-play, rr.ownership-and-control (data/rules/entries.json); ledger lines 01108:A:1-2, 01107:A:1, 01123:B:1, 01105:A:1.
// The one line a card of Escape from Dol Guldur says about itself in the card preview (table-preview.ts) when it has more to say than its text:
// an objective's guard, the prisoner, an Orc Guard's card, Iron Shackles on a deck; and of A Storm on Cobas Haven, a tower the players control and the Ship enemy a location holds out of play. The engine decided each; nothing here changes one.
import { poisonDetail } from "./poison-preview.ts";
import { freeOfEncounters } from "../../rules/families/objectives/index.ts";
import { captivesUnder } from "../../rules/families/captives/values.ts";
import { heroGuardedBy } from "../../rules/families/wilderland/carried.ts";
import { cardsUnder } from "../../rules/core/zones.ts";
import { flagged, heldAmount } from "../../rules/core/state.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { committedInStaging } from "../../rules/families/pelargir/committed.ts";
import { questStatOf } from "../../rules/quest/quest.ts";
import { FALLEN_SUFFIX, ORC_GUARD_CODE, fallenBase, isShipObjectiveCode, printedOf, type PrintedCard } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { STAT_WORD } from "./card-effects.ts";
import { ownerWords } from "../words/owner.ts";
import { prisonerWords } from "../readouts/widgets.ts";
import { pelennorDetail } from "./pelennor-preview.ts";
import { keptDetail } from "../readouts/standalone-scenarios/wizards-quest.ts";
import { angmarDetail } from "./angmar-preview.ts";
import { ringMakerDetail } from "./ring-maker/preview.ts";
import { barrowDetail } from "../readouts/standalone-scenarios/barrow-downs.ts";
import { ungolDetail } from "./ungol-preview.ts";
import { stoneDetail } from "./stone-preview.ts";
import { flameDetail } from "./flame-preview.ts";
import { rhovanionDetail } from "./rhovanion-preview.ts";
import { plotLine, underworldLine } from "../readouts/against-the-shadow/stewards-fear.ts";
import { cairAndrosDetail } from "./against-the-shadow/cair-andros-preview.ts";
import { amonDinDetail } from "../readouts/against-the-shadow/amon-din.ts";
import { druadanDetail } from "./against-the-shadow/druadan-preview.ts";
import { osgiliathControlSpeech, osgiliathDetail } from "../readouts/against-the-shadow/osgiliath.ts";
import { bloodDetail } from "../readouts/against-the-shadow/blood.ts";
import { valeDetail } from "../readouts/against-the-shadow/vale.ts";

/**
 * The text of the engine's Orc Guard stand-in, and of a hero Fallen Into Evil made an enemy (`<code>~enemy`; its card shows the hero's art and its game text
 * is blank), from their printed definitions (rules/core/printed.ts): the stats a real card would print. Null for any other code.
 */
export function standInText(cards: ReadonlyMap<string, PrintedCard>, code: string, textOf: (code: string) => string | null = () => null): string | null {
  const fallen = code.endsWith(FALLEN_SUFFIX);
  // A Ship enemy the players took control of as a Ship objective (Corsair Skirmisher, 12125:A:3): its definition is a derived one too (printed.ts), its card shows the enemy's art, and its printed lines
  // (`textOf` the enemy's code: "Immune to player card effects" is still true of it) follow its stats.
  if (isShipObjectiveCode(code) && cards.has(fallenBase(code))) {
    const ship = printedOf(cards, code);
    const stats = `Ship objective. Willpower ${ship.willpower ?? 0} (its Threat), Attack ${ship.attack ?? 0}, Defense ${ship.defense ?? 0}, ${ship.health ?? 0} hit point${ship.health === 1 ? "" : "s"}.`;
    const printed = textOf(fallenBase(code));
    return printed ? `${stats}\n${printed}` : stats;
  }
  if (code !== ORC_GUARD_CODE && !(fallen && cards.has(fallenBase(code)))) return null;
  const printed = printedOf(cards, code);
  const threat = printed.threat ? `Threat ${printed.threat}` : "no Threat";
  return `${fallen ? "Fallen into evil: an enemy now" : "Enemy"}. Attack ${printed.attack ?? 0}, Defense ${printed.defense ?? 0}, ${printed.health ?? 0} hit point${printed.health === 1 ? "" : "s"}, ${threat}.`;
}

// Celador or an Ithilien Guardian in the staging area (05025:A:1, 05026:A:1; ats.ally-objectives, hon.battle, hon.siege): committed to the quest by its own text, with the stat the stage counts (Attack under Battle, Defense under Siege) and its value now.
function ithilienDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || !committedInStaging(game, cardId)) return null;
  const stat = questStatOf(game, cardId, ctx.cards);
  const value = modifiedStat(game, card, stat, ctx.cards);
  return `Committed to the quest from the staging area, adding ${value} ${STAT_WORD[stat]} to the quest total. No player controls the card: it cannot attack, defend or pay a cost.`;
}

/** The muted line under a card's name in its preview, or null: what only the table knows about it. */
export function dungeonDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  if (card.code === ORC_GUARD_CODE) return "The facedown card under it returns to its owner's discard pile when it leaves play.";
  if (card.prisoner === true && card.zone === "captive" && card.host == null) return prisonerWords(name(cardId));
  // Iârion under Rescue Iârion, the hands under Lost in the Wilderness, Protect the Innocent and the current quest are told before the Captives' words, which would call a card held under a side quest a hero's Captive.
  const angmar = angmarDetail(game, ctx, cardId, name);
  if (angmar) return angmar;
  // Gríma on The Islet or in a play area and Ill Tidings in a hand (The Fords of Isen).
  const ringMaker = ringMakerDetail(game, cardId, name);
  if (ringMaker) return ringMaker;
  // The Ring-bearer under Topmost Chamber, the boons on Shagrat and Last of the Company are told before the held-hero words of Lost in Mirkwood, which would call the Chamber an enemy that holds a hero facedown.
  const ungol = ungolDetail(game, card, name);
  if (ungol) return ungol;
  const stone = stoneDetail(game, ctx, cardId, name);
  if (stone) return stone;
  const flame = flameDetail(game, cardId, name);
  if (flame) return flame;
  const kept = keptDetail(game, cardId, name);
  if (kept) return kept;
  const captive = captiveDetail(game, ctx, card, name);
  if (captive) return captive;
  // Poison under a character is a facedown player card too: told before the hands of Lost in Mirkwood, which would call it a hand under a location.
  const poisoned = poisonDetail(game, ctx, cardId);
  if (poisoned) return poisoned;
  const ithilien = ithilienDetail(game, ctx, cardId);
  if (ithilien) return ithilien;
  // Assault on Osgiliath: a location a player controls, a unique location's undefended Forced line, Ruined Tower, Pinned Down and Southron Commander (keyed on the scenario).
  const osgiliath = osgiliathDetail(game, ctx, cardId);
  if (osgiliath) return osgiliath;
  // The Blood of Gondor: a Travel cost of hidden cards, The Cross-roads, the two allies, Black Númenorean (keyed on the scenario).
  const blood = bloodDetail(game, ctx, cardId);
  if (blood) return blood;
  // The Morgul Vale: a Captain, the Morgul Bodyguard, To the Tower and The White Bridge (keyed on the scenario).
  const vale = valeDetail(game, ctx, cardId);
  if (vale) return vale;
  const lost = kingsQuestDetail(game, ctx, card, name) ?? lostInMirkwoodDetail(game, ctx, card, name) ?? heathDetail(game, ctx, card, name) ?? rhovanionDetail(game, ctx, card) ?? pelennorDetail(game, ctx, card) ?? barrowDetail(game, ctx, cardId, name) ?? cairAndrosDetail(game, ctx, cardId) ?? druadanDetail(game, ctx, cardId, name) ?? underworldLine(game, ctx, cardId) ?? plotLine(game, cardId) ?? amonDinDetail(game, cardId);
  if (lost) return lost;
  const everyone = engagedWithAllWords(game, card);
  if (everyone) return everyone;
  if (game.seats.some((seat) => seat.deckAttached?.includes(cardId))) return `${name(cardId)}: your next draw is discarded`;
  // A treasure attached as a guarded objective (AttachRandomTreasure) is told like an objective: who guards it, or that it is free of encounters (emce.treasure).
  const kind = ctx.cards.get(card.code)?.type;
  if (card.zone === "staging" && (kind === "objective" || kind === "treasure")) {
    const guards = guardsOf(game, card);
    // A tower the players control that a Ship enemy guards again (Siege Ship, The Raiders' Assault) stays theirs: control is taken once.
    if (guards.length > 0) return `Guarded by ${guards.map(name).join(", ")}${playersControl(card) ? ". The players still control it." : ""}`;
    // A treasure free of encounters is claimed by the players at once (the settle sweep, emce.treasure): the first player chooses the character that carries it.
    if (kind === "treasure" && freeOfEncounters(game, cardId)) return "Free of encounters: the players claim it";
    if (claimable(ctx, card.code) && freeOfEncounters(game, cardId)) return "Free of encounters: you can claim it";
    // A tower freed of encounters stays in the staging area, controlled by the players as a group (ControlWhenFree, 12134:A:2): it has no hero to hang on.
    if (playersControl(card)) return "Free of encounters: the players control it";
  }
  // A Ship enemy a location holds out of play while it is the active location (Belfalas Islet, 12129:A:2): faceup, but not on the table.
  const held = Object.values(game.cards).filter((other) => other.zone === "under" && other.host === cardId && game.sea?.held?.[other.id] != null);
  if (held.length > 0) return `${held.map((other) => name(other.id)).join(", ")} is held underneath, out of play, while this is the active location`;
  return null;
}

// Whose a seat's hero or hand is, as the preview says it: "Player 2's" two-handed, "your" solo.

// The Captives of The Uruk-hai (ledger lines 143022:A:1, 143024:A:1, 143024:A:2, 143070:B:3): a Captive says who holds it and that its text box is blank, as a live card's text is not; the card that holds Captives names them. The engine decided each; this only says it.
function captiveDetail(game: ScenarioState, ctx: ReduceContext, card: ScenarioState["cards"][string], name: (id: string) => string): string | null {
  if (card.captive === true && card.zone === "captive") {
    const host = card.host != null ? game.cards[card.host] : undefined;
    const hero = card.owner != null ? `${ownerWords(game.seatCount, card.owner)} hero` : "A hero";
    if (host && ctx.cards.get(host.code)?.type === "enemy") return `${hero}, a Captive held by ${name(host.id)}. No one controls it and its text box is blank. It takes 1 damage at the end of each quest phase until ${name(host.id)} leaves play.`;
    return `${hero}, a Captive held under ${host ? name(host.id) : "To Isengard!"} No one controls it and its text box is blank until the players win.`;
  }
  const held = captivesUnder(game, card.id);
  if (held.length === 0) return null;
  const list = held.map(name).join(", ");
  return ctx.cards.get(card.code)?.type === "enemy"
    ? `Holds ${list}, a Captive. It takes 1 damage at the end of each quest phase until ${name(card.id)} leaves play.`
    : `Holds ${list} as ${held.length === 1 ? "a Captive" : "Captives"}. No one controls ${held.length === 1 ? "it" : "them"}, and ${held.length === 1 ? "its" : "their"} text ${held.length === 1 ? "box is" : "boxes are"} blank until the players win.`;
}

// Lost in Mirkwood's cards (ledger lines 18074:B:2, 18075:B:2, 18075:B:3, 18076:B:1 to 18076:B:3): an enemy that holds a hero facedown, a location with a hand facedown under it, and the nemesis. The engine decided each; this only says it.
function lostInMirkwoodDetail(game: ScenarioState, ctx: ReduceContext, card: ScenarioState["cards"][string], name: (id: string) => string): string | null {
  const heroId = heroGuardedBy(game, card.id);
  const hero = heroId ? game.cards[heroId] : undefined;
  if (heroId && hero?.owner != null) return `Holds ${name(heroId)}, ${ownerWords(game.seatCount, hero.owner)} hero, facedown. Defeat or discard it to free the hero, exhausted.`;
  const hands = new Map<number, number>();
  for (const id of cardsUnder(game, card.id)) {
    const owner = game.cards[id]?.owner;
    if (owner != null) hands.set(owner, (hands.get(owner) ?? 0) + 1);
  }
  if (hands.size > 0) {
    return [...hands].map(([seat, count]) => `${ownerWords(game.seatCount, seat).replace(/^./, (first) => first.toUpperCase())} hand, ${count} ${count === 1 ? "card" : "cards"}, facedown under it: back to hand when explored, discarded if the players advance`).join(". ");
  }
  if (card.nemesis !== true) return null;
  const stage = game.questStage ? ctx.cards.get(game.cards[game.questStage]?.code ?? "")?.questPoints : null;
  return `The nemesis is immune to player card effects. It takes no damage while the stage has fewer than ${stage ?? 8} progress, and it blocks the stage while in play. At the end of each round it returns to the staging area and attacks the first player. Defeating it wins the game.`;
}

// The King's Quest's cards (ledger lines 18050:A:2, 18043:A:3, 12172:A:2): the card Hobgoblin holds faceup under it, an Artifact guarded in the staging area, and The Threat to Wilderland's resources. The engine decided each; this only says it.
function kingsQuestDetail(game: ScenarioState, ctx: ReduceContext, card: ScenarioState["cards"][string], name: (id: string) => string): string | null {
  const held = cardsUnder(game, card.id).map((id) => game.cards[id]).find((other) => other?.held === true);
  if (held) return `Holds ${name(held.id)}, ${held.owner != null ? ownerWords(game.seatCount, held.owner) : "a player's"} card, faceup. It ${held.heldDiscard === true ? "is discarded" : "returns to its owner's hand"} when ${name(card.id)} leaves play.`;
  if (card.zone !== "staging") return null;
  // The Artifact Dragon Hoard set up (GuardPickedAttachment remembers the record on it), not any attachment that lies in the staging area.
  if (ctx.cards.get(card.code)?.type === "attachment" && card.setUpBy != null) {
    const guards = guardsOf(game, card);
    return guards.length > 0 ? `Guarded by ${guards.map(name).join(", ")}. Once nothing guards it, the first player claims it for a character.` : null;
  }
  if (card.code !== "12172") return null;
  const left = card.resources;
  return left > 0
    ? `${left} ${left === 1 ? "resource" : "resources"}: one is removed at the beginning of each quest phase. Then the first player chooses: each player raises their threat by 2, or every encounter card is immune to player card effects this phase`
    : "No resources left: it does nothing";
}

// The Withered Heath's cards (ledger lines 19012:A:1 to 19012:A:3, 19023:B:2, 19023:B:3, 19025:B:1, 19024:A:1, 19024:B:2): a Dragon Sign and its guard, Cold-Drake while a stage makes it engaged with each player and caps its damage, and the damage it keeps set aside.
// The engine decided each; this only says it.
function heathDetail(game: ScenarioState, ctx: ReduceContext, card: ScenarioState["cards"][string], name: (id: string) => string): string | null {
  if (card.code === "19012" && card.zone === "staging") {
    const guards = guardsOf(game, card);
    const fate = guards.length > 0
      ? `Guarded by ${guards.map(name).join(", ")}, which is immune to player card effects. When nothing guards it, it goes to the victory display.`
      : "Free of encounters: it goes to the victory display.";
    return `${fate} ${signCount(game, ctx)}`;
  }
  // A stage whose records read the Dragon Signs in the victory display (19022:B:2, 19024:B:3, 19025:B:1): how many lie there, how many the treasure takes, and Cold-Drake's kept damage while it is set aside.
  if (card.zone === "questStage" && ctx.effects.some((effect) => effect.cardCode === card.code && JSON.stringify(effect).includes('"Dragon Sign"'))) {
    const drake = Object.values(game.cards).find((other) => other.code === "19011" && other.zone === "setAside" && other.keepsDamage === true);
    const heal = ctx.effects.find((effect) => effect.id === "19024:forced:2")?.instructions.find((step) => step.verb === "RemoveSetAsideDamage");
    const kept = drake && drake.damage > 0 ? ` ${name(drake.id)} is set aside with ${drake.damage} damage${heal?.verb === "RemoveSetAsideDamage" ? `; ${heal.amount} come off each round` : ""}.` : "";
    return `${signCount(game, ctx)}${kept}`;
  }
  if (card.code !== "19011") return null;
  if (card.zone === "setAside") {
    // 19024:B:2: "At the end of the round, remove 3 damage tokens from the set-aside Cold-Drake."
    const heal = ctx.effects.find((effect) => effect.id === "19024:forced:2")?.instructions.find((step) => step.verb === "RemoveSetAsideDamage");
    return card.keepsDamage === true && card.damage > 0 ? `Set aside with ${card.damage} damage, which it keeps when it returns.${heal?.verb === "RemoveSetAsideDamage" ? ` ${heal.amount} damage come off it at the end of each round.` : ""}` : null;
  }
  if (card.zone !== "staging" && card.zone !== "engaged") return null;
  const lines: string[] = [];
  const all = engagedWithAllWords(game, card);
  if (all) lines.push(all.replace(/\.$/, ""));
  const cap = heldAmount(game, card.id, "damageCap");
  // A cap that counts the Dragon Signs in the victory display (19025:B:1) says so; a fixed one (19023:B:2) does not.
  const stage = game.questStage ? game.cards[game.questStage]?.code : undefined;
  const counted = ctx.effects.some((effect) => effect.cardCode === stage && effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "damageCap" && typeof step.amount === "object"));
  if (cap > 0) lines.push(`Takes at most ${cap} damage each round (${counted ? "1 for each Dragon Sign in the victory display; " : ""}${Math.max(0, cap - (game.roundDamage?.[card.id] ?? 0))} more this round)`);
  const ceiling = heldAmount(game, card.id, "damageCeiling");
  if (ceiling > 0) lines.push(`Never has more than ${ceiling} damage${flagged(game, card.id, "indestructible") ? ", and stays in play even then" : ""}`);
  return lines.length > 0 ? `${lines.join(". ")}.` : null;
}

// A card held engaged with each player (Cold-Drake under a Withered Heath stage, Old Man Willow, the Carn Dûm, Cirith Ungol and Fate of Wilderland cards): the words that say what the flag does.
function engagedWithAllWords(game: ScenarioState, card: ScenarioState["cards"][string]): string | null {
  if ((card.zone !== "staging" && card.zone !== "engaged") || !flagged(game, card.id, "engagedWithAll")) return null;
  return "Engaged with each player from the staging area. It attacks every player in the combat phase, any player's characters can attack it, and it adds no Threat.";
}

// "N of 4 Dragon Signs in the victory display; 4 discover a treasure." (12175:B:7): the signs of the game, and how many the Resolution's treasure takes, read from the record.
function signCount(game: ScenarioState, ctx: ReduceContext): string {
  const signs = Object.values(game.cards).filter((card) => card.code === "19012");
  const step = ctx.effects.find((effect) => effect.id === "12175:resolution:2")?.instructions[0];
  const rule = step && "when" in step ? step.when : undefined;
  const need = rule?.kind === "less" && typeof rule.left === "number" ? rule.left + 1 : signs.length;
  return `${signs.filter((card) => card.zone === "victory").length} of ${signs.length} Dragon Signs in the victory display; ${need} discover a treasure.`;
}

// The encounter cards attached to a card as its guards, in the order they were attached (rr.guarded).
function guardsOf(game: ScenarioState, card: ScenarioState["cards"][string]): string[] {
  return card.attachments.filter((id) => game.cards[id]?.guard === true && game.cards[id]?.host === card.id);
}

/**
 * What a screen reader hears of a treasure in the staging area, which the table draws as a guarded pair or alone: "guarded by Twilight Hall", or "free of encounters" (emce.treasure,
 * rr.guarded). Null for a card that is not in the staging area, or a card that is not a treasure (the caller knows its printing).
 */
export function treasureSpeech(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card || card.zone !== "staging") return null;
  const guards = guardsOf(game, card);
  return guards.length > 0 ? `guarded by ${guards.map(name).join(", ")}` : "free of encounters";
}

// An objective with a claiming Action (the condition of which reads "free of encounters", rr.guarded).
function claimable(ctx: ReduceContext, code: string): boolean {
  return ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "action" && JSON.stringify(effect.condition ?? null).includes("freeOfEncounters"));
}

// A tower freed of encounters is controlled by the players as a group: claimed, with no hero or player to hang on (ControlWhenFree).
function playersControl(card: ScenarioState["cards"][string]): boolean {
  return card.zone === "staging" && card.claimed === true && card.controller == null;
}

/** What a screen reader hears of a card the table shows by its picture alone: "controlled by the players" for a tower the players control, whether or not a Ship enemy guards it again. Null for any other card. */
export function controlSpeech(game: ScenarioState, cardId: string): string | null {
  const card = game.cards[cardId];
  return card && playersControl(card) ? "controlled by the players" : osgiliathControlSpeech(game, cardId);
}
