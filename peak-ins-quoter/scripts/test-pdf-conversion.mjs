#!/usr/bin/env node
/**
 * Test script for PDF to image conversion
 * Run with: node scripts/test-pdf-conversion.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env.local
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4'

async function testPdfConversion() {
  console.log('=== PDF Conversion Test ===\n')

  // Check for sample PDF
  const samplePdfPath = resolve(__dirname, '..', 'example-pdfs', 'Quote sheets and tax info.pdf')
  if (!existsSync(samplePdfPath)) {
    console.error('Sample PDF not found at:', samplePdfPath)
    process.exit(1)
  }
  console.log('Sample PDF found:', samplePdfPath)

  // Read the PDF
  const pdfBuffer = readFileSync(samplePdfPath)
  console.log('PDF size:', pdfBuffer.length, 'bytes')

  // Initialize pdfjs
  console.log('\nInitializing pdfjs...')
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
  globalThis.pdfjsWorker = {
    WorkerMessageHandler: worker.WorkerMessageHandler,
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  console.log('pdfjs initialized')

  // Load the PDF
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdfDoc = await loadingTask.promise
  console.log('PDF loaded, pages:', pdfDoc.numPages)

  // Convert first page to image
  const { createCanvas } = await import('@napi-rs/canvas')
  const page = await pdfDoc.getPage(1)
  const viewport = page.getViewport({ scale: 2 })

  console.log('Page viewport:', { width: viewport.width, height: viewport.height })

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')

  await page.render({
    canvas: null,
    canvasContext: context,
    viewport: viewport,
  }).promise

  console.log('Page rendered to canvas')

  // Convert to PNG
  const buffer = canvas.toBuffer('image/png')
  console.log('PNG buffer size:', buffer.length, 'bytes')

  // Save to file for inspection
  const outputPath = resolve(__dirname, 'test-output-page1.png')
  writeFileSync(outputPath, buffer)
  console.log('Saved to:', outputPath)

  // Convert to base64
  const base64 = buffer.toString('base64')
  console.log('Base64 length:', base64.length)
  console.log('Base64 starts with:', base64.substring(0, 50))

  // Test with OpenRouter
  console.log('\nTesting with OpenRouter Vision API...')

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'PDF Conversion Test',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe what you see in this document in 2-3 sentences.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } }
        ]
      }],
      max_tokens: 200,
      temperature: 0,
    })
  })

  console.log('Response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('ERROR:', errorText)
    process.exit(1)
  }

  const data = await response.json()
  console.log('\nClaude response:')
  console.log(data.choices?.[0]?.message?.content)
  console.log('\nUsage:', data.usage)

  await pdfDoc.destroy()
  console.log('\n=== PDF conversion test complete! ===')
}

testPdfConversion().catch(console.error)
