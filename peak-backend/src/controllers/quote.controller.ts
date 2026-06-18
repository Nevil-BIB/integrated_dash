import { Request, Response, NextFunction } from "express";
import { inspect } from "node:util";
import { env } from "../config/env";
import { otpStoreService } from "../services/otp-store.service";
import { quoteService } from "../services/quote.service";
import { GenerateQuoteRequest } from "../types/quote.types";
import { logger } from "../utils/logger";
import { skyvernStatusService } from "../services/skyvern-status.service";

export async function generateQuoteController(
  req: Request<unknown, unknown, GenerateQuoteRequest>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await quoteService.generateQuote(req.body ?? {});
    res.status(202).json({
      success: true,
      message: "Quote generation request accepted.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function skyvernRunStatusController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const runId = String(req.params.runId ?? "").trim();
    if (!runId) {
      res.status(400).json({ success: false, message: "runId is required." });
      return;
    }

    const wait = String(req.query.wait ?? "true").toLowerCase() !== "false";
    const timeoutMsRaw = Number(req.query.timeoutMs ?? 120000);
    const intervalMsRaw = Number(req.query.intervalMs ?? 5000);
    const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(5000, Math.min(timeoutMsRaw, 300000)) : 120000;
    const intervalMs = Number.isFinite(intervalMsRaw) ? Math.max(1000, Math.min(intervalMsRaw, 15000)) : 5000;

    const data = wait
      ? await skyvernStatusService.pollUntilTerminal(runId, { timeoutMs, intervalMs })
      : await skyvernStatusService.getRun(runId);

    res.status(200).json({
      success: true,
      message: wait ? "Skyvern run status polled." : "Skyvern run status fetched.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

// ! Hit By n8n to give me OTP
export async function otpWebhookController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const incomingSecret = req.header("x-webhook-secret") ?? "";
    if (env.webhookSecret && incomingSecret !== env.webhookSecret) {
      res.status(401).json({ success: false, message: "Unauthorized webhook request." });
      return;
    }

    const otp = String(req.body?.otp ?? "").trim();
    const carrier = String(req.body?.carrier ?? "travelers").trim().toLowerCase();
    const runIdRaw = String(req.body?.runId ?? "").trim();
    const jobId = String(req.body?.jobId ?? "").trim();
    const extractedAt = req.body?.extractedAt ?? new Date().toISOString();
    const messageId =
      req.body?.messageId && typeof req.body.messageId === "string"
        ? req.body.messageId.trim()
        : null;

    if (!/^\d{6}$/.test(otp)) {
      res.status(400).json({ success: false, message: "Invalid OTP format. Expected 6 digits." });
      return;
    }
    // Only trust real Skyvern workflow run ids from webhook body.
    // Some sources send message ids in `runId`; in that case resolve via jobId mapping.
    let effectiveRunId = runIdRaw.startsWith("wr_") ? runIdRaw : "";
    if (!effectiveRunId && jobId) {
      const mapped = await otpStoreService.getSkyvernRunIdForJob(jobId);
      effectiveRunId = mapped ?? "";
    }
    if (!effectiveRunId) {
      res.status(400).json({
        success: false,
        message:
          "Missing runId (Skyvern wr_...) or jobId with an active job→run mapping. Send runId from generate-quote response, or jobId from the same response after a recent run.",
      });
      return;
    }

    const saved = await otpStoreService.upsert({
      carrier,
      otp,
      runId: effectiveRunId,
      extractedAt,
      messageId,
    });

    const maskedOtp = `${otp.slice(0, 2)}****`;
    console.log("OTP received from n8n webhook", {
      carrier,
      runId: effectiveRunId,
      jobId: jobId || null,
      otp: maskedOtp,
      extractedAt,
      expiresAt: saved.expiresAt,
      messageId: saved.messageId,
    });

    res.status(200).json({
      success: true,
      message: "OTP received and stored.",
      data: { carrier, runId: effectiveRunId, jobId: jobId || null, extractedAt, expiresAt: saved.expiresAt },
    });
  } catch (error) {
    next(error);
  }
}

// ! Hit By n8n bridge to fetch latest active job mapping
export async function latestOtpJobController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incomingSecret = req.header("x-webhook-secret") ?? "";
    if (env.webhookSecret && incomingSecret !== env.webhookSecret) {
      res.status(401).json({ success: false, message: "Unauthorized request." });
      return;
    }

    const latest = await otpStoreService.getLatestActiveJob();
    if (!latest) {
      res.status(404).json({
        success: false,
        message: "No active job mapping found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Latest active job mapping found.",
      data: latest,
    });
  } catch (error) {
    next(error);
  }
}
// ! Skyvern polls this URL (totp_url) while waiting for SMS/email OTP.Plain body: 6-digit code only (many MFA fetchers expect text).
export async function skyvernTotpPollController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobId = String(req.query.jobId ?? req.body?.jobId ?? "").trim();
    if (!jobId) {
      res.status(400).type("text/plain").send("missing jobId");
      return;
    }

    const latest = await otpStoreService.getLatestActiveJob();
    if (latest && latest.jobId !== jobId) {
      console.log("Rejected stale jobId while polling OTP by skyvern", {
        requestedJobId: jobId,
        latestActiveJobId: latest.jobId,
      });
      res.status(409).type("text/plain").send("stale jobId");
      return;
    }

    const skyvernRunId = await otpStoreService.getSkyvernRunIdForJob(jobId);
    if (!skyvernRunId) {
      console.log("No active run for jobId while polling for OTP by skyvern", { jobId });
      res.status(404).type("text/plain").send("no active run for jobId");
      return;
    }
    console.log("Skyvern runId found for jobId while polling for OTP by skyvern", { jobId, skyvernRunId });

    const record = await otpStoreService.get("travelers", skyvernRunId);
    console.log("OTP record found for skyvernRunId", { record });
    if (!record) {
      res.status(404).type("text/plain").send("otp not ready");
      return;
    }

    res.status(200).json({ otp: record.otp });
  } catch (error) {
    next(error);
  }
}

export async function otpReadController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const carrier = String(req.params.carrier ?? "").trim().toLowerCase();
    const runId = String(req.params.runId ?? "").trim();
    const consume = String(req.query.consume ?? "false").toLowerCase() === "true";

    if (!carrier || !runId) {
      res.status(400).json({ success: false, message: "carrier and runId are required." });
      return;
    }

    const record = consume
      ? await otpStoreService.consume(carrier, runId)
      : await otpStoreService.get(carrier, runId);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "OTP not found or expired for the given carrier/runId.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: consume ? "OTP consumed." : "OTP found.",
      data: {
        carrier: record.carrier,
        runId: record.runId,
        otp: record.otp,
        extractedAt: record.extractedAt,
        messageId: record.messageId,
        receivedAt: record.receivedAt,
        expiresAt: record.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
