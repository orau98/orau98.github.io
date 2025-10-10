#!/usr/bin/env node

// Fill missing genus/species/subgenus/classification fields in public/insects.csv
// by parsing scientific_name and reusing genus-level taxonomy from other rows.

import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const csvPath = path.join(process.cwd(), 'public/insects.csv')

const classificationFields = [
  'family',
  'family_jp',
  'subfamily',
  'subfamily_jp',
  'tribe',
  'tribe_jp',
]

function loadCsv(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = Papa.parse(raw, {
    header: true,
    skipEmptyLines: false,
  })
  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors)
    process.exit(1)
  }
  return parsed
}

function saveCsv(meta, rows, file) {
  const { fields } = meta
  const csv = Papa.unparse({ fields, data: rows }, { newline: '\r\n' })
  fs.writeFileSync(file, csv, 'utf8')
}

function normalizeToken(token) {
  return token.replace(/^["'([{]+|["'.,;:)}\]]+$/g, '')
}

function extractFromScientificName(scientificName) {
  if (!scientificName) return {}
  const cleaned = scientificName.trim()
  if (!cleaned) return {}
  const tokens = cleaned.split(/\s+/)
  let genus
  let subgenus
  let species

  for (const token of tokens) {
    const normalized = normalizeToken(token)
    if (!normalized) continue
    if (!genus && /^[A-Z][A-Za-z-]+$/.test(normalized)) {
      genus = normalized
      continue
    }
    if (
      !subgenus &&
      /^\([A-Z][A-Za-z-]+\)$/.test(token) &&
      /^[A-Z][A-Za-z-]+$/.test(normalized)
    ) {
      subgenus = normalized
      continue
    }
    if (!species && /^[a-z][A-Za-z-]+$/.test(normalized)) {
      species = normalized
      continue
    }
  }

  return { genus, subgenus, species }
}

function buildGenusIndex(rows) {
  const index = new Map()

  for (const row of rows) {
    const { genus } = row
    if (!genus) continue
    if (!index.has(genus)) {
      index.set(genus, {})
    }
    const info = index.get(genus)
    for (const field of classificationFields) {
      if (!info[field] && row[field]) {
        info[field] = row[field]
      }
    }
  }

  return index
}

function isRowEmpty(row) {
  return Object.values(row).every((value) => !value || String(value).trim() === '')
}

function main() {
  const parsed = loadCsv(csvPath)
  const rows = parsed.data
  const genusIndex = buildGenusIndex(rows)

  let filledGenus = 0
  let filledSubgenus = 0
  let filledSpecies = 0
  let filledClassification = 0

  for (const row of rows) {
    if (isRowEmpty(row)) continue
    const parsedName = extractFromScientificName(row.scientific_name)

    if (!row.genus && parsedName.genus) {
      row.genus = parsedName.genus
      filledGenus += 1
    }
    if (!row.subgenus && parsedName.subgenus) {
      row.subgenus = parsedName.subgenus
      filledSubgenus += 1
    }
    if (!row.species && parsedName.species) {
      row.species = parsedName.species
      filledSpecies += 1
    }

    const genusInfo = row.genus ? genusIndex.get(row.genus) : undefined
    if (genusInfo) {
      for (const field of classificationFields) {
        if (!row[field] && genusInfo[field]) {
          row[field] = genusInfo[field]
          filledClassification += 1
        }
      }
    }
  }

  const cleanedRows = rows.filter((row) => !isRowEmpty(row))

  saveCsv(parsed.meta, cleanedRows, csvPath)

  console.log('Filled genus:', filledGenus)
  console.log('Filled subgenus:', filledSubgenus)
  console.log('Filled species:', filledSpecies)
  console.log('Filled classification fields:', filledClassification)
  console.log('Removed empty rows:', rows.length - cleanedRows.length)
}

main()
