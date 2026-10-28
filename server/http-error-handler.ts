import { STATUS_CODES } from "node:http";
import type { NextFunction, Request, Response } from "express";

const JSON_RPC_PARSE_ERROR_CODE = -32700;
const JSON_RPC_PARSE_ERROR_BODY = {
  jsonrpc: "2.0",
  error: {
    code: JSON_RPC_PARSE_ERROR_CODE,
    message: "Parse error",
  },
  id: null,
};
const BODY_PARSER_JSON_PARSE_TYPE = "entity.parse.failed";
const CLIENT_ERROR_MIN_STATUS = 400;
const SERVER_ERROR_MIN_STATUS = 500;
const MAX_HTTP_STATUS = 599;

export interface HttpErrorLogger {
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorType(error: unknown): string {
  if (isObject(error) && typeof error.type === "string" && error.type.length > 0) {
    return error.type;
  }
  if (error instanceof Error && error.name.length > 0) {
    return error.name;
  }
  return "Error";
}

function readHttpStatus(error: unknown): number {
  if (!isObject(error)) {
    return SERVER_ERROR_MIN_STATUS;
  }
  for (const key of ["status", "statusCode"]) {
    const value = error[key];
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= CLIENT_ERROR_MIN_STATUS &&
      value <= MAX_HTTP_STATUS
    ) {
      return value;
    }
  }
  return SERVER_ERROR_MIN_STATUS;
}

function isJsonParseError(error: unknown): boolean {
  return isObject(error) && error.type === BODY_PARSER_JSON_PARSE_TYPE;
}

function clientErrorPhrase(status: number): string {
  const phrase = STATUS_CODES[status];
  return typeof phrase === "string" ? phrase : "Request Error";
}

function responseBodyForError(error: unknown, status: number): unknown {
  if (isJsonParseError(error)) {
    return JSON_RPC_PARSE_ERROR_BODY;
  }
  if (status >= SERVER_ERROR_MIN_STATUS) {
    return { error: "Internal server error" };
  }
  return { error: clientErrorPhrase(status) };
}

/**
 * Express 5.3's default handler logs `console.error(err)`. body-parser's JSON
 * SyntaxError carries the raw request on `err.body`, so that path prints
 * credentials that pino redaction never sees. `stdSerializers.err` would copy
 * the same field. Log type/status only, and never `next(err)`.
 */
export function createHttpErrorHandler(
  logger: HttpErrorLogger
): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  return function httpErrorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    const type = readErrorType(err);
    const status = readHttpStatus(err);
    const fields: Record<string, unknown> = { type, status };
    if (typeof req.method === "string") {
      fields.method = req.method;
    }
    if (typeof req.path === "string") {
      fields.path = req.path;
    }

    if (status >= SERVER_ERROR_MIN_STATUS) {
      logger.error(fields, "HTTP request error");
    } else {
      logger.warn(fields, "HTTP request error");
    }

    if (res.headersSent) {
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    res.status(isJsonParseError(err) ? 400 : status).json(responseBodyForError(err, status));
  };
}
