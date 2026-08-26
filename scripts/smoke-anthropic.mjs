// Verifies the Anthropic adapter + ANTHROPIC_API_KEY without involving the UI.
// Run: node --env-file=.env scripts/smoke-anthropic.mjs
import { chat, streamToText } from '@tanstack/ai'
import { anthropicText } from '@tanstack/ai-anthropic'

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set. Run with: node --env-file=.env scripts/smoke-anthropic.mjs')
  process.exit(1)
}

const t0 = Date.now()
const stream = chat({
  adapter: anthropicText('claude-sonnet-5'),
  messages: [{ role: 'user', content: 'Reply with exactly: PONG' }],
})
const text = await streamToText(stream)
console.log('elapsed_ms=' + (Date.now() - t0))
console.log('reply=' + JSON.stringify(text.slice(-200)))
