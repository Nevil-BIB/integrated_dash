import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../config/env";
import { CARRIER_AUTO_OWNERS, CARRIER_TRAVELERS } from "../constants/carriers";
import { logger } from "../utils/logger";

export class SkyvernIntegration {
  
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.skyvernApiUrl,
      timeout: 30000,
      headers: {
        // Self-hosted Skyvern often accepts x-api-key; some setups also accept Bearer — both sent for compatibility.
        "x-api-key": env.skyvernApiKey,
        Authorization: `Bearer ${env.skyvernApiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Calls Skyvern "run task" API once. The body shape matches Skyvern's run-task style:
   * title, url, prompt, metadata (your job/quote/payload), wait_for_completion.
   *
   * `task` should include at least: jobId, quoteId, carriers[], payload.
   * For Auto Owners, metadata may include `totp_code` when generated in backend (2FA step).
   */
  async executeTask(task: Record<string, unknown>): Promise<unknown> {
    logger.info("Skyvern executeTask called", { hasTask: Boolean(task) });
    // ! LOCAL BROWSER
    // 🟢 DEBUG MODE (LOCAL LIVE BROWSER)
  // if (process.env.MODE === "debug") {
  //   logger.info("Running in DEBUG mode (local browser execution)");

  //   const { SkyvernClient } = require("@skyvern-ai/node");

  //   const client = new SkyvernClient({
  //     apiKey: process.env.SKYVERN_API_KEY,
  //     baseUrl: env.skyvernApiUrl,
  //   });

  //   const response = await client.tasks.run({
  //     url: (task.url as string) || "https://example.com",
  //     prompt: (task.prompt as string) || "",
  //     title: (task.title as string) || "Debug Task",
  //     headless: false,   // 👈 LIVE BROWSER
  //     slowMo: 300,       // 👈 see actions clearly
  //     metadata: task,
  //   });

  //   return response;
  // }
    const carriers = Array.isArray(task.carriers)
      ? task.carriers.filter((c): c is string => typeof c === "string")
      : [];
    const primaryCarrier = carriers[0] ?? CARRIER_AUTO_OWNERS;
    const workflowId =
      primaryCarrier === CARRIER_AUTO_OWNERS
        ? env.skyvernWorkflowIdAutoOwners
        : env.skyvernWorkflowIdTravelers;
    // handle both flow based on the workflow id ( auto owners and travelers )
    if (workflowId) {
      const parameters = env.skyvernWorkflowSendParameters
        ? this.buildWorkflowParameters(task)
        : undefined;

      const pathRun = `/api/v1/workflows/${workflowId}/run`;
      const bodyPath: Record<string, unknown> = {};
      if (parameters) bodyPath.parameters = parameters;
      this.applyWorkflowTotpFields(bodyPath, task);

      // Self-hosted Skyvern often accepts POST /api/v1/workflows/{wpid}/run but ignores `parameters`,
      // which yields 400 "Missing value for parameter ...". Prefer documented unified body first.
      if (parameters) {
        const bodyUnified: Record<string, unknown> = { workflow_id: workflowId, parameters };
        this.applyWorkflowTotpFields(bodyUnified, task);
        const unifiedPaths = ["/api/v1/run/workflows", "/v1/run/workflows"];
        for (const p of unifiedPaths) {
          try {
            const response = await this.client.post(p, bodyUnified);
            logger.info("Skyvern workflow run accepted (unified run API)", { path: p });
            return this.assertSkyvernJson(response.data, p);
          } catch (e) {
            if (axios.isAxiosError(e) && e.response?.status === 404) continue;
            this.logSkyvernAxiosError(e, p);
            throw e;
          }
        }
        logger.warn("Unified workflow run API returned 404 on all paths; trying path-based run", {
          workflowId,
          tried: unifiedPaths,
        });
      }

      try {
        const response = await this.client.post(pathRun, bodyPath);
        return this.assertSkyvernJson(response.data, pathRun);
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status !== 404) {
          this.logSkyvernAxiosError(err, pathRun);
          throw err;
        }

        logger.warn("Skyvern workflow path run returned 404; trying run/workflows body API", {
          path: pathRun,
          workflowId,
        });

        const bodyUnified: Record<string, unknown> = { workflow_id: workflowId };
        if (parameters) bodyUnified.parameters = parameters;
        this.applyWorkflowTotpFields(bodyUnified, task);

        const fallbacks: Array<{ path: string; body: Record<string, unknown> }> = [
          { path: "/api/v1/run/workflows", body: bodyUnified },
          { path: "/v1/run/workflows", body: bodyUnified },
        ];

        let lastError: unknown = err;
        for (const fb of fallbacks) {
          try {
            const response = await this.client.post(fb.path, fb.body);
            logger.info("Skyvern workflow run accepted (fallback path)", { path: fb.path });
            return this.assertSkyvernJson(response.data, fb.path);
          } catch (e) {
            lastError = e;
            if (axios.isAxiosError(e) && e.response?.status === 404) continue;
            this.logSkyvernAxiosError(e, fb.path);
            throw e;
          }
        }

        this.logSkyvernAxiosError(lastError, pathRun);
        throw new Error(
          `Skyvern workflow run failed (404). Verify the carrier workflow id env matches an existing workflow (copy wpid from UI → Run → Network tab), or that SKYVERN_API_URL points to the API on port 8000. Last URL tried: ${env.skyvernApiUrl}${pathRun}`
        );
      }
    }

    const primary = primaryCarrier;

    const { title, url, prompt } = this.buildRunTaskCopy(primary, task);

    const runTaskPayload = {
      title,
      url,
      prompt,
      metadata: task,
      wait_for_completion: false,
    };

    const response = await this.client.post(env.skyvernRunTaskPath, runTaskPayload);
    const data = response.data;

    if (typeof data === "string" && data.toLowerCase().includes("<!doctype html")) {
      logger.error("Skyvern returned HTML instead of JSON", {
        baseURL: env.skyvernApiUrl,
        path: env.skyvernRunTaskPath,
      });
      throw new Error(
        "Skyvern API returned HTML (UI page) instead of JSON. Check SKYVERN_API_URL and SKYVERN_RUN_TASK_PATH."
      );
    }

    logger.info("Skyvern run task accepted", {
      path: env.skyvernRunTaskPath,
      responseType: typeof data,
    });
    return data;
  }

  async getRunStatus(runId: string): Promise<Record<string, unknown>> {
    const paths = [`/api/v1/runs/${runId}`, `/v1/runs/${runId}`];
    let lastError: unknown = null;
    for (const p of paths) {
      try {
        const response = await this.client.get(p);
        const data = response.data;
        if (data && typeof data === "object") {
          return data as Record<string, unknown>;
        }
        return { status: "unknown", raw: data };
      } catch (err) {
        lastError = err;
        if (axios.isAxiosError(err) && err.response?.status === 404) continue;
        this.logSkyvernAxiosError(err, p);
        throw err;
      }
    }
    this.logSkyvernAxiosError(lastError, `/api/v1/runs/${runId}`);
    throw new Error(`Skyvern run status endpoint not found for runId: ${runId}`);
  }

  private applyWorkflowTotpFields(body: Record<string, unknown>, task: Record<string, unknown>): void {
    const jobId = typeof task.jobId === "string" ? task.jobId.trim() : "";
    if (!jobId || !env.backendPublicUrl) return;
    const totpUrl = `${env.backendPublicUrl}/api/otp/skyvern-totp?jobId=${encodeURIComponent(jobId)}`;
    const parsedJobIdFromTotpUrl = this.extractJobIdFromTotpUrl(totpUrl);

    logger.info("[OTP_DEBUG] generate_quote_jobId", { generate_quote_jobId: jobId });
    logger.info("[OTP_DEBUG] totp_url", { totp_url: totpUrl });
    logger.info("[OTP_DEBUG] parsed_jobId_from_totp_url", {
      parsed_jobId_from_totp_url: parsedJobIdFromTotpUrl,
    });

    if (parsedJobIdFromTotpUrl !== jobId) {
      throw new Error(
        `jobId mismatch: generate_quote_jobId=${jobId} parsed_jobId_from_totp_url=${parsedJobIdFromTotpUrl}`
      );
    }

    body.totp_url = totpUrl;
    body.totp_identifier = jobId;
  }

  private extractJobIdFromTotpUrl(totpUrl: string): string {
    try {
      const url = new URL(totpUrl);
      return (url.searchParams.get("jobId") ?? "").trim();
    } catch {
      return "";
    }
  }

  private assertSkyvernJson(data: unknown, path: string): unknown {
    if (typeof data === "string" && data.toLowerCase().includes("<!doctype html")) {
      logger.error("Skyvern returned HTML instead of JSON", {
        baseURL: env.skyvernApiUrl,
        path,
      });
      throw new Error(
        "Skyvern API returned HTML (UI page) instead of JSON. Check SKYVERN_API_URL and SKYVERN_WORKFLOW_ID."
      );
    }
    logger.info("Skyvern workflow run accepted", {
      path,
      responseType: typeof data,
    });
    return data;
  }

  private logSkyvernAxiosError(err: unknown, path: string): void {
    if (!axios.isAxiosError(err)) return;
    const ax = err as AxiosError<{ detail?: unknown }>;
    logger.error("Skyvern request failed", {
      baseURL: env.skyvernApiUrl,
      path,
      status: ax.response?.status,
      detail: ax.response?.data?.detail ?? ax.response?.data,
    });
  }

  private buildWorkflowParameters(task: Record<string, unknown>): Record<string, unknown> {
    // `task.payload` can arrive as either:
    // - nested object: { personal: {...}, property: {...} }
    // - fields list wrapper: { requiredFields: [...], optionalFields: [...] }
    // - array-wrapped form: [ { requiredFields: [...] } ]
    const payloadCandidate = task.payload;

    // Normalize into nested objects so Skyvern can use:
    // - parameters.personal.firstName
    // - parameters.personal.lastName
    // - parameters.personal.address / city / state / zipCode
    //
    // Frontend variants we support:
    // 1) Nested: { personal: {...}, property: {...}, ... }
    // 2) Wrapped lists: { requiredFields: [{key,value}, ...], optionalFields: [...], flaggedFields: [...] }
    // 3) Direct list/array of field objects: [{ key: 'personal.firstName', value: 'Cyrus', ... }, ...]
    let payload: Record<string, unknown> = {};
    if (Array.isArray(payloadCandidate)) {
      payload = normalizeFieldsArrayToNestedObject(payloadCandidate as Array<Record<string, unknown>>);
    } else if (payloadCandidate && typeof payloadCandidate === "object") {
      const payloadRaw = payloadCandidate as Record<string, unknown>;
      payload =
        typeof payloadRaw.personal === "object" && payloadRaw.personal !== null
          ? payloadRaw
          : normalizeFieldsPayload(payloadRaw);
    }

    // Ensure required workflow parameter `personal` exists.
    const personalGuaranteed =
      payload && typeof payload === "object" && (payload as Record<string, unknown>).personal
        ? (payload as Record<string, unknown>).personal
        : {};

    const personal = personalGuaranteed;

    logger.info("[PAYLOAD_RAW_DEBUG]", {
      payloadRawType: Array.isArray(payloadCandidate) ? "array" : typeof payloadCandidate,
      payloadRawKeys: Array.isArray(payloadCandidate)
        ? Object.keys((payloadCandidate[0] ?? {}) as Record<string, unknown>).slice(0, 25)
        : payloadCandidate && typeof payloadCandidate === "object"
          ? Object.keys(payloadCandidate as Record<string, unknown>).slice(0, 25)
          : [],
      hasRequiredFields:
        payloadCandidate && typeof payloadCandidate === "object" && !Array.isArray(payloadCandidate)
          ? Object.prototype.hasOwnProperty.call(payloadCandidate as Record<string, unknown>, "requiredFields")
          : false,
      hasOptionalFields:
        payloadCandidate && typeof payloadCandidate === "object" && !Array.isArray(payloadCandidate)
          ? Object.prototype.hasOwnProperty.call(payloadCandidate as Record<string, unknown>, "optionalFields")
          : false,
      hasFlaggedFields:
        payloadCandidate && typeof payloadCandidate === "object" && !Array.isArray(payloadCandidate)
          ? Object.prototype.hasOwnProperty.call(payloadCandidate as Record<string, unknown>, "flaggedFields")
          : false,
      hasPersonalKey:
        payloadCandidate && typeof payloadCandidate === "object" && !Array.isArray(payloadCandidate)
          ? Object.prototype.hasOwnProperty.call(payloadCandidate as Record<string, unknown>, "personal")
          : false,
    });

    logger.info("[PERSON_DEBUG]", {
      personalGuaranteedKeys: Object.keys(personalGuaranteed || {}),
      derivedFirstName:
        typeof (personalGuaranteed as Record<string, unknown>).firstName === "string"
          ? (personalGuaranteed as Record<string, unknown>).firstName
          : null,
      derivedLastName:
        typeof (personalGuaranteed as Record<string, unknown>).lastName === "string"
          ? (personalGuaranteed as Record<string, unknown>).lastName
          : null,
    });

    const normalizedHasPersonal = payload && typeof payload === "object" ? "personal" in (payload as Record<string, unknown>) : false;
    const personalFirstName =
      normalizedHasPersonal && typeof (payload as Record<string, unknown>).personal === "object"
        ? (((payload as Record<string, unknown>).personal as Record<string, unknown>).firstName as string | undefined)
        : undefined;
    const rfCount =
      payloadCandidate && typeof payloadCandidate === "object" && !Array.isArray(payloadCandidate)
        ? Array.isArray((payloadCandidate as Record<string, unknown>).requiredFields)
          ? ((payloadCandidate as Record<string, unknown>).requiredFields as unknown[]).length
          : undefined
        : undefined;
    logger.info("[WF_PARAMS_DEBUG]", {
      hasPayloadRawPersonal:
        payloadCandidate && typeof payloadCandidate === "object" && !Array.isArray(payloadCandidate)
          ? "personal" in (payloadCandidate as Record<string, unknown>)
          : false,
      payloadRawRequiredFieldsCount: rfCount,
      normalizedHasPersonal,
      normalizedPersonalFirstName: personalFirstName ? personalFirstName.slice(0, 30) : null,
    });
    const taskTotpCode = typeof task.totp_code === "string" ? task.totp_code.trim() : "";
    const payloadOtpCode = typeof payload.otp_code === "string" ? payload.otp_code.trim() : "";
    const otpCode = payloadOtpCode || taskTotpCode;

    if (env.skyvernWorkflowOmitTravelerCredentialParam) {
      delete payload.traveler_credentials;
    }
    const out: Record<string, unknown> = {
      jobId: task.jobId,
      quoteId: task.quoteId,
      carriers: task.carriers,
      payload,
      ...payload,
      personal,
    };
    if (otpCode) {
      out.otp_code = otpCode;
    }
    const taskCarriers = Array.isArray(task.carriers)
      ? task.carriers.filter((c): c is string => typeof c === "string")
      : [];
    const primaryCarrier = taskCarriers[0] ?? CARRIER_AUTO_OWNERS;
    const cred = env.skyvernTravelerCredential.trim();
    if (
      primaryCarrier === CARRIER_TRAVELERS &&
      !env.skyvernWorkflowOmitTravelerCredentialParam &&
      cred.length > 0
    ) {
      out.traveler_credentials = cred;
      logger.info("Skyvern workflow parameters: traveler_credentials set from env", {
        credPrefix: cred.slice(0, 16),
      });
    } else if (env.skyvernWorkflowOmitTravelerCredentialParam) {
      delete out.traveler_credentials;
      logger.info("Skyvern workflow parameters: traveler_credentials omitted (use workflow UI default)");
    }
    return out;
  }

  /**
   * Maps carrier slug → Skyvern prompt + start URL. Extend when adding more carriers.
   */
  private buildRunTaskCopy(
    primary: string,
    task: Record<string, unknown>
  ): { title: string; url: string; prompt: string } {
    const hasTotpInMetadata = typeof task.totp_code === "string" && task.totp_code.length > 0;

    if (primary === CARRIER_AUTO_OWNERS || primary === "auto-owners") {
      return {
        title: "Auto Owners quote run",
        url: env.autoOwnersPortalUrl,
        prompt: [
          "Open the Auto Owners agent portal at the given URL.",
          "Log in using Skyvern saved credentials for Auto Owners if required.",
          "If a TOTP/2FA code is requested, use metadata.totp_code if present (6-digit, time-based).",
          "Then continue the homeowners / dwelling quote flow using metadata.payload fields.",
          "Return structured status: quoted or failed, premium and reference if available.",
          hasTotpInMetadata
            ? "totp_code is provided in metadata for this run."
            : "If no totp_code in metadata, use TOTP from Skyvern Credentials if configured.",
        ].join(" "),
      };
    }

    // Fallback (e.g. legacy travelers) — keep for reference only.
    return {
      title: "Carrier quote run",
      url: "https://foragents.travelers.com/",
      prompt:
        "Use provided metadata and payload to run the carrier quote flow. Login if needed, then continue to quote steps.",
    };
  }

  async sendStructuredData(data: Record<string, unknown>): Promise<unknown> {
    logger.info("Skyvern sendStructuredData called", { keys: Object.keys(data || {}) });
    return { accepted: true, provider: "skyvern", data };
  }

  async generateQuoteResponse(input: Record<string, unknown>): Promise<unknown> {
    logger.info("Skyvern generateQuoteResponse called");
    return { success: true, status: "queued", input };
  }

  async storeSecureData(_name: string, _value: string): Promise<void> {
    logger.warn("storeSecureData is a placeholder and not implemented.");
  }
}

export const skyvernIntegration = new SkyvernIntegration();

function normalizeFieldsPayload(payloadRaw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // The frontend payload can be nested/wrapped; normalize common shapes.
  const container = extractFieldsListContainer(payloadRaw);

  const requiredFields = Array.isArray((container as Record<string, unknown>).requiredFields)
    ? ((container as Record<string, unknown>).requiredFields as Array<Record<string, unknown>>)
    : [];
  const optionalFields = Array.isArray((container as Record<string, unknown>).optionalFields)
    ? ((container as Record<string, unknown>).optionalFields as Array<Record<string, unknown>>)
    : [];
  const flaggedFields = Array.isArray((container as Record<string, unknown>).flaggedFields)
    ? ((container as Record<string, unknown>).flaggedFields as Array<Record<string, unknown>>)
    : [];

  const allFields = [...requiredFields, ...optionalFields, ...flaggedFields];

  for (const f of allFields) {
    if (!f || typeof f !== "object") continue;
    const rawKey = (f as Record<string, unknown>).key;
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!key) continue;

    const record = f as Record<string, unknown>;
    const value = record.value ?? record.rawText;
    if (value === undefined) continue;

    const parts = key
      .split(".")
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;

    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (i === parts.length - 1) {
        cursor[part] = value;
      } else {
        const existing = cursor[part];
        if (!existing || typeof existing !== "object") cursor[part] = {};
        cursor = cursor[part] as Record<string, unknown>;
      }
    }
  }

  return out;
}

function normalizeFieldsArrayToNestedObject(fields: Array<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f || typeof f !== "object") continue;
    const rawKey = (f as Record<string, unknown>).key;
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!key) continue;

    const value = (f as Record<string, unknown>).value ?? (f as Record<string, unknown>).rawText;
    if (value === undefined) continue;

    const parts = key
      .split(".")
      .map((p: string) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;

    let cursor: Record<string, unknown> = out;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (i === parts.length - 1) {
        cursor[part] = value;
      } else {
        const existing = cursor[part];
        if (!existing || typeof existing !== "object") cursor[part] = {};
        cursor = cursor[part] as Record<string, unknown>;
      }
    }
  }
  return out;
}

function derivePersonalFromFields(payloadRaw: Record<string, unknown>): Record<string, unknown> {
  // If frontend already provides nested personal object, keep it.
  const maybePersonal = (payloadRaw as Record<string, unknown>).personal;
  if (maybePersonal && typeof maybePersonal === "object" && maybePersonal !== null) {
    return maybePersonal as Record<string, unknown>;
  }

  const container = extractFieldsListContainer(payloadRaw);
  const requiredFields = Array.isArray((container as Record<string, unknown>).requiredFields)
    ? ((container as Record<string, unknown>).requiredFields as Array<Record<string, unknown>>)
    : [];
  const optionalFields = Array.isArray((container as Record<string, unknown>).optionalFields)
    ? ((container as Record<string, unknown>).optionalFields as Array<Record<string, unknown>>)
    : [];
  const flaggedFields = Array.isArray((container as Record<string, unknown>).flaggedFields)
    ? ((container as Record<string, unknown>).flaggedFields as Array<Record<string, unknown>>)
    : [];

  const allFields = [...requiredFields, ...optionalFields, ...flaggedFields];
  const personal: Record<string, unknown> = {};

  const directMap: Record<string, string> = {
    firstName: "firstName",
    lastName: "lastName",
    address: "address",
    addressLine1: "address",
    city: "city",
    state: "state",
    zipCode: "zipCode",
    zip: "zipCode",
  };

  for (const f of allFields) {
    if (!f || typeof f !== "object") continue;
    const rawKey = (f as Record<string, unknown>).key;
    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!key) continue;
    const value = (f as Record<string, unknown>).value ?? (f as Record<string, unknown>).rawText;
    if (value === undefined || value === null) continue;

    if (key.startsWith("personal.")) {
      const sub = key.slice("personal.".length);
      if (!sub) continue;
      // normalize known aliases into expected names
      if (sub === "addressLine1") personal.address = value;
      else if (sub === "zip") personal.zipCode = value;
      else personal[sub] = value;
      continue;
    }

    const mapped = directMap[key];
    if (mapped) personal[mapped] = value;
  }

  return personal;
}

function extractFieldsListContainer(payloadRaw: Record<string, unknown>): Record<string, unknown> {
  // Direct shape
  if (
    Array.isArray(payloadRaw.requiredFields) ||
    Array.isArray(payloadRaw.optionalFields) ||
    Array.isArray(payloadRaw.flaggedFields)
  ) {
    return payloadRaw;
  }

  // Common wrapper shapes
  const candidates: unknown[] = [
    (payloadRaw as Record<string, unknown>).payload,
    (payloadRaw as Record<string, unknown>).data,
    (payloadRaw as Record<string, unknown>).fields,
    (payloadRaw as Record<string, unknown>).body,
    (payloadRaw as Record<string, unknown>).requestBody,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const cr = c as Record<string, unknown>;
    if (
      Array.isArray(cr.requiredFields) ||
      Array.isArray(cr.optionalFields) ||
      Array.isArray(cr.flaggedFields)
    ) {
      return cr;
    }
  }

  // Fallback: return as-is so caller still has a best-effort result
  return payloadRaw;
}
