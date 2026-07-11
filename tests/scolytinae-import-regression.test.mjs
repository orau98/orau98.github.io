import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import Papa from "papaparse";

import { convertNormalizedDataToStandardFormat } from "../src/utils/normalizedDataParser.js";

const readCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, "utf8"), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(parsed.errors, []);
  return parsed.data;
};

const insects = readCsv("normalized_data/insects.csv").filter(
  (row) => row.subfamily === "Scolytinae",
);
const insectIds = new Set(insects.map((row) => row.insect_id));
const hostplants = readCsv("normalized_data/hostplants.csv").filter((row) =>
  insectIds.has(row.insect_id),
);
const sourceRecords = new Map(
  [
    "data/scolytinae_host_record_groups.json",
    "data/scolytinae_nobuchi_1964_hosts.json",
    "data/scolytinae_xylosandrus_1981_hosts.json",
  ].flatMap((filePath) => {
    const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return (document.groups || []).flatMap((group) =>
      (group.hosts || []).map((host, index) => [
        `${group.record_prefix}-${String(index + 1).padStart(2, "0")}`,
        { ...group, ...host },
      ]),
    );
  }),
);

test("Scolytinae catalog imports all 322 sequential species", () => {
  assert.equal(insects.length, 322);
  assert.equal(insects[0].insect_id, "species-SC001");
  assert.equal(insects.at(-1).insect_id, "species-SC322");
  assert.equal(new Set(insects.map((row) => row.scientific_name)).size, 322);
  assert.equal(insects.some((row) => row.notes.includes("\n")), false);

  const corrected = insects.find((row) => row.insect_id === "species-SC214");
  assert.equal(corrected?.scientific_name, "Scolytus esuriens Blandford, 1894");
});

test("normalized parser keeps Scolytinae out of the moth collection", () => {
  const converted = convertNormalizedDataToStandardFormat(
    insects,
    hostplants,
    [],
  );
  assert.equal(converted.barkbeetles.length, 322);
  assert.equal(converted.moths.length, 0);
  assert.equal(converted.barkbeetles[0].type, "barkbeetle");
  const germanus = converted.barkbeetles.find(
    (insect) => insect.id === "species-SC310",
  );
  assert.ok(
    germanus.hostPlantsDetailed.some(
      (host) => host.displayName === "タカノツメ（樹木・ウコギ科）",
    ),
  );
});

test("host records retain explicit, inferred, overseas, and unknown geography", () => {
  assert.equal(hostplants.length, 372);
  const counts = hostplants.reduce((groups, row) => {
    groups[row.observation_type] ||= [];
    groups[row.observation_type].push(row);
    return groups;
  }, {});
  assert.equal(counts["文献（国内・明記）"]?.length, 191);
  assert.equal(counts["文献（国内・論文範囲）"]?.length, 93);
  assert.equal(counts["文献（海外・明記）"]?.length, 2);
  assert.equal(counts["文献（地域不明）"]?.length, 86);

  const hakkoda = hostplants.find(
    (row) => row.insect_id === "species-SC176" && row.plant_name === "ハイマツ",
  );
  assert.equal(hakkoda?.observation_type, "文献（国内・明記）");
  assert.equal(hakkoda?.notes || "", "");
  assert.match(
    sourceRecords.get("N74-JAPO-01")?.geography_label || "",
    /青森県八甲田山/,
  );

  const korea = hostplants.filter((row) => row.insect_id === "species-SC206");
  assert.equal(korea.length, 2);
  assert.ok(
    korea.every((row) => row.observation_type === "文献（海外・明記）"),
  );
  assert.ok(korea.every((row) => row.notes === ""));
  assert.match(
    sourceRecords.get("N79-SUBO-KOREA-01")?.geography_label || "",
    /海外（韓国）/,
  );
});

test("1964 specimen records are image-checked and limited to explicit Japanese records", () => {
  const records = hostplants.filter((row) =>
    row.reference.includes("Nobuchi (1964)"),
  );
  assert.equal(records.length, 20);
  assert.ok(
    records.every((row) => row.observation_type === "文献（国内・明記）"),
  );

  const niisimai = records.filter(
    (row) => row.insect_id === "species-SC155",
  );
  assert.equal(niisimai.length, 7);
  assert.ok(
    niisimai.some(
      (row) =>
        row.plant_name === "シリブカガシ" &&
        sourceRecords.get("N64-NIIS-03")?.plant_scientific_name_accepted ===
          "Lithocarpus glaber",
    ),
  );

  const compactus = records.filter(
    (row) => row.insect_id === "species-SC306",
  );
  assert.equal(compactus.length, 2);
  assert.ok(
    compactus.some(
      (row) =>
        row.plant_name === "モリシマアカシア" &&
        row.notes.includes("原綴りを保存"),
    ),
  );
});

test("1975 type records and 1981 Xylosandrus hosts keep their evidence scope", () => {
  const elongatus = hostplants.filter(
    (row) => row.insect_id === "species-SC055",
  );
  assert.equal(elongatus.length, 3);
  assert.ok(
    elongatus.every(
      (row) => row.observation_type === "文献（国内・明記）",
    ),
  );

  const germanus = hostplants.filter(
    (row) => row.insect_id === "species-SC310" && row.reference.includes("1981"),
  );
  assert.equal(germanus.length, 146);
  assert.ok(
    germanus.every(
      (row) => row.observation_type === "文献（国内・明記）",
    ),
  );

  const brevis = hostplants.filter(
    (row) => row.insect_id === "species-SC305" && row.reference.includes("1981"),
  );
  assert.equal(brevis.length, 18);
  assert.ok(
    brevis.every((row) => row.observation_type === "文献（地域不明）"),
  );

  const compactus = hostplants.filter(
    (row) => row.insect_id === "species-SC306" && row.reference.includes("1981"),
  );
  assert.equal(compactus.length, 19);
  assert.equal(
    compactus.filter(
      (row) => row.observation_type === "文献（国内・明記）",
    ).length,
    1,
  );
  assert.equal(
    compactus.filter((row) => row.observation_type === "文献（地域不明）")
      .length,
    18,
  );
  assert.ok(
    germanus.some(
      (row) =>
        row.plant_name === "タカノツメ（樹木）" &&
        sourceRecords.get("N81-GERM-119")?.plant_scientific_name_accepted ===
          "Gamblea innovans",
    ),
  );
});

test("ambiguous taxonomy and source-flagged host errors stay excluded", () => {
  assert.equal(
    hostplants.some(
      (row) =>
        row.insect_id === "species-SC163" && row.plant_name === "イチイガシ",
    ),
    false,
  );
  assert.equal(
    hostplants.some((row) =>
      ["species-SC210", "species-SC209"].includes(row.insect_id),
    ),
    false,
  );

  const audit = JSON.parse(
    fs.readFileSync("outputs/scolytinae/host-records-audit-2026.json", "utf8"),
  );
  assert.equal(audit.excluded_record_count, 22);
  assert.ok(
    audit.excluded_records.some((row) =>
      String(row.reason || "").includes("原著自身"),
    ),
  );
  assert.ok(
    audit.excluded_records.some(
      (row) => row.source_record_id === "N64-OLEI-01",
    ),
  );
});
