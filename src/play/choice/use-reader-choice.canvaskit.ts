// The reader choice on the web and the desktop (use-reader-choice.ts is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only).
// The phone's hook, plus the seed the list needs while CanvasKit loads: the web table is the reader table's list until it has (canvas/table-canvas.tsx), which needs the
// seed with no reader on. The phone has Skia built in and never lists the table for that.
import { useCanvasKit } from "../../ui/skia/skia-web.ts";
import { useReaderChoice as usePhoneReaderChoice, type ReaderChoice } from "./use-reader-choice";

export type { ReaderChoice };

export function useReaderChoice(props: Parameters<typeof usePhoneReaderChoice>[0]): ReaderChoice {
  const canvasReady = useCanvasKit() === "ready";
  const choice = usePhoneReaderChoice(props);
  const { sheet, cards } = props;
  return canvasReady || choice.readerSeed != null ? choice : { ...choice, readerSeed: { sheet, cards } };
}
