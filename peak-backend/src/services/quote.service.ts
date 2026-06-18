import { randomUUID } from "crypto";
import { env } from "../config/env";
import { CARRIER_AUTO_OWNERS, CARRIER_TRAVELERS } from "../constants/carriers";
import { skyvernIntegration } from "../integrations/skyvern.integration";
import { otpStoreService } from "./otp-store.service";
import { GenerateQuoteRequest, GenerateQuoteResponse } from "../types/quote.types";
import { getAutoOwnersTotpCodeForSkyvern } from "../utils/autoOwnersTotp";
import { HttpError } from "../utils/http-error";
import { logger } from "../utils/logger";

const TRAVELERS_DEDUPE_IN_FLIGHT =
  "A Travelers quote run is already in progress for this extraction/submission. Wait for it to finish or try again after a few minutes.";

function getSkyvernRunDedupeKey(request: GenerateQuoteRequest): string | null {
  const top = request.extractionId;
  if (typeof top === "string" && top.trim().length > 0) return `ex:${top.trim()}`;
  const p = request.payload;
  if (p && typeof p === "object") {
    const ext = (p as Record<string, unknown>).extractionId;
    if (typeof ext === "string" && ext.trim().length > 0) return `ex:${ext.trim()}`;
  }
  const q = request.quoteId;
  if (typeof q === "string" && q.trim().length > 0) return `quote:${q.trim()}`;
  return null;
}

function parseInFlightQuote(raw: string): "pending" | GenerateQuoteResponse | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o._pending === true) return "pending";
    if (
      typeof o.jobId === "string" &&
      typeof o.quoteId === "string" &&
      typeof o.status === "string" &&
      typeof o.note === "string"
    ) {
      return o as unknown as GenerateQuoteResponse;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function extractSkyvernRunId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const direct = o.run_id ?? o.runId ?? o.workflow_run_id;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    const id = n.run_id ?? n.runId;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

export class QuoteService {
  async generateQuote(request: GenerateQuoteRequest): Promise<GenerateQuoteResponse> {
    // ! TRAVELERS ONLY MODE ( PENDING )
    // const travelersOnlyMode = true;

    // if (travelersOnlyMode) {
    //   const dedupeKey = getSkyvernRunDedupeKey(request);
    //   const ttlSeconds = env.otpTtlSeconds;

    //   if (dedupeKey) {
    //     const existingRaw = await otpStoreService.getInFlightQuoteRun(dedupeKey);
    //     if (existingRaw) {
    //       const parsed = parseInFlightQuote(existingRaw);
    //       if (parsed === "pending") {
    //         throw new HttpError(409, TRAVELERS_DEDUPE_IN_FLIGHT);
    //       }
    //       if (parsed) {
    //         logger.info("generate-quote idempotent replay (same extraction/quoteId)", {
    //           dedupeKey,
    //           jobId: parsed.jobId,
    //         });
    //         return parsed;
    //       }
    //     }

    //     const reserved = await otpStoreService.tryReserveInFlightQuoteRun(dedupeKey, ttlSeconds);
    //     if (!reserved) {
    //       const againRaw = await otpStoreService.getInFlightQuoteRun(dedupeKey);
    //       if (againRaw) {
    //         const again = parseInFlightQuote(againRaw);
    //         if (again === "pending") {
    //           throw new HttpError(409, TRAVELERS_DEDUPE_IN_FLIGHT);
    //         }
    //         if (again) {
    //           logger.info("generate-quote idempotent replay after race", { dedupeKey, jobId: again.jobId });
    //           return again;
    //         }
    //       }
    //       throw new HttpError(409, TRAVELERS_DEDUPE_IN_FLIGHT);
    //     }
    //   }

    //   const jobId = randomUUID();
    //   const quoteId = request.quoteId ?? randomUUID();

    //   const incomingPayload =
    //     request.payload && typeof request.payload === "object"
    //       ? (request.payload as Record<string, unknown>)
    //       : {};

    //   const traveler_credentials = env.skyvernTravelerCredential.trim();

    //   // Strip client traveler_credentials keys from spread; credential comes only from env.
    //   const {
    //     traveler_credentials: _omitCred,
    //     Traveler_Credentials: _omitCred2,
    //     ...payloadRest
    //   } = incomingPayload as Record<string, unknown> & {
    //     Traveler_Credentials?: unknown;
    //   };

    //   const travelersPayload: Record<string, unknown> = {
    //     ...payloadRest,
    //     traveler_credentials,
    //     otp_code: incomingPayload.otp_code ?? env.skyvernTravelerOtpDefault ?? "",
    //   };

    //   try {
    //     const skyvernTask = await skyvernIntegration.executeTask({
    //       jobId,
    //       quoteId,
    //       carriers: [CARRIER_TRAVELERS],
    //       payload: travelersPayload,
    //     });

    //     const skyvernRunId = extractSkyvernRunId(skyvernTask);
    //     if (skyvernRunId) {
    //       // ! Store the jobId and skyvernRunId in Redis So that n8n can POST OTP with jobId only.
    //       await otpStoreService.setJobSkyvernRunMapping(jobId, skyvernRunId);
    //     }

    //     logger.info("Skyvern task dispatched (Travelers-only mode)", {
    //       quoteId,
    //       jobId,
    //       runId: skyvernRunId ?? null,
    //     });

    //     const result: GenerateQuoteResponse = {
    //       quoteId,
    //       jobId,
    //       status: "queued",
    //       note: "Quote queued for Travelers via Skyvern. Auto Owners flow is temporarily disabled.",
    //       skyvernRunId: skyvernRunId ?? null,
    //     };

    //     if (dedupeKey) {
    //       await otpStoreService.setInFlightQuoteRunPayload(dedupeKey, JSON.stringify(result), ttlSeconds);
    //     }

    //     return result;
    //   } catch (err) {
    //     if (dedupeKey) {
    //       await otpStoreService.clearInFlightQuoteRun(dedupeKey);
    //     }
    //     throw err;
    //   }
    // }
    // ! AUTO OWNERS FLOW ( PENDING )
    const jobId = randomUUID();
    const quoteId = request.quoteId ?? randomUUID();

    const totpCode = getAutoOwnersTotpCodeForSkyvern();
    // Payload can come from two different shapes depending on frontend version:
    // 1) request.payload (preferred)
    // 2) request.fields (legacy; frontend sends { requiredFields/optionalFields/flaggedFields } under `fields`)
    const requestAny = request as unknown as Record<string, unknown>;
    const fieldsFromRequest = requestAny.fields;

    const payloadForSkyvern =
      request.payload && typeof request.payload === "object" && request.payload !== null
        ? Object.keys(request.payload as Record<string, unknown>).length > 0
          ? request.payload
          : request
        : fieldsFromRequest && typeof fieldsFromRequest === "object" && fieldsFromRequest !== null
          ? fieldsFromRequest
          : request;
    // Skyvern receives: who is running, what data, optional one-time 2FA code for this request because we are using the auto owners workflow.
    const skyvernTask = await skyvernIntegration.executeTask({
      jobId,
      quoteId,
      carriers: [CARRIER_AUTO_OWNERS],
      payload: payloadForSkyvern ?? {},
      // ...(totpCode ? { totp_code: totpCode } : {}),
    });

    logger.info("Skyvern task dispatched", {
      quoteId,
      jobId,
      totpAttached: Boolean(totpCode),
    });

    const skyvernTaskObj =
      skyvernTask && typeof skyvernTask === "object" ? (skyvernTask as Record<string, unknown>) : null;

    const skyvernTaskType = skyvernTask === null ? "null" : typeof skyvernTask;
    const skyvernTaskSample = (() => {
      try {
        const raw =
          typeof skyvernTask === "string" ? skyvernTask : JSON.stringify(skyvernTask);
        if (raw.length <= 500) return raw;
        return raw.slice(0, 500) + "...(truncated)";
      } catch {
        return String(skyvernTask);
      }
    })();

    const runId =
      (skyvernTaskObj?.run_id as string | undefined) ??
      (skyvernTaskObj?.runId as string | undefined) ??
      (skyvernTaskObj?.id as string | undefined) ??
      (skyvernTaskObj?.task_id as string | undefined);

    logger.info("Skyvern response metadata", {
      quoteId,
      jobId,
      hasResponse: Boolean(skyvernTask),
      skyvernTaskType,
      skyvernTaskSample,
      runId: runId ?? null,
      status: (skyvernTaskObj?.status as string | undefined) ?? null,
      keys: skyvernTaskObj ? Object.keys(skyvernTaskObj).slice(0, 25) : [],
    });

    return {
      quoteId,
      skyvernRunId: runId ?? null,
      jobId,
      status: "queued",
      note: "Quote queued for Auto Owners via Skyvern. Configure SKYVERN_* and AUTO_OWNERS_* in .env.",
    };
  }
}

export const quoteService = new QuoteService();
