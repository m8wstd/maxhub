import assert from "node:assert/strict";
import test from "node:test";
import { canKeepaliveWorkspaceSave, workspaceSaveDelay } from "./autosave-policy.mjs";

test("new tasks bypass the debounce while later edits retain it", () => {
  assert.equal(workspaceSaveDelay(true), 0);
  assert.equal(workspaceSaveDelay(false), 700);
});

test("keepalive is used only when the serialized snapshot fits the browser limit", () => {
  assert.equal(canKeepaliveWorkspaceSave("a".repeat(60 * 1024)), true);
  assert.equal(canKeepaliveWorkspaceSave("a".repeat(60 * 1024 + 1)), false);
  assert.equal(canKeepaliveWorkspaceSave("ação"), true);
});
