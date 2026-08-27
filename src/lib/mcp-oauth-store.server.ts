import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'

/**
 * File-backed persistence for MCP OAuth state, keyed by server.
 *
 * A file rather than memory because the whole point of a refresh token is
 * surviving a restart — an in-memory store would send you back through the
 * browser flow on every `pnpm dev`. A file rather than a database because this
 * is a single-user demo; `MCP_OAUTH_STORE_PATH` and this module's interface are
 * the seam to swap in something real.
 *
 * The file contains refresh tokens. It is gitignored and must stay that way.
 */
export interface ServerOAuthState {
  clientInformation?: OAuthClientInformationMixed
  tokens?: OAuthTokens
  codeVerifier?: string
  /** OAuth 2.0 `state` param, used to match a callback to the server that started it. */
  state?: string
}

type StoreShape = Record<string, ServerOAuthState>

const STORE_PATH = resolve(
  process.env.MCP_OAUTH_STORE_PATH ?? '.mcp-oauth.json',
)

function readStore(): StoreShape {
  if (!existsSync(STORE_PATH)) return {}
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8')) as StoreShape
  } catch {
    // A corrupt store must not brick the app — treat it as empty and let the
    // user re-authorize rather than crashing every request that reads it.
    console.warn('[mcp-oauth] store unreadable, starting empty:', STORE_PATH)
    return {}
  }
}

function writeStore(store: StoreShape): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true })
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 })
}

export function getServerState(key: string): ServerOAuthState {
  return readStore()[key] ?? {}
}

export function patchServerState(
  key: string,
  patch: Partial<ServerOAuthState>,
): void {
  const store = readStore()
  store[key] = { ...(store[key] ?? {}), ...patch }
  writeStore(store)
}

export function clearServerState(key: string): void {
  const store = readStore()
  delete store[key]
  writeStore(store)
}

/** Find which server key owns an in-flight OAuth `state` value. */
export function findServerByState(state: string): string | undefined {
  const store = readStore()
  return Object.keys(store).find((k) => store[k]?.state === state)
}

export function hasTokens(key: string): boolean {
  return Boolean(getServerState(key).tokens?.access_token)
}

export const OAUTH_STORE_PATH = STORE_PATH
