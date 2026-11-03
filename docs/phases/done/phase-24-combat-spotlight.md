# Phase 24 — Combat spotlight

> **Superseded by the 2026-10-29 redesign (`docs/plans/done/combat-spotlight-redesign.md`).** A user request replaced this phase's look and timing: the spotlight is a full-screen, always-dark layer, a lone attack runs 2200 ms, not 1500, and a destroyed target burns. The gate, skip, Back, banner-wait and engine numbers below still hold. `docs/design-system-table.md`, Spotlight, is the current description; the sequence and numbers below are history.

Depends on: phase 23
Blocks: nothing
Can run beside: phases 14, 15, 16, 25 and 26

Plan: `docs/plans/done/board-ux.md` (user list item 3). Implementer: `implementer` on Sonnet 5.5.

## Goal

When an attack deals or blocks damage, the table plays a short spotlight. The attacks are:
- an enemy against a defender;
- an enemy against an undefended hero;
- the players' attackers against an enemy.

Both sides come to the center, enlarged, over a darkened table. The attacker strikes and the damage tokens fly onto the target. The whole thing takes about a second and a half, and a tap skips it.

## Now

- The attack is shown with:
  - a red edge on the attacking enemy;
  - the defender or attackers beside it with a combat mark (`placeEngaged`, `layout.ts:188-211`; `CombatMarkView`);
  - the dock's readout ("1 damage, shadow card next");
  - the banner's beats (`src/play/store/outcome.ts`, `momentOf`).
- Damage appears on the damage token's count.

## Build

**Sequence at Normal speed** (Quick is ×0.6)

| Time | Beat |
| --- | --- |
| 0–250 ms | The canvas dims under night at 65%. The top bar and dock dim under an RN scrim. The attacker or attackers and the target fly from their slots to the canvas center, side by side, enlarged to about 42% of the canvas height, with a 24 pt gap. Under each, a big pill in Marcellus: the attack strength with the attack icon, or the defense with the defense icon. |
| (+250 ms) | If the attack turned a shadow card, it flips face up beside the enemy before the strike. |
| 250–500 ms | Anticipation: the attacker draws back 10 pt and tilts 4° away. |
| 500–650 ms | The lunge: the attacker moves to touch the target. |
| 650–730 ms | Hit stop: everything holds. A medium impact haptic plays (`tickImpact` in `src/ui/haptics.ts`). |
| 730–1100 ms | The target shakes ±5 pt, decaying over three swings. The damage token art bursts from the point of contact, one token per damage, 90 ms apart, and each flies to the target's damage corner. The count there pops as phase 23's tokens do. |
| (no damage) | The defense icon on the target bounces once (1 → 1.25 → 1) with "Blocked" under it, in place of the burst. |
| (destroyed) | The target greys (a night veil at 50%) and drops 12 pt with a fade before the return. |
| 1100–1500 ms | Both go back to their slots. The scrim fades. |

**Who stands where**
- The attacker is always at the left: the enemy for an enemy attack, the players' attackers for a player attack.
- Several attackers stand as a fan of up to three, then "+n".

**Rules of the moment**
- Each attack in one new state plays in turn. A tap anywhere skips all of them and lands the table on the new state.
- The spotlight replays a state the engine already resolved. It never gates an intent, and the dock's next moment is ready under it. The 350 ms settle (`SETTLE_MS`) starts when the spotlight ends or is skipped.
- The banner's beats start when the spotlight ends or is skipped, so they do not race it.
- Under reduced motion there is no spotlight. The banner carries the attack as now.

**Drawing**
- A top layer on the table's Skia canvas (`src/play/spotlight/spotlight.native.tsx`). It draws:
  - the scrim;
  - the enlarged card pictures, from the images the canvas already holds;
  - the token art;
  - the pills.
- An RN scrim over the top bar and the dock catches the skip tap. Card pictures stay on the canvas (design system).
- The web build (`table-canvas.tsx`, a list) has no spotlight.

## Data

- A pure `clashesOf(prev, next, steps)` in `src/play/store/clash.ts`. It returns, in order:
  - `[{ attackers: string[], target: string, attack: number, defense: number, damage: number, destroyed: boolean, shadow: string | null, undefended: boolean }]`.
- It reads the same engine steps the banner reads (the strike and attack steps `outcome.ts` and `readout.ts` use). Every number is the engine's.

## Tests

`src/play/store/clash.test.ts`, on games played the way `src/campaign/combat-flow.test.ts` plays them:
- a defended attack with 1 damage;
- a blocked attack (0 damage);
- an undefended attack on a hero;
- a defender destroyed;
- a players' attack with two attackers destroying an enemy;
- an attack with a shadow card;
- two attacks in one state, in order.

## E2E

None. The canvas is phone-only. The banner flows still pass, because the banner shows once the spotlight is skipped or done. Maestro waits on the banner's testID.

## Exit

- `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` and `pnpm data:check` pass.
- `docs/design-system-table.md` () gains a Spotlight paragraph and updates Banner and Haptics.
- STATUS.md lists the phone checks as open:
  - the spotlight's length at Normal and Quick;
  - the skip tap;
  - three attacks in a row not feeling slow;
  - the token burst readable;
  - reduced motion showing none.
