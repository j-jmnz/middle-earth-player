// The web build's table (the phone's file is table-canvas.native.tsx, which draws with Skia). Skia on the web needs CanvasKit loaded first
// (ui/skia-web.ts), so this entry point is a gate: until it is ready (and if it never loads) the table is the reader table, the same list a
// screen reader or Table as a list gets on the phone, and then it imports the Skia file by its explicit path. No Skia module is evaluated
// during the static render or before CanvasKit.
import { lazy, memo, Suspense } from "react";

import { useCanvasKit } from "../../ui/skia-web.ts";
import { ReaderTable } from "./reader-table.tsx";
import { RowFeetProbe } from "./row-feet-probe.tsx";
import type { TableCanvasProps } from "./table-canvas-types.ts";

const Drawn = lazy(() => import("./table-canvas.native.tsx").then((module) => ({ default: module.TableCanvas })));

// The list while the canvas is not there: the rows' feet are told as the canvas tells them, and the reader table lists the cards. The screen
// passes the seed whenever this gate is not ready (choice/use-table-choice.ts).
function ListTable(props: TableCanvasProps) {
  return (
    <>
      <RowFeetProbe {...props} />
      {props.readerSeed ? <ReaderTable {...props} readerSeed={props.readerSeed} /> : null}
    </>
  );
}

function TableOrList(props: TableCanvasProps) {
  const status = useCanvasKit();
  if (status !== "ready") return <ListTable {...props} />;
  return (
    <Suspense fallback={<ListTable {...props} />}>
      <Drawn {...props} />
    </Suspense>
  );
}

export const TableCanvas = memo(TableOrList);
