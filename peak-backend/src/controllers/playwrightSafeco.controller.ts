import { NextFunction, Request, Response } from "express";
import { playwrightSafecoAutomationService } from "../playwright-automation/playwrightSafeco.service";
import type { PlaywrightGenerateQuoteRequest } from "../playwright-automation/playwright.types";

export async function generateQuotePlaywrightSafecoController(
  req: Request<unknown, unknown, PlaywrightGenerateQuoteRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as unknown as Record<string, unknown> | undefined;
    const username = String(process.env.SAFECO_USERNAME ?? "").trim();
    const password = String(process.env.SAFECO_PASSWORD ?? "").trim();
    const webhookUrl = String(process.env.SAFECO_OTP_WEBHOOK_URL ?? "").trim();
    const loginUrl = String(process.env.SAFECO_URL ?? "").trim();
    const missingEnv: string[] = [];
    if (!username) missingEnv.push("SAFECO_USERNAME");
    if (!password) missingEnv.push("SAFECO_PASSWORD");
    if (!webhookUrl) missingEnv.push("SAFECO_OTP_WEBHOOK_URL");
    if (!loginUrl) missingEnv.push("SAFECO_URL");
    if (missingEnv.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required Safeco env vars: ${missingEnv.join(", ")}`,
      });
      return;
    }

    const fromBodyPayload =
      body?.payload && typeof body.payload === "object" && body.payload !== null
        ? (body.payload as Record<string, unknown>)
        : null;
    const payload =
      fromBodyPayload ??
      (body && typeof body === "object"
        ? (({ payload: _p, options: _o, auto_owners_credentials: _c, carriers: _ca, ...rest }) => rest)(body)
        : {});

    const optionsFromReq = (req.body as unknown as { options?: unknown } | undefined)?.options;
    const optionsFromBody = body?.options;

    const job = playwrightSafecoAutomationService.startJob({
      payload,
      credentials: { username, password },
      webhookUrl,
      loginUrl,
      options:
        ((optionsFromReq ?? optionsFromBody) as unknown as PlaywrightGenerateQuoteRequest["options"]) ?? {},
    });

    res.status(202).json({
      success: true,
      message: "Safeco Playwright automation job accepted.",
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

export async function playwrightSafecoJobStatusController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobId = String(req.params.jobId ?? "").trim();
    if (!jobId) {
      res.status(400).json({ success: false, message: "jobId is required." });
      return;
    }
    const job = playwrightSafecoAutomationService.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, message: "Safeco job not found." });
      return;
    }
    res.status(200).json({ success: true, message: "OK", data: job });
  } catch (error) {
    next(error);
  }
}
