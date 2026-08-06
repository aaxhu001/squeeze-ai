/**
 * Phase 4 Integration Verification Script: Zero-Token Local Fix Caching ("Squeeze Memory")
 * 
 * Verifies:
 * 1. Run 1 triggers self-healing engine and caches verified fix into Squeeze Memory.
 * 2. Run 2 intercepts duplicate error via Squeeze Memory with 0 token expenditure and 0 ms API latency.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const squeeze = require('../index.js');
const { globalMemory } = require('../SQUEEZE main/modules/memory.js');

async function testPhase4Memory() {
  console.log('======================================================================');
  console.log('⚡ Phase 4 Verification: Zero-Token Local Fix Caching ("Squeeze Memory")');
  console.log('======================================================================\n');

  // Clear memory cache before test
  globalMemory.clear();

  const testPrompt = "Calculate Fibonacci number safely.";

  function mockBuggyCodeGenerator(prompt, errorMsg, iteration) {
    if (iteration === 1) {
      return `// Iteration 1: Buggy implementation
function fib(n) {
  if (n < 0) throw new Error("Invalid negative fibonacci index");
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
fib(-10); // Causes crash`;
    }

    return `// Iteration 2: Fixed implementation
function fib(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fib(n - 1) + fib(n - 2);
}
console.log("Fib(10):", fib(10));`;
  }

  // --- RUN 1: Standard Self-Healing ---
  console.log('📌 RUN 1: Executing broken script (Expecting LLM Self-Healing & Memory Cache Save)...');
  const run1Result = await squeeze.selfHealPipeline(testPrompt, mockBuggyCodeGenerator, {
    enableSelfHeal: true,
    verbose: true
  });

  assert.strictEqual(run1Result.status, 'SUCCESS', 'Run 1 should succeed');
  assert.strictEqual(run1Result.memoryHit, false, 'Run 1 should NOT be a memory cache hit');
  assert.ok(run1Result.totalSavedTokens > 0, 'Run 1 should save compressed tokens');

  const memoryStats = globalMemory.getStats();
  assert.ok(memoryStats.totalEntries > 0, 'Squeeze Memory should contain at least 1 cached fix entry after Run 1');
  console.log(`\n✅ RUN 1 Completed: Verified fix saved to Squeeze Memory (Entries: ${memoryStats.totalEntries})\n`);

  // --- RUN 2: Squeeze Memory Interception ---
  console.log('📌 RUN 2: Executing identical broken script (Expecting Zero-Token Instant Memory Interception)...');
  
  let run2Stdout = '';
  const originalLog = console.log;
  console.log = (...args) => {
    run2Stdout += args.join(' ') + '\n';
    originalLog.apply(console, args);
  };

  const run2Result = await squeeze.selfHealPipeline(testPrompt, mockBuggyCodeGenerator, {
    enableSelfHeal: true,
    verbose: true
  });

  console.log = originalLog;

  assert.strictEqual(run2Result.status, 'SUCCESS', 'Run 2 should succeed');
  assert.strictEqual(run2Result.memoryHit, true, 'Run 2 MUST be a zero-token memory hit');
  assert.strictEqual(run2Result.totalCompressedTokens, 0, 'Run 2 MUST expend 0 SQUEEZE tokens (100% token savings!)');
  assert.ok(run2Stdout.includes('⚡ [SQUEEZE Memory] Found cached fix'), 'Run 2 stdout should log memory cache hit');
  assert.ok(run2Stdout.includes('Zero-token cached fix verified cleanly'), 'Run 2 stdout should confirm zero-token repair');

  console.log('\n✅ Squeeze Memory Cache Lookup & Interception Verified!');
  console.log('✅ 100% Token Savings & 0 Token Expenditure Verified on Run 2!\n');

  console.log('======================================================================');
  console.log('🎉 ALL PHASE 4 VERIFICATION TESTS PASSED CLEANLY!');
  console.log('======================================================================\n');
}

testPhase4Memory().catch(err => {
  console.error('❌ Phase 4 Test Failed:', err);
  process.exit(1);
});
