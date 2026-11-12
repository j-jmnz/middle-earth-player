// What a Resolution records in the Campaign Log's notes section for The Return of the King (docs/brief.md, The Return of the King). Plain data, shared by the effect schema (RecordTokens, EndCampaign),
// the Resolution, the log and its save.

/** The counts a Resolution records in the notes section: the resources on The Corsair Fleet and the resource tokens on The Black Gate (location). */
export const RECORDED_COUNTS = ["corsairFleet", "blackGateTokens"] as const;
export type RecordedCount = (typeof RECORDED_COUNTS)[number];

/** How the saga ends: the players keep The One Ring and lose the campaign, or destroy it and win (Mount Doom's Resolution). */
export const CAMPAIGN_ENDS = ["won", "lost"] as const;
export type CampaignEnd = (typeof CAMPAIGN_ENDS)[number];
