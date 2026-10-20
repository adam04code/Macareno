'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Minimal JSON persistence. Each collection is a directory of <id>.json
 * documents; writes are atomic (write temp + rename). Pass dataDir = null for
 * a purely in-memory store (tests).
 */
class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.memory = new Map();
    if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  }

  dir(collection) {
    const d = path.join(this.dataDir, collection);
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  safeId(id) {
    if (!/^[A-Za-z0-9_.:-]+$/.test(String(id))) throw new Error(`Invalid document id: ${id}`);
    return String(id).replace(/:/g, '_');
  }

  get(collection, id) {
    if (!this.dataDir) {
      const v = this.memory.get(`${collection}/${id}`);
      return v ? JSON.parse(v) : null;
    }
    const file = path.join(this.dir(collection), `${this.safeId(id)}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  put(collection, id, doc) {
    const json = JSON.stringify(doc, (k, v) => (v === Infinity ? 'Infinity' : v));
    if (!this.dataDir) {
      this.memory.set(`${collection}/${id}`, json);
      return;
    }
    const file = path.join(this.dir(collection), `${this.safeId(id)}.json`);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, file);
  }

  delete(collection, id) {
    if (!this.dataDir) {
      this.memory.delete(`${collection}/${id}`);
      return;
    }
    const file = path.join(this.dir(collection), `${this.safeId(id)}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  all(collection) {
    if (!this.dataDir) {
      const out = [];
      for (const [k, v] of this.memory) if (k.startsWith(`${collection}/`)) out.push(JSON.parse(v));
      return out;
    }
    const d = this.dir(collection);
    return fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')));
  }
}

/** JSON reviver that restores Infinity values written by put(). */
function revive(doc) {
  return JSON.parse(JSON.stringify(doc), (k, v) => (v === 'Infinity' ? Infinity : v));
}

module.exports = { Store, revive };
