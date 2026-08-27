import { createServerFn } from '@tanstack/react-start'
import { auth } from '@modelcontextprotocol/sdk/client/auth.js'
import { createOAuthProvider } from './mcp-oauth-provider.server'
import { clearServerState, hasTokens } from './mcp-oauth-store.server'
import { OAUTH_SERVERS, appBaseUrl } from './mcp-servers.server'

export interface OAuthStartResult {
  /** Where the browser must navigate to authorize, or null if already authorized. */
  authorizationUrl: string | null
  alreadyAuthorized: boolean
}

/**
 * Begins (or short-circuits) the OAuth flow for one MCP server.
 *
 * `auth()` drives discovery + dynamic client registration + PKCE, then calls
 * our provider's `redirectToAuthorization`, which records the URL instead of
 * redirecting (there is no user agent on the server). We hand that URL back so
 * the browser can navigate to it.
 *
 * Returns 'AUTHORIZED' without a URL when stored tokens are still usable.
 */
export const startMcpOAuthFn = createServerFn({ method: 'POST' })
  .validator((data: { serverKey: string }) => data)
  .handler(async ({ data }): Promise<OAuthStartResult> => {
    const server = OAUTH_SERVERS[data.serverKey]
    if (!server) {
      throw new Error(`Unknown OAuth MCP server: ${data.serverKey}`)
    }

    const provider = createOAuthProvider(data.serverKey, appBaseUrl())
    const result = await auth(provider, { serverUrl: server.url })

    if (result === 'AUTHORIZED') {
      return { authorizationUrl: null, alreadyAuthorized: true }
    }

    if (!provider.lastAuthorizationUrl) {
      throw new Error(
        'auth() requested a redirect but produced no authorization URL.',
      )
    }
    return {
      authorizationUrl: provider.lastAuthorizationUrl,
      alreadyAuthorized: false,
    }
  })

/** Whether a given OAuth-protected server currently has usable tokens. */
export const getMcpOAuthStateFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Record<string, boolean>> => {
    const out: Record<string, boolean> = {}
    for (const key of Object.keys(OAUTH_SERVERS)) out[key] = hasTokens(key)
    return out
  },
)

/** Forget stored tokens so the next connect re-runs the browser flow. */
export const disconnectMcpOAuthFn = createServerFn({ method: 'POST' })
  .validator((data: { serverKey: string }) => data)
  .handler(async ({ data }) => {
    clearServerState(data.serverKey)
    return { ok: true }
  })
