// The one write an open makes (a drop, or the stamp of a game that was current): made once for each session the hook holds. React Activity runs a hidden
// table's effects again when it is shown (table, Rules glossary, back), and the held session is the one read at open: a second write would put the moves of
// the open over the moves played since. The sessions written are remembered by identity, so a session handed out again writes nothing.
const WRITTEN = new WeakSet<object>();

/** Runs `write` for this session the first time and never again; a null session writes nothing. */
export function writeOnce<S extends object>(session: S | null, write: (session: S) => void): void {
  if (!session || WRITTEN.has(session)) return;
  WRITTEN.add(session);
  write(session);
}
