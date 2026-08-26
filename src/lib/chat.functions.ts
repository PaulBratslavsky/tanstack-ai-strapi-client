import { createServerFn } from '@tanstack/react-start'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import type { UIMessage } from '@tanstack/ai'
import { resolveTextAdapter } from './adapters.server'

export interface ChatFnInput {
  messages: Array<UIMessage>
  provider?: string
}

/**
 * The chat server function. Pairs with `useChat({ fetcher })` on the client.
 *
 * Returns an SSE `Response`; the chat client parses the stream. The agent loop
 * runs entirely server-side, so API keys and (from Phase 3) MCP tokens never
 * reach the browser.
 *
 * `.validator()` — NOT `.inputValidator()`, which is deprecated in the
 * published API even though @tanstack/ai's bundled examples still use it.
 */
export const chatFn = createServerFn({ method: 'POST' })
  .validator((data: ChatFnInput) => data)
  .handler(({ data }) =>
    toServerSentEventsResponse(
      chat({
        adapter: resolveTextAdapter(data.provider),
        messages: data.messages as any,
        systemPrompts: [
          'You are a helpful assistant embedded in a Strapi content workspace.',
          'Keep replies concise.',
        ],
      }),
    ),
  )
