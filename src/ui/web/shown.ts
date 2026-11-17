// Whether an element is on screen on the web. The web stack keeps a route under a pushed one mounted with `display: none`, so a query by testID still finds the
// table and its layers behind Settings, Rules or a card's details; a caller that acts on what it found checks this first. A browser without `checkVisibility`
// (none the desktop app ships) counts every element as shown.
export function shown(element: { checkVisibility?: () => boolean }): boolean {
  return typeof element.checkVisibility !== "function" || element.checkVisibility();
}
