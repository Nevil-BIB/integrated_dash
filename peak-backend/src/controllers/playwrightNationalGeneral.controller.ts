import { NextFunction, Request, Response } from "express";
import { playwrightNationalGeneralAutomationService } from "../playwright-automation/playwrightNationalGeneral.service";
import { PlaywrightGenerateQuoteRequest } from "../playwright-automation/playwright.types";

export async function generateQuotePlaywrightNationalGeneralController(
  req: Request<unknown, unknown, PlaywrightGenerateQuoteRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as unknown as Record<string, unknown> | undefined;
    const username = String(process.env.NATIONAL_GENERAL_USERNAME ?? "").trim();
    const password = String(process.env.NATIONAL_GENERAL_PASSWORD ?? "").trim();
    const webhookUrl = String(process.env.NATIONAL_GENERAL_OTP_WEBHOOK_URL ?? "").trim();

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: "NATIONAL_GENERAL_USERNAME and NATIONAL_GENERAL_PASSWORD are required.",
      });
      return;
    }
    if (!webhookUrl) {
      res.status(400).json({
        success: false,
        message: "NATIONAL_GENERAL_OTP_WEBHOOK_URL is required.",
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
    const job = playwrightNationalGeneralAutomationService.startJob({
      payload,
      credentials: { username, password },
      webhookUrl,
      options:
        ((optionsFromReq ?? optionsFromBody) as unknown as PlaywrightGenerateQuoteRequest["options"]) ?? {},
    });

    res.status(202).json({
      success: true,
      message: "National General Playwright automation job accepted.",
      data: job,
    });
  } catch (error) {
    next(error);
  }
}

export async function playwrightNationalGeneralJobStatusController(
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
    const job = playwrightNationalGeneralAutomationService.getJob(jobId);
    if (!job) {
      res.status(404).json({ success: false, message: "National General job not found." });
      return;
    }
    res.status(200).json({ success: true, message: "OK", data: job });
  } catch (error) {
    next(error);
  }
}

