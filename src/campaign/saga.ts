// Rules: mec109.setting-up-the-game, mec112.setting-up-the-game, mec112.aragorn, mec112.fellowship-sphere-heroes,
// mec112.saruman-grima-smeagol, mec112.campaign-mode-aragorn (data/rules/entries.json). Who the first player takes control of at
// the start of a saga scenario, and the title bans of the box. Pure.
import type { CampaignData, ScenarioData } from "../catalog/scenario-data.ts";

/**
 * The saga hero the first player starts a scenario with: the Ring-bearer from their own heroes with The One Ring attached (the
 * Fellowship box, and scenarios 10 to 12 of The Two Towers), a named ☺ hero the scenario grants (☺ Aragorn in scenarios 7 to 9),
 * or none outside a saga.
 */
export type SagaRole = { kind: "none" } | { kind: "ringBearer" } | { kind: "hero"; hero: string };

const NONE: SagaRole = { kind: "none" };
const RING_BEARER: SagaRole = { kind: "ringBearer" };

/** The role of a scenario: its own `sagaStart` (The Two Towers) first, then the campaign's `saga` flag (the Fellowship, whose six scenarios all use the Ring-bearer). */
export function sagaRoleOf(campaign: Pick<CampaignData, "saga">, scenario: Pick<ScenarioData, "sagaStart">): SagaRole {
  const start = scenario.sagaStart;
  if (start) return "hero" in start ? { kind: "hero", hero: start.hero } : RING_BEARER;
  return campaign.saga ? RING_BEARER : NONE;
}

/** The codes a scenario's saga start attaches to the Ring-bearer in the Setup, beyond the campaign's prelude (The One Ring's Two Towers print). */
export function sagaAttachments(scenario: Pick<ScenarioData, "sagaStart">): readonly string[] {
  const start = scenario.sagaStart;
  return start && "attached" in start ? start.attached : [];
}

/** A title the players cannot use in a box, and the card types it is refused on (`null`: any card). */
export type TitleBan = { title: string; types: readonly string[] | null; rule: string };

// "When playing the scenarios in The Two Towers Saga Expansion, the players cannot use any ally or hero card with the title
// 'Saruman,' 'Gríma,' or 'Sméagol'" (mec112.saruman-grima-smeagol). Standalone play follows it too: it is not a Campaign Mode rule.
const TWO_TOWERS_BANS: readonly TitleBan[] = ["Saruman", "Gríma", "Sméagol"].map((title) => ({ title, types: ["ally", "hero"], rule: "mec112.saruman-grima-smeagol" }));

// The Treason of Saruman scenarios (7 to 9) grant ☺ Aragorn, and "players cannot use any card titled Frodo Baggins" in them: the
// Ring-bearer stays on the log and returns for 10 to 12 (docs/brief.md, The Two Towers; user decision, 2026-11-07).
const NO_FRODO: TitleBan = { title: "Frodo Baggins", types: null, rule: "mec112.fellowship-sphere-heroes" };

/** The campaign whose log keeps the Two Towers columns and whose box bans the titles above (data/campaigns/the-two-towers.json). */
export const TWO_TOWERS_CAMPAIGN = "the-two-towers";

/** The titles the players cannot use in this scenario of this campaign. */
export function titleBansOf(campaign: Pick<CampaignData, "id">, scenario: Pick<ScenarioData, "sagaStart">): readonly TitleBan[] {
  if (campaign.id !== TWO_TOWERS_CAMPAIGN) return [];
  return scenario.sagaStart && "hero" in scenario.sagaStart ? [...TWO_TOWERS_BANS, NO_FRODO] : TWO_TOWERS_BANS;
}

/** A card title compared without case or accents, as the printed names of the bans are ("Gríma" and "Grima" are one title). */
export function sameTitle(a: string, b: string): boolean {
  const plain = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return plain(a) === plain(b);
}
