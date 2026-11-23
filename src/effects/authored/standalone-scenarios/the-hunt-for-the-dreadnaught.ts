import type { Effect } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as A_STORM_ON_COBAS_HAVEN } from "../a-storm-on-cobas-haven.ts";
import { AUTHORED_EFFECTS as FLIGHT_OF_THE_STORMCALLER } from "../flight-of-the-stormcaller.ts";
import { AUTHORED_EFFECTS as THE_CITY_OF_CORSAIRS } from "../the-city-of-corsairs.ts";
import { AUTHORED_EFFECTS as VOYAGE_ACROSS_BELEGAER } from "../voyage-across-belegaer.ts";
import { withCopies } from "../reprint.ts";
import { ENCOUNTER } from "./the-hunt-for-the-dreadnaught/encounter.ts";
import { MODES } from "./the-hunt-for-the-dreadnaught/modes.ts";
import { SHIPS } from "./the-hunt-for-the-dreadnaught/ships.ts";

// Records for The Hunt for the Dreadnaught (standalone-scenarios cycle part 14, no campaign card). Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. The mode cards 40001 (Easy) and 40002 (Standard, the Normal game) are the scenario's `modeCard` and `easyModeCard`: their Setup runs after the quest card's Setup steps as one effect frame
// (the fleet choice asks), then the card is flipped and its back works all game. Reading 3 (docs/scenarios/standalone-scenarios/the-hunt-for-the-dreadnaught.md, The Hunt for the Dreadnaught): the fleet is prepared with the rest of the mode card's Setup, after the mulligan, so the
// starting-hand lines of Pride of Lebennin and Silent Mist are Setup draws. The global values (the stages, the Dreadnaught) are the printed number times the players who started the scenario (reading 16).
// Rules: rr.setup, rr.forced, rr.response, rr.action, rr.player-elimination, rr.damage, rr.engaged, rr.attacks-outside-the-combat-phase, rr.first-player, rr.cancel, rr.immune, rr.blank, dcce.ship-objectives, dcce.ship-enemies, dcce.prepare-your-fleet, dcce.corsair-deck, dcce.boarding, dcce.archery, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.lasting-effects (data/rules/entries.json).
export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([...MODES, ...SHIPS, ...ENCOUNTER], { pool: [...A_STORM_ON_COBAS_HAVEN, ...FLIGHT_OF_THE_STORMCALLER, ...THE_CITY_OF_CORSAIRS, ...VOYAGE_ACROSS_BELEGAER] });

export const AUTHORED_REPLACES: readonly string[] = [];
