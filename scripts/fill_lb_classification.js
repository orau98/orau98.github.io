import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { VersionedCache } from './lib/versionedCache.js'

const CSV_PATH = path.join(process.cwd(), 'public', 'insects.csv')
const SITE_CACHE_CSV = path.join(process.cwd(), 'cache', 'insects-csv', 'v1.csv')

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

function loadSiteGenusMap() {
  if (!fs.existsSync(SITE_CACHE_CSV)) return new Map()
  const text = fs.readFileSync(SITE_CACHE_CSV, 'utf8')
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false })
  const map = new Map()
  for (const row of parsed.data) {
    if (!row) continue
    if (row.family !== 'Chrysomelidae') continue
    const genus = row.genus?.trim()
    if (!genus) continue
    if (!map.has(genus)) {
      map.set(genus, {
        subfamily: row.subfamily || '',
        subfamily_jp: row.subfamily_jp || '',
        tribe: row.tribe || '',
        tribe_jp: row.tribe_jp || '',
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
  ['Chrysolina', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Gastrolina', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Gastrobrodina', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Gonioctena', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Linaeidea', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Chrysomela', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Phaedon', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Plagiodera', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],
  ['Plagiosterna', { subfamily: 'Chrysomelinae', subfamily_jp: 'ハムシ亜科', tribe: 'Chrysomelini', tribe_jp: 'ハムシ族' }],

  // Eumolpinae (サルハムシ亜科): leave tribe empty to match existing style
  ['Hyperaxis', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Demotina', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Xanthonia', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Fidia', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Nodina', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Pagria', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Basilepta', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Acrothinium', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Heteraspis', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Platycorynus', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Colaspoides', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Colasposoma', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],
  ['Rhyparida', { subfamily: 'Eumolpinae', subfamily_jp: 'サルハムシ亜科', tribe: '', tribe_jp: '' }],

  // Alticinae (ヒゲナガハムシ亜科) — default tribe Alticini when site data omits finer split
  ['Altica', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Aphthona', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Aphthonaltica', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Aphthonoides', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Argopistes', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Argopistini', tribe_jp: 'テントウノミハムシ族' }],
  ['Argopus', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Chaetocnema', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Chaetocnemini', tribe_jp: 'ヒサゴトビハムシ族' }],
  ['Crepidodera', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Longitarsus', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Neocrepidodera', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Phyllotreta', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Psylliodes', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Trachyaphthona', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],
  ['Zipanginia', { subfamily: 'Alticinae', subfamily_jp: 'ヒゲナガハムシ亜科', tribe: 'Alticini', tribe_jp: 'ノミハムシ族' }],

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
  const siteGenusMap = loadSiteGenusMap()

  let updated = 0
  const changes = []
  for (const r of rows) {
    if (!r.insect_id || r.family !== 'Chrysomelidae') continue

    const sci = (r.scientific_name || '').trim()
    const parsedName = parseName(sci)
    const genusKey = (parsedName.genus || r.genus || '').trim()
    const subgenus = parsedName.subgenus
    const species = parsedName.species
    const subspecies = parsedName.subspecies

    // Decide classification
    let cls = genusMap.get(genusKey)
    if (!cls) cls = siteGenusMap.get(genusKey)
    if (!cls) cls = siteBased.get(genusKey)
    // Some mis-spelled genus in data (e.g. Physosmaragdia) -> try corrected spelling
    if (!cls && genusKey === 'Physosmaragdia') cls = siteBased.get('Physosmaragdia') || siteBased.get('Physosmaragdina')

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
    if (r.subfamily === 'Alticinae' && !r.tribe) {
      r.tribe = 'Alticini'
      if (!r.tribe_jp) r.tribe_jp = 'ノミハムシ族'
    }
    if (r.subfamily === 'Chrysomelinae' && !r.tribe) {
      r.tribe = 'Chrysomelini'
      if (!r.tribe_jp) r.tribe_jp = 'ハムシ族'
    }
    // Always set genus/species from scientific_name tokens when available
    r.genus = genusKey || r.genus || ''
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
    if (useCache && /^species-LB/.test(r.insect_id)) {
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
