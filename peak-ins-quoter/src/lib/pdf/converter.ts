/**
 * PDF to Image Converter
 *
 * Converts PDF pages to base64 encoded images for use with Claude Vision.
 * Uses pdfjs-dist with @napi-rs/canvas for server-side rendering in Next.js.
 *
 * This implementation works reliably in Next.js API routes by:
 * 1. Using the legacy pdfjs-dist build for better Node.js compatibility
 * 2. Using @napi-rs/canvas (faster, better image support than node-canvas)
 * 3. Pre-loading the worker on globalThis to avoid dynamic import issues
 *
 * IMPORTANT: Uses @napi-rs/canvas instead of node-canvas because:
 * - Better compatibility with pdfjs-dist image rendering (scanned PDFs)
 * - No native compilation issues
 * - Faster performance
 */

export const runtime = "nodejs";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

export interface PDFPage {
  pageNumber: number;
  base64Image: string;
  width: number;
  height: number;
}

export interface PDFConversionResult {
  totalPages: number;
  pages: PDFPage[];
}

export interface PDFConversionOptions {
  scale?: number; // Default: 2 (for good quality OCR)
  maxPages?: number; // Limit number of pages to convert
  format?: "png" | "jpeg";
  quality?: number; // JPEG quality (0-1)
}

const DEFAULT_OPTIONS: Required<PDFConversionOptions> = {
  scale: 2,
  maxPages: 50,
  format: "png",
  quality: 0.85,
};

// Cache for initialization state
let pdfjsInitialized = false;
let canvasPolyfillsInitialized = false;
let pdfjsModule: Awaited<ReturnType<typeof importPdfJsModule>> | null = null;

async function importPdfJsModule() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

/**
 * Initialize DOM/canvas polyfills required by pdfjs in Node runtimes.
 * Some environments (e.g. Next.js dev + Turbopack on Windows) do not expose
 * DOMMatrix/ImageData/Path2D globally, which causes pdfjs import to fail.
 */
async function initializeCanvasPolyfills() {
  if (canvasPolyfillsInitialized) {
    return;
  }

  const globals = globalThis as Record<string, unknown>;
  const canvasModule = await import("@napi-rs/canvas");

  if (typeof globals.DOMMatrix === "undefined") {
    globals.DOMMatrix = canvasModule.DOMMatrix as unknown;
  }
  if (typeof globals.ImageData === "undefined") {
    globals.ImageData = canvasModule.ImageData as unknown;
  }
  if (typeof globals.Path2D === "undefined") {
    globals.Path2D = canvasModule.Path2D as unknown;
  }

  canvasPolyfillsInitialized = true;
}

/**
 * Initialize pdfjs-dist for server-side usage.
 * Pre-loads the worker on globalThis to avoid dynamic import issues in Next.js.
 */
async function initializePdfJs() {
  await initializeCanvasPolyfills();

  if (pdfjsModule) {
    return pdfjsModule;
  }

  if (!pdfjsInitialized) {
    // Pre-load the worker module on globalThis
    // This allows pdfjs to find the worker without dynamic import issues
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as Record<string, unknown>).pdfjsWorker = {
      WorkerMessageHandler: worker.WorkerMessageHandler,
    };
    console.log("[PDF Converter] Worker initialized");
  }

  // Import pdfjs after worker is set up and polyfills are present
  const importedPdfjs = await importPdfJsModule();
  pdfjsModule = importedPdfjs;
  pdfjsInitialized = true;
  return importedPdfjs;
}

/**
 * Render a single PDF page to a PNG or JPEG buffer
 */
async function renderPageToBuffer(
  page: PDFPageProxy,
  options: Required<PDFConversionOptions>
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { createCanvas } = await import("@napi-rs/canvas");

  const viewport = page.getViewport({ scale: options.scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  // Render the PDF page to canvas
  // Note: pdfjs v5+ requires canvas property even when using canvasContext
  await page.render({
    canvas: null as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport: viewport,
  }).promise;

  // Export to buffer based on format
  let buffer: Buffer;
  if (options.format === "jpeg") {
    buffer = canvas.toBuffer("image/jpeg", Math.round(options.quality * 100));
  } else {
    buffer = canvas.toBuffer("image/png");
  }

  return { buffer, width, height };
}

/**
 * Convert PDF buffer to array of base64 encoded images
 * Works in server-side (API routes) environment
 *
 * @param pdfBuffer - PDF file as ArrayBuffer
 * @param options - Conversion options
 * @returns Array of base64 encoded image strings (without data URI prefix)
 */
export async function convertPdfToImages(
  pdfBuffer: ArrayBuffer,
  options: PDFConversionOptions = {}
): Promise<string[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pdfjs = await initializePdfJs();

  // Load the PDF document
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
  const images: string[] = [];

  try {
    const pageCount = Math.min(pdfDoc.numPages, opts.maxPages);

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i);
      const { buffer } = await renderPageToBuffer(page, opts);

      // Convert to base64 (without data URI prefix)
      const base64 = buffer.toString("base64");
      images.push(base64);

      console.log(`[PDF Converter] Processed page ${i}/${pageCount}`);
    }

    console.log(`[PDF Converter] Completed: ${images.length} pages processed`);
    return images;
  } finally {
    await pdfDoc.destroy();
  }
}

/**
 * Convert a PDF file to an array of base64 encoded images with metadata
 * Includes width, height, and page number for each page
 *
 * @param pdfData - PDF file as ArrayBuffer
 * @param options - Conversion options
 * @returns Object with total pages and array of page data
 */
export async function convertPDFToImages(
  pdfData: ArrayBuffer,
  options: PDFConversionOptions = {}
): Promise<PDFConversionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pdfjs = await initializePdfJs();

  // Load the PDF document
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfData),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
  const pages: PDFPage[] = [];

  try {
    const pageCount = Math.min(pdfDoc.numPages, opts.maxPages);

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i);
      const { buffer, width, height } = await renderPageToBuffer(page, opts);

      // Convert to base64 with data URI prefix
      const mimeType = opts.format === "jpeg" ? "image/jpeg" : "image/png";
      const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;

      pages.push({
        pageNumber: i,
        base64Image: base64,
        width,
        height,
      });

      console.log(`[PDF Converter] Processed page ${i}/${pageCount}`);
    }

    return {
      totalPages: pdfDoc.numPages,
      pages,
    };
  } finally {
    await pdfDoc.destroy();
  }
}

/**
 * Get PDF page count and basic info without full conversion
 *
 * @param pdfBuffer - PDF file as ArrayBuffer
 * @returns Object with number of pages and optional title
 */
export async function getPdfInfo(pdfBuffer: ArrayBuffer): Promise<{
  numPages: number;
  title?: string;
}> {
  const pdfjs = await initializePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdfDoc: PDFDocumentProxy = await loadingTask.promise;

  try {
    const metadata = await pdfDoc.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;

    return {
      numPages: pdfDoc.numPages,
      title: info?.Title as string | undefined,
    };
  } finally {
    await pdfDoc.destroy();
  }
}

/**
 * Extract PDF metadata (legacy function name for backward compatibility)
 *
 * @param pdfData - PDF file as ArrayBuffer
 * @returns Object with metadata fields
 */
export async function getPDFMetadata(pdfData: ArrayBuffer): Promise<{
  numPages: number;
  title?: string;
  author?: string;
  creationDate?: Date;
}> {
  const pdfjs = await initializePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfData),
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdfDoc: PDFDocumentProxy = await loadingTask.promise;

  try {
    const metadata = await pdfDoc.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;

    let creationDate: Date | undefined;
    if (info?.CreationDate && typeof info.CreationDate === "string") {
      // PDF date format: D:YYYYMMDDHHmmSS+HH'mm'
      const dateStr = info.CreationDate.replace(/^D:/, "");
      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      const hour = parseInt(dateStr.substring(8, 10), 10) || 0;
      const minute = parseInt(dateStr.substring(10, 12), 10) || 0;
      const second = parseInt(dateStr.substring(12, 14), 10) || 0;

      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        creationDate = new Date(year, month, day, hour, minute, second);
      }
    }

    return {
      numPages: pdfDoc.numPages,
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
      creationDate,
    };
  } finally {
    await pdfDoc.destroy();
  }
}

/**
 * Convert a single PDF page to base64 image
 * Useful for processing pages one at a time (e.g., for progress updates)
 *
 * @param pdfData - PDF file as ArrayBuffer
 * @param pageNumber - 1-indexed page number
 * @param options - Conversion options
 * @returns Base64 encoded image string with data URI prefix
 */
export async function convertSinglePage(
  pdfData: ArrayBuffer,
  pageNumber: number,
  options: PDFConversionOptions = {}
): Promise<PDFPage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pdfjs = await initializePdfJs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfData),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc: PDFDocumentProxy = await loadingTask.promise;

  try {
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
      throw new Error(
        `Invalid page number: ${pageNumber}. PDF has ${pdfDoc.numPages} pages.`
      );
    }

    const page = await pdfDoc.getPage(pageNumber);
    const { buffer, width, height } = await renderPageToBuffer(page, opts);

    const mimeType = opts.format === "jpeg" ? "image/jpeg" : "image/png";
    const base64 = `data:${mimeType};base64,${buffer.toString("base64")}`;

    return {
      pageNumber,
      base64Image: base64,
      width,
      height,
    };
  } finally {
    await pdfDoc.destroy();
  }
}
