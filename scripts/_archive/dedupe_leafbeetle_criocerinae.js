import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const INSECTS = path.join(process.cwd(), 'public', 'insects.csv')
const HOSTPLANTS = path.join(process.cwd(), 'public', 'hostplants.csv')

const TARGET_GENERA = new Set(['Crioceris', 'Lilioceris', 'Lema'])

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

  // Index CR canonical entries by genus+species
  const crByKey = new Map()
  for (const r of ins.rows) {
    const id = r.insect_id
    if (!id) continue
    if (!id.startsWith('species-CR')) continue
    const genus = (r.genus || '').trim()
    const species = (r.species || '').trim()
    if (!genus || !species) continue
    if (!TARGET_GENERA.has(genus)) continue
    const key = `${genus} ${species}`
    crByKey.set(key, id)
  }

  // Find LB duplicates that match CR by genus+species
  const lbToCr = new Map()
  for (const r of ins.rows) {
    const id = r.insect_id
    if (!id || !id.startsWith('species-LB')) continue
    const genus = (r.genus || '').trim()
    const species = (r.species || '').trim()
    if (!genus || !species) continue
    if (!TARGET_GENERA.has(genus)) continue
    const key = `${genus} ${species}`
    if (crByKey.has(key)) {
      lbToCr.set(id, crByKey.get(key))
    }
  }

  // Update hostplants: replace LB ids with CR canonical ids
  let hpUpdated = 0
  for (const hr of hp.rows) {
    const iid = hr.insect_id
    if (!iid) continue
    if (lbToCr.has(iid)) {
      hr.insect_id = lbToCr.get(iid)
      hpUpdated++
    }
  }

  // Remove LB duplicate rows from insects
  const keep = []
  let removed = 0
  for (const r of ins.rows) {
    const id = r.insect_id
    if (!id) { keep.push(r); continue }
    if (lbToCr.has(id)) { removed++; continue }
    keep.push(r)
  }

  saveCSV(HOSTPLANTS, hp.rows, hp.fields)
  saveCSV(INSECTS, keep, ins.fields)

  console.log(`LB→CR mappings: ${lbToCr.size}`)
  console.log(`Hostplants updated: ${hpUpdated}`)
  console.log(`Insects LB rows removed: ${removed}`)
}

main()

