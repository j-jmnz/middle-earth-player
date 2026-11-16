# Plan: Desktop app (Electron) for Windows, macOS and Linux

## Context

The app ships as an Android APK and an iOS IPA. The goal is a standalone desktop app on Windows, macOS and Linux, attached to the same GitHub release, playing fully offline with the same saves-on-device rules.

The route is Electron around the Expo web export (`expo export -p web`), which already builds and is audited in CI (`scripts/checks/a11y-web.ts`). The web build is a development aid today, so most of the work is making it complete:

- No drawn table: `src/play/canvas/table-canvas.tsx` is a list of names; the spotlight (`src/play/spotlight/layer.tsx`) returns null; `use-spotlight.ts` sets `CANVAS = Platform.OS !== "web"`.
- No offline pictures: `src/screens/images/remote.ts` returns remote URLs, and web builds run only `pnpm assets catalog`, so `scan-map.ts` is empty.
- No booklets: `src/screens/booklets/store.ts` returns "unavailable"; `modules/booklet-pdf` is Apple and Android only.
- Touch-only input: no hover, right-click, wheel or window-level keys anywhere in `src`.
- No backup: a phone relies on iCloud or Google backup; a desktop has neither, and there is no save export.

What already works on web and is reused as is: both SQLite databases (`src/screens/data/open-databases.ts`, expo-sqlite's wa-sqlite worker on OPFS, sync calls through `SharedArrayBuffer`, which is why COOP and COEP are set), every chrome screen, the size classes with the left rail (`src/ui/size-class.ts`), the CSS backdrop and scene art, the e2e seed route.

## Decisions taken

1. **Unsigned to start**, like the IPA: Windows shows SmartScreen, macOS needs right-click → Open (the build is ad-hoc signed so Apple Silicon runs it). Authenticode and Apple notarization are optional later, wired like TestFlight.
2. **Formats**: Windows NSIS installer and a portable zip (x64); macOS universal `.dmg`; Linux AppImage and `.deb` (x64).
3. **Everything ships inside the app, fully offline**: `catalog.db`, every card picture and scene (`assets/scans`, about 1 GB), the booklet PDFs (`assets/booklets`, about 113 MB), the fonts, the icons, CanvasKit's `.wasm` and the pdf.js worker are all in the web export, which the installer carries as `extraResources` and the shell serves from disk over `app://`. A picture missing from the bundle is drawn as its text, never fetched. Saves (`user.db`) and booklets the player adds live in the app's profile folder. The smoke test (F.2) fails on any request that leaves `app://` other than the deck import.
4. **No auto-update, no telemetry.** The only network request stays the RingsDB deck import, and the shell enforces it.
5. **The browser dev build gets the drawn table too**, since it is the same code. It keeps remote pictures; only the desktop build bundles them.
6. **Release pipeline**: built on the shape of `claude/release-workflow-performance-mz4n7m` (builds start beside `assets` and wait with `.github/scripts/wait-for-assets.sh`; `publish` needs `assets`). Section G starts after that branch is on `main`.
7. **Scope change**: `docs/brief.md` (Product, Stack, Persistence and shipping) and `.claude/rules/release-standards.md` ("ships on both platforms") are rewritten for three desktop targets, stamped "(user decision, 2026-11-16)".

## What does not move

A task that cannot keep one of these stops and reports.

- The phone app: every `.native` file's behaviour, the spotlight gate, skip, Back, haptics, the banner wait, Undo, relaunch replay.
- **Phone-only files stay byte for byte as they are (user instruction, 2026-11-16).** Every `*.native.*`, `*.ios.*` and `*.android.*` file (a new one too: it lands in the phone bundle), `modules/**`, `plugins/**`, `app.json`, `app.config.js` and `eas.json` have no diff from `main` on a branch with desktop work; `scripts/checks/phone-files.test.ts` fails and names the file otherwise. The web gets its own code instead, in this order: a web-only sibling with no platform suffix (`table-canvas.tsx`, `layer.tsx`, and files only they import); a shim installed once CanvasKit has loaded (`src/ui/skia/web-shims.ts`), for what CanvasKit or react-native-web lacks, so the unchanged `.native` file runs; and, as a last resort, a `metro.config.js` `resolveRequest` for the web platform that serves `X.canvaskit.ts(x)` in place of `X.native.ts(x)` (never `.web`, which would take the imports of a pure `.ts` of the same stem). A shared file (no platform suffix) gains only a branch a phone cannot run (`Platform.OS === "web"`, a web-only file, a web-only lazy import) or a change that is the same on the phone.
- The engine: every golden, step log and `data/` file; `ENGINE_VERSION`.
- `src/play/compiler.test.ts` at zero bailouts; `src/screens` imports nothing from `src/rules`.
- The save is written synchronously on every accepted intent, on desktop too.
- The desktop origin (`app://middle-earth-player`) and Electron `userData` name never change after the first release: OPFS is per origin, so a change loses every save.
- Only `release.yml` tags or publishes (`scripts/checks/release-trigger.test.ts`).
- No scan, PDF, `catalog.db`, CanvasKit `.wasm` or installer is committed.

## A. The drawn table on web (go/no-go gate)

1. **Load CanvasKit locally.** New `assets` step copies `node_modules/canvaskit-wasm/bin/full/canvaskit.wasm` to `public/canvaskit.wasm` (gitignored). New `src/ui/skia/skia-web.ts`: one module store (`useSyncExternalStore`) around `LoadSkiaWeb({ locateFile: () => "/canvaskit.wasm" })`, started after first paint from `src/screens/routes/_layout.tsx`, web only.
2. **Web entry points become gates.** The Skia files keep their `.native.tsx` names and are not edited. Each web-only sibling waits for the store, then lazy-imports what it draws by explicit path, so no Skia module is evaluated before CanvasKit or during the static render:
   - `src/play/canvas/table-canvas.tsx` → `table-canvas.native.tsx` (while CanvasKit loads it shows the reader table, step 5, with its own copy of the rows' feet probe in `row-feet-probe.tsx`).
   - `src/play/spotlight/layer.tsx` → `held-layer.tsx`, the web's copy of `layer.native.tsx` whose canvas stays mounted and warmed between spotlights; `use-spotlight.ts` `CANVAS` is true everywhere (it already was on the phone).
   - `src/ui/arc-ring.tsx`, `src/screens/art/backdrop.tsx` and `scene-canvas.tsx` keep their CSS ports.
3. **What Skia on web lacks, as shims** (`src/ui/skia/web-shims.ts`, installed by `skia-web-load.ts` once CanvasKit has loaded, never on the phone):
   - `Image.resolveAssetSource` (react-native-web has none; the bundler's `require` of a picture is a number expo-asset resolves). `ScanAsset.moduleId` (`src/screens/images/scan-map.ts`, written by `scripts/build/pack-scans.ts` `writeScanMap`) is `number | { uri: string }`.
   - The system font manager, which CanvasKit does not implement: no face, so no text until the bundled typefaces load.
   - The burn's runtime shader: no effect compiles, so `burn.native.tsx` takes its fade, drop and darken fallback.
   - Freeing an image: CanvasKit frees at once and the scene that drew it is replaced a few tasks later, so a disposed image is freed after 500 ms.
   - `table-assets.native.ts`: confirm `MakeImageFromEncoded` on the `.svg` icons; rasterize them in `scripts/` if CanvasKit refuses.
   - Verify on CanvasKit: `Skia.Surface.Make` + `makeImageSnapshot` + `dispose` (`table-images`), `MakeOffscreen` (`src/ui/fog/fog.native.tsx`), `Atlas` / `useRSXformBuffer` / `useTexture` (`particles.native.tsx`).
4. **Measure.** A scratch Playwright script (not committed) opens `/e2e/duo` → `/table/save-e2e-duo` in Chromium and records frame times idle, during a card motion and during a spotlight. **Gate: within the 6 ms a frame budget of `.claude/rules/code-standards.md` on a mid laptop profile (4× CPU throttle reported beside the unthrottled number). If not, stop and report with the numbers before any later section.**
5. **Reader table on web.** `src/ui/screen-reader.ts` `useReaderMode` honours "Table as a list" on web; `src/play/chrome/setting-rows.tsx` shows the row; `reader-table.tsx` replaces the deleted list. On desktop, "Follow screen reader" reads Electron's `accessibilitySupportEnabled` through the preload (section E).
6. **Checks that key on paths**: `scripts/checks/a11y.test.ts` exceptions for `table-canvas.tsx`; `scripts/checks/a11y-web.ts` `OPEN` counts for the Table screen; `ACCESSIBILITY.md` Known gaps.

## B. Offline pictures and booklets on web

1. **Pictures.** A desktop export sets `EXPO_PUBLIC_DESKTOP=1` (`src/screens/nav/desktop.ts`, modelled on `src/screens/nav/e2e.ts`). With it, `src/screens/images/remote.ts` (the web-only sibling of `remote.native.ts`) returns `null` like the phone's release build, so `resolveCardImage` (`policy.ts`) uses the bundle and falls back to text, and every other reader of `remotePictureUrl` gets no URL. The export runs `pnpm assets` (catalog, canvaskit, pdfjs, booklets, scans) first. A shell that serves the export (E) must map `.mjs` to `text/javascript` and `.pdf` to `application/pdf`: the pdf.js worker is a module worker.
2. **Booklet store**, in `src/screens/booklets/store.ts` (the web-only sibling of `store.native.ts`, with its interface): a bundled book is its asset URL, and its row (`path` `bundled:<id>`) records that the player has it, with no copy; "Add booklet" takes a file from an `<input type="file">`, checks the PDF header and pdf.js's page count, stores it in OPFS under `booklets/` (`web/opfs.ts`) and writes the row with `writeBooklet`. A stored book is read by its `opfs:` path, so no object URL exists to leak.
3. **Booklet reader**, `src/screens/booklets/web/`: `pdfjs-dist` (pinned; its worker and data copied to `public/pdfjs` by `pnpm assets pdfjs`) drawing one page at a time to a canvas, with the next and previous page warmed; wheel, keyboard, button paging and Ctrl+wheel, key and button zoom. `metro.config.js` serves `web/pdf-module.ts` for `booklet-pdf` on the web platform, so `reader-view.ts`, the route and the store read it with no web branch of their own and the phone's bundle never reaches it; the module has the exports of `modules/booklet-pdf/index.ts` (`pdfPageCount` comes from the same library), and pdf.js loads on the first book opened.
4. The browser dev build without `EXPO_PUBLIC_DESKTOP` keeps remote pictures and gets the reader, bundled books when `pnpm assets booklets` has run and the picker for the rest.

## C. Mouse, keyboard and window

Web only; no shared file's phone path changes (the Android bundle stays byte for byte):

1. **Table pointer input** is `src/play/canvas/hand-gestures.canvaskit.ts`, which `metro.config.js` serves in place of `hand-gestures.native.ts` on the web (generalised to any `X.canvaskit.ts(x)` beside, or in a `web` folder beside, `X.native.ts(x)` or `X.ts(x)`). It returns the phone's gestures as they are and adds right click, hover and wheel from the page's own pointer events, driving the phone hook's scrub values (a gesture composed beside the phone's race would make its drag, scrub, hold and tap run together, and a hover that stayed active would cancel a drag), so the phone file is unchanged. The web's spotlight canvas ignores pointers by style (`held-layer.tsx`), or it would take every click meant for the table.
2. **Keys**: `play/canvas/table-keys.ts`, mounted by the web gate, sends Escape and Z pressed outside the table's root to the root, where the unchanged `use-table-back.ts` handles them. No Space, Enter or arrow rows: Enter and Space press the focused control, and the canvas takes no keyboard focus.
3. **Chrome**: react-native-web's `Pressable` already has `cursor: pointer`; the focus ring is `src/ui/web/focus-ring.canvaskit.ts`.
4. **Leaving**: `src/screens/session/flush-runs-on-leave.ts` flushes on `visibilitychange` and `pagehide`.
5. **Sizes**: the table is landscape-only and the window minimum (section E) is 844 x 390, the smallest landscape size the phone's compact class gives the table; `/ux` reviews 1280 x 720 and 1920 x 1080.

## D. Save backup file

1. Settings gains "Back up saves" and "Restore from a backup", desktop and web only (phones keep the system backup): export serializes `user.db` (`serializeAsync`) to a downloaded `middle-earth-player-<date>.backup`; restore validates the file through the existing migration and `readSaveChecked` path (`src/screens/data/campaign-store.ts`) before replacing, and refuses a file from a newer schema.
2. `PRIVACY.md` (Data on your device) says where desktop saves live and that the backup file is made only when asked.

## E. The Electron shell

New top-level `desktop/` (main-process TypeScript, bundled by esbuild to `desktop/build/`, gitignored).

1. `desktop/main.ts`
   - `protocol.registerSchemesAsPrivileged` for `app` (standard, secure, `supportFetchAPI`, `stream`), served from the export folder with COOP `same-origin`, COEP `credentialless`, a strict CSP and `application/wasm`. Path resolution is a pure function in `desktop/serve.ts` (traversal guard, `.html` and `[param].html` fallbacks, `+not-found.html`), the logic of `resolveFile` in `scripts/checks/a11y-web.ts`, moved to one shared module both use.
   - One `BrowserWindow`: `contextIsolation`, `sandbox`, no `nodeIntegration`, no remote module; minimum size 844 x 390 (section C, Sizes); window bounds remembered; single-instance lock.
   - Network policy in `desktop/policy.ts` (pure, tested): `session.webRequest` cancels everything but `app://` and `https://ringsdb.com/api/public/`; `will-navigate` is refused; `setWindowOpenHandler` sends only the Settings links (`src/screens/settings/links.ts` hosts) to `shell.openExternal`; every permission request is denied.
   - A minimal menu (Undo, Full screen, Quit, About with the version and licences).
2. `desktop/preload.ts`: exposes only `accessibilitySupportEnabled` and its change event.
3. `desktop/electron-builder.yml`: `appId: com.middleearth.player`, `productName: Middle-Earth Player`, the web export as `extraResources` (outside the asar, about 1 GB of pictures), version from `APP_VERSION` (as `app.config.js`; `package.json` stays `0.0.0`), the targets of decision 2, macOS ad-hoc identity, artifact names `middle-earth-player-<tag>-<os>-<arch>.<ext>`.
4. Commands: a `desktop` group in `scripts/cli.ts` (`GROUPS.desktop`) and `package.json`: `dev` (Electron on the Metro web server), `build` (assets, export with `EXPO_PUBLIC_DESKTOP=1`, esbuild), `pack` (electron-builder for this OS), `smoke` (section F). Scripts use `runScript` from `scripts/log.ts`.
5. Registration: `electron` in `onlyBuiltDependencies` (`pnpm-workspace.yaml`); exact pins for `electron`, `electron-builder`, `esbuild`, `pdfjs-dist`; `.gitignore` (`desktop/build/`, `desktop/out/`, `public/canvaskit.wasm`, an exception for the icon files); `.oxlintrc.json` (ignore the outputs; a zone: `desktop/` imports nothing from `src/`); `tsconfig.json` exclude for the outputs; `metro.config.js` blockList for `desktop/`; `vitest.config.mts` include `desktop/**/*.test.ts`; `scripts/checks/tracked.ts` gains `desktop`.

## F. Tests

1. Vitest, pure: `desktop/serve.test.ts`, `desktop/policy.test.ts`, the `EXPO_PUBLIC_DESKTOP` branch of `remote.ts`, the backup round trip and refusals, `scripts/cli.test.ts` for the new group.
2. `pnpm desktop smoke` (`scripts/checks/desktop-smoke.ts`, Playwright's `_electron`, the pattern of `a11y-web.ts`): an export with `EXPO_PUBLIC_E2E_SEED=1`, then assert `crossOriginIsolated`, seed `/e2e/duo`, the table canvas draws (a non-blank pixel read), a picture loads from the bundle, a booklet page renders, zero requests left `app://`, and a relaunch finds the save.
3. `test.yml`: a `desktop-smoke` job on ubuntu under xvfb, beside `a11y-web` (catalog only, no scans: the picture and booklet assertions run in the release job).

## G. Release pipeline

After `claude/release-workflow-performance-mz4n7m` is on `main`.

1. `release.yml`
   - `web` (ubuntu, `needs: plan`): install, restore the Metro cache, `wait-for-assets.sh`, download `assets`, export once with `EXPO_PUBLIC_DESKTOP=1` and `APP_VERSION`, upload `web-dist` (compression 0, 1 day). The export is the same on every OS.
   - `desktop` (matrix ubuntu, macos, windows; `needs: [plan, web]`; `shell: bash`): install, cache Electron and electron-builder downloads keyed on the lockfile, download `web-dist`, `pnpm desktop pack`, launch the packed app with the smoke script, portable sha256 (Node, not `stat`/`shasum`), the 2 GiB asset check, upload `desktop-<os>`.
   - `publish` needs `desktop`, downloads `desktop-*`, and `gh release create` lists the new globs.
   - Optional signing steps behind secrets, off by default, reported by `plan`'s Signing step as `desktop_signed`.
2. `scripts/release/notes.ts`: `NotesInput.desktop?`, three Install lines and their SHA-256 lines; `scripts/release/plan.ts`: `--desktop <file>` repeated; their tests.
3. A dry run (`dry_run: true`) on the branch proves the three builds before merge; no real release is cut by an agent.

## H. Docs and policy

Each section updates the doc that owns its behaviour in the same change; what remains at the end:

- `docs/brief.md`: Product, Stack (rows for the desktop shell, the PDF reader, CanvasKit), Card images, Persistence and shipping, Screens (booklet reader, Settings backup).
- `docs/architecture.md`: Repository map, a Desktop section (protocol, origin, policy), the web gates of section A.
- `docs/design-system.md` and `docs/design-system-table.md`: pointer and keyboard rows.
- `.claude/rules/release-standards.md` (Tags and releases), `docs/releasing.md` (Jobs, Caches, Signing, Installing), `docs/development.md` (Commands, a desktop section), `CLAUDE.md` (Commands).
- `README.md` (tagline, Install for Windows, macOS, Linux, checksums), `PRIVACY.md`, `SECURITY.md`, `ACCESSIBILITY.md` (keyboard and mouse, NVDA, Narrator, VoiceOver for Mac, Orca), `THIRD_PARTY_NOTICES.md` (Electron and Chromium licences ship in the package).
- `docs/phases/STATUS.md`: Standing decisions (unsigned desktop builds; the fixed origin).
- `pnpm doc index`; `avoid-ai-writing` in `docs` context on the prose.

## Order

Run it with `orchestrator`, one implementer per section, in order A → B → C → D → E → F → G → H, `reviewer` once at the end and `ux` after A and C. A is a gate: nothing after it starts until its numbers are reported and pass. Sections A to D each leave the phone app and the browser build working, so each can land on `main` as its own squash commit (`feat:` for D and for the first release that carries desktop; `repo:`/`refactor:` for the rest). The plan file is deleted by the last commit.

## Verification

- After every section: `pnpm lint`, `pnpm typecheck`, `pnpm test changed`; `pnpm vitest run src/play/compiler.test.ts` after A and C; `git diff --stat main -- data test/**/golden* src/rules/engine/version.ts` is empty.
- A: the frame-time numbers, before and after, in the commit body; `pnpm test a11y`.
- B: `pnpm web` with packed assets, network off in devtools: pictures and a booklet show.
- E, F: `pnpm desktop build && pnpm desktop smoke` on Linux (xvfb in a cloud session); open the packed app by hand on each OS once before the first release.
- G: a `dry_run: true` run of `release.yml` with all three `desktop-*` artifacts, their checksums and the notes preview.
- End: full `pnpm test`, `pnpm data check`, `pnpm test a11y`, `pnpm desktop smoke`.
