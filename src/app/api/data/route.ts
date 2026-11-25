import { NextResponse } from "next/server";
import { isAuthenticated, isSameOrigin } from "@/lib/auth";
import { readWorkspace, writeWorkspace } from "@/lib/workspace-store";
import { parseWorkspace } from "@/lib/workspace-schema";
import { readRequestBody, RequestBodyTooLargeError } from "@/lib/request-body";

const MAX_REQUEST_BYTES = 1_100_000;

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  try {
    const data = await readWorkspace();
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Workspace read failed:", error);
    return NextResponse.json(
      { error: "Armazenamento indisponível. Configure um Blob privado na Vercel." },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Os dados excedem o limite permitido." }, { status: 413 });
  }

  try {
    const bodyText = await readRequestBody(request, MAX_REQUEST_BYTES);
    const body: unknown = JSON.parse(bodyText);
    if (
      typeof body !== "object" ||
      body === null ||
      !("workspace" in body) ||
      !("version" in body) ||
      (body.version !== null && (typeof body.version !== "string" || body.version.length > 200))
    ) {
      return NextResponse.json({ error: "Formato de sincronização inválido." }, { status: 400 });
    }
    const workspace = parseWorkspace(body.workspace);
    if (!workspace) {
      return NextResponse.json({ error: "Os dados não passaram pela validação." }, { status: 400 });
    }

    const result = await writeWorkspace(workspace, body.version);
    if ("conflict" in result) {
      return NextResponse.json({ error: "Conflito de sincronização." }, { status: 409 });
    }
    return NextResponse.json(
      { version: result.version, storageMode: result.storageMode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Os dados excedem o limite permitido." }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Formato de sincronização inválido." }, { status: 400 });
    }
    console.error("Workspace write failed:", error);
    return NextResponse.json(
      { error: "Não foi possível sincronizar os dados com o armazenamento." },
      { status: 503 },
    );
  }
}
