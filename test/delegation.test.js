import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, Config, nativeRouteConfig } from '../src/role-agent.js';
import { DEFAULT_WORKERS, clone } from '../src/roles.js';

export async function mountExecutor(role = 'iterate', service = { route: key => DEFAULT_WORKERS[key] }) {
  const definitions = new Map(); const starts = []; const preflights = []; const sections = [];
  const backend = { name: 'spawn', description: 'Test backend', inheritsParentContext: false, capabilities: { agentOptions: true, agentPreset: true, depthLimit: true }, prepareContinuable: async () => ({}) };
  const ctx = {
    xingheng: service,
    tools: { register: def => { definitions.set(def.name, def); return () => definitions.delete(def.name); }, get: () => undefined },
    subagents: { getProvider: () => backend, resolveMaxDepth: x => x, startActivation: async call => { starts.push(call); return { childId: 'fixture-child' }; } },
    sessionProjections: { register: async () => ({ stateOf: () => null }) },
    systemPrompt: { section: s => sections.push(s), context: () => {}, getSectionOrder: () => 1, getContextOrder: () => 1 },
    get: key => key === 'agentPresets' ? {} : key === 'llm' ? { resolveCallConfig: async config => { preflights.push(config); return config; } } : undefined,
    effect: fn => fn(), on: () => () => {}, logger: { info() {} },
  };
  await apply(ctx, { role });
  const parent = { options: { provider: 'parent', model: 'parent', reasoningEffort: 'max' }, session: { requestHeader: () => undefined } };
  const invoke = args => definitions.get(`subagent_${role}`).execute({ description: 'Fixture only', prompt: 'Do not run a model', ...args }, { agent: parent, signal: new AbortController().signal });
  return { definitions, starts, preflights, invoke, sections };
}

test('native executor reads next-child route and preserves a settled preflight snapshot', async () => {
  let workers = clone(DEFAULT_WORKERS);
  const mounted = await mountExecutor('iterate', { route: key => workers[key] });
  await mounted.invoke({});
  const first = mounted.starts[0].request.agentOptions;
  workers.iterate = { provider: 'a6', model: 'another', effort: 'low' };
  await mounted.invoke({});
  assert.deepEqual(first, { provider: 'zero', model: DEFAULT_WORKERS.iterate.model, reasoningEffort: 'high' });
  assert.deepEqual(mounted.starts[1].request.agentOptions, { provider: 'a6', model: 'another', reasoningEffort: 'low' });
  assert.deepEqual(mounted.preflights, mounted.starts.map(call => call.request.agentOptions));
  for (const call of mounted.starts) {
    assert.equal(call.provider, 'spawn');
    assert.equal(call.request.maxDepth, 1);
    assert.equal(call.request.agentPreset, 'xingheng-worker');
    assert.equal('maxTokens' in call.request.agentOptions, false);
  }
});
test('route saved during asynchronous preflight cannot change an already admitted child', async () => {
  let workers = clone(DEFAULT_WORKERS);
  const mounted = await mountExecutor('iterate', { route: key => workers[key] });
  const pending = mounted.invoke({});
  workers.iterate = { provider: 'a6', model: 'other-model', effort: 'low' };
  await pending;
  assert.deepEqual(mounted.starts[0].request.agentOptions, { provider: 'zero', model: DEFAULT_WORKERS.iterate.model, reasoningEffort: 'high' });
  assert.deepEqual(mounted.preflights[0], mounted.starts[0].request.agentOptions);
});

test('all three native role tools reject model-facing overrides', async () => {
  for (const role of ['iterate', 'implement', 'analyze']) {
    const mounted = await mountExecutor(role);
    assert.equal('model' in mounted.definitions.get(`subagent_${role}`).parameters.properties, false);
    await assert.rejects(mounted.invoke({ provider: 'zero', model: 'other' }), /selection is disabled/);
    await mounted.invoke({});
    assert.equal(mounted.starts.length, 1);
  }
});


test('new tool IDs are exclusive and old role names cannot register tools', async () => {
  for (const role of ['iterate', 'implement', 'analyze']) {
    const mounted = await mountExecutor(role);
    assert.deepEqual([...mounted.definitions.keys()], [`subagent_${role}`]);
    for (const legacy of ['subagent_fast', 'subagent_text', 'subagent_long']) assert.equal(mounted.definitions.has(legacy), false);
  }
  for (const role of ['fast', 'text', 'long']) {
    assert.throws(() => Config({ role }));
    assert.throws(() => nativeRouteConfig(role, { route: () => DEFAULT_WORKERS.iterate }));
  }
});
