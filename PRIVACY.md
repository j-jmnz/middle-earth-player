# Privacy

Middle Earth LCG collects no personal data. It has no accounts, no sign-in, no analytics, no advertising, no crash reporting and no server of its own. The maintainers receive nothing from the app.

This page describes the app as released for phones. A development build and the web build also load card pictures from the sites the data comes from (`SECURITY.md`).

## What stays on your device

- **Your games and decks.** Saves, the campaign log, run history, decks and settings are kept in a SQLite database (`user.db`) in the app's private storage.
- **Rulebooks you open.** A PDF you pick with the system file picker is copied into the app's storage. The app reads only the file you choose.

Your phone's own backup (iCloud, or Android's backup to Google) may include `user.db`, as it does for any app. That copy goes to your account with Apple or Google, not to this project. Uninstalling the app deletes all of it.

## What the app sends over the network

The app needs no connection to play: the cards, the rules, the rulebooks and every card picture are inside it. It connects in one case only, over HTTPS:

| When | To | What is sent |
| --- | --- | --- |
| You import a deck from a RingsDB link | `ringsdb.com` | The deck's id from the link, and the code of any card in it that the app does not recognise |

Like any web request, this shows RingsDB your IP address and a standard user agent, and RingsDB's own privacy policy applies. The app adds no identifier, cookie or account token. If you never import a deck from RingsDB, the app never connects.

## Permissions

On Android: `INTERNET` (the deck import) and `VIBRATE` (haptics). On iOS: none. The app does not use the camera, microphone, location, contacts or photos.

## Checking this yourself

The code is open. `SECURITY.md` names the files behind each of these points. You can also inspect a built APK with a tool such as [Exodus Privacy](https://reports.exodus-privacy.eu.org), which lists its permissions and any tracking libraries, or play with the phone in airplane mode.

## Changes and contact

A change to this policy is a commit to this file, and its git history shows every version. Ask about privacy in a GitHub issue, or report a problem privately as `SECURITY.md` says.
