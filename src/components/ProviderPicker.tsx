import { useEffect, useState } from 'react'
import { listChatModelsFn, type ChatModelOption } from '@/lib/models.functions'

/**
 * Model picker, populated from the server rather than a hardcoded list.
 *
 * `listChatModelsFn` enumerates every Ollama model actually installed plus the
 * adapter's Anthropic catalogue (the latter only when a key is configured), so
 * the options reflect this deployment instead of an assumption.
 *
 * `value` is a CHOICE TOKEN (`anthropic:<id>` / `local:<id>`), never a bare
 * model id — the server re-validates it before building an adapter, so a stale
 * tab cannot select a model that has since been removed.
 */
export function ProviderPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (token: string) => void
  disabled?: boolean
}) {
  const [options, setOptions] = useState<Array<ChatModelOption> | null>(null)

  useEffect(() => {
    let cancelled = false
    void listChatModelsFn()
      .then((o) => !cancelled && setOptions(o))
      .catch(() => !cancelled && setOptions([]))
    return () => {
      cancelled = true
    }
  }, [])

  const groups = ['Hosted', 'Local'] as const
  const loading = options === null
  const empty = options?.length === 0

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">Model</span>
      <select
        value={value}
        disabled={disabled || loading || empty}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[15rem] rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm disabled:opacity-50"
      >
        {loading && <option>loading…</option>}
        {empty && <option>no models available</option>}
        {groups.map((g) => {
          const inGroup = (options ?? []).filter((o) => o.group === g)
          if (inGroup.length === 0) return null
          return (
            <optgroup key={g} label={g === 'Hosted' ? 'Hosted (Anthropic)' : 'Local (Ollama)'}>
              {inGroup.map((o) => (
                <option key={o.token} value={o.token}>
                  {o.label}
                  {o.detail ? ` · ${o.detail}` : ''}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
