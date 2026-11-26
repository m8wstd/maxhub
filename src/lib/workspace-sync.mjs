export function canStartWorkspaceSync(status) {
  return status !== "syncing";
}

export function mergeWorkspaceSnapshots(local, remote) {
  function mergeById(left, right) {
    const items = new Map();
    for (const item of [...right, ...left]) {
      const current = items.get(item.id);
      if (!current || item.updatedAt >= current.updatedAt) items.set(item.id, item);
    }
    return [...items.values()];
  }

  const groups = mergeById(local.groups, remote.groups);
  const tasks = mergeById(local.tasks, remote.tasks);
  const notes = mergeById(local.notes, remote.notes);
  const pages = mergeById(local.pages ?? [], remote.pages ?? []);
  const sameItems = (left, right) => left.length === right.length && left.every((item) => right.includes(item));
  if (
    sameItems(local.groups, groups) &&
    sameItems(local.tasks, tasks) &&
    sameItems(local.notes, notes) &&
    sameItems(local.pages ?? [], pages)
  ) {
    return local;
  }
  return { groups, tasks, notes, pages };
}
