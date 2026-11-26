import type { Workspace } from "./maxhub-types";

type SyncResult =
  | { status: "unauthorized" }
  | { status: "conflict" | "pulled"; workspace: Workspace; version: string | null; storageMode: "blob" | "local-dev" }
  | { status: "saved"; version: string | null; storageMode: "blob" | "local-dev" };

export function syncWorkspaceRequest(options: {
  workspace: Workspace;
  version: string | null;
  hasLocalChanges: boolean;
  fetcher?: typeof fetch;
}): Promise<SyncResult>;
