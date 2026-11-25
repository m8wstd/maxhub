import "server-only";

import { createHmac, timingSafeEqual, scryptSync } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "maxhub_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;

export type AuthConfigurationIssue =
  | "password_hash_missing"
  | "password_hash_invalid_format"
  | "session_secret_missing"
  | "session_secret_too_short";

function sessionSecret() {
  const secret = process.env.MAXHUB_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MAXHUB_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function passwordHash() {
  const configured = process.env.MAXHUB_PASSWORD_HASH;
  if (!configured) {
    throw new Error("MAXHUB_PASSWORD_HASH is not configured.");
  }
  const [algorithm, salt, hash] = configured.split("$");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hash ||
    !/^[\da-f]{32}$/i.test(salt) ||
    !/^[\da-f]{128}$/i.test(hash)
  ) {
    throw new Error("MAXHUB_PASSWORD_HASH has an invalid format.");
  }
  return { salt, hash };
}

export function getAuthConfigurationIssue(): AuthConfigurationIssue | null {
  const configuredHash = process.env.MAXHUB_PASSWORD_HASH;
  if (!configuredHash) return "password_hash_missing";

  const [algorithm, salt, hash] = configuredHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hash ||
    !/^[\da-f]{32}$/i.test(salt) ||
    !/^[\da-f]{128}$/i.test(hash)
  ) {
    return "password_hash_invalid_format";
  }

  const secret = process.env.MAXHUB_SESSION_SECRET;
  if (!secret) return "session_secret_missing";
  if (secret.length < 32) return "session_secret_too_short";

  return null;
}

export function isAuthConfigured() {
  return getAuthConfigurationIssue() === null;
}

export function verifyPassword(password: string) {
  const { salt, hash } = passwordHash();
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function credentialVersion() {
  return createHmac("sha256", sessionSecret())
    .update(process.env.MAXHUB_PASSWORD_HASH ?? "")
    .digest("base64url");
}

export function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + SESSION_AGE_SECONDS,
      credentialVersion: credentialVersion(),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      typeof data === "object" &&
      data !== null &&
      "exp" in data &&
      typeof data.exp === "number" &&
      data.exp > Math.floor(Date.now() / 1000) &&
      "credentialVersion" in data &&
      data.credentialVersion === credentialVersion()
    );
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    return verifySessionToken(token);
  } catch {
    return false;
  }
}

export async function setSessionCookie() {
  (await cookies()).set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
