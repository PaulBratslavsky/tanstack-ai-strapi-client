// Verifies the Ollama adapter + local model without involving the UI.
// Run: node scripts/smoke-ollama.mjs

import { chat, streamToText } from '@tanstack/ai'
import { ollamaText } from '@tanstack/ai-ollama'

const t0 = Date.now()
const stream = chat({
  adapter: ollamaText('qwen3:14b'),
  messages: [{ role: 'user', content: 'Reply with exactly: PONG' }],
})
const text = await streamToText(stream)
console.log('elapsed_ms=' + (Date.now() - t0))
console.log('reply=' + JSON.stringify(text.slice(-200)))
