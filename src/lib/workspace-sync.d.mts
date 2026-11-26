import type { Workspace } from "./maxhub-types";

export function canStartWorkspaceSync(status: "saved" | "pending" | "syncing" | "error" | "conflict"): boolean;
export function mergeWorkspaceSnapshots(local: Workspace, remote: Workspace): Workspace;
