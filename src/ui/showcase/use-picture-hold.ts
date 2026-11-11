// Holds the showcase's picture count while `pending` is true (picture-loads.ts). Inert outside the showcase build.
import { useEffect, useId } from "react";

import { holdPicture, SHOWCASE } from "./picture-loads.ts";

export function usePictureHold(pending: boolean): void {
  const id = useId();
  useEffect(() => {
    if (!SHOWCASE || !pending) return;
    return holdPicture(id);
  }, [id, pending]);
}
