import fs from 'fs'
import path from 'path'

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export class VersionedCache {
  constructor(baseDir = path.join(process.cwd(), 'cache')) {
    this.baseDir = baseDir
    ensureDir(this.baseDir)
    this.manifestPath = path.join(this.baseDir, 'manifest.json')
    if (!fs.existsSync(this.manifestPath)) {
      fs.writeFileSync(this.manifestPath, JSON.stringify({ entries: {} }, null, 2))
    }
  }

  loadManifest() {
    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf8')
      return JSON.parse(raw)
    } catch {
      return { entries: {} }
    }
  }

  saveManifest(man) {
    fs.writeFileSync(this.manifestPath, JSON.stringify(man, null, 2))
  }

  // Returns absolute path for a cache entry file
  pathFor(key, version, ext = 'json') {
    const safeKey = slugify(key)
    const dir = path.join(this.baseDir, safeKey)
    ensureDir(dir)
    return path.join(dir, `v${version}.${ext}`)
  }

  has(key, version, ext = 'json') {
    return fs.existsSync(this.pathFor(key, version, ext))
  }

  readText(key, version, ext = 'txt') {
    return fs.readFileSync(this.pathFor(key, version, ext), 'utf8')
  }

  writeText(key, version, text, ext = 'txt') {
    const p = this.pathFor(key, version, ext)
    fs.writeFileSync(p, text, 'utf8')
    this._updateManifest(key, version, p)
    return p
  }

  readJSON(key, version) {
    const txt = this.readText(key, version, 'json')
    return JSON.parse(txt)
  }

  writeJSON(key, version, obj) {
    const p = this.pathFor(key, version, 'json')
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8')
    this._updateManifest(key, version, p)
    return p
  }

  _updateManifest(key, version, filepath) {
    const man = this.loadManifest()
    if (!man.entries[key]) man.entries[key] = {}
    man.entries[key][`v${version}`] = {
      path: path.relative(this.baseDir, filepath),
      savedAt: new Date().toISOString(),
    }
    this.saveManifest(man)
  }
}

