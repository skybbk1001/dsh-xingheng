import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { ROLES, DEFAULT_WORKERS, clone, parseWorkers, revisionOf, saveWorkers } from './config.js';

const Route = z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
  effort: z.string().default(''),
});
export const Config = z.object({
  workers: z.object({ fast: Route.required(), text: Route.required(), long: Route.required() }).default(DEFAULT_WORKERS).volatile(),
});
export const name = 'xingheng';
export const API_PATH = '/api/xingheng/v2';

export default class Xingheng extends Service {
  static inject = ['llm', 'configEditor', 'connection', 'tools', 'commands', 'agentPresets'];
  static Config = Config;
  constructor(ctx, config) {
    super(ctx, 'xingheng');
    this.config = config;
  }
  workers() { return parseWorkers(this.config.workers.get()); }
  route(role) {
    if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
    return clone(this.workers()[role]);
  }
  async snapshot(signal) {
    const workers = this.workers();
    const providers = [];
    for (const provider of this.ctx.llm.listProviders()) {
      signal?.throwIfAborted();
      const models = [];
      let error;
      try {
        for (const model of await this.ctx.llm.listModels(provider.id)) {
          try {
            const info = await this.ctx.llm.resolveModelInfo(provider.id, model.id, signal);
            models.push({ id: model.id, name: model.name, efforts: info.reasoning?.efforts.map(e => ({ id: e.id, name: e.name })) ?? [], defaultEffort: info.reasoning?.defaultEffort ?? null });
          } catch (cause) { models.push({ id: model.id, name: model.name, efforts: [], error: cause.message }); }
        }
      } catch (cause) { error = cause.message; }
      providers.push({ id: provider.id, name: provider.name, models, ...(error ? { error } : {}) });
    }
    const presets = await this.ctx.agentPresets.list();
    return { version: '2.1.0', workers, revision: revisionOf(workers), providers, preset: presets.find(p => p.id === 'xingheng') ?? null, applies: 'next-child' };
  }
  async operate(request, signal) {
    if (!request || typeof request !== 'object') throw new Error('Request must be an object');
    if (request.action === 'read') return this.snapshot(signal);
    if (request.action !== 'save') throw new Error('action must be read or save');
    await saveWorkers({
      editor: this.ctx.configEditor, entry: this.ctx.fiber.entry, llm: this.ctx.llm,
      read: () => this.workers(), input: request.workers,
      expectedRevision: request.expectedRevision, signal,
    });
    return this.snapshot(signal);
  }
  async [Service.init]() {
    const ctx = this.ctx;
    const operation = (request, signal) => this.operate(request, signal);
    ctx.effect(() => ctx.connection.fetch.register({
      path: API_PATH, methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: async request => {
        try {
          if (request.method === 'POST' && !request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'application/json required' }, { status: 415 });
          const body = request.method === 'GET' ? { action: 'read' } : await request.json();
          if (JSON.stringify(body).length > 12000) return Response.json({ error: 'Request too large' }, { status: 413 });
          return Response.json(await operation(body, request.signal), { headers: { 'Cache-Control': 'no-store' } });
        } catch (error) {
          return Response.json({ error: error.message }, { status: /conflict/i.test(error.message) ? 409 : 400, headers: { 'Cache-Control': 'no-store' } });
        }
      },
    }));
    ctx.effect(() => ctx.tools.register({
      name: 'xingheng_config',
      description: 'Read Xingheng role routes or save user-requested subagent models and reasoning efforts for this profile. Changes apply to the next child; existing children keep their route.',
      parameters: {
        type: 'object', additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['read', 'save'] },
          workers: { type: 'object', description: 'Complete fast/text/long map with provider, model and effort; empty effort uses the adapter default.' },
          expectedRevision: { type: 'string', description: 'Revision from read; required when saving to reject concurrent edits.' },
        }, required: ['action'],
      },
      output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      execute: (args, exec) => operation(args, exec.signal),
    }));
    ctx.effect(() => ctx.commands.register({
      name: 'xingheng', description: 'Read Xingheng subagent configuration, or save a complete revision-checked JSON request.',
      input: { hint: 'JSON request; empty input reads configuration' },
      handler: async invocation => {
        try {
          const request = invocation.rawInput.trim() ? JSON.parse(invocation.rawInput) : { action: 'read' };
          return { kind: 'success', text: JSON.stringify(await operation(request, invocation.signal)) };
        } catch (error) { return { kind: 'error', text: error.message }; }
      },
    }));
  }
}
