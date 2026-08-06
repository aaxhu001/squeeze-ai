/**
 * Phase 3 Integration Verification Script
 * 
 * Verifies:
 * 1. Professional developer badge telemetry output & downloaded web SVG icon links.
 * 2. Bring Your Own Tests custom command runner (--test-cmd).
 * 3. CLI --self-heal & --test-cmd invocation.
 */

const assert = require('assert');
const { execSync } = require('child_process');
const squeeze = require('../index.js');

async function testPhase3Features() {
  console.log('======================================================================');
  console.log('🧪 Phase 3 Verification: High-Contrast Badges & Custom Test Harness');
  console.log('======================================================================\n');

  // Capture stdout to verify badge telemetry logs
  let stdoutLogs = '';
  const originalLog = console.log;
  console.log = (...args) => {
    stdoutLogs += args.join(' ') + '\n';
    originalLog.apply(console, args);
  };

  const testPrompt = "Create a robust mathematical factorial function.";
  const customTestCmd = 'node "{file}"';

  function mockCodeGenerator(prompt, compactErrorMsg, iteration) {
    if (iteration === 1) {
      return `// Iteration 1: Buggy implementation
function factorial(n) {
  if (n < 0) throw new Error("Negative numbers not allowed");
  if (n === 0) return 1;
  return n * factorial(n - 1);
}
factorial(-5); // Will crash`;
    }

    return `// Iteration 2: Fixed implementation
function factorial(n) {
  if (n <= 0) return 1;
  return n * factorial(n - 1);
}
console.log("Factorial(5):", factorial(5));`;
  }

  // 1. Programmatically test selfHealPipeline with custom testCmd
  const result = await squeeze.selfHealPipeline(testPrompt, mockCodeGenerator, {
    enableSelfHeal: true,
    testCmd: customTestCmd,
    verbose: true
  });

  // Restore console.log
  console.log = originalLog;

  // 2. Assertions on results
  assert.strictEqual(result.status, 'SUCCESS', 'Self-healing should succeed');
  assert.strictEqual(result.iterations, 1, 'Should succeed on iteration 2 (1 failed iteration recorded)');

  // 3. Verify Emoji Telemetry Stream format in stdout/result
  assert.ok(stdoutLogs.includes('🔍 [SQUEEZE] Analyzing prompt requirements...'), 'Should print search emoji telemetry');
  assert.ok(stdoutLogs.includes('⚙️ [SQUEEZE] Drafting script structure...'), 'Should print build emoji telemetry');
  assert.ok(stdoutLogs.includes('🧪 [SQUEEZE] Running local environment compilation checks...'), 'Should print test emoji telemetry');
  assert.ok(stdoutLogs.includes('⚠️ [SQUEEZE] Caught error trace. Compressing payload...'), 'Should print error telemetry');
  assert.ok(stdoutLogs.includes('✅ [SQUEEZE] Code successfully verified! Exiting loop.'), 'Should print success emoji telemetry');
  assert.ok(result.iconAssets && result.iconAssets.SEARCH, 'Should expose downloaded SVG web icon assets');

  console.log('\n✅ Live Emoji Telemetry Stream Verified!');
  console.log('✅ Web SVG Icon Asset Links Verified!');
  console.log('✅ Custom Test Command Harness Verified!\n');

  // 4. Test CLI command with --self-heal and --test-cmd
  console.log('📌 Testing CLI Command: node cli.js heal --test-cmd "node \\"{file}\\"" "Calculate sum"');
  const cliOutput = execSync(`node cli.js heal --test-cmd "node \\"{file}\\"" "Calculate sum"`, {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.ok(cliOutput.includes('✅ [SQUEEZE] Code successfully verified! Exiting loop.'), 'CLI execution should output emoji telemetry');
  console.log('✅ CLI --self-heal and --test-cmd Flag Verified!\n');

  console.log('======================================================================');
  console.log('🎉 ALL PHASE 3 VERIFICATION TESTS PASSED CLEANLY!');
  console.log('======================================================================\n');
}

testPhase3Features().catch(err => {
  console.error('❌ Phase 3 Test Failed:', err);
  process.exit(1);
});
