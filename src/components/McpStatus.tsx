import { useCallback, useEffect, useState } from 'react'
import { getMcpStatusFn, type McpServerStatus } from '@/lib/mcp-status.functions'
import { startMcpOAuthFn, disconnectMcpOAuthFn } from '@/lib/mcp-oauth.functions'

export function McpStatus() {
  const [status, setStatus] = useState<Array<McpServerStatus> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => {
    // Data fetching goes through the server function, never a bare fetch().
    void getMcpStatusFn()
      .then(setStatus)
      .catch(() => setStatus([]))
  }, [])

  useEffect(() => {
    refresh()
    // The OAuth flow completes in another tab; refresh when we regain focus so
    // a newly-authorized server shows up without a manual reload.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const connect = async (serverKey: string) => {
    setBusy(serverKey)
    try {
      const { authorizationUrl, alreadyAuthorized } = await startMcpOAuthFn({
        data: { serverKey },
      })
      if (alreadyAuthorized || !authorizationUrl) {
        refresh()
        return
      }
      // The server cannot redirect a user agent it does not have; the browser
      // performs the navigation with the URL auth() produced.
      window.open(authorizationUrl, '_blank', 'noopener')
    } catch (e) {
      alert(`Could not start authorization: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async (serverKey: string) => {
    setBusy(serverKey)
    try {
      await disconnectMcpOAuthFn({ data: { serverKey } })
      refresh()
    } finally {
      setBusy(null)
    }
  }

  if (!status) return <span className="text-xs text-gray-500">checking MCP…</span>

  return (
    <div className="flex items-center gap-3 text-xs">
      {status.map((s) => (
        <span key={s.key} className="flex items-center gap-1">
          <span
            title={s.ok ? s.toolNames.join(', ') : s.error}
            className={s.ok ? 'text-emerald-400' : 'text-gray-500'}
          >
            {s.ok ? '●' : '○'} {s.key}
            {s.ok ? ` (${s.toolCount})` : ' —'}
          </span>
          {s.oauth && !s.ok && (
            <button
              onClick={() => connect(s.key)}
              disabled={busy === s.key}
              className="rounded border border-cyan-700 px-1.5 py-0.5 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50"
            >
              {busy === s.key ? '…' : 'connect'}
            </button>
          )}
          {s.oauth && s.ok && (
            <button
              onClick={() => disconnect(s.key)}
              disabled={busy === s.key}
              className="rounded border border-gray-700 px-1.5 py-0.5 text-gray-400 hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === s.key ? '…' : 'disconnect'}
            </button>
          )}
        </span>
      ))}
    </div>
  )
}
