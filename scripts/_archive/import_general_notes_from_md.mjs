import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// 部分データ（日本蛾類標準図鑑3からの抜粋）
// 必要に応じてここへ追記、または別ファイル読み込みに変更可能
const RAW = `| 学名 | 成虫発生時期 | 成虫発生時期に関する備考 |
| :--- | :--- | :--- |
| Micropterix aureatella (Scopoli, 1763) | 6月～7月 | 年1化。 |
| Paramartyria immaculata Issiki, 1931 | 4月下旬～6月中旬 | 年1化。 |
| Paramartyria semifasciella Issiki, 1931 | 5月中旬～6月初旬 | 年1化。 |
| Issikiomartyria nudata (Issiki, 1953) | 7月 | 年1化。 |
| Issikiomartyria akemiae Hashimoto, 2006 | 5月末～6月初旬 | 年1化。 |
| Issikiomartyria plicata Hashimoto, 2006 | 5月末～6月初旬 | 年1化。 |
| Issikiomartyria distincta Hashimoto, 2006 | 5月末～6月初旬 | 年1化。 |
| Issikiomartyria bisegmentata Hashimoto, 2006 | 5月末～6月初旬 | 年1化。 |
| Kurokopteryx dolichocerata Hashimoto, 2006 | 4月中旬～下旬 | 年1化。 |
| Neomicropteryx nipponensis Issiki, 1931 | 5月中旬～6月初旬 | 年1化。 |
| Neomicropteryx kiwana Hashimoto, 2006 | 4月中旬～5月初旬と思われる | 年1化。 |
| Neomicropteryx redacta Hashimoto, 2006 | 4月下旬～5月中旬と思われる | 年1化。 |
| Neomicropteryx matsumurana Issiki, 1931 | 5月中旬～6月初旬 | 年1化。 |
| Neomicropteryx kazusana Hashimoto, 1992 | 4月下旬～5月上旬 | 年1化。 |
| Neomicropteryx bifurca Issiki, 1953 | 5月末～6月初旬 | 年1化。 |
| Neomicropteryx cornuta Issiki, 1953 | 5月末～6月初旬 | 年1化。 |
| Neomicropteryx elongata Issiki, 1953 | 5月末～6月初旬 | 年1化。 |
| Issikiocrania japonicella Moriuti, 1982 | 5月初旬～中旬 |  |
| Eriocrania unimaculella (Zetterstedt, 1839) | 情報なし | 北海道でシラカンバから採集された幼虫を飼育し羽化に成功させている。 |
| Eriocrania sp. 1 | 愛知県で4月下旬、奈良県大台ヶ原で5月中旬 |  |
| Eriocrania komaii Mizukawa, Hirowatari & Hashimoto, 2006 | 4月下旬 |  |
| Eriocrania sparrmannella (Bosc, 1791) | 長野県では5月中旬 |  |
| Eriocrania sakhalinella Kozlov, 1983 | 早春 |  |
| Eriocrania sp. 2 | 本州では愛知県で4月下旬、四国では5月中旬 |  |
| Eriocrania sp. 3 | 長野県で4月下旬 |  |
| Eriocrania sangii (Wood, 1891) | 北海道の苫小牧では4月下旬、十勝岳温泉(標高2000m)で5月下旬 |  |
| Eriocrania semipurpurella (Stephens, 1835) | 4月下旬から5月上旬 |  |
| Eriocrania carpinella Moriuti, 2010 | 4月中旬 |  |
| Gazoryctra chishimana (Matsumura, 1931) | 8月下旬から9月上旬 | 大雪山旭岳小屋水場周辺では…年によって変動するという。 |
| Gazoryctra macilenta (Eversmann, 1851) | 8月中下旬から9月上旬 |  |
| Palpifer sexnotatus (Moore, 1879) | 情報なし | 台湾では古くからサトイモの害虫として有名。 |
| Pharmacis fusconebulosa (De Geer, 1778) | 7月中旬 |  |
| Thitarodes variabilis (Bremer, 1861) | 情報なし | 早池峰山で採集された記録があるのみ。 |
| Thitarodes nipponensis Ueda, 1996 | 5月上旬から6月中旬 |  |
| Platymatopus japonicus Inoue, 1982 | 情報なし | ♂成虫は日没前後の20～40分ほど振り子飛翔を行う。 |
| Endoclita excrescens (Butler, 1877) | 8月から10月にかけて |  |
| Endoclita sinensis (Moore, 1877) | 6月から8月にかけて |  |`;

const REF = '日本蛾類標準図鑑3';

function loadCSV(file) {
  return Papa.parse(fs.readFileSync(file, 'utf8'), { header: true, skipEmptyLines: false }).data;
}
function saveCSV(file, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(file, csv, 'utf8');
}

function toBinomial(sci) {
  if (!sci) return '';
  const t = sci.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/).filter(l => l.startsWith('|'));
  const out = [];
  for (const l of lines.slice(2)) { // skip header
    const cells = l.split('|').map(c => c.trim());
    if (cells.length < 4) continue;
    const sci = cells[1];
    const period = cells[2] && cells[2] !== '情報なし' ? cells[2] : '';
    const note = cells[3] || '';
    if (!sci) continue;
    out.push({ sci, period, note });
  }
  return out;
}

function nextNoteId(rows) {
  let mx = 0;
  for (const r of rows) {
    const m = String(r.record_id || '').match(/^note-(\d{6})$/);
    if (m) mx = Math.max(mx, parseInt(m[1], 10));
  }
  const n = mx + 1;
  return `note-${String(n).padStart(6, '0')}`;
}

function main() {
  const insectsPub = loadCSV(path.join('public', 'insects.csv'));
  const notesPub = loadCSV(path.join('public', 'general_notes.csv'));
  const notesNorm = loadCSV(path.join('normalized_data', 'general_notes.csv'));

  // Build index: binomial -> insect_id
  const byBinom = new Map();
  for (const r of insectsPub) {
    const b = toBinomial(r.scientific_name || `${r.genus || ''} ${r.species || ''}`);
    if (b) byBinom.set(b, r.insect_id);
  }

  const rows = parseMarkdown(RAW);
  // 手動エイリアス（表記揺れ/誤記対策）: binomial -> binomial
  const BINOMIAL_ALIAS = new Map([
    ['Paramartyria immaculata', 'Paramartyria immaculatella'],
    ['Platymatopus japonicus', 'Phymatopus japonicus'],
  ]);
  let matched = 0, added = 0, unmatched = 0;

  for (const row of rows) {
    let b = toBinomial(row.sci);
    let id = byBinom.get(b);
    if (!id && BINOMIAL_ALIAS.has(b)) {
      const b2 = BINOMIAL_ALIAS.get(b);
      id = byBinom.get(b2);
    }
    if (!id) { unmatched++; continue; }
    matched++;
    // Period
    if (row.period) {
      // avoid duplicate
      const exists = notesPub.some(n => n.insect_id === id && n.note_type === '出現時期' && (n.content || '').trim() === row.period.trim());
      if (!exists) {
        const rec = { record_id: nextNoteId(notesPub), insect_id: id, note_type: '出現時期', content: row.period, reference: REF, page: '', year: '' };
        notesPub.push(rec); notesNorm.push({ ...rec }); added++;
      }
    }
    // Note as ecology
    if (row.note) {
      const exists2 = notesPub.some(n => n.insect_id === id && n.note_type === '生態情報' && (n.content || '').trim() === row.note.trim());
      if (!exists2) {
        const rec2 = { record_id: nextNoteId(notesPub), insect_id: id, note_type: '生態情報', content: row.note, reference: REF, page: '', year: '' };
        notesPub.push(rec2); notesNorm.push({ ...rec2 }); added++;
      }
    }
  }

  saveCSV(path.join('public', 'general_notes.csv'), notesPub);
  saveCSV(path.join('normalized_data', 'general_notes.csv'), notesNorm);
  console.log(`matched=${matched} unmatched=${unmatched} added=${added}`);
}

main();
