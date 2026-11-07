# Privacy policy

Middle Earth LCG collects no personal data. It has no accounts, no sign-in, no analytics, no advertising, no crash reporting of its own and no server. The maintainers receive nothing from the app. This policy covers the app on Android, iPhone, iPad and the web, in every build this repository publishes.

## What stays on your device

Your campaigns, games, campaign logs, decks, notes and settings are saved only on your device, in the app's own storage (a SQLite database, `user.db`). Nothing is sent to the project or anyone else. Booklets or deck files you open with the system file picker are copied into that storage and stay there; the app reads only the file you choose.

Your phone's own backup (iCloud, or Android's backup to Google) may include the app's saves, as it does for other apps. That copy goes to your account with Apple or Google, not to this project. Uninstalling the app deletes everything it saved.

## When the app uses the network

The phone app plays offline: its cards, rules, booklets and every card picture are inside it. It connects in one case only, over HTTPS:

| When | To | What is sent |
| --- | --- | --- |
| You import a deck from a RingsDB link | [ringsdb.com](https://ringsdb.com) | The deck's id from the link, and the code of any card in it that the app does not recognise |

Like any web request, this shows RingsDB your IP address and a standard user agent, under RingsDB's own privacy policy. The app adds no identifier, cookie, account or game data. If you never import a deck from RingsDB, the phone app never connects.

The web build carries no card pictures, so it also loads each picture it shows from [RingsDB](https://ringsdb.com), or the [Hall of Beorn](https://hallofbeorn.com) and DragnCards image storage on `s3.amazonaws.com`, with the same kind of request.

## Permissions

On Android: `INTERNET` (the deck import) and `VIBRATE` (haptics). On iPhone and iPad: none. The app does not use the camera, microphone, location, contacts or photos.

## Installing

The project gets no data when you install the Android APK, or the iOS app with SideStore or AltStore. SideStore and AltStore sign the app with your Apple ID on your own device; they are separate projects with their own privacy policies, and your Apple ID never reaches this project.

If you install through TestFlight instead, Apple handles that under [Apple's privacy policy](https://www.apple.com/legal/privacy/). If you choose to send feedback or a crash report through TestFlight, Apple passes it to the project's maintainer, who uses it only to fix the app.

## Children

The app collects no data from anyone, children included.

## Checking this yourself

The code is open, and [SECURITY.md](SECURITY.md) names the files behind each of these points. You can also inspect an APK from the Releases page with a tool such as [Exodus Privacy](https://reports.exodus-privacy.eu.org), which lists its permissions and any tracking libraries, or play a whole game with the phone in airplane mode.

## Changes and contact

A change to this policy is made in this file, and its history is in the repository's commits. Questions go to the repository's [issues](https://github.com/j-jmnz/middle-earth-lcg/issues); report a security problem privately, as [SECURITY.md](SECURITY.md) says.
