import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = path.join(root, 'scripts/validate-normalized.mjs');
const require = createRequire(import.meta.url);
const bundle = await build({ entryPoints: [file], bundle: true, write: false,
  format: 'cjs', platform: 'node', logLevel: 'silent',
  define: { 'import.meta.url': JSON.stringify(pathToFileURL(file).href) },
});
// Run the actual validator with fault-injected reads. Reports are captured in
// memory so regression tests never modify the source CSVs or production reports.
const validate = (overrides = {}) => {
  const logs = [];
  const writes = new Map();
  let exitCode = 0;
  const wrappedFs = { ...fs, mkdirSync() {}, writeFileSync: (name, value) => writes.set(name, String(value)), ...overrides };
  try {
    vm.runInNewContext(bundle.outputFiles[0].text, {
      module: { exports: {} }, exports: {}, Buffer, URL,
      require: (name) => ['fs', 'node:fs'].includes(name) ? wrappedFs : require(name),
      process: { env: { STRICT_VALIDATE_NORMALIZED: '0' }, argv: [process.execPath, file],
        exit: (code) => { exitCode = code; throw new Error('VALIDATOR_EXIT'); } },
      console: Object.fromEntries(['log', 'warn', 'error'].map((key) => [key, (...args) => logs.push(args.join(' '))])),
    });
  } catch (error) {
    if (error.message !== 'VALIDATOR_EXIT') throw error;
  }
  return { exitCode, logs, writes };
};

test('production validator accepts the current source without strict-mode environment overrides', () => {
  const result = validate();
  assert.equal(result.exitCode, 0);
  assert.ok(result.logs.some((line) => line.includes('[validate-normalized] OK')));
});

test('unknown or blank host/note foreign keys block a release even with STRICT=0', () => {
  for (const table of ['hostplants', 'general_notes']) {
    for (const id of ['nonexistent-test-insect', '']) {
      const target = path.join(root, 'normalized_data', `${table}.csv`);
      const row = table === 'hostplants'
        ? `test-invalid-ref,${id},アデク,フトモモ科,文献,,,,`
        : `test-invalid-ref,${id},生態情報,テスト記録,,,`;
      const result = validate({ readFileSync: (name, ...args) => String(name) === target
        ? fs.readFileSync(name, ...args).trimEnd() + '\n' + row + '\n' : fs.readFileSync(name, ...args) });
      assert.equal(result.exitCode, 1, `${table}: ${id}`);
      assert.ok(result.logs.some((line) => line.includes('missing insect_id references')));
    }
  }
});

test('missing normalized CSVs fail closed instead of using public copies or skipping validation', () => {
  for (const name of ['insects', 'hostplants', 'general_notes']) {
    const target = path.join(root, 'normalized_data', `${name}.csv`);
    const result = validate({ existsSync: (filePath) => String(filePath) === target ? false : fs.existsSync(filePath) });
    assert.equal(result.exitCode, 1, name);
    assert.ok(result.logs.some((line) => line.includes('Required normalized CSV is missing')));
  }
});

test('both release paths use the same mandatory source and artifact checks before upload', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  for (const command of ['lint -- --max-warnings=0', 'npm test', 'validate-normalized']) assert.ok(pkg.scripts['check:source'].includes(command));
  for (const command of ['smoke:dist', 'audit:image-resolution', 'audit:seo']) assert.ok(pkg.scripts['check:dist'].includes(command));
  for (const workflow of ['ci', 'deploy']) {
    const text = fs.readFileSync(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), 'utf8');
    assert.ok(text.includes('run: npm run check:source'));
    assert.ok(text.includes('run: npm run check:dist'));
    if (workflow === 'deploy') {
      assert.ok(text.indexOf('run: npm run check:source') < text.indexOf('run: npm run build:app'));
      assert.ok(text.indexOf('run: npm run check:dist') < text.indexOf('uses: actions/upload-pages-artifact'));
      assert.match(text, /deploy:\s+needs: build/);
    }
  }
});
