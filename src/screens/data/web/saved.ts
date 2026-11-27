// The one question a page asks before it reloads (a restore, src/screens/settings/web/backup-group.tsx): is what the database holds in storage yet? The desktop and the
// browser dev build write through to storage on every call, so there is nothing to wait for; the web app registers its copy here (memory-databases.ts).
let flush: (() => Promise<void>) | null = null;

/** The web app's copy to storage, registered once when its databases open. */
export function registerFlush(run: () => Promise<void>): void {
  flush = run;
}

/** Resolves once everything written so far is in storage. */
export async function savedToStorage(): Promise<void> {
  await flush?.();
}
