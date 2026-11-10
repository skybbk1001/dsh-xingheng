// Native parent messaging for read-only children; no sibling interruption control.
import { apply as mountNative } from '@deepseek-ai/dsh-tool-subagent-control';

export const name = 'xingheng-analyst-controls';
export const inject = ['tools', 'subagents', 'agents'];
export function apply(ctx) {
  mountNative({
    agents: ctx.agents,
    subagents: ctx.subagents,
    tools: { register: definition => ['send_message', 'list_agents'].includes(definition.name)
      ? ctx.tools.register(definition)
      : () => {} },
  });
}
