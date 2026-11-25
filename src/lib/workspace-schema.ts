import type { Workspace } from "@/lib/maxhub-types";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

export function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || !Array.isArray(value.groups) || !Array.isArray(value.tasks) || !Array.isArray(value.notes)) {
    return null;
  }
  if (value.groups.length > 200 || value.tasks.length > 2000 || value.notes.length > 1000) return null;
  if (!value.groups.every(isGroup) || !value.tasks.every(isTask) || !value.notes.every(isNote)) return null;

  const groupIds = new Set(value.groups.map((group) => group.id));
  const taskIds = new Set(value.tasks.map((task) => task.id));
  if (value.tasks.some((task) => !groupIds.has(task.groupId))) return null;
  if (value.notes.some((note) =>
    (note.groupId !== null && !groupIds.has(note.groupId)) ||
    (note.taskId !== null && !taskIds.has(note.taskId))
  )) return null;
  return { groups: value.groups, tasks: value.tasks, notes: value.notes };
}

function keepRecent<T extends { deletedAt: string | null }>(items: T[], now: number) {
  const cutoff = now - RETENTION_MS;
  return items.filter((item) => !item.deletedAt || Date.parse(item.deletedAt) > cutoff);
}

export function normalizeWorkspace(workspace: Workspace, now = Date.now()): Workspace {
  const groups = keepRecent(workspace.groups, now);
  const tasks = keepRecent(workspace.tasks, now).filter((task) => groups.some((group) => group.id === task.groupId));
  const groupIds = new Set(groups.map((group) => group.id));
  const taskIds = new Set(tasks.map((task) => task.id));
  return {
    groups,
    tasks,
    notes: keepRecent(workspace.notes, now).filter((note) =>
      (note.groupId === null || groupIds.has(note.groupId)) &&
      (note.taskId === null || taskIds.has(note.taskId))
    ),
  };
}
