# Prompt: combat spotlight device checks

Paste the block below into a Claude Code session on your own computer, with an Android phone plugged in by USB and, for iOS, an iPhone or the iOS Simulator. Do not use a cloud session: it has no device.

```text
You are checking the combat spotlight redesign on real devices (user request, 2026-10-29). It is built, reviewed and merged to main. Every offline check is green. Nothing native has been seen yet, because it was built in a cloud session with no device. Your job is to see it, record what you saw, and fix what fails.

Start
1. git fetch origin && git checkout main && git pull origin main, then git checkout -b spotlight-device-checks. Work and push there (git push -u origin spotlight-device-checks). Do not push to main and do not open a pull request unless I ask.
2. Read, in this order:
   - CLAUDE.md and .cursor/rules/authority.mdc (repo rules)
   - docs/handover/combat-spotlight-open.md (the cases to play and the ten open points, each with its code and likely fix; this is your checklist)
   - docs/plans/combat-spotlight-redesign.md (the plan)
   - docs/design-system.md: Table, **Spotlight**, and the Motion table (the spec)
   - docs/phases/STATUS.md, section "Combat spotlight redesign, 2026-10-29 (user request)" (Built, Decided, Checked, Open)
3. Run pnpm test, pnpm lint, tsc --noEmit and pnpm data:check once, so you know the baseline is green.

Settled decisions. A device check does not reopen them:
- A lone attack runs about 2.2 s at Normal.
- The stage is always dark, on the Light theme too.
- A destroyed target burns away.
- The cards are centered on the whole screen at 60% of its height (at most 340 pt).

Devices and seeing
- Get the app running:
  - Android: pnpm android, or pnpm android:usb --device when the phone shows a blank screen or a ConnectException to the computer's LAN address.
  - iOS: pnpm ios.
  - The pictures need pnpm data:sync scans pictures once (after pnpm data:build if data/cards is missing).
- Capture what plays:
  - Android: adb exec-out screencap -p > file.png for stills, and adb shell screenrecord for a run.
  - iOS Simulator: xcrun simctl io booted screenshot / recordVideo.
- Read stills yourself. For motion, take frames from the recordings (ffmpeg -i run.mp4 -vf fps=30 frames/%04d.png) and look at the hit stop, the burn and the swaps frame by frame.
- Some judgements are mine, not yours: whether it feels impactful, whether the Light stage reads dark, whether the shake feels right. Ask me only those, one short question at a time, and say what to look at.
- For frame rate on Android, use adb shell dumpsys gfxinfo <package> framestats, reset before each run. Use the cheapest Android phone available, and tell me which one it was.

Getting to the cases
- The handover lists six cases: damage on a defender, blocked, undefended hero, a kill with the burn, three attacks in one moment, and the players' fan with a shadow card. Play each at Normal and Quick, in Dark and Light.
- Scenario 1 reaches them within a few rounds. To make them repeatable, park save fixtures just before each kind of attack with node --experimental-strip-types scripts/e2e-fixtures.ts (src/campaign/fixtures/; see how the existing fixtures are made).
- Write a Maestro flow in .maestro/ that opens such a fixture, lets an attack play, taps to skip mid-run, and checks the banner and the damage count. Run it on both platforms. That closes open point 10.

Working the open points
- Go through points 1 to 10 of the handover in order.
- For each one, record in STATUS.md's section what was seen, on which phone or simulator and OS version, at which speed and theme. Move a point out of Open only when it was seen on a device. A simulator does not count for the performance point (3) or for the low-end phone.
- When a point fails, make the smallest change the handover names for it. Then:
  - re-run pnpm test, pnpm lint, tsc --noEmit and pnpm data:check;
  - see it again on the device;
  - commit with a clear message and push.
  One commit per point is fine.
- Repo rules hold throughout:
  - Durations live only in MOTION (src/play/motion-tokens.ts).
  - Spatial shares live in SPOT (src/play/spotlight-shape.ts).
  - Every number on screen comes from the engine (clash.ts).
  - src/play never imports src/screens.
  - Never commit catalog.db, scans or PDFs.
  - Update the tests that hold a value you change (spotlight-plan.test.ts, spotlight-beats.test.ts, spotlight-particles.test.ts, motion-tokens.test.ts).
- Keep the gate, skip, Back, haptic and banner-wait behaviour exactly as specified. Also: Quick is ×0.6, and reduced motion, a screen reader (TalkBack, VoiceOver) and the Combat spotlight setting turned off each play no spotlight, with the banner showing at once. Check that last part on a device too.
- When a change alters what docs/design-system.md describes, update it in the same commit.

Stop and ask me before you:
- drop, shorten or weaken any effect (particles, burn, flash, shake, flip, afterimages), even for performance;
- change a settled decision or the run length;
- change the theme handling beyond what point 2 of the handover names;
- take on any of the taste items the handover lists.
If the burn shader fails to compile on a device, check that the fallback (fade, drop, veil) plays. Then tell me which GPU or device it was before you change the shader.

Done when
- every open point is either seen and recorded, or still Open with the reason (no such device available, or waiting on my judgement);
- a Maestro flow plays and skips an attack on both platforms;
- pnpm test, pnpm lint, tsc --noEmit and pnpm data:check are green and everything is pushed to spotlight-device-checks.

Finish with a short report:
- each point and what was seen, with the device it was seen on;
- what you changed and why;
- the frame-rate numbers;
- what stays open;
- the questions you still need me to answer.
```
