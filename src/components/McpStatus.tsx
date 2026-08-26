import { useEffect, useState } from 'react'
import { getMcpStatusFn, type McpServerStatus } from '@/lib/mcp-status.functions'

export function McpStatus() {
  const [status, setStatus] = useState<Array<McpServerStatus> | null>(null)

  useEffect(() => {
    let cancelled = false
    // Data fetching goes through the server function, never a bare fetch().
    void getMcpStatusFn()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus([]))
    return () => {
      cancelled = true
    }
  }, [])

  if (!status) return <span className="text-xs text-gray-500">checking MCP…</span>

  return (
    <div className="flex items-center gap-3 text-xs">
      {status.map((s) => (
        <span
          key={s.key}
          title={s.ok ? s.toolNames.join(', ') : s.error}
          className={s.ok ? 'text-emerald-400' : 'text-gray-500'}
        >
          {s.ok ? '●' : '○'} {s.key}
          {s.ok ? ` (${s.toolCount})` : ' —'}
        </span>
      ))}
    </div>
  )
}
