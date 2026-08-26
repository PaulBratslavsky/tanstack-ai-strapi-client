// Probes an MCP server and prints its tools. No LLM involved.
// Run: node scripts/probe-mcp.mjs <url> [bearerToken]
import { createMCPClient } from '@tanstack/ai-mcp'

const [url, token] = process.argv.slice(2)
if (!url) {
  console.error('usage: node scripts/probe-mcp.mjs <url> [bearerToken]')
  process.exit(1)
}

const client = await createMCPClient({
  transport: {
    type: 'http',
    url,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  },
})

try {
  const tools = await client.tools()
  console.log(`connected: ${url}`)
  console.log(`tool_count=${tools.length}`)
  for (const t of tools) {
    const desc = (t.description ?? '').replace(/\s+/g, ' ').slice(0, 90)
    console.log(`  - ${t.name}${desc ? ' :: ' + desc : ''}`)
  }
} finally {
  await client.close()
}
