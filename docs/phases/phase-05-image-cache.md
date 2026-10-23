# Phase 5 — Image cache

Depends on: phase 3
Blocks: phases 6 and 11

## Goal

Card images download from RingsDB into the document directory and survive a kill. The package does not contain the files.

## Cache

The asset is `https://ringsdb.com` plus `imagesrc`. Sniff the magic bytes. The URL often ends in `.png` and the body is a JPEG. On the fetch noted in the brief, a normal card was about 430×600. Do not upscale. Do not look for a 300 dpi master. Do not hotlink DragnCards.

Download with `File.createDownloadTask` from `expo-file-system`. Persist `DownloadPauseState` so a kill mid-file can resume. Cap concurrency. Retry a 503. Keep the bytes in the document directory.

Store code, path, width, height, byte size, media type, and sha256 in `user.db` `image_files`. SQLite does not store the bytes. A catalog update deletes a file only when that code's hash changed.

`expo-file-system` does not expose backup exclusion. One local function sets `isExcludedFromBackup` on the image directory and does nothing else. About 420 MB of player-card art, plus quest and encounter art, must not enter an iCloud backup.

Keep the files out of the APK and the IPA. The binary is the Expo shell, Skia (when the table exists), and `catalog.db`.

`expo-image` decodes a list card and the inspect screen. The inspect screen may decode the cached file at its native size. The table, when it exists, decodes the cached file. It does not call Skia's `makeImageFromView`. Nothing decodes the whole cache. Do not prefetch all files at startup. Text is enough to play while a download is pending. Downloads stay off the interaction path.

The first screen still paints from SQLite and does not wait on a download.

## Exit

Airplane mode, kill, relaunch. A card opened from the pool still shows its cached file. A download interrupted mid-file resumes from the persisted pause state. The image directory is excluded from backup. The built package does not contain that file.
