// The web booklet reader: the web's `BookletPdf` view (pdf-module.ts), with the props of the phone's native one (`BookletPdfViewProps`). pdf.js draws
// one page at a time onto a canvas (render.ts); the wheel, the keys and the buttons turn pages, Ctrl+wheel and the buttons zoom. It reads one local
// file, reports the page like the native view and does not annotate, search or read the text; a screen reader hears the page number, not the page.
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import { View } from "react-native";

import { BodyText } from "../../kit/chrome";
import { TextButton } from "../../../ui/buttons";
import { Text } from "../../../ui/text";
import { useTableTokens } from "../../../ui/use-table-tokens";
import type { BookletPdfViewProps } from "booklet-pdf";

import { openPdf } from "./open-pdf";
import { clampPage, clampZoom, keyAction, stepWheel, wheelIdle, wheelPixels, zoomAfterWheel, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, type KeyAction, type WheelState } from "./reader-math";
import { PageRenderer, showPage, type Area } from "./render";

// Room kept round the page at zoom 1, so a page that fits never brings a scrollbar.
const MARGIN = 12;

type Loaded = { uri: string; renderer: PageRenderer } | { uri: string; message: string };

type Anchor = { fx: number; fy: number; px: number; py: number };

// Where the viewport's point (px, py) sits on the page, as fractions of the scrolled content, so a zoom keeps it under the pointer.
function anchorOf(scroller: HTMLElement, px: number, py: number): Anchor {
  return { fx: (scroller.scrollLeft + px) / Math.max(1, scroller.scrollWidth), fy: (scroller.scrollTop + py) / Math.max(1, scroller.scrollHeight), px, py };
}

function applyAnchor(scroller: HTMLElement, anchor: Anchor): void {
  scroller.scrollLeft = anchor.fx * scroller.scrollWidth - anchor.px;
  scroller.scrollTop = anchor.fy * scroller.scrollHeight - anchor.py;
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The page could not be drawn.";
}

export function WebBookletPdf({ uri, page: startPage, onPageChange, style, testID }: BookletPdfViewProps) {
  const t = useTableTokens();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [page, setPage] = useState(startPage);
  const [seenStart, setSeenStart] = useState(startPage);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [area, setArea] = useState<Area | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wheel = useRef<WheelState>(wheelIdle);
  const anchor = useRef<Anchor | null>(null);
  const drawnPage = useRef(0);

  // The page the screen asks for follows its prop, as the native view's does.
  if (startPage !== seenStart) {
    setSeenStart(startPage);
    setPage(startPage);
  }

  const current = loaded && loaded.uri === uri ? loaded : null;
  const renderer = current && "renderer" in current ? current.renderer : null;
  const failure = current && "message" in current ? current.message : null;
  const pageCount = renderer?.pageCount ?? 0;
  const shown = renderer ? clampPage(page, pageCount) : page;

  const report = useEffectEvent((reported: number, count: number) => {
    onPageChange?.({ nativeEvent: { page: reported, pageCount: count } });
  });

  // One open document for as long as the book is shown; it is released with the view, or when the book changes.
  useEffect(() => {
    let live = true;
    let opened: PageRenderer | null = null;
    void openPdf(uri).then((result) => {
      if (!live) {
        if (result.ok) void result.doc.loadingTask.destroy();
        return;
      }
      if (!result.ok) {
        setLoaded({ uri, message: result.message });
        return;
      }
      opened = new PageRenderer(result.doc);
      setLoaded({ uri, renderer: opened });
    });
    return () => {
      live = false;
      opened?.dispose();
    };
  }, [uri]);

  // The window the page has to fit: measured on a frame the page's own size never changes, so a scrollbar cannot move the fit.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => setArea({ width: Math.max(1, element.clientWidth - 2 * MARGIN), height: Math.max(1, element.clientHeight - 2 * MARGIN) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (renderer) report(shown, pageCount);
  }, [renderer, shown, pageCount]);

  useEffect(() => {
    const target = canvas.current;
    if (!renderer || !area || !target) return;
    return showPage(
      renderer,
      shown,
      area,
      zoom,
      target,
      () => {
        setDrawError(null);
        const box = scroller.current;
        if (!box) return;
        if (drawnPage.current !== shown) {
          drawnPage.current = shown;
          box.scrollTo(0, 0);
        } else if (anchor.current) {
          applyAnchor(box, anchor.current);
        }
        anchor.current = null;
      },
      (error) => setDrawError(describe(error)),
    );
  }, [renderer, shown, zoom, area]);

  function turn(to: number): void {
    setPage(clampPage(to, pageCount));
  }

  function zoomTo(next: number, px: number | null, py: number | null): void {
    const box = scroller.current;
    if (box) anchor.current = anchorOf(box, px ?? box.clientWidth / 2, py ?? box.clientHeight / 2);
    setZoom(clampZoom(next));
  }

  const onWheel = useEffectEvent((event: WheelEvent) => {
    const box = scroller.current;
    if (!box || !renderer) return;
    const pixels = wheelPixels(event.deltaY, event.deltaMode);
    if (event.ctrlKey) {
      event.preventDefault();
      const bounds = box.getBoundingClientRect();
      zoomTo(zoomAfterWheel(zoom, pixels), event.clientX - bounds.left, event.clientY - bounds.top);
      return;
    }
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    // A zoomed page scrolls first; the wheel turns the page only from its edge.
    const atEdge = pixels > 0 ? box.scrollTop + box.clientHeight >= box.scrollHeight - 1 : box.scrollTop <= 0;
    if (!atEdge) {
      wheel.current = wheelIdle;
      return;
    }
    event.preventDefault();
    const step = stepWheel(wheel.current, pixels, performance.now());
    wheel.current = step.state;
    if (step.turn !== 0) turn(shown + step.turn);
  });

  // React attaches wheel listeners as passive, which cannot cancel the browser's own Ctrl+wheel zoom or scroll: this one is added by hand.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const listener = (event: WheelEvent) => onWheel(event);
    box.addEventListener("wheel", listener, { passive: false });
    return () => {
      box.removeEventListener("wheel", listener);
    };
  }, []);

  function act(action: KeyAction): void {
    if (action === "next") turn(shown + 1);
    else if (action === "previous") turn(shown - 1);
    else if (action === "first") turn(1);
    else if (action === "last") turn(pageCount);
    else if (action === "zoomIn") zoomTo(zoom * ZOOM_STEP, null, null);
    else if (action === "zoomOut") zoomTo(zoom / ZOOM_STEP, null, null);
    else zoomTo(ZOOM_MIN, null, null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!renderer) return;
    const action = keyAction(event.key, { ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey, shift: event.shiftKey });
    if (!action) return;
    event.preventDefault();
    act(action);
  }

  const label = renderer ? `Page ${shown} of ${pageCount}` : "Opening the booklet";
  const problem = failure ?? drawError;

  return (
    <View style={style} testID={testID}>
      <View className="flex-row items-center justify-between px-2" style={{ backgroundColor: t.dusk }}>
        <View className="flex-row items-center">
          <TextButton label="Previous" accessibilityLabel="Previous page" testID="booklet-prev" tone="accent" disabled={!renderer || shown <= 1} onPress={() => act("previous")} />
          <TextButton label="Next" accessibilityLabel="Next page" testID="booklet-next" tone="accent" disabled={!renderer || shown >= pageCount} onPress={() => act("next")} />
        </View>
        <Text testID="booklet-page-label" aria-live="polite" className="text-label text-muted">
          {label}
        </Text>
        <View className="flex-row items-center">
          <TextButton label="Zoom out" accessibilityLabel="Zoom out" testID="booklet-zoom-out" tone="accent" disabled={!renderer || zoom <= ZOOM_MIN} onPress={() => act("zoomOut")} />
          <TextButton label="Zoom in" accessibilityLabel="Zoom in" testID="booklet-zoom-in" tone="accent" disabled={!renderer || zoom >= ZOOM_MAX} onPress={() => act("zoomIn")} />
        </View>
      </View>
      <div ref={frame} style={{ position: "relative", flex: 1, minHeight: 0, backgroundColor: t.night }}>
        <div
          ref={scroller}
          role="region"
          aria-label={label}
          aria-busy={renderer ? undefined : true}
          tabIndex={0}
          onKeyDown={onKeyDown}
          style={{ position: "absolute", inset: 0, overflow: "auto", display: "flex", padding: MARGIN, boxSizing: "border-box" }}
        >
          <canvas ref={canvas} role="img" aria-label={label} data-testid="booklet-page" style={{ display: renderer ? "block" : "none", margin: "auto", flex: "none" }} />
          {renderer ? null : (
            <div style={{ margin: "auto", textAlign: "center" }}>
              {problem ? <BodyText tone="danger">{`This booklet could not be opened. ${problem}`}</BodyText> : <BodyText tone="muted">Opening the booklet</BodyText>}
            </div>
          )}
        </div>
      </div>
      {renderer && problem ? <BodyText tone="danger">{problem}</BodyText> : null}
    </View>
  );
}
