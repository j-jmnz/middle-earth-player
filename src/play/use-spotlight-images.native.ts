// The pictures the combat spotlight draws (docs/design-system.md, Table, Spotlight): the table's decode is a card's size on screen, and
// the spotlight draws cards about 1.8 times as large, so while the spotlight plays the plan's cards (the shadow card's face too) are
// decoded again at the stage's size and released when it ends. Until a picture is ready the table's own is drawn.
import type { SkImage } from "@shopify/react-native-skia";
import { useMemo } from "react";

import type { SpotlightPlan } from "./spotlight-plan.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import { useTableImages } from "./table-images.native.ts";

const NONE: readonly string[] = [];
const SIZE = { w: 1, h: 1 };

export function useSpotlightImages(plan: SpotlightPlan | null, playing: boolean, picture: (code: string) => PictureSource | null, revision: number, table: ReadonlyMap<string, SkImage>): ReadonlyMap<string, SkImage> {
  const target = plan?.clashes[0]?.stage.target;
  const size = useMemo(() => (target ? { w: target.w, h: target.h } : SIZE), [target?.w, target?.h]); // eslint-disable-line react-hooks/exhaustive-deps -- the size, not the rectangle
  const big = useTableImages(playing && plan ? plan.codes : NONE, picture, size, revision);
  return useMemo(() => (big.size === 0 ? table : new Map([...table, ...big])), [table, big]);
}
