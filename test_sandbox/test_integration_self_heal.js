/**
 * Integration Test Script for SQUEEZE Self-Correction Loop Engine
 * 
 * Verifies:
 * 1. Default state: ENABLE_SQUEEZE_SELF_HEAL = false (pass-through mode)
 * 2. Enabled state: ENABLE_SQUEEZE_SELF_HEAL = true (self-healing loop with telemetry metrics)
 */

const assert = require('assert');
const squeeze = require('../index.js');

// Mock Code Generator with self-repairing behavior
function mockCodeGenerator(prompt, compactErrorMsg, iteration) {
  if (iteration === 1) {
    return `// Buggy code (Iter 1)
function divide(a, b) {
  if (b === 0) throw new TypeError("Cannot divide by zero!");
  return a / b;
}
divide(10, 0);`;
  }
  return `// Corrected code (Iter 2)
function divide(a, b) {
  if (b === 0) return 0;
  return a / b;
}
console.log("Result:", divide(10, 0));`;
}

async function runIntegrationTest() {
  console.log('======================================================================');
  console.log('🧪 SQUEEZE AI Self-Healing Integration & Feature Flag Test');
  console.log('======================================================================\n');

  const testPrompt = "Write a divide function handling zero divisor.";

  // -------------------------------------------------------------------
  // Test Case 1: Feature Flag DISABLED (Default state)
  // -------------------------------------------------------------------
  console.log('📌 Test Case 1: Default State (ENABLE_SQUEEZE_SELF_HEAL = false)');
  squeeze.setFeatureFlag('ENABLE_SQUEEZE_SELF_HEAL', false);

  const disabledResult = await squeeze.selfHealPipeline(testPrompt, mockCodeGenerator);
  console.log('Result:', disabledResult);

  assert.strictEqual(disabledResult.selfHealActive, false, 'Self-healing should be INACTIVE when feature flag is false');
  assert.strictEqual(disabledResult.status, 'PASSTHROUGH_DISABLED', 'Status should be PASSTHROUGH_DISABLED');
  console.log('✅ Passed Test Case 1: Safe Pass-Through Confirmed!\n');

  // -------------------------------------------------------------------
  // Test Case 2: Feature Flag ENABLED
  // -------------------------------------------------------------------
  console.log('📌 Test Case 2: Enabled State (ENABLE_SQUEEZE_SELF_HEAL = true)');
  squeeze.setFeatureFlag('ENABLE_SQUEEZE_SELF_HEAL', true);

  const enabledResult = await squeeze.selfHealPipeline(testPrompt, mockCodeGenerator, { verbose: true });

  assert.strictEqual(enabledResult.selfHealActive, true, 'Self-healing should be ACTIVE when feature flag is true');
  assert.strictEqual(enabledResult.status, 'SUCCESS', 'Self-healing should complete with SUCCESS status');
  assert.ok(enabledResult.totalSavedTokens > 0, 'Token savings should be recorded');
  assert.ok(parseFloat(enabledResult.overallSavingsPercent) > 50, 'Token savings percentage should exceed 50%');

  console.log('✅ Passed Test Case 2: Integrated Self-Healing & Telemetry Confirmed!\n');

  console.log('======================================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runIntegrationTest().catch(err => {
  console.error('❌ Integration Test Failed:', err);
  process.exit(1);
});
