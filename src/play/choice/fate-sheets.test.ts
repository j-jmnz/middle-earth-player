// Rules: rr.first-player, rr.engaged, rr.response, rr.explored, rr.shadow-effects, rr.attacks-outside-the-combat-phase, rr.damage (data/rules/entries.json); ledger lines 19155:A:1, 19156:A:1, 19156:A:2, 19157:A:1, 19157:A:2, 19158:A:1, 19159:A:1, 19160:A:1, 19161:A:2, 19163:A:2, 19164:A:1, 19166:A:1, 19167:A:1, 19168:B:1, 19169:B:2, 19170:B:1.
// The choices, Responses and attacks of The Fate of Wilderland on the live sheet: each opens a real window (the engine's own frames, not a hand-made instruction), and the sheet says why it opened, where The Goblins' Assault and The Heroes' Defense stand, and the cost before a choice
// that can lose the game. Two-handed a choice of one player's own leads with "Player N, Card:" and the sheet adds no "Player N chooses."; solo it has no lead; the first player's choice for the group leaves the sheet to say who chooses.
import { beforeAll, describe, expect, it } from "vitest";

import { definePrinted } from "../../rules/core/printed.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { pushCardEffects, pushEffectFrame } from "../../rules/interpret/effect-frames.ts";
import { CODES, idOf, loadWilderlandWorld, send, start, wilderlandTable, type Run, type WilderlandWorld } from "../../../test/scenarios/the-fate-of-wilderland/scene.ts";

import { momentOf } from "../store/outcome.ts";
import { fateNames } from "../words/fate-beats.ts";
import { sheetFor } from "./sheets.ts";

let world: WilderlandWorld;
beforeAll(async () => {
  world = await loadWilderlandWorld();
  world.cards.set("gear", definePrinted({ code: "gear", name: "gear", type: "attachment", sphere: "neutral", cost: 0 }));
}, 120_000);

type Table = ReturnType<typeof wilderlandTable>;
const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState) => ({ card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: () => null });

// Every sheet the file opens, kept to check them all for the words rules once the tests have run.
const opened_: { note: string; kind: string; labels: string[] }[] = [];
const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (!sheet || (sheet.kind !== "pick" && sheet.kind !== "trigger")) throw new Error(`no pick or trigger sheet: ${JSON.stringify(state.window)}`);
  opened_.push({ note: sheet.note ?? "", kind: sheet.kind, labels: sheet.options.map((option) => option.label) });
  return sheet;
};
const labels = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => option.label);
const cautions = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => ("caution" in option ? option.caution : undefined));



const W = [CODES.dwarvenWatchtower];
type Layout = NonNullable<Parameters<typeof wilderlandTable>[1]>;
// The table in the middle of a choice: the objective holds `progress`, the card that counts the resources `resources`, and a Watchtower lies in the encounter discard pile (the scenario's records are told in a game that deals one).
const table = (extra: Layout = {}, progress = 0, resources = 0): Table => wilderlandTable(world, { phase: "Encounter", discard: W, staging: [{ code: CODES.theGoblinsAssault, progress }, { code: CODES.theHeroesDefense, resources }, CODES.urdug], ...extra });
// The records of one timing without their conditions (the choice, not the event that offers it, is what the sheet is about).
function bare(t: Table, state: ScenarioState, code: string, timing: "whenRevealed" | "forced", zone: "staging" | "engaged" = "engaged"): ScenarioState {
  const spawned = zone === "engaged" ? spawn(state, code, { zone: "engaged", seat: 0 }) : spawn(state, code, { zone });
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).map((effect) => ({ ...effect, condition: undefined }) as typeof effect);
  const pushed = pushCardEffects(spawned.state, timing === "whenRevealed" ? "whenRevealed" : "forced", spawned.id, spawned.state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}
const settled = (t: Table, state: ScenarioState): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
const explore = (t: Table): ScenarioState => {
  const pushed = pushEffectFrame(t.state, { frame: "ResolveEffect", sourceId: t.hero, actor: 0, peril: false, effectId: "test", instructions: [{ verb: "PlaceProgressOn", amount: 99, target: "activeLocation" }], cancel: null, blockCancel: null }, []);
  return settle({ ...pushed, window: null }, t.ctx, []);
};
// The Watchtower that is the active location (the other lies in the encounter discard pile).
const watchtower = (t: Table): string => Object.values(t.state.cards).find((card) => card.code === CODES.dwarvenWatchtower && card.zone === "activeLocation")?.id ?? "";
const offerOf = (state: ScenarioState, t: Table, cardId: string) => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === cardId);

describe("the choices that make a player pay or put progress on The Goblins' Assault", () => {
  it("Urdug's Elite (19158:A:1): said when the enemy engages you, with the objective's count; two-handed it leads with the player", () => {
    for (const [seats, lead, need] of [[1, "", 4], [2, "Player 1, ", 6]] as const) {
      const t = table({ seats }, 1);
      const sheet = sheetOf(t, bare(t, t.state, CODES.urdugSElite, "forced"));
      expect(sheet.note).toBe(`${lead}Urdug's Elite: it engaged you. The Goblins' Assault: 1 of ${need} progress, +1 at the end of the round (1 for each enemy in the staging area). At ${need} the goblins push the quest on.`);
      expect(labels(sheet)).toEqual(["Exhaust a character you control", "Place 1 progress on The Goblins' Assault"]);
      expect(cautions(sheet)).toEqual([undefined, undefined]);
    }
  });

  it("Urdug's Elite: the character to exhaust is asked by the card, with the one colon", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1, "]] as const) {
      const t = table({ seats });
      const asked = bare(t, t.state, CODES.urdugSElite, "forced");
      const exhaust = send({ state: asked, steps: [] }, { type: "Choose", optionId: "exhaust" }, t.ctx);
      expect(sheetOf(t, exhaust.state).note).toBe(`${lead}Urdug's Elite: choose a ready character you control to exhaust.`);
    }
  });

  it("Fierce Vanguard (19159:A:1) and Warg-rider (19160:A:1): the reason each window opened, and each branch in words", () => {
    const t = table({}, 2);
    const vanguard = sheetOf(t, bare(t, t.state, CODES.fierceVanguard, "forced"));
    expect(vanguard.note).toBe("Fierce Vanguard: it engaged you. The Goblins' Assault: 2 of 4 progress, +1 at the end of the round (1 for each enemy in the staging area). At 4 the goblins push the quest on.");
    expect(labels(vanguard)).toEqual(["Fierce Vanguard gets +2 Attack until the end of the round", "Place 1 progress on The Goblins' Assault"]);
    const warg = sheetOf(t, bare(t, t.state, CODES.wargRider, "forced"));
    expect(warg.note).toBe("Warg-rider: it was dealt a shadow card with no effect. The Goblins' Assault: 2 of 4 progress, +1 at the end of the round (1 for each enemy in the staging area). At 4 the goblins push the quest on.");
    expect(labels(warg)).toEqual(["Return Warg-rider to the staging area: it does not attack you this phase", "Place 1 progress on The Goblins' Assault"]);
  });

  it("the objective's count by stage: the end of the round adds 1 for each enemy in the staging area (stage 1) or in play (stage 3), and stage 2, which gets its progress from attacks, adds none", () => {
    const stages = [["19168", "2 of 4 progress, +1 at the end of the round (1 for each enemy in the staging area). At 4 the goblins push the quest on."], ["19169", "2 of 8 progress. At 8 the goblins push the quest on."], ["19170", "2 of 16 progress, +1 at the end of the round (1 for each enemy in play). At 16 the game is lost."]] as const;
    for (const [stage, said] of stages) {
      const t = table({ stage }, 2);
      expect(sheetOf(t, bare(t, t.state, CODES.slopesOfGundabad, "whenRevealed", "staging")).note, stage).toBe(`Slopes of Gundabad: it was revealed. The Goblins' Assault: ${said}`);
    }
  });

  it("Slopes of Gundabad (19164:A:1): the player who revealed it chooses, solo and two-handed", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1, "]] as const) {
      const t = table({ seats }, 3);
      const sheet = sheetOf(t, bare(t, t.state, CODES.slopesOfGundabad, "whenRevealed", "staging"));
      expect(sheet.note).toBe(`${lead}Slopes of Gundabad: it was revealed. The Goblins' Assault: 3 of ${seats === 1 ? 4 : 6} progress, +1 at the end of the round (1 for each enemy in the staging area). At ${seats === 1 ? 4 : 6} the goblins push the quest on.`);
      expect(labels(sheet)).toEqual(["Place 1 progress on The Goblins' Assault", "Reveal an encounter card"]);
    }
  });

  it("on the last stage the row that brings The Goblins' Assault to the number that loses the game arms the confirm, and no other does", () => {
    // The Final Push adds 1 progress for each enemy in play at the end of the round, Urdug among them, before it checks the number: 14 and the 1 placed and the 1 for Urdug reach 16.
    const near = table({ stage: "19170" }, 14);
    const sheet = sheetOf(near, bare(near, near.state, CODES.slopesOfGundabad, "whenRevealed", "staging"));
    expect(sheet.note).toContain("The Goblins' Assault: 14 of 16 progress, +1 at the end of the round (1 for each enemy in play). At 16 the game is lost.");
    expect(cautions(sheet)).toEqual(["Tap again: with 1 for each enemy in play, The Goblins' Assault reaches 16 of 16 at the end of the round and the game is lost", undefined]);
    // One short of it: 13, the 1 placed and the 1 for Urdug make 15.
    const short = table({ stage: "19170" }, 13);
    expect(cautions(sheetOf(short, bare(short, short.state, CODES.slopesOfGundabad, "whenRevealed", "staging")))).toEqual([undefined, undefined]);
    const far = table({ stage: "19170" }, 5);
    expect(cautions(sheetOf(far, bare(far, far.state, CODES.slopesOfGundabad, "whenRevealed", "staging")))).toEqual([undefined, undefined]);
    // Two-handed the number is 8 plus 8 for each player, and the Vanguard that engaged is an enemy in play with Urdug: 21, the 1 placed and the 2 for the enemies reach 24.
    const two = table({ stage: "19170", seats: 2 }, 21);
    expect(cautions(sheetOf(two, bare(two, two.state, CODES.fierceVanguard, "forced")))[1]).toBe("Tap again: with 1 for each enemy in play, The Goblins' Assault reaches 24 of 24 at the end of the round and the game is lost");
    const twoShort = table({ stage: "19170", seats: 2 }, 20);
    expect(cautions(sheetOf(twoShort, bare(twoShort, twoShort.state, CODES.fierceVanguard, "forced")))[1]).toBeUndefined();
    // An earlier stage only advances the quest.
    const early = table({ stage: "19169" }, 7);
    expect(cautions(sheetOf(early, bare(early, early.state, CODES.slopesOfGundabad, "whenRevealed", "staging")))).toEqual([undefined, undefined]);
  });
});

describe("Dwarven Watchtower (19163:A:2)", () => {
  const explored = (extra: Layout = {}, staging: Layout["staging"] = [{ code: CODES.theGoblinsAssault, progress: 3 }, { code: CODES.theHeroesDefense, resources: 2 }, CODES.urdug]) => {
    const t = wilderlandTable(world, { phase: "Quest", active: CODES.dwarvenWatchtower, discard: W, staging, ...extra });
    return { t, run: explore(t) };
  };

  it("the Response says what the explored location asks of the first player, with both counts; passing leaves both as they are", () => {
    for (const [seats, lead, resources, progress] of [[1, "", 5, 4], [2, "Player 1: ", 10, 6]] as const) {
      const { t, run } = explored({ seats });
      const sheet = sheetOf(t, run);
      expect(sheet.kind).toBe("trigger");
      expect(sheet.note).toBe(`${lead}Dwarven Watchtower was explored. The first player may put 1 resource on The Heroes' Defense (2 of ${resources}) or take 1 progress off The Goblins' Assault (3 of ${progress}). Pass and neither happens.`);
    }
  });

  it("the choice names both counts, and two-handed the sheet says who chooses", () => {
    for (const [seats, suffix] of [[1, ""], [2, " Player 1 chooses."]] as const) {
      const { t, run } = explored({ seats });
      const used = send({ state: run, steps: [] }, offerOf(run, t, watchtower(t)) as never, t.ctx);
      const sheet = sheetOf(t, used.state);
      expect(sheet.note).toBe(`Dwarven Watchtower was explored. The Heroes' Defense holds 2 of the ${seats === 1 ? 5 : 10} resources that make Urdug engaged with each player. The Goblins' Assault: 3 of ${seats === 1 ? 4 : 6} progress, +1 at the end of the round (1 for each enemy in the staging area). At ${seats === 1 ? 4 : 6} the goblins push the quest on.${suffix}`);
      expect(labels(sheet)).toEqual(["Place 1 resource on The Heroes' Defense", "Remove 1 progress from The Goblins' Assault"]);
    }
  });

  it("with Gate of Gundabad in the staging area the Response says only the progress comes off, names the Gate, and asks no choice", () => {
    const { t, run } = explored({}, [{ code: CODES.theGoblinsAssault, progress: 3 }, CODES.theHeroesDefense, CODES.urdug, CODES.gateOfGundabad]);
    const sheet = sheetOf(t, run);
    expect(sheet.note).toBe("Dwarven Watchtower was explored. Gate of Gundabad is in the staging area, so no resource can be placed on The Heroes' Defense. The first player may take 1 progress off The Goblins' Assault (3 of 4). Pass and the progress stays.");
    const used = send({ state: run, steps: [] }, offerOf(run, t, watchtower(t)) as never, t.ctx);
    expect(used.state.window?.kind).not.toBe("choose");
  });

  it("on the last stage the Pass and the resource row arm 'Tap again' when the objective already stands at the number that loses with the end of the round's progress, and the progress row does not", () => {
    const armed = "Tap again: no progress comes off and the game is lost at the end of the round";
    // 15 and the 1 for Urdug reach 16.
    const { t, run } = explored({ stage: "19170" }, [{ code: CODES.theGoblinsAssault, progress: 15 }, { code: CODES.theHeroesDefense, resources: 2 }, CODES.urdug]);
    expect((sheetOf(t, run) as { passCaution?: string }).passCaution).toBe(armed);
    const used = send({ state: run, steps: [] }, offerOf(run, t, watchtower(t)) as never, t.ctx);
    expect(cautions(sheetOf(t, used.state))).toEqual([armed, undefined]);
    // One short of it, nothing is armed.
    const short = explored({ stage: "19170" }, [{ code: CODES.theGoblinsAssault, progress: 14 }, { code: CODES.theHeroesDefense, resources: 2 }, CODES.urdug]);
    expect((sheetOf(short.t, short.run) as { passCaution?: string }).passCaution).toBeUndefined();
    const taken = send({ state: short.run, steps: [] }, offerOf(short.run, short.t, watchtower(short.t)) as never, short.t.ctx);
    expect(cautions(sheetOf(short.t, taken.state))).toEqual([undefined, undefined]);
    // An earlier stage never loses at the end of the round.
    const early = explored({ stage: "19169" }, [{ code: CODES.theGoblinsAssault, progress: 7 }, { code: CODES.theHeroesDefense, resources: 2 }, CODES.urdug]);
    expect((sheetOf(early.t, early.run) as { passCaution?: string }).passCaution).toBeUndefined();
  });
});

describe("The Heroes' Defense (19156:A:2)", () => {
  const destroyed = (extra: Layout = {}, resources = 0, staging: readonly string[] = []) => {
    const t = wilderlandTable(world, { phase: "PlayerAttacks", discard: W, staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources }, CODES.urdug, ...staging], engaged: [{ code: CODES.strayGoblin, seat: 0 }], ...extra });
    const id = idOf(t.state, CODES.strayGoblin);
    return { t, run: settled(t, updateCard(t.state, id, { damage: world.cards.get(CODES.strayGoblin)?.health ?? 1 })) };
  };

  it("the Response names the enemy destroyed, the count, and what the resource is for", () => {
    for (const [seats, lead, need] of [[1, "", 5], [2, "Player 1: ", 10]] as const) {
      const { t, run } = destroyed({ seats }, 3);
      const sheet = sheetOf(t, run);
      expect(sheet.kind).toBe("trigger");
      expect(sheet.note).toBe(`${lead}Stray Goblin was destroyed. The Heroes' Defense holds 3 of the ${need} resources that make Urdug engaged with each player. Use it to place 1 resource. Pass and it stays at 3.`);
    }
  });

  it("with Gate of Gundabad in the staging area the Response is not offered: its only effect is barred", () => {
    const { t, run } = destroyed({}, 3, [CODES.gateOfGundabad]);
    expect(run.window?.kind).not.toBe("response");
    expect(offerOf(run, t, idOf(run, CODES.theHeroesDefense))).toBeUndefined();
    // Without the Gate the same destruction offers it.
    const open = destroyed({}, 3);
    expect(offerOf(open.run, open.t, idOf(open.run, CODES.theHeroesDefense))).toBeDefined();
  });

  it("the banner says the count after the resource, and when the enemy becomes engaged with each player", () => {
    const { t, run } = destroyed({}, 4);
    const used = send({ state: run, steps: [] }, offerOf(run, t, idOf(run, CODES.theHeroesDefense)) as never, t.ctx);
    const moment = momentOf(run, used.state, used.steps.flat(), { card: (id) => nameOf(used.state.cards[id]?.code ?? id), fate: fateNames(t.ctx, (id) => nameOf(used.state.cards[id]?.code ?? id)) });
    expect(moment?.lines.map((line) => line.text)).toEqual(["1 resource on The Heroes' Defense: it holds 5 of 5. Urdug is engaged with each player now."]);
    const less = destroyed({}, 1);
    const one = send({ state: less.run, steps: [] }, offerOf(less.run, less.t, idOf(less.run, CODES.theHeroesDefense)) as never, less.t.ctx);
    expect(momentOf(less.run, one.state, one.steps.flat(), { card: (id) => nameOf(one.state.cards[id]?.code ?? id), fate: fateNames(less.t.ctx, (id) => nameOf(one.state.cards[id]?.code ?? id)) })?.lines.map((line) => line.text)).toEqual(["1 resource on The Heroes' Defense: it holds 2 of 5."]);
  });

  it("the optional engagement says Urdug cannot be engaged, and when he counts as engaged with each player", () => {
    for (const [resources, said] of [[2, "Once The Heroes' Defense holds 5 resources (2 now) he counts as engaged with each player."], [5, "The Heroes' Defense holds 5 of 5 resources, so he counts as engaged with each player now."]] as const) {
      const t = table({}, 0, resources);
      const sheet = sheetOf(t, t.state);
      expect(sheet.note).toContain(`Urdug cannot be engaged. ${said}`);
    }
  });
});

describe("Urdug's attack against each player (19157:A:2)", () => {
  // The combat phase of a table whose Defense holds enough resources: the encounter deck's top card is a shadow card for the first attacker, the next the card Urdug discards.
  const attacks = (seats: 1 | 2, extra: Layout = {}): { t: Table; run: Run } => {
    const t = wilderlandTable(world, { seats, phase: "Combat", discard: W, staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 5 * seats }, CODES.urdug], deck: ["f0", CODES.lonelyLands, "f0", "f0"], hand: ["filler"], ...extra });
    let run: Run = start(t.state);
    for (let guard = 0; guard < 30 && run.state.window?.kind !== "defense"; guard += 1) {
      const window = run.state.window;
      if (window?.kind === "chooseEnemy") {
        run = send(run, { type: "ChooseEnemy", enemyId: window.options[0] ?? "" }, t.ctx);
        continue;
      }
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = send(run, pass as never, t.ctx);
    }
    return { t, run };
  };

  it("the defense sheet says he is engaged with each player, whom this attack is on, and the card discarded for its Threat", () => {
    const solo = attacks(1);
    expect(sheetOf(solo.t, solo.run.state).note).toBe("Attack 5. Urdug is engaged with each player and attacks you. The top card of the encounter deck, Lonely Lands, was discarded: its printed Threat 2 is part of this Attack. Choose a defender, or leave it undefended.");
    const two = attacks(2);
    expect(sheetOf(two.t, two.run.state).note).toBe("Attack 5. Urdug is engaged with each player and attacks each in turn: this attack is on Player 1. The top card of the encounter deck, Lonely Lands, was discarded: its printed Threat 2 is part of this Attack. Choose a defender, or leave it undefended.");
  });

  it("the banner says he discarded the card for its Threat", () => {
    const { t, run } = attacks(1);
    // The attack lands once the action windows around it are passed.
    let hit: Run = send(run, { type: "Undefended", heroId: t.hero } as never, t.ctx);
    const steps = [...hit.steps.flat()];
    for (let guard = 0; guard < 6 && !steps.some((step) => step.kind === "strike"); guard += 1) {
      hit = send(hit, { type: "Pass" } as never, t.ctx);
      steps.push(...hit.steps.flat());
    }
    const moment = momentOf(run.state, hit.state, steps, { card: (id) => nameOf(hit.state.cards[id]?.code ?? id), fate: fateNames(t.ctx, (id) => nameOf(hit.state.cards[id]?.code ?? id)) });
    expect(moment?.title).toBe("Urdug attacks");
    expect(moment?.lines.map((line) => line.text).slice(0, 2)).toEqual(["Attack 5 on dh1, undefended", "Urdug discarded Lonely Lands: +2 Attack from its Threat."]);
  });

  it("Urdug's Command (19166:A:1): the attack he makes at once comes from the staging area, now", () => {
    const t = table({ phase: "Encounter", deck: ["f0", CODES.lonelyLands, "f0", "f0"] });
    const revealed = bare(t, t.state, CODES.urdugSCommand, "whenRevealed", "staging");
    expect(revealed.window?.kind).toBe("defense");
    expect(sheetOf(t, revealed).note).toBe("Attack 5. Urdug attacks you now, from the staging area. If this attack destroys a character, The Goblins' Assault gets 1 progress. The top card of the encounter deck, Lonely Lands, was discarded: its printed Threat 2 is part of this Attack. Choose a defender, or leave it undefended.");
  });

  it("on the last stage Urdug's Command says what a destroyed character brings the objective to when that loses the game", () => {
    const t = table({ stage: "19170", phase: "Encounter", deck: ["f0", CODES.lonelyLands, "f0", "f0"] }, 14);
    const revealed = bare(t, t.state, CODES.urdugSCommand, "whenRevealed", "staging");
    expect(sheetOf(t, revealed).note).toContain("If this attack destroys a character, The Goblins' Assault gets 1 progress and reaches 16 of 16 at the end of the round: the game is lost.");
    const safe = table({ stage: "19170", phase: "Encounter", deck: ["f0", CODES.lonelyLands, "f0", "f0"] }, 5);
    expect(sheetOf(safe, bare(safe, safe.state, CODES.urdugSCommand, "whenRevealed", "staging")).note).toContain("If this attack destroys a character, The Goblins' Assault gets 1 progress. The top card");
  });

  it("the sheet of the Attack on Urdug says his Defense and what raises it, that he takes no damage until he has attacked this phase and he has not; after his real attack it says he can be damaged and what destroying him does", () => {
    const before = wilderlandTable(world, { phase: "PlayerAttacks", discard: W, staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 5 }, CODES.urdug, CODES.strayGoblin] });
    const attackers = (state: ScenarioState, ctx: Table["ctx"]) => {
      const sheet = sheetFor(state, ctx, legalIntents(state, ctx), names(state));
      if (sheet?.kind !== "pick") throw new Error("no pick sheet");
      const next = sheet.options.map((option) => ("next" in option ? option.next : undefined)).find((item) => item?.title === "Attack Urdug");
      return next && "note" in next ? next.note : undefined;
    };
    expect(attackers(before.state, before.ctx)).toBe("Defense 4 (+2 for each other enemy in play). Choose the characters that attack Urdug. He takes no damage until he has attacked this phase, and he has not.");
    // His attack from the staging area, made for real in the combat phase: the player attacks follow it.
    const { t, run } = attacks(1);
    let after: Run = send(run, { type: "Undefended", heroId: t.hero } as never, t.ctx);
    for (let guard = 0; guard < 12 && after.state.window?.kind !== "playerAttack"; guard += 1) after = send(after, { type: "Pass" } as never, t.ctx);
    expect(after.state.window?.kind).toBe("playerAttack");
    expect(attackers(after.state, t.ctx)).toBe("Defense 2 (+2 for each other enemy in play). Choose the characters that attack Urdug. He has attacked this phase, so he can be damaged. Destroy him and the players win.");
  });

  it("the Attack on Urdug says he takes no damage until he has resolved an attack this phase, and what his Defense counts", () => {
    const t = wilderlandTable(world, { phase: "PlayerAttacks", discard: W, staging: [CODES.theGoblinsAssault, { code: CODES.theHeroesDefense, resources: 5 }, CODES.urdug, CODES.strayGoblin] });
    const asked = send(start(t.state), { type: "DeclareAttackers", enemyId: idOf(t.state, CODES.urdug), attackerIds: [t.hero] } as never, t.ctx);
    const moment = momentOf(t.state, asked.state, asked.steps.flat(), { card: (id) => nameOf(asked.state.cards[id]?.code ?? id), fate: fateNames(t.ctx, (id) => nameOf(asked.state.cards[id]?.code ?? id)) });
    expect(moment?.lines.map((line) => line.text)).toEqual(["Attack 2 against defense 4", "No damage", "Urdug takes no damage until he has resolved an attack this phase."]);
  });
});

describe("the banner of the other lines", () => {
  const nameFor = (state: ScenarioState) => (id: string) => nameOf(state.cards[id]?.code ?? id);

  it("Dark Clouds revealed before the quest says what it does and that a failed quest puts progress on The Goblins' Assault; revealed after the quest it says nothing is put", () => {
    const t = wilderlandTable(world, { phase: "Quest", discard: W, staging: [CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug], deck: [CODES.darkClouds, "f0", "f0"] });
    let run: Run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] } as never, t.ctx);
    const before = run.state;
    run = send(run, { type: "Pass" } as never, t.ctx);
    const moment = momentOf(before, run.state, run.steps.flat(), { card: nameFor(run.state), fate: fateNames(t.ctx, nameFor(run.state)) });
    const lines = moment?.lines.map((line) => line.text) ?? [];
    expect(lines).toContain("Each enemy and location in the staging area gets +1 Threat until the end of the phase. If the players quest unsuccessfully this phase, The Goblins' Assault gets 1 progress.");
    const names = fateNames(t.ctx, nameFor(t.state));
    const dark = idOf(run.state, CODES.darkClouds);
    expect(names.revealed(run.state, dark, false)).toBe("Each enemy and location in the staging area gets +1 Threat until the end of the phase. The quest is already over this round, so The Goblins' Assault gets no progress from it.");
    expect(names.revealed(run.state, idOf(run.state, CODES.theHeroesDefense), true)).toBeNull();
  });

  it("progress placed on The Goblins' Assault says what it holds against what the stage asks", () => {
    const t = table({}, 1);
    const placed = send({ state: bare(t, t.state, CODES.slopesOfGundabad, "whenRevealed", "staging"), steps: [] }, { type: "Choose", optionId: "progress" } as never, t.ctx);
    const moment = momentOf(t.state, placed.state, placed.steps.flat(), { card: nameFor(placed.state), fate: fateNames(t.ctx, nameFor(placed.state)) });
    expect(moment?.lines.map((line) => line.text)).toContain("The Goblins' Assault: 2 of 4 progress, +1 at the end of the round (1 for each enemy in the staging area). At 4 the goblins push the quest on.");
  });
});

describe("the words rules over every sheet above", () => {
  it("has no doubled colon after the lead, and no row label repeated in its note", () => {
    expect(opened_.length).toBeGreaterThan(15);
    for (const sheet of opened_) {
      expect(sheet.note, sheet.note).not.toContain("::");
      // "Player 1: Card: ..." has two leads; the lead is "Player 1, Card: ..." or "Player 1: ..." alone.
      expect(sheet.note, sheet.note).not.toMatch(/^Player \d+: [^.]*?: /);
      if (sheet.kind === "pick") for (const label of sheet.labels) expect(sheet.note, `${sheet.note} / ${label}`).not.toContain(label);
      expect(sheet.note.length, sheet.note).toBeLessThan(430);
    }
  });
});
