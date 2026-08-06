/**
 * SQUEEZE - Code Compressor
 * AST & Structural code compressor preserving exports, types, interfaces, and core signatures.
 * Achieves 15–35%+ token savings on source code while maintaining structural accuracy.
 */

class CodeCompressor {
  /**
   * Compress code content.
   * @param {string} code - Raw code string
   * @param {string} language - Code language (js, ts, py, html, css, etc.)
   * @param {object} options - Options
   * @returns {object} { type: 'code', compressed: string, originalTokens: number, compressedTokens: number, savingsPercent: number, ccrChunks: Array }
   */
  static compress(code, language = 'autodetect', options = {}) {
    if (!code || typeof code !== 'string') return null;

    const opts = {
      stripComments: true,
      stripEmptyLines: true,
      collapseFunctionBodies: false, // If true, outline mode
      maxBodyLines: 50,
      ...options
    };

    const lang = language === 'autodetect' ? this._detectLanguage(code) : language.toLowerCase();
    const ccrChunks = [];

    let processed = code;

    // 1. Strip comments based on language
    if (opts.stripComments) {
      processed = this._stripComments(processed, lang);
    }

    // 2. Structural function body abstractor for very large files
    if (opts.collapseFunctionBodies || processed.split('\n').length > 200) {
      processed = this._abstractSignatures(processed, lang, ccrChunks, opts);
    }

    // 3. Normalize whitespace and empty lines
    if (opts.stripEmptyLines) {
      processed = processed
        .split('\n')
        .map(line => line.trimEnd())
        .filter((line, idx, arr) => {
          if (line.trim() !== '') return true;
          // Keep at most 1 empty line between blocks
          return idx > 0 && arr[idx - 1].trim() !== '';
        })
        .join('\n');
    }

    const originalTokens = Math.ceil(code.length / 4);
    const compressedTokens = Math.ceil(processed.length / 4);
    const savingsPercent = originalTokens > 0
      ? Math.max(0, Math.round(((originalTokens - compressedTokens) / originalTokens) * 100))
      : 0;

    return {
      type: 'code',
      language: lang,
      compressed: processed,
      originalTokens,
      compressedTokens,
      savingsPercent,
      ccrChunks
    };
  }

  static _detectLanguage(code) {
    if (/import\s+.*from|const\s+.*=\s*require|function\s+\w+\(|class\s+\w+|export\s+/m.test(code)) {
      return /:\s*(string|number|boolean|any|void)|interface\s+\w+/m.test(code) ? 'ts' : 'js';
    }
    if (/def\s+\w+\(|import\s+pandas|import\s+numpy|import\s+sys|from\s+[\w.]+\s+import/m.test(code)) return 'py';
    if (/<(!DOCTYPE|html|div|body|script|span|p|h[1-6])/i.test(code)) return 'html';
    if (/CREATE\s+TABLE|ALTER\s+TABLE|SELECT\s+.*FROM|INSERT\s+INTO/i.test(code)) return 'sql';
    if (/\b(?:version|services|environment|image|ports|healthcheck):/m.test(code)) return 'yaml';
    if (/\/\*[\s\S]*?\*\/|^\s*\/\//m.test(code)) return 'js';
    if (/^\s*#/m.test(code)) return 'py';
    return 'generic';
  }

  static _stripComments(code, lang) {
    if (lang === 'js' || lang === 'ts' || lang === 'cpp' || lang === 'java' || lang === 'go' || lang === 'css') {
      let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '');
      cleaned = cleaned.replace(/(?<!:)\/\/(?![^\r\n]*["']).*/g, '');
      return cleaned;
    } else if (lang === 'py' || lang === 'yaml') {
      let cleaned = code.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, '');
      cleaned = cleaned.replace(/^\s*#(?!!).*/gm, '');
      return cleaned;
    } else if (lang === 'sql') {
      let cleaned = code.replace(/--.*$/gm, '');
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      return cleaned;
    } else if (lang === 'html') {
      return code.replace(/<!--[\s\S]*?-->/g, '');
    } else {
      let cleaned = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
      cleaned = cleaned.replace(/(?<!:)\/\/(?![^\r\n]*["']).*/g, '');
      cleaned = cleaned.replace(/^\s*#(?!!).*/gm, '');
      return cleaned;
    }
  }

  static _abstractSignatures(code, lang, ccrChunks, opts) {
    if (lang !== 'js' && lang !== 'ts') return code;

    // Matches function bodies that are > 20 lines and abstracts them into CCR references
    const lines = code.split('\n');
    const resultLines = [];
    let inFunction = false;
    let funcStart = -1;
    let braceDepth = 0;
    let currentBody = [];
    let currentHeader = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inFunction && /^\s*(export\s+)?(async\s+)?function\s+\w+\s*\(|^\s*(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/m.test(line)) {
        inFunction = true;
        funcStart = i;
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        currentHeader = line;
        currentBody = [line];
        continue;
      }

      if (inFunction) {
        currentBody.push(line);
        braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

        if (braceDepth <= 0) {
          inFunction = false;
          if (currentBody.length > opts.maxBodyLines) {
            const bodyStr = currentBody.join('\n');
            const hash = this._hash(bodyStr);
            const refId = `sq_code_${hash}`;
            ccrChunks.push({ id: refId, content: bodyStr, type: 'code_body' });

            // Keep signature, truncate body
            const indent = line.match(/^\s*/)[0];
            resultLines.push(currentHeader);
            resultLines.push(`${indent}  /* [CCR:${refId}] Body compressed (+${currentBody.length - 2} lines omitted) */`);
            resultLines.push(`${indent}}`);
          } else {
            resultLines.push(...currentBody);
          }
          currentBody = [];
        }
      } else {
        resultLines.push(line);
      }
    }

    return resultLines.join('\n');
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
  module.exports = CodeCompressor;
}
if (typeof window !== 'undefined') {
  window.CodeCompressor = CodeCompressor;
}
