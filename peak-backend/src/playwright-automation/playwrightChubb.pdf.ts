import fs from "node:fs";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { chubbPayloadOptionalString } from "./playwrightChubb.payload";

function sanitizePdfNamePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildChubbPdfFileName(payload: unknown, jobId?: string): string {
  const firstNameRaw = chubbPayloadOptionalString(payload, [
    "personal.firstName",
    "personal.ownerFirstName",
    "firstName",
  ]);
  const lastNameRaw = chubbPayloadOptionalString(payload, [
    "personal.lastName",
    "personal.ownerLastName",
    "lastName",
  ]);
  const firstName = firstNameRaw ? sanitizePdfNamePart(firstNameRaw) : "";
  const lastName = lastNameRaw ? sanitizePdfNamePart(lastNameRaw) : "";
  const stamp = Date.now();

  if (firstName && lastName) return `${firstName}-${lastName}-premium-summary-chubb-${stamp}.pdf`;
  if (firstName || lastName) return `${firstName || lastName}-premium-summary-chubb-${stamp}.pdf`;

  const prefix = jobId ? `${jobId}-` : "";
  return `${prefix}premium-summary-chubb-${stamp}.pdf`;
}

/**
 * Click a trigger that opens a PDF (new tab, download, or printable page) and save locally.
 */
export async function downloadChubbPdfFromTrigger(
  page: Page,
  trigger: Locator,
  payload: unknown,
  jobId?: string
): Promise<string> {
  const artifactsDir = path.resolve(process.cwd(), "playwright-artifacts");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const ctx = page.context();
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
  await page.waitForTimeout(250);

  const pagesBefore = ctx.pages().length;
  const waitDownload = page.waitForEvent("download", { timeout: 60_000 }).catch(() => null);
  const waitNewPage = ctx.waitForEvent("page", { timeout: 60_000 }).catch(() => null);
  const waitPopup = page.waitForEvent("popup", { timeout: 60_000 }).catch(() => null);

  const clickTarget = trigger.locator("xpath=ancestor-or-self::div[contains(@class,'printer')][1]").first();
  const toClick = (await clickTarget.count().catch(() => 0)) > 0 ? clickTarget : trigger;
  await toClick.click({ force: true, timeout: 15_000 });

  const download = await waitDownload;
  if (download) {
    const outPath = path.join(artifactsDir, buildChubbPdfFileName(payload, jobId));
    await download.saveAs(outPath);
    return outPath;
  }

  let pdfPage: Page | null = ((await Promise.race([waitNewPage, waitPopup])) as Page | null) ?? null;
  if (!pdfPage) {
    const start = Date.now();
    while (Date.now() - start < 60_000) {
      const pages = ctx.pages();
      if (pages.length > pagesBefore) {
        pdfPage = pages[pages.length - 1];
        break;
      }
      const byUrl = pages.find((p) => /\.pdf(\?|$)/i.test(p.url()));
      if (byUrl) {
        pdfPage = byUrl;
        break;
      }
      await page.waitForTimeout(400);
    }
  }

  if (!pdfPage) {
    const generated = await page.pdf({ printBackground: true, format: "Letter" }).catch(() => null);
    if (generated && generated.length > 0) {
      const outPath = path.join(artifactsDir, buildChubbPdfFileName(payload, jobId));
      fs.writeFileSync(outPath, generated);
      return outPath;
    }
    throw new Error("CHUBB Premium Summary print did not open a PDF or download.");
  }

  await pdfPage.bringToFront().catch(() => undefined);
  await pdfPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  await pdfPage.waitForTimeout(800);

  let bytes: Buffer | null = null;

  const pdfResp = await pdfPage
    .waitForResponse((r) => (r.headers()["content-type"] ?? "").toLowerCase().includes("application/pdf"), {
      timeout: 20_000,
    })
    .catch(() => null);
  if (pdfResp) {
    const b = await pdfResp.body().catch(() => null);
    if (b && b.length > 0) bytes = Buffer.from(b);
  }

  if (!bytes) {
    const url = pdfPage.url();
    if (url && !url.startsWith("about:")) {
      const r = await pdfPage.request.get(url).catch(() => null);
      const ct = (r?.headers()["content-type"] ?? "").toLowerCase();
      if (r && (ct.includes("application/pdf") || /\.pdf(\?|$)/i.test(url))) {
        const b = await r.body().catch(() => null);
        if (b && b.length > 0) bytes = Buffer.from(b);
      }
    }
  }

  if (!bytes) {
    const generated = await pdfPage.pdf({ printBackground: true, format: "Letter" }).catch(() => null);
    if (generated && generated.length > 0) bytes = Buffer.from(generated);
  }

  if (!bytes) throw new Error("CHUBB could not capture Premium Summary PDF bytes.");

  const outPath = path.join(artifactsDir, buildChubbPdfFileName(payload, jobId));
  fs.writeFileSync(outPath, bytes);
  await pdfPage.close().catch(() => undefined);
  return outPath;
}
