import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WORKERS, clone, parseWorkers, validateWorkers, revisionOf, saveWorkers } from '../src/config.js';
const llm = {
  listProviders: () => [{ id: 'zero' }, { id: 'a6' }],
  listModels: async () => Object.values(DEFAULT_WORKERS).map(w => ({ id: w.model })),
  resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'high' }, { id: 'medium' }] } }),
  resolveCallConfig: async value => value,
};
test('complete routes round-trip without mutating input', () => {
  const parsed = parseWorkers(DEFAULT_WORKERS);
  parsed.fast.model = 'other';
  assert.notEqual(parsed.fast.model, DEFAULT_WORKERS.fast.model);
});
test('malformed maps, unknown fields and whitespace fail closed', () => {
  for (const input of [null, [], {}, { fast: {} }, { ...clone(DEFAULT_WORKERS), extra: {} }]) assert.throws(() => parseWorkers(input));
  for (const patch of [{ provider: ' ' }, { model: '' }, { effort: null }, { maxTokens: 5 }]) {
    const workers = clone(DEFAULT_WORKERS); Object.assign(workers.fast, patch);
    assert.throws(() => parseWorkers(workers));
  }
});
test('uses exact provider and model IDs; validates efforts', async () => {
  assert.deepEqual(await validateWorkers(DEFAULT_WORKERS, llm), DEFAULT_WORKERS);
  for (const patch of [{ provider: 'missing' }, { model: 'missing' }, { effort: 'max' }]) {
    const workers = clone(DEFAULT_WORKERS); Object.assign(workers.fast, patch);
    await assert.rejects(validateWorkers(workers, llm));
  }
  const workers = clone(DEFAULT_WORKERS); workers.fast.effort = '';
  assert.equal((await validateWorkers(workers, llm)).fast.effort, '');
});
test('abort prevents writes', async () => {
  const controller = new AbortController(); controller.abort();
  let writes = 0;
  await assert.rejects(saveWorkers({ read: () => DEFAULT_WORKERS, expectedRevision: revisionOf(DEFAULT_WORKERS), input: DEFAULT_WORKERS, llm, signal: controller.signal, editor: { edit: async () => { writes++; } } }));
  assert.equal(writes, 0);
});
test('revision compare-and-swap inside serialized editor rejects one concurrent writer', async () => {
  let current = { workers: clone(DEFAULT_WORKERS), unrelated: 'preserved' };
  let queue = Promise.resolve();
  const editor = { edit: (_entry, change) => {
    const result = queue.then(() => { current = change(current); });
    queue = result.catch(() => {}); return result;
  } };
  const a = clone(DEFAULT_WORKERS); a.fast.effort = 'medium';
  const b = clone(DEFAULT_WORKERS); b.long.effort = 'medium';
  const call = input => saveWorkers({ read: () => current.workers, expectedRevision: revisionOf(DEFAULT_WORKERS), input, llm, editor });
  const outcomes = await Promise.allSettled([call(a), call(b)]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(current.unrelated, 'preserved');
});
test('refused editor write is not reported as saved', async () => {
  await assert.rejects(saveWorkers({ read: () => DEFAULT_WORKERS, expectedRevision: revisionOf(DEFAULT_WORKERS), input: DEFAULT_WORKERS, llm, editor: { edit: async () => { throw new Error('read-only'); } } }), /read-only/);
});
