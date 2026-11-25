// The web build's table (the phone's file is table-canvas.native.tsx, which draws with Skia). Skia on the web needs CanvasKit loaded first
// (ui/skia/skia-web.ts), so this entry point is a gate (it also starts the load, if nothing has): until it is ready (and if it never loads) the table is the reader table, the same list a
// screen reader or Table as a list gets on the phone, and then it imports the Skia file by its explicit path. No Skia module is evaluated
// during the static render or before CanvasKit.
import { lazy, memo, Suspense, useEffect } from "react";

import { startCanvasKit, useCanvasKit } from "../../ui/skia/skia-web.ts";
import { ReaderTable } from "./reader-table.tsx";
import { RowFeetProbe } from "./row-feet-probe.tsx";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { relayKeys } from "./table-keys.ts";

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

// The keys the table maps, wherever the focus is (table-keys.ts), while the table is on screen.
function TableKeys() {
  useEffect(() => relayKeys(), []);
  return null;
}

function TableOrList(props: TableCanvasProps) {
  const status = useCanvasKit();
  // The splash starts the load after its first frame, but it may be gone before that frame comes; a table that mounts with the load idle starts it itself.
  useEffect(() => {
    startCanvasKit();
  }, []);
  return (
    <>
      <TableKeys />
      {status !== "ready" ? (
        <ListTable {...props} />
      ) : (
        <Suspense fallback={<ListTable {...props} />}>
          <Drawn {...props} />
        </Suspense>
      )}
    </>
  );
}

export const TableCanvas = memo(TableOrList);
