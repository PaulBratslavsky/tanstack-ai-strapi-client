import type { HttpTransportConfig } from '@tanstack/ai-mcp'
import { createOAuthProvider } from './mcp-oauth-provider.server'
import { hasTokens } from './mcp-oauth-store.server'
import { listServers, type McpServerRecord } from './mcp-registry.server'

/**
 * Turns registry records into a createMCPClients() pool config.
 *
 * `.server.ts`: reads bearer tokens and OAuth state. None of it may reach the
 * browser.
 *
 * Pool keys are the record's `key`, and createMCPClients() prefixes each
 * server's tools with it — so a server keyed `strapi` exposes
 * `strapi_list_article`. That prefixing is what prevents
 * MCPDuplicateToolNameError between servers sharing a tool name.
 *
 * Three auth kinds are supported because real MCP deployments use all three:
 *   none   — public server, no credentials
 *   bearer — static token in a header (e.g. a Strapi admin API token)
 *   oauth  — OAuth 2.1 via `authProvider`; TanStack AI hands the provider to
 *            the SDK transport, which attaches/refreshes tokens and retries 401s
 */

/** Public origin of this app, used to build the OAuth redirect URI. */
export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:3000'
}

export interface McpServerDescription {
  id: string
  key: string
  label: string
  url: string
  auth: McpServerRecord['auth']
  enabled: boolean
  /** Present when the server is ready to connect. */
  transport?: HttpTransportConfig
  /** Why the server is not connectable, when it is not. */
  skipped?: string
}

function transportFor(s: McpServerRecord): HttpTransportConfig | undefined {
  if (s.auth === 'none') {
    return { type: 'http', url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
  }
  if (s.auth === 'bearer') {
    if (!s.token) return undefined
    return {
      type: 'http',
      url: s.url,
      headers: { Authorization: `Bearer ${s.token}`, ...(s.headers ?? {}) },
    }
  }
  // oauth: only join the pool once tokens exist. Handing the SDK an
  // authProvider with no tokens makes it attempt an interactive redirect
  // during a chat request, which cannot succeed from a server function.
  if (!hasTokens(s.id)) return undefined
  return {
    type: 'http',
    url: s.url,
    authProvider: createOAuthProvider(s.id, appBaseUrl()),
    ...(s.headers ? { headers: s.headers } : {}),
  }
}

function skipReason(s: McpServerRecord): string {
  if (!s.enabled) return 'Disabled.'
  if (s.auth === 'bearer') return 'No bearer token saved for this server.'
  if (s.auth === 'oauth') return 'Not connected. Authorize this server to add its tools.'
  return 'Not connectable.'
}

export function describeServers(): Array<McpServerDescription> {
  return listServers().map((s) => {
    const transport = s.enabled ? transportFor(s) : undefined
    return {
      id: s.id,
      key: s.key,
      label: s.label,
      url: s.url,
      auth: s.auth,
      enabled: s.enabled,
      ...(transport ? { transport } : { skipped: skipReason(s) }),
    }
  })
}

/** Only the servers that are actually connectable, shaped for createMCPClients(). */
export function buildPoolConfig(): Record<string, { transport: HttpTransportConfig }> {
  const config: Record<string, { transport: HttpTransportConfig }> = {}
  for (const s of describeServers()) {
    if (s.transport) config[s.key] = { transport: s.transport }
  }
  return config
}
