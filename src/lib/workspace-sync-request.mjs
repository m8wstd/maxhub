export async function syncWorkspaceRequest({ workspace, version, hasLocalChanges, fetcher = fetch }) {
  const response = hasLocalChanges
    ? await fetcher("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, version }),
      })
    : await fetcher("/api/data", { cache: "no-store" });

  if (response.status === 401) return { status: "unauthorized" };

  if (hasLocalChanges && response.status === 409) {
    const latestResponse = await fetcher("/api/data", { cache: "no-store" });
    if (latestResponse.status === 401) return { status: "unauthorized" };
    const latest = await latestResponse.json();
    if (!latestResponse.ok) throw new Error(latest.error ?? "Não foi possível carregar a versão remota.");
    return {
      status: "conflict",
      workspace: latest.workspace,
      version: latest.version,
      storageMode: latest.storageMode,
    };
  }

  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Falha na sincronização.");

  return hasLocalChanges
    ? { status: "saved", version: result.version, storageMode: result.storageMode }
    : {
        status: "pulled",
        workspace: result.workspace,
        version: result.version,
        storageMode: result.storageMode,
      };
}
