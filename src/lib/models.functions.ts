import { createServerFn } from '@tanstack/react-start'
import { ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import { listInstalledOllamaModels } from './ollama-catalog.server'
import { anthropicAvailable, DEFAULT_MODEL_TOKEN } from './adapters.server'

export interface ChatModelOption {
  /** What the client sends back — never a bare model id. */
  token: string
  label: string
  group: 'Hosted' | 'Local'
  detail?: string
  isDefault?: boolean
}

/**
 * The models this deployment can actually use, for the picker.
 *
 * Local entries come from Ollama's /api/tags, so the list reflects what is
 * really installed rather than a hardcoded pair. Hosted entries come from the
 * adapter's own ANTHROPIC_MODELS and appear only when a key is configured — the
 * browser learns that hosted models are *available*, never the key itself.
 *
 * Ollama being unreachable yields hosted-only rather than an error; a picker
 * with fewer options beats a chat page that will not render.
 */
export const listChatModelsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<ChatModelOption>> => {
    const options: Array<ChatModelOption> = []

    if (anthropicAvailable()) {
      for (const id of ANTHROPIC_MODELS) {
        options.push({
          token: `anthropic:${id}`,
          label: id,
          group: 'Hosted',
          isDefault: `anthropic:${id}` === DEFAULT_MODEL_TOKEN,
        })
      }
    }

    for (const m of await listInstalledOllamaModels()) {
      options.push({
        token: `local:${m.id}`,
        label: m.id,
        group: 'Local',
        detail: m.parameterSize,
      })
    }

    return options
  },
)
