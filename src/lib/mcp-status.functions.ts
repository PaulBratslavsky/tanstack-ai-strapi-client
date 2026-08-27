import { createServerFn } from '@tanstack/react-start'
import { createMCPClients } from '@tanstack/ai-mcp'
import { describeServers } from './mcp-servers.server'

export interface McpServerStatus {
  key: string
  label: string
  ok: boolean
  toolCount: number
  toolNames: Array<string>
  error?: string
  /** True when this server authenticates via OAuth (offer a connect button). */
  oauth?: boolean
}

/**
 * Connects each configured MCP server independently and reports what it exposes.
 *
 * Each server is connected on its own rather than as one pool: a pool reports a
 * single aggregate failure, and the whole point here is to say WHICH server is
 * down. Connections are closed immediately — this is a health check, not a chat.
 *
 * `pool.close()` IS correct here, unlike in chatFn: this function fully drains
 * tools() before closing, so nothing is left executing lazily.
 *
 * Data fetching goes through a server function, per the project convention.
 */
export const getMcpStatusFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<McpServerStatus>> => {
    const servers = describeServers()

    return Promise.all(
      servers.map(async (s: any): Promise<McpServerStatus> => {
        if (!s.transport) {
          return {
            key: s.key,
            label: s.label,
            ok: false,
            toolCount: 0,
            toolNames: [],
            error: s.skipped ?? 'not configured',
            oauth: s.oauth,
          }
        }
        try {
          const pool = await createMCPClients({ [s.key]: { transport: s.transport } })
          try {
            const tools = await pool.tools()
            return {
              key: s.key,
              label: s.label,
              ok: true,
              toolCount: tools.length,
              toolNames: tools.map((t: any) => t.name).slice(0, 60),
              oauth: s.oauth,
            }
          } finally {
            await pool.close()
          }
        } catch (error) {
          return {
            key: s.key,
            label: s.label,
            ok: false,
            toolCount: 0,
            toolNames: [],
            error: error instanceof Error ? error.message : String(error),
            oauth: s.oauth,
          }
        }
      }),
    )
  },
)
