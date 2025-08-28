import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { VersionedCache } from './lib/versionedCache.js'

const CSV_PATH = path.join(process.cwd(), 'public', 'insects.csv')

function parseName(sci) {
  // Returns { genus, subgenus, species, subspecies }
  const res = { genus: '', subgenus: '', species: '', subspecies: '' }
  if (!sci) return res
  const toks = sci.trim().split(/\s+/)
  if (toks.length === 0) return res
  res.genus = toks[0] || ''
  if (toks.length >= 2 && /^\(.*\)$/.test(toks[1])) {
    res.subgenus = toks[1].slice(1, -1)
    res.species = toks[2] || ''
    res.subspecies = toks[3] || ''
  } else {
    res.species = toks[1] || ''
    res.subspecies = toks[2] || ''
  }
  return res
}

function buildGenusMap(rows) {
  // Map genus -> { subfamily, subfamily_jp, tribe, tribe_jp }
  const map = new Map()
  for (const r of rows) {
    const genus = r.genus?.trim()
    const subfamily = r.subfamily?.trim()
    if (!genus || !subfamily) continue
    if (!map.has(genus)) {
      map.set(genus, {
        subfamily: r.subfamily || '',
        subfamily_jp: r.subfamily_jp || '',
        tribe: r.tribe || '',
        tribe_jp: r.tribe_jp || '',
      })
    }
  }
  return map
}

// Hardcoded complements based on the referenced site (japanesebeetles) for genera
const siteBased = new Map([
  // Donaciinae (ネクイハムシ亜科)
  ['Plateumaris', { subfamily: 'Donaciinae', subfamily_jp: 'ネクイハムシ亜科', tribe: 'Donaciini', tribe_jp: 'ネクイハムシ族' }],

  // Cryptocephalinae (ツツハムシ亜科)
  ['Physosmaragdia', { subfamily: 'Cryptocephalinae', subfamily_jp: 'ツツハムシ亜科', tribe: 'Clytrini', tribe_jp: 'ナガツツハムシ族' }],
  ['Physosmaragdina', { subfamily: 'Cryptocephalinae', subfamily_jp: 'ツツハムシ亜科', tribe: 'Clytrini', tribe_jp: 'ナガツツハムシ族' }],

  // Chrysomelinae (ハムシ亜科) — Tribe Chrysomelini
  ['Chrysolina', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Gastrolina', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Gastrobrodina', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Gonioctena', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Linaeidea', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Phaedon', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Plagiodera', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],
  ['Plagiosterna', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: '' }],

  // Eumolpinae (サルハムシ亜科): leave tribe empty to match existing style
  ['Hyperaxis', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Demotina', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Xanthonia', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Fidia', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Nodina', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Pagria', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],

  // Lamprosomatinae (ツヤハムシ亜科)
  ['Oomorphoides', { subfamily: 'Lamprosomatinae', subfamily_jp: 'ツヤハムシ亜科', tribe: '', tribe_jp: '' }],

  // Galerucinae sensu site (dataset uses Alticinae label for ヒゲナガハムシ亜科 entries)
  ['Exosoma', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: '', tribe_jp: '' }],

  // Criocerinae (クビボソハムシ亜科)
  ['Crioceris', { subfamily: 'Criocerinae', subfamily_jp: 'クビボソハムシ亜科', tribe: 'Criocerini', tribe_jp: '' }],
  ['Lilioceris', { subfamily: 'Criocerinae', subfamily_jp: 'クビボソハムシ亜科', tribe: 'Criocerini', tribe_jp: '' }],
  ['Lema', { subfamily: 'Criocerinae', subfamily_jp: 'クビボソハムシ亜科', tribe: 'Lemini', tribe_jp: '' }],

  // Alticinae catch-up
  ['Trachyaphthona', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: '', tribe_jp: '' }],
])

function getArgs() {
  const args = {}
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) {
      args[m[1]] = m[2]
    } else if (a.startsWith('--')) {
      args[a.replace(/^--/, '')] = true
    }
  }
  return args
}

function main() {
  const args = getArgs()
  const cacheVersion = args['cache-version'] || args['version'] || null
  const useCache = Boolean(args['cache'] || cacheVersion)
  const cache = useCache ? new VersionedCache() : null

  const csvText = fs.readFileSync(CSV_PATH, 'utf8')
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false })
  const rows = parsed.data

  // Snapshot before (LB rows only) into cache if requested
  let beforeSnapshot = null
  if (useCache) {
    beforeSnapshot = rows
      .filter(r => r.insect_id && /^species-LB/.test(r.insect_id))
      .map(r => ({
        insect_id: r.insect_id,
        subfamily: r.subfamily, subfamily_jp: r.subfamily_jp,
        tribe: r.tribe, tribe_jp: r.tribe_jp,
        genus: r.genus, subgenus: r.subgenus,
        species: r.species, subspecies: r.subspecies,
        scientific_name: r.scientific_name,
      }))
    if (cacheVersion) cache.writeJSON('lb-before', cacheVersion, beforeSnapshot)
  }

  // Build mapping from existing rows first
  const genusMap = buildGenusMap(rows)

  let updated = 0
  const changes = []
  for (const r of rows) {
    if (!r.insect_id || !/^species-LB/.test(r.insect_id)) continue

    const sci = (r.scientific_name || '').trim()
    const { genus, subgenus, species, subspecies } = parseName(sci)

    // Decide classification
    let cls = genusMap.get(genus)
    if (!cls) cls = siteBased.get(genus)
    // Some mis-spelled genus in data (e.g. Physosmaragdia) -> try corrected spelling
    if (!cls && genus === 'Physosmaragdia') cls = siteBased.get('Physosmaragdia') || siteBased.get('Physosmaragdina')

    if (!cls) {
      // No info — leave as-is
      continue
    }

    const before = {
      subfamily: r.subfamily, subfamily_jp: r.subfamily_jp,
      tribe: r.tribe, tribe_jp: r.tribe_jp,
      genus: r.genus, subgenus: r.subgenus,
      species: r.species, subspecies: r.subspecies,
    }

    // Fill fields
    r.subfamily = r.subfamily || cls.subfamily || ''
    r.subfamily_jp = r.subfamily_jp || cls.subfamily_jp || ''
    r.tribe = r.tribe || cls.tribe || ''
    r.tribe_jp = r.tribe_jp || cls.tribe_jp || ''
    // Always set genus/species from scientific_name tokens
    r.genus = genus || r.genus || ''
    r.subgenus = subgenus || r.subgenus || ''
    r.species = species || r.species || ''
    r.subspecies = subspecies || r.subspecies || ''
    updated++

    const after = {
      subfamily: r.subfamily, subfamily_jp: r.subfamily_jp,
      tribe: r.tribe, tribe_jp: r.tribe_jp,
      genus: r.genus, subgenus: r.subgenus,
      species: r.species, subspecies: r.subspecies,
    }
    if (useCache) {
      changes.push({ insect_id: r.insect_id, before, after })
    }
  }

  // Re-serialize preserving header order
  const out = Papa.unparse(rows, { columns: parsed.meta.fields })
  fs.writeFileSync(CSV_PATH, out, 'utf8')
  console.log(`Updated LB rows: ${updated}`)

  // Write after snapshots and the CSV snapshot into cache when enabled
  if (useCache && cacheVersion) {
    const afterSnapshot = rows
      .filter(r => r.insect_id && /^species-LB/.test(r.insect_id))
      .map(r => ({
        insect_id: r.insect_id,
        subfamily: r.subfamily, subfamily_jp: r.subfamily_jp,
        tribe: r.tribe, tribe_jp: r.tribe_jp,
        genus: r.genus, subgenus: r.subgenus,
        species: r.species, subspecies: r.subspecies,
        scientific_name: r.scientific_name,
      }))
    cache.writeJSON('lb-after', cacheVersion, afterSnapshot)
    cache.writeJSON('lb-changes', cacheVersion, changes)
    // Save a CSV snapshot too
    cache.writeText('insects-csv', cacheVersion, out, 'csv')
  }
}

main()
