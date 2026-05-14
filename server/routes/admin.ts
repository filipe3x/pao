import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";

export const adminRouter = Router();

const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8h

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET ausente ou demasiado curto (>=16 chars)");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function makeToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${expires}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): boolean {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expires = Number(payload);
  return Number.isFinite(expires) && Date.now() < expires;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

adminRouter.post("/unlock", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).json({ error: "admin_disabled" });
  const provided = String(req.body?.password ?? "");
  if (!provided || !timingSafeEqualStrings(provided, expected)) {
    return res.status(401).json({ error: "invalid_password" });
  }
  res.json({ token: makeToken(), expiresIn: SESSION_TTL_MS });
});

adminRouter.get("/status", (req, res) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  res.json({ unlocked: token ? verifyToken(token) : false });
});

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!verifyToken(token)) {
    res.status(401).json({ error: "locked" });
    return;
  }
  next();
}
