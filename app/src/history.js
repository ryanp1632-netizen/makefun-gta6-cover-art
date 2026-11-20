// Undo / redo over JSON snapshots of the editable state (captions, layout, grade and panel crops).

export function createHistory(limit = 80) {
  const past = [];
  const future = [];
  return {
    /** Records the state before a change. */
    record(snapshot) {
      const s = JSON.stringify(snapshot);
      if (past[past.length - 1] === s) return;
      past.push(s);
      if (past.length > limit) past.shift();
      future.length = 0;
    },
    undo(current) {
      if (!past.length) return null;
      future.push(JSON.stringify(current));
      return JSON.parse(past.pop());
    },
    redo(current) {
      if (!future.length) return null;
      past.push(JSON.stringify(current));
      return JSON.parse(future.pop());
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
  };
}
