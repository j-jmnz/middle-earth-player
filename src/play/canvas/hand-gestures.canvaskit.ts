// The table's gestures on the web and the desktop (docs/design-system-table.md, Pointer and keys): the phone's (hand-gestures.native.ts), unchanged and
// returned as they are, plus a mouse's. metro.config.js serves this file in place of the phone's on the web platform only, and it imports the phone's without the
// file extension (Metro keeps one answer for a specifier a folder asks twice), so the phone's bundle never sees it. The mouse adds three things to what a press
// already does (the drag, the tap, the 350 ms hold and the 150 ms scrub stay):
//   - a pointer resting over the hand raises and spreads it as the scrub does and lifts the card under it, with no haptic (hand-hover.ts);
//   - the wheel over the open hand steps the lifted card (hand-hover.ts);
//   - a right click opens the preview the hold opens (a pile opens its list, as the hold does); the browser's own menu is off for it.
// They read the page's own pointer events, not a gesture: a gesture composed beside the phone's race would make its drag, scrub, hold and tap run together, and a
// hover that stayed active would cancel a drag. The table's canvas is the event's target only where nothing covers it, so the command column, a sheet and the
// spotlight's layer shut the mouse out as they do a touch. A press closes the hover at once, so a click and a drag are what they are without it; a touch never opens
// it. Nothing here sends an intent.
import { useCallback, useEffect, useMemo } from "react";
import { cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";

import { hoverCard, stepCard, wheelPixels, wheelSteps } from "./hand-hover.ts";
import { useTableGestures as usePhoneGestures, type Scrub } from "./hand-gestures.native";
import { hitSlot } from "../layout/hits.ts";
import { timing } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";

export type { Scrub };

type Args = Parameters<typeof usePhoneGestures>[0];

// Where a pointer event is on the table's canvas, or null when the table's canvas is not what it is over (the canvas is the one as tall as the table's, and as wide
// or wider: it draws under the command column too).
function onTable(event: MouseEvent, canvas: { width: number; height: number }): { x: number; y: number } | null {
  const target = event.target;
  if (!(target instanceof HTMLCanvasElement)) return null;
  const box = target.getBoundingClientRect();
  if (Math.abs(box.height - canvas.height) > 1 || box.width < canvas.width - 1) return null;
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

// The hover's state and its page events, driving the phone's scrub values (the canvas draws the pose from them).
function useMouse({ layout, canvas, k, live, onTap, onPreview }: Args, scrub: Scrub) {
  const { rise, apart, lift: lifted, index, left, drop, spread } = scrub;
  const riseTiming = useMemo(() => timing(MOTION.scrubRise, k), [k]);
  const apartTiming = useMemo(() => timing(MOTION.scrubSpread, k), [k]);
  const liftTiming = useMemo(() => timing(MOTION.scrubLift, k), [k]);
  const fallTiming = useMemo(() => timing(MOTION.scrubFall, k), [k]);
  // The hand is open because of the pointer; the wheel's unspent distance.
  const open = useSharedValue(false);
  const rest = useSharedValue(0);
  const { width: canvasWidth, height: canvasHeight } = canvas;

  // The card under the pointer lifts over the lift token (at once under reduced motion); the one it left settles back over the same.
  const lifting = useCallback(
    (next: number) => {
      const before = index.get();
      index.set(next);
      cancelAnimation(drop);
      left.set(before);
      drop.set(before >= 0 && k !== 0 ? lifted.get() : 0);
      if (before >= 0 && k !== 0) drop.set(withTiming(0, liftTiming));
      cancelAnimation(lifted);
      lifted.set(0);
      if (next >= 0) lifted.set(k === 0 ? 1 : withTiming(1, liftTiming));
    },
    [index, left, drop, lifted, k, liftTiming],
  );

  // The hand goes back down, at once under reduced motion.
  const close = useCallback(() => {
    if (!open.get()) return;
    open.set(false);
    rest.set(0);
    index.set(-1);
    cancelAnimation(lifted);
    lifted.set(0);
    cancelAnimation(drop);
    drop.set(0);
    left.set(-1);
    rise.set(k === 0 ? 0 : withTiming(0, fallTiming));
    apart.set(k === 0 ? 0 : withTiming(0, fallTiming));
  }, [open, rest, index, lifted, drop, left, rise, apart, k, fallTiming]);

  // The page's own events. Removed when the table goes, and bound again when it shows (an Activity).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const here = { width: canvasWidth, height: canvasHeight };
    // The pointer moved with no button down: open the hand on a hand card, follow the pointer while open, close it when the pointer leaves.
    const move = (event: PointerEvent) => {
      const at = event.pointerType === "touch" || event.buttons !== 0 || live.get() ? null : onTable(event, here);
      const next = at ? hoverCard(spread, layout.slots, at.x, at.y, open.get()) : -1;
      if (next < 0) {
        close();
        return;
      }
      if (!open.get()) {
        open.set(true);
        cancelAnimation(rise);
        cancelAnimation(apart);
        rise.set(k === 0 ? 1 : withTiming(1, riseTiming));
        apart.set(k === 0 ? 1 : withTiming(1, apartTiming));
      }
      if (next !== index.get()) lifting(next);
    };
    // A press, and the pointer leaving the page, close it.
    const down = (event: PointerEvent) => {
      if (event.button === 0) close();
    };
    const leave = (event: PointerEvent) => {
      if (event.relatedTarget === null) close();
    };
    // The wheel steps the lifted card; one card a notch of a mouse wheel.
    const wheel = (event: WheelEvent) => {
      if (!open.get() || event.ctrlKey || !onTable(event, here)) return;
      event.preventDefault();
      const along = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const { steps, rest: kept } = wheelSteps(rest.get() + wheelPixels(along, event.deltaMode));
      rest.set(kept);
      const next = stepCard(index.get(), spread.ids.length, steps);
      if (steps !== 0 && next !== index.get()) lifting(next);
    };
    // A right click: the card the open hand has lifted, else the one the hold would open (a face-up, held or dead card; a pile opens its list). Not while a spotlight
    // plays, whose skip is a left press. The page's own menu is off over the table.
    const context = (event: MouseEvent) => {
      const at = onTable(event, here);
      if (!at) return;
      event.preventDefault();
      if (live.get()) return;
      const under = open.get() ? spread.ids[index.get()] : undefined;
      if (under !== undefined) {
        onPreview(under);
        return;
      }
      const slot = layout.slots[hitSlot(layout.slots, at.x, at.y)];
      if (!slot) return;
      if (slot.kind === "pile") onTap(slot.id);
      else if (!slot.faceDown || slot.held || slot.dead) onPreview(slot.id);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerout", leave, true);
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("contextmenu", context, true);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerout", leave, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("contextmenu", context, true);
      close();
    };
  }, [layout, spread, canvasWidth, canvasHeight, k, live, onTap, onPreview, open, rest, rise, apart, index, riseTiming, apartTiming, lifting, close]);
}

export function useTableGestures(args: Args) {
  const phone = usePhoneGestures(args);
  useMouse(args, phone.scrub);
  return phone;
}
