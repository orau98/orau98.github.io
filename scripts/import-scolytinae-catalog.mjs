#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_URL =
  "https://japanesebeetles.jimdofree.com/%E7%9B%AE%E9%8C%B2/129-%E3%82%BE%E3%82%A6%E3%83%A0%E3%82%B7%E7%A7%91/129-17-%E3%82%AD%E3%82%AF%E3%82%A4%E3%83%A0%E3%82%B7%E4%BA%9C%E7%A7%91/";
const DEFAULT_INSECTS_CSV = path.join(ROOT, "normalized_data/insects.csv");
const DEFAULT_CATALOG_CSV = path.join(
  ROOT,
  "outputs/scolytinae/catalog-2026.csv",
);
const DEFAULT_AUDIT_JSON = path.join(
  ROOT,
  "outputs/scolytinae/catalog-audit-2026.json",
);
const EXPECTED_SPECIES_COUNT = 322;

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
};
const shouldApply = args.includes("--apply");
const localHtmlPath = getArg("--html");
const accessedDate =
  getArg("--accessed") || new Date().toISOString().slice(0, 10);
const insectsCsvPath = path.resolve(getArg("--insects") || DEFAULT_INSECTS_CSV);
const catalogCsvPath = path.resolve(
  getArg("--catalog-out") || DEFAULT_CATALOG_CSV,
);
const auditJsonPath = path.resolve(getArg("--audit-out") || DEFAULT_AUDIT_JSON);

function decodeHtml(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const radix = entity[1].toLowerCase() === "x" ? 16 : 10;
      const body = radix === 16 ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(body, radix);
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(value = "") {
  return decodeHtml(
    value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, " "),
  )
    .normalize("NFKC")
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function inlineText(value = "") {
  return value.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim();
}

function getCells(rowHtml) {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (match) => ({
      html: match[1],
      text: htmlToText(match[1]),
    }),
  );
}

function parseScientificName(cell) {
  const fullText = cell.text.split("/")[0].trim();
  const emphasized = [...cell.html.matchAll(/<em\b[^>]*>([\s\S]*?)<\/em>/gi)]
    .map((match) => htmlToText(match[1]))
    .filter(Boolean);
  const taxonName = emphasized.join(" ").replace(/\s+/g, " ").trim();
  if (!taxonName) {
    throw new Error(`学名の強調部分を取得できません: ${cell.text}`);
  }

  const tokens = taxonName.split(/\s+/).filter(Boolean);
  const genus = tokens.shift() || "";
  let subgenus = "";
  if (tokens[0] && /^\([^)]+\)$/.test(tokens[0])) {
    subgenus = tokens.shift().slice(1, -1);
  }
  const species = tokens.shift() || "";
  const subspecies = tokens.join(" ");

  const authorityText = fullText
    .slice(fullText.indexOf(taxonName) + taxonName.length)
    .trim();
  const yearMatch = authorityText.match(/(\d{4})/);
  const year = yearMatch?.[1] || "";
  let author = year
    ? authorityText.slice(0, yearMatch.index).trim()
    : authorityText;
  author = author
    .replace(/^[\s(]+/, "")
    .replace(/[,\s)]+$/, "")
    .trim();

  return {
    author,
    genus,
    scientificName: fullText,
    species,
    subgenus,
    subspecies,
    taxonName,
    year,
  };
}

function parseCatalog(html) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const records = [];
  const corrections = [];
  let currentTribe = "";
  let currentSubtribe = "";

  for (const row of rows) {
    const cells = getCells(row[1]);
    if (cells.length === 1) {
      const tribeMatch = cells[0].text.match(/Tribe\s+([A-Z][A-Za-z-]+)/);
      const subtribeMatch = cells[0].text.match(/Subtribe\s+([A-Z][A-Za-z-]+)/);
      if (tribeMatch) currentTribe = tribeMatch[1];
      currentSubtribe = subtribeMatch?.[1] || "";
      continue;
    }
    if (cells.length < 3 || !/^\d+$/.test(cells[0].text)) continue;

    const expectedNumber = records.length + 1;
    const sourceNumber = Number.parseInt(cells[0].text, 10);
    let catalogNumber = sourceNumber;
    if (sourceNumber === 2144 && expectedNumber === 214) {
      catalogNumber = 214;
      corrections.push({
        field: "catalog_number",
        original: "2144",
        corrected: "214",
        scientific_name: "Scolytus esuriens Blandford, 1894",
        reason: "213と215の間にある連番誤記",
      });
    }
    if (catalogNumber !== expectedNumber) {
      throw new Error(
        `目録番号が不連続です: 期待値=${expectedNumber}, 取得値=${sourceNumber}`,
      );
    }

    const scientific = parseScientificName(cells[1]);
    const nameParts = cells[1].text.split("/");
    const japaneseName = nameParts.slice(1).join("/").trim();
    const distributionParts = inlineText(cells[2].text).split(";");
    const domesticDistribution = (distributionParts.shift() || "").trim();
    const overseasDistribution = distributionParts.join(";").trim();

    records.push({
      catalog_number: catalogNumber,
      source_catalog_number: sourceNumber,
      tribe: currentTribe,
      subtribe: currentSubtribe,
      genus: scientific.genus,
      subgenus: scientific.subgenus,
      species: scientific.species,
      subspecies: scientific.subspecies,
      author: scientific.author,
      year: scientific.year,
      japanese_name: japaneseName,
      scientific_name: scientific.scientificName,
      domestic_distribution: domesticDistribution,
      overseas_distribution: overseasDistribution,
      source_notes: (cells[5]?.text || "")
        .replace(/\s*\n+\s*/g, " / ")
        .trim(),
    });
  }

  if (records.length !== EXPECTED_SPECIES_COUNT) {
    throw new Error(
      `種数が一致しません: 期待値=${EXPECTED_SPECIES_COUNT}, 取得値=${records.length}`,
    );
  }
  const duplicateNames = records
    .map((record) => record.scientific_name)
    .filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new Error(
      `学名が重複しています: ${[...new Set(duplicateNames)].join(", ")}`,
    );
  }

  return { records, corrections };
}

function toInsectRow(record) {
  const distributionNotes = [
    record.domestic_distribution
      ? `国内分布: ${record.domestic_distribution}`
      : "国内分布: 記載なし",
    record.overseas_distribution
      ? `国外分布: ${record.overseas_distribution}`
      : "国外分布: 記載なし",
  ];
  return {
    insect_id: `species-SC${String(record.catalog_number).padStart(3, "0")}`,
    family: "Curculionidae",
    family_jp: "ゾウムシ科",
    subfamily: "Scolytinae",
    subfamily_jp: "キクイムシ亜科",
    tribe: record.tribe,
    tribe_jp: "",
    genus: record.genus,
    subgenus: record.subgenus,
    species: record.species,
    subspecies: record.subspecies,
    author: record.author,
    year: record.year,
    japanese_name: record.japanese_name,
    old_japanese_name: "",
    alternative_name: "",
    other_names: "",
    scientific_name: record.scientific_name,
    synonyms: "",
    changes_since_standard: "",
    notes: [
      `日本列島の甲虫全種目録2026年版 キクイムシ亜科 No.${record.catalog_number}（${accessedDate}参照）`,
      ...distributionNotes,
      record.source_notes ? `目録備考: ${record.source_notes}` : "",
    ]
      .filter(Boolean)
      .join("。"),
  };
}

async function loadHtml() {
  if (localHtmlPath)
    return fs.readFileSync(path.resolve(localHtmlPath), "utf8");
  const response = await fetch(CATALOG_URL, {
    headers: { "user-agent": "orau98.github.io catalog importer/1.0" },
  });
  if (!response.ok)
    throw new Error(`目録ページの取得に失敗しました: HTTP ${response.status}`);
  return response.text();
}

function writeCsv(
  filePath,
  rows,
  columns,
  { newline = "\n", bom = false } = {},
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const prefix = bom ? "\uFEFF" : "";
  fs.writeFileSync(
    filePath,
    `${prefix}${Papa.unparse(rows, { columns, newline })}${newline}`,
    "utf8",
  );
}

const html = await loadHtml();
const { records, corrections } = parseCatalog(html);
const insectRows = records.map(toInsectRow);

writeCsv(catalogCsvPath, records, Object.keys(records[0]));

const audit = {
  catalog_url: CATALOG_URL,
  accessed_date: accessedDate,
  expected_species_count: EXPECTED_SPECIES_COUNT,
  parsed_species_count: records.length,
  first_catalog_number: records[0].catalog_number,
  last_catalog_number: records.at(-1).catalog_number,
  unique_scientific_name_count: new Set(
    records.map((record) => record.scientific_name),
  ).size,
  domestic_distribution_present: records.filter(
    (record) => record.domestic_distribution,
  ).length,
  overseas_distribution_present: records.filter(
    (record) => record.overseas_distribution,
  ).length,
  corrections,
};
fs.mkdirSync(path.dirname(auditJsonPath), { recursive: true });
fs.writeFileSync(auditJsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

if (shouldApply) {
  const originalText = fs.readFileSync(insectsCsvPath, "utf8");
  const parsed = Papa.parse(originalText, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(
      `insects.csvの解析に失敗しました: ${parsed.errors[0].message}`,
    );
  }
  const columns = parsed.meta.fields;
  const retained = parsed.data.filter(
    (row) => !/^species-SC\d{3}$/.test((row.insect_id || "").trim()),
  );
  writeCsv(insectsCsvPath, [...retained, ...insectRows], columns, {
    newline: originalText.includes("\r\n") ? "\r\n" : "\n",
    bom: originalText.startsWith("\uFEFF"),
  });
}

console.log(
  JSON.stringify(
    {
      applied: shouldApply,
      catalogCsvPath,
      auditJsonPath,
      speciesCount: records.length,
      corrections,
    },
    null,
    2,
  ),
);
