import { createServerFn } from '@tanstack/react-start'
import { createMCPClients } from '@tanstack/ai-mcp'
import { auth } from '@modelcontextprotocol/sdk/client/auth.js'
import {
  addServer,
  getServer,
  listServers,
  removeServer,
  updateServer,
  validateUrl,
  type McpAuthKind,
} from './mcp-registry.server'
import { describeServers, appBaseUrl } from './mcp-servers.server'
import { createOAuthProvider } from './mcp-oauth-provider.server'
import { clearServerState, hasTokens } from './mcp-oauth-store.server'

/**
 * Client-facing view of a configured MCP server.
 *
 * Deliberately omits `token` and header VALUES. The browser learns that a
 * credential exists (`hasToken`) and which header keys are set, never the
 * secrets themselves — there is no read path back to them.
 */
export interface McpServerView {
  id: string
  key: string
  label: string
  url: string
  auth: McpAuthKind
  enabled: boolean
  hasToken: boolean
  headerKeys: Array<string>
  connected: boolean
  toolCount: number
  toolNames: Array<string>
  error?: string
}

/** List every configured server and probe each one's live state. */
export const listMcpServersFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<McpServerView>> => {
    const records = listServers()
    const described = describeServers()

    return Promise.all(
      records.map(async (r): Promise<McpServerView> => {
        const d = described.find((x) => x.id === r.id)
        const base: McpServerView = {
          id: r.id,
          key: r.key,
          label: r.label,
          url: r.url,
          auth: r.auth,
          enabled: r.enabled,
          hasToken: r.auth === 'oauth' ? hasTokens(r.id) : Boolean(r.token),
          headerKeys: Object.keys(r.headers ?? {}),
          connected: false,
          toolCount: 0,
          toolNames: [],
        }

        if (!d?.transport) return { ...base, error: d?.skipped ?? 'Not configured.' }

        try {
          const pool = await createMCPClients({ [r.key]: { transport: d.transport } })
          try {
            const tools = await pool.tools()
            return {
              ...base,
              connected: true,
              toolCount: tools.length,
              toolNames: tools.map((t: any) => t.name).slice(0, 60),
            }
          } finally {
            // Safe here (unlike in chatFn): tools() is fully drained before close.
            await pool.close()
          }
        } catch (e) {
          return { ...base, error: e instanceof Error ? e.message : String(e) }
        }
      }),
    )
  },
)

export const addMcpServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      label: string
      url: string
      auth: McpAuthKind
      token?: string
      headers?: Record<string, string>
    }) => data,
  )
  .handler(async ({ data }) => {
    validateUrl(data.url)
    const rec = addServer(data)
    return { id: rec.id, key: rec.key }
  })

export const removeMcpServerFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    clearServerState(data.id) // drop any OAuth tokens with the record
    removeServer(data.id)
    return { ok: true }
  })

export const setMcpServerEnabledFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    updateServer(data.id, { enabled: data.enabled })
    return { ok: true }
  })

export interface OAuthStartResult {
  authorizationUrl: string | null
  alreadyAuthorized: boolean
}

/**
 * Begins (or short-circuits) the OAuth flow for a registered server.
 *
 * `auth()` drives discovery + dynamic client registration + PKCE, then calls
 * our provider's `redirectToAuthorization`, which records the URL instead of
 * redirecting — there is no user agent on the server. We return that URL so
 * the browser can navigate to it.
 */
export const connectMcpOAuthFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<OAuthStartResult> => {
    const server = getServer(data.id)
    if (!server) throw new Error(`No MCP server with id ${data.id}`)
    if (server.auth !== 'oauth') throw new Error(`Server "${server.label}" is not an OAuth server.`)

    const provider = createOAuthProvider(server.id, appBaseUrl())
    const result = await auth(provider, { serverUrl: server.url })

    if (result === 'AUTHORIZED') return { authorizationUrl: null, alreadyAuthorized: true }
    if (!provider.lastAuthorizationUrl) {
      throw new Error('auth() requested a redirect but produced no authorization URL.')
    }
    return { authorizationUrl: provider.lastAuthorizationUrl, alreadyAuthorized: false }
  })

/** Forget stored OAuth tokens so the next connect re-runs the browser flow. */
export const disconnectMcpOAuthFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    clearServerState(data.id)
    return { ok: true }
  })
