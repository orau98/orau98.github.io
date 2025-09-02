// Clear plant_family when plant_name indicates unknown (contains '不明')
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

function main() {
  const path = 'public/hostplants.csv';
  const bak = 'public/hostplants.csv.bak.clean_unknown';
  const text = fs.readFileSync(path, 'utf8');
  const rows = parseCSV(text);
  const H = rows[0];
  const idx = Object.fromEntries(H.map((h, i) => [h, i]));
  let changed = 0, targeted = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[idx['plant_name']] || '').trim();
    if (name.includes('不明')) {
      targeted++;
      if ((r[idx['plant_family']] || '').trim()) {
        r[idx['plant_family']] = '';
        changed++;
      }
    }
  }
  if (!fs.existsSync(bak)) fs.copyFileSync(path, bak);
  fs.writeFileSync(path, stringify(rows));
  console.log('Targets with 不明:', targeted, 'Updated family cleared:', changed);
}

if (require.main === module) main();

