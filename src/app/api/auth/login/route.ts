import { NextResponse } from "next/server";
import { clearSessionCookie, isAuthConfigured, isSameOrigin, setSessionCookie, verifyPassword } from "@/lib/auth";
import { readRequestBody, RequestBodyTooLargeError } from "@/lib/request-body";

const MAX_LOGIN_BYTES = 8_192;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  }
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Configure MAXHUB_PASSWORD_HASH e MAXHUB_SESSION_SECRET no servidor." },
      { status: 503 },
    );
  }

  try {
    const bodyText = await readRequestBody(request, MAX_LOGIN_BYTES);
    const body: unknown = JSON.parse(bodyText);
    const password =
      typeof body === "object" &&
      body !== null &&
      "password" in body &&
      typeof body.password === "string"
        ? body.password
        : "";
    if (!password || password.length > 256 || !verifyPassword(password)) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    await setSessionCookie();
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Solicitação inválida." }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Formato de solicitação inválido." }, { status: 400 });
    }
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Não foi possível iniciar a sessão." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 403 });
  }
  await clearSessionCookie();
  return NextResponse.json({ authenticated: false });
}
