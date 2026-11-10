import z from '@deepseek-ai/schemastery';
import { apply as mountNative, Config as NativeConfig } from '@deepseek-ai/dsh-tool-subagent';
import { childOptions } from './roles.js';

export const name = 'xingheng-delegation';
export const inject = ['xingheng', 'tools', 'subagents', 'systemPrompt', 'sessionProjections'];
export const Config = z.object({ role: z.union([z.const('iterate'), z.const('implement'), z.const('analyze')]).required() });

export const ROLE_PRESETS = Object.freeze({
  iterate: 'xingheng-worker',
  implement: 'xingheng-worker',
  analyze: 'xingheng-analyst',
});

export function presetForRole(role) {
  Config({ role });
  return ROLE_PRESETS[role];
}

/** Reuse native startup/preflight/cancellation, with a route read at invocation. */
export function nativeRouteConfig(role, service) {
  const agentPreset = presetForRole(role);
  const config = NativeConfig({ provider: 'spawn', toolName: `subagent_${role}`, modelSelection: false, modelDiscovery: false, agentPreset, maxDepth: 1 });
  Object.defineProperty(config, 'agentOptions', { enumerable: true, configurable: false, get: () => childOptions(service.route(role)) });
  return config;
}
export async function apply(ctx, config) {
  await mountNative(ctx, nativeRouteConfig(config.role, ctx.xingheng));
}
