import assert from "node:assert/strict";
import test from "node:test";
import { canStartWorkspaceSync, mergeWorkspaceSnapshots } from "./workspace-sync.mjs";

const group = { id: "group", name: "Group", updatedAt: "2026-01-01T00:00:00.000Z" };
const task = (id, updatedAt) => ({ id, title: id, groupId: "group", updatedAt });

test("sync is allowed for clean pulls and pending/error/conflict retries, but not while running", () => {
  assert.equal(canStartWorkspaceSync("saved"), true);
  assert.equal(canStartWorkspaceSync("syncing"), false);
  assert.equal(canStartWorkspaceSync("pending"), true);
  assert.equal(canStartWorkspaceSync("error"), true);
  assert.equal(canStartWorkspaceSync("conflict"), true);
});

test("conflict merge keeps local-only and remote-only records and prefers newest edits", () => {
  const page = (id, name, updatedAt) => ({
    id,
    name,
    parentId: id === "notebook-root" ? null : "notebook-root",
    updatedAt,
  });
  const local = {
    groups: [group],
    tasks: [task("shared", "2026-01-03T00:00:00.000Z"), task("local", "2026-01-02T00:00:00.000Z")],
    notes: [],
    pages: [page("notebook-root", "/", "2026-01-01T00:00:00.000Z"), page("local-page", "Local", "2026-01-02T00:00:00.000Z")],
  };
  const remote = {
    groups: [group],
    tasks: [task("shared", "2026-01-02T00:00:00.000Z"), task("remote", "2026-01-04T00:00:00.000Z")],
    notes: [],
    pages: [page("notebook-root", "/", "2026-01-01T00:00:00.000Z"), page("remote-page", "Remote", "2026-01-04T00:00:00.000Z")],
  };

  const merged = mergeWorkspaceSnapshots(local, remote);

  assert.deepEqual(merged.tasks, [
    task("shared", "2026-01-03T00:00:00.000Z"),
    task("remote", "2026-01-04T00:00:00.000Z"),
    task("local", "2026-01-02T00:00:00.000Z"),
  ]);
  assert.deepEqual(merged.pages, [
    page("notebook-root", "/", "2026-01-01T00:00:00.000Z"),
    page("remote-page", "Remote", "2026-01-04T00:00:00.000Z"),
    page("local-page", "Local", "2026-01-02T00:00:00.000Z"),
  ]);
});

test("unchanged snapshots retain the local reference", () => {
  const local = { groups: [group], tasks: [], notes: [], pages: [] };
  assert.equal(mergeWorkspaceSnapshots(local, structuredClone(local)), local);
});
