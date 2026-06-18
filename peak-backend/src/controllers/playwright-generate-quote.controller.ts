import { NextFunction, Request, Response } from "express";
import { playwrightAutomationService } from "../playwright-automation/playwright.service";
import { PlaywrightGenerateQuoteRequest } from "../playwright-automation/playwright.types";

export async function generateQuotePlaywrightController(
  req: Request<unknown, unknown, PlaywrightGenerateQuoteRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as unknown as Record<string, unknown> | undefined;

    const username = String(process.env.AUTO_OWNERS_USERNAME ?? "").trim();
    const password = String(process.env.AUTO_OWNERS_PASSWORD ?? "").trim();
    const totpSecret = String(process.env.AUTO_OWNERS_TOTP_SECRET ?? "").trim();
    if (!username || !password || !totpSecret) {
      res.status(400).json({
        success: false,
        message: "AUTO_OWNERS_USERNAME, AUTO_OWNERS_PASSWORD, AUTO_OWNERS_TOTP_SECRET are required.",
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
      const { payload: _p, options: _o, auto_owners_credentials: _c, ...rest } = body;
      payload = Object.keys(rest).length > 0 ? rest : {};
    }

    // If frontend sends extraction wrapper, pass only `fields` into Playwright steps.
    const maybeFields = (payload as unknown as { fields?: unknown })?.fields;
    if (maybeFields && (Array.isArray(maybeFields) || typeof maybeFields === "object")) {
      payload = { fields: maybeFields };
    }
    const optionsFromReq = (req.body as unknown as { options?: unknown } | undefined)?.options;
    const optionsFromBody = body?.options;
    const job = playwrightAutomationService.startJob({
      payload,
      auto_owners_credentials: { username, password, totpSecret },
      options:
        ((optionsFromReq ?? optionsFromBody) as unknown as PlaywrightGenerateQuoteRequest["options"]) ??
        {},
    });

    res.status(202).json({
      success: true,
      message: "Playwright automation job accepted.",
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

export async function playwrightJobStatusController(
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
    const job = playwrightAutomationService.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, message: "Job not found." });
      return;
    }
    res.status(200).json({ success: true, message: "OK", data: job });
  } catch (error) {
    next(error);
  }
}
