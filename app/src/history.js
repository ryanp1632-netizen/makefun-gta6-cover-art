// Undo/redo over JSON snapshots of the document (photo pixels live outside the snapshots, so they stay cheap).

export function createHistory(initial, limit = 80) {
  let past = [];
  let future = [];
  let present = JSON.stringify(initial);
  return {
    commit(doc) {
      const next = JSON.stringify(doc);
      if (next === present) return false;
      past.push(present);
      if (past.length > limit) past = past.slice(-limit);
      present = next;
      future = [];
      return true;
    },
    undo() {
      if (!past.length) return null;
      future.push(present);
      present = past.pop();
      return JSON.parse(present);
    },
    redo() {
      if (!future.length) return null;
      past.push(present);
      present = future.pop();
      return JSON.parse(present);
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
