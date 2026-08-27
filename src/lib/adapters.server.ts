import { anthropicText, ANTHROPIC_MODELS } from '@tanstack/ai-anthropic'
import type { AnthropicChatModel } from '@tanstack/ai-anthropic'
import { ollamaText } from '@tanstack/ai-ollama'
import { listInstalledOllamaModels } from './ollama-catalog.server'

/**
 * Resolves a model CHOICE TOKEN to a TanStack AI adapter.
 *
 * This is the only provider-specific code in the app. Everything downstream —
 * the agent loop, MCP discovery, tool execution, SSE encoding — is
 * provider-agnostic.
 *
 * `.server.ts`: reads API keys. An accidental client import must fail at build
 * time rather than ship a key to a browser.
 *
 * TOKENS, not model ids. The browser sends `anthropic:<id>` or `local:<id>` and
 * the server validates it before constructing anything:
 *   - `local:` ids are checked against what Ollama actually has installed
 *   - `anthropic:` ids are checked against the adapter's own ANTHROPIC_MODELS
 * An unknown id is REFUSED and reported, never silently swapped for a default —
 * answering from a different model than the picker shows misattributes the
 * answer, and does it without raising anything.
 */
export { DEFAULT_MODEL_TOKEN } from './model-token'
import { DEFAULT_MODEL_TOKEN } from './model-token'

export function anthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export interface ResolvedAdapter {
  adapter: ReturnType<typeof anthropicText> | ReturnType<typeof ollamaText>
  /** The model that will actually answer — echoed back so the UI can't lie. */
  modelId: string
  /** Set when the request did NOT get what it asked for. */
  notice?: string
}

export async function resolveAdapter(token: unknown): Promise<ResolvedAdapter> {
  const raw = typeof token === 'string' && token ? token : DEFAULT_MODEL_TOKEN

  if (raw.startsWith('local:')) {
    const id = raw.slice('local:'.length).trim()
    const installed = (await listInstalledOllamaModels()).map((m) => m.id)
    if (!id || !installed.includes(id)) {
      return {
        ...(await resolveAdapter(DEFAULT_MODEL_TOKEN)),
        notice: `Model ${JSON.stringify(id)} is not installed on this Ollama host — answered with the default instead.`,
      }
    }
    // ollamaText() reads OLLAMA_HOST, defaulting to http://localhost:11434.
    return { adapter: ollamaText(id), modelId: id }
  }

  if (raw.startsWith('anthropic:')) {
    const id = raw.slice('anthropic:'.length).trim()
    if (!anthropicAvailable()) {
      return {
        adapter: ollamaText('qwen3:14b'),
        modelId: 'qwen3:14b',
        notice: 'A hosted model was requested but ANTHROPIC_API_KEY is not set — answered locally.',
      }
    }
    if (!(ANTHROPIC_MODELS as ReadonlyArray<string>).includes(id)) {
      return {
        adapter: anthropicText('claude-sonnet-5'),
        modelId: 'claude-sonnet-5',
        notice: `${JSON.stringify(id)} is not a recognised Anthropic model — answered with claude-sonnet-5.`,
      }
    }
    // anthropicText() reads ANTHROPIC_API_KEY from the environment.
    return { adapter: anthropicText(id as AnthropicChatModel), modelId: id }
  }

  return resolveAdapter(DEFAULT_MODEL_TOKEN)
}
