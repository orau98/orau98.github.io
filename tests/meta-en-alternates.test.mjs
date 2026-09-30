import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyDeferredEnglishAlternates,
  buildEnAlternateLink,
  buildEnAlternateMarker,
} from '../scripts/lib/metaEnglishAlternates.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('SEO用ページは日本語を1回だけ作り、英語版リンクは英語の生成後に入れる', () => {
  const steps = pkg.scripts['generate-meta:all'].split('&&').map((part) => part.trim());
  assert.deepEqual(steps, [
    'node scripts/generate-meta-pages.js --defer-en-alternates',
    'npm run generate-meta:en',
    'node scripts/apply-meta-en-alternates.mjs',
  ]);
});

test('目印は英語ページがあればリンクに、なければ空に置き換え、旧英語ガイドの転送は英語ページがある植物だけ書く', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-en-alternates-'));
  try {
    const publicDir = path.join(dir, 'public');
    const write = (relativePath, content) => {
      const filePath = path.join(publicDir, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
      return filePath;
    };
    // 英語ページ: 昆虫 species-1 はインデックス対象、species-2 は noindex。植物はコナラだけ
    write('en/meta/moth/foo-bar.html', '<meta name="robots" content="index, follow">');
    write('en/meta/moth/baz-qux.html', '<meta name="robots" content="noindex, follow">');
    write('en/meta/plant/quercus-serrata.html', '<meta name="robots" content="index, follow">');
    write('seo-route-map.insects.json', JSON.stringify({
      'species-1': '/en/meta/moth/foo-bar.html',
      'species-2': '/en/meta/moth/baz-qux.html',
    }));
    write('seo-route-map.plants.json', JSON.stringify({ コナラ: '/en/meta/plant/quercus-serrata.html' }));

    const page = (href) => `<link rel="alternate" hreflang="ja" href="x">\n  ${buildEnAlternateMarker(href)}<link rel="alternate" hreflang="x-default" href="x">`;
    const insect1 = write('meta/moth/species-1.html', page('https://example.org/en/moth/foo/'));
    const insect2 = write('meta/moth/species-2.html', page('https://example.org/en/moth/baz/'));
    const plant = write('meta/plant/コナラ.html', page('https://example.org/en/plant/%E3%82%B3%E3%83%8A%E3%83%A9/'));
    const redirectFor = (name) => path.join(publicDir, 'en', 'guides', 'plants', `${name}.html`);
    const manifestPath = path.join(dir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      pages: [
        { file: insect1, kind: 'insect', key: 'species-1' },
        { file: insect2, kind: 'insect', key: 'species-2' },
        { file: plant, kind: 'plant', key: 'コナラ' },
      ],
      redirects: [
        { kind: 'plant', key: 'コナラ', outputPath: redirectFor('konara'), html: 'redirect-konara' },
        { kind: 'plant', key: 'クヌギ', outputPath: redirectFor('kunugi'), html: 'redirect-kunugi' },
      ],
    }));

    const result = applyDeferredEnglishAlternates({ manifestPath, publicDir });
    assert.deepEqual({ linked: result.linked, cleared: result.cleared, redirects: result.redirects }, { linked: 2, cleared: 1, redirects: 1 });
    // 置き換え後は従来の生成結果と同じ並び（ja → en → x-default）
    assert.equal(
      fs.readFileSync(insect1, 'utf8'),
      `<link rel="alternate" hreflang="ja" href="x">\n  ${buildEnAlternateLink('https://example.org/en/moth/foo/')}<link rel="alternate" hreflang="x-default" href="x">`,
    );
    assert.equal(
      fs.readFileSync(insect2, 'utf8'),
      '<link rel="alternate" hreflang="ja" href="x">\n  <link rel="alternate" hreflang="x-default" href="x">',
    );
    assert.match(fs.readFileSync(plant, 'utf8'), /hreflang="en" href="https:\/\/example\.org\/en\/plant\//);
    assert.equal(fs.readFileSync(redirectFor('konara'), 'utf8'), 'redirect-konara');
    assert.equal(fs.existsSync(redirectFor('kunugi')), false);
    assert.equal(fs.existsSync(manifestPath), false, 'the manifest is consumed');
    assert.throws(() => applyDeferredEnglishAlternates({ manifestPath, publicDir }), /記録がありません/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
