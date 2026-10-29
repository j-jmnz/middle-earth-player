// The pictures the combat spotlight draws (docs/design-system.md, Table, Spotlight): the table's decode is a card's size on screen, and
// the spotlight draws cards about 1.8 times as large, so while the spotlight plays the plan's cards (the shadow card's face too) are
// decoded again at the stage's size and released when it ends. Until a picture is ready the table's own is drawn.
import type { SkImage } from "@shopify/react-native-skia";
import { useMemo } from "react";

import type { SpotlightPlan } from "./spotlight-plan.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { useTableImages } from "./table-images.native.ts";

export function useSpotlightImages(plan: SpotlightPlan | null, playing: boolean, picture: (code: string) => PictureSource | null, revision: number, table: ReadonlyMap<string, SkImage>): ReadonlyMap<string, SkImage> {
  const target = plan?.clashes[0]?.stage.target;
  const codes = playing && plan ? plan.codes : null;
  // Every code of the plan at the stage's size, none while nothing plays.
  const boxes = useMemo(() => new Map((codes && target ? codes : []).map((code) => [code, { w: target?.w ?? 1, h: target?.h ?? 1 }])), [codes, target?.w, target?.h]); // eslint-disable-line react-hooks/exhaustive-deps -- the size, not the rectangle
  const big = useTableImages(boxes, picture, revision);
  return useMemo(() => (big.size === 0 ? table : new Map([...table, ...big])), [table, big]);
}
