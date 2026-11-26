import assert from "node:assert/strict";
import test from "node:test";
import { mergeWorkspaceSnapshots } from "./workspace-sync.mjs";
import { syncWorkspaceRequest } from "./workspace-sync-request.mjs";

const group = { id: "group", name: "Group", updatedAt: "2026-01-01T00:00:00.000Z" };
const task = (id, updatedAt) => ({ id, title: id, groupId: "group", updatedAt });
const workspace = (tasks) => ({
  groups: [group],
  tasks,
  notes: [],
  pages: [{
    id: "notebook-root",
    name: "/",
    icon: "📓",
    parentId: null,
    body: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }],
});

function response(body, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

test("after a 409, a second explicit sync with the refreshed ETag persists the merged snapshot", async () => {
  const localWorkspace = workspace([task("local", "2026-01-03T00:00:00.000Z")]);
  const remoteWorkspace = workspace([task("remote", "2026-01-02T00:00:00.000Z")]);
  let storedWorkspace = remoteWorkspace;
  let storedVersion = "latest";
  const fetcher = async (_url, options = {}) => {
    if (options.method === "PUT") {
      const body = JSON.parse(options.body);
      if (body.version !== storedVersion) return response({ error: "conflict" }, 409);
      storedWorkspace = body.workspace;
      storedVersion = "saved";
      return response({ version: storedVersion, storageMode: "blob" });
    }
    return response({ workspace: storedWorkspace, version: storedVersion, storageMode: "blob" });
  };

  const conflict = await syncWorkspaceRequest({
    workspace: localWorkspace,
    version: "stale",
    hasLocalChanges: true,
    fetcher,
  });
  assert.equal(conflict.status, "conflict");
  assert.deepEqual(storedWorkspace.tasks.map(({ id }) => id), ["remote"]);

  const mergedWorkspace = mergeWorkspaceSnapshots(localWorkspace, conflict.workspace);
  const saved = await syncWorkspaceRequest({
    workspace: mergedWorkspace,
    version: conflict.version,
    hasLocalChanges: true,
    fetcher,
  });

  assert.equal(saved.status, "saved");
  assert.deepEqual(storedWorkspace.tasks.map(({ id }) => id).sort(), ["local", "remote"]);
});

test("sync without local edits reads remote but does not issue a PUT", async () => {
  const calls = [];
  const result = await syncWorkspaceRequest({
    workspace: workspace([]),
    version: "current",
    hasLocalChanges: false,
    fetcher: async (_url, options) => {
      calls.push(options);
      return response({ workspace: workspace([task("remote", "2026-01-01T00:00:00.000Z")]), version: "new", storageMode: "blob" });
    },
  });

  assert.equal(result.status, "pulled");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, undefined);
});
