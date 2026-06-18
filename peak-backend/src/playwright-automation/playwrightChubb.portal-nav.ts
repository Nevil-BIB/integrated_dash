import type { BrowserContext, Page } from "playwright";
const CHUBB_AGENT_PORTAL_HREF = "https://secure.chubb.com/";

/**
 * chubb.com header: Login & Pay Bill → For Agents & Brokers → Login to Agent Portal (new tab).
 */
export async function chubbOpenAgentPortalLoginTab(
  marketingPage: Page,
  context: BrowserContext,
  timeoutMs: number
): Promise<Page> {
  await marketingPage
    .locator(".nav__primary, .cmp-navigation__global")
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs });

  const loginPayBill = marketingPage
    .locator("li.dropdown.login > a")
    .filter({ hasText: /Login\s*&\s*Pay\s*Bill/i })
    .first();

  await loginPayBill.waitFor({ state: "visible", timeout: timeoutMs });
  await loginPayBill.scrollIntoViewIfNeeded().catch(() => undefined);
  await loginPayBill.click({ timeout: 15_000 });

  const dropdown = marketingPage.locator("li.dropdown.login .dropdown-menu").first();
  await dropdown.waitFor({ state: "visible", timeout: timeoutMs });

  const agentPortalLink = dropdown
    .locator(`a[href="${CHUBB_AGENT_PORTAL_HREF}"], a[href*="secure.chubb.com"]`)
    .filter({ hasText: /Login to Agent Portal/i })
    .first();

  await agentPortalLink.waitFor({ state: "visible", timeout: timeoutMs });

  const portalPage = await openLinkInNewTab(marketingPage, context, agentPortalLink, timeoutMs);
  portalPage.setDefaultTimeout(timeoutMs);
  await portalPage.waitForLoadState("domcontentloaded").catch(() => undefined);

  return portalPage;
}

async function openLinkInNewTab(
  currentPage: Page,
  context: BrowserContext,
  link: ReturnType<Page["locator"]>,
  timeoutMs: number
): Promise<Page> {
  const popupPromise = context.waitForEvent("page", { timeout: timeoutMs });

  await link.click({ timeout: 15_000 });

  try {
    const newPage = await popupPromise;
    await newPage.waitForLoadState("domcontentloaded").catch(() => undefined);
    return newPage;
  } catch {
    await currentPage
      .waitForURL(/secure\.chubb\.com|auth\.chubb\.com|agentview\.chubb\.com/i, { timeout: timeoutMs })
      .catch(() => undefined);
    if (/secure\.chubb\.com|auth\.chubb\.com|agentview\.chubb\.com/i.test(currentPage.url())) {
      return currentPage;
    }
    throw new Error(
      "CHUBB Agent Portal did not open in a new tab or navigate away from the marketing login page."
    );
  }
}
