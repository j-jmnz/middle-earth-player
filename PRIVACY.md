# Privacy policy

Middle-Earth Player collects no personal data. It has no accounts, analytics, advertising, server or crash reporting of its own, and the maintainers receive nothing from the app. This policy covers every Android, iPhone, iPad and web build this repository publishes.

## Data on your device

Your campaigns, games, logs, decks, notes and settings are saved only in the app's own storage, a SQLite database called `user.db`. An open game also keeps a checkpoint there: a copy of its table (the cards and where they lie), taken at the start of each phase and whenever you leave the table. That way the game can continue from where you were even after an update changes the rules. When you open a booklet or a deck file with the system file picker, the app copies it into the same storage, and it reads only the file you pick.

Your phone's backup (iCloud or Google) may include these saves. That copy goes to your Apple or Google account, not to this project. Uninstalling the app deletes everything it saved.

## Network connections

The phone app works offline and makes only one kind of connection. When you import a deck from a RingsDB link, it sends [ringsdb.com](https://ringsdb.com), over HTTPS, the deck's id and the code of any card the app doesn't recognise. RingsDB sees your IP address and a standard user agent, and handles them under its own privacy policy. The app adds no identifier, cookie, account or game data to that request. If you never import a deck from RingsDB, the phone app never connects at all.

The web build has no bundled pictures, so it also loads each card picture from [RingsDB](https://ringsdb.com), or from the [Hall of Beorn](https://hallofbeorn.com) and DragnCards image storage on `s3.amazonaws.com`.

## Permissions

On Android the app asks for `INTERNET`, for deck import, and `VIBRATE`, for haptics. On iPhone and iPad it asks for none. It never uses the camera, microphone, location, contacts or photos.

## Installing

Installing the APK, or installing the iOS app through SideStore or AltStore, sends this project nothing. SideStore and AltStore sign the app with your Apple ID on your own device, under their own privacy policies, and your Apple ID never reaches this project.

If you install through TestFlight, Apple handles that under [Apple's privacy policy](https://www.apple.com/legal/privacy/). Any feedback or crash reports you send through TestFlight go to the maintainer and are used only to fix the app.

## Children

The app collects no data from anyone, children included.

## Checking this yourself

The code is open, and [SECURITY.md](SECURITY.md) names the files behind each point above. You can inspect a release APK with [Exodus Privacy](https://reports.exodus-privacy.eu.org), which lists its permissions and any tracking libraries, or simply play a game in airplane mode.

## Changes and contact

Any change to this policy is made in this file, and its history is in the commits. Send questions through the [issues](https://github.com/j-jmnz/middle-earth-player/issues). Report security problems privately, as [SECURITY.md](SECURITY.md) explains.
