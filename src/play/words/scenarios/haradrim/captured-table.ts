// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes, rr.guarded, rr.blank (data/rules/entries.json); ledger lines 17119:A:1, 17119:A:3, 17120:A:1, 17120:A:3, 17131:A:1, 17132:A:1 (docs/scenarios/haradrim/the-dungeons-of-cirith-gurat.md, Table).
// What the table says of the characters an encounter card holds in The Dungeons of Cirith Gurat (src/play/readouts/haradrim/captured.ts). The engine decided each fact; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** The preview of a captured ally: whose it is, who holds it and when it comes back. `owner` is "Player 2's" or "your"; `host` the card that holds it. */
export const capturedAllyWords = (owner: string, host: string): string =>
  `${owner} ally, held by ${host}. No player controls it, its text box is blank and it is a guarded objective. It returns to its owner, exhausted, when ${host} leaves play.`;

/** The preview of Abaan while a card holds him: no owner, the loss and who gains him. */
export const capturedAbaanWords = (host: string): string =>
  `Held by ${host}, a guarded objective with a blank text box. The first player gains control of him when ${host} leaves play. If he leaves play, the players lose the game.`;

/** The preview of a card that holds characters: each named (`owned` is false for one with no owner, Abaan), and what frees them. */
export const holdsCapturedWords = (held: readonly { name: string; owned: boolean }[], host: string): string => {
  const owned = held.filter((one) => one.owned).map((one) => one.name);
  const free = held.filter((one) => !one.owned).map((one) => one.name);
  const back = owned.length > 0 ? ` ${owned.join(", ")} return${owned.length === 1 ? "s" : ""} to ${owned.length === 1 ? "its" : "their"} owner${owned.length === 1 ? "" : "s"}, exhausted, when ${host} leaves play.` : "";
  const gained = free.length > 0 ? ` The first player gains control of ${free.join(", ")} when ${host} leaves play.` : "";
  return `Holds ${held.map((one) => one.name).join(", ")}.${back}${gained}`;
};

/** The line a seat's dial says of one ally an encounter card holds. */
export const capturedDialWords = (ally: string, host: string): string => `${ally} is captured by ${host}`;
