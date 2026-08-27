import type { HttpTransportConfig } from '@tanstack/ai-mcp'
import { createOAuthProvider } from './mcp-oauth-provider.server'
import { hasTokens } from './mcp-oauth-store.server'

/**
 * MCP server configuration, driven by environment and stored credentials.
 *
 * `.server.ts`: reads bearer tokens and OAuth state. None of this may reach the
 * browser — STRAPI_MCP_TOKEN grants content-manager CRUD on the Strapi instance.
 *
 * Config keys are meaningful: createMCPClients() prefixes each server's tools
 * with its key, so Strapi's `list_article` becomes `strapi_list_article` and the
 * docs server's search becomes `docs_*`. That prefixing prevents
 * MCPDuplicateToolNameError when two servers expose the same tool name.
 *
 * Two auth styles coexist here deliberately, because real MCP deployments use
 * both:
 *   - `strapi` — static bearer, from an admin API token in the environment.
 *   - `docs`   — OAuth 2.1 via `authProvider`. TanStack AI passes the provider
 *                to the SDK transport, which attaches and refreshes tokens and
 *                retries 401s with no further wiring.
 */

/** OAuth-protected MCP servers, keyed by pool key. */
export const OAUTH_SERVERS: Record<string, { url: string; label: string }> = {
  docs: {
    url: process.env.DOCS_MCP_URL ?? 'https://strapi-docs.mcp.kapa.ai',
    label: 'Strapi Docs',
  },
}

/** Public origin of this app, used to build the OAuth redirect URI. */
export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:3000'
}

export interface McpServerDescription {
  key: string
  label: string
  /** Present when the server is ready to connect. */
  transport?: HttpTransportConfig
  /** Why the server is not connectable, when it is not. */
  skipped?: string
  /** True when the server authenticates via OAuth rather than a static token. */
  oauth?: boolean
}

export function describeServers(): Array<McpServerDescription> {
  const out: Array<McpServerDescription> = []

  // --- Strapi: static bearer -------------------------------------------------
  const strapiUrl = process.env.STRAPI_MCP_URL ?? 'http://localhost:1350/mcp'
  const strapiToken = process.env.STRAPI_MCP_TOKEN
  out.push(
    strapiToken
      ? {
          key: 'strapi',
          label: 'Strapi',
          transport: {
            type: 'http',
            url: strapiUrl,
            headers: { Authorization: `Bearer ${strapiToken}` },
          },
        }
      : {
          key: 'strapi',
          label: 'Strapi',
          skipped:
            'STRAPI_MCP_TOKEN not set. Mint an ADMIN-kind token with ' +
            'strapi-backend/scripts/mint-mcp-token.js — a content token from ' +
            'Settings > API Tokens will 401 against /mcp.',
        },
  )

  // --- Docs: OAuth 2.1 via authProvider -------------------------------------
  // Only joins the pool once tokens exist. Handing the SDK an authProvider with
  // no tokens would make it attempt an interactive redirect during a chat
  // request, which cannot succeed from a server function.
  for (const [key, server] of Object.entries(OAUTH_SERVERS)) {
    if (hasTokens(key)) {
      out.push({
        key,
        label: server.label,
        oauth: true,
        transport: {
          type: 'http',
          url: server.url,
          authProvider: createOAuthProvider(key, appBaseUrl()),
        },
      })
    } else {
      out.push({
        key,
        label: server.label,
        oauth: true,
        skipped: 'Not connected. Authorize this server to add its tools.',
      })
    }
  }

  return out
}

/** Only the servers that are actually connectable, shaped for createMCPClients(). */
export function buildPoolConfig(): Record<string, { transport: HttpTransportConfig }> {
  const config: Record<string, { transport: HttpTransportConfig }> = {}
  for (const s of describeServers()) {
    if (s.transport) config[s.key] = { transport: s.transport }
  }
  return config
}
