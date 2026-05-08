import { SetMetadata } from '@nestjs/common';

export const SKIP_REPLAY_KEY = 'skipReplay';

/** Skips timestamp/nonce replay checks (e.g. health probes, public root). */
export const SkipReplay = () => SetMetadata(SKIP_REPLAY_KEY, true);
