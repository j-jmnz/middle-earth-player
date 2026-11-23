// Rules: rr.action, rr.response, rr.cancel, rr.mulligan, mec109.hide-x, mec109.hide-tests, rr.travel,
// rr.optional-engagement, rr.step-6-2 (data/rules/entries.json). The combat sheets are in combat-sheets.ts.
//
// What the choice sheet over the rail asks, for the window the engine has open. Every option is an intent legalIntents and
// legalTargets list, or a number the engine computed (the Hide numbers, an attack and a defense). Nothing here writes a
// number: a sheet names who does something, the reducer decides what happens.
import type { Effect } from "../../catalog/boundary.ts";
import { rejectionReason } from "../../rules/engine/legal.ts";
import { effectById, effectsOf } from "../../rules/windows/listen.ts";
import { endedInDefeat } from "../../rules/core/eliminate.ts";
import { isLocationCard, isLocationId, printedOf } from "../../rules/core/printed.ts";
import { engagementCostOf, questPointsOf } from "../../rules/quest/quest.ts";
import { legalTargets, type LegalIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { topFrame } from "../../rules/windows/windows.ts";
import { asksPlayers } from "../../rules/setup/resolution.ts";

import { askWords } from "../words/ask.ts";
import { askAt, asksChoose, asksOption, type AskedWords } from "../words/asks.ts";
import { branchThreat, branchWords, outOfPlayLabel, type ChoiceNames } from "../words/choice.ts";
import { islandBlocked, islandBlockedTitle, islandOptionLabel, islandTravelNote, islandTravelRow } from "../words/scenarios/island.ts";
import { grantedTravelWords, grappleOptionLabel, grappleTravel, returnsNote, travelNote } from "../words/scenarios/grapple.ts";
import { isBoonCode } from "../words/scenarios/angmar/angmar-table.ts";
import { smaugChooseNote } from "../words/scenarios/standalone-scenarios/smaug.ts";
import { isFreedTreasureClaim, isTreasureDraw, wilderlandBranchNow, wilderlandChooseNote, wilderlandOptionLabel, wilderlandTravel } from "../words/scenarios/wilderland.ts";
import { embassyPairCards } from "../readouts/black-gate.ts";
import { branchCaution, discardCaution } from "./wilderland-sheets.ts";
import { heathLookNote } from "../words/scenarios/heath.ts";
import { seaOptionLabel, travelTaxCaution } from "../words/scenarios/sea.ts";
import { unchartedNote, unchartedOptionLabel } from "../words/scenarios/uncharted.ts";
import { commandDone, commandNote } from "../words/command.ts";
import { DONE } from "../../rules/families/deck/choose.ts";
import { branchNow, dealtNow } from "../words/scenarios/aflame.ts";
import { fireRow } from "./aflame-sheets.ts";
import { committedNote, stormcallerTravel } from "./stormcaller-sheets.ts";
import { cavesXChoice } from "../words/scenarios/caves.ts";
import { archerySheet, defenseSheet, extraDefender, playerAttackSheet } from "./combat-sheets.ts";
import { cancelRequest, triggerRequest } from "./pay.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { STEP_WORDS } from "../phases/rail.ts";
import { DEFENDERS_FRAME } from "../../rules/families/defense/defenders.ts";
import { viewOf } from "../../rules/families/breaking/areas.ts";
import { questSeat } from "../store/selectors.ts";
import { freeSlot } from "../../rules/families/south/locations.ts";
import { recordsOfFace } from "../../rules/families/dreamchaser/faces.ts";
import { islandMayTravel } from "../../rules/families/island/travel.ts";
import { hideCommitLimit } from "../../rules/families/nightmare/guards.ts";
import { eyesStat, fortitudeCommitCheck, fortitudeCommitNote, fortitudeCountNote, fortitudePassCaution } from "../readouts/fortitude.ts";
import { escapeCommitNote, escapeCountNote, escapePassCaution, escapeStat } from "./escape-notes.ts";
import { sailingSheet, shipRow } from "./sea-sheets.ts";
import { asksCollection, collectionLabel, collectionOrder } from "./collection-sheets.ts";
import { answeredCard, hideCommitNote, hideNumbers, lookNote, optionalEngageNote, responseNote } from "./sheet-notes.ts";
import { captiveLabel, cardLabel, copyLabel, has, option, seatedLabel, stagedAllyLabel, statOf, step, tiedLabel } from "./sheet-parts.ts";
import { nightActionNote } from "../words/scenarios/night.ts";
import { framsburgActionCaution, framsburgActionNote } from "../words/scenarios/framsburg.ts";
import { fatePassCaution } from "../words/scenarios/fate.ts";
import { gundabadOptionLabel, gundabadPassCaution } from "../words/scenarios/gundabad.ts";
import { gundabadRow } from "./gundabad-sheets.ts";
import { TIMING_WORDS, type SheetStat, type PickOption, type Sheet, type SheetNames, type TriggerOption, type Unavailable } from "./sheet-types.ts";

function effectOf(ctx: ReduceContext, effectId: string): Effect | undefined {
  return effectById(ctx, effectId);
}

function lineOf(effect: Effect | undefined, names: SheetNames): string | null {
  const id = effect?.lines[0];
  return id ? names.line(id) : null;
}

/**
 * The row of a card whose Action or Response can be used: an attachment says which card it lies on ("Unexpected Courage ·
 * on Aragorn"), so two copies on two heroes read apart. A hero or an ally is named alone.
 */
function triggerLabel(game: ScenarioState, names: SheetNames, id: string): string {
  // A card under a location also names a host; only a card in the host's attachments is attached to it.
  const host = game.cards[id]?.host;
  const label = cardLabel(game, names, id);
  return host != null && game.cards[host]?.attachments.includes(id) === true ? `${label} \u00b7 on ${names.card(host)}` : label;
}

export function triggerOptions(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): TriggerOption[] {
  const options: TriggerOption[] = [];
  for (const intent of legal) {
    if (intent.type !== "Trigger") continue;
    const effect = effectOf(ctx, intent.effectId);
    const card = game.cards[intent.cardId];
    if (!effect || !card) continue;
    const caution = framsburgActionCaution(game, effect);
    options.push({
      id: `${intent.cardId}|${intent.effectId}`,
      label: triggerLabel(game, names, intent.cardId),
      code: pictureKey(card),
      effectId: intent.effectId,
      cardId: intent.cardId,
      timing: TIMING_WORDS[effect.timing],
      text: [lineOf(effect, names), nightActionNote(game, effect), framsburgActionNote(game, ctx, effect, names, intent.cardId)].filter((part) => part != null).join(" ") || null,
      pay: game.window?.kind === "cancelOffer" ? cancelRequest(game, ctx, intent.cardId) : triggerRequest(game, ctx, intent.cardId, effect),
      ...(caution ? { caution } : {}),
    });
  }
  return options;
}

/**
 * The locations in staging the players cannot travel to, each with the reducer's reason and the card's Travel line
 * (Weathertop while The One Ring is exhausted or gone: 141046:A:3, rr.travel). Nothing is listed while the active location slots are full.
 */
export function travelRefusals(whole: ScenarioState, ctx: ReduceContext, names: SheetNames, targets: readonly string[]): Unavailable[] {
  // Once stages are separate the traveler has its own active location and staging area (mec109.multiple-staging-areas).
  const game = viewOf(whole, questSeat(whole));
  // Under Exploration the active location stays: the refusals matter once it is full and the players may travel from it (families/island/travel.ts).
  if (!freeSlot(game) && !islandMayTravel(game, ctx.cards)) return [];
  return game.staging.flatMap((id): Unavailable[] => {
    const card = game.cards[id];
    if (!card || targets.includes(id) || !isLocationCard(printedOf(ctx.cards, card.code))) return [];
    const reason = rejectionReason(game, { type: "Travel", locationId: id }, ctx);
    if (!reason) return [];
    const travel = recordsOfFace(card, effectsOf(ctx, card.code)).find((effect) => effect.timing === "travel");
    const line = lineOf(travel, names) ?? grantedTravelWords(game, id);
    return [{ id, label: cardLabel(game, names, id), code: pictureKey(card), reason: line ? `${reason}. ${line}` : `${reason}.` }];
  });
}

/**
 * An action window between two framework steps (rr.framework-steps), not the one inside a Hide test: the bar answers it
 * like any action window, with Pass, the Actions list and the hand.
 */
export function isStepWindow(game: ScenarioState): boolean {
  return game.window?.kind === "frameAction" && topFrame(game)?.frame !== "hide" && topFrame(game)?.frame !== "fortitude" && topFrame(game)?.frame !== "escape";
}

/**
 * The sheet for the open window, or null when the bar alone answers it (an ordinary action window, where Pass and the
 * Actions list sit on the bar).
 */
// A won game opens the campaign card's Resolution when it has one. A standalone game has none (rr.campaign-cards): its
// win has nothing to choose, and the outcome screen shows the score.
export function wonSheet(game: ScenarioState): Sheet {
  const rewards = game.resolution.length > 0;
  // A scenario that ends when its last player falls (The Black Gate Opens) is no victory: the sheet says what happened and that the Resolution is next.
  if (endedInDefeat(game)) return { kind: "outcome", key: "won", result: "won", step: "Resolution", title: "The end", note: "Every player has fallen. The scenario ends here, and the campaign card's Resolution is next.", action: "See the Resolution" };
  // A Resolution that asks nothing (The Oath's: the tokens and the burden they earn) has no rewards to choose: the screen after it only shows what is recorded.
  const asks = game.resolution.some(asksPlayers);
  return {
    kind: "outcome",
    key: "won",
    result: "won",
    step: rewards ? "Resolution" : "Scenario",
    title: "Victory",
    note: rewards ? (asks ? "The scenario is won. Choose the rewards the campaign card offers." : "The scenario is won. The campaign card's Resolution is next.") : "The scenario is won.",
    action: rewards ? (asks ? "Choose rewards" : "See the Resolution") : "See the score",
  };
}

export function sheetFor(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): Sheet | null {
  if (game.lost) {
    return { kind: "outcome", key: "lost", result: "lost", step: "Scenario", title: "Defeat", note: game.lossReason ? `${game.lossReason}.` : "The scenario is lost.", action: "Continue" };
  }
  if (game.stageCleared) return wonSheet(game);
  // A Sailing test being asked: the first player's commit, then one shift-or-keep for each success symbol (sea-sheets.ts).
  const sailing = sailingSheet(game, ctx, names);
  if (sailing) return sailing;
  const window = game.window;
  if (!window) return null;
  const frame = topFrame(game);
  switch (window.kind) {
    case "mulligan":
      return {
        kind: "pick",
        key: `mulligan:${game.activeSeat}`,
        step: "Setup",
        title: game.seatCount > 1 ? `Player ${game.activeSeat + 1}: opening hand` : "Opening hand",
        note: "Keep this hand, or shuffle it back and draw a new one once.",
        verb: has(legal, "Trigger") ? "Use" : "",
        // A Response used in place of the mulligan (Galdor of the Havens).
        options: legal.flatMap((intent): PickOption[] => (intent.type === "Trigger" ? [{ ...option(game, names, intent.cardId), intent: { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId } }] : [])),
        primary: { label: "Keep", intent: { type: "Keep" } },
        alternative: has(legal, "Mulligan") ? { label: "Mulligan", intent: { type: "Mulligan" } } : null,
      };
    case "pass":
      return null;
    case "hideCommit": {
      if (!game.widgets.hide) return null;
      const hide = hideNumbers(game, ctx, frame);
      const source = frame?.cardId ?? null;
      return {
        kind: "multi",
        key: `hideCommit:${frame?.id ?? ""}`,
        step: "Hide test",
        title: source ? `${names.card(source)}: Hide ${hide?.x ?? ""}`.trim() : `Hide ${hide?.x ?? ""}`.trim(),
        note: hideCommitNote(hideCommitLimit(game)),
        verb: "Commit",
        options: legalTargets(game, { type: "CommitHide" }, ctx).map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, "willpower") })),
        build: { kind: "CommitHide" },
        allowEmpty: true,
        preselected: [],
        alternative: null,
      };
    }
    case "fortitudeCommit": {
      const source = frame?.cardId ?? null;
      const heroes = legalTargets(game, { type: "CommitFortitude" }, ctx);
      const check = fortitudeCommitCheck(game, ctx, heroes);
      return {
        kind: "multi",
        key: `fortitudeCommit:${frame?.id ?? ""}`,
        step: "Fortitude test",
        title: source ? `${names.card(source)}: Fortitude test` : "Fortitude test",
        note: fortitudeCommitNote(game, ctx),
        verb: "Commit",
        options: heroes.map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, "willpower") })),
        build: { kind: "CommitFortitude" },
        allowEmpty: true,
        preselected: [],
        alternative: null,
        ...(check ? { fortitude: check } : {}),
      };
    }
    case "escapeCommit": {
      const source = frame?.cardId ?? null;
      const stat = escapeStat(game);
      return {
        kind: "multi",
        key: `escapeCommit:${frame?.id ?? ""}:${window.seat}`,
        step: "Escape test",
        title: source ? `${names.card(source)}: Escape test` : "Escape test",
        note: escapeCommitNote(game),
        verb: "Commit",
        options: legalTargets(game, { type: "CommitEscape" }, ctx).map((id) => ({ ...option(game, names, id), stats: statOf(game, ctx, id, stat) })),
        build: { kind: "CommitEscape" },
        allowEmpty: true,
        preselected: [],
        alternative: null,
      };
    }
    case "frameAction": {
      if (isStepWindow(game)) return null;
      const hide = game.widgets.hide && frame?.data.kind === "hide" ? hideNumbers(game, ctx, frame) : null;
      // A Fortitude test's action window: the Willpower against the icons counted, the cards discarded and the icons ignored.
      const fortitude = frame?.data.kind === "fortitude" ? fortitudeCountNote(game, ctx, names.card) : null;
      // While the count fails, Continue says so and what it costs, as the other sheets that can lose something do.
      const fortitudeCaution = fortitude ? fortitudePassCaution(game, ctx) : null;
      // An escape test's action window: the stat committed against the cards dealt after it.
      const escape = frame?.data.kind === "escape" ? escapeCountNote(game, ctx) : null;
      const escapeCaution = escape ? escapePassCaution(game) : null;
      const source = frame?.cardId ?? null;
      return {
        kind: "trigger",
        key: `frameAction:${frame?.id ?? ""}:${frame?.step ?? 0}`,
        step: hide ? "Hide test" : fortitude ? "Fortitude test" : escape ? "Escape test" : step(game),
        title: source ? names.card(source) : "Action window",
        sourceId: source,
        timing: "Action",
        note: hide ? `Hide ${hide.x}: willpower ${hide.willpower} against threat ${hide.threat}.` : (fortitude ?? escape ?? "Actions may be used before this resolves."),
        hide,
        options: triggerOptions(game, ctx, legal, names),
        pass: "Continue",
        ...(fortitudeCaution ? { passCaution: fortitudeCaution } : escapeCaution ? { passCaution: escapeCaution } : {}),
      };
    }
    case "choose": {
      const data = frame?.data.kind === "effect" ? frame.data : null;
      const effect = data ? effectOf(ctx, data.effectId) : undefined;
      const source = frame?.cardId ?? null;
      const words: ChoiceNames = { card: names.card, code: (code) => ctx.cards.get(code)?.name ?? code, traits: (code) => ctx.cards.get(code)?.traits ?? [] };
      const line = lineOf(effect, names);
      // Two-handed, the sheet says whose decision it is: the first player's for "the first player must either" (rr.first-player).
      const who = game.seatCount > 1 ? ` Player ${window.seat + 1} chooses.` : "";
      const wait = data?.wait;
      const defending = data?.effectId === DEFENDERS_FRAME;
      const base = {
        kind: "pick" as const,
        key: `choose:${frame?.id ?? ""}:${window.options.join(",")}`,
        // The claim of a freed guarded treasure is the settle sweep's, not the Setup that guarded it.
        step: isFreedTreasureClaim(game, ctx, source, data?.picked?.at(-1) ?? null) ? "Claim" : effect ? TIMING_WORDS[effect.timing] : step(game),
        // Stand Together's further defenders (families/defense/defenders.ts): the sheet names the attack it is about.
        title: source ? names.card(source) : defending && game.pendingAttack ? `${names.card(game.pendingAttack.enemyId)} attacks` : "Choose",
        ...(defending && game.pendingAttack ? { stats: statOf(game, ctx, game.pendingAttack.enemyId, "attack") } : {}),
        primary: null,
        alternative: null,
      };
      // Either of two instructions (141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2): each option is a branch in words.
      if (wait?.kind === "branch" && wait.item.instruction.verb === "Choose") {
        const choose = wait.item.instruction;
        // The Cave Torch's X: the options place 1 to 3 progress (41029:A:2).
        const torch = cavesXChoice(choose, (data?.queue ?? []).map((item) => item.instruction));
        // The numbers a branch states are the ones the table holds now (the cards a Counsel looks at), and the card a Counsel places is named.
        const now = { ...branchNow(game, ctx, choose, window.seat, source, data?.picked?.at(-1) ?? null, words), ...wilderlandBranchNow(game, ctx, choose, window.seat, source) };
        // A Choose with `upTo` (Command) stops on the sheet's armed pass, not on a row of the list: "Done", with the options used so far.
        const stop = commandDone(game, ctx, choose, window.seat, source, source ? names.card(source) : "This card");
        // The record's asks entries (words/asks.ts) come before the families' words.
        const asked = { game, ctx, names: words, instruction: choose, ...(data?.effectId ? { effectId: data.effectId } : {}), ...(wait.item.cause ? { cause: wait.item.cause } : {}), source };
        const written = { ...asked, at: askAt(asked) };
        const ask = asksChoose(written)?.note ?? torch?.note ?? smaugChooseNote(choose, game, ctx, words, window.seat) ?? wilderlandChooseNote(choose, game, ctx, words, window.seat, source, data?.subject ?? null) ?? commandNote(game, ctx, choose, window.seat, source, data?.picked?.at(-1) ?? null, names.card) ?? (source ? unchartedNote(choose, names.card(source)) : null) ?? "Choose one.";
        return {
          ...base,
          note: [`${ask}${/^Player \d+[:,] /.test(ask) ? "" : who}`, line].filter((part) => part != null).join(" "),
          verb: "Choose",
          confirm: "Confirm",
          // The Embassy's pair: the Read button opens the player card and the encounter card it is paired with.
          ...(embassyPairCards(game).length > 0 ? { about: embassyPairCards(game) } : {}),
          alternative: stop ? { label: stop.label, intent: { type: "Choose", optionId: stop.optionId }, caution: stop.caution } : null,
          options: window.options.filter((id) => !(stop && id === DONE)).map((id): PickOption => {
            // A branch that raises or lowers threat carries the threat icon with the record's amount.
            const threat = branchThreat(choose, id);
            const stats: SheetStat[] = threat == null ? [] : [{ icon: "threat", value: threat, word: "Threat" }];
            // A branch that deals damage to each of the player's allies warns when it destroys one.
            const said = asksOption(written, id);
            const caution = said?.caution ?? branchCaution(game, ctx, choose, id, window.seat, source, names.card, data?.picked?.at(-1) ?? null);
            return { id, label: said?.label ?? (torch ? torch.label(id) : branchWords(choose, id, game, words, source, now, ctx)), code: null, ...(stats.length > 0 ? { stats } : {}), ...(caution ? { caution } : {}), intent: { type: "Choose", optionId: id } };
          }),
        };
      }
      // A Pick names what the card is for: a hero removed from the quest, an attachment discarded, an ally put into play,
      // an enemy placed under Weather Hills.
      // What the instruction after the pick deals or places, read now (the damage, progress or resources a prompt and a row state).
      const amountNow = wait?.kind === "target" ? dealtNow(game, ctx, data?.queue[0]?.instruction, window.seat, source) : undefined;
      const queue = (data?.queue ?? []).map((item) => item.instruction);
      const asked: AskedWords = wait?.kind === "target" ? askWords({ game, ctx, names: words, instruction: wait.item.instruction, queue, options: window.options, source, ...(wait.item.origin ? { origin: wait.item.origin, ...(wait.item.nth != null && wait.item.of != null ? { place: { nth: wait.item.nth, of: wait.item.of } } : {}) } : {}), picked: data?.kind === "effect" ? (data.picked?.at(-1) ?? null) : null, amountNow, ...(data?.effectId ? { effectId: data.effectId } : {}), ...(wait.item.cause ? { cause: wait.item.cause } : {}) }) : { verb: "Choose", prompt: "Choose one." };
      const outOfPlay = wait?.kind === "target" && wait.item.instruction.verb === "ShuffleOutOfPlayIntoEncounterDeck";
      const collection = wait?.kind === "target" && asksCollection(wait.item.instruction);
      // The further defenders of Stand Together stop on the sheet's pass, not on a row (families/defense/defenders.ts).
      const stopsDefenders = defending && wait?.kind === "target";
      return {
        ...base,
        ...(asked.title ? { title: asked.title } : {}),
        ...(stopsDefenders ? { alternative: { label: "No more defenders", intent: { type: "Choose" as const, optionId: DONE } } } : {}),
        note: [`${asked.prompt}${asked.owned ? "" : who}`, committedNote(game, ctx, effect, window.seat), line].filter((part) => part != null).join(" "),
        verb: asked.verb,
        // Which Ringwraith copy goes in: the primary says the action alone, so the pill does not wrap on a long zone name.
        ...(outOfPlay ? { confirm: asked.verb } : {}),
        options: (collection ? collectionOrder(game, ctx, window.options) : window.options).filter((id) => !(stopsDefenders && id === DONE)).map((id): PickOption => {
          const card = option(game, names, id);
          // The Willpower each character the players may remove from the quest adds up (11075:A:1), as the commit sheet shows it.
          const willpower = wait?.kind === "target" && wait.item.instruction.verb === "RemoveWillpowerFromQuest" ? statOf(game, ctx, id, "willpower") : [];
          // Gollum's pick of the card whose Sauron's Eye icons are not counted: each row shows the icons it adds.
          const eyes = data?.queue[0]?.instruction.verb === "IgnoreFortitudeEyes" ? [eyesStat(game, ctx, id)] : [];
          // An option of a sea verb that is no card: trade or keep the damage, the deck to discard from, the title named.
          const sea = wait?.kind === "target" ? (seaOptionLabel(wait.item.instruction, id, game, ctx.cards) ?? grappleOptionLabel(wait.item.instruction, id) ?? wilderlandOptionLabel(wait.item.instruction, id, words) ?? unchartedOptionLabel(wait.item.instruction, id, game, words) ?? islandOptionLabel(wait.item.instruction, id, game, words, ctx.cards) ?? gundabadOptionLabel(wait.item.instruction, id, game, ctx, words) ?? (isBoonCode(wait.item.instruction, id) ? words.code(id) : null)) : null;
          // Copies of one card in different zones are told apart by where each one is.
          // A pick that puts damage on a location or a character, or takes it off a location: the damage it would stand at, as a mark, with a caution when it burns the location or loses the game.
          const fire = wait?.kind === "target" ? (fireRow(wait.item.instruction, data?.queue[0]?.instruction, id, game, ctx, names, amountNow, source) ?? gundabadRow(wait.item.instruction, data?.queue[0]?.instruction, id, game, ctx, names.card(id))) : null;
          // A Ship objective that is exhausted or attached to: whose it is when the options hold more than one player's, and the damage a card on it would deal.
          const ship = wait?.kind === "target" ? shipRow(wait.item.instruction, data?.queue[0]?.instruction, id, window.options, game, ctx, words) : null;
          const kingsCaution = wait?.kind === "target" ? discardCaution(game, ctx, source, wait.item.instruction, data?.queue[0]?.instruction, id, names.card) : undefined;
          // An asks entry's warning is the row's own (asks.ts): it arms the confirm on that row only.
          const rowCaution = asked.cautions?.[id] ?? fire?.caution ?? ship?.caution ?? kingsCaution;
          // A plain card row that shares its name with another row says what tells the copies apart (Mr. Underhill's two Black Riders).
          const plainLabel = card.label === names.card(id) ? (copyLabel(game, names, id, window.options) ?? card.label) : card.label;
          const label = (game.cards[id] ? undefined : asked.labels?.[id]) ?? fire?.label ?? sea ?? ship?.label ?? captiveLabel(game, ctx, names, id, window.options) ?? stagedAllyLabel(game, ctx, names, id, window.options) ?? seatedLabel(game, ctx, names, id, window.options) ?? tiedLabel(game, ctx, names, id, window.options) ?? (collection ? collectionLabel(game, ctx, id, window.options, names) : outOfPlay ? outOfPlayLabel(game, id, words) : plainLabel);
          // Another defender's pooled damage (Stand Together, families/defense/defenders.ts).
          const pooled = data?.effectId === DEFENDERS_FRAME ? extraDefender(game, ctx, id) : null;
          return { ...card, label, ...(wait?.kind === "target" && (isTreasureDraw(wait.item.instruction) || isBoonCode(wait.item.instruction, id)) ? { code: id } : {}), ...(willpower.length > 0 || eyes.length > 0 ? { stats: [...willpower, ...eyes] } : {}), ...(pooled ?? {}), ...(fire ? { mark: fire.mark } : {}), ...(rowCaution ? { caution: rowCaution } : {}), intent: { type: "Choose", optionId: id } };
        }),
      };
    }
    case "cancelOffer":
    case "response": {
      const options = triggerOptions(game, ctx, legal, names);
      const data = frame?.data;
      const endOfRound = data?.kind === "responses" && data.event.trigger === "endOfRound";
      // The end of the round has no card it is about: the one card whose Response is offered names the sheet (The Oath's tokens).
      const sole = endOfRound && options.length > 0 && options.every((item) => item.cardId === options[0]?.cardId) ? (options[0]?.cardId ?? null) : null;
      const about = sole ?? (data?.kind === "responses" ? answeredCard(data.event, data.offers, options) : (frame?.cardId ?? null));
      const cancel = window.kind === "cancelOffer";
      // A Response whose passing leaves the game unwinnable arms the Pass (words/scenarios/gundabad.ts).
      const passCaution = data?.kind === "responses" ? (gundabadPassCaution(game, ctx, data.event, options.map((item) => item.cardId)) ?? fatePassCaution(game, ctx, data.event, options.map((item) => item.cardId))) : null;
      return {
        kind: "trigger",
        key: `${window.kind}:${frame?.id ?? ""}:${options.length}`,
        // The end of the round has no framework step of its own to name: the Response window says when it is.
        step: endOfRound ? "End of round" : step(game),
        title: about ? names.card(about) : cancel ? "Cancel" : "Response",
        sourceId: about,
        timing: cancel ? "Cancel" : "Response",
        note: cancel ? "The first player may pay to cancel this effect before it resolves." : responseNote(game, names, data?.kind === "responses" ? data.offers : [], options, ctx, data?.kind === "responses" ? data.event : null),
        hide: null,
        options,
        pass: "Pass",
        ...(passCaution ? { passCaution } : {}),
      };
    }
    case "look":
      return {
        kind: "pick",
        key: `look:${window.cardIds.join(",")}`,
        step: step(game),
        title: window.cardIds.map((id) => (window.side === "A" ? (names.facedown?.(id) ?? names.card(id)) : names.card(id))).join(", ") || "Look",
        // Dark Knowledge (01071:A:2) looks at a shadow card dealt to an enemy; a look at the top of a player's own deck
        // (LookAtTop with `deck: "own"`) says so.
        note: heathLookNote(game, window.cardIds) ?? lookNote(game, window.cardIds, window.seat, window.side),
        verb: "",
        options: [],
        primary: { label: "Done", intent: { type: "Pass" } },
        alternative: null,
        about: window.cardIds,
      };
    case "travel": {
      const targets = has(legal, "Travel") ? legalTargets(game, { type: "Travel" }, ctx) : [];
      const unavailable = travelRefusals(game, ctx, names, targets);
      // Only one location can be active (rr.travel): while one is, say what exploring it still takes.
      const area = viewOf(game, questSeat(game));
      const active = area.activeLocation ? game.cards[area.activeLocation] : undefined;
      const activePoints = active ? questPointsOf(game, active, ctx.cards) : null;
      const waiting = area.staging.some((id) => isLocationId(game, id, ctx.cards));
      const blocked = targets.length === 0 && active != null && waiting;
      const declineTax = travelTaxCaution(game, ctx, null, names);
      return {
        kind: "pick",
        key: `travel:${game.round}`,
        step: "Travel",
        title: targets.length > 0 ? "Travel to a location" : blocked && active ? (islandBlockedTitle(game, (activePoints ?? 0) - active.progress, names.card(active.id)) ?? `Explore ${names.card(active.id)} first`) : "No location to travel to",
        note:
          targets.length > 0
            ? [islandTravelNote(game, names.card, targets.some((id) => game.cards[id]?.face === "B")) ?? travelNote(game, targets), returnsNote(game, ctx, names.card)].filter((part) => part != null).join(" ")
            : blocked && active && activePoints != null
              ? (islandBlocked(game) ?? `${Math.max(0, activePoints - active.progress)} more progress explores it. Only one location can be active.`)
              : null,
        verb: "Travel to",
        options: targets.map((id) => {
          const location = game.cards[id];
          const points = location ? questPointsOf(game, location, ctx.cards) : null;
          const stats: SheetStat[] = [...statOf(game, ctx, id, "threat"), ...(points == null ? [] : [{ icon: "questPoints" as const, value: points, word: "Quest points" }])];
          // Its Travel line, when it prints one (a cost the travel pays: Great Forest Web's "exhaust 1 hero").
          const travel = location ? recordsOfFace(location, effectsOf(ctx, location.code)).find((effect) => effect.timing === "travel") : undefined;
          const line = lineOf(travel, names);
          const base = option(game, names, id);
          // On the Island Map: how far the location is, what a Temple location brings back, who attacks when the players go right (words/scenarios/island.ts).
          const mapped = islandTravelRow(game, ctx, id, names.card);
          // A Travel line that moves progress onto the Stormcaller's stage states what it leaves there, and arms the confirm when it advances the Stormcaller or loses the game.
          const caller = stormcallerTravel(game, ctx, id);
          // A Travel cost another card gave it (Weather Deck, 12044:A:1), and the enemies grappled with it that come out and join the staging area (dcce.grapple): the confirm is armed with what they do.
          const granted = grantedTravelWords(game, id);
          const grapple = grappleTravel(game, ctx, id);
          // The Old Ford makes each enemy in the staging area attack when it becomes active (18016:A:3).
          const attacks = wilderlandTravel(game, ctx, id);
          const label = [mapped?.lead, base.label, line, granted, caller?.words, grapple?.words, attacks?.words, mapped?.words].filter((part) => part != null && part !== "").join(" · ");
          // A rule that charges for leaving where the players are (Streets of Umbar, 12160:A:1) is said before the confirm sends.
          const caution = caller?.caution ?? grapple?.caution ?? attacks?.caution ?? mapped?.caution ?? travelTaxCaution(game, ctx, id, names);
          return { ...base, label, stats, ...(caution ? { caution } : {}), ...(mapped ? { place: mapped.place } : {}), intent: { type: "Travel", locationId: id } };
        }),
        ...(unavailable.length > 0 ? { unavailable } : {}),
        primary: null,
        // The players must travel if able on some stages (mec109.stage-4): the engine then offers no way to decline.
        alternative: has(legal, "DeclineTravel") ? { label: targets.length > 0 ? "Do not travel" : "Continue", intent: { type: "DeclineTravel" }, ...(declineTax ? { caution: declineTax } : {}) } : null,
      };
    }
    case "optionalEngage": {
      const targets = legalTargets(game, { type: "Engage" }, ctx);
      return {
        kind: "pick",
        key: `optionalEngage:${game.round}:${game.activeSeat}`,
        step: "Encounter",
        title: game.seatCount > 1 ? `Player ${game.activeSeat + 1}: optional engagement` : "Optional engagement",
        note: optionalEngageNote(game, ctx, names),
        verb: "Engage",
        options: targets.map((id) => {
          const enemy = game.cards[id];
          const cost = enemy ? engagementCostOf(game, enemy, ctx.cards) : null;
          return { ...option(game, names, id), stats: cost == null ? [] : [{ icon: "engagementCost" as const, value: cost, word: "Engagement cost" }], intent: { type: "Engage", enemyId: id } };
        }),
        primary: null,
        alternative: { label: "Do not engage", intent: { type: "DeclineEngage" } },
      };
    }
    case "chooseEnemy":
      return {
        kind: "pick",
        key: `chooseEnemy:${window.options.join(",")}`,
        step: STEP_WORDS[game.mode],
        title: window.reason === "engagement" ? "Which enemy engages" : "Which enemy attacks",
        note: "The first player chooses among enemies tied by the rules.",
        verb: "Choose",
        options: window.options.map((id) => ({ ...option(game, names, id), intent: { type: "ChooseEnemy", enemyId: id } })),
        primary: null,
        alternative: null,
      };
    case "defense":
      return defenseSheet(game, ctx, legal, names);
    case "archery":
      return archerySheet(game, ctx, names, window.total);
    case "playerAttack":
      return playerAttackSheet(game, ctx, legal, names);
    case "resolution":
      return wonSheet(game);
  }
}
