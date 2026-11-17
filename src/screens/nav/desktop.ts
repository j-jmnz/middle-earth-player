// The desktop build (docs/architecture.md, Desktop) sets EXPO_PUBLIC_DESKTOP=1; Expo inlines EXPO_PUBLIC_ variables at build time. It bundles every card picture and
// every booklet, so it fetches no picture (images/remote.ts), unlike the browser dev build, which shows remote pictures.
/** True in the desktop build only. */
export function desktopBuild(): boolean {
  return process.env.EXPO_PUBLIC_DESKTOP === "1";
}
