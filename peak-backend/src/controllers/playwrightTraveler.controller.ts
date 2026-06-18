import { NextFunction, Request, Response } from "express";
import { playwrightTravelerAutomationService } from "../playwright-automation/playwrightTraveler.service";
import { PlaywrightGenerateQuoteRequest } from "../playwright-automation/playwright.types";

/**
 * Travelers-only entry: start automation first; runner polls webhook after "Send Code".
 */
export async function generateQuotePlaywrightTravelersController(
  req: Request<unknown, unknown, PlaywrightGenerateQuoteRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as unknown as Record<string, unknown> | undefined;

    const username = String(process.env.TRAVELERS_USERNAME ?? "").trim();
    const password = String(process.env.TRAVELERS_PASSWORD ?? "").trim();
    const webhookUrl = String(process.env.TRAVELERS_WEBHOOK_URL ?? "").trim();

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "TRAVELERS_USERNAME and TRAVELERS_PASSWORD are required.",
      });
      return;
    }
    if (!webhookUrl) {
      res.status(400).json({
        success: false,
        message: "TRAVELERS_WEBHOOK_URL is required (used after Send Code to fetch OTP).",
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
    const job = playwrightTravelerAutomationService.startJob({
      payload,
      credentials: { username, password },
      webhookUrl,
      options:
        ((optionsFromReq ?? optionsFromBody) as unknown as PlaywrightGenerateQuoteRequest["options"]) ?? {},
    });

    res.status(202).json({
      success: true,
      message: "Travelers Playwright automation job accepted.",
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

export async function playwrightTravelerJobStatusController(
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
    const job = playwrightTravelerAutomationService.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, message: "Travelers job not found." });
      return;
    }
    res.status(200).json({ success: true, message: "OK", data: job });
  } catch (error) {
    next(error);
  }
}
