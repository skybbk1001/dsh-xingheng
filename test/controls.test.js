import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, aliasControl, CONTROL_NAMES } from '../src/controls.js';

test('ordinary controls have distinct names without changing native schemas or executors', async () => {
  const defs = new Map(); const sent = []; const stopped = [];
  const caller = { id: 'lead' };
  apply({ tools: { register: def => { assert.ok(!defs.has(def.name)); defs.set(def.name, def); return () => defs.delete(def.name); } },
    agents: { get: () => ({ status: 'inactive' }) },
    subagents: {
      sendMessage: async (...args) => { sent.push(args); return 'msg-1'; },
      interrupt: (...args) => stopped.push(args),
      listChildren: async () => [{ id: 'child', mode: 'continuable', label: 'test child' }],
      listDescendants: async () => [],
    },
  });
  assert.deepEqual([...defs.keys()].sort(), Object.values(CONTROL_NAMES).sort());
  assert.ok(!defs.has('send_message') && !defs.has('list_agents'));
  assert.ok(defs.get('subagent_message').parameters.properties.agent_id);
  const exec = { agent: caller, signal: new AbortController().signal };
  await defs.get('subagent_message').execute({ agent_id: 'child', message: 'hi' }, exec);
  assert.equal(sent[0][0], caller);
  assert.equal(sent[0][1], 'child');
  assert.equal(sent[0][3].signal, exec.signal);
  await defs.get('subagent_interrupt').execute({ agent_id: 'child' }, exec);
  assert.equal(stopped[0][0], 'child');
  assert.equal(stopped[0][1].agent, caller);
  const children = await defs.get('subagent_list').execute({}, exec);
  assert.equal(children[0].id, 'child');
});

test('control aliases reject unknown registrations', () => {
  assert.throws(() => aliasControl({ name: 'unknown' }), /Unexpected native control/);
});
