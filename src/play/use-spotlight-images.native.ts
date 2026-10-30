// The pictures the combat spotlight draws (docs/design-system.md, Table, Spotlight): the table's decode is a card's size on screen, and
// the spotlight draws cards about 1.8 times as large, so while the spotlight plays the layer decodes the plan's cards (the shadow card's
// face too) again at the stage's size, with room for the camera's punch-in (FX.push, 1.06), and releases them when it ends. Until a picture
// is ready the table's own is drawn. The decodes start earlier than the spotlight: when an enemy's attack is declared (`warm`, spotlight-warm.ts),
// the enemy's and then its defender's, so a plan that starts a few taps later finds them ready.
import type { SkImage } from "@shopify/react-native-skia";
import { useMemo } from "react";

import { FX } from "./spotlight-fx.ts";
import type { SpotlightPlan } from "./spotlight-plan.ts";
import type { PictureSource } from "./table-canvas-types.ts";
import type { Warm } from "./spotlight-warm.ts";
import { useTableImages } from "./table-images.native.ts";

export function useSpotlightImages(plan: SpotlightPlan | null, playing: boolean, picture: (code: string) => PictureSource | null, revision: number, table: ReadonlyMap<string, SkImage>, warm: Warm | null): ReadonlyMap<string, SkImage> {
  const codes = playing && plan ? plan.codes : (warm?.codes ?? null);
  // The size is the largest card any of the attacks stands (a lone attacker's stage is larger than a fan's); a pending attack's is warm's.
  const playingNow = playing && plan != null;
  const w = playingNow ? Math.max(1, ...plan.clashes.map((clash) => clash.stage.target.w)) * FX.push : (warm?.w ?? 1);
  const h = playingNow ? Math.max(1, ...plan.clashes.map((clash) => clash.stage.target.h)) * FX.push : (warm?.h ?? 1);
  // Every code of the plan at the stage's size (or of the pending attack, decoded ahead), none while neither is there.
  const boxes = useMemo(() => new Map((codes ?? []).map((code) => [code, { w, h }])), [codes, w, h]);
  const big = useTableImages(boxes, picture, revision);
  return useMemo(() => (big.size === 0 ? table : new Map([...table, ...big])), [table, big]);
}
