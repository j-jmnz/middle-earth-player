# Plan: a web app for iPhone and iPad on Cloudflare

A player opens one URL in Safari, adds the app to the Home Screen and plays offline, with no SideStore, AltStore or TestFlight. Only the test site of Phase 0 is built (`docs/development.md`, The web app on Cloudflare). Phase 0 decides whether the rest goes ahead.

## Assessment

The app already runs in a browser: the desktop app is the web export in Electron (`docs/architecture.md`, Desktop), with the table on CanvasKit, `user.db` in OPFS through `expo-sqlite`, the booklets through pdf.js and the sounds through the web audio player. A Home Screen web app is that export, served by Cloudflare, plus a manifest, a service worker and the iOS fixes below. The work is feasible, and its size depends on what Phase 0 finds on a real iPhone and iPad. No cloud session can check Safari: the checks need the user's devices.

### What blocks today's export on Safari

- **Cross-origin isolation.** `expo-sqlite`'s synchronous calls need `SharedArrayBuffer`, so every response carries COOP `same-origin` and COEP `credentialless`. Safari does not support `credentialless` (caniuse, through Safari 27), so the page is not isolated there and the database does not open. The fix is COEP `require-corp` with every file on the app's own origin. The RingsDB deck import and the update check are then the only cross-origin requests, and they pass only if those servers answer with CORS headers; if RingsDB does not, the import goes through a route of the app's Worker.
- **No pictures in the plain web build.** Only the desktop export bundles the pictures (`src/screens/nav/desktop.ts`, `src/screens/images/remote.ts`); the browser build fetches them from their sources, which `require-corp` refuses. The web app needs its own build flag and serves the packed pictures from its origin.

### Risks only a device can answer

- **The database on iOS.** The main thread waits on the database worker for every accepted intent (`src/screens/data/web/worker-channel.ts`). Whether WebKit's OPFS sync access handles and that wait are fast and stable on an iPhone is unknown.
- **Memory.** iOS ends a web page that uses too much memory, at a limit far under a desktop's. The table holds CanvasKit, the catalog, the decoded card pictures and one WebGL canvas. An older iPhone may reload the page in a long game. The save survives (it is written on every intent), but the reload is a fault to the player.
- **Storage.** The full export is about a gigabyte, most of it pictures. WebKit gives an origin up to 60% of the disk since iOS 17, and a Home Screen web app keeps its storage, but data in a Safari tab is deleted after seven days without a visit. Removing the icon deletes the saves, and there is no system backup of them; Back up saves (`docs/brief.md`, Persistence and shipping) is the player's only copy.
- **A Safari tab and the Home Screen app do not share storage.** A game started in the tab does not appear in the installed app.

### What an iPhone web app cannot do

- **Haptics.** iOS has no vibration API for the web. The haptic settings are hidden, as on the desktop.
- **Orientation lock.** iOS ignores the manifest's orientation. The app follows the device, as the native app does with `orientation: default`.
- **Sound.** Audio starts only after a tap, follows the silent switch and stops in the background. Mixing with other apps' audio (`other-audio`) is not available.
- **Keep awake.** The Screen Wake Lock API works in Safari, and in Home Screen apps from iOS 18.4.
- **Install.** iOS shows no install prompt: the player uses Share, then Add to Home Screen. The app must show those steps.

### Cloudflare fit

| Need | Cloudflare product | Note |
| --- | --- | --- |
| The export (HTML, JavaScript, WebAssembly, `catalog.db`, fonts, sounds, pictures) | Workers static assets | 25 MiB a file and 100,000 files on the paid plan, which the account has. Requests for static assets are free and run no Worker code. A `_headers` file sets COOP, COEP and the CSP. |
| A file over 25 MiB (the Dream-chaser booklet) | R2, read by the Worker on the same origin | The Worker answers `Range`, which pdf.js and Safari's media need. |
| The RingsDB import, if RingsDB sends no CORS headers | A Worker route | A new request path: `PRIVACY.md` names it. |
| The domain | Cloudflare Registrar and DNS | See Decisions for the user. |
| A closed test | Cloudflare Access | Free for a small group, signs in by email code. |
| Deploy | `wrangler deploy` from `.github/workflows/release.yml` | Only the release workflow deploys the public site (`docs/agents/release-standards.md`, Tags and releases). |

The asset mirror bucket (`docs/development.md`, Asset mirror) stays private and stays a build cache: it holds the pinned source files (full-size pictures, scans, PDFs), not what the app shows. The site gets its own bucket.

### How a picture reaches the player

1. The release job packs the pictures from the mirror, as it does for the phone and desktop builds (`.github/actions/pack-assets`): 1200 px copies in `assets/scans`.
2. The web app export carries them as hashed files under `/assets/`, and `wrangler deploy` uploads them as static assets. Wrangler sends only the files whose content changed, so a release that changes no picture uploads none.
3. The browser reads each picture from the app's own origin, which `require-corp` and the CSP's `img-src 'self'` allow, and the service worker keeps it (Phase 2).

If Phase 0 shows that a deploy of the whole export is too slow or too large, the packed pictures move to the site's R2 bucket by sha256 and the Worker serves them on the same origin. The browser's side does not change.

## Decisions for the user

1. **Public pictures and music.** The site would serve every card picture and the music loops, cut from the film score, at a public URL. A release file needs a download and an install; a URL does not, so the copyright exposure is higher, and a complaint to Cloudflare can take the site down. Options: a public site without the music, a public site with all of it, or a site behind Cloudflare Access for invited players. Recommendation: start behind Access, and decide on the music before it opens.
2. **The domain.** The origin holds the saves, so it never changes after the first release, like the desktop's names (`desktop/identity.ts`). A `workers.dev` name is free but ties the saves to the account's subdomain. Recommendation: a domain bought at Cloudflare Registrar before Phase 2.
3. **What "offline" means on the web.** The phone and desktop builds carry every picture. A gigabyte before the first game is too much in a browser. Recommendation: the app shell is cached at install (it plays offline with cards drawn as text), each picture is cached when first shown, and Settings has Download pictures for each campaign and for all, with the size and progress.
4. **Save sync between devices.** Possible later with a Worker and R2 or D1, but it sends saves off the device, which the app never does today. Recommendation: not in this plan; Back up saves and Restore cover a move between devices.
5. **Keeping the SideStore IPA and TestFlight.** The web app does not replace them until it has proved stable. Recommendation: keep both.

## Phase 0: device spike

No product code. A test site behind Cloudflare Access answers the open risks. The site is the desktop's export with `require-corp`; in Chromium it is isolated, opens `user.db` and shows no error.

1. Build and deploy the test site to a `workers.dev` name behind Access (`docs/development.md`, The web app on Cloudflare).
2. On an iPhone and an iPad (the oldest the user has, on iOS 17 or later), in Safari and from the Home Screen: `crossOriginIsolated` is true, `user.db` opens, a save survives a relaunch and a week, and Back up saves and Restore work.
3. Play a full scenario from a save fixture. Record the time of one accepted intent, any page reload, and the table's frame rate with pictures on High and Low.
4. Open a booklet, start the music, import a RingsDB deck.
5. Read the build's summary line and warnings: the export's files and the files over the asset limit.

Exit: a short report with each answer. The user decides to go on, to change the storage design (for example an asynchronous database path), or to stop.

## Phase 1: the web app build

- A build flag beside `EXPO_PUBLIC_DESKTOP` (`EXPO_PUBLIC_WEBAPP=1`) and `pnpm webapp build`: the packs, the export, the manifest, the service worker and the `_headers` file. The desktop export and the phone bundles do not change (`pnpm test phone-bundle`, `scripts/checks/phone-files.test.ts`).
- Headers: COOP `same-origin`, COEP `require-corp`, and the CSP of `desktop/serve.ts` with the web app's `connect-src`. `desktop/serve.ts` and `scripts/browser/web-export.ts` keep `credentialless` for Electron, or move to `require-corp` too if Phase 0 shows no cost, so one policy is tested.
- Manifest and iOS tags: name, icons (a 180 px `apple-touch-icon`, maskable icons), `display: standalone`, theme and background colours, `viewport-fit=cover` with the safe-area insets the screens already read, a black status bar.
- Pictures follow decision 3: `src/screens/images/remote.ts` gets a web app rule that reads the origin's packed pictures.
- Settings on the web app: the desktop's categories, without the update check's link to an installer.

## Phase 2: offline and updates

- A service worker precaches the shell (the routes' HTML, the bundle, CanvasKit, the `expo-sqlite` and pdf.js workers, `catalog.db`, fonts, icons, sound effects) by content hash, and answers pictures, music and booklets cache-first from a second cache. Cached responses keep the COOP and COEP headers, so an offline launch is still isolated.
- Download pictures (decision 3): a queue in the page, time-boxed like the phone's download queue, that fills the picture cache and shows its size. It asks `navigator.storage.persist()` and reports the quota from `navigator.storage.estimate()`.
- Updates: a new service worker waits until no game is on screen, then the app shows the update ribbon (`src/ui/update`) with Reload in place of the release link. A reload lands on the same checks an app update does (`docs/architecture.md`, Open games across an update). An old tab never runs a new `user.db` migration under old code: the page reloads when the worker changes.
- One page at a time: a second tab or window of the same origin shows "The app is open in another tab" in place of opening the database (Web Locks), because WebKit gives one writer to an OPFS file.

## Phase 3: iPhone and iPad fit

- An install screen for Safari on iOS that is not standalone: the Share and Add to Home Screen steps, and a warning that games in the tab are deleted after a week away and do not move to the installed app.
- A reminder to back up: the Saves page says when the last backup was made, since the web app has no system backup.
- Haptic settings hidden, the Screen Wake Lock for Keep the screen awake, audio unlocked on the first tap and paused when the page is hidden.
- Touch and layout pass on the phone and tablet sizes with `pnpm browser shot` (Chromium) and on the devices: pinch and double-tap zoom off on the table, no rubber-band scroll behind the canvas, the keyboard over the deck search, the Home indicator and the notch.
- Memory: if Phase 0 showed reloads, lower the picture cache's size and the default picture quality on the web app, and release decoded pictures when the table is hidden.

## Phase 4: Cloudflare and release

- `webapp/wrangler.toml` and `webapp/worker.ts` gain the R2 bucket for files over the asset limit, and the RingsDB route if it is needed.
- `release.yml` gains a `webapp` job beside `web`: it builds the web app export, uploads the oversize files to R2 by sha256, runs `wrangler deploy`, and loads the deployed site once in Chromium (isolation, the drawn table, a save across a reload). Like the desktop leg, its failure does not hold back the APK and the IPA. Secrets: a Cloudflare API token scoped to this Worker and bucket, and the account id (`docs/releasing.md`).
- A dry run deploys to a preview version, never to the public origin.
- A WebKit run of the smoke in CI (Playwright's WebKit build) catches a header or API regression that Chromium accepts. It is not iOS, so the device checks of Phase 0 are repeated by the user before the first public release.
- Docs in the same changes: `docs/architecture.md` (a Web app section beside Desktop), `docs/brief.md` (Persistence and shipping), `docs/releasing.md`, `docs/agents/release-standards.md` (the origin as a permanent name), `PRIVACY.md` (the host sees each request's IP address; the RingsDB route if built), `README.md` (how to install).

## Order and size

Phase 0 is days and needs the user's devices and a Cloudflare account. Phases 1 and 2 are the bulk of the code and can be checked in Chromium. Phase 3 needs the devices again. Phase 4 can start after Phase 1 for the closed test. Decisions 1 and 2 are needed before Phase 4 opens the site; decision 3 before Phase 1.
