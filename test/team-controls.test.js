import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, TEAM_ALIASES } from '../src/team-controls.js';

function fixture() {
  const events = new Map(), cleanup = [], agents = [], defs = new Map();
  const calls = [];
  const original = Object.fromEntries(Object.keys(TEAM_ALIASES).map(name => [name, {
    name, description: 'Native ' + name, parameters: { type: 'object' },
    output: { schema: { type: 'object' } },
    execute: async (args, exec) => { calls.push({ name, args, exec }); return { ok: true }; },
  }]));
  const ctx = { agents: { list: () => agents }, agentTeams: { tryMembership: a => a.member ? { role:'teammate' } : undefined },
    on: (name, fn) => events.set(name, fn), effect: fn => { const release=fn(); cleanup.push(release); return release; } };
  const agent = { member: true, ctx: { get: () => ({ get: name => original[name], register: def => { defs.set(def.name, def); return () => defs.delete(def.name); } }), effect: fn => fn() } };
  return { ctx, agents, agent, defs, events, cleanup, calls, original };
}
test('Team aliases preserve native executor, schema and caller authority', async () => {
  const f=fixture(); f.agents.push(f.agent); apply(f.ctx);
  assert.deepEqual([...f.defs.keys()].sort(), Object.values(TEAM_ALIASES).sort());
  const def=f.defs.get('team_message');
  assert.equal(def.execute, f.original.send_message.execute);
  assert.equal(def.parameters, f.original.send_message.parameters);
  const exec={agent:f.agent}; await def.execute({target:'lead',message:'hi'},exec);
  assert.equal(f.calls[0].exec,exec);
  f.events.get('agent/disposed')({agent:f.agent}); assert.equal(f.defs.size,0);
});
test('Team aliases install once on new members and never on ordinary workers', () => {
  const f=fixture(); apply(f.ctx);
  f.events.get('agent/created')({agent:{member:false}}); assert.equal(f.defs.size,0);
  f.events.get('agent/created')({agent:f.agent}); f.events.get('agent/created')({agent:f.agent});
  assert.equal(f.defs.size,3);
  for(const dispose of f.cleanup)dispose(); assert.equal(f.defs.size,0);
});
