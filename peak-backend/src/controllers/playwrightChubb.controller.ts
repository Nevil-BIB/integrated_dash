import { NextFunction, Request, Response } from "express";
import { playwrightChubbAutomationService } from "../playwright-automation/playwrightChubb.service";
import { PlaywrightGenerateQuoteRequest } from "../playwright-automation/playwright.types";

/**
 * CHUBB-only entry: login flow (Azure B2C + MFA webhook). Quote steps added later.
 */
export async function generateQuotePlaywrightChubbController(
  req: Request<unknown, unknown, PlaywrightGenerateQuoteRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as unknown as Record<string, unknown> | undefined;

    const username = String(process.env.CHUBB_USERNAME ?? "").trim();
    const password = String(process.env.CHUBB_PASSWORD ?? "").trim();
    const webhookUrl = String(process.env.CHUBB_WEBHOOK_URL ?? "").trim();

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "CHUBB_USERNAME and CHUBB_PASSWORD are required.",
      });
      return;
    }
    if (!webhookUrl) {
      res.status(400).json({
        success: false,
        message: "CHUBB_WEBHOOK_URL is required (used for MFA OTP after sign-in).",
      });
      return;
    }

    const reqAny = req as unknown as { payload?: unknown };
    const fromReqPayload =
      reqAny?.payload && typeof reqAny.payload === "object" && reqAny.payload !== null
        ? (reqAny.payload as Record<string, unknown>)
        : null;
    const fromBodyPayload =
      body?.payload && typeof body.payload === "object" && body.payload !== null
        ? (body.payload as Record<string, unknown>)
        : null;

    let payload: Record<string, unknown> = {};
    if (fromReqPayload && Object.keys(fromReqPayload).length > 0) {
      payload = fromReqPayload;
    } else if (fromBodyPayload && Object.keys(fromBodyPayload).length > 0) {
      payload = fromBodyPayload;
    } else if (body && typeof body === "object") {
      const { payload: _p, options: _o, auto_owners_credentials: _c, carriers: _car, ...rest } = body;
      payload = Object.keys(rest).length > 0 ? rest : {};
    }

    const maybeFields = (payload as unknown as { fields?: unknown })?.fields;
    if (maybeFields && (Array.isArray(maybeFields) || typeof maybeFields === "object")) {
      payload = { ...payload, fields: maybeFields };
    }

    const optionsFromReq = (req.body as unknown as { options?: unknown } | undefined)?.options;
    const optionsFromBody = body?.options;
    const job = playwrightChubbAutomationService.startJob({
      payload,
      credentials: { username, password },
      webhookUrl,
      options:
        ((optionsFromReq ?? optionsFromBody) as unknown as PlaywrightGenerateQuoteRequest["options"]) ??
        {},
    });

    res.status(202).json({
      success: true,
      message: "CHUBB Playwright automation job accepted.",
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

export async function playwrightChubbJobStatusController(
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
    const job = playwrightChubbAutomationService.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, message: "CHUBB job not found." });
      return;
    }
    res.status(200).json({ success: true, message: "OK", data: job });
  } catch (error) {
    next(error);
  }
}
