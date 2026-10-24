import type { Href } from "expo-router";

type BackRouter = { canGoBack(): boolean; back(): void; replace(href: Href): void };

// Back goes to the screen below when there is one. A screen opened with nothing under it (a cold start on a deep link, a
// replaced stack) goes to the screen it belongs to instead of doing nothing.
export function goBack(router: BackRouter, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
