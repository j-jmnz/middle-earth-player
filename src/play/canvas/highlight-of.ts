// What the canvas draws for the open moment, as strings that compare by value (so a change elsewhere in the game does not draw
// the table again; docs/architecture.md, State) and the TableHighlight they build. Split out of use-table-choice.ts. Card ids
// carry no commas.
import { discardPlays, marked, tappable, type Choice } from "../choice/table-choice.ts";
import type { ScenarioState } from "../store/store.ts";
import type { LayoutOptions } from "../layout/layout.ts";
import type { OptionMark, Sheet } from "../choice/sheet-types.ts";
import type { TableHighlight } from "./table-canvas-types.ts";

export type HighlightKeys = { glow: string; picked: string; share: TableHighlight["share"]; dim: boolean; marks: string; muted: string; keep: string };

export function highlightKeys({ game, seat, sheet, choice, panel }: { game: ScenarioState; seat: number; sheet: Sheet; choice: Choice; panel: boolean }): HighlightKeys {
  // A card the seat may play from its discard pile is not drawn on the table: the pile glows, and its list plays it. While the
  // table peeks at the other seat's pile nothing glows (the canvas draws NO_HIGHLIGHT, peek.ts).
  const pile = discardPlays(game, seat, sheet).length > 0 ? ["pile:discard"] : [];
  const glow = panel ? "" : [...tappable(sheet), ...pile].join(",");
  // In planning, the hand cards that cannot be played now are dimmed, so the player sees which can (a tap says why not).
  const muted = !panel && sheet.kind === "window" && game.mode === "planning" ? (game.seats[seat]?.hand ?? []).filter((id) => !sheet.plays.includes(id)).join(",") : "";
  const marks = (panel ? [] : optionMarksOf(sheet)).map(([id, mark]) => `${id}=${mark.icon}:${mark.value}:${mark.danger ? 1 : 0}`).join(",");
  const pickedNow = [...marked(sheet, choice)];
  return {
    glow,
    // Not cleared by the open tray: a fold that took these would leave the moment unable to get back to the table.
    keep: [...tappable(sheet), ...pickedNow.map(([id]) => id)].join(","),
    picked: pickedNow.map(([id, amount]) => `${id}=${amount}`).join(","),
    share: sheet.kind === "distribute" ? (sheet.purpose.kind === "archery" ? "damage" : "pay") : null,
    // A pick (a defender, a location, a payment) dims what it does not ask about; the action window does not.
    dim: !panel && glow !== "" && sheet.kind !== "window",
    marks,
    muted,
  };
}

/**
 * Whether the board leaves the open sheet's cards unlit (`panel` for highlightKeys): only while the choice is on paper and none of its
 * cards is drawn on the table. A tray that opened for a folded or off-table option, or after List, Actions or Commit, still glows, dims
 * and marks the cards that are on the table, and a tap on one picks it (tray-logic.ts, tapRoute).
 */
export function boardUnlit(panel: boolean, sheet: Sheet, onTable: (cardId: string) => boolean): boolean {
  return panel && ![...tappable(sheet)].some(onTable);
}

const ids = (key: string): string[] => (key === "" ? [] : key.split(","));

export function highlightOf(keys: HighlightKeys): TableHighlight {
  return {
    tappable: new Set(ids(keys.glow)),
    picked: new Map(ids(keys.picked).map((entry): [string, number] => [entry.split("=")[0] ?? "", Number(entry.split("=")[1])])),
    share: keys.share,
    dimOthers: keys.dim,
    marks: new Map(
      ids(keys.marks).map((entry): [string, OptionMark] => {
        const [id = "", rest = ""] = entry.split("=");
        const [icon = "damage", value = "0", danger = "0"] = rest.split(":");
        return [id, { icon: icon as OptionMark["icon"], value: Number(value), danger: danger === "1" }];
      }),
    ),
    muted: new Set(ids(keys.muted)),
    keep: new Set(ids(keys.keep)),
  };
}

/** The fight picked and not confirmed yet, from the string that compares by value ("enemy:kind:id,id"; "" for none). */
export function fightOf(key: string): LayoutOptions["preview"] {
  if (key === "") return null;
  const [enemyId = "", kind = "defense", ids = ""] = key.split(":");
  return { enemyId, kind: kind as NonNullable<LayoutOptions["preview"]>["kind"], ids: ids.split(",") };
}

// The marks a sheet's options carry, by card id.
function optionMarksOf(sheet: Sheet): [string, OptionMark][] {
  if (sheet.kind !== "pick" && sheet.kind !== "multi") return [];
  return sheet.options.flatMap((item): [string, OptionMark][] => (item.mark ? [[item.id, item.mark]] : []));
}

// The hand card a sheet the player opened is about: the card being played.
export function playedCard(sheet: Sheet): string | null {
  if (sheet.kind === "pick") return sheet.about?.[0] ?? null;
  if (sheet.kind === "distribute" && sheet.purpose.kind === "play") return sheet.purpose.cardId;
  return null;
}
