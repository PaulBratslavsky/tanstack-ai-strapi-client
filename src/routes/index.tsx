import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@tanstack/ai-react'
import { chatFn } from '@/lib/chat.functions'
import { MessageList } from '@/components/MessageList'
import { ProviderPicker } from '@/components/ProviderPicker'
import { DEFAULT_PROVIDER, type ProviderId } from '@/lib/providers'
import { McpStatus } from '@/components/McpStatus'

export const Route = createFileRoute('/')({ component: ChatPage })

function ChatPage() {
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER)

  // `fetcher` hands the chat client a function that returns an SSE Response.
  // This is the documented alternative to `connection: fetchServerSentEvents(url)`
  // and is what lets the transport be a server function rather than a route.
  //
  // `provider` is read inside the fetcher body, so each request picks up the
  // current value. useChat does not memoize the fetcher against it.
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    fetcher: ({ messages }, { signal }) =>
      chatFn({ data: { messages, provider }, signal }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    void sendMessage(input)
    setInput('')
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">TanStack AI × Strapi</h1>
          <McpStatus />
        </div>
        <ProviderPicker value={provider} onChange={setProvider} disabled={isLoading} />
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <MessageList messages={messages} />
        {error && (
          <div className="rounded-lg border border-red-700/60 bg-red-900/30 px-3 py-2 text-sm text-red-200">
            {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-800 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
        />
        {isLoading ? (
          <button type="button" onClick={stop} className="rounded-lg bg-red-600 px-4 py-2">
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-cyan-600 px-4 py-2 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  )
}
