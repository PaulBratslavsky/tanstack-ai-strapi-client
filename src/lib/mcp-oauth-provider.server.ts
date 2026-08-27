import { randomUUID } from 'node:crypto'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import { getServerState, patchServerState } from './mcp-oauth-store.server'

/**
 * An OAuthClientProvider backed by the file store, per MCP server.
 *
 * TanStack AI accepts any SDK `OAuthClientProvider` on the http transport's
 * `authProvider`; the SDK transport then attaches tokens, refreshes them, and
 * retries 401s with no further wiring (docs: tools/mcp — "OAuth (authProvider)").
 *
 * `redirectToAuthorization` is the one method that cannot behave normally on a
 * server: there is no user agent to redirect. Instead we capture the URL so a
 * server function can hand it to the browser, which is the same split the SDK
 * assumes for headless clients.
 */
export interface McpOAuthProvider extends OAuthClientProvider {
  /** Set by redirectToAuthorization when the SDK wants the user to authorize. */
  lastAuthorizationUrl?: string
}

export function createOAuthProvider(
  serverKey: string,
  appBaseUrl: string,
): McpOAuthProvider {
  const redirect = new URL('/oauth/callback', appBaseUrl).toString()

  const provider: McpOAuthProvider = {
    get redirectUrl() {
      return redirect
    },

    get clientMetadata(): OAuthClientMetadata {
      return {
        client_name: 'TanStack AI × Strapi demo',
        redirect_uris: [redirect],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        scope: 'openid',
      }
    },

    // The `state` param does double duty: CSRF protection, and letting the
    // callback route work out which server key an inbound code belongs to.
    state() {
      const s = randomUUID()
      patchServerState(serverKey, { state: s })
      return s
    },

    clientInformation(): OAuthClientInformationMixed | undefined {
      return getServerState(serverKey).clientInformation
    },

    saveClientInformation(info: OAuthClientInformationMixed) {
      patchServerState(serverKey, { clientInformation: info })
    },

    tokens(): OAuthTokens | undefined {
      return getServerState(serverKey).tokens
    },

    saveTokens(tokens: OAuthTokens) {
      patchServerState(serverKey, { tokens })
    },

    saveCodeVerifier(verifier: string) {
      patchServerState(serverKey, { codeVerifier: verifier })
    },

    codeVerifier(): string {
      const v = getServerState(serverKey).codeVerifier
      if (!v) {
        throw new Error(
          `No PKCE code verifier stored for "${serverKey}". Start the ` +
            `authorization flow again — the callback arrived without a ` +
            `matching in-flight request.`,
        )
      }
      return v
    },

    redirectToAuthorization(authorizationUrl: URL) {
      // No user agent here. Capture it; a server function returns it to the
      // browser, which performs the actual navigation.
      provider.lastAuthorizationUrl = authorizationUrl.toString()
    },

    invalidateCredentials(scope) {
      if (scope === 'all') {
        patchServerState(serverKey, {
          tokens: undefined,
          clientInformation: undefined,
          codeVerifier: undefined,
        })
      } else if (scope === 'tokens') {
        patchServerState(serverKey, { tokens: undefined })
      } else if (scope === 'verifier') {
        patchServerState(serverKey, { codeVerifier: undefined })
      } else if (scope === 'client') {
        patchServerState(serverKey, { clientInformation: undefined })
      }
    },
  }

  return provider
}

/**
 * Build a transport instance we keep a reference to.
 *
 * `createMCPClient` constructs its transport internally and therefore cannot
 * expose `finishAuth(code)`, which the authorization-code grant requires. The
 * documented escape hatch is to build the transport yourself and pass the
 * instance in — `TransportInput` accepts a ready-made SDK `Transport`.
 */
export function createOAuthTransport(
  url: string,
  authProvider: OAuthClientProvider,
): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(url), { authProvider })
}
