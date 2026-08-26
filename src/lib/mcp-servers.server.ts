import type { HttpTransportConfig } from '@tanstack/ai-mcp'

/**
 * MCP server configuration, driven by environment rather than hardcoded.
 *
 * `.server.ts`: reads bearer tokens. These must never reach the browser —
 * STRAPI_MCP_TOKEN grants content-manager CRUD on the Strapi instance.
 *
 * Config keys are meaningful: createMCPClients() prefixes each server's tools
 * with its key, so Strapi's `list_article` becomes `strapi_list_article` and
 * the docs server's search becomes `docs_*`. That prefixing is what prevents
 * MCPDuplicateToolNameError when two servers expose the same tool name.
 *
 * A server whose required token is missing is OMITTED rather than included and
 * left to fail: a missing token is a configuration state we can detect up
 * front, whereas `onDiscoveryError` exists for servers that are configured but
 * unreachable at runtime. Conflating the two makes a typo'd token look like an
 * outage.
 */
export interface McpServerDef {
  key: string
  label: string
  transport: HttpTransportConfig
  /** Why this server was skipped, when it is not configured. */
  skipped?: string
}

/** Every server we know how to connect to, with its configuration state. */
export function describeServers(): Array<McpServerDef | { key: string; label: string; skipped: string }> {
  const out: Array<any> = []

  const strapiUrl = process.env.STRAPI_MCP_URL ?? 'http://localhost:1350/mcp'
  const strapiToken = process.env.STRAPI_MCP_TOKEN
  if (strapiToken) {
    out.push({
      key: 'strapi',
      label: 'Strapi',
      transport: {
        type: 'http',
        url: strapiUrl,
        headers: { Authorization: `Bearer ${strapiToken}` },
      },
    })
  } else {
    out.push({
      key: 'strapi',
      label: 'Strapi',
      skipped:
        'STRAPI_MCP_TOKEN not set. Mint an ADMIN-kind token with ' +
        'strapi-backend/scripts/mint-mcp-token.js — a content token from ' +
        'Settings > API Tokens will 401 against /mcp.',
    })
  }

  // The Strapi docs MCP server (strapi-docs.mcp.kapa.ai) is OAuth-protected:
  //   grant_types_supported: ["authorization_code", "refresh_token"]
  // There is no client_credentials grant, so a server-side process cannot mint
  // its own token — it needs a bearer obtained through an interactive flow.
  // Set DOCS_MCP_TOKEN to one and this server joins the pool.
  const docsUrl = process.env.DOCS_MCP_URL ?? 'https://strapi-docs.mcp.kapa.ai'
  const docsToken = process.env.DOCS_MCP_TOKEN
  if (docsToken) {
    out.push({
      key: 'docs',
      label: 'Strapi Docs',
      transport: {
        type: 'http',
        url: docsUrl,
        headers: { Authorization: `Bearer ${docsToken}` },
      },
    })
  } else {
    out.push({
      key: 'docs',
      label: 'Strapi Docs',
      skipped:
        'DOCS_MCP_TOKEN not set. strapi-docs.mcp.kapa.ai requires OAuth ' +
        '(authorization_code + PKCE); it has no machine-to-machine grant.',
    })
  }

  return out
}

/** Only the servers that are actually configured, shaped for createMCPClients(). */
export function buildPoolConfig(): Record<string, { transport: HttpTransportConfig }> {
  const config: Record<string, { transport: HttpTransportConfig }> = {}
  for (const s of describeServers()) {
    if ('transport' in s && s.transport) {
      config[s.key] = { transport: s.transport }
    }
  }
  return config
}
