/**
 * SQUEEZE - CCR Store (Content-Cache & Retrieval)
 * Local reversible storage for compressed prompt chunks.
 * Enables zero-loss on-demand context retrieval for LLMs via MCP tool or proxy call.
 */

class CCRStore {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Save chunk to CCR Store.
   * @param {string} id - Hash reference ID
   * @param {string} content - Original uncompressed content
   * @param {object} meta - Metadata (type, length, timestamp)
   */
  put(id, content, meta = {}) {
    this.cache.set(id, {
      id,
      content,
      meta: {
        timestamp: Date.now(),
        size: content.length,
        ...meta
      }
    });
    return id;
  }

  /**
   * Retrieve original uncompressed chunk by ID.
   * @param {string} id - Hash reference ID
   * @returns {string|null} Original content
   */
  get(id) {
    const entry = this.cache.get(id);
    return entry ? entry.content : null;
  }

  /**
   * Check if chunk exists in cache.
   * @param {string} id 
   */
  has(id) {
    return this.cache.has(id);
  }

  /**
   * Scan prompt text for [CCR:ref_id] markers and hydrate with originals.
   * @param {string} text - Compressed text containing CCR tags
   * @returns {string} Hydrated full text
   */
  hydrate(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/\[CCR:(sq_[a-z0-9_]+)\]/g, (match, refId) => {
      const original = this.get(refId);
      return original ? original : match;
    });
  }

  /**
   * Get storage statistics.
   */
  stats() {
    let totalBytes = 0;
    for (const entry of this.cache.values()) {
      totalBytes += entry.content.length;
    }
    return {
      entries: this.cache.size,
      totalBytes,
      totalTokensApprox: Math.ceil(totalBytes / 4)
    };
  }

  clear() {
    this.cache.clear();
  }
}

// Global Singleton Instance
const globalCCR = new CCRStore();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CCRStore, globalCCR };
}
if (typeof window !== 'undefined') {
  window.CCRStore = CCRStore;
  window.globalCCR = globalCCR;
}
