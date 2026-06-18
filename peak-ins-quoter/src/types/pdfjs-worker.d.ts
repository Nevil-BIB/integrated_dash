/**
 * Type declarations for pdfjs-dist worker module
 *
 * The worker module doesn't have its own .d.ts file, so we declare it here.
 * The WorkerMessageHandler is the main export used for "fake worker" setup.
 */

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
