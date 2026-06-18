import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { isHttpError } from "../utils/http-error";

export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isHttpError(error)) {
    logger.warn("Request failed", { statusCode: error.statusCode, message: error.message });
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  logger.error("Unhandled error", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
