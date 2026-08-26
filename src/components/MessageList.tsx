import type { UIMessage } from '@tanstack/ai'

/**
 * Renders a single message part.
 *
 * UIMessage.parts is a discriminated union. Text parts carry `content`; tool
 * parts carry a tool name and arguments/results. We render tool parts visibly
 * so it is obvious when the model reached for Strapi or the docs rather than
 * answering from memory — the whole point of the MCP demo.
 */
function Part({ part }: { part: any }) {
  if (part.type === 'text') {
    return <span className="whitespace-pre-wrap">{part.content}</span>
  }

  // Tool-related part names vary across versions ('tool-call', 'tool-result',
  // 'tool'); match on the prefix so all of them render.
  if (typeof part.type === 'string' && part.type.startsWith('tool')) {
    const name = part.toolName ?? part.name ?? 'tool'
    const args = part.args ?? part.input
    return (
      <div className="my-1 rounded border border-amber-700/50 bg-amber-900/20 px-2 py-1 font-mono text-xs text-amber-200">
        <span className="font-semibold">⚙ {name}</span>
        {args ? (
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-amber-300/80">
            {JSON.stringify(args, null, 2)}
          </pre>
        ) : null}
      </div>
    )
  }

  return null
}

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
          {m.parts.map((part, i) => (
            <Part key={i} part={part} />
          ))}
        </div>
      ))}
    </>
  )
}
