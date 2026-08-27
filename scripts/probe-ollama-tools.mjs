// Does the local model call MCP tools at all? UI removed from the equation.
import { chat, maxIterations } from '@tanstack/ai'
import { ollamaText } from '@tanstack/ai-ollama'
import { createMCPClients } from '@tanstack/ai-mcp'

const pool = await createMCPClients({
  strapi: {
    transport: {
      type: 'http',
      url: process.env.STRAPI_MCP_URL,
      headers: { Authorization: `Bearer ${process.env.STRAPI_MCP_TOKEN}` },
    },
  },
})

const stream = chat({
  adapter: ollamaText('qwen3:14b'),
  messages: [{ role: 'user', content: 'What articles do I have? Use your tools.' }],
  mcp: { clients: [pool], connection: 'close' },
  agentLoopStrategy: maxIterations(6),
  systemPrompts: ['Prefer calling a tool over guessing.'],
})

const counts = {}
let text = ''
try {
  for await (const c of stream) {
    counts[c.type] = (counts[c.type] ?? 0) + 1
    if (String(c.type) === 'TEXT_MESSAGE_CONTENT') {
      if (!text) console.log('SAMPLE TEXT CHUNK:', JSON.stringify(c).slice(0, 200))
      text += c.delta ?? c.content ?? c.text ?? ''
    }
    if (String(c.type).includes('tool')) {
      console.log('TOOL CHUNK:', c.type, JSON.stringify(c).slice(0, 240))
    }
    if (String(c.type).includes('error')) {
      console.log('ERROR CHUNK:', JSON.stringify(c).slice(0, 500))
    }
  }
} catch (e) {
  console.log('THREW:', e?.message?.slice(0, 400))
}
console.log('chunk types:', JSON.stringify(counts))
console.log('text:', JSON.stringify(text.slice(0, 300)))
