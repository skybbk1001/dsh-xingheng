export const name = 'xingheng-scoped-policy';
export const inject = ['tools', 'agents', 'agentPresets'];
export const WORKER_ALLOWED = Object.freeze([
  'bash', 'pwsh', 'read', 'read_image', 'write', 'edit', 'glob', 'grep',
  'working_directory', 'job_list', 'job_output', 'job_kill',
  'send_message', 'list_agents', 'interrupt_agent', 'skill',
]);
export const READONLY_ALLOWED = Object.freeze([
  'read', 'read_image', 'glob', 'grep', 'working_directory',
  'send_message', 'list_agents', 'skill',
]);
export function allowedToolsForMode(mode) {
  if (mode === 'readonly') return READONLY_ALLOWED;
  if (mode === 'worker') return WORKER_ALLOWED;
  throw new Error(`Invalid policy mode: ${mode}`);
}
export function modeForPreset(id) {
  return id === 'xingheng-analyst' ? 'readonly' : id === 'xingheng-worker' ? 'worker' : undefined;
}

/** Host owner tracks only the two worker presets; the Lead and other presets are untouched. */
export function apply(ctx) {
  const owned = new Map();
  const modeOf = agent => agent && modeForPreset(ctx.agentPresets.composedPreset(agent.ctx));
  const release = agent => { owned.get(agent)?.(); owned.delete(agent); };
  const refresh = agent => {
    release(agent);
    const mode = modeOf(agent);
    if (!mode) return;
    const allowed = allowedToolsForMode(mode);
    // Ask the Host registry to resolve the exact Agent; scope identities are Host-owned.
    // Allowed native control names are also supplied by these presets, not only Team locals.
    const visible = new Set(ctx.tools.definitions(agent).map(tool => tool.name));
    const dispose = agent.ctx.effect(() => agent.ctx.get('tools').restrict({ allow: allowed.filter(name => visible.has(name)) }));
    owned.set(agent, dispose);
  };
  // Guard is evaluated against the current composition, also covering nearer own-scope tools.
  ctx.effect(() => ctx.tools.guard(exec => {
    const mode = modeOf(exec.agent);
    return mode && !allowedToolsForMode(mode).includes(exec.name)
      ? `Xingheng ${mode} policy denies tool "${exec.name}"` : undefined;
  }));
  ctx.on('agent/created', ({ agent }) => refresh(agent));
  ctx.on('agent-preset/selected', id => { const agent = ctx.agents.get(id); if (agent) refresh(agent); });
  ctx.on('agent/disposed', ({ agent }) => release(agent));
  ctx.effect(() => () => { for (const dispose of [...owned.values()]) dispose(); owned.clear(); });
  for (const agent of ctx.agents.list()) refresh(agent);
}
