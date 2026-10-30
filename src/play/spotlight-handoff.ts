// What the table canvas hands the combat spotlight's layer (docs/plans/done/combat-spotlight-redesign.md, §1). The spotlight is drawn by its
// own full-screen canvas (spotlight-layer.native.tsx), but the clock, the plan and the table's pictures are the table canvas's. The
// screen creates one small vanilla store, passes it to both, and the canvas publishes into it when the plan, whether it plays or the
// motion scale changes. Only the layer subscribes, so neither the screen nor the memoized table canvas renders again for it. The
// `progress` clock is one SharedValue that both canvases read. Nothing here draws.
import type { SkImage } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { SpotlightPlan } from "./spotlight-plan.ts";
import type { Warm } from "./spotlight-warm.ts";
import type { PictureSource } from "./table-canvas-types.ts";

export type Handoff = {
  plan: SpotlightPlan | null;
  // The 0..1 clock over the whole run (use-spotlight.ts); null until a canvas publishes.
  progress: SharedValue<number> | null;
  // The motion scale the plan plays at (1 Normal, 0.6 Quick).
  k: number;
  playing: boolean;
  // The pictures of an attack still pending, which the layer decodes at the stage's size before the spotlight plays (spotlight-warm.ts).
  warm: Warm | null;
  // The table's own decodes, drawn until the layer's stage-size ones are ready.
  tableImages: ReadonlyMap<string, SkImage>;
};

export type SpotlightHandoff = StoreApi<Handoff>;

const EMPTY: ReadonlyMap<string, SkImage> = new Map();

export function createHandoff(): SpotlightHandoff {
  return createStore<Handoff>()(() => ({ plan: null, progress: null, k: 1, playing: false, warm: null, tableImages: EMPTY }));
}

/** What the layer needs from the screen to decode and name the cards (the table canvas's own props). */
export type SpotlightLayerProps = {
  handoff: SpotlightHandoff;
  picture: (code: string) => PictureSource | null;
  pictureRevision: number;
  nameOf: (code: string) => string;
  sphereOf: (code: string) => string | null;
};
