import { createMCPClient } from '@tanstack/ai-mcp'
const url = process.env.STRAPI_MCP_URL ?? 'http://localhost:1360/mcp'
const client = await createMCPClient({
  transport: { type: 'http', url, headers: { Authorization: `Bearer ${process.env.STRAPI_MCP_TOKEN}` } },
})
try {
  const tools = await client.tools()
  for (const name of process.argv.slice(2)) {
    const t = tools.find((x) => x.name === name)
    console.log(`=== ${name} ===`)
    console.log(JSON.stringify(t?.inputSchema ?? t?.metadata?.mcp ?? t, null, 2).slice(0, 1800))
  }
} finally { await client.close() }
