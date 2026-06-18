#!/usr/bin/env node
/**
 * Test script for OpenRouter API connection
 * Run with: node scripts/test-openrouter.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createCanvas } from '@napi-rs/canvas'

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

async function testOpenRouterConnection() {
  console.log('=== OpenRouter API Test ===\n')
  console.log('API Key present:', !!OPENROUTER_API_KEY)
  console.log('API Key prefix:', OPENROUTER_API_KEY?.substring(0, 15) + '...')
  console.log('Model:', MODEL)
  console.log('')

  if (!OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY not found in .env.local')
    process.exit(1)
  }

  // Test 1: Simple text completion
  console.log('Test 1: Simple text completion...')
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'OpenRouter Test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Say "Hello, OpenRouter is working!" and nothing else.' }],
        max_tokens: 50,
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
    console.log('Response:', data.choices?.[0]?.message?.content)
    console.log('Usage:', data.usage)
    console.log('Test 1: PASSED\n')
  } catch (error) {
    console.error('Test 1 FAILED:', error.message)
    process.exit(1)
  }

  // Test 2: Vision with a simple base64 image
  console.log('Test 2: Vision API with base64 image...')
  try {
    // Create a proper red square image using @napi-rs/canvas
    const canvas = createCanvas(100, 100)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, 100, 100)
    // Add some text so Claude has something to read
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '20px Arial'
    ctx.fillText('TEST', 25, 55)

    const buffer = canvas.toBuffer('image/png')
    const redSquareBase64 = buffer.toString('base64')
    console.log('Generated test image, base64 length:', redSquareBase64.length)

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'OpenRouter Vision Test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this image? Reply with just the color name.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${redSquareBase64}` } }
          ]
        }],
        max_tokens: 50,
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
    console.log('Response:', data.choices?.[0]?.message?.content)
    console.log('Usage:', data.usage)
    console.log('Test 2: PASSED\n')
  } catch (error) {
    console.error('Test 2 FAILED:', error.message)
    process.exit(1)
  }

  console.log('=== All tests passed! OpenRouter API is working correctly. ===')
}

testOpenRouterConnection()
