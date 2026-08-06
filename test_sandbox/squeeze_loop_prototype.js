/**
 * SQUEEZE AI - Standalone Self-Correction Loop Prototype
 * 
 * Demonstrates a LangGraph-style feedback cycle for code debugging and token reduction.
 * Intercepts terminal crash traces, compresses them via SQUEEZE error-reduction principles,
 * and feeds only essential error signatures back to auto-fix code.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper: Estimate token count (approx. 4 chars per token)
function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * 2. Simulated State Engine
 * Basic state object tracking task, generated code, error traces, and iterations.
 */
class StateEngine {
  constructor(originalPrompt) {
    this.state = {
      original_prompt: originalPrompt,
      generated_code: '',
      error_log: '',
      raw_error_log: '',
      iteration_count: 0,
      max_iterations: 3,
      history: [],
      status: 'PENDING', // PENDING, RUNNING, SUCCESS, MAX_ITERATIONS_EXCEEDED
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

    this.state.history.push({
      iteration: this.state.iteration_count,
      code: this.state.generated_code,
      exitCode,
      rawError,
      compressedError,
      rawTokens,
      compTokens,
      tokensSaved: rawTokens - compTokens
    });
  }
}

/**
 * 3. Node 1: Code Execution Sandbox
 * Wrapper function that runs code locally in an isolated sub-process and captures stderr/stdout streams.
 */
function runCodeSandbox(code, timeoutMs = 3000) {
  const tempDir = path.join(__dirname, '.tmp_sandbox');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, `sandbox_run_${Date.now()}.js`);
  fs.writeFileSync(tempFilePath, code, 'utf8');

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(`node "${tempFilePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });
  } catch (error) {
    exitCode = error.status || 1;
    stdout = error.stdout ? error.stdout.toString() : '';
    stderr = error.stderr ? error.stderr.toString() : error.message;
  } finally {
    // Cleanup temp script
    if (fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
  }

  return { stdout, stderr, exitCode };
}

/**
 * 4. Node 2: SQUEEZE Core Error Reduction
 * Intercepts raw terminal crash trace and aggressively cleans it to minimize token usage.
 * Keeps ONLY the specific file line number, the exception class, and core error message.
 */
function squeezeErrorReducer(rawStderr) {
  if (!rawStderr || rawStderr.trim().length === 0) {
    return '[SQUEEZE Error Reducer]: No error trace detected.';
  }

  const lines = rawStderr.split('\n').map(l => l.trim()).filter(Boolean);
  let errorMessage = '';
  let lineReference = 'Line ?:?';

  for (const line of lines) {
    // Extract file line reference (e.g. "sandbox_run_12345.js:12:5")
    const lineMatch = line.match(/(?:at\s+.*?\()?(?:[a-zA-Z]:[\\/].*?|[\w\.-]+)[\\/]?([\w\.-]+\.js:(\d+)(?::(\d+))?)\)?/);
    if (lineMatch && (!lineReference || lineReference.includes('?:?'))) {
      const filename = lineMatch[1].split(/[\\/]/).pop();
      lineReference = filename;
    }

    // Extract Exception type and Message (e.g. "RangeError: Division by zero error")
    if (line.match(/^([A-Z]\w*(?:Error|Exception)):/i) || (line.includes('Error:') && !line.startsWith('at '))) {
      if (!errorMessage) {
        errorMessage = line;
      }
    }
  }

  // Fallback to first non-stack line if no specific error line was matched
  if (!errorMessage) {
    const nonStackLine = lines.find(l => !l.startsWith('at ') && !l.startsWith('Node.js'));
    errorMessage = nonStackLine || lines[0];
  }

  // Strip long absolute file paths from the message body
  errorMessage = errorMessage.replace(/(?:[a-zA-Z]:)?[\\/](?:[^\\/\n]+[\\/])+/g, '');

  return `[SQUEEZE Compact Error] ${lineReference} -> ${errorMessage}`;
}

/**
 * 5. Feedback Edge Loop (State Graph Flow)
 * Controller loop that handles execution, error compression, prompt augmentation, and exit logic.
 */
async function runSelfCorrectionLoop(originalPrompt, mockLLMGenerator) {
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 SQUEEZE AI Self-Correction Loop Initiated`);
  console.log(`📋 Original Prompt: "${originalPrompt}"`);
  console.log('='.repeat(70) + '\n');

  const engine = new StateEngine(originalPrompt);

  while (engine.state.iteration_count < engine.state.max_iterations) {
    const currentAttempt = engine.state.iteration_count + 1;
    console.log(`--- [Iteration ${currentAttempt}/${engine.state.max_iterations}] Code Generation & Sandbox Execution ---`);

    // Call code generator with original prompt and compressed error history
    const code = mockLLMGenerator(
      engine.state.original_prompt,
      engine.state.error_log,
      currentAttempt
    );
    engine.updateCode(code);

    console.log(`💻 Generated Code:\n${code.split('\n').map(l => '   | ' + l).join('\n')}`);

    // Node 1: Sandbox Execution
    const { stdout, stderr, exitCode } = runCodeSandbox(code);

    if (exitCode === 0) {
      console.log(`\n✅ Execution Succeeded (Exit Code: 0)`);
      if (stdout) console.log(`   Console Output: ${stdout.trim()}`);
      
      engine.state.status = 'SUCCESS';
      break;
    }

    // Node 2: SQUEEZE Error Reduction
    console.log(`\n❌ Execution Crashed (Exit Code: ${exitCode})`);
    console.log(`   [Raw Terminal stderr (${estimateTokens(stderr)} tokens)]:\n   ${stderr.replace(/\n/g, '\n   ')}`);

    const compressedError = squeezeErrorReducer(stderr);
    engine.recordIteration(stderr, compressedError, exitCode);

    const rawTok = estimateTokens(stderr);
    const compTok = estimateTokens(compressedError);
    const savedTok = rawTok - compTok;
    const savingsPct = ((savedTok / rawTok) * 100).toFixed(1);

    console.log(`\n⚡ [SQUEEZE Token-Reduction Applied]:`);
    console.log(`   Compact Error Trace: "${compressedError}"`);
    console.log(`   Tokens: Raw=${rawTok} | SQUEEZE=${compTok} | Saved=${savedTok} tokens (${savingsPct}% reduction)\n`);
  }

  if (engine.state.status !== 'SUCCESS') {
    engine.state.status = 'MAX_ITERATIONS_EXCEEDED';
  }

  // Final Summary Report
  console.log('='.repeat(70));
  console.log(`📊 SQUEEZE AI Self-Correction Final Report`);
  console.log('='.repeat(70));
  console.log(`Status            : ${engine.state.status}`);
  console.log(`Total Iterations  : ${engine.state.iteration_count}`);
  
  if (engine.state.total_raw_tokens > 0) {
    const totalSaved = engine.state.total_raw_tokens - engine.state.total_compressed_tokens;
    const overallPct = ((totalSaved / engine.state.total_raw_tokens) * 100).toFixed(1);
    console.log(`Raw Error Tokens  : ${engine.state.total_raw_tokens}`);
    console.log(`SQUEEZE Tokens    : ${engine.state.total_compressed_tokens}`);
    console.log(`Total Tokens Saved: ${totalSaved} tokens (${overallPct}% context savings)`);
  }
  console.log('='.repeat(70) + '\n');

  return engine.state;
}

/**
 * 6. Automated Validation Test Script
 * Mock code generator simulating a multi-step self-healing cycle:
 * Iteration 1: Division by zero RangeError
 * Iteration 2: Undefined function ReferenceError
 * Iteration 3: Fully working code
 */
function mockCodeGenerator(prompt, compactErrorMsg, iteration) {
  if (iteration === 1) {
    return `// Iteration 1: Intentionally broken script (division by zero crash)
function calculateAverage(numbers) {
  let total = 0;
  for (let n of numbers) total += n;
  if (numbers.length === 0) {
    throw new RangeError("Division by zero error: Array length is 0");
  }
  return total / numbers.length;
}

calculateAverage([]);`;
  }

  if (iteration === 2) {
    return `// Iteration 2: Fixes division by zero based on: ${compactErrorMsg}
function calculateAverage(numbers) {
  if (!numbers || numbers.length === 0) {
    return formatZeroResult(); // Bug: Undefined helper function call
  }
  let total = numbers.reduce((acc, curr) => acc + curr, 0);
  return total / numbers.length;
}

console.log("Average:", calculateAverage([]));`;
  }

  return `// Iteration 3: Final self-corrected working script
function formatZeroResult() {
  return 0;
}

function calculateAverage(numbers) {
  if (!numbers || numbers.length === 0) {
    return formatZeroResult();
  }
  let total = numbers.reduce((acc, curr) => acc + curr, 0);
  return total / numbers.length;
}

console.log("Average successfully calculated:", calculateAverage([]));`;
}

// Execute automated validation test script if executed directly
if (require.main === module) {
  const mockPrompt = "Write a JavaScript function that calculates the average of a list of numbers, handling empty arrays gracefully.";
  runSelfCorrectionLoop(mockPrompt, mockCodeGenerator);
}

module.exports = {
  StateEngine,
  runCodeSandbox,
  squeezeErrorReducer,
  runSelfCorrectionLoop
};
