#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { getPublicHostPlantNote } from "../src/utils/publicHostPlantNotes.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILES = [
  path.join(ROOT, "data/scolytinae_host_record_groups.json"),
  path.join(ROOT, "data/scolytinae_nobuchi_1964_hosts.json"),
  path.join(ROOT, "data/scolytinae_xylosandrus_1981_hosts.json"),
];
const INSECTS_CSV = path.join(ROOT, "normalized_data/insects.csv");
const HOSTPLANTS_CSV = path.join(ROOT, "normalized_data/hostplants.csv");
const YLIST_JSON = path.join(ROOT, "normalized_data/ylist-lite.json");
const AUDIT_JSON = path.join(
  ROOT,
  "outputs/scolytinae/host-records-audit-2026.json",
);
const APPLY = process.argv.includes("--apply");

const GEOGRAPHY_TYPES = new Map([
  ["japan_explicit", "文献（国内・明記）"],
  ["japan_inferred", "文献（国内・論文範囲）"],
  ["overseas_explicit", "文献（海外・明記）"],
  ["unknown", "文献（地域不明）"],
]);

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(
      `${filePath} のCSV解析に失敗しました: ${parsed.errors[0].message}`,
    );
  }
  return {
    columns: parsed.meta.fields,
    rows: parsed.data,
    newline: text.includes("\r\n") ? "\r\n" : "\n",
    bom: text.startsWith("\uFEFF"),
  };
}

function writeCsv(
  filePath,
  rows,
  columns,
  { newline = "\n", bom = false } = {},
) {
  const prefix = bom ? "\uFEFF" : "";
  fs.writeFileSync(
    filePath,
    `${prefix}${Papa.unparse(rows, { columns, newline })}${newline}`,
    "utf8",
  );
}

function readSourceRecords(filePath) {
  const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const groups = Array.isArray(document.groups) ? document.groups : [];
  const rows = groups.flatMap((group) =>
    (group.hosts || []).map((host, index) => ({
      ...group,
      ...host,
      source_record_id: `${group.record_prefix}-${String(index + 1).padStart(2, "0")}`,
    })),
  );
  return { rows };
}

const source = {
  rows: SOURCE_FILES.flatMap((filePath) => readSourceRecords(filePath).rows),
};
const insects = readCsv(INSECTS_CSV);
const hostplants = readCsv(HOSTPLANTS_CSV);
const ylist = JSON.parse(fs.readFileSync(YLIST_JSON, "utf8"));
const insectById = new Map(insects.rows.map((row) => [row.insect_id, row]));
const duplicateSourceIds = source.rows
  .map((row) => row.source_record_id)
  .filter((id, index, all) => all.indexOf(id) !== index);
if (duplicateSourceIds.length > 0) {
  throw new Error(
    `source_record_id が重複しています: ${[...new Set(duplicateSourceIds)].join(", ")}`,
  );
}

const approved = [];
const excluded = [];
const errors = [];
const geographyCounts = Object.fromEntries(
  [...GEOGRAPHY_TYPES.keys()].map((key) => [key, 0]),
);

for (const row of source.rows) {
  const status = (row.review_status || "").trim();
  if (status !== "approved") {
    excluded.push({
      source_record_id: row.source_record_id,
      insect_scientific_name: row.insect_scientific_name,
      plant_scientific_name_original: row.plant_scientific_name_original,
      reason: row.exclusion_reason || "review_statusがapprovedではない",
    });
    continue;
  }

  const insect = insectById.get(row.insect_id);
  if (!insect) {
    errors.push(
      `${row.source_record_id}: insect_id ${row.insect_id} が見つかりません`,
    );
    continue;
  }
  if (
    (insect.scientific_name || "").trim() !==
    (row.insect_scientific_name || "").trim()
  ) {
    errors.push(
      `${row.source_record_id}: 学名が目録と不一致です (${row.insect_scientific_name} != ${insect.scientific_name})`,
    );
    continue;
  }

  const geographyScope = (row.geographic_scope || "").trim();
  if (!GEOGRAPHY_TYPES.has(geographyScope)) {
    errors.push(
      `${row.source_record_id}: geographic_scope ${geographyScope} は未定義です`,
    );
    continue;
  }

  const plantName = (row.plant_name || "").trim();
  const canonical = ylist.plants?.[plantName]
    ? plantName
    : ylist.aliasToCanonical?.[plantName] || "";
  const ylistPlant = canonical ? ylist.plants?.[canonical] : null;
  if (
    ylistPlant?.familyJp &&
    ylistPlant.familyJp !== (row.plant_family || "").trim()
  ) {
    errors.push(
      `${row.source_record_id}: ${plantName} の科名がYListと不一致です (${row.plant_family} != ${ylistPlant.familyJp})`,
    );
    continue;
  }

  geographyCounts[geographyScope] += 1;
  approved.push({
    record_id: `hostplant-SC-${row.source_record_id}`,
    insect_id: row.insect_id,
    plant_name: plantName,
    plant_family: row.plant_family,
    observation_type: GEOGRAPHY_TYPES.get(geographyScope),
    plant_part: row.plant_part || "樹皮下・材",
    life_stage: row.life_stage || "記載なし",
    reference: row.reference,
    notes: getPublicHostPlantNote(
      [
        `記録地域: ${row.geography_label}`,
        `地域根拠: ${row.geography_basis}`,
        `原著植物名: ${row.plant_scientific_name_original}`,
        row.plant_scientific_name_accepted
          ? `YList採用名: ${row.plant_scientific_name_accepted}`
          : "",
        `寄主根拠: ${row.evidence_type}`,
        row.page ? `掲載頁: ${row.page}` : "",
        row.notes || "",
      ]
        .filter(Boolean)
        .join(" / "),
    ),
  });
}

if (errors.length > 0) {
  throw new Error(`寄主記録の検証に失敗しました:\n${errors.join("\n")}`);
}

const duplicateOutputKeys = approved
  .map(
    (row) =>
      `${row.insect_id}|${row.plant_name}|${row.reference}|${row.observation_type}`,
  )
  .filter((key, index, all) => all.indexOf(key) !== index);
if (duplicateOutputKeys.length > 0) {
  throw new Error(
    `承認済み寄主記録が重複しています: ${[...new Set(duplicateOutputKeys)].join(", ")}`,
  );
}

const audit = {
  source_files: SOURCE_FILES.map((filePath) => path.relative(ROOT, filePath)),
  source_record_count: source.rows.length,
  approved_record_count: approved.length,
  excluded_record_count: excluded.length,
  approved_insect_count: new Set(approved.map((row) => row.insect_id)).size,
  approved_plant_count: new Set(approved.map((row) => row.plant_name)).size,
  geography_counts: geographyCounts,
  excluded_records: excluded,
};
fs.mkdirSync(path.dirname(AUDIT_JSON), { recursive: true });
fs.writeFileSync(AUDIT_JSON, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

if (APPLY) {
  const retained = hostplants.rows.filter(
    (row) => !String(row.record_id || "").startsWith("hostplant-SC-"),
  );
  writeCsv(HOSTPLANTS_CSV, [...retained, ...approved], hostplants.columns, {
    newline: hostplants.newline,
    bom: hostplants.bom,
  });
}

console.log(JSON.stringify({ ...audit, applied: APPLY }, null, 2));
