/**
 * Server startup instrumentation.
 *
 * Ensures pdfjs-required DOM/canvas globals are available before any
 * runtime import of pdfjs-dist in API routes.
 */
export const runtime = "nodejs";
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const globals = globalThis as Record<string, unknown> & {
    __pdfjsPolyfilled?: boolean;
  };

  if (globals.__pdfjsPolyfilled) {
    return;
  }

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

  globals.__pdfjsPolyfilled = true;
}
