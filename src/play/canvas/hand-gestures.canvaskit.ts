// The table's gestures on the web and the desktop (docs/design-system-table.md, Pointer and keys): the phone's (hand-gestures.native.ts), unchanged and
// returned as they are, plus a mouse's. metro.config.js serves this file in place of the phone's on the web platform only, and it imports the phone's without the
// file extension (Metro keeps one answer for a specifier a folder asks twice), so the phone's bundle never sees it. The mouse adds three things to what a press
// already does (the drag, the tap, the 350 ms hold and the 150 ms scrub stay):
//   - a pointer resting over the hand raises and spreads it as the scrub does and lifts the card under it, with no haptic (hand-hover.ts); the hand stays risen only
//     while the pointer is inside it as drawn, and after a press it does not rise again until the pointer has left the hand (its strip and its cards);
//   - the wheel over the open hand steps the lifted card (hand-hover.ts);
//   - a right click opens the preview the hold opens (a pile opens its list, as the hold does); the browser's own menu is off for it.
// They read the page's own pointer events, not a gesture: a gesture composed beside the phone's race would make its drag, scrub, hold and tap run together, and a
// hover that stayed active would cancel a drag. The table's canvas is the event's target only where nothing covers it, so the command column and a sheet shut the
// mouse out as they do a touch; the spotlight's canvas takes no pointer, so while a spotlight plays each handler checks `live` and does nothing. A press on the risen hand is a press on the card it is drawn on, not on the resting hand under it: the
// phone's gesture never sees it, a click taps that card, and a move past the slop hands the press to the phone's drag from a point on that card's resting place (a pointer press
// the gesture reads as its own), so a drag plays what a drag from the hand plays. A press outside the risen hand closes it and goes to the phone's gesture as it
// is. A touch never opens the hover. Nothing here sends an intent but the tap the press is.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";

import { GRAB_STEP, grabPoint, hoverCard, stepCard, wheelAdvance } from "./hand-hover.ts";
import { SCRUB_SLOP } from "./hand-scrub.ts";
import { useTableGestures as usePhoneGestures, type Scrub } from "./hand-gestures.native";
import { hitSlot } from "../layout/hits.ts";
import { timing } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";

export type { Scrub };

type Args = Parameters<typeof usePhoneGestures>[0];

// A press on the risen hand: the card it is on, where it started and the canvas it was on; `drag` once the phone's drag has it.
type Press = { id: string; x: number; y: number; target: HTMLCanvasElement; pointerId: number; drag: boolean };

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
  // After a press on the hand the hover waits for the pointer to leave it (a card the press picked is drawn whole above the strip, so leaving the strip is not enough);
  // it lives here, not in the page events below, because a press changes the table and the events are bound again.
  const held = useSharedValue(false);
  const pressed = useRef<Press | null>(null);
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
    // The pointer moved with no button down: open the hand on a hand card, follow the pointer while open, close it when the pointer leaves the drawn hand.
    const move = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      const press = pressed.current;
      if (press) {
        if (!press.drag && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SCRUB_SLOP) startDrag(press, event);
        return;
      }
      const at = event.pointerType === "touch" || event.buttons !== 0 || live.get() ? null : onTable(event, here);
      const next = at ? hoverCard(spread, layout.slots, at.x, at.y, open.get(), index.get()) : -1;
      if (held.get()) {
        if (next >= 0) return;
        held.set(false);
      }
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
    // The drag: the phone's gesture is handed a press on the card's resting place (`grabPoint`), a first move past the slop that is still on the card (its pan picks the card
    // up where it has gone past the slop, and counts the pointer's travel from there) and a move to where the pointer is, so the card is picked up and follows the pointer.
    // The hand goes down as a drag from it does.
    const startDrag = (press: Press, event: PointerEvent) => {
      const home = grabPoint(layout.slots, press.id);
      press.drag = true;
      close();
      if (!home) return;
      const box = press.target.getBoundingClientRect();
      const common = { pointerId: press.pointerId, pointerType: event.pointerType, button: 0, buttons: 1, bubbles: true, cancelable: true, composed: true, isPrimary: event.isPrimary };
      const at = (x: number, y: number) => ({ ...common, clientX: box.left + x, clientY: box.top + y });
      press.target.dispatchEvent(new PointerEvent("pointerdown", at(home.x, home.y)));
      press.target.dispatchEvent(new PointerEvent("pointermove", at(home.x, home.y + GRAB_STEP)));
      press.target.dispatchEvent(new PointerEvent("pointermove", { ...common, clientX: event.clientX, clientY: event.clientY }));
    };
    // A press on the risen hand is a press on the card drawn under the pointer; any other press closes the hand and goes on to the phone's gesture. A playing
    // spotlight's skip is a press too, so it is left alone.
    const down = (event: PointerEvent) => {
      if (!event.isTrusted || event.button !== 0) return;
      const place = onTable(event, here);
      // A press on the hand (its strip, its cards or the risen hand) holds the hand down until the pointer has left it (a press elsewhere leaves nothing to wait for).
      if (place && (open.get() || hoverCard(spread, layout.slots, place.x, place.y, false) >= 0)) held.set(true);
      const at = open.get() && !live.get() ? place : null;
      const card = at ? hoverCard(spread, layout.slots, at.x, at.y, true, index.get()) : -1;
      const id = spread.ids[card];
      if (id === undefined || !(event.target instanceof HTMLCanvasElement)) {
        close();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      pressed.current = { id, x: event.clientX, y: event.clientY, target: event.target, pointerId: event.pointerId, drag: false };
    };
    // Let go without a move past the slop: a click on that card.
    const up = (event: PointerEvent) => {
      const press = pressed.current;
      if (!event.isTrusted || !press) return;
      pressed.current = null;
      if (event.button !== 0) return;
      if (!press.drag) {
        close();
        onTap(press.id);
      }
    };
    const cancel = (event: PointerEvent) => {
      if (event.isTrusted) pressed.current = null;
    };
    const leave = (event: PointerEvent) => {
      if (event.relatedTarget === null && !pressed.current) close();
    };
    // The wheel steps the lifted card; one card a notch of a mouse wheel.
    const wheel = (event: WheelEvent) => {
      if (!open.get() || event.ctrlKey || !onTable(event, here)) return;
      event.preventDefault();
      const along = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const { steps, rest: kept } = wheelAdvance(rest.get(), along, event.deltaMode);
      rest.set(kept);
      const next = stepCard(index.get(), spread.ids.length, steps);
      if (steps !== 0 && next !== index.get()) lifting(next);
    };
    // A right click: the card the open hand has lifted when the pointer is on the risen hand, else what is under the pointer on the table (a face-up, held or dead
    // card the hold would open; a pile opens its list). Not while a spotlight plays, whose skip is a left press. The page's own menu is off over the table.
    const context = (event: MouseEvent) => {
      const at = onTable(event, here);
      if (!at) return;
      event.preventDefault();
      if (live.get()) return;
      const under = open.get() ? spread.ids[hoverCard(spread, layout.slots, at.x, at.y, true, index.get())] : undefined;
      if (under !== undefined) {
        onPreview(under);
        return;
      }
      close();
      const slot = layout.slots[hitSlot(layout.slots, at.x, at.y)];
      if (!slot) return;
      if (slot.kind === "pile") onTap(slot.id);
      else if (!slot.faceDown || slot.held || slot.dead || slot.opens) onPreview(slot.opens ?? slot.id);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("pointerout", leave, true);
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("contextmenu", context, true);
    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("pointerout", leave, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("contextmenu", context, true);
      close();
    };
  }, [layout, spread, canvasWidth, canvasHeight, k, live, onTap, onPreview, open, held, pressed, rest, rise, apart, index, riseTiming, apartTiming, lifting, close]);
}

export function useTableGestures(args: Args) {
  const phone = usePhoneGestures(args);
  useMouse(args, phone.scrub);
  return phone;
}
