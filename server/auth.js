import "dotenv/config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { normalizeRole } from "../data/logic.js";
import { getUserById, sanitizeUser } from "./users.js";

const DEFAULT_SESSION_SECRET = "chakula-control-demo-session-secret";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);

export const isDefaultSessionSecret = !process.env.SESSION_SECRET;

function getSessionSecret() {
  return process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashPinServer(pin) {
  return createHash("sha256").update(String(pin || "").trim()).digest("hex");
}

export function verifyPinHash(pin, pinHash) {
  if (!pinHash) {
    return false;
  }

  return safeEquals(hashPinServer(pin), pinHash);
}

export function signSessionToken(user) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const payload = {
    sub: Number(user.id),
    role: normalizeRole(user.role),
    display_name: user.display_name,
    exp: expiresAt.toISOString(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");

  return {
    token: `${encodedPayload}.${signature}`,
    expires_at: expiresAt.toISOString(),
  };
}

export function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");

  if (!safeEquals(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (!payload?.exp || new Date(payload.exp).getTime() <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function authenticateRequest(req, dataMode) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const authContext = req.body?.auth_context || {};

  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.sub) {
      const user = await getUserById(payload.sub, dataMode);
      if (user && user.is_active !== false) {
        return {
          ok: true,
          user,
          method: "token",
          retry_later: false,
        };
      }
    }
  }

  if (authContext?.user_id && authContext?.pin_proof) {
    const user = await getUserById(authContext.user_id, dataMode);
    if (user?.pin_hash && safeEquals(authContext.pin_proof, user.pin_hash) && user.is_active !== false) {
      return {
        ok: true,
        user,
        method: "pin_proof",
        retry_later: false,
      };
    }
  }

  return {
    ok: false,
    user: null,
    method: null,
    retry_later: true,
  };
}

export function buildSessionResponse(user) {
  const { token, expires_at } = signSessionToken(user);
  return {
    token,
    expires_at,
    auth_mode: "online-token",
    user: sanitizeUser(user),
  };
}

