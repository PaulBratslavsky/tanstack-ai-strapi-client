import type { UIMessage } from '@tanstack/ai'

export function MessageList({ messages }: { messages: Array<UIMessage> }) {
  if (messages.length === 0) {
    return <p className="text-sm text-gray-500">Say something to start the chat.</p>
  }

  return (
    <>
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === 'user'
              ? 'ml-auto max-w-2xl rounded-lg border border-cyan-600/40 bg-cyan-700/20 px-3 py-2'
              : 'mr-auto max-w-2xl rounded-lg border border-gray-700 bg-gray-800 px-3 py-2'
          }
        >
          {m.parts.map((part, i) =>
            part.type === 'text' ? (
              <span key={i} className="whitespace-pre-wrap">
                {part.content}
              </span>
            ) : null,
          )}
        </div>
      ))}
    </>
  )
}
