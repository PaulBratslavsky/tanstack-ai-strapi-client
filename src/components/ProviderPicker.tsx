import { PROVIDERS, type ProviderId } from '@/lib/providers'

export function ProviderPicker({
  value,
  onChange,
  disabled,
}: {
  value: ProviderId
  onChange: (v: ProviderId) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">Model</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ProviderId)}
        className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm disabled:opacity-50"
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  )
}
