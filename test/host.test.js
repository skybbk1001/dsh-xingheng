import test from 'node:test';
import assert from 'node:assert/strict';
import { Service } from '@deepseek-ai/cordis';
import Xingheng from '../src/host.js';
import { DEFAULT_WORKERS, clone, revisionOf } from '../src/config.js';

function fixture() {
  let workers = clone(DEFAULT_WORKERS);
  const routes = new Map(), tools = new Map(), commands = new Map(), disposers = [];
  const ctx = {
    fiber: { entry: {} },
    llm: {
      listProviders: () => [{ id: 'zero', name: 'Fixture provider' }],
      listModels: async () => Object.values(DEFAULT_WORKERS).map(w => ({ id: w.model, name: w.model })),
      resolveModelInfo: async (_p, id) => ({ id, reasoning: { efforts: [{ id: 'high', name: 'High' }, { id: 'medium', name: 'Medium' }] } }),
      resolveCallConfig: async c => c,
    },
    configEditor: { edit: async (_entry, update) => { workers = update({ workers }).workers; } },
    agentPresets: { list: async () => [{ id: 'xingheng', name: 'Fixture preset' }] },
    connection: { fetch: { register: route => { routes.set(route.path, route); return () => routes.delete(route.path); } } },
    tools: { register: tool => { tools.set(tool.name, tool); return () => tools.delete(tool.name); } },
    commands: { register: command => { commands.set(command.name, command); return () => commands.delete(command.name); } },
    effect: fn => { const dispose = fn(); disposers.push(dispose); return dispose; },
  };
  const service = { ctx, config: { workers: { get: () => workers } } };
  for (const method of ['workers','route','snapshot','operate']) service[method] = Xingheng.prototype[method];
  return { ctx, service, routes, tools, commands, disposers };
}
test('Host registers one shared operation for authenticated Fetch, tool and command; effects dispose', async () => {
  const f = fixture();
  await Xingheng.prototype[Service.init].call(f.service);
  const endpoint = f.routes.get('/api/xingheng/v2');
  const res = await endpoint.fetch(new Request('http://fixture/api/xingheng/v2'));
  assert.equal(res.status, 200);
  const snapshot = await res.json();
  assert.equal(snapshot.revision, revisionOf(DEFAULT_WORKERS));
  const tool = await f.tools.get('xingheng_config').execute({ action: 'read' }, {});
  assert.deepEqual(tool.workers, snapshot.workers);
  const cmd = await f.commands.get('xingheng').handler({ rawInput: '', signal: undefined });
  assert.equal(cmd.kind, 'success');
  assert.deepEqual(JSON.parse(cmd.text).workers, tool.workers);
  for (const dispose of f.disposers.reverse()) await dispose();
  assert.equal(f.routes.size + f.tools.size + f.commands.size, 0);
});
test('HTTP save, readback, stale write, invalid effort and wrong content type', async () => {
  const f = fixture(); await Xingheng.prototype[Service.init].call(f.service);
  const endpoint = f.routes.get('/api/xingheng/v2');
  const post = body => endpoint.fetch(new Request('http://fixture/api/xingheng/v2', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }));
  const workers = clone(DEFAULT_WORKERS); workers.fast.effort = 'medium';
  const request = { action:'save', workers, expectedRevision:revisionOf(DEFAULT_WORKERS) };
  const saved = await post(request);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).workers.fast.effort, 'medium');
  assert.equal((await post(request)).status, 409);
  workers.fast.effort = 'unsupported';
  const invalid = await post({ ...request, expectedRevision:revisionOf(f.service.workers()) });
  assert.equal(invalid.status, 400);
  assert.equal(f.service.workers().fast.effort, 'medium');
  const type = await endpoint.fetch(new Request('http://fixture/api/xingheng/v2', { method:'POST', body:'{}' }));
  assert.equal(type.status, 415);
});
