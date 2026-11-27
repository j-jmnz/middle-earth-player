import { createContext } from "react";

/** The room (logical points) the dock leaves the choice's rows, told to the tray beside it; 0 when the dock has not measured, or the rows are not in a dense dock (dock/budget.ts, rowsRoom). */
export const RowsRoom = createContext(0);
