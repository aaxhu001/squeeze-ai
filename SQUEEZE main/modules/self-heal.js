/**
 * SQUEEZE AI - Core Self-Correction & Self-Healing Module
 * 
 * Uses downloaded SVG web icons for web/telemetry visualization and 
 * high-contrast ANSI developer badges for terminal output.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { globalMemory } = require('./memory.js');
const { recordSessionMetrics } = require('./stats-recorder.js');

// Icon map linking to downloaded SVG assets from web CDN
const WEB_ICONS = {
  SEARCH: path.join(__dirname, '../../icons/custom_emojis/search.svg'),
  CODE: path.join(__dirname, '../../icons/custom_emojis/code.svg'),
  TERMINAL: path.join(__dirname, '../../icons/custom_emojis/terminal.svg'),
  WARN: path.join(__dirname, '../../icons/custom_emojis/alert-triangle.svg'),
  CHECK: path.join(__dirname, '../../icons/custom_emojis/check-circle.svg'),
  ZAP: path.join(__dirname, '../../icons/custom_emojis/zap.svg')
};

// High-contrast ANSI badges for clean terminal output
const BADGES = {
  SEARCH: '\x1b[36m[SEARCH]\x1b[0m',
  BUILD:  '\x1b[35m[BUILD]\x1b[0m',
  TEST:   '\x1b[33m[TEST]\x1b[0m',
  REDUCE: '\x1b[31m[REDUCE]\x1b[0m',
  PASSED: '\x1b[32m[PASSED]\x1b[0m',
  RESET:  '\x1b[0m'
};

// Helper: Estimate token count (approx. 4 chars per token)
function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Log telemetry metrics to local console for app monitoring
 */
function logTelemetry(event, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SQUEEZE Self-Heal Telemetry] [${timestamp}] ${event}:`, JSON.stringify({
    ...data,
    iconAssets: WEB_ICONS
  }));
}

/**
 * State Engine for Self-Correction Iterations
 */
class StateEngine {
  constructor(originalPrompt, maxIterations = 3) {
    this.state = {
      original_prompt: originalPrompt,
      generated_code: '',
      error_log: '',
      raw_error_log: '',
      iteration_count: 0,
      max_iterations: maxIterations,
      history: [],
      status: 'PENDING',
      total_raw_tokens: 0,
      total_compressed_tokens: 0,
    };
  }

  updateCode(code) {
    this.state.generated_code = code;
  }

  recordIteration(rawError, compressedError, exitCode) {
    this.state.iteration_count++;
    this.state.raw_error_log = rawError;
    this.state.error_log = compressedError;

    const rawTokens = estimateTokens(rawError);
    const compTokens = estimateTokens(compressedError);
    
    this.state.total_raw_tokens += rawTokens;
    this.state.total_compressed_tokens += compTokens;

    const tokensSaved = rawTokens - compTokens;
    const savingsPercent = rawTokens > 0 ? ((tokensSaved / rawTokens) * 100).toFixed(1) : 0;

    const iterationData = {
      iteration: this.state.iteration_count,
      code: this.state.generated_code,
      exitCode,
      rawError,
      compressedError,
      rawTokens,
      compTokens,
      tokensSaved,
      savingsPercent
    };

    this.state.history.push(iterationData);

    logTelemetry('ITERATION_FAILED', {
      iteration: this.state.iteration_count,
      exitCode,
      rawTokens,
      compTokens,
      tokensSaved,
      savingsPercent: `${savingsPercent}%`
    });
  }
}

/**
 * Node 1: Code Execution Sandbox (Supports Dynamic Custom Test Commands)
 */
function runCodeSandbox(code, options = {}) {
  const timeoutMs = typeof options === 'number' ? options : (options.timeoutMs || 3000);
  const testCmd = typeof options === 'object' ? (options.testCmd || options.testCommand) : null;

  const tempDir = path.join(process.cwd(), 'test_sandbox', '.tmp_sandbox');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, `sandbox_run_${Date.now()}_${Math.random().toString(36).substring(7)}.js`);
  fs.writeFileSync(tempFilePath, code, 'utf8');

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  // Determine execution command: custom test command or default Node runner
  let commandToRun = `node "${tempFilePath}"`;
  if (testCmd && typeof testCmd === 'string') {
    if (testCmd.includes('{file}')) {
      commandToRun = testCmd.replace(/["']?\{file\}["']?/g, `"${tempFilePath}"`);
    } else {
      commandToRun = testCmd;
    }
  }

  try {
    stdout = execSync(commandToRun, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      env: {
        ...process.env,
        SQUEEZE_SANDBOX_FILE: tempFilePath
      }
    });
  } catch (error) {
    exitCode = error.status !== undefined && error.status !== null ? error.status : 1;
    stdout = error.stdout ? error.stdout.toString() : '';
    stderr = error.stderr ? error.stderr.toString() : error.message;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
  }

  return { stdout, stderr, exitCode, commandRun: commandToRun };
}

/**
 * Node 2: SQUEEZE Core Error Reduction
 */
function squeezeErrorReducer(rawStderr) {
  if (!rawStderr || rawStderr.trim().length === 0) {
    return '[SQUEEZE Error Reducer]: No error trace detected.';
  }

  const lines = rawStderr.split('\n').map(l => l.trim()).filter(Boolean);
  let errorMessage = '';
  let lineReference = 'Line ?:?';

  for (const line of lines) {
    const lineMatch = line.match(/(?:at\s+.*?\()?(?:[a-zA-Z]:[\\/].*?|[\w\.-]+)[\\/]?([\w\.-]+\.js:(\d+)(?::(\d+))?)\)?/);
    if (lineMatch && (!lineReference || lineReference.includes('?:?'))) {
      const filename = lineMatch[1].split(/[\\/]/).pop();
      lineReference = filename;
    }

    if (line.match(/^([A-Z]\w*(?:Error|Exception)):/i) || (line.includes('Error:') && !line.startsWith('at '))) {
      if (!errorMessage) {
        errorMessage = line;
      }
    }
  }

  if (!errorMessage) {
    const nonStackLine = lines.find(l => !l.startsWith('at ') && !l.startsWith('Node.js'));
    errorMessage = nonStackLine || lines[0];
  }

  errorMessage = errorMessage.replace(/(?:[a-zA-Z]:)?[\\/](?:[^\\/\n]+[\\/])+/g, '');

  return `[SQUEEZE Compact Error] ${lineReference} -> ${errorMessage}`;
}

function renderProgressBar(rawTokens, compTokens, length = 20) {
  if (!rawTokens || rawTokens === 0) return '[░░░░░░░░░░░░░░░░░░░░] 0.0%';
  const saved = Math.max(0, rawTokens - compTokens);
  const pct = Math.min(100, Math.max(0, (saved / rawTokens) * 100));
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${pct.toFixed(1)}% (Raw: ${rawTokens} -> Squeezed: ${compTokens} tokens)`;
}

/**
 * Node 3 & Feedback Edge Loop: Self-Correction Controller with Professional Developer Badges
 */
async function runSelfCorrectionLoop(originalPrompt, codeGeneratorFn, options = {}) {
  const maxIterations = options.maxIterations || 3;
  const verbose = options.verbose !== undefined ? options.verbose : true;

  if (verbose) {
    console.log(`\n======================================================================`);
    console.log(`⚡ SQUEEZE AI Engine v1.0.0-pro [STATUS: ACTIVE | AUTO-HEAL: ON]`);
    console.log(`======================================================================`);
    console.log(`🔍 [SQUEEZE] Analyzing prompt requirements...`);
    console.log(`📋 Prompt: "${originalPrompt}"`);
    if (options.testCmd || options.testCommand) {
      console.log(`🧪 [SQUEEZE] Custom Test Harness Enabled: "${options.testCmd || options.testCommand}"`);
    }
  }

  logTelemetry('LOOP_STARTED', { prompt: originalPrompt, maxIterations, testCmd: options.testCmd || options.testCommand || 'default' });

  const engine = new StateEngine(originalPrompt, maxIterations);
  let lastErrorHash = null;
  let memoryHit = false;

  while (engine.state.iteration_count < engine.state.max_iterations) {
    const currentAttempt = engine.state.iteration_count + 1;
    
    if (verbose) {
      console.log(`⚙️ [SQUEEZE] Drafting script structure... (Iteration ${currentAttempt}/${engine.state.max_iterations})`);
    }

    const code = codeGeneratorFn(
      engine.state.original_prompt,
      engine.state.error_log,
      currentAttempt
    );
    engine.updateCode(code);

    if (verbose) {
      console.log(`🧪 [SQUEEZE] Running local environment compilation checks...`);
    }

    const { stdout, stderr, exitCode, commandRun } = runCodeSandbox(code, options);

    if (exitCode === 0) {
      if (verbose) {
        console.log(`✅ [SQUEEZE] Code successfully verified! Exiting loop.`);
        if (stdout) console.log(`   Output: ${stdout.trim()}`);
        console.log(`   Shortcuts: [H] Auto-Heal: ENABLED  |  [D] Dashboard: squeeze dashboard  |  [Q] Exit`);
      }
      
      engine.state.status = 'SUCCESS';

      // Save fix into Squeeze Memory if this was a repair after an error
      if (lastErrorHash) {
        globalMemory.saveFix(lastErrorHash, code, {
          prompt: originalPrompt,
          rawTokensSaved: engine.state.total_raw_tokens
        });
        if (verbose) {
          console.log(`💾 [SQUEEZE Memory] Saved zero-token fix for error hash [${lastErrorHash}] into local memory.`);
        }
      }

      logTelemetry('LOOP_SUCCESS', {
        iterations: engine.state.iteration_count + 1,
        stdout: stdout.trim(),
        commandRun
      });
      break;
    }

    if (verbose) {
      console.log(`⚠️ [SQUEEZE] Caught error trace. Compressing payload...`);
    }

    const compressedError = squeezeErrorReducer(stderr);
    engine.recordIteration(stderr, compressedError, exitCode);

    const errorHash = globalMemory.hashError(compressedError);
    lastErrorHash = errorHash;

    if (verbose) {
      const rawTok = estimateTokens(stderr);
      const compTok = estimateTokens(compressedError);
      console.log(`   Trace: "${compressedError}"`);
      console.log(`   Compression Progress: ${renderProgressBar(rawTok, compTok)}`);
      console.log(`   Shortcuts: [H] Auto-Heal: ENABLED  |  [D] Dashboard: squeeze dashboard  |  [Q] Exit\n`);
    }

    // --- SQUEEZE Memory Interception ---
    const cachedFix = globalMemory.lookup(errorHash);
    if (cachedFix) {
      if (verbose) {
        console.log(`⚡ [SQUEEZE Memory] Found cached fix for error hash [${errorHash}]! Testing instant zero-token repair...`);
      }
      
      const memoryRun = runCodeSandbox(cachedFix.fixCode, options);
      if (memoryRun.exitCode === 0) {
        if (verbose) {
          console.log(`✅ [SQUEEZE Memory] Zero-token cached fix verified cleanly! Exiting loop.`);
          if (memoryRun.stdout) console.log(`   Output: ${memoryRun.stdout.trim()}`);
        }
        
        globalMemory.recordHit(errorHash);
        engine.state.status = 'SUCCESS';
        engine.updateCode(cachedFix.fixCode);
        memoryHit = true;

        logTelemetry('MEMORY_CACHE_HIT', {
          errorHash,
          rawTokensSaved: estimateTokens(stderr)
        });
        break;
      } else {
        if (verbose) {
          console.log(`⚠️ [SQUEEZE Memory] Cached fix failed verification. Falling back to LLM self-healing.`);
        }
      }
    }
  }

  if (engine.state.status !== 'SUCCESS') {
    engine.state.status = 'MAX_ITERATIONS_EXCEEDED';
    logTelemetry('LOOP_FAILED', {
      iterations: engine.state.iteration_count,
      status: engine.state.status
    });
  }

  let totalSaved = engine.state.total_raw_tokens - engine.state.total_compressed_tokens;
  if (memoryHit) {
    // 100% token savings for memory hit (0 LLM tokens expended)
    totalSaved = engine.state.total_raw_tokens;
  }

  const overallSavingsPct = engine.state.total_raw_tokens > 0 
    ? ((totalSaved / engine.state.total_raw_tokens) * 100).toFixed(1) 
    : 0;

  // Record session metrics for developer dashboard
  recordSessionMetrics({
    rawTokens: engine.state.total_raw_tokens,
    squeezeTokens: memoryHit ? 0 : engine.state.total_compressed_tokens,
    savedTokens: totalSaved,
    isMemoryHit: memoryHit
  });

  logTelemetry('METRICS_SUMMARY', {
    status: engine.state.status,
    totalIterations: engine.state.iteration_count,
    totalRawTokens: engine.state.total_raw_tokens,
    totalSqueezeTokens: memoryHit ? 0 : engine.state.total_compressed_tokens,
    totalSavedTokens: totalSaved,
    overallSavingsPercent: `${overallSavingsPct}%`,
    memoryHit
  });

  return {
    status: engine.state.status,
    iterations: engine.state.iteration_count,
    code: engine.state.generated_code,
    totalRawTokens: engine.state.total_raw_tokens,
    totalCompressedTokens: memoryHit ? 0 : engine.state.total_compressed_tokens,
    totalSavedTokens: totalSaved,
    overallSavingsPercent: overallSavingsPct,
    memoryHit,
    state: engine.state,
    iconAssets: WEB_ICONS
  };
}

module.exports = {
  StateEngine,
  runCodeSandbox,
  squeezeErrorReducer,
  runSelfCorrectionLoop,
  logTelemetry,
  WEB_ICONS
};
