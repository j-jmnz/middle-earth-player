// Which page of the static export a path with a parameter names. The export has one HTML file for each route, and a dynamic route's file keeps its brackets
// (`table/[saveId].html`), so `/table/abc` is no file: the Worker answers it with that page, as `resolveFile` does for the desktop (desktop/serve.ts).

/** Where `pnpm webapp build` lists the export's dynamic pages (scripts/webapp/build.ts). */
export const ROUTES_PATH = "/_expo/dynamic-routes.json";

/** The path's segments, decoded; null when one cannot be decoded. */
function segmentsOf(pathname: string): string[] | null {
  const out: string[] = [];
  for (const part of pathname.split("/")) {
    if (part === "") continue;
    try {
      out.push(decodeURIComponent(part));
    } catch {
      return null;
    }
  }
  return out;
}

const isParam = (segment: string) => /^\[[^\]]+\]$/.test(segment);

/**
 * The dynamic page (`table/[saveId].html`, as the list names it) that answers `pathname`, or null when none does. A segment of a page matches itself, or anything when it
 * is a `[param]`; the page with the most literal segments wins, so `settings/index.html` (a file, never asked here) is not shadowed by `settings/[category].html`.
 */
export function matchRoute(pathname: string, pages: readonly string[]): string | null {
  const asked = segmentsOf(pathname);
  if (!asked || asked.length === 0) return null;
  let best: { page: string; literals: number } | null = null;
  for (const page of pages) {
    const parts = page.replace(/\.html$/, "").split("/");
    if (parts.length !== asked.length) continue;
    if (!parts.every((part, index) => isParam(part) || part === asked[index])) continue;
    const literals = parts.filter((part) => !isParam(part)).length;
    if (!best || literals > best.literals) best = { page, literals };
  }
  return best ? best.page : null;
}

/** The URL path the asset server answers a page at: no `.html` (it redirects one), each segment encoded so the brackets survive. */
export function assetPath(page: string): string {
  return `/${page.replace(/\.html$/, "").split("/").map(encodeURIComponent).join("/")}`;
}
