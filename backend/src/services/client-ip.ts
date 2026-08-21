import { createHash } from "node:crypto";
import type { Request } from "express";

export function getClientIp(request: Request): string {
  return request.ip?.trim() || request.socket.remoteAddress?.trim() || "unknown";
}

export function hashClientIp(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
