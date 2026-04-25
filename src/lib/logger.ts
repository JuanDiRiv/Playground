/**
 * Lightweight structured logger. Outputs single-line JSON in production so it
 * can be ingested by Vercel/Cloud logging, and pretty-prints in dev.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info("qa.evaluated", { uid, qid, score });
 *   log.error("qa.failed", { uid, qid }, err);
 */

type Level = "debug" | "info" | "warn" | "error";

const isDev = process.env.NODE_ENV !== "production";

function emit(
  level: Level,
  event: string,
  data?: Record<string, unknown>,
  err?: unknown,
) {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data ?? {}),
  };
  if (err) {
    if (err instanceof Error) {
      payload.errName = err.name;
      payload.errMessage = err.message;
      if (isDev) payload.errStack = err.stack;
    } else {
      payload.errValue = String(err);
    }
  }

  const line = isDev
    ? `[${level}] ${event} ${JSON.stringify({ ...payload, ts: undefined, level: undefined, event: undefined })}`
    : JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, data?: Record<string, unknown>) =>
    emit("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) =>
    emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    emit("warn", event, data, err),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    emit("error", event, data, err),
};
