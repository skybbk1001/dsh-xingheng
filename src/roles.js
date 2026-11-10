export const ROLES = Object.freeze(['iterate', 'implement', 'analyze']);
export const DEFAULT_WORKERS = Object.freeze({
  iterate: { provider: 'zero', model: 'deepseek-v4.1-flash-1017', effort: 'high' },
  implement: { provider: 'zero', model: 'gpt-6.1-sol', effort: 'medium' },
  analyze: { provider: 'zero', model: 'gpt-6.1-terra', effort: 'high' },
});
export const clone = value => structuredClone(value);
export const revisionOf = workers => JSON.stringify(ROLES.map(role => workers[role]));

/** Parse a complete update. Unknown keys and whitespace-only IDs fail closed. */
export function parseWorkers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('workers must be an object');
  if (Object.keys(input).sort().join(',') !== [...ROLES].sort().join(',')) throw new Error('workers requires exactly iterate, implement and analyze');
  return Object.fromEntries(ROLES.map(role => {
    const value = input[role];
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${role}: invalid route`);
    if (Object.keys(value).some(key => !['provider', 'model', 'effort'].includes(key))) throw new Error(`${role}: unknown field`);
    const { provider, model, effort = '' } = value;
    for (const [key, id] of Object.entries({ provider, model })) {
      if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 200) throw new Error(`${role}.${key}: non-empty exact ID required`);
    }
    if (typeof effort !== 'string' || effort !== effort.trim() || effort.length > 100) throw new Error(`${role}.effort: invalid ID`);
    return [role, { provider, model, effort }];
  }));
}

/** Validate against advertised capabilities, without generating model output. */
export async function validateWorkers(input, llm, signal) {
  const workers = parseWorkers(input);
  const providers = llm.listProviders();
  for (const role of ROLES) {
    signal?.throwIfAborted();
    const route = workers[role];
    if (!providers.some(p => p.id === route.provider)) throw new Error(`${role}: provider ${route.provider} is not registered`);
    const advertised = await llm.listModels(route.provider);
    if (!advertised.some(m => m.id === route.model)) throw new Error(`${role}: model ${route.provider}/${route.model} is not advertised`);
    const info = await llm.resolveModelInfo(route.provider, route.model, signal);
    if (route.effort && !info.reasoning?.efforts.some(e => e.id === route.effort)) throw new Error(`${role}: unsupported reasoning effort ${route.effort}`);
    await llm.resolveCallConfig({ provider: route.provider, model: route.model, ...(route.effort ? { reasoningEffort: route.effort } : {}) }, signal);
  }
  return workers;
}

export function childOptions(route) {
  return { provider: route.provider, model: route.model, ...(route.effort ? { reasoningEffort: route.effort } : {}) };
}

/** CAS is repeated inside ConfigEditor's serialized write, not just before I/O. */
export async function saveWorkers({ editor, entry, llm, read, input, expectedRevision, signal }) {
  if (typeof expectedRevision !== 'string' || expectedRevision !== revisionOf(read())) throw new Error('Configuration conflict: reload before saving');
  const workers = await validateWorkers(input, llm, signal);
  signal?.throwIfAborted();
  await editor.edit(entry, current => {
    const effective = parseWorkers(current.workers ?? DEFAULT_WORKERS);
    if (revisionOf(effective) !== expectedRevision) throw new Error('Configuration conflict: another writer saved first');
    return { ...current, workers };
  });
  return workers;
}
