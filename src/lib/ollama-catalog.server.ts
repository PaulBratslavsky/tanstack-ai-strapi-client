/**
 * Enumerates the chat-capable models actually installed on the local Ollama
 * host, so the picker offers what is really there instead of a hardcoded pair.
 *
 * `.server.ts`: talks to OLLAMA_HOST directly. The browser reaches this only
 * through `listChatModelsFn`, never by fetching Ollama itself.
 *
 * Ollama's native endpoint is `/api/tags` (NOT the OpenAI-compat `/v1/models`).
 */
export interface OllamaModel {
  id: string
  parameterSize?: string
  sizeBytes?: number
}

/**
 * Models that generate text but must never appear as a CHAT choice.
 *
 * Embedding models sit alongside chat models and `/api/tags` lists them
 * identically. Offering `nomic-embed-text` in a chat picker produces a run that
 * fails deep inside the adapter with an unhelpful error, so they are filtered
 * by family here rather than left for the user to avoid.
 */
const EMBEDDING_FAMILIES = new Set(['nomic-bert', 'bert'])
const EMBEDDING_HINTS = [/embed/i, /minilm/i]

function isEmbedding(id: string, family?: string): boolean {
  if (family && EMBEDDING_FAMILIES.has(family)) return true
  return EMBEDDING_HINTS.some((re) => re.test(id))
}

/**
 * Ask Ollama what is installed.
 *
 * Returns [] rather than throwing when Ollama is unreachable: a missing
 * catalogue must degrade the picker to "hosted models only", not take down the
 * chat page that renders it.
 */
export async function listInstalledOllamaModels(): Promise<Array<OllamaModel>> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  let res: Response
  try {
    res = await fetch(`${host}/api/tags`)
  } catch {
    return []
  }
  if (!res.ok) return []

  let body: { models?: Array<Record<string, any>> }
  try {
    body = await res.json()
  } catch {
    return []
  }

  return (body.models ?? [])
    .map((m) => ({
      id: String(m.name ?? m.model ?? ''),
      parameterSize: m.details?.parameter_size as string | undefined,
      sizeBytes: typeof m.size === 'number' ? m.size : undefined,
      family: m.details?.family as string | undefined,
    }))
    .filter((m) => m.id && !isEmbedding(m.id, m.family))
    .map(({ family: _f, ...rest }) => rest)
    .sort((a, b) => a.id.localeCompare(b.id))
}
