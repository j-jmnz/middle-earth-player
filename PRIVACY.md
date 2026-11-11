# Privacy policy

Middle Earth LCG collects no personal data. No accounts, analytics, advertising, crash reporting of its own or server; the maintainers receive nothing from the app. This applies to every Android, iPhone, iPad and web build this repository publishes.

## What stays on your device

Campaigns, games, logs, decks, notes and settings are saved only in the app's own storage (a SQLite database, `user.db`). An open game also keeps a checkpoint there: a copy of its table (the cards and where they lie) taken at the start of each phase and when you leave the table, so the game can go on from where you were after an update changes the rules. Booklets or deck files you open with the system file picker are copied there; the app reads only the file you pick.

Your phone's backup (iCloud or Google) may include these saves; that copy goes to your Apple or Google account, not to this project. Uninstalling the app deletes everything it saved.

## When the app uses the network

The phone app is offline. Its one connection: importing a deck from a RingsDB link sends [ringsdb.com](https://ringsdb.com), over HTTPS, the deck id and the code of any card the app does not recognise. RingsDB sees your IP address and a standard user agent, under its own privacy policy. No identifier, cookie, account or game data is added. If you never import from RingsDB, the phone app never connects.

The web build has no bundled pictures, so it also loads each card picture from [RingsDB](https://ringsdb.com), or the [Hall of Beorn](https://hallofbeorn.com) and DragnCards image storage on `s3.amazonaws.com`.

## Permissions

Android: `INTERNET` (deck import) and `VIBRATE` (haptics). iPhone and iPad: none. No camera, microphone, location, contacts or photos.

## Installing

Installing the APK, or the iOS app through SideStore or AltStore, sends this project nothing. SideStore and AltStore sign the app with your Apple ID on your device, under their own privacy policies; your Apple ID never reaches this project.

TestFlight installs are handled by Apple under [Apple's privacy policy](https://www.apple.com/legal/privacy/). Feedback or crash reports you send through TestFlight go to the maintainer and are used only to fix the app.

## Children

The app collects no data from anyone, children included.

## Checking this yourself

The code is open; [SECURITY.md](SECURITY.md) names the files behind each point. You can inspect a release APK with [Exodus Privacy](https://reports.exodus-privacy.eu.org), which lists permissions and tracking libraries, or play a game in airplane mode.

## Changes and contact

Changes to this policy are made in this file; its history is in the commits. Questions: [issues](https://github.com/j-jmnz/middle-earth-lcg/issues). Security problems: report privately as [SECURITY.md](SECURITY.md) says.
