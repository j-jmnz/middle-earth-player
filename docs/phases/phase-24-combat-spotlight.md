# Phase 24 — Combat spotlight

Depends on: phase 23
Blocks: nothing
Can run beside: phases 14, 15, 16, 25 and 26

Plan: `docs/plans/board-ux.md` (user list item 3). Implementer: `implementer` on Sonnet 5.5.

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
  - the banner's beats (`src/play/outcome.ts`, `momentOf`).
- Damage appears on the damage token's count.

## Build

**Sequence at Normal speed** (Quick is ×0.6)

| Time | Beat |
| --- | --- |
| 0–250 ms | The canvas dims under night at 65%. The top bar and dock dim under an RN scrim. The attacker or attackers and the target fly from their slots to the canvas center, side by side, enlarged to about 42% of the canvas height, with a 24 pt gap. Under each, a big pill in Marcellus: the attack strength with the attack icon, or the defense with the defense icon. |
| (+250 ms) | If the attack turned a shadow card, it flips face up beside the enemy before the strike. |
| 250–500 ms | Anticipation: the attacker draws back 10 pt and tilts 4° away. |
| 500–650 ms | The lunge: the attacker moves to touch the target. |
| 650–730 ms | Hit stop: everything holds. A medium impact haptic plays (`tickImpact` in `src/play/haptics.ts`). |
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
- A top layer on the table's Skia canvas (`src/play/spotlight.native.tsx`). It draws:
  - the scrim;
  - the enlarged card pictures, from the images the canvas already holds;
  - the token art;
  - the pills.
- An RN scrim over the top bar and the dock catches the skip tap. Card pictures stay on the canvas (design system).
- The web build (`table-canvas.tsx`, a list) has no spotlight.

## Data

- A pure `clashesOf(prev, next, steps)` in `src/play/clash.ts`. It returns, in order:
  - `[{ attackers: string[], target: string, attack: number, defense: number, damage: number, destroyed: boolean, shadow: string | null, undefended: boolean }]`.
- It reads the same engine steps the banner reads (the strike and attack steps `outcome.ts` and `readout.ts` use). Every number is the engine's.

## Tests

`src/play/clash.test.ts`, on games played the way `src/campaign/combat-flow.test.ts` plays them:
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
- `docs/design-system.md` (Table) gains a Spotlight paragraph and updates Banner and Haptics.
- STATUS.md lists the phone checks as open:
  - the spotlight's length at Normal and Quick;
  - the skip tap;
  - three attacks in a row not feeling slow;
  - the token burst readable;
  - reduced motion showing none.

## Implementer notes (Sonnet 5.5)

**Before you start**
- Read `.cursor/agents/implementer.md` first and follow it. Ignore its `model` line.
- Then read:
  - this file;
  - `docs/plans/board-ux.md`;
  - `docs/design-system.md` (Table);
  - `docs/architecture.md` (Play).
- Implement this phase only.

**What you may change**
- This phase may edit `docs/design-system.md` (Table) for what it changes. That is the exception to "do not restyle screens". `/ux` reviews it.
- No new dependency. Motion is Reanimated, drawing is Skia, gestures are Gesture Handler, haptics are `src/play/haptics.ts`. No `any`.
- Colors come from `tableTokens` (`src/play/tokens.ts`). A hex in a component is a miss.

**Boundaries**
- `src/play` never imports `src/screens`.
- `src/screens` never imports `src/rules`.
- The reducer is the only writer of numbers.

**Code and tests**
- Logic goes in pure `.ts` files with a Vitest next to them. There are no component tests: Vitest runs in node on `*.test.ts`.
- Keep files under about 300 lines and split by behavior.
- Keep every testID. If one moves behind a new control, update the `.maestro/*.yaml` flows that use it.

**When you finish**
- Exit gate: `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm data:check`.
- A cloud session has no phone. List the phone checks as open in `docs/phases/STATUS.md`; do not mark them done.
- Report back when the exit is green. The main session runs `reviewer` and `ux`.

**Phase-specific**
- Every duration comes from `motion-tokens.ts`. Add the spotlight's beats there. The total stays at or under 1.6 s at Normal.
- Archery damage and damage from a card effect are not attacks and get no spotlight. The banner covers them.
- An attack that is cancelled, or that ends without a damage step, gets no spotlight.
- Keep `table-canvas.native.tsx` under 300 lines. The spotlight is its own file, given the images and the clashes as props.

## Handover from phase 22

- The dock's readout, armed line, buttons and quiet pills are pinned to the dock's foot (`src/play/table-dock.tsx`); only the step, title and folded lines above them scroll. The scrim over the dock covers that whole column; the readout block is still what the choice tray's foot is measured against (`onBlock`).
- The quest band is gone from the command column; the quest card's preview carries the stage name and progress.
- A card's edge shows at most two effect pills and "+n" (`badgeSplit` in `src/play/card-effects.ts`); the enlarged cards in the spotlight read the same split unless the spotlight draws its own.
