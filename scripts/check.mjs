import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const expr = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: value => ({ expression: value }) });
const schema = yaml.DEFAULT_SCHEMA.extend([expr]);
const manifest = JSON.parse(readFileSync('package.json'));
for (const file of ['README.md','README.en.md','LICENSE','CHANGELOG.md','SECURITY.md','CONTRIBUTING.md','icon.svg','docs/architecture.md','docs/migration.md','docs/acceptance.md','docs/usage.md','docs/usage.en.md']) assert.ok(existsSync(file), `Missing ${file}`);
for (const file of ['client.js', ...readdirSync('src').filter(n => n.endsWith('.js')).map(n => `src/${n}`)]) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  assert.equal(result.status, 0, file);
}
const patch = yaml.load(readFileSync('cordis.patch.yml', 'utf8'), { schema });
assert.ok(Array.isArray(patch) && patch[0].insert.length === 6);
const rows = patch[0].insert;
assert.equal(rows[0].name, manifest.name);
assert.deepEqual(rows.filter(r => r.name === '@deepseek-ai/dsh-agent-preset').map(r => r.config.id), ['xingheng-analyst','xingheng-worker','xingheng']);
assert.deepEqual(patch.find(row => row.id === 'agent-preset-registry').config, { default: 'xingheng', selectedDefault: 'xingheng' });
assert.deepEqual(patch.find(row => row.id === 'subagent').config, { maxDepth: 1, maxActiveSubagents: 2 });
assert.equal(patch.find(row => row.id === 'tool-agent-team').disabled, false);
assert.ok(!readFileSync('cordis.patch.yml','utf8').includes('/home/'));
for (const locale of ['en','zh']) {
  const metadata = JSON.parse(readFileSync(`locale/${locale}.json`));
  assert.ok(metadata.meta.title && metadata.meta.description);
}
const client = readFileSync('client.js','utf8');
assert.ok(client.includes(`id: '${manifest.name}'`));
assert.ok(!/ctx\.vue|from ['"]vue|require\(['"]@deepseek-ai\//.test(client));
assert.ok(!/--color-/.test(client));
assert.ok(readFileSync('icon.svg','utf8').includes('<svg'));

const flatten = list => list.flatMap(row => [row, ...(row.group && Array.isArray(row.config) ? flatten(row.config) : [])]);
const lead = rows.find(row => row.config?.id === 'xingheng');
const leadRows = flatten(lead.config.plugins);
assert.ok(leadRows.some(row => row.name === '@local/dsh-xingheng/controls'));
assert.ok(!leadRows.some(row => row.name === '@deepseek-ai/dsh-tool-subagent-control'));
const worker = rows.find(row => row.config?.id === 'xingheng-worker');
const workerRows = flatten(worker.config.plugins);
assert.ok(workerRows.some(row => row.name === '@deepseek-ai/dsh-tool-subagent-control'));
assert.ok(rows.some(row => row.name === '@local/dsh-xingheng/worker-policy'));
const analyst = rows.find(row => row.config?.id === 'xingheng-analyst');
const analystRows = flatten(analyst.config.plugins);
assert.ok(analystRows.some(row => row.name === '@local/dsh-xingheng/analyst-controls'));
assert.ok(!analystRows.some(row => row.name === '@deepseek-ai/dsh-tool-subagent-control'));

const analystFs = analystRows.find(row => row.name === '@deepseek-ai/dsh-tool-fs')?.config;
assert.equal(analystFs?.write, false);
assert.equal(analystFs?.edit, false);
assert.equal(analystFs?.applyPatch, false);
assert.ok(!analystRows.some(row => row.name === '@deepseek-ai/dsh-tool-bash' || row.name === '@deepseek-ai/dsh-tool-pwsh' || row.name === '@deepseek-ai/dsh-tool-jobs'));
console.log('PASS manifest, syntax, portable composition, dual worker/analyst presets, localized metadata, original SVG and Client surface');

// Runtime scope identity must be resolved by Host services, never by a duplicate library instance.
const workerPolicy = readFileSync('src/worker-policy.js', 'utf8');
assert.ok(!workerPolicy.includes("from '@deepseek-ai/dsh-scope'"));
assert.ok(workerPolicy.includes('ctx.tools.definitions(agent)'));
assert.ok(rows.some(row => row.name === '@local/dsh-xingheng/worker-policy'));
