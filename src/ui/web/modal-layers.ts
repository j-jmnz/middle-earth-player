// A modal layer on the web and the desktop (web build only, started by splash-glow.canvaskit.tsx). The table's full-screen layers (the card preview, the quest-advance
// screen, the phase list) mark themselves `accessibilityViewIsModal`, which the phone's screen readers honour and react-native-web drops, so a keyboard could tab through
// the table's controls behind the scrim and press Pass unseen. While one is open this makes everything outside it `inert` (no focus, no click, no tab stop; the table's own
// root stays reachable by the key relay, which dispatches events rather than focusing), moves focus to the layer's title or first control, and gives focus back to what
// had it when the layer closes. A layer's own scrim, drawn beside it (the phase list's), stays live so a click on it still closes the layer. A layer hidden under a
// pushed screen (the preview left open under a card's details) is not on top: the web stack keeps it mounted with `display: none`, and the pushed screen must take
// clicks. Nothing of this reaches the phone: it only looks for the testIDs react-native-web renders as `data-testid`.
import { shown } from "./shown.ts";

const LAYERS = ['[data-testid="card-preview"]', '[data-testid="quest-advance"]', '[data-testid="phase-carousel"]'].join(", ");
const SKIPPED = new Set(["SCRIPT", "STYLE", "LINK"]);
const SCRIM = /-scrim$/;

/** Whether `node` is the layer's own scrim: a sibling of the layer whose testID ends in `-scrim`, which closes the layer when clicked. */
export function ownScrim(node: { parentElement: unknown; getAttribute: (name: string) => string | null }, modal: { parentElement: unknown }): boolean {
  return node.parentElement === modal.parentElement && SCRIM.test(node.getAttribute("data-testid") ?? "");
}

/** The nodes that must be inert while `modal` is open: every sibling of the modal and of each ancestor of it, up to (not including) `stop`. Pure over the tree's shape. */
export function outsideOf<T extends object>(modal: T, parentOf: (node: T) => T | null, childrenOf: (node: T) => readonly T[], stop: T): T[] {
  const outside: T[] = [];
  let node = modal;
  while (node !== stop) {
    const parent = parentOf(node);
    if (!parent) break;
    for (const child of childrenOf(parent)) if (child !== node) outside.push(child);
    node = parent;
  }
  return outside;
}

type Layer = { modal: Element; inerted: Set<Element>; returnTo: HTMLElement | null };

let layer: Layer | null = null;
let started = false;

// What this layer makes inert: not a script or a style, not the layer's own scrim, and not something that was inert before it (the page's own, which must stay as it was when the layer closes).
function outside(modal: Element, ours: ReadonlySet<Element>): Element[] {
  return outsideOf<Element>(modal, (node) => node.parentElement, (node) => [...node.children], document.body).filter((node) => !SKIPPED.has(node.tagName) && !ownScrim(node, modal) && (ours.has(node) || !node.hasAttribute("inert")));
}

// The layer's title if it has one, else its first control, else the layer itself: where a keyboard (and a screen reader) starts in it.
function focusTarget(modal: HTMLElement): HTMLElement {
  const heading = modal.querySelector<HTMLElement>('[role="heading"], h1, h2, h3');
  if (heading) return heading;
  return modal.querySelector<HTMLElement>('button, [role="button"], a[href], [tabindex]:not([tabindex="-1"])') ?? modal;
}

function focusInto(modal: HTMLElement): void {
  const target = focusTarget(modal);
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

function open(modal: HTMLElement): void {
  const active = document.activeElement;
  layer = { modal, inerted: new Set(), returnTo: active instanceof HTMLElement && active !== document.body ? active : null };
  focusInto(modal);
}

function close(): void {
  if (!layer) return;
  for (const node of layer.inerted) node.removeAttribute("inert");
  const back = layer.returnTo;
  layer = null;
  if (back?.isConnected && !back.closest("[inert]")) back.focus({ preventScroll: true });
}

/** Brings the document in line with the layers on screen: the last shown one in the document is the one on top. */
export function syncModalLayers(): void {
  const found = [...document.querySelectorAll<HTMLElement>(LAYERS)].filter(shown).at(-1) ?? null;
  if (layer && layer.modal !== found) close();
  if (!found) return;
  // Opening remembers the focused control and moves focus first, before the inert attribute can blur it unseen.
  if (!layer) open(found);
  const current = layer;
  if (!current) return;
  const wanted = new Set(outside(found, current.inerted));
  for (const node of wanted) {
    node.setAttribute("inert", "");
    current.inerted.add(node);
  }
  for (const node of [...current.inerted]) {
    if (wanted.has(node)) continue;
    node.removeAttribute("inert");
    current.inerted.delete(node);
  }
}

/** Starts watching: once for the life of the page, like the page stylesheet. */
export function startModalLayers(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncModalLayers();
    });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
