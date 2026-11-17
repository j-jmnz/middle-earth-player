// The table menu with the update offer (docs/design-system-table.md, Table menu): the table shows no update ribbon, so the version on offer heads the
// menu's rows (src/play/chrome/table-menu-items.ts), and its row opens the release page here, where src/screens may open a link. Every other row goes to
// the table's own handler, which never sees "update".
import type { ComponentProps } from "react";

import { TableMenu } from "../../play/chrome/table-menu";
import type { MenuItemId } from "../../play/chrome/table-menu-items";
import { openReleasePage } from "../settings/links";
import { useUpdateOffer } from "../update/offer";

/** A menu row the table handles itself: every row but the update offer. */
export type TableMenuRow = Exclude<MenuItemId, "update">;

type Props = Omit<ComponentProps<typeof TableMenu>, "update" | "onSelect"> & { onSelect: (id: TableMenuRow) => void };

export function UpdateTableMenu({ onSelect, ...props }: Props) {
  const update = useUpdateOffer();
  const select = (id: MenuItemId) => {
    if (id !== "update") {
      onSelect(id);
      return;
    }
    // The menu closes like after any row; the game is saved on every intent, so the browser can open over it.
    props.onClose();
    if (update) openReleasePage(update);
  };
  return <TableMenu {...props} update={update} onSelect={select} />;
}
