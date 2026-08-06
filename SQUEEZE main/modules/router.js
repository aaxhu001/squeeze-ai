/**
 * SQUEEZE - Content Router & Cache Aligner
 * Unified pipeline that inspects input data, routes to optimal compressor, stores CCR references,
 * and maintains KV-Cache alignment.
 */

// Helper dynamic getters to avoid JS top-level 'var' hoisting collisions in Browser Content Scripts
function _getSmartJSONCrusher() {
  if (typeof SmartJSONCrusher !== 'undefined') return SmartJSONCrusher;
  if (typeof require !== 'undefined') {
    try { return require('./json-crusher.js'); } catch (e) {}
  }
  return null;
}

function _getCodeCompressor() {
  if (typeof CodeCompressor !== 'undefined') return CodeCompressor;
  if (typeof require !== 'undefined') {
    try { return require('./code-compressor.js'); } catch (e) {}
  }
  return null;
}

function _getCCRStore() {
  if (typeof globalCCR !== 'undefined') return globalCCR;
  if (typeof window !== 'undefined' && window.globalCCR) return window.globalCCR;
  if (typeof require !== 'undefined') {
    try { return require('./ccr-store.js').globalCCR; } catch (e) {}
  }
  return null;
}

class ContentRouter {
  /**
   * Compress arbitrary input (text, JSON string, code, object).
   * @param {string|object} input 
   * @param {object} options 
   */
  static compress(input, options = {}) {
    if (!input) return { compressed: '', originalTokens: 0, compressedTokens: 0, savingsPercent: 0 };

    const opts = {
      enableJSON: true,
      enableCode: true,
      enableCCR: true,
      enableCacheAligner: true,
      ...options
    };

    const rawStr = typeof input === 'string' ? input : JSON.stringify(input);

    // 1. Try JSON Crusher first
    if (opts.enableJSON) {
      const jsonEngine = _getSmartJSONCrusher();
      const jsonResult = jsonEngine ? jsonEngine.crush(input, opts) : null;
      if (jsonResult) {
        this._persistCCR(jsonResult.ccrChunks, opts);
        return this._formatResult(rawStr, jsonResult.compressed, 'json', jsonResult.savingsPercent, jsonResult.ccrChunks);
      }
    }

    // 2. Try Code Compressor
    if (opts.enableCode && typeof input === 'string') {
      const codeEngine = _getCodeCompressor();
      const codeResult = codeEngine ? codeEngine.compress(input, 'autodetect', opts) : null;
      if (codeResult && codeResult.savingsPercent > 5) {
        this._persistCCR(codeResult.ccrChunks, opts);
        return this._formatResult(rawStr, codeResult.compressed, `code (${codeResult.language})`, codeResult.savingsPercent, codeResult.ccrChunks);
      }
    }

    // 3. Fallback Prose & Log Trimmer
    const proseResult = this._compressProse(rawStr, opts);
    this._persistCCR(proseResult.ccrChunks, opts);

    return this._formatResult(rawStr, proseResult.compressed, 'prose', proseResult.savingsPercent, proseResult.ccrChunks);
  }

  static _compressProse(str, opts) {
    const lines = str.split('\n');
    const ccrChunks = [];

    // Log & stack trace compression: remove repeated identical log lines
    const deduppedLines = [];
    let lastLine = '';
    let dupCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === lastLine && line.trim() !== '') {
        dupCount++;
      } else {
        if (dupCount > 0) {
          deduppedLines.push(`[... ${dupCount} duplicate log lines omitted ...]`);
          dupCount = 0;
        }
        deduppedLines.push(line);
        lastLine = line;
      }
    }
    if (dupCount > 0) {
      deduppedLines.push(`[... ${dupCount} duplicate log lines omitted ...]`);
    }

    let compressed = deduppedLines.join('\n');

    // Strip conversational fluff, greetings, and hedging from prose
    compressed = compressed
      .replace(/(?:hello|hi|hey|greetings|dear|good\s+(?:morning|afternoon|evening))\s+(?:claude|assistant|ai|there|team|friend)?\b[.,!?]*\s*/gi, '')
      .replace(/\b(?:hope\s+you\s+are\s+having\s+a\s+fantastic\s+day|hope\s+this\s+finds\s+you\s+well)\b[.,!?]*\s*/gi, '')
      .replace(/\b(?:i\s+was\s+wondering\s+if\s+you\s+could\s+(?:possibly\s+)?)?help\s+me\s+out\s+with\s+(?:a\s+quick\s+)?(?:coding\s+)?question\b[.,!?]*\s*/gi, '')
      .replace(/\b(?:whenever\s+you\s+have\s+a\s+moment|no\s+rush\s+at\s+all|at\s+your\s+earliest\s+convenience)\b[.,!?]*\s*/gi, '')
      .replace(/\b(?:basically,?\s*what\s+i\s+am\s+trying\s+to\s+do\s+is|i'm\s+trying\s+to)\b\s*/gi, '')
      .replace(/\b(?:thanks\s+so\s+much\s+in\s+advance|thank\s+you\s+so\s+much\s+in\s+advance|i\s+really\s+appreciate\s+your\s+help|much\s+appreciated)[.,!?]*\s*/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    // If extremely large log or text block, save middle section into CCR
    if (compressed.length > 4000 && opts.enableCCR) {
      const head = compressed.slice(0, 1500);
      const middle = compressed.slice(1500, -1500);
      const tail = compressed.slice(-1500);

      const hash = this._hash(middle);
      const refId = `sq_prose_${hash}`;
      ccrChunks.push({ id: refId, content: middle, type: 'prose_middle' });

      compressed = `${head}\n\n[... ${Math.ceil(middle.length / 4)} tokens cached in CCR: ${refId} ...]\n\n${tail}`;
    }

    const origTokens = Math.ceil(str.length / 4);
    const compTokens = Math.ceil(compressed.length / 4);
    const savingsPercent = origTokens > 0 ? Math.max(0, Math.round(((origTokens - compTokens) / origTokens) * 100)) : 0;

    return {
      compressed,
      savingsPercent,
      ccrChunks
    };
  }

  static _persistCCR(chunks, opts) {
    if (!chunks || !Array.isArray(chunks) || !opts.enableCCR) return;
    const ccr = _getCCRStore();
    if (ccr) {
      chunks.forEach(chunk => ccr.put(chunk.id, chunk.content, { type: chunk.type }));
    }
  }

  static _formatResult(originalStr, compressedStr, contentType, savingsPercent, ccrChunks = []) {
    const originalTokens = Math.ceil(originalStr.length / 4);
    const compressedTokens = Math.ceil(compressedStr.length / 4);

    return {
      compressed: compressedStr,
      originalTokens,
      compressedTokens,
      savingsPercent,
      contentType,
      ccrChunksCount: ccrChunks.length
    };
  }

  static _hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentRouter;
}
if (typeof window !== 'undefined') {
  window.ContentRouter = ContentRouter;
}
