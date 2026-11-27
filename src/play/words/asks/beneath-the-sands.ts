import type { Ask } from "../asks.ts";
import { ELIMINATES_SEATS, type When } from "../asks-conditions.ts";
import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";

// The choice words of Beneath the Sands (haradrim part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario beneath-the-sands --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=beneath-the-sands` prints each sentence.
// The cards the words read: On Track (17080) is in play while the objective shows that side, Lost Underground (17075) blocks every flip but its own, Grabbed by Spiders (17074) discards allies at a flip to Off Track, and stage 3 (17078) loses its progress at one.
// A condition that is not itself a `not`, `all` or `any`: what an `all` holds.
type Atom = Exclude<When, { kind: "all" | "any" | "not" }>;
const ON_TRACK: Atom = { kind: "inPlay", code: "17080", is: true };
const BLOCKED: Atom = { kind: "inPlay", code: "17075", is: true };
// The flip happens: the objective shows On Track and Lost Underground is not in play; each condition is one the `all` of a caution holds.
const FLIPS: readonly Atom[] = [ON_TRACK, { kind: "inPlay", code: "17075", is: false }];
const GRABBED: Atom = { kind: "count", pick: { type: "attachment", control: "any", names: ["Grabbed by Spiders"] }, min: 1 };
const AT_STAGE_3: readonly Atom[] = [{ kind: "onStage", stage: 3 }, { kind: "stageProgress", min: 1 }];
// The resources on Off Track, the raise its threat option makes (17079:A:1).
const RESOURCES = { stat: "resources", of: "self" } as const;
// The raise takes a seat to the elimination level: its threat plus the resources on Off Track (the condition seatThreat, read for each seat).
const REACHES = (seat: number): When => ({ kind: "seatThreat", seat, min: ELIMINATION_LEVEL, plus: RESOURCES });

export const ASKS: Readonly<Record<string, Ask>> = {
  // 17073:whenRevealed:1 (Forced Off Track, whenRevealed): When Revealed: Either flip the Search objective to Off Track, or deal 1 damage to each questing character.
  // The row says what the flip does now: it flips from On Track, it does nothing when the objective is Off Track already or Lost Underground blocks it, and the tap again names what the flip costs (Grabbed by Spiders, stage 3's progress).
  "17073:whenRevealed:1 @0 flip": {
    label: [
      { when: { kind: "all", conditions: [ON_TRACK, BLOCKED] }, text: "The Search objective cannot flip while Lost Underground is in play: nothing changes" },
      { when: ON_TRACK, text: "Flip the Search objective from On Track to Off Track" },
      { text: "The Search objective is already Off Track: nothing changes" },
    ],
    caution: {
      when: ON_TRACK,
      text: [
        { when: { kind: "all", conditions: [...FLIPS, GRABBED, ...AT_STAGE_3] }, text: "Tap again: each player discards an ally they control, then Grabbed by Spiders is discarded, and stage 3 loses all its progress" },
        { when: { kind: "all", conditions: [...FLIPS, GRABBED] }, text: "Tap again: each player discards an ally they control, then Grabbed by Spiders is discarded" },
        { when: { kind: "all", conditions: [...FLIPS, ...AT_STAGE_3] }, text: "Tap again: stage 3 loses all its progress" },
      ],
    },
  },
  "17073:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each questing character" },
  // 17079:forced:1 (Off Track, forced): Forced: At the end of the quest phase, place 1 resource here. Then, either return the topmost location in the encounter discard pile to the staging area, or raise each player's threat by 1 for each resource here.
  // The row names the location that returns and the raise it makes (the resource it just took is counted); the threat row warns, for each player the raise takes to 50, and names them.
  "17079:forced:1 @1 location": { label: "Return {location} to the staging area", named: { location: { pick: { type: "location", control: "any", from: "encounterDiscard", topmost: true }, otherwise: "the topmost location in the encounter discard pile" } } },
  "17079:forced:1 @1 threat": {
    label: [
      { when: { kind: "less", left: RESOURCES, right: 2 }, text: "Each player's threat +{x} ({x} resource on Off Track)" },
      { text: "Each player's threat +{x} ({x} resources on Off Track)" },
    ],
    bind: { x: RESOURCES },
    caution: ELIMINATES_SEATS(REACHES),
  },

  // 17065:forced:2 (Brood Mother): at the end of the round, a Spider Broodling from the encounter deck or discard pile joins the staging area.
  "17065:forced:2 @0 SearchMove": { note: "Brood Mother: choose a Spider Broodling in the encounter deck or discard pile to add to the staging area.", verb: "Add" },

  // 17071:shadow:1 (shadow): the defending player exhausts a character.
  "17071:shadow:1 @0 Pick": { owned: true, note: "{card}: choose a character you control to exhaust.", verb: "Exhaust" },

  // 17072:shadow:1 (shadow): the defending player discards an attachment.
  "17072:shadow:1 @0 Pick": { owned: true, note: "{card}: choose an attachment you control to discard.", verb: "Discard" },

  // 17074:forced:1 (Grabbed by Spiders, attached to the main quest): each player discards an ally they control.
  "17074:forced:1 @1.0 Pick": { owned: true, note: "Grabbed by Spiders: choose an ally you control to discard.", verb: "Discard" },
};
