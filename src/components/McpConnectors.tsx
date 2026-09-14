import { useCallback, useEffect, useState } from 'react'
import {
  listMcpServersFn,
  addMcpServerFn,
  removeMcpServerFn,
  setMcpServerEnabledFn,
  connectMcpOAuthFn,
  disconnectMcpOAuthFn,
  type McpServerView,
} from '@/lib/mcp-servers.functions'
import type { McpAuthKind } from '@/lib/mcp-registry.server'

/** Presets so common servers are one click, without hardcoding them anywhere else. */
const PRESETS = [
  { label: 'Strapi Docs', url: 'https://strapi-docs.mcp.kapa.ai', auth: 'oauth' as McpAuthKind },
  { label: 'Strapi', url: 'http://localhost:1360/mcp', auth: 'bearer' as McpAuthKind },
]

export function McpConnectors({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [servers, setServers] = useState<Array<McpServerView> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '',
    url: '',
    auth: 'none' as McpAuthKind,
    token: '',
  })

  const refresh = useCallback(() => {
    void listMcpServersFn()
      .then(setServers)
      .catch(() => setServers([]))
  }, [])

  useEffect(() => {
    if (!open) return
    refresh()
    // The OAuth flow finishes in another tab; refresh on focus so a newly
    // authorized server appears without a manual reload.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [open, refresh])

  if (!open) return null

  const add = async () => {
    if (!form.url.trim() || !form.label.trim()) return
    setBusy('add')
    try {
      await addMcpServerFn({ data: { ...form, token: form.token || undefined } })
      setForm({ label: '', url: '', auth: 'none', token: '' })
      refresh()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const connect = async (id: string) => {
    setBusy(id)
    try {
      const { authorizationUrl, alreadyAuthorized } = await connectMcpOAuthFn({ data: { id } })
      if (alreadyAuthorized || !authorizationUrl) return refresh()
      // The server has no user agent to redirect; the browser navigates using
      // the URL auth() produced.
      window.open(authorizationUrl, '_blank', 'noopener')
    } catch (e) {
      alert(`Could not start authorization: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    try {
      await fn()
      refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-8" onClick={onClose}>
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-100">MCP Servers</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        {/* --- configured servers --- */}
        <div className="space-y-2">
          {servers === null && <p className="text-sm text-gray-500">Loading…</p>}
          {servers?.length === 0 && (
            <p className="text-sm text-gray-500">No MCP servers yet. Add one below.</p>
          )}
          {servers?.map((s) => (
            <div key={s.id} className="rounded-lg border border-gray-700 bg-gray-850 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={s.connected ? 'text-emerald-400' : 'text-gray-500'}>
                      {s.connected ? '●' : '○'}
                    </span>
                    <span className="font-medium text-gray-100">{s.label}</span>
                    <code className="rounded bg-gray-800 px-1 text-xs text-cyan-300">{s.key}_*</code>
                    <span className="rounded bg-gray-800 px-1.5 text-xs text-gray-400">{s.auth}</span>
                  </div>
                  <div className="truncate text-xs text-gray-500">{s.url}</div>
                  {s.connected ? (
                    <div className="mt-1 text-xs text-emerald-300/80" title={s.toolNames.join(', ')}>
                      {s.toolCount} tools
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-amber-400/80">{s.error}</div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {s.auth === 'oauth' && !s.hasToken && (
                    <button
                      onClick={() => connect(s.id)}
                      disabled={busy === s.id}
                      className="rounded border border-cyan-700 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50"
                    >
                      {busy === s.id ? '…' : 'Connect'}
                    </button>
                  )}
                  {s.auth === 'oauth' && s.hasToken && (
                    <button
                      onClick={() => act(s.id, () => disconnectMcpOAuthFn({ data: { id: s.id } }))}
                      disabled={busy === s.id}
                      className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    onClick={() =>
                      act(s.id, () => setMcpServerEnabledFn({ data: { id: s.id, enabled: !s.enabled } }))
                    }
                    disabled={busy === s.id}
                    className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                  >
                    {s.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => act(s.id, () => removeMcpServerFn({ data: { id: s.id } }))}
                    disabled={busy === s.id}
                    className="rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-900/30 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- add a server --- */}
        <div className="mt-5 rounded-lg border border-gray-700 p-3">
          <h3 className="mb-2 text-sm font-medium text-gray-200">Add an MCP server</h3>

          <div className="mb-2 flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setForm({ label: p.label, url: p.url, auth: p.auth, token: '' })}
                className="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-800"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2">
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Name (becomes the tool prefix)"
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
            />
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/mcp"
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={form.auth}
                onChange={(e) => setForm({ ...form, auth: e.target.value as McpAuthKind })}
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
              >
                <option value="none">No auth</option>
                <option value="bearer">Bearer token</option>
                <option value="oauth">OAuth 2.1</option>
              </select>
              {form.auth === 'bearer' && (
                <input
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  placeholder="Bearer token (stored server-side only)"
                  type="password"
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm"
                />
              )}
            </div>
            <button
              onClick={add}
              disabled={busy === 'add' || !form.url.trim() || !form.label.trim()}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm hover:bg-cyan-700 disabled:opacity-50"
            >
              {busy === 'add' ? 'Adding…' : 'Add server'}
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Adding a server lets its operator influence which tools the model sees and what
            they return. Only add servers you trust. Tokens are stored server-side and are
            never sent back to the browser.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Compact header strip: per-server dots plus the button that opens the panel. */
export function McpStatusBar({ onOpen }: { onOpen: () => void }) {
  const [servers, setServers] = useState<Array<McpServerView> | null>(null)

  const refresh = useCallback(() => {
    void listMcpServersFn().then(setServers).catch(() => setServers([]))
  }, [])

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  return (
    <div className="flex items-center gap-3 text-xs">
      {servers === null ? (
        <span className="text-gray-500">checking MCP…</span>
      ) : servers.length === 0 ? (
        <span className="text-gray-500">no MCP servers</span>
      ) : (
        // One entry per configured server. The number is how many TOOLS that
        // server offers, spelled out: a bare "strapi (11)" read as the server
        // being listed eleven times. Each entry opens the panel, which is where
        // a server is disabled or removed.
        servers.map((s) => (
          <button
            key={s.id}
            onClick={onOpen}
            title={s.connected ? s.toolNames.join(', ') : s.error}
            className={`rounded px-1 hover:bg-gray-800 ${s.connected ? 'text-emerald-400' : 'text-gray-500'}`}
          >
            {s.connected ? '●' : '○'} {s.label}
            <span className="text-gray-500">
              {s.connected ? ` · ${s.toolCount} ${s.toolCount === 1 ? 'tool' : 'tools'}` : ' · offline'}
            </span>
          </button>
        ))
      )}
      <button
        onClick={onOpen}
        className="rounded border border-gray-700 px-2 py-0.5 text-gray-300 hover:bg-gray-800"
      >
        Manage MCP servers
      </button>
    </div>
  )
}
