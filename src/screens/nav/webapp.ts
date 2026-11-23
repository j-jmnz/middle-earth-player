// The web app's build (docs/plans/pwa-iphone-ipad.md) sets EXPO_PUBLIC_WEBAPP=1 (`pnpm webapp build`); Expo inlines EXPO_PUBLIC_ variables at build time. It is the
// export a browser opens from a site, on Safari's engine too, so it keeps its saves as memory-databases.ts says; the desktop's export and the browser dev build leave it unset.
/** True in the web app's build only. */
export function webAppBuild(): boolean {
  return process.env.EXPO_PUBLIC_WEBAPP === "1";
}
