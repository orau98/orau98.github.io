// Fill missing plant_family in public/hostplants.csv
// Sources:
// 1) Same plant_name with existing family in hostplants.csv
// 2) YList CSV (public/20210514YList_download.csv) 和名 -> 科名
// 3) 和名チェックリスト (public/wamei_checklist_ver.1.10.csv) 和名 -> 科名（和名）

const fs = require('fs');

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const rows = [];
  for (const line of lines) {
    const row = [];
    let i = 0;
    let field = '';
    let inQuotes = false;
    while (i < line.length) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += c;
          i++;
        }
      } else {
        if (c === ',') {
          row.push(field);
          field = '';
          i++;
        } else if (c === '"') {
          inQuotes = true;
          i++;
        } else {
          field += c;
          i++;
        }
      }
    }
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toObjects(rows) {
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function stringifyCSV(rows) {
  const esc = (s) => {
    if (s == null) s = '';
    s = String(s);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

function loadCsvObjects(path) {
  if (!fs.existsSync(path)) return { header: [], rows: [] };
  const text = fs.readFileSync(path, 'utf8');
  if (!text.trim()) return { header: [], rows: [] };
  const rows = parseCSV(text);
  if (!rows.length) return { header: [], rows: [] };
  return { header: rows[0], rows: toObjects(rows) };
}

function buildNameToFamilyFromHostplants(hp) {
  const map = new Map();
  for (const row of hp.rows) {
    const name = (row.plant_name || '').trim();
    const fam = (row.plant_family || '').trim();
    if (!name || !fam) continue;
    if (!map.has(name)) map.set(name, fam);
  }
  return map;
}

function buildNameToFamilyFromYList(ylist) {
  const map = new Map();
  for (const row of ylist.rows) {
    const name = (row['和名'] || '').trim();
    if (!name) continue;
    const famJP = (row['LAPGII::LAPG科名'] || row['LAPG 科名'] || '').trim();
    const famEN = (row['LAPGII::LAPG Family狭義'] || row['LAPG Family'] || row['LAPGII::LAPG Family広義'] || '').trim();
    const fam = famJP || famEN;
    if (!fam) continue;
    if (!map.has(name)) map.set(name, fam);
  }
  return map;
}

function buildNameToFamilyFromWamei(wamei) {
  const map = new Map();
  for (const row of wamei.rows) {
    const name1 = (row['all_name'] || '').trim();
    const name2 = (row['Hub name'] || '').trim();
    const famJP = (row['Family name (JP)'] || '').trim();
    if (name1 && famJP && !map.has(name1)) map.set(name1, famJP);
    if (name2 && famJP && !map.has(name2)) map.set(name2, famJP);
  }
  return map;
}

function main() {
  const hostPath = 'public/hostplants.csv';
  const backupPath = 'public/hostplants.csv.bak.autofamily';
  const ylistPath = 'public/20210514YList_download.csv';
  const wameiPath = 'public/wamei_checklist_ver.1.10.csv';
  const unifiedMapPath = 'public/name_family_map.csv';

  const hp = loadCsvObjects(hostPath);
  if (!hp.rows || !hp.rows.length) {
    console.error('hostplants.csv not found or empty');
    process.exit(1);
  }

  const name2famSelf = buildNameToFamilyFromHostplants(hp);
  // Prefer unified map if present
  const unified = loadCsvObjects(unifiedMapPath);
  const name2famUnified = new Map();
  if (unified.rows && unified.rows.length) {
    for (const row of unified.rows) {
      const nm = (row['name'] || '').trim();
      const fam = (row['family_jp'] || row['family_en'] || '').trim();
      if (!nm || !fam) continue;
      if (!name2famUnified.has(nm)) name2famUnified.set(nm, fam);
    }
  }
  const ylist = loadCsvObjects(ylistPath);
  const name2famY = buildNameToFamilyFromYList(ylist);
  const wamei = loadCsvObjects(wameiPath);
  const name2famW = buildNameToFamilyFromWamei(wamei);

  let missingBefore = 0;
  let filledSelf = 0, filledY = 0, filledW = 0, filledHeuristic = 0;

  const outRows = [hp.header];
  // Precompute known family name set from YList/Wamei for heuristic validation
  const knownFamilies = new Set();
  for (const v of name2famY.values()) knownFamilies.add(v.trim());
  for (const v of name2famW.values()) knownFamilies.add(v.trim());

  for (const row of hp.rows) {
    let fam = (row.plant_family || '').trim();
    if (!fam) {
      missingBefore++;
      const name = (row.plant_name || '').trim();
      if (name2famUnified.has(name)) {
        fam = name2famUnified.get(name);
        filledY++; // count as external map fill
      } else if (name2famSelf.has(name)) {
        fam = name2famSelf.get(name);
        filledSelf++;
      } else if (name2famY.has(name)) {
        fam = name2famY.get(name);
        filledY++;
      } else if (name2famW.has(name)) {
        fam = name2famW.get(name);
        filledW++;
      } else {
        // Heuristics:
        // - If plant_name ends with '科', trust as family-level label
        // - If plant_name ends with '類' and (stem + '科') exists in known family names, use it
        if (/科$/.test(name)) {
          fam = name;
          filledHeuristic++;
        } else if (/類$/.test(name)) {
          const stem = name.replace(/類$/, '');
          const candidate = stem + '科';
          if (knownFamilies.has(candidate)) {
            fam = candidate;
            filledHeuristic++;
          }
        }
      }
    }
    const out = hp.header.map((h) => (h === 'plant_family' ? fam : row[h] ?? ''));
    outRows.push(out);
  }

  const output = stringifyCSV(outRows);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(hostPath, backupPath);
  }
  fs.writeFileSync(hostPath, output);

  const totalFilled = filledSelf + filledY + filledW + filledHeuristic;
  console.log('Rows:', hp.rows.length);
  console.log('Missing before:', missingBefore);
  console.log('Filled from self:', filledSelf);
  console.log('Filled from YList:', filledY);
  console.log('Filled from Wamei:', filledW);
  console.log('Filled by heuristic:', filledHeuristic);
  console.log('Remaining missing (approx):', Math.max(0, missingBefore - totalFilled));
}

if (require.main === module) {
  main();
}
