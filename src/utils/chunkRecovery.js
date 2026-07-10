export const CHUNK_RECOVERY_STORAGE_KEY = 'ihpe-chunk-recovery-at';
export const CHUNK_RECOVERY_COOLDOWN_MS = 30 * 1000;

const getBrowserStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

const getBrowserLocation = () =>
  typeof window !== 'undefined' ? window.location : null;

export const isChunkLoadError = (error) => {
  const text = `${error?.name || ''} ${error?.message || ''}`;
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Unable to preload CSS|コンポーネントの読み込みがタイムアウト/i.test(
    text,
  );
};

export const claimChunkRecovery = ({
  storage = getBrowserStorage(),
  now = Date.now(),
  cooldownMs = CHUNK_RECOVERY_COOLDOWN_MS,
} = {}) => {
  if (!storage) return false;

  try {
    const previousAttemptAt = Number(storage.getItem(CHUNK_RECOVERY_STORAGE_KEY));
    if (
      Number.isFinite(previousAttemptAt) &&
      previousAttemptAt > 0 &&
      now - previousAttemptAt < cooldownMs
    ) {
      return false;
    }
    storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
};

/**
 * Reload the complete application when a Vite dynamic-import chunk is stale.
 * Re-importing the same URL cannot recover a deleted hashed chunk, so the only
 * useful retry is to fetch the current HTML entry point with a full reload.
 */
export const recoverFromChunkLoadError = ({
  event,
  storage = getBrowserStorage(),
  location = getBrowserLocation(),
  now = Date.now(),
  cooldownMs = CHUNK_RECOVERY_COOLDOWN_MS,
  force = false,
} = {}) => {
  if (!location?.reload) return false;

  const recoveryClaimed = force || claimChunkRecovery({ storage, now, cooldownMs });
  if (!recoveryClaimed) return false;

  // Vite will otherwise rethrow the rejected import after this event.
  event?.preventDefault?.();
  location.reload();
  return true;
};
