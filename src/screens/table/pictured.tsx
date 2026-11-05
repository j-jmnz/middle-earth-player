// The table canvas and the spotlight's layer read the image cache's revision themselves, so a picture that lands draws them and not the
// table view above them (its hooks and its panels).
import { memo } from "react";

import { SpotlightLayer } from "../../play/spotlight/layer";
import type { SpotlightLayerProps } from "../../play/spotlight/handoff";
import { TableCanvas } from "../../play/canvas/table-canvas";
import type { TableCanvasProps } from "../../play/canvas/table-canvas-types";
import { useImageSnapshot } from "../images/store";

export const PicturedCanvas = memo(function PicturedCanvas(props: Omit<TableCanvasProps, "pictureRevision">) {
  const { revision } = useImageSnapshot();
  return <TableCanvas {...props} pictureRevision={revision} />;
});

export const PicturedSpotlight = memo(function PicturedSpotlight(props: Omit<SpotlightLayerProps, "pictureRevision">) {
  const { revision } = useImageSnapshot();
  return <SpotlightLayer {...props} pictureRevision={revision} />;
});
