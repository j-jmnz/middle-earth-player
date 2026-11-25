// The table menu with the update offer (docs/design-system-table.md, Table menu): the table shows no update ribbon, so the version on offer heads the
// menu's rows (src/play/chrome/table-menu-items.ts), and its row opens the release page here, where src/screens may open a link. Every other row goes to
// the table's own handler, which never sees "update". Copy game state is handled here too (copy-state.ts), and its row is left out while Debug tools is off
// (docs/design-system.md, Settings). The number on the Set aside row is read here too (src/play/store/set-aside.ts): a number, so a state that sets nothing aside renders neither the menu nor the table.
import type { ComponentProps } from "react";
import { useStore } from "zustand";

import { TableMenu } from "../../play/chrome/table-menu";
import type { MenuItemId } from "../../play/chrome/table-menu-items";
import { setAsideCount } from "../../play/store/set-aside";
import type { ReduceContext } from "../../play/store/store";
import { tableSettings } from "../../ui/table-settings";
import { openReleasePage } from "../settings/links";
import { useUpdateOffer } from "../update/offer";
import { copyGameState, type GameStateSource } from "./copy-state";

/** A menu row the table handles itself: every row but the update offer and Copy game state. */
export type TableMenuRow = Exclude<MenuItemId, "update" | "debug">;

type Props = Omit<ComponentProps<typeof TableMenu>, "update" | "onSelect" | "setAside"> & { onSelect: (id: TableMenuRow) => void; state: GameStateSource; ctx: ReduceContext };

const NO_DEBUG: readonly MenuItemId[] = ["debug"];

export function UpdateTableMenu({ onSelect, state, ctx, without, ...props }: Props) {
  const update = useUpdateOffer();
  const setAside = useStore(state.store, (table) => setAsideCount(table.game, ctx));
  const debugTools = useStore(tableSettings, (settings) => settings.settings.debugTools);
  const hidden = debugTools ? without : [...(without ?? []), ...NO_DEBUG];
  const select = (id: MenuItemId) => {
    if (id === "debug") {
      // The game is read when the row is tapped, never during a render.
      props.onClose();
      void copyGameState(state);
      return;
    }
    if (id !== "update") {
      onSelect(id);
      return;
    }
    // The menu closes like after any row; the game is saved on every intent, so the browser can open over it.
    props.onClose();
    if (update) openReleasePage(update);
  };
  return <TableMenu {...props} without={hidden} update={update} setAside={setAside} onSelect={select} />;
}
