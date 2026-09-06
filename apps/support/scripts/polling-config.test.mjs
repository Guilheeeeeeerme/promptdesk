import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/polling.ts', import.meta.url), 'utf8');

test('uses the approved visible and background refresh intervals', () => {
  assert.match(source, /VISIBLE_SESSION_REFRESH_MS\s*=\s*120_000/);
  assert.match(source, /HIDDEN_SESSION_REFRESH_MS\s*=\s*300_000/);
  assert.match(source, /FOCUS_REFRESH_DEDUPE_MS\s*=\s*10_000/);
});
