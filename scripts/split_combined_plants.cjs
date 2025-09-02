// Split combined plant_name like "AとB" into two rows A and B.
// Uses public/name_family_map.csv to validate names and fill families when possible.

const fs = require('fs');

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const rows = [];
  for (const line of lines) {
    const row = [];
    let i = 0, field = '', q = false;
    while (i < line.length) {
      const c = line[i];
      if (q) {
        if (c === '"') {
          if (line[i + 1] === '"') { field += '"'; i += 2; }
          else { q = false; i++; }
        } else { field += c; i++; }
      } else {
        if (c === ',') { row.push(field); field = ''; i++; }
        else if (c === '"') { q = true; i++; }
        else { field += c; i++; }
      }
    }
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function stringify(rows) {
  const esc = (s) => {
    s = s == null ? '' : String(s);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map(r => r.map(esc).join(',')).join('\n') + '\n';
}

function loadCsvObjects(path) {
  if (!fs.existsSync(path)) return { headers: [], rows: [] };
  const text = fs.readFileSync(path, 'utf8');
  const rows = parseCSV(text);
  const header = rows[0] || [];
  const objs = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  return { header, rows: objs };
}

function normalizeName(s) {
  return (s || '').replace(/[\s\t\u3000]+/g, '').trim();
}

function main() {
  const hostPath = 'public/hostplants.csv';
  const hostText = fs.readFileSync(hostPath, 'utf8');
  const hostRows = parseCSV(hostText);
  const H = hostRows[0];
  const idx = Object.fromEntries(H.map((h, i) => [h, i]));

  const mapPath = 'public/name_family_map.csv';
  const mapRows = fs.existsSync(mapPath) ? parseCSV(fs.readFileSync(mapPath, 'utf8')) : [];
  const mapIdx = mapRows.length ? Object.fromEntries(mapRows[0].map((h, i) => [h, i])) : {};
  const known = new Set();
  const name2fam = new Map();
  if (mapRows.length) {
    for (let i = 1; i < mapRows.length; i++) {
      const r = mapRows[i];
      const name = (r[mapIdx['name']] || '').trim();
      if (!name) continue;
      known.add(name);
      const fam = (r[mapIdx['family_jp']] || r[mapIdx['family_en']] || '').trim();
      if (fam) name2fam.set(name, fam);
    }
  }
  // Also collect names in hostplants
  for (let i = 1; i < hostRows.length; i++) {
    const r = hostRows[i];
    const nm = (r[idx['plant_name']] || '').trim();
    if (nm) known.add(nm);
  }

  const out = [H.slice()];
  let splitCount = 0;
  let candidateCount = 0;

  function familyFor(name, fallback) {
    if (name2fam.has(name)) return name2fam.get(name);
    return fallback || '';
  }

  function splitKoreRa(name) {
    const m = name.match(/^(.+?)やこれらの加工製品$/);
    if (!m) return null;
    const base = m[1].trim();
    if (!base) return null;
    const head = base.split('の').pop().trim();
    if (!head) return null;
    return [base, head + 'の加工製品'];
  }

  function splitXtoYNoKakohin(name) {
    const m = name.match(/^(.+?)や(.+?)の加工品$/);
    if (!m) return null;
    const x = m[1].trim();
    const y = m[2].trim();
    if (!x || !y) return null;
    return [x + 'の加工品', y + 'の加工品'];
  }

  const badPhrases = ['など', 'という', '主とし', '可能', '有名', '飼育', 'ペレット', '食糧'];

  for (let i = 1; i < hostRows.length; i++) {
    const r = hostRows[i];
    const name = (r[idx['plant_name']] || '').trim();
    const fam = (r[idx['plant_family']] || '').trim();
    // consider pattern: exact single 'と' without spaces
    if (name && name.includes('と')) {
      const parts = name.split('と').map(s => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        candidateCount++;
        const [a, b] = parts;
        // Split rule: both tokens length>=2 and at least one appears in known set
        const okLen = (s) => s && s.length >= 2;
        if (okLen(a) && okLen(b) && (known.has(a) || known.has(b))) {
          // First row keeps original record_id
          const rowA = H.map((h) => {
            if (h === 'plant_name') return a;
            if (h === 'plant_family') return familyFor(a, fam);
            return r[idx[h]] ?? '';
          });
          // Second row gets derived record_id
          const newId = (r[idx['record_id']] || 'hostplant-split') + '-2';
          const rowB = H.map((h) => {
            if (h === 'record_id') return newId;
            if (h === 'plant_name') return b;
            if (h === 'plant_family') return familyFor(b, fam);
            return r[idx[h]] ?? '';
          });
          out.push(rowA);
          out.push(rowB);
          splitCount++;
          continue;
        }
      }
    }
    // handle 'や' patterns safely
    if (name && name.includes('や')) {
      // skip sentences-like phrases
      if (!badPhrases.some(p => name.includes(p))) {
        // Pattern A: Aやこれらの加工製品
        const pA = splitKoreRa(name);
        if (pA) {
          const [a, b] = pA;
          const rowA = H.map((h) => (h === 'plant_name' ? a : h === 'plant_family' ? familyFor(a, fam) : r[idx[h]] ?? ''));
          const rowB = H.map((h) => (h === 'record_id' ? (r[idx['record_id']] || 'hostplant-split') + '-2' : h === 'plant_name' ? b : h === 'plant_family' ? familyFor(b, fam) : r[idx[h]] ?? ''));
          out.push(rowA);
          out.push(rowB);
          splitCount++;
          continue;
        }
        // Pattern B: XやYの加工品 => Xの加工品, Yの加工品
        const pB = splitXtoYNoKakohin(name);
        if (pB) {
          const [a, b] = pB;
          const rowA = H.map((h) => (h === 'plant_name' ? a : h === 'plant_family' ? familyFor(a, fam) : r[idx[h]] ?? ''));
          const rowB = H.map((h) => (h === 'record_id' ? (r[idx['record_id']] || 'hostplant-split') + '-2' : h === 'plant_name' ? b : h === 'plant_family' ? familyFor(b, fam) : r[idx[h]] ?? ''));
          out.push(rowA);
          out.push(rowB);
          splitCount++;
          continue;
        }
      }
    }
    out.push(r);
  }

  if (splitCount > 0) {
    const bak = 'public/hostplants.csv.bak.split_' + Date.now();
    fs.copyFileSync(hostPath, bak);
    fs.writeFileSync(hostPath, stringify(out));
  }
  console.log('Candidates:', candidateCount, 'Split:', splitCount);
}

if (require.main === module) main();
