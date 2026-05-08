/** Lowercase — Express normalizes incoming header names. */
export const REPLAY_HEADERS = {
  timestamp: 'x-client-timestamp',
  nonce: 'x-client-nonce',
} as const;

export const REPLAY_REDIS_PREFIX = 'replay:v1:';

/** Default clock skew window (ms) if `REPLAY_WINDOW_MS` is unset. */
export const DEFAULT_REPLAY_WINDOW_MS = 300_000;
