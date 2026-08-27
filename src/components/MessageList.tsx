import type { UIMessage } from '@tanstack/ai'

/**
 * Renders one message part.
 *
 * UIMessage.parts is a discriminated union. The shapes that matter here, from
 * @tanstack/ai-client's types:
 *
 *   { type: 'text',        content }
 *   { type: 'thinking',    content }
 *   { type: 'tool-call',   name, arguments: string, input?, state, output? }
 *   { type: 'tool-result', name?, toolCallId, content, state, error? }
 *
 * Note `arguments` is a JSON *string*, and the discriminant is `name` — not
 * `toolName`, which is what a first pass naturally reaches for.
 *
 * Tool activity is rendered visibly so it is obvious when the model actually
 * reached for a tool rather than answering from memory. That distinction is the
 * whole point of the MCP demo: a fluent answer proves nothing on its own.
 */
function Part({ part }: { part: any }) {
  if (part.type === 'text') {
    return <span className="whitespace-pre-wrap">{part.content}</span>
  }

  if (part.type === 'thinking') {
    return (
      <details className="my-1 text-xs text-gray-400">
        <summary className="cursor-pointer select-none">thinking</summary>
        <div className="mt-1 whitespace-pre-wrap border-l border-gray-700 pl-2">
          {part.content}
        </div>
      </details>
    )
  }

  if (part.type === 'tool-call') {
    // `arguments` is a JSON string; fall back to `input` when it is absent.
    let args = part.input
    if (args === undefined && typeof part.arguments === 'string') {
      try {
        args = JSON.parse(part.arguments)
      } catch {
        args = part.arguments
      }
    }
    return (
      <div className="my-1 rounded border border-amber-700/50 bg-amber-900/20 px-2 py-1 font-mono text-xs text-amber-200">
        <span className="font-semibold">⚙ {part.name}</span>
        {part.state && part.state !== 'complete' && (
          <span className="ml-2 text-amber-400/70">{part.state}</span>
        )}
        {args !== undefined && (
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-amber-300/80">
            {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  if (part.type === 'tool-result') {
    const failed = part.state === 'error'
    const body =
      typeof part.content === 'string' ? part.content : JSON.stringify(part.content)
    return (
      <details
        className={`my-1 rounded border px-2 py-1 font-mono text-xs ${
          failed
            ? 'border-red-700/50 bg-red-900/20 text-red-200'
            : 'border-emerald-800/50 bg-emerald-900/15 text-emerald-200'
        }`}
      >
        <summary className="cursor-pointer select-none font-semibold">
          {failed ? '✗' : '✓'} {part.name ?? 'result'}
          {failed && part.error ? ` — ${part.error}` : ''}
        </summary>
        <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap opacity-80">
          {body?.slice(0, 4000)}
        </pre>
      </details>
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
