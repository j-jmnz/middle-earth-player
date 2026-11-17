// The web layer's warm-up (spotlight/held-layer.tsx, warm-plan.ts, use-warm-up.ts): inside the persistent canvas, a spotlight of the warm
// plan that draws, hidden, a few frames while the table is idle, so every pipeline a real spotlight draws with is compiled before it plays.
// It is a component of the canvas (not of the layer) so that its clock, its screen size and its images are not the layer's to render again,
// and it exists on the web only.
import type { SkImage } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { useMemo, type ComponentProps } from "react";

import { Spotlight } from "./spotlight.native.tsx";
import { useWarmUp } from "./use-warm-up.ts";
import { WARM_CODE, warmPlan } from "./warm-plan.ts";

type Common = Omit<ComponentProps<typeof Spotlight>, "plan" | "progress" | "images" | "nameOf" | "sphereOf" | "k">;

const nameOf = () => "";
const sphereOf = () => null;

/** `card` is a picture the warm plan's cards are drawn with (null until one is loaded); `busy` is whether a real spotlight plays. */
export function WarmSpotlight({ enabled, busy, card, ...common }: Common & { enabled: boolean; busy: boolean; card: SkImage | null }) {
  const screen = useWindowDimensions();
  const { warming, clock } = useWarmUp(enabled && card != null && common.damage != null, busy);
  const plan = useMemo(() => warmPlan(screen.width, screen.height), [screen.width, screen.height]);
  const images = useMemo(() => new Map(card ? [[WARM_CODE, card]] : []), [card]);
  if (!warming) return null;
  return <Spotlight {...common} plan={plan} progress={clock} images={images} nameOf={nameOf} sphereOf={sphereOf} k={1} />;
}
