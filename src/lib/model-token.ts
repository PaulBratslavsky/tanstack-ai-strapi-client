/**
 * Client-safe default model token.
 *
 * Lives here rather than in `adapters.server.ts` because the picker's initial
 * state needs it in the browser, and importing that module client-side would
 * drag the adapter packages (and their key handling) into the bundle.
 * `adapters.server.ts` re-exports its own copy for server-side use; the two are
 * pinned identical by `model-token.test.ts`.
 */
export const DEFAULT_MODEL_TOKEN = 'anthropic:claude-sonnet-5'
