// Build unified JA name -> family map from:
// - public/20210514YList_download.csv (YList)
// - public/wamei_checklist_ver.1.10.csv (Wamei checklist)
// Output: public/name_family_map.csv with columns: name,family_jp,family_en,source

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

function loadCsvObjects(path) {
  if (!fs.existsSync(path)) return { header: [], rows: [] };
  const text = fs.readFileSync(path, 'utf8');
  if (!text.trim()) return { header: [], rows: [] };
  const rows = parseCSV(text);
  const header = rows[0] || [];
  const objs = rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  return { header, rows: objs };
}

function normalizeName(s) {
  return (s || '')
    .replace(/\uFEFF/g, '') // BOM
    .replace(/[\s\t\u3000]+/g, ' ') // unify spaces
    .trim();
}

function main() {
  const yPath = 'public/20210514YList_download.csv';
  const wPath = 'public/wamei_checklist_ver.1.10.csv';
  const outPath = 'public/name_family_map.csv';

  const y = loadCsvObjects(yPath);
  const w = loadCsvObjects(wPath);

  // name -> {family_jp, family_en, source}
  const map = new Map();

  // YList: columns of interest
  for (const row of y.rows) {
    const name = normalizeName(row['和名']);
    if (!name) continue;
    const famJP = normalizeName(row['LAPGII::LAPG科名'] || row['LAPG 科名']);
    const famEN = normalizeName(row['LAPGII::LAPG Family狭義'] || row['LAPG Family'] || row['LAPGII::LAPG Family広義']);
    const fam = famJP || famEN;
    if (!fam) continue;
    if (!map.has(name)) map.set(name, { family_jp: famJP || '', family_en: famEN || '', source: 'ylist' });
    // 別名もマッピング
    const aka = normalizeName(row['別名']);
    if (aka) {
      // 別名は複数区切りの可能性あり（「、」や「/」等）
      const aliases = aka.split(/[、,\/\|]/).map(normalizeName).filter(Boolean);
      for (const al of aliases) {
        if (!map.has(al)) map.set(al, { family_jp: famJP || '', family_en: famEN || '', source: 'ylist:alias' });
      }
    }
  }

  // Wamei checklist
  for (const row of w.rows) {
    const famJP = normalizeName(row['Family name (JP)']);
    if (!famJP) continue;
    const name1 = normalizeName(row['all_name']);
    const name2 = normalizeName(row['Hub name']);
    const put = (nm) => {
      if (!nm) return;
      if (!map.has(nm)) map.set(nm, { family_jp: famJP, family_en: '', source: 'wamei' });
    };
    put(name1);
    put(name2);
  }

  const outRows = [['name', 'family_jp', 'family_en', 'source']];
  for (const [name, v] of map.entries()) {
    outRows.push([name, v.family_jp, v.family_en, v.source]);
  }
  const csv = outRows.map(r => r.map((s) => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s)).join(',')).join('\n') + '\n';
  fs.writeFileSync(outPath, csv);
  console.log('Wrote', outPath, 'rows:', outRows.length - 1);
}

if (require.main === module) {
  main();
}

