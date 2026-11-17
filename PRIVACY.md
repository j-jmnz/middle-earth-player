# Privacy policy

Middle-Earth Player collects no personal data. It has no accounts, analytics, advertising, server or crash reporting of its own, and the maintainers receive nothing from the app. This policy covers every Android, iPhone, iPad and web build this repository publishes.

## Data on your device

Your campaigns, games, logs, decks, notes, settings and the cycles and packs you mark as owned are saved only in the app's own storage, a SQLite database called `user.db`. An open game also keeps a checkpoint there: a copy of its table (the cards and where they lie), taken at the start of each phase and whenever you leave the table. That way the game can continue from where you were even after an update changes the rules. When you open a booklet or a deck file with the system file picker, the app copies it into the same storage, and it reads only the file you pick. In a web browser or the desktop app, a booklet you add is kept in the browser's private file storage for the app (OPFS, a `booklets` folder next to the database), under the same origin and the same rules: it never leaves your computer. In a browser, clearing the site's data deletes it; in the desktop app it is in the profile folder, which removing the app leaves in place (below).

In a web browser the saves are in the browser's private file storage for the app (OPFS); in the desktop app they are in the app's own profile folder on your computer (a folder named `Middle-Earth Player` under your system's application-data folder: `%APPDATA%` on Windows, `~/Library/Application Support` on macOS, `~/.config` on Linux), together with a small file that remembers where its window was. Neither is sent anywhere. In a browser or the desktop app, Settings can write a backup of `user.db` to a file (`middle-earth-player-<date>.backup`) and read one back. The file is made only when you tap Back up saves, holds every campaign, game, deck, run and setting you have saved, and goes where you save it: your browser's downloads folder, or the folder you pick in the desktop app's save dialog. The app never uploads it, so it leaves your computer only if you move it.

Your phone's backup (iCloud or Google) may include these saves. That copy goes to your Apple or Google account, not to this project. Uninstalling the app on a phone deletes everything it saved. On a computer, removing the app leaves its profile folder in place, so a reinstall finds your saves; delete the folder to remove them.

## Network connections

The app plays offline and makes two kinds of connection.

- **Deck import.** When you import a deck from a RingsDB link, it sends [ringsdb.com](https://ringsdb.com), over HTTPS, the deck's id and the code of any card the app doesn't recognise.
- **Update check.** At most once a day, a few seconds after the app opens, when you come back to it, or when you turn the check on, it asks GitHub's public API (`api.github.com`), over HTTPS, for the latest release of this project. The request carries nothing about you or your games. The app reads only the newest version number and its release date, and keeps them in `user.db` with the time it asked and the version whose notice you closed. If a newer version is out, a notice says so and Get it opens the release page in your browser. Turn it off in Settings, About, Check for new versions; with it off the app never asks. Development builds never ask.

RingsDB and GitHub see your IP address and a standard user agent, and handle them under their own privacy policies ([GitHub's](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)). The app adds no identifier, cookie, account or game data to either request. With Check for new versions off and no RingsDB import, the app never connects at all.

The browser build of the app has no bundled pictures, so it also loads each card picture from [RingsDB](https://ringsdb.com), or from the [Hall of Beorn](https://hallofbeorn.com) and DragnCards image storage on `s3.amazonaws.com`. The desktop app bundles every picture and every booklet, like the phone app, and fetches none: a card without a picture is drawn as its text. Its booklet reader (pdf.js) runs from files inside the app and requests nothing. The desktop app makes the same two requests and no others, and enforces that itself: its window cancels every other request, refuses to navigate away from the app, denies every permission request (camera, microphone, location, notifications) and sends only links to this project's GitHub pages to your system browser, when you tap them in Settings. It has no auto-update, no analytics and no crash reporting: a new version is a new installer you download yourself.

## Permissions

On Android the app asks for `INTERNET`, for deck import and the update check, and `VIBRATE`, for haptics. On iPhone and iPad it asks for none. The desktop app asks for none and denies every permission request its window receives. It never uses the camera, microphone, location, contacts or photos.

## Installing

Installing the APK, or installing the iOS app through SideStore or AltStore, sends this project nothing. SideStore and AltStore sign the app with your Apple ID on your own device, under their own privacy policies, and your Apple ID never reaches this project.

The desktop installers (a Windows installer or zip, a Mac disk image, a Linux AppImage or `.deb`) come from this project's GitHub Releases page, are not signed by Microsoft or Apple, and send this project nothing when you run them. A Windows or Mac system may check an unsigned download with its own services under its vendor's policy; that is the system's check, not the app's.

If you install through TestFlight, Apple handles that under [Apple's privacy policy](https://www.apple.com/legal/privacy/). Any feedback or crash reports you send through TestFlight go to the maintainer and are used only to fix the app.

## Children

The app collects no data from anyone, children included.

## Checking this yourself

The code is open, and [SECURITY.md](SECURITY.md) names the files behind each point above. You can inspect a release APK with [Exodus Privacy](https://reports.exodus-privacy.eu.org), which lists its permissions and any tracking libraries, or simply play a game in airplane mode, on a phone or on a computer.

## Changes and contact

Any change to this policy is made in this file, and its history is in the commits. Send questions through the [issues](https://github.com/j-jmnz/middle-earth-player/issues). Report security problems privately, as [SECURITY.md](SECURITY.md) explains.
