import { apply as mountNativeControls } from '@deepseek-ai/dsh-tool-subagent-control';

export const name = 'xingheng-subagent-controls';
export const inject = ['tools', 'subagents', 'agents'];
export const CONTROL_NAMES = Object.freeze({
  send_message: 'subagent_message',
  list_agents: 'subagent_list',
  interrupt_agent: 'subagent_interrupt',
});

/** Separate ordinary child IDs from the native Team member-name protocol. */
export function aliasControl(definition) {
  const name = CONTROL_NAMES[definition.name];
  if (!name) throw new Error('Unexpected native control: ' + definition.name);
  let description = definition.description;
  for (const [native, alias] of Object.entries(CONTROL_NAMES)) description = description.replaceAll(native, alias);
  return { ...definition, name, description };
}

export function apply(ctx) {
  // Reuse native validation, lineage checks, cancellation, delivery and output schema.
  mountNativeControls({
    agents: ctx.agents,
    subagents: ctx.subagents,
    tools: { register: definition => ctx.tools.register(aliasControl(definition)) },
  });
}
