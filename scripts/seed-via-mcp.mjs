// Seeds demo Articles THROUGH the Strapi MCP server, not the REST API.
// Doubles as proof that the write tools work, not just the read ones.
// Run: node --env-file=.env scripts/seed-via-mcp.mjs
import { createMCPClient } from '@tanstack/ai-mcp'

const url = process.env.STRAPI_MCP_URL ?? 'http://localhost:1350/mcp'
const token = process.env.STRAPI_MCP_TOKEN
if (!token) throw new Error('STRAPI_MCP_TOKEN not set')

const ARTICLES = [
  { title: 'Getting Started with TanStack AI', category: 'tutorial',
    body: 'TanStack AI is a type-safe SDK for streaming chat, tool calling and agents. This walkthrough covers adapters, the chat() agent loop, and wiring useChat to a server function.' },
  { title: 'Strapi 5.52 Released', category: 'announcement',
    body: 'Strapi 5.52 ships the official MCP server at /mcp, letting AI clients discover and call content tools over the Model Context Protocol using admin API tokens.' },
  { title: 'Building MCP Servers', category: 'guide',
    body: 'A guide to exposing your own tools over MCP: registering capabilities before the server starts, scoping them with permissions, and guarding oversized results.' },
]

const client = await createMCPClient({
  transport: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } },
})

try {
  for (const a of ARTICLES) {
    const created = await client.callTool('create_article', { data: a })
    const payload = JSON.parse(created.content?.[0]?.text ?? '{}')
    const documentId = payload?.data?.documentId ?? payload?.documentId
    if (!documentId) {
      console.log(`! ${a.title}: created but no documentId in response`)
      console.log('  raw:', JSON.stringify(payload).slice(0, 300))
      continue
    }
    await client.callTool('publish_article', { documentId })
    console.log(`✓ ${a.title}  [${a.category}]  ${documentId}`)
  }

  const listed = await client.callTool('list_article', {})
  const text = listed.content?.[0]?.text ?? ''
  const parsed = JSON.parse(text)
  const rows = parsed?.results ?? parsed?.data ?? parsed
  console.log(`\nlist_article now returns ${Array.isArray(rows) ? rows.length : '?'} entries`)
} finally {
  await client.close()
}
