import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  put,
} from "@vercel/blob";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Workspace } from "@/lib/maxhub-types";
import { normalizeWorkspace, parseWorkspace } from "@/lib/workspace-schema";

const BLOB_PATH = "maxhub/workspace.json";
const MAX_SNAPSHOT_BYTES = 1_000_000;
const LOCAL_WORKSPACE_PATH = join(process.cwd(), ".maxhub-dev", "workspace.json");
let localWriteQueue = Promise.resolve();

export function emptyWorkspace(): Workspace {
  const now = new Date().toISOString();
  return {
    groups: [
      { id: randomUUID(), name: "Faculdade", color: "#47b8ec", archived: false, order: 0, createdAt: now, updatedAt: now, deletedAt: null },
      { id: randomUUID(), name: "Projetos", color: "#9b8cf5", archived: false, order: 1, createdAt: now, updatedAt: now, deletedAt: null },
    ],
    tasks: [],
    notes: [],
  };
}

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function localDevStoreEnabled() {
  return process.env.NODE_ENV === "development" && !blobConfigured();
}

function versionFor(body: string) {
  return createHash("sha256").update(body).digest("base64url");
}

async function readLocalWorkspace() {
  let body: string;
  try {
    body = await readFile(LOCAL_WORKSPACE_PATH, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { workspace: emptyWorkspace(), version: null, storageMode: "local-dev" as const };
    }
    throw error;
  }
  if (Buffer.byteLength(body) > MAX_SNAPSHOT_BYTES) throw new Error("Workspace snapshot exceeds the size limit.");
  const parsed: unknown = JSON.parse(body);
  const workspace = parseWorkspace(parsed);
  if (!workspace) throw new Error("Workspace snapshot has an invalid format.");
  return {
    workspace: normalizeWorkspace(workspace),
    version: versionFor(body),
    storageMode: "local-dev" as const,
  };
}

async function writeLocalWorkspace(workspace: Workspace, version: string | null) {
  const normalized = normalizeWorkspace(workspace);
  const body = JSON.stringify(normalized);
  if (Buffer.byteLength(body) > MAX_SNAPSHOT_BYTES) {
    throw new Error("Workspace snapshot exceeds the size limit.");
  }

  const previousWrite = localWriteQueue;
  let releaseWrite!: () => void;
  localWriteQueue = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await previousWrite;
  try {
    const current = await readLocalWorkspace();
    if (current.version !== version) return { conflict: true as const };

    const directory = join(process.cwd(), ".maxhub-dev");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = join(directory, `${randomUUID()}.tmp`);
    await writeFile(temporaryPath, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporaryPath, LOCAL_WORKSPACE_PATH);
    return { version: versionFor(body), storageMode: "local-dev" as const };
  } finally {
    releaseWrite();
  }
}

export async function readWorkspace() {
  if (!blobConfigured()) {
    if (localDevStoreEnabled()) return readLocalWorkspace();
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  try {
    const result = await get(BLOB_PATH, { access: "private", useCache: false });
    if (result === null) {
      return { workspace: emptyWorkspace(), version: null, storageMode: "blob" as const };
    }
    if (result.statusCode !== 200) throw new Error("Workspace blob returned no content.");
    if (result.blob.size > MAX_SNAPSHOT_BYTES) throw new Error("Workspace snapshot exceeds the size limit.");
    const parsed: unknown = await new Response(result.stream).json();
    const workspace = parseWorkspace(parsed);
    if (!workspace) throw new Error("Workspace snapshot has an invalid format.");
    return { workspace: normalizeWorkspace(workspace), version: result.blob.etag, storageMode: "blob" as const };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { workspace: emptyWorkspace(), version: null, storageMode: "blob" as const };
    }
    throw error;
  }
}

export async function writeWorkspace(workspace: Workspace, version: string | null) {
  if (!blobConfigured()) {
    if (localDevStoreEnabled()) return writeLocalWorkspace(workspace, version);
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  const normalized = normalizeWorkspace(workspace);
  const body = JSON.stringify(normalized);
  if (Buffer.byteLength(body) > MAX_SNAPSHOT_BYTES) {
    throw new Error("Workspace snapshot exceeds the size limit.");
  }

  try {
    const result = await put(BLOB_PATH, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: version === null ? false : true,
      contentType: "application/json",
      ...(version ? { ifMatch: version } : {}),
    });
    return { version: result.etag, storageMode: "blob" as const };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return { conflict: true as const };
    if (version === null) {
      const latest = await readWorkspace();
      if (latest.version) return { conflict: true as const };
    }
    throw error;
  }
}
