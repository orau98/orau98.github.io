import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHUNK_RECOVERY_COOLDOWN_MS,
  CHUNK_RECOVERY_STORAGE_KEY,
  claimChunkRecovery,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from '../src/utils/chunkRecovery.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  };
};

test('isChunkLoadError only classifies dynamic-import failures as recoverable', () => {
  assert.equal(
    isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/MothDetail-old.js')),
    true,
  );
  assert.equal(isChunkLoadError(new Error('Loading chunk 42 failed')), true);
  assert.equal(
    isChunkLoadError(new Error('コンポーネントの読み込みがタイムアウトしました')),
    true,
  );
  assert.equal(isChunkLoadError(new TypeError('Failed to fetch')), false);
  assert.equal(isChunkLoadError(new URIError('URI malformed')), false);
  assert.equal(isChunkLoadError(new Error('Component render failed')), false);
});

test('recoverFromChunkLoadError prevents the Vite error and reloads once', () => {
  const storage = createStorage();
  let prevented = 0;
  let reloads = 0;

  const recovered = recoverFromChunkLoadError({
    event: { preventDefault: () => { prevented += 1; } },
    storage,
    location: { reload: () => { reloads += 1; } },
    now: 1000,
  });

  assert.equal(recovered, true);
  assert.equal(prevented, 1);
  assert.equal(reloads, 1);
  assert.equal(storage.values.get(CHUNK_RECOVERY_STORAGE_KEY), '1000');
});

test('recovery cooldown prevents a reload loop but expires for later deployments', () => {
  const storage = createStorage();
  assert.equal(claimChunkRecovery({ storage, now: 1000 }), true);
  assert.equal(
    claimChunkRecovery({ storage, now: 1000 + CHUNK_RECOVERY_COOLDOWN_MS - 1 }),
    false,
  );
  assert.equal(
    claimChunkRecovery({ storage, now: 1000 + CHUNK_RECOVERY_COOLDOWN_MS }),
    true,
  );
});

test('a blocked automatic recovery leaves the error available to the boundary', () => {
  const storage = createStorage();
  storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, '1000');
  let prevented = 0;
  let reloads = 0;

  const recovered = recoverFromChunkLoadError({
    event: { preventDefault: () => { prevented += 1; } },
    storage,
    location: { reload: () => { reloads += 1; } },
    now: 2000,
  });

  assert.equal(recovered, false);
  assert.equal(prevented, 0);
  assert.equal(reloads, 0);
});

test('manual recovery can bypass the cooldown guard', () => {
  const storage = createStorage();
  storage.setItem(CHUNK_RECOVERY_STORAGE_KEY, '1000');
  let reloads = 0;

  assert.equal(
    recoverFromChunkLoadError({
      storage,
      location: { reload: () => { reloads += 1; } },
      now: 2000,
      force: true,
    }),
    true,
  );
  assert.equal(reloads, 1);
});
