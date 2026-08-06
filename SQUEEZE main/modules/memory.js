/**
 * SQUEEZE AI - Zero-Token Local Fix Caching ("Squeeze Memory")
 * 
 * Stores verified bug fixes keyed by error trace hash in `.squeeze_memory.json`.
 * Enables 0-token, 0-latency instant repair on duplicate errors.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SqueezeMemory {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), '.squeeze_memory.json');
    this.cache = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.cache = JSON.parse(content);
      } else {
        this.cache = {};
      }
    } catch (e) {
      this.cache = {};
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (e) {
      console.error('[SQUEEZE Memory] Error saving cache file:', e.message);
    }
  }

  /**
   * Generates a deterministic hash for an error trace.
   * Normalizes temporary sandbox filenames for cross-session matching.
   */
  hashError(errorTrace) {
    if (!errorTrace) return null;
    const normalized = errorTrace.trim().replace(/sandbox_run_\d+_[a-z0-9]+/gi, 'sandbox_file');
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  lookup(errorHash) {
    if (!errorHash || !this.cache[errorHash]) return null;
    return this.cache[errorHash];
  }

  saveFix(errorHash, fixCode, metadata = {}) {
    if (!errorHash || !fixCode) return;
    this.cache[errorHash] = {
      fixCode,
      prompt: metadata.prompt || '',
      timestamp: new Date().toISOString(),
      hitCount: (this.cache[errorHash] ? this.cache[errorHash].hitCount : 0),
      rawTokensSaved: metadata.rawTokensSaved || 0
    };
    this.save();
  }

  recordHit(errorHash) {
    if (this.cache[errorHash]) {
      this.cache[errorHash].hitCount = (this.cache[errorHash].hitCount || 0) + 1;
      this.cache[errorHash].lastHitTimestamp = new Date().toISOString();
      this.save();
    }
  }

  clear() {
    this.cache = {};
    this.save();
  }

  getStats() {
    const entries = Object.keys(this.cache);
    let totalHits = 0;
    entries.forEach(k => {
      totalHits += (this.cache[k].hitCount || 0);
    });
    return {
      totalEntries: entries.length,
      totalHits
    };
  }
}

const globalMemory = new SqueezeMemory();

module.exports = {
  SqueezeMemory,
  globalMemory
};
