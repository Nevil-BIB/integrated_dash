/** CHUBB Azure B2C selectors and timing (carrier-specific; do not share with Travelers). */

export const CHUBB_LOCAL_ACCOUNT_FORM = "#localAccountForm";
export const CHUBB_SECURITY_CHECK_FORM = "#attributeVerification";
export const CHUBB_UNIFIED_API = '#api[data-name="Unified"]';
export const CHUBB_LOCAL_ACCOUNT_SIGNIN_BTN = "#AcePartnerExchange1";

/** Minimal delay so B2C handlers attach before MFA radio click. */
export const CHUBB_MFA_SCREEN_SETTLE_MS = 50;
export const CHUBB_CONTINUE_ENABLE_POLL_MS = 200;

/** Default producer code when not in payload. */
export const CHUBB_DEFAULT_PRODUCER_CODE = "20170";

/** Default sub producer code (CISA). */
export const CHUBB_DEFAULT_SUB_PRODUCER_CODE = "019";

export const CHUBB_OTP_INPUT_SELECTORS = [
  "#extension_EmailTelephoneMFACode",
  'input[name="extension_EmailTelephoneMFACode"]',
  "#emailVerificationCode",
  "#verificationCode",
  'input[name="emailVerificationCode"]',
  'input[name="verificationCode"]',
  'input[name="otc"]',
  'input[autocomplete="one-time-code"]',
  "#idTxtBx_OTP_Code",
  `${CHUBB_SECURITY_CHECK_FORM} input.textInput:not([readonly]):not([disabled])`,
];

export const CHUBB_OTP_SUBMIT_SELECTORS = [
  `${CHUBB_SECURITY_CHECK_FORM} #continue`,
  "#emailVerificationControl_but_verify_code",
  `${CHUBB_SECURITY_CHECK_FORM} button[type="submit"]`,
];
