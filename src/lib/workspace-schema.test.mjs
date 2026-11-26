import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkspace } from "./workspace-schema.ts";

const timestamp = "2026-01-01T00:00:00.000Z";
const group = {
  id: "group",
  name: "Group",
  color: "#47b8ec",
  archived: false,
  order: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
const task = {
  id: "task",
  title: "Task",
  groupId: "group",
  dueDate: null,
  priority: "normal",
  color: "#47b8ec",
  completed: false,
  archived: false,
  subtasks: [],
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
};
const note = (id, taskId = null) => ({
  id,
  title: id,
  body: `# ${id}`,
  groupId: taskId ? "group" : null,
  taskId,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
});
const page = (id, parentId, name = id) => ({
  id,
  name,
  icon: "📄",
  parentId,
  body: "",
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
});

test("legacy standalone notes migrate to root pages while task notes stay attached", () => {
  const parsed = parseWorkspace({
    groups: [group],
    tasks: [task],
    notes: [note("legacy-page"), note("task-note", "task")],
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.pages.map(({ id, name, parentId, body }) => ({ id, name, parentId, body })), [
    { id: "notebook-root", name: "/", parentId: null, body: "" },
    { id: "legacy-page", name: "legacy-page", parentId: "notebook-root", body: "# legacy-page" },
  ]);
  assert.deepEqual(parsed.notes.map(({ id }) => id), ["task-note"]);
});

test("notebook rejects missing parents and cyclic parent relationships", () => {
  const base = { groups: [], tasks: [], notes: [] };
  assert.equal(parseWorkspace({
    ...base,
    pages: [page("notebook-root", null, "/"), page("child", "missing")],
  }), null);
  assert.equal(parseWorkspace({
    ...base,
    pages: [page("notebook-root", null, "/"), page("first", "second"), page("second", "first")],
  }), null);
});
