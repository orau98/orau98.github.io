import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const INSECTS = path.join(process.cwd(), 'public', 'insects.csv')
const HOSTPLANTS = path.join(process.cwd(), 'public', 'hostplants.csv')

// Manual canonical mapping for known duplicates (LB -> CR)
const MAP = new Map([
  ['species-LB008', 'species-CR002'], // ジュウシホシクビナガハムシ
  ['species-LB009', 'species-CR003'], // ルイスクビナガハムシ
  ['species-LB011', 'species-CR011'], // アカクビナガハムシ
  ['species-LB012', 'species-CR015'], // キイロホソハムシ -> トゲアシクビボソハムシ (Lema coronata)
  ['species-LB014', 'species-CR013'], // キバラルリクビボソハムシ (Lema concinnipennis)
  ['species-LB015', 'species-CR020'], // アワカクビボソハムシ (Lema diversa)
])

function loadCSV(fp) {
  const text = fs.readFileSync(fp, 'utf8')
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false })
  return { rows: parsed.data, fields: parsed.meta.fields }
}

function saveCSV(fp, rows, fields) {
  const csv = Papa.unparse(rows, { columns: fields })
  fs.writeFileSync(fp, csv, 'utf8')
}

function main() {
  const ins = loadCSV(INSECTS)
  const hp = loadCSV(HOSTPLANTS)

  // Validate canonical ids exist
  const byId = new Map(ins.rows.filter(r => r && r.insect_id).map(r => [r.insect_id, r]))
  for (const [from, to] of MAP) {
    if (!byId.has(from)) console.warn(`WARN: source id not found: ${from}`)
    if (!byId.has(to)) console.warn(`WARN: canonical id not found: ${to}`)
  }

  // Update hostplants
  let hpUpdated = 0
  for (const r of hp.rows) {
    const iid = r.insect_id
    if (MAP.has(iid)) {
      r.insect_id = MAP.get(iid)
      hpUpdated++
    }
  }

  // Remove source duplicates from insects
  const removeSet = new Set([...MAP.keys()])
  const kept = ins.rows.filter(r => !(r && removeSet.has(r.insect_id)))
  const removed = ins.rows.length - kept.length

  saveCSV(HOSTPLANTS, hp.rows, hp.fields)
  saveCSV(INSECTS, kept, ins.fields)

  console.log(`Hostplants updated: ${hpUpdated}`)
  console.log(`Insects rows removed: ${removed}`)
}

main()

