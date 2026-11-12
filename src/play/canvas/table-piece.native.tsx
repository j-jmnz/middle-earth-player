// One card of the table as the canvas draws it: its body, the marks in its shape and the upright layer of badges, tokens and pills, moved
// by the card's motion. `TablePiece` is memoized on `samePiece` (table-piece.ts), so a render of the canvas rebuilds only the cards whose
// drawing changed (docs/architecture.md, Performance). The leaving ghosts draw their body through `drawBody` too.
import { Group } from "@shopify/react-native-skia";
import { memo } from "react";

import { Moving } from "../motion/card-motion.native.tsx";
import { CardMarks, Glow, PickRing } from "./card-marks.native.tsx";
import { Badges, CardBody, HeldMark, NotAppliedMark, StackMark, SuccessMedallion, Tokens } from "./pieces.native.tsx";
import { badgeReach, CombatPill, CurrentQuestMark, DelayedMark, DeterminedMarkView, EngagementMark, FireMarkView, OptionMarkView, PlaceMarkView, ShipLossView, StageMarks, UnderMarkView } from "./mark-pieces.native.tsx";
import { sphereIcon } from "../../ui/icon-map.ts";
import { Pile } from "./pile-piece.native.tsx";
import { type CardSlot } from "../layout/layout.ts";
import { shownBounds } from "../layout/hits.ts";
import { sphereRing } from "./table-canvas-views.ts";
import { samePiece, type BodyProps, type PieceProps } from "./table-piece.ts";

/**
 * The card itself (it turns when exhausted), with the glow of the open moment under it, and what is drawn upright on it: tokens, effects,
 * the open moment's marks. `slot` is passed apart from `p.slot` so the back of a card that flips is drawn from the same props face down.
 */
export function drawBody(p: BodyProps, slot: CardSlot, dim: boolean) {
  const { image, name, fonts, backs, t, s } = p;
  // A pile, or the top of the deck the rules let the player play (Gandalf): face up and picked like a hand card.
  if (slot.kind === "pile" || slot.zone === "deck") {
    // A discard pile holding a card the seat may play from it (Elven-light) glows and wears the play mark; its list plays the card.
    const playable = slot.kind === "pile" && p.tappable;
    const pile = <Pile slot={slot.zone === "deck" && slot.kind === "card" ? { ...slot, faceDown: false } : slot} image={image} fan={p.fan} name={name} fonts={fonts} label playable={playable} backs={backs} t={t} s={s} />;
    return playable ? (
      <Group>
        <Glow slot={slot} picked={false} t={t} s={s} />
        {pile}
      </Group>
    ) : (
      pile
    );
  }
  const encounterBack = slot.kind === "shadow" || slot.zone === "staging" || slot.zone === "engaged" || slot.zone === "encounterDeck";
  const picked = p.picked > 0;
  const glows = slot.kind === "card" && (picked || p.tappable);
  return (
    <Group opacity={dim ? 0.35 : 1}>
      {glows ? <Glow slot={slot} picked={picked} t={t} s={s} /> : null}
      <CardBody slot={slot} image={image} name={name} sphere={sphereIcon(p.sphere)} fonts={fonts} encounterBack={encounterBack} backs={backs} t={t} s={s} />
    </Group>
  );
}

// What is drawn in the card's shape, inside its turned group: the accent edge, the picked edge, the veil, the beat ring.
function drawFrame(p: PieceProps) {
  const { slot } = p;
  if (slot.kind === "pile") return null;
  const card = slot.kind === "card";
  return <CardMarks slot={slot} tappable={card && p.tappable} picked={card ? p.picked : 0} dimmed={p.dimmed} beat={p.beat} t={p.t} s={p.s} veiled={p.veiledHand} />;
}

// What stays upright over the card: badges, tokens, effect pills, the check ring, the open moment's number.
function drawOverlay(p: PieceProps) {
  const { slot, info, fonts, tokens, t, s, contrast } = p;
  if (slot.kind === "pile") return null;
  // The Stormcaller's stage keeps its strip and tokens in the part its area's cards leave uncovered.
  const rect = shownBounds(slot);
  // The veil is drawn in the card's turned group, under this upright layer, so a veiled card's tokens and marks are faded
  // here instead; the option pill stays bright.
  const veiled = p.dimmed;
  return (
    <Group>
      <Group opacity={veiled ? 0.55 : 1}>
        {info ? <Badges slot={slot} rect={rect} effects={info.effects} willpower={info.willpower} questPoints={info.questPoints} stageLoses={info.stageLoses} owner={p.owner} fonts={fonts} images={tokens} t={t} s={s} contrast={contrast} /> : null}
        {info?.combat ? <CombatPill rect={rect} combat={info.combat} fonts={fonts} t={t} s={s} /> : null}
        {info?.engagement ? <EngagementMark rect={rect} cost={info.engagement.cost} engages={info.engagement.engages} fonts={fonts} images={tokens} t={t} s={s} /> : null}
        {info?.fire ? <FireMarkView rect={rect} mark={info.fire} fonts={fonts} images={tokens} t={t} s={s} /> : null}
        {info?.side?.loses ? <FireMarkView rect={rect} mark={info.side.loses} fonts={fonts} images={tokens} t={t} s={s} /> : null}
        {info?.side?.current ? <CurrentQuestMark rect={rect} clear={badgeReach(info.effects, fonts, s)} fonts={fonts} t={t} s={s} /> : null}
        {info?.determined ? <DeterminedMarkView rect={rect} word={info.determined.word} clear={badgeReach(info.effects, fonts, s)} fonts={fonts} t={t} s={s} /> : null}
        {info?.loss ? <ShipLossView rect={rect} mark={info.loss} fonts={fonts} t={t} s={s} /> : null}
        {info?.place ? <PlaceMarkView rect={rect} mark={info.place} t={t} s={s} /> : null}
        {info?.under ? <UnderMarkView rect={rect} mark={info.under} fonts={fonts} t={t} s={s} /> : null}
        {info?.delayed ? <DelayedMark rect={rect} t={t} s={s} /> : null}
        {p.stageMarks ? <StageMarks rect={rect} pill={p.stageMarks.pill} apart={p.stageMarks.apart} fonts={fonts} t={t} s={s} /> : null}
        <Tokens slot={slot} rect={rect} images={tokens} fonts={fonts} t={t} s={s} ring={slot.resources > 0 ? sphereRing(p.sphere, t) : null} contrast={contrast} />
        {p.inactive ? <NotAppliedMark rect={rect} t={t} s={s} /> : null}
        {slot.kind === "card" && slot.faceDown && slot.held ? <HeldMark rect={rect} t={t} s={s} /> : null}
        {slot.stack != null ? <StackMark slot={slot} fonts={fonts} t={t} s={s} /> : null}
      </Group>
      {slot.success != null && slot.success > 0 ? <SuccessMedallion slot={slot} fonts={fonts} t={t} s={s} /> : null}
      {slot.kind === "card" ? <PickRing rect={rect} picked={p.picked} share={p.share} dimmed={veiled} fonts={fonts} t={t} s={s} /> : null}
      {slot.kind === "card" && p.optionMark ? <OptionMarkView rect={rect} mark={p.optionMark} fonts={fonts} images={tokens} t={t} s={s} /> : null}
    </Group>
  );
}

function Piece(p: PieceProps) {
  // A card that flips shows its printed back until the midpoint of the turn.
  const back = p.motion.flip ? drawBody(p, { ...p.slot, faceDown: true }, false) : undefined;
  return (
    <Moving slot={p.slot} motion={p.motion} clock={p.clock} back={back} frame={drawFrame(p)} overlay={drawOverlay(p)}>
      {drawBody(p, p.slot, p.lifted)}
    </Moving>
  );
}

/** One card, drawn again only when `samePiece` says what it draws has changed. The caller gives it a key (`kind:id`). */
export const TablePiece = memo(Piece, samePiece);
