<p align="center"><a href="../README.md">Home</a> · <strong>Install</strong> · <a href="questions.md">FAQ</a> · <a href="roadmap.md">Roadmap</a> · <a href="../ACCESSIBILITY.md">Accessibility</a> · <a href="../PRIVACY.md">Privacy</a> · <a href="attribution.md">Attribution</a></p>

# Install

The app isn't in any app store. Get it from the [Releases page](https://github.com/j-jmnz/middle-earth-player/releases). It's free and works offline once installed. Pick your device: [Android](#android), [iPhone and iPad](#iphone-and-ipad) or [Windows, macOS and Linux](#windows-macos-and-linux).

| Platform | You need | Download |
| --- | --- | --- |
| Android | Android 7.0 or later, 64-bit | `.apk` |
| iPhone, iPad | iOS 15.1 or later, a free Apple ID, and SideStore or AltStore Classic. A computer once, for setup. | `source.json` or `.ipa` |
| Windows (experimental) | 64-bit | `.exe` installer or portable `.zip` |
| macOS (experimental) | Apple silicon or Intel | `.dmg` |
| Linux (experimental) | 64-bit x86 | `.AppImage` or `.deb` |

Use Wi-Fi, and have twice the download size free. The desktop downloads are large because every card picture and booklet is inside.

<a name="android"></a>
<details open>
<summary><strong>Android</strong></summary>

1. On your phone, tap [Download for Android](https://github.com/j-jmnz/middle-earth-player/releases/latest/download/middle-earth-player.apk). It gets `middle-earth-player.apk` from the latest release.
2. Open the download.
3. If asked, allow your browser or Files app to install apps, then go back.
4. Tap Install. If Play Protect warns you, tap More details, then Install anyway.

To update, install the new `.apk` the same way. Your saves stay. Don't uninstall first: that deletes your saves.

</details>

<a name="automatic-updates-with-obtainium"></a>
<details>
<summary><strong>Automatic Android updates with Obtainium</strong></summary>

[Obtainium](https://obtainium.imranr.dev) is a free app that installs each new release for you.

1. Install Obtainium from its [GitHub releases](https://github.com/ImranR98/Obtainium/releases/latest) or F-Droid.
2. On your phone, tap [Add to Obtainium](https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/%7B%22id%22%3A%22com.middleearth.player%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fj-jmnz%2Fmiddle-earth-player%22%2C%22author%22%3A%22j-jmnz%22%2C%22name%22%3A%22Middle-Earth%20Player%22%7D). If that doesn't open Obtainium, open it yourself, tap Add App, paste `https://github.com/j-jmnz/middle-earth-player` and tap Add.
3. Tap Install. If the app is already installed, Obtainium picks it up.

Obtainium checks in the background. On Android 12 or later it can update without asking, for apps it installed itself. Your saves stay.

</details>

<a name="iphone-and-ipad"></a>
<details>
<summary><strong>iPhone and iPad</strong></summary>

1. Set up [SideStore](https://sidestore.io), which refreshes the app on the phone, or [AltStore Classic](https://altstore.io), which refreshes it from AltServer on a computer on the same Wi-Fi. AltStore PAL won't work.
2. On iOS 16 or later, turn on Developer Mode (Settings, Privacy & Security) and restart.
3. In SideStore or AltStore, open Sources, tap +, and add `https://github.com/j-jmnz/middle-earth-player/releases/latest/download/source.json`.
4. Open the Middle-Earth Player source and tap Free or Get.

Or download the `.ipa` from the [latest release](https://github.com/j-jmnz/middle-earth-player/releases/latest) in Safari and add it under My Apps, +.

A free Apple ID signs the app for 7 days. SideStore and AltStore refresh it in the background, or tap Refresh All in My Apps. A free Apple ID allows 3 sideloaded apps, SideStore or AltStore included. Updates appear in the source and keep your saves. Deleting the app deletes them.

If a release's notes have a TestFlight link, you can use that instead: install [TestFlight](https://apps.apple.com/app/testflight/id899247664), open the link, tap Accept, then Install. TestFlight builds never need refreshing but expire after 90 days.

</details>

<a name="windows-macos-and-linux"></a>
<details>
<summary><strong>Windows, macOS and Linux</strong> (experimental)</summary>

> [!WARNING]
> The desktop apps are experimental. They are newer and less tested than the phone apps, so expect rough edges. If something breaks, [open an issue](https://github.com/j-jmnz/middle-earth-player/issues/new/choose) with your OS and the app version from Settings.

The desktop apps aren't signed by Microsoft or Apple, so the first launch shows a warning. Download your file from Assets on the [latest release](https://github.com/j-jmnz/middle-earth-player/releases/latest):

- **Windows:** run `middle-earth-player-win-x64.exe`. When SmartScreen says "Windows protected your PC", choose More info, then Run anyway. Or unzip the portable `-win-x64.zip` anywhere and run `Middle-Earth Player.exe`.
- **macOS:** open `middle-earth-player-mac-universal.dmg` and drag the app to Applications. The first time, right-click it and choose Open twice. On macOS 15 or later, try to open it once, then choose Open Anyway in System Settings, Privacy & Security.
- **Linux:** run `chmod +x` on `middle-earth-player-linux-x64.AppImage`, then run it. Or install the `.deb`, for example `sudo apt install ./middle-earth-player-linux-x64.deb`.

Saves stay on that computer ([PRIVACY.md](../PRIVACY.md) says where). To update, install the new release over the old one. To move or copy your campaigns, use Settings, Back up saves, then Restore from a backup on the other computer. The app never updates itself.

</details>

<a name="check-a-download-optional"></a>
<details>
<summary><strong>Check a download (optional)</strong></summary>

Each release lists the SHA-256 of every file, with a `.sha256` file beside each download, and the APK's signing certificate fingerprint. Check a file with `sha256sum` on Linux, `shasum -a 256` on macOS or `certutil -hashfile <file> SHA256` on Windows.

Every Android release is signed with the same key. Obtainium and [AppVerifier](https://github.com/soupslurpr/AppVerifier) can check the app against it:

```
com.middleearth.player
1D:63:32:29:77:C4:B1:9B:F8:57:58:D0:B7:62:53:FE:8D:BA:12:5F:55:D5:AE:DB:42:46:10:4F:46:D3:42:B4
```

</details>

<a name="if-something-goes-wrong"></a>
<details>
<summary><strong>If something goes wrong</strong></summary>

- **Android says "App not installed":** the phone is 32-bit or older than Android 7.0, it's short of space, or a copy you built yourself is installed. Uninstall that copy first; its saves go with it.
- **The download stops or won't open:** download it again over Wi-Fi.
- **Mac says the app "can't be opened" or "is damaged":** right-click it and choose Open. If that fails, run `xattr -dr com.apple.quarantine /Applications/Middle-Earth\ Player.app` in Terminal once.
- **The Linux AppImage won't start:** install FUSE 2 (`libfuse2`), or run it with `--appimage-extract-and-run`.
- **The iOS app stops opening after a few days:** its signature expired. Refresh it in SideStore or AltStore (with AltServer running, for AltStore).
- **You've hit the 3-app limit:** remove a sideloaded app you don't use.
- **The TestFlight beta is full:** use SideStore or AltStore.
- **Anything else:** [open an issue](https://github.com/j-jmnz/middle-earth-player/issues/new/choose) with your device, its OS version and the app version from Settings.

</details>

---

<p align="center"><a href="../README.md">Back to the home page</a></p>
