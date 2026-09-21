import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders model output as Markdown.
 *
 * SECURITY: `rehype-raw` is deliberately NOT used. react-markdown escapes raw
 * HTML by default, and model output is untrusted — it can carry whatever a tool
 * result put in front of it, and an MCP server we do not control can put
 * anything in a tool result. Enabling raw HTML here would turn a hostile tool
 * response into script injection. If embedded HTML is ever needed, sanitize
 * with rehype-sanitize rather than removing this constraint.
 *
 * Links open in a new tab with `noopener noreferrer` for the same reason: the
 * href came from a model, not from us.
 *
 * Styling is done with explicit component overrides rather than a typography
 * plugin, so the prose matches the chat surface exactly and there is no
 * whole-page CSS to fight.
 *
 * Streaming note: partial Markdown renders as it arrives, so an unclosed code
 * fence or list briefly renders as plain text and then resolves. That is
 * correct behaviour — the alternative (buffering until the message completes)
 * throws away the streaming that the rest of this app exists to demonstrate.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (p) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed" {...p} />,
          h1: (p) => <h2 className="mt-5 mb-2 text-2xl font-semibold first:mt-0" {...p} />,
          h2: (p) => <h3 className="mt-5 mb-2 text-xl font-semibold first:mt-0" {...p} />,
          h3: (p) => <h4 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...p} />,
          h4: (p) => <h5 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...p} />,
          ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5" {...p} />,
          li: (p) => <li className="leading-relaxed" {...p} />,
          strong: (p) => <strong className="font-semibold text-white" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          hr: () => <hr className="my-3 border-gray-700" />,
          blockquote: (p) => (
            <blockquote className="my-2 border-l-2 border-gray-600 pl-3 text-gray-400" {...p} />
          ),
          a: ({ href, ...p }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
              {...p}
            />
          ),
          // `inline` is not passed by react-markdown v10; a fenced block arrives
          // wrapped in <pre>, so `pre` does the block styling and `code` only
          // ever needs to style the inline case plus reset inside a block.
          code: (p) => (
            <code
              className="rounded border border-gray-700 bg-gray-900/70 px-1 py-0.5 font-mono text-[0.85em] text-cyan-300"
              {...p}
            />
          ),
          pre: (p) => (
            <pre
              className="my-2 overflow-x-auto rounded-lg border border-gray-700 bg-gray-950 p-4 font-mono text-base leading-relaxed [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-gray-200"
              {...p}
            />
          ),
          table: (p) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full border-collapse text-base" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-gray-900/60" {...p} />,
          th: (p) => (
            <th className="border-b border-gray-700 px-3 py-2 text-left font-semibold" {...p} />
          ),
          td: (p) => <td className="border-b border-gray-800 px-3 py-2 align-top" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
