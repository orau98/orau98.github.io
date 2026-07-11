#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_TEXT_PATH = process.env.HAMAKIGA3_SOURCE_TEXT_PATH;
if (!SOURCE_TEXT_PATH) throw new Error('HAMAKIGA3_SOURCE_TEXT_PATH is required');

const SOURCE = '日本のハマキガ3';
const PDF_FILE = '日本のハマキガ3.pdf';
const PDF_SHA256 = 'c10c4be6f8b7d4988a83361eafb3216131752bfd50d10ab32d4f6deca5cc240f';
const REVIEWED_ON = '2026-07-12';
const OUTPUT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-3-general-note-all-rows-2026-07-12.json',
);

const approvedContent = new Map(Object.entries({
  'note-H3-0002': '幼虫はサガリバナの蕾や枝先に潜ったり、葉の縁を折り曲げたりする。',
  'note-H3-0022': 'Sakagami and Shimizu（2023）によると、東日本ではヤマコウバシの葉を綴るが、西日本では葉を折り曲げるというように、摂食習性が異なる。',
  'note-H3-0033': '幼虫は葉の縁あるいは中央脈から葉を折り返したり、葉を重ね合わせたりし、その中に潜みながら内面を摂食する。糞はその中にためる。本州では年2化。蛹越冬。',
  'note-H3-0057': '幼虫は葉の縁を曲げたり、中央脈から2つに折り曲げたりして、その内面を先端から摂食する。糞は内部にためる。',
  'note-H3-0077': '',
  'note-H3-0110': 'リンゴに多発したが、近年は問題になっていない（奥、2003）。幼虫は葉を乱雑に綴る。',
  'note-H3-0115': '幼虫は7月と9月に確認されており、アラカシの新葉を縦に巻いた中に潜み、その中で蛹化し、羽化の最も遅い記録は10月であった（船越、2008）。船越は11月中旬にも本種の成虫を野外で採取している。なお、沖縄島ではスダジイのひこばえを摂食していることが報告されている（富永、2016）',
  'note-H3-0129': '幼虫は寄主植物の新葉を中央脈から2つに折り曲げ、中に潜みながら、葉を摂食する。',
  'note-H3-0138': '幼虫は沖縄ではツゲモドキの葉を重ね合わせるか、あるいは1枚の葉を折り曲げて、その中に潜みながら葉の表面を摂食する。',
  'note-H3-0143': '高山帯に生息する。',
  'note-H3-0182': '5〜7月に針葉を綴る幼虫が見られる。',
  'note-H3-0198': '幼虫はウツギの新葉を綴ったり、葉を二つ折りにする。',
  'note-H3-0204': '',
  'note-H3-0217': '幼虫はさまざまな植物の葉を綴る。',
  'note-H3-0265': '幼虫は寄主植物の花床、種子や葉を摂食する。奥（2003）は、Acrobasis属（メイガ科マダラメイガ亜科）幼虫の巻葉内から本種幼虫を飼育している。',
  'note-H3-0267': '幼虫は広食性で、様々な植物の葉を綴ったり、果実に潜ったりする。オトシブミの揺籃や、モモコフキアブラムシ Hyalopterus pruni による変形葉からも飼育されている（奥、2003）。',
}));

const sourceContentOverrides = new Map(Object.entries({
  'note-H3-0115': '幼虫は7月と9月に確認されており、アラカシの新葉を縦に巻いた中に潜み、その中で蛹化し、羽化の最も遅い記録は10月であった（船越、2008）。船越は 11月中旬にも本種の成虫を野外で採取しているので、彼も推測するように、成虫越冬かもしれない。なお、沖縄島ではスダジイのひこばえを摂食していることが報告されている（富永、2016）',
  'note-H3-0267': '幼虫は広食性で、 様々な植物の葉を綴ったり、 果実に潜ったりする。オトシブミの揺らんやモモコフキアブラムシHyalopterus pruniよる変形葉からも飼育されている（奥、2003）',
}));

const decisions = new Map(Object.entries({
  'note-H3-0002': 'retain_larval_observation_remove_speculative_voltinism',
  'note-H3-0022': 'retain_observed_regional_behavior_remove_unresolved_hypotheses',
  'note-H3-0033': 'retain_feeding_and_observed_life_cycle_remove_speculative_pupation_site',
  'note-H3-0057': 'retain_feeding_observation_remove_speculative_pupation_site',
  'note-H3-0077': 'delete_inference_only_note',
  'note-H3-0110': 'retain_damage_and_feeding_observation_remove_speculative_overwintering',
  'note-H3-0115': 'retain_observations_remove_speculative_adult_overwintering',
  'note-H3-0129': 'retain_feeding_observation_remove_speculative_pupation_site',
  'note-H3-0138': 'retain_feeding_observation_remove_speculative_voltinism',
  'note-H3-0143': 'retain_habitat_remove_uncertain_host_exclusivity_claim',
  'note-H3-0182': 'retain_larval_observation_remove_speculative_adult_overwintering',
  'note-H3-0198': 'retain_feeding_observation_remove_speculative_voltinism',
  'note-H3-0204': 'delete_inference_only_polyphagy_note',
  'note-H3-0217': 'retain_feeding_observation_remove_name_etymology',
  'note-H3-0265': 'retain_feeding_and_rearing_observations_remove_speculative_voltinism',
  'note-H3-0267': 'restore_original_objective_rearing_observation_and_normalize_typography',
}));

const sourcePageOverrides = new Map([
  ['note-H3-0050', [25, 26]],
]);

function readCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed.data;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('，', ',')
    .replaceAll('．', '.')
    .replaceAll('。', '.')
    .replaceAll('、', ',')
    .replace(/[\s・･]+/g, '')
    .replace(/[−–—―〜~]/g, '-');
}

const pages = fs.readFileSync(SOURCE_TEXT_PATH, 'utf8').split('\f');
const normalizedPages = pages.map((page) => normalize(page));
const body = Array.from({ length: 65 }, (_, offset) => {
  const pdfPage = offset + 14;
  return `\n@@PAGE=${pdfPage}@@\n${pages[pdfPage - 1] || ''}`;
}).join('');
const headingPattern = /^\s*(\d{1,3})(?:\.\s+|\s+)([A-Z][A-Za-z]+(?:\s+\([A-Z][A-Za-z]+\))?\s+[^\n]+)/gm;
const headingMatches = [...body.matchAll(headingPattern)]
  .filter((match) => Number(match[1]) >= 1 && Number(match[1]) <= 180);
if (headingMatches.length !== 180) {
  throw new Error(`Expected 180 source accounts; found ${headingMatches.length}`);
}

const accounts = new Map();
for (const [index, match] of headingMatches.entries()) {
  const account = Number(match[1]);
  if (accounts.has(account)) throw new Error(`Duplicate source account: ${account}`);
  const start = match.index;
  const end = headingMatches[index + 1]?.index ?? body.length;
  const block = body.slice(start, end);
  const preceding = body.slice(0, start);
  const pageMatches = [...preceding.matchAll(/@@PAGE=(\d+)@@/g)];
  const pdfPageStart = Number(pageMatches.at(-1)?.[1]);
  const blockPages = [pdfPageStart, ...[...block.matchAll(/@@PAGE=(\d+)@@/g)]
    .map((pageMatch) => Number(pageMatch[1]))];
  const pdfPageEnd = Math.max(...blockPages);
  accounts.set(account, {
    account,
    heading: match[2].trim(),
    block,
    normalizedBlock: normalize(block.replace(/@@PAGE=\d+@@/g, '')),
    pdfPageStart,
    pdfPageEnd,
  });
}
if (accounts.size !== 180) throw new Error(`Expected 180 unique accounts; found ${accounts.size}`);

const insects = readCsv(path.join(ROOT, 'normalized_data', 'insects.csv'));
const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
const notes = readCsv(path.join(ROOT, 'normalized_data', 'general_notes.csv'))
  .filter((row) => row.reference === SOURCE);
if (notes.length !== 289) throw new Error(`Expected 289 current notes; found ${notes.length}`);

const groups = [];
for (const note of notes) {
  if (groups.at(-1)?.insectId !== note.insect_id) {
    groups.push({ insectId: note.insect_id, notes: [] });
  }
  groups.at(-1).notes.push(note);
}
if (groups.length !== 180) throw new Error(`Expected 180 note groups; found ${groups.length}`);

function sourceContent(note) {
  return sourceContentOverrides.get(note.record_id) ?? note.content;
}

function scoreAccount(group, account) {
  const insect = insectsById.get(group.insectId);
  if (!insect) throw new Error(`Missing current insect: ${group.insectId}`);
  const japaneseName = normalize(insect.japanese_name);
  const binomial = normalize(`${insect.genus} ${insect.species}`);
  let score = 0;
  if (japaneseName && account.normalizedBlock.includes(japaneseName)) score += 80;
  if (binomial && account.normalizedBlock.includes(binomial)) score += 60;
  for (const note of group.notes) {
    const query = normalize(sourceContent(note));
    if (account.normalizedBlock.includes(query)) {
      score += 120;
      continue;
    }
    const chunks = [];
    for (let offset = 0; offset < Math.max(1, query.length - 17); offset += 9) {
      const chunk = query.slice(offset, offset + 18);
      if (chunk.length >= 8) chunks.push(chunk);
    }
    score += 12 * chunks.filter((chunk) => account.normalizedBlock.includes(chunk)).length;
  }
  return score;
}

const accountAssignments = new Map();
for (const group of groups) {
  const ranked = [...accounts.values()]
    .map((account) => ({ account, score: scoreAccount(group, account) }))
    .sort((left, right) => right.score - left.score || left.account.account - right.account.account);
  if (ranked[0].score < 180 || ranked[0].score === ranked[1].score) {
    throw new Error(
      `Ambiguous account for ${group.insectId}: ${ranked[0].account.account}/${ranked[0].score}`,
    );
  }
  accountAssignments.set(group.insectId, ranked[0].account);
}
if (new Set([...accountAssignments.values()].map((account) => account.account)).size !== 180) {
  throw new Error('The 180 current note groups do not map one-to-one to the 180 source accounts');
}

const rows = notes.map((note) => {
  const account = accountAssignments.get(note.insect_id);
  const originalContent = sourceContent(note);
  const normalizedSourceContent = normalize(originalContent);
  let sourceMatch = 'exact_in_account';
  if (!account.normalizedBlock.includes(normalizedSourceContent)) {
    const chunks = [];
    for (let offset = 0; offset < Math.max(1, normalizedSourceContent.length - 17); offset += 9) {
      const chunk = normalizedSourceContent.slice(offset, offset + 18);
      if (chunk.length >= 8) chunks.push(chunk);
    }
    const matched = chunks.filter((chunk) => account.normalizedBlock.includes(chunk)).length;
    if (matched < Math.max(1, Math.floor(chunks.length * 0.5))) {
      throw new Error(`${note.record_id}: source content is not supported by account ${account.account}`);
    }
    sourceMatch = 'ordered_source_fragments_in_account';
  }
  const approved = approvedContent.has(note.record_id)
    ? approvedContent.get(note.record_id)
    : note.content;
  const action = approvedContent.has(note.record_id)
    ? (approved ? 'replace_content' : 'delete_note')
    : 'verify_and_set_page';
  const sourceChunks = [];
  for (let offset = 0; offset < Math.max(1, normalizedSourceContent.length - 17); offset += 9) {
    const chunk = normalizedSourceContent.slice(offset, offset + 18);
    if (chunk.length >= 8) sourceChunks.push(chunk);
  }
  const matchingPages = [...(sourcePageOverrides.get(note.record_id) || [])];
  for (let pdfPage = account.pdfPageStart; pdfPage <= account.pdfPageEnd; pdfPage += 1) {
    const pageText = normalizedPages[pdfPage - 1] || '';
    if (
      pageText.includes(normalizedSourceContent)
      || sourceChunks.some((chunk) => pageText.includes(chunk))
    ) {
      if (!matchingPages.includes(pdfPage)) matchingPages.push(pdfPage);
    }
  }
  if (matchingPages.length === 0) {
    throw new Error(`${note.record_id}: source page could not be localized within its account`);
  }
  const pdfPageStart = Math.min(...matchingPages);
  const pdfPageEnd = Math.max(...matchingPages);
  const page = pdfPageStart === pdfPageEnd
    ? String(pdfPageStart)
    : `${pdfPageStart}-${pdfPageEnd}`;
  const printedPageStart = pdfPageStart - 1;
  const printedPageEnd = pdfPageEnd - 1;
  const printedPage = printedPageStart === printedPageEnd
    ? String(printedPageStart)
    : `${printedPageStart}-${printedPageEnd}`;
  return {
    record_id: note.record_id,
    insect_id: note.insect_id,
    note_type: note.note_type,
    reference: SOURCE,
    source_account: account.account,
    source_heading: account.heading,
    source_scope: 'taxon_exact_no_current_subspecies_sibling',
    source_match: sourceMatch,
    source_content: originalContent,
    transitional_content: note.record_id === 'note-H3-0267' ? note.content : '',
    approved_content: approved,
    action,
    decision: decisions.get(note.record_id) ?? 'verified_objective_source_content',
    pdf_file: PDF_FILE,
    source_pdf_sha256: PDF_SHA256,
    pdf_page: page,
    printed_page: printedPage,
    reviewed_on: REVIEWED_ON,
    evidence_note: approvedContent.has(note.record_id)
      ? '原PDFの種アカウントを画像確認し、観察事実と明示情報だけを公開対象にした。'
      : '原PDF本文の同一種アカウント内で内容を照合した。',
  };
});

const actionCounts = rows.reduce((counts, row) => {
  counts[row.action] = (counts[row.action] || 0) + 1;
  return counts;
}, {});
if (
  actionCounts.verify_and_set_page !== 273
  || actionCounts.replace_content !== 14
  || actionCounts.delete_note !== 2
) {
  throw new Error(`Unexpected action counts: ${JSON.stringify(actionCounts)}`);
}

const ledger = {
  audit_metadata: {
    source: SOURCE,
    pdf_file: PDF_FILE,
    source_pdf_sha256: PDF_SHA256,
    source_text_sha256: '3521f894b3e120dd210f8635d0343c37af012c63648e2d41c77aa547b01bf28c',
    reviewed_on: REVIEWED_ON,
    source_accounts_reviewed: 180,
    current_rows_reviewed: 289,
    source_scope_policy: '亜種を明記しない種レベル情報は該当する現行亜種へ共有し、地域・亜種限定情報は他へ広げない。対象180群には共有先となる現行亜種 sibling はなかった。',
    action_counts: actionCounts,
    source_match_counts: rows.reduce((counts, row) => {
      counts[row.source_match] = (counts[row.source_match] || 0) + 1;
      return counts;
    }, {}),
    visual_reviewed_change_pages: [14, 19, 21, 27, 32, 39, 40, 43, 45, 46, 55, 59, 60, 62, 73],
    holds: 0,
  },
  rows,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: OUTPUT_PATH, ...ledger.audit_metadata }, null, 2));
