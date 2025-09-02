#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, list);
    else if (entry.isFile() && p.endsWith('.html')) list.push(p);
  }
  return list;
}

const ensureHeadMeta = (html) => {
  let out = html;
  if (!out.includes('<meta charset')) {
    out = out.replace(/<head>/i, '<head>\n    <meta charset="utf-8">');
  }
  if (!out.includes('name="viewport"')) {
    out = out.replace(/<head>/i, '<head>\n    <meta name="viewport" content="width=device-width,initial-scale=1">');
  }
  if (!out.includes('rel="search"') && !out.includes('opensearch.xml')) {
    out = out.replace(/<head>/i, '<head>\n    <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="昆虫×食草検索">');
  }
  return out;
};

const htmlFiles = walk(path.join(root, 'public'));
let changed = 0;
htmlFiles.forEach(file => {
  try {
    let src = fs.readFileSync(file, 'utf8');
    const out = ensureHeadMeta(src);
    if (out !== src) {
      fs.writeFileSync(file, out);
      changed++;
    }
  } catch {}
});

console.log(`Updated head meta in ${changed} files.`);

