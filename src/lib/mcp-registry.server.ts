import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * User-added MCP servers.
 *
 * The point of this file is that NOTHING here is specific to Strapi's docs or
 * any other server: you add a server by URL from the UI and pick how it
 * authenticates. strapi-docs is just one entry someone might add.
 *
 * `.server.ts`: holds bearer tokens and header values. Never import from a
 * client component — values live only in this process.
 *
 * Storage is a 0600 JSON file rather than memory so servers survive a restart,
 * and rather than a database because this is a single-user demo. This module's
 * interface is the seam for swapping in something real.
 */
export type McpAuthKind = 'none' | 'bearer' | 'oauth'

export interface McpServerRecord {
  id: string
  /** Pool key — also the tool-name prefix. Slug-safe. */
  key: string
  label: string
  url: string
  auth: McpAuthKind
  /** Bearer token, when auth === 'bearer'. Never sent to the client. */
  token?: string
  /** Extra static headers. Values never sent to the client. */
  headers?: Record<string, string>
  /** False to keep the server configured but out of the pool. */
  enabled: boolean
  builtIn?: boolean
}

const STORE_PATH = resolve(process.env.MCP_REGISTRY_PATH ?? '.mcp-servers.json')

function read(): Array<McpServerRecord> {
  if (!existsSync(STORE_PATH)) return []
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.warn('[mcp-registry] store unreadable, starting empty:', STORE_PATH)
    return []
  }
}

function write(rows: Array<McpServerRecord>): void {
  writeFileSync(STORE_PATH, JSON.stringify(rows, null, 2), { mode: 0o600 })
}

/** Slugify a label into a pool key: lowercase, alphanumeric + underscore. */
export function toKey(input: string): string {
  const k = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
  return k || 'server'
}

/**
 * Reject anything that is not a plain http(s) URL.
 *
 * A user-added MCP server is a trust boundary: its operator can influence which
 * tools the model sees and what they return. Restricting the scheme is the
 * minimum bar — it stops `file:`, `data:` and similar from being handed to the
 * transport.
 */
export function validateUrl(raw: string): string {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`Not a valid URL: ${raw}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`MCP server URL must be http or https, got "${parsed.protocol}"`)
  }
  return parsed.toString()
}

/**
 * Seed the registry from environment on first run.
 *
 * Keeps the .env-driven setup working after the move to a UI-managed registry:
 * a STRAPI_MCP_TOKEN in the environment becomes a normal, editable entry rather
 * than a hidden special case. Runs only when the registry is empty, so it never
 * fights a user who removed the entry deliberately.
 */
function seedFromEnvIfEmpty(): Array<McpServerRecord> {
  const rows = read()
  if (rows.length > 0) return rows

  const token = process.env.STRAPI_MCP_TOKEN
  if (!token) return rows

  const seeded: McpServerRecord = {
    id: randomUUID(),
    key: 'strapi',
    label: 'Strapi',
    url: process.env.STRAPI_MCP_URL ?? 'http://localhost:1350/mcp',
    auth: 'bearer',
    token,
    enabled: true,
    builtIn: true,
  }
  write([seeded])
  return [seeded]
}

export function listServers(): Array<McpServerRecord> {
  return seedFromEnvIfEmpty()
}

export function getServer(id: string): McpServerRecord | undefined {
  return read().find((s) => s.id === id)
}

export function addServer(input: {
  label: string
  url: string
  auth: McpAuthKind
  token?: string
  headers?: Record<string, string>
}): McpServerRecord {
  const rows = read()
  const url = validateUrl(input.url)

  // Keys become tool prefixes, so they must be unique or tools collide.
  const base = toKey(input.label)
  let key = base
  let n = 2
  while (rows.some((r) => r.key === key)) key = `${base}${n++}`

  const record: McpServerRecord = {
    id: randomUUID(),
    key,
    label: input.label.trim() || key,
    url,
    auth: input.auth,
    token: input.auth === 'bearer' ? input.token : undefined,
    headers: input.headers,
    enabled: true,
  }
  rows.push(record)
  write(rows)
  return record
}

export function updateServer(id: string, patch: Partial<McpServerRecord>): void {
  const rows = read()
  const i = rows.findIndex((s) => s.id === id)
  if (i === -1) throw new Error(`No MCP server with id ${id}`)
  if (patch.url) patch.url = validateUrl(patch.url)
  rows[i] = { ...rows[i], ...patch, id: rows[i].id, key: rows[i].key }
  write(rows)
}

export function removeServer(id: string): void {
  write(read().filter((s) => s.id !== id))
}
