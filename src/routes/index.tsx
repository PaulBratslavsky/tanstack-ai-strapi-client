import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useChat } from '@tanstack/ai-react'
import { chatFn } from '@/lib/chat.functions'
import { MessageList } from '@/components/MessageList'
import { ProviderPicker } from '@/components/ProviderPicker'
import { DEFAULT_MODEL_TOKEN } from '@/lib/model-token'
import { McpConnectors, McpStatusBar } from '@/components/McpConnectors'
import { WorkingIndicator } from '@/components/WorkingIndicator'

export const Route = createFileRoute('/')({ component: ChatPage })

function ChatPage() {
  const [input, setInput] = useState('')
  const [model, setModel] = useState<string>(DEFAULT_MODEL_TOKEN)
  const [mcpOpen, setMcpOpen] = useState(false)

  // `fetcher` hands the chat client a function that returns an SSE Response.
  // This is the documented alternative to `connection: fetchServerSentEvents(url)`
  // and is what lets the transport be a server function rather than a route.
  //
  // `model` arrives as a PARAMETER on `input.data`, not as a captured variable.
  // useChat holds its options object from the first render, so a fetcher
  // closing over `model` would send the INITIAL value forever — the picker
  // changes the UI and nothing else, silently, with no error. Passing it
  // per-send via `sendMessage(content, { body })` removes the failure mode
  // rather than working around it: there is nothing captured to go stale.
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    fetcher: ({ messages, data }, { signal }) =>
      chatFn({
        data: { messages, model: data?.model as string | undefined },
        signal,
      }),
  })

  // Follow the reply as it streams, but only while the reader is at the bottom:
  // scrolling up to read an earlier answer stops the follow, and scrolling back
  // down (or sending a message) resumes it. Refs, not state, so a scroll event
  // does not re-render the whole message list.
  //
  // The follow stops on the DIRECTION of a scroll, not the distance from the
  // bottom. Scroll events arrive after the frame that caused them, so a large
  // chunk (a tool result, a long paragraph) can land in between and put the
  // view far from the bottom without the reader moving at all. Measured by
  // distance, that reads as "scrolled away" and silently ends the follow.
  const scrollRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)
  const lastTopRef = useRef(0)
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop < lastTopRef.current - 2) followRef.current = false
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) followRef.current = true
    lastTopRef.current = el.scrollTop
  }
  useEffect(() => {
    const el = scrollRef.current
    if (el && followRef.current) el.scrollTop = el.scrollHeight
  }, [messages, error, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    followRef.current = true
    // `body` is merged into the request's forwardedProps, which the chat
    // client mirrors onto the fetcher's `input.data`.
    void sendMessage(input, { body: { model } })
    setInput('')
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <McpConnectors open={mcpOpen} onClose={() => setMcpOpen(false)} />
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">TanStack AI × Strapi</h1>
          <McpStatusBar onOpen={() => setMcpOpen(true)} />
        </div>
        <ProviderPicker value={model} onChange={setModel} disabled={isLoading} />
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 space-y-4 overflow-y-auto p-5 text-lg"
      >
        <MessageList messages={messages} />
        {isLoading && <WorkingIndicator messages={messages} />}
        {error && (
          <div className="rounded-lg border border-red-700/60 bg-red-900/30 px-4 py-3 text-base text-red-200">
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
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-lg"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-lg"
          >
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-cyan-600 px-5 py-3 text-lg disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </div>
  )
}
