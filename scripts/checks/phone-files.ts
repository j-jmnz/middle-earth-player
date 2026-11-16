// The phone-only files and the rule that a desktop change leaves them as they were (docs/plans/desktop.md, What does not move).

/** A file only the phone bundle holds: a platform-suffixed file, the native modules and the native app config. */
export function isPhoneOnly(file: string): boolean {
  if (/\.(native|ios|android)\.[^/]+$/.test(file)) return true;
  if (file.startsWith("modules/") || file.startsWith("plugins/")) return true;
  return ["app.json", "app.config.js", "eas.json"].includes(file);
}

/** A file that only the desktop and web build holds, or the plan for it: a change touching one is desktop work. */
export function isDesktopWork(file: string): boolean {
  return file.startsWith("desktop/") || file.startsWith("src/ui/skia/") || /\.canvaskit\.[^/]+$/.test(file) || file === "docs/plans/desktop.md";
}

/** The phone-only files among `changed`, when `changed` holds desktop work; none otherwise. */
export function phoneFilesTouchedByDesktop(changed: readonly string[]): string[] {
  if (!changed.some(isDesktopWork)) return [];
  return changed.filter(isPhoneOnly);
}
