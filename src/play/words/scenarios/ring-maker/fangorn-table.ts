// Rules: rm.hinder, rr.guarded, rr.objective-cards, rr.attachment-cards, rr.cannot (data/rules/entries.json); ledger lines 07031:A:2, 07031:A:3, 07033:A:1, 07034:A:1, 07035:A:1, 07057:A:2, 07058:A:1.
// What the table says of Into Fangorn's pieces (src/play/cards/ring-maker/preview.ts): Mugash held under Edge of Fangorn and then under a hero, the Hinder Huorns, and Off Track and In Need of Rest on their hosts.
// The engine decided every fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** Mugash lying on Edge of Fangorn: why no player claims him yet, how one will, and where he goes. */
export const mugashOnEdgeWords = (edge: string): string => `Mugash lies on ${edge}, so no player can claim him. When ${edge} leaves play he stays in the staging area, and a player can claim him.`;

/** Mugash held by a hero: what returns him. `host` is the hero. */
export const mugashOnHeroWords = (host: string): string => `${host} holds Mugash. If ${host} takes damage, Mugash returns to the top of the encounter deck. If ${host} leaves play any other way, he returns to the staging area.`;

/** Mugash in the staging area: how a player claims him. `guarded` is whether a card is attached to him as his guard. */
export const mugashFreeWords = (guarded: boolean): string => (guarded ? "Mugash is guarded: a player can claim him only when he is free of encounters." : "Mugash is free of encounters. A player can exhaust a ready hero he controls to claim him.");

/** A Hinder Huorn in the preview, by where it lies: in the staging area it does nothing yet, engaged it acts in the combat phase. */
export const hinderWords = (engaged: boolean): string =>
  engaged
    ? "Hinder: in the combat phase this enemy makes no attack and is dealt no shadow card. At the start of that phase it removes 1 progress from the current quest, else from the active location."
    : "Hinder: once engaged, this enemy makes no attack in the combat phase. It removes 1 progress from the current quest, else from the active location, at the start of that phase.";

/** The line on a location that holds Off Track. */
export const offTrackHostWords = (): string => "Off Track is attached: +2 quest points. At the end of each refresh phase, 1 more time counter comes off the current quest.";

/** The pill on a hero that holds In Need of Rest: a word that fits a narrow card (the full name is in the preview), and what the reader hears. */
export const REST_MARK = { text: "Rest", loses: false, speech: "In Need of Rest attached" } as const;

/** The line on the hero that holds In Need of Rest. */
export const needOfRestHostWords = (host: string): string => `${host} holds In Need of Rest and takes 1 damage each time a time counter comes off the current quest.`;
