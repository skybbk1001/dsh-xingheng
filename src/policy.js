// Scoped worker capability mask. Native DSH permissions remain authoritative.
export const name = 'xingheng-worker-policy';
export const inject = ['tools'];
const ALLOWED = ['bash', 'pwsh', 'read', 'read_image', 'write', 'edit', 'glob', 'grep', 'working_directory', 'job_list', 'job_output', 'job_kill', 'send_message', 'list_agents', 'interrupt_agent', 'skill'];
export function apply(ctx) {
  const owned = new Set();
  ctx.effect(() => () => { for (const dispose of owned) dispose(); owned.clear(); });
  ctx.on('agent/created', ({ agent }) => {
    let release;
    release = agent.ctx.effect(() => {
      const tools = agent.ctx.get('tools');
      const visible = new Set(tools.definitions(agent).map(tool => tool.name));
      const dispose = tools.restrict({ allow: ALLOWED.filter(name => visible.has(name)) });
      return () => { dispose(); owned.delete(release); };
    });
    owned.add(release);
  });
}
