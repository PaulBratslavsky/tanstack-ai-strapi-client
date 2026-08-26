import { anthropicText } from '@tanstack/ai-anthropic'
import { ollamaText } from '@tanstack/ai-ollama'

/**
 * Resolve a provider id to a TanStack AI text adapter.
 *
 * This is the ONLY provider-specific code in the app. The agent loop, MCP tool
 * discovery, tool execution and SSE encoding are all provider-agnostic — which
 * is exactly what Phase 3's gate demonstrates when the same MCP tools drive
 * from a local model.
 *
 * `.server.ts` suffix: this module reads API keys. An accidental import from a
 * client component must fail at build time rather than ship a key to a browser.
 */
export function resolveTextAdapter(provider: string | undefined) {
  switch (provider) {
    case 'ollama':
      // ollamaText() reads OLLAMA_HOST, defaulting to http://localhost:11434.
      // Use createOllamaChat(model, host) if an explicit host is ever needed.
      return ollamaText('qwen3:14b')
    case 'anthropic':
    default:
      // anthropicText() reads ANTHROPIC_API_KEY from the environment.
      return anthropicText('claude-sonnet-5')
  }
}
