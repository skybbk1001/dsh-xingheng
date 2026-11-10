// Native Team operation aliases avoid client adapters reserving legacy control names.
export const name = 'xingheng-team-controls';
export const inject = ['agents', 'agentTeams', 'tools'];
export const TEAM_ALIASES = Object.freeze({ list_agents: 'team_roster', send_message: 'team_message', interrupt_agent: 'team_interrupt' });
export function apply(ctx) {
  const owned = new Map();
  const install = agent => {
    if (owned.has(agent) || !ctx.agentTeams.tryMembership(agent)) return;
    const tools = agent.ctx.get('tools');
    const originals = Object.entries(TEAM_ALIASES).map(([name, alias]) => [name, alias, tools.get(name, agent)]);
    if (originals.some(([, , def]) => !def)) return;
    const release = agent.ctx.effect(() => {
      const disposers = [];
      try {
        for (const [, name, original] of originals) {
          let description = original.description;
          for (const [from, to] of Object.entries(TEAM_ALIASES)) description = description.replaceAll(from, to);
          disposers.push(tools.register({ ...original, name, description }));
        }
      } catch (error) { for (const dispose of disposers.reverse()) dispose(); throw error; }
      return () => { for (const dispose of disposers.reverse()) dispose(); owned.delete(agent); };
    });
    owned.set(agent, release);
  };
  for (const agent of ctx.agents.list()) install(agent);
  ctx.on('agent/created', ({ agent }) => install(agent));
  ctx.on('agent/disposed', ({ agent }) => { owned.get(agent)?.(); owned.delete(agent); });
  ctx.effect(() => () => { for (const dispose of [...owned.values()]) dispose(); owned.clear(); });
}
