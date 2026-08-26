/**
 * Client-safe provider catalogue.
 *
 * Deliberately imports no adapter packages — this module is bundled into the
 * browser so the picker can render labels. Adapter construction lives in
 * `adapters.server.ts`, which never reaches the client.
 */
export const PROVIDERS = [
  {
    value: 'anthropic',
    label: 'Claude Sonnet 5',
    model: 'claude-sonnet-5',
    requiresKey: true,
  },
  {
    value: 'ollama',
    label: 'Qwen3 14B (local)',
    model: 'qwen3:14b',
    requiresKey: false,
  },
] as const

export type ProviderId = (typeof PROVIDERS)[number]['value']

export const DEFAULT_PROVIDER: ProviderId = 'anthropic'
