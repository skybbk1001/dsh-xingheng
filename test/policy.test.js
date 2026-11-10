import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import Tools from '@deepseek-ai/dsh-tools';
import { createScope, bindScopeParent } from '@deepseek-ai/dsh-scope';
import { apply, WORKER_ALLOWED, READONLY_ALLOWED, allowedToolsForMode, modeForPreset } from '../src/worker-policy.js';
const definition = name => ({ name, description: name, parameters: { type:'object' }, output:{schema:{type:'object'},render:()=>[]},execute:async()=>({ok:true}) });
async function fixture(mode) {
  const root=new Context(),events=new Map(),live=[];
  root.provide('systemPrompt',{tools:()=>()=>{}});
  root.provide('agents',{list:()=>live,get:id=>live.find(a=>a.id===id)});
  root.provide('agentPresets',{composedPreset:ctx=>ctx===agent.ctx?selected:undefined});
  const registry=root.plugin(Tools);await registry.await();
  const globals=['read','read_image','write','edit','bash','pwsh','glob','grep','working_directory','job_list','job_output','job_kill','skill','send_message','list_agents','interrupt_agent','web_search','mcp__playwright__browser_run_code_unsafe','spawn_teammate','xingheng_config'];
  const registrations=globals.map(n=>root.tools.register(definition(n)));
  const presetKey={},otherKey={},agent={id:'fixture'},preset=createScope(root,presetKey),other=createScope(root,otherKey),agentScope=createScope(root,agent);agent.ctx=agentScope.ctx;
  const parent=bindScopeParent(agent,otherKey);let selected='xingheng';
  const local=preset.ctx.plugin({inject:['tools'],apply(ctx){for(const n of ['read','read_image','glob','grep','send_message','list_agents'])ctx.tools.register(definition(n));}});await local.await();
  // Capture real event handlers while executing effects against the actual Host services.
  let policyCtx;const policy=root.plugin({inject:['tools','agents','agentPresets'],apply(ctx){policyCtx=ctx;apply(new Proxy(ctx,{get(target,key){if(key==='on')return(name,fn)=>events.set(name,fn);return Reflect.get(target,key,target)}}));}});await policy.await();
  live.push(agent);
  const activate=()=>{selected=mode==='readonly'?'xingheng-analyst':'xingheng-worker';parent.rebind(presetKey);events.get('agent-preset/selected')(agent.id,selected)};
  return {root,agent,agentScope,parent,policy,events,activate,visible:()=>root.tools.definitions(agent).map(t=>t.name).sort(),
    switchAway(){selected='xingheng';parent.rebind(otherKey);events.get('agent-preset/selected')(agent.id,selected)},
    async close(){events.get('agent/disposed')({agent});await agentScope.dispose();await policy.dispose();await local.dispose();await preset.dispose();await other.dispose();for(const release of registrations)release();await registry.dispose()},
  };
}
test('actual registry: blank-session selection masks parent tools without losing scoped read',async()=>{
  const f=await fixture('readonly');try{assert.ok(f.visible().includes('write'));f.activate();assert.deepEqual(f.visible(),[...READONLY_ALLOWED].sort());assert.ok(f.root.tools.get('read',f.agent));assert.equal(f.root.tools.get('write',f.agent),undefined);f.switchAway();assert.ok(f.visible().includes('write'));}finally{await f.close()}
});
test('actual registry: nearer own-scope escape is denied and policy unload releases guard',async()=>{
  const f=await fixture('readonly');try{f.activate();const local=f.agentScope.ctx.plugin({inject:['tools'],apply(ctx){ctx.tools.register(definition('late_mutator'))}});await local.await();assert.ok(f.visible().includes('late_mutator'));assert.match(f.root.tools.checkGuards({name:'late_mutator',agent:f.agent}),/readonly policy denies/);assert.equal(f.root.tools.checkGuards({name:'read',agent:f.agent}),undefined);await f.policy.dispose();assert.equal(f.root.tools.checkGuards({name:'late_mutator',agent:f.agent}),undefined);await local.dispose();}finally{await f.close()}
});
test('actual registry: worker retains execution and creation listener installs same boundary',async()=>{
  const f=await fixture('worker');try{f.activate();f.events.get('agent/created')({agent:f.agent});assert.deepEqual(f.visible(),[...WORKER_ALLOWED].sort());assert.ok(f.root.tools.get('bash',f.agent));assert.equal(f.root.tools.get('web_search',f.agent),undefined);}finally{await f.close()}
});
test('unknown mode is rejected and unrelated presets are not restricted',()=>{assert.throws(()=>allowedToolsForMode('admin'));assert.equal(modeForPreset('xingheng'),undefined);assert.equal(modeForPreset('xingheng-worker'),'worker');assert.equal(modeForPreset('xingheng-analyst'),'readonly')});
