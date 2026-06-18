import speakeasy from "speakeasy";
import { env } from "../config/env";

/**
 * Auto Owners uses TOTP (time-based one-time password) for 2FA (Google Authenticator style).
 * Client gives a Base32 secret; we produce a 6-digit code with `speakeasy` (CommonJS-friendly for ts-node).
 *
 * - Set AUTO_OWNERS_TOTP_SECRET in .env. Never commit real secrets.
 * - If unset, returns null — Skyvern can use TOTP stored in Skyvern Credentials UI instead.
 * - Codes rotate ~every 30s; generate at request time so the code is fresh when automation hits 2FA.
 */
export function getAutoOwnersTotpCodeForSkyvern(): string | null {
  const secret = env.autoOwnersTotpSecret?.trim();
  if (!secret) {
    return null;
  }

  try {
    return speakeasy.totp({
      secret,
      encoding: "base32",
    });
  } catch {
    return null;
  }
}
