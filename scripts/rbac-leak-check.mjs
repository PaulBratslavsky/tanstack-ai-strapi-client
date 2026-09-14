// Live check: does search_content honour Content Manager read permissions?
//
// The `test-mcp` admin token holds plugin::content-manager.explorer.* scoped to
// api::article.article ONLY — nothing on Product — plus
// plugin::tanstack-ai.tool.search-content.
//
// The built-in tools are the control: if list_product is absent from
// tools/list, the token genuinely cannot read Products, so any Product row
// search_content returns is a permission bypass, not a mis-scoped token.
//
// Run: node --env-file=.env scripts/rbac-leak-check.mjs
import { createMCPClient } from '@tanstack/ai-mcp'

const url = process.env.STRAPI_MCP_URL ?? 'http://localhost:1360/mcp'
const token = process.env.STRAPI_MCP_TOKEN
if (!token) throw new Error('STRAPI_MCP_TOKEN not set')

const PRODUCT = 'api::product.product'

const client = await createMCPClient({
  transport: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } },
})

const payloadOf = (result) =>
  result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? 'null')

try {
  const names = (await client.tools()).map((t) => t.name).sort()
  const has = (n) => names.includes(n)
  console.log(`tools/list (${names.length}): ${names.join(', ')}\n`)

  console.log('CONTROL — the token scope, as the built-ins see it')
  console.log(`  list_article   visible: ${has('list_article')}   (expect true)`)
  console.log(`  list_product   visible: ${has('list_product')}  (expect false)`)
  console.log(`  search_content visible: ${has('search_content')}   (expect true)`)

  let directNote
  try {
    const direct = await client.callTool('list_product', {})
    directNote = direct?.isError ? `refused: ${direct.content?.[0]?.text}` : 'ANSWERED'
  } catch (error) {
    directNote = `refused: ${error instanceof Error ? error.message : String(error)}`
  }
  console.log(`  calling list_product directly: ${directNote}\n`)

  console.log('PROBE — search_content, single type')
  const single = await client.callTool('search_content', {
    contentType: PRODUCT,
    fields: ['name', 'price', 'tier', 'inStock'],
  })
  if (single?.isError) {
    console.log(`  refused: ${single.content?.[0]?.text}`)
  }
  const singleRows = single?.isError ? [] : payloadOf(single).results
  console.log(`  Product rows returned: ${singleRows.length}`)
  for (const row of singleRows) console.log(`    ${row.documentId}  ${JSON.stringify(row.data)}`)

  console.log('\nPROBE — search_content, fan-out across every type')
  const fan = payloadOf(await client.callTool('search_content', {}))
  const fanProducts = fan.results.filter((r) => r.contentType === PRODUCT)
  console.log(`  totals: ${JSON.stringify(fan.totals)}`)
  console.log(`  Product rows in fan-out: ${fanProducts.length}`)

  console.log('\nVERDICT')
  if (has('list_product')) {
    console.log('  INVALID — the token CAN read Products, so the control failed. Check its grants.')
  } else if (singleRows.length > 0 || fanProducts.length > 0) {
    console.log('  LEAK CONFIRMED — a token with no Product read permission got Product rows via search_content.')
  } else {
    console.log('  NO LEAK — search_content returned no Product rows to a token that cannot read them.')
  }
} finally {
  await client.close()
}
