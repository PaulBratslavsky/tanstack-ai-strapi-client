import { anthropicText } from '@tanstack/ai-anthropic'

/**
 * Resolve a provider id to a TanStack AI text adapter.
 *
 * This is the ONLY provider-specific code in the app. Everything downstream —
 * the agent loop, MCP tool discovery, tool execution, SSE encoding — is
 * provider-agnostic. Task 2.1 adds Ollama here and nothing else changes,
 * which is the point the demo is making.
 *
 * `.server.ts` suffix: this module reads API keys. An accidental import from a
 * client component must fail at build time rather than ship a key to a browser.
 */
export function resolveTextAdapter(provider: string | undefined) {
  switch (provider) {
    case 'anthropic':
    default:
      // anthropicText() reads ANTHROPIC_API_KEY from the environment.
      return anthropicText('claude-sonnet-5')
  }
}
