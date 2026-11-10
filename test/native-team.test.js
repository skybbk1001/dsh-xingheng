import test from 'node:test';
import assert from 'node:assert/strict';
import { apply as mountTeam } from '@deepseek-ai/dsh-experimental-tool-agent-team';
import { apply as mountAliases } from '../src/team-controls.js';

test('all native Team tools coexist with aliases and preserve task CAS, caller and context mode', async () => {
  const defs=new Map(), events=new Map(), effects=[], sections=[];
  const seen=[];
  const caller={id:'lead-session',ctx:{effect:fn=>fn()}};
  const tools={register:def=>{if(defs.has(def.name))throw Error('duplicate '+def.name);defs.set(def.name,def);return()=>defs.delete(def.name);},get:name=>defs.get(name)};
  caller.ctx.get=()=>tools; caller.ctx.tools=tools;
  caller.ctx.systemPrompt={section:s=>{sections.push(s);return()=>{}},context:()=>()=>{},getSectionOrder:()=>1,getContextOrder:()=>1};
  const teams={
    tryMembership:a=>a===caller?{role:'lead'}:undefined,membership:()=>({role:'lead',name:'lead'}),
    listMembers:()=>[{id:caller.id,name:'lead',role:'lead',status:'running',diagnostics:[]}],
    spawnTeammate:async(a,r)=>{seen.push({kind:'spawn',a,r});return{member:{id:'child',name:r.name,role:'teammate',status:'running',diagnostics:[]}}},
    sendMessage:async(a,r)=>{seen.push({kind:'message',a,r});return{messageId:'m'}},
    interrupt:(a,r)=>{seen.push({kind:'interrupt',a,r});return{previousStatus:'inactive'}},
    updateTask:async(a,r)=>{seen.push({kind:'update',a,r});return{revision:r.expectedRevision+1}},
  };
  const ctx={agents:{list:()=>[caller]},agentTeams:teams,tools,on:(key,fn)=>{const list=events.get(key)||[];list.push(fn);events.set(key,list)},effect:fn=>{const d=fn();effects.push(d);return d}};
  mountTeam(ctx,{freshProvider:'spawn',forkProvider:'fork'}); mountAliases(ctx);
  for(const name of ['spawn_teammate','send_message','list_agents','wait_agent','interrupt_agent','team_task_create','team_task_list','team_task_get','team_task_update','team_roster','team_message','team_interrupt'])assert.ok(defs.has(name),name);
  const exec={agent:caller,signal:new AbortController().signal};
  await defs.get('spawn_teammate').execute({name:'reviewer',description:'review',prompt:'read only',context:'fork'},exec);
  assert.equal(seen[0].r.provider,'fork');assert.equal(seen[0].r.context,'fork');assert.equal(seen[0].a,caller);
  await defs.get('team_message').execute({target:'reviewer',message:'hi'},exec);
  assert.equal(seen[1].r.target,'reviewer');assert.equal(seen[1].r.signal,exec.signal);
  await defs.get('team_task_update').execute({task_id:'task-1',expected_revision:4,action:'claim'},exec);
  assert.equal(seen[2].r.expectedRevision,4);assert.equal(seen[2].a,caller);
  const idle=await defs.get('wait_agent').execute({timeout_ms:10000},exec);assert.equal(idle.noProgress.reason,'no-active-peer');
  for(const dispose of effects.reverse())dispose();assert.equal(defs.size,0);
});
