import { createServerFn } from '@tanstack/react-start'
import { chat, maxIterations, toServerSentEventsResponse } from '@tanstack/ai'
import type { UIMessage } from '@tanstack/ai'
import { createMCPClients } from '@tanstack/ai-mcp'
import { resolveAdapter } from './adapters.server'
import { buildPoolConfig } from './mcp-servers.server'

export interface ChatFnInput {
  messages: Array<UIMessage>
  /** Model CHOICE TOKEN — `anthropic:<id>` or `local:<id>`. Never a bare id. */
  model?: string
}

/**
 * The chat server function. Pairs with `useChat({ fetcher })` on the client.
 *
 * The agent loop runs entirely server-side, so the Anthropic key and the Strapi
 * admin token never reach the browser.
 *
 * `.validator()` — NOT `.inputValidator()`, which is deprecated in the
 * published API even though @tanstack/ai's bundled examples still use it.
 */
export const chatFn = createServerFn({ method: 'POST' })
  .validator((data: ChatFnInput) => data)
  .handler(async ({ data }) => {
    // Resolve the model first: an uninstalled or unknown token is refused
    // here, with a notice, rather than silently answered by something else.
    const { adapter, modelId, notice } = await resolveAdapter(data.model)
    if (notice) console.warn(`[chat] ${notice}`)
    console.log(`[chat] answering with ${modelId}`)

    const poolConfig = buildPoolConfig()
    const hasServers = Object.keys(poolConfig).length > 0

    // createMCPClients() on an empty object would connect nothing and still
    // hand chat() a source; skipping the mcp option entirely keeps the
    // no-tools path identical to plain chat.
    const pool = hasServers ? await createMCPClients(poolConfig) : null

    const stream = chat({
      adapter,
      messages: data.messages as any,
      ...(pool
        ? {
            mcp: {
              clients: [pool],
              // 'close' is the default; stated explicitly because it is
              // load-bearing. chat() closes every pooled connection once the
              // stream drains. Never call pool.close() here — tools execute
              // lazily as the stream is consumed, so closing early breaks the
              // run mid-flight.
              connection: 'close' as const,
              // A server being down must not take the whole chat with it.
              // Default is fail-fast; returning here skips that source and
              // proceeds with the remaining clients' tools.
              onDiscoveryError(error: unknown) {
                console.warn('[mcp] discovery failed for a source, skipping:', error)
              },
            },
          }
        : {}),
      // Bounds the tool-call loop. A model that keeps calling tools without
      // converging stops here rather than running indefinitely.
      agentLoopStrategy: maxIterations(20),
      // NOTE: `lazyTools: true` belongs in mcp: {} once the tool count grows —
      // it withholds tool schemas until the model asks for them, which matters
      // because Strapi generates a tool set per content type.
      systemPrompts: [
        'You are a helpful assistant embedded in a Strapi content workspace.',
        'You have tools for querying Strapi content (prefixed `strapi_`) and,',
        'when configured, for searching the Strapi documentation (prefixed `docs_`).',
        'Prefer calling a tool over guessing. Say which tool you used.',
      ],
    })

    return toServerSentEventsResponse(stream)
  })
