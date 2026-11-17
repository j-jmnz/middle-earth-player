// The phone-only files and the rule that a desktop change leaves them as they were (docs/architecture.md, Screens).

/** A file only the phone bundle holds: a platform-suffixed file, the native modules and the native app config. */
export function isPhoneOnly(file: string): boolean {
  if (/\.(native|ios|android)\.[^/]+$/.test(file)) return true;
  if (file.startsWith("modules/") || file.startsWith("plugins/")) return true;
  return ["app.json", "app.config.js", "eas.json"].includes(file);
}

/** A file that only the desktop and web build holds, or the Metro config that decides what each bundle holds: a change touching one is desktop work. */
export function isDesktopWork(file: string): boolean {
  if (file === "metro.config.js" || file.startsWith("desktop/") || file.startsWith("src/ui/skia/")) return true;
  return /\.canvaskit\.[^/]+$/.test(file) || /^src\/(.+\/)?web\//.test(file);
}

/** The phone-only files among `changed`, when `changed` holds desktop work; none otherwise. */
export function phoneFilesTouchedByDesktop(changed: readonly string[]): string[] {
  if (!changed.some(isDesktopWork)) return [];
  return changed.filter(isPhoneOnly);
}
