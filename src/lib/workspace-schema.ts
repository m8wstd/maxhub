import type { Workspace } from "@/lib/maxhub-types";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const NOTEBOOK_ROOT_ID = "notebook-root";
const DEFAULT_NOTEBOOK_ROOT: Workspace["pages"][number] = {
  id: NOTEBOOK_ROOT_ID,
  name: "/",
  icon: "📓",
  parentId: null,
  body: "",
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  deletedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

function validDate(value: unknown) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isSubtask(value: unknown): value is Workspace["tasks"][number]["subtasks"][number] {
  return (
    isRecord(value) &&
    isString(value.id, 100) &&
    value.id.length > 0 &&
    isString(value.title, 300) &&
    typeof value.completed === "boolean"
  );
}

function isGroup(value: unknown): value is Workspace["groups"][number] {
  return (
    isRecord(value) &&
    isString(value.id, 100) &&
    value.id.length > 0 &&
    isString(value.name, 120) &&
    value.name.trim().length > 0 &&
    isColor(value.color) &&
    typeof value.archived === "boolean" &&
    typeof value.order === "number" &&
    Number.isFinite(value.order) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.deletedAt === null || isTimestamp(value.deletedAt))
  );
}

function isTask(value: unknown): value is Workspace["tasks"][number] {
  return (
    isRecord(value) &&
    isString(value.id, 100) &&
    value.id.length > 0 &&
    isString(value.title, 500) &&
    isString(value.groupId, 100) &&
    value.groupId.length > 0 &&
    validDate(value.dueDate) &&
    ["low", "normal", "high"].includes(String(value.priority)) &&
    isColor(value.color) &&
    typeof value.completed === "boolean" &&
    typeof value.archived === "boolean" &&
    Array.isArray(value.subtasks) &&
    value.subtasks.length <= 100 &&
    value.subtasks.every(isSubtask) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.deletedAt === null || isTimestamp(value.deletedAt))
  );
}

function isNote(value: unknown): value is Workspace["notes"][number] {
  return (
    isRecord(value) &&
    isString(value.id, 100) &&
    value.id.length > 0 &&
    isString(value.title, 200) &&
    isString(value.body, 20_000) &&
    (value.groupId === null || (isString(value.groupId, 100) && value.groupId.length > 0)) &&
    (value.taskId === null || (isString(value.taskId, 100) && value.taskId.length > 0)) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.deletedAt === null || isTimestamp(value.deletedAt))
  );
}

function isNotebookPage(value: unknown): value is Workspace["pages"][number] {
  return (
    isRecord(value) &&
    isString(value.id, 100) &&
    value.id.length > 0 &&
    isString(value.name, 200) &&
    value.name.trim().length > 0 &&
    isString(value.icon, 32) &&
    value.icon.trim().length > 0 &&
    (value.parentId === null || (isString(value.parentId, 100) && value.parentId.length > 0)) &&
    isString(value.body, 100_000) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    (value.deletedAt === null || isTimestamp(value.deletedAt))
  );
}

export function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || !Array.isArray(value.groups) || !Array.isArray(value.tasks) || !Array.isArray(value.notes)) {
    return null;
  }
  if ("pages" in value && !Array.isArray(value.pages)) return null;
  const rawPages = Array.isArray(value.pages) ? value.pages : [];
  if (value.groups.length > 200 || value.tasks.length > 2000 || value.notes.length > 1000 || rawPages.length > 1000) return null;
  if (!value.groups.every(isGroup) || !value.tasks.every(isTask) || !value.notes.every(isNote)) return null;
  if (!rawPages.every(isNotebookPage)) return null;

  const notes = value.notes as Workspace["notes"];
  const pages = [...rawPages] as Workspace["pages"];
  if (!pages.some((page) => page.id === NOTEBOOK_ROOT_ID)) pages.unshift(DEFAULT_NOTEBOOK_ROOT);
  const pageIds = new Set(pages.map((page) => page.id));
  if (pageIds.size !== pages.length) return null;
  for (const note of notes) {
    if (note.taskId !== null || note.deletedAt !== null || pageIds.has(note.id)) continue;
    pages.push({
      id: note.id,
      name: note.title.trim() || "Sem título",
      icon: "📄",
      parentId: NOTEBOOK_ROOT_ID,
      body: note.body,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: null,
    });
    pageIds.add(note.id);
  }
  const remainingNotes = notes.filter((note) => note.taskId !== null || note.deletedAt !== null);
  if (pages.length > 1000) return null;

  const groupIds = new Set(value.groups.map((group) => group.id));
  const taskIds = new Set(value.tasks.map((task) => task.id));
  if (value.tasks.some((task) => !groupIds.has(task.groupId))) return null;
  if (value.notes.some((note) =>
    (note.groupId !== null && !groupIds.has(note.groupId)) ||
    (note.taskId !== null && !taskIds.has(note.taskId))
  )) return null;

  const rootPages = pages.filter((page) => page.parentId === null);
  if (
    rootPages.length !== 1 ||
    rootPages[0].id !== NOTEBOOK_ROOT_ID ||
    rootPages[0].name !== "/" ||
    rootPages[0].deletedAt !== null
  ) return null;
  for (const page of pages) {
    if (page.parentId !== null && (!pageIds.has(page.parentId) || page.parentId === page.id)) return null;
    const ancestors = new Set([page.id]);
    let parentId = page.parentId;
    while (parentId !== null) {
      if (ancestors.has(parentId)) return null;
      ancestors.add(parentId);
      parentId = pages.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
  }

  return { groups: value.groups, tasks: value.tasks, notes: remainingNotes, pages };
}

function keepRecent<T extends { deletedAt: string | null }>(items: T[], now: number) {
  const cutoff = now - RETENTION_MS;
  return items.filter((item) => !item.deletedAt || Date.parse(item.deletedAt) > cutoff);
}

export function normalizeWorkspace(workspace: Workspace, now = Date.now()): Workspace {
  const groups = keepRecent(workspace.groups, now);
  const tasks = keepRecent(workspace.tasks, now).filter((task) => groups.some((group) => group.id === task.groupId));
  const recentPages = keepRecent(workspace.pages, now);
  const pagesById = new Map(recentPages.map((page) => [page.id, page]));
  const rootId = DEFAULT_NOTEBOOK_ROOT.id;
  const pages = recentPages.map((page) => {
    if (page.id === rootId || page.parentId === null) return page;
    const parent = pagesById.get(page.parentId);
    if (!parent || (parent.deletedAt !== null && page.deletedAt === null)) {
      return { ...page, parentId: rootId, updatedAt: new Date(now).toISOString() };
    }
    return page;
  });
  const groupIds = new Set(groups.map((group) => group.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  return {
    groups,
    tasks,
    notes: keepRecent(workspace.notes, now).filter((note) =>
      (note.groupId === null || groupIds.has(note.groupId)) &&
      (note.taskId === null || taskIds.has(note.taskId))
    ),
    pages,
  };
}
