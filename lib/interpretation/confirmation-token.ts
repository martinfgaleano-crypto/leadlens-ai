import { createHmac, timingSafeEqual } from "node:crypto";
import type { CompanyInterpretationV1 } from "./company-interpretation";

const VERSION = 1;
const TTL_SECONDS = 30 * 60;

interface ConfirmationTokenPayload {
  v: typeof VERSION;
  sub: string;
  iat: number;
  exp: number;
  interpretation: CompanyInterpretationV1;
}

function secret(): string | null {
  return process.env.CONFIRMATION_TOKEN_SECRET
    || process.env.ADMIN_SESSION_SECRET
    || process.env.INTERNAL_RUN_SECRET
    || null;
}

function sign(encoded: string, key: string): string {
  return createHmac("sha256", key).update(encoded).digest("base64url");
}

/** Opaque, short-lived server assertion that a Stage-A result was produced for
 * this authenticated owner. It prevents the browser from editing the full draft
 * into Evidence/Fit/Timing/Decision before the explicit confirmation action. */
export function issueConfirmationToken(
  userId: string,
  interpretation: CompanyInterpretationV1,
  now = Date.now(),
): string | null {
  const key = secret();
  if (!key) return null;
  const payload: ConfirmationTokenPayload = {
    v: VERSION,
    sub: userId,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + TTL_SECONDS,
    interpretation,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, key)}`;
}

export function verifyConfirmationToken(
  token: string,
  expectedUserId: string,
  now = Date.now(),
): CompanyInterpretationV1 | null {
  const key = secret();
  if (!key) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const supplied = token.slice(dot + 1);
  const expected = sign(encoded, key);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConfirmationTokenPayload;
    if (payload.v !== VERSION || payload.sub !== expectedUserId) return null;
    const nowSeconds = Math.floor(now / 1000);
    if (payload.iat > nowSeconds + 60 || payload.exp <= nowSeconds) return null;
    if (!payload.interpretation || payload.interpretation.schemaVersion !== "1") return null;
    return payload.interpretation;
  } catch {
    return null;
  }
}
