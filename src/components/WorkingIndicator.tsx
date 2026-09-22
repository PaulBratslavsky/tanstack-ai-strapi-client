import { useEffect, useState } from 'react'
import type { UIMessage } from '@tanstack/ai'

/**
 * What the model is doing right now, read from the last message's last part.
 *
 * A local model can think for tens of seconds before it emits anything, and a
 * tool call can take as long again. Without a cue, a long silent phase looks
 * exactly like a hung request.
 */
function currentPhase(messages: Array<UIMessage>): string {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant' || last.parts.length === 0) return 'Thinking'
  const part: any = last.parts[last.parts.length - 1]
  if (part.type === 'tool-call') return `Running ${part.name}`
  if (part.type === 'tool-result') return 'Reading the result'
  if (part.type === 'text') return 'Writing'
  return 'Thinking'
}

/** Shown under the messages while a reply is in progress. Mounts per request, so the timer starts at zero. */
export function WorkingIndicator({ messages }: { messages: Array<UIMessage> }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div role="status" aria-live="polite" className="mr-auto flex items-center gap-3 px-1 text-base text-gray-400">
      <span className="flex gap-1" aria-hidden="true">
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
      </span>
      <span className="truncate">{currentPhase(messages)}…</span>
      <span className="tabular-nums text-gray-500">{seconds}s</span>
    </div>
  )
}
