/**
 * Test script for PDF to Image converter
 *
 * Run with: npx tsx scripts/test-pdf-converter.mjs <path-to-pdf>
 *
 * This script tests the PDF converter in a Node.js environment
 * similar to how it runs in Next.js API routes.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.log("Usage: npx tsx scripts/test-pdf-converter.mjs <path-to-pdf>");
    console.log("\nThis script tests the PDF to image conversion.");
    console.log("Example: npx tsx scripts/test-pdf-converter.mjs 'example-pdfs/Quote sheets and tax info.pdf'");
    process.exit(0);
  }

  console.log("Testing PDF converter...");
  console.log("PDF path:", pdfPath);

  try {
    // Read the PDF file
    const pdfBuffer = await readFile(pdfPath);
    console.log("PDF size:", pdfBuffer.length, "bytes");

    // Import the converter
    const { convertPdfToImages, getPdfInfo } = await import("../src/lib/pdf/converter.js");

    // Get PDF info first
    console.log("\nGetting PDF info...");
    // Note: pdfjs detaches ArrayBuffer, so we need to use slice() to create a copy
    const info = await getPdfInfo(pdfBuffer.buffer.slice(0));
    console.log("PDF info:", info);

    // Convert to images
    console.log("\nConverting PDF to images...");
    const startTime = Date.now();
    // Use slice() to create a new ArrayBuffer since pdfjs may detach it
    const images = await convertPdfToImages(pdfBuffer.buffer.slice(0), {
      scale: 2,
      maxPages: 3, // Limit for testing
    });
    const endTime = Date.now();

    console.log(`\nConversion completed in ${endTime - startTime}ms`);
    console.log(`Generated ${images.length} images`);

    // Save images to test-output directory
    const outputDir = join(projectRoot, "test-output");
    if (!existsSync(outputDir)) {
      await mkdir(outputDir);
    }

    const pdfName = basename(pdfPath, ".pdf");
    for (let i = 0; i < images.length; i++) {
      const outputPath = join(outputDir, `${pdfName}-page-${i + 1}.png`);
      const imageBuffer = Buffer.from(images[i], "base64");
      await writeFile(outputPath, imageBuffer);
      console.log(`Saved: ${outputPath} (${imageBuffer.length} bytes)`);
    }

    console.log("\nTest completed successfully!");

  } catch (error) {
    console.error("\nError:", error);
    process.exit(1);
  }
}

main();
