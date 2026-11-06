# Privacy

Middle Earth LCG collects no personal data. It has no accounts, no sign-in, no analytics, no advertising, no crash reporting and no server of its own. The maintainers receive nothing from the app.

## What stays on your device

- **Your games and decks.** Saves, the campaign log, run history, decks and settings are kept in a SQLite database (`user.db`) in the app's private storage.
- **Rulebooks you open.** A PDF you pick with the system file picker is copied into the app's storage. The app reads only the file you choose.
- **Downloaded card pictures**, if any (see below). They are excluded from device backups.

Your phone's own backup (iCloud, or Android's backup to Google) may include `user.db`, as it does for any app. That copy goes to your account with Apple or Google, not to this project. Uninstalling the app deletes all of it.

## What the app sends over the network

The app needs no connection to play. It connects only in these cases, and only over HTTPS:

| When | To | What is sent |
| --- | --- | --- |
| You import a deck from a RingsDB link | `ringsdb.com` | The deck's id from the link, and the code of any card the app does not recognise |
| The app shows a card whose picture the build did not bundle | `ringsdb.com`, or the Hall of Beorn or DragnCards image storage on `s3.amazonaws.com` | A request for that card's picture |

Like any web request, these show those sites your IP address and a standard user agent. Their own privacy policies apply. The app adds no identifier, cookie or account token. Release builds bundle every card picture they can, so most players never make the second kind of request.

## Permissions

On Android: `INTERNET` (the requests above) and `VIBRATE` (haptics). On iOS: none. The app does not use the camera, microphone, location, contacts or photos.

## Checking this yourself

The code is open. `SECURITY.md` names the files that make each request. You can also inspect a built APK with a tool such as [Exodus Privacy](https://reports.exodus-privacy.eu.org), which lists its permissions and any tracking libraries.

## Changes and contact

A change to this policy is a commit to this file, and its git history shows every version. Ask about privacy in a GitHub issue, or report a problem privately as `SECURITY.md` says.
