# iOS releases

Not built. The release pipeline ships Android only (`docs/releasing.md`). This plan weighs the ways to give iPhone and iPad players a build without the App Store; the user picks one before any of it is built. Every way but building from source needs Apple signing, and every way that a stranger can install needs a paid Apple Developer Program membership (99 USD a year).

## Options

| Way | Apple account | Who can install | Lasts | Pipeline work |
| --- | --- | --- | --- | --- |
| Build from source (today) | Free Apple ID | Anyone with a Mac and Xcode | 7 days on a free ID, then reinstall | None: README, On a phone |
| Unsigned IPA for AltStore or SideStore | Each player's own free Apple ID | Anyone who installs AltStore or SideStore | 7 days, refreshed by the sideloading app | A `macos` job: `expo prebuild -p ios`, `xcodebuild archive` with signing off, zip `Payload/` to `.ipa`, attach to the release |
| TestFlight | Paid | Up to 10,000 testers by public link, after Apple's beta review | 90 days per build | A `macos` job with an App Store Connect API key and a distribution certificate as secrets; `xcodebuild -exportArchive` and upload with `xcrun altool` or EAS Submit |
| Ad hoc | Paid | Up to 100 registered devices a year, by UDID | The profile's year | Signing as for TestFlight, plus a provisioning profile rebuilt for each new device |
| EU alternative marketplace (AltStore PAL) | Paid, with Apple notarization | Players in the EU | Until revoked | Notarized build and marketplace listing; EU only |

## Recommendation

1. Now: attach an unsigned IPA to every release, built by a `macos` job beside `android`, and say in the notes and the README that it installs through AltStore or SideStore with the player's own Apple ID. It costs nothing, needs no secret, and fits the pipeline as it is. The repository is public, so `macos` runner minutes are free.
2. When a paid membership is worth it: TestFlight with a public link, uploaded by the same job. Players then install from Apple's TestFlight app with no sideloading, at the cost of a beta review per build and a 90-day expiry, so a release at least every 90 days.

Ad hoc does not scale past friends, and an EU marketplace leaves most players out.

## Work for option 1

- A `ios` job in `.github/workflows/release.yml` on `macos-latest`: the same pack steps as `android`, `pnpm exec expo prebuild --platform ios`, `pod install`, `xcodebuild -workspace ios/*.xcworkspace -scheme <app> -configuration Release -sdk iphoneos -archivePath build/app.xcarchive archive CODE_SIGNING_ALLOWED=NO`, then `Payload/<app>.app` zipped to `middle-earth-lcg-v<version>.ipa` with its `.sha256`, uploaded as the `ios` artifact; `publish` waits for it and attaches both.
- The IPA must stay under the 2 GiB asset limit, as the APK does.
- The notes' Install section (`scripts/release/notes.ts`) and the README's Install section gain the iPhone steps.
- `docs/releasing.md` gains the job, and this plan is deleted.
