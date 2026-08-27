import { createFileRoute } from '@tanstack/react-router'
import { createOAuthProvider, createOAuthTransport } from '@/lib/mcp-oauth-provider.server'
import { findServerByState, patchServerState } from '@/lib/mcp-oauth-store.server'
import { appBaseUrl } from '@/lib/mcp-servers.server'
import { getServer } from '@/lib/mcp-registry.server'

/**
 * OAuth redirect target. A server ROUTE, not a server function: this endpoint
 * is called by the authorization server's browser redirect, i.e. from outside
 * the app, which is precisely the distinction Start's docs draw between the two.
 *
 * `transport.finishAuth(code)` performs the code-for-token exchange and stores
 * the result through our provider. This is why the transport has to be built
 * here rather than left to createMCPClient — createMCPClient owns its transport
 * internally and cannot expose finishAuth.
 */
export const Route = createFileRoute('/oauth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        if (error) {
          return html(
            400,
            'Authorization failed',
            `The authorization server returned <code>${escapeHtml(error)}</code>.`,
          )
        }
        if (!code || !state) {
          return html(400, 'Missing parameters', 'The callback had no <code>code</code> or <code>state</code>.')
        }

        // `state` tells us which registered server this callback belongs to,
        // and proves the flow was started by us.
        const serverId = findServerByState(state)
        if (!serverId) {
          return html(
            400,
            'Unrecognized state',
            'No in-flight authorization matches this callback. Start the flow again.',
          )
        }

        const server = getServer(serverId)
        if (!server) {
          return html(400, 'Unknown server', `No MCP server registered with id "${escapeHtml(serverId)}".`)
        }

        try {
          const provider = createOAuthProvider(serverId, appBaseUrl())
          const transport = createOAuthTransport(server.url, provider)
          await transport.finishAuth(code)
          await transport.close()
          // One-shot values; clearing them stops a replayed callback working.
          patchServerState(serverId, { codeVerifier: undefined, state: undefined })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return html(500, 'Token exchange failed', `<code>${escapeHtml(message)}</code>`)
        }

        return html(
          200,
          'Connected',
          `<strong>${escapeHtml(server.label)}</strong> is authorized. You can close this tab and return to the app.`,
          true,
        )
      },
    },
  },
})

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function html(status: number, title: string, body: string, ok = false) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;background:#030712;color:#e5e7eb;padding:3rem;line-height:1.6">
<h1 style="color:${ok ? '#34d399' : '#f87171'}">${title}</h1>
<p>${body}</p>
${ok ? '<p><a href="/" style="color:#22d3ee">← Back to the chat</a></p>' : ''}
</body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
