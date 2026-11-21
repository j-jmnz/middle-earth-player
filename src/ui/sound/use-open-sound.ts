// The open and close sounds of a sheet or a popover (docs/design-system-table.md, Sound): each time `open` changes, never on mount,
// and not again when a hidden screen's effects run again on show (the last state is kept in a ref).
import { useEffect, useRef } from "react";

import { playSound } from "./sound.ts";

export function useOpenSound(open: boolean): void {
  const was = useRef(open);
  useEffect(() => {
    if (was.current === open) return;
    was.current = open;
    playSound(open ? "ui.open" : "ui.close");
  }, [open]);
}
