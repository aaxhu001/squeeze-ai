/**
 * Phase 5 Integration Verification Script: Developer Savings Dashboard (`squeeze stats`)
 * 
 * Verifies:
 * 1. Metrics recording into .squeeze_stats.json.
 * 2. CLI `node cli.js stats` rendering of ASCII Savings Analytics Dashboard.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { recordSessionMetrics, loadStats, STATS_FILE } = require('../SQUEEZE main/modules/stats-recorder.js');

async function testPhase5Stats() {
  console.log('======================================================================');
  console.log('⚡ Phase 5 Verification: Developer Savings Dashboard (`squeeze stats`)');
  console.log('======================================================================\n');

  // Record a sample session to guarantee data in .squeeze_stats.json
  recordSessionMetrics({
    rawTokens: 1000,
    squeezeTokens: 150,
    savedTokens: 850,
    isMemoryHit: false
  });

  recordSessionMetrics({
    rawTokens: 1000,
    squeezeTokens: 0,
    savedTokens: 1000,
    isMemoryHit: true
  });

  const stats = loadStats();
  assert.ok(stats.totalSessions >= 2, 'Should record at least 2 sessions');
  assert.ok(stats.netTokensSaved >= 1850, 'Net tokens saved should accumulate correctly');
  assert.ok(stats.memoryCacheHits >= 1, 'Memory cache hits should be recorded');
  assert.ok(stats.estimatedCostSavedUSD >= 0, 'USD savings should be computed');
  assert.ok(stats.estimatedCostSavedINR >= 0, 'INR savings should be computed');

  console.log('✅ Session metrics persistence in .squeeze_stats.json verified!');

  // Test CLI `node cli.js stats`
  console.log('📌 Executing CLI command: node cli.js stats');
  const cliOutput = execSync('node cli.js stats', {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  console.log(cliOutput);

  assert.ok(cliOutput.includes('⚡ SQUEEZE AI Savings Analytics Dashboard'), 'Should render dashboard title');
  assert.ok(cliOutput.includes('Total Self-Healing Sessions'), 'Should include Total Self-Healing Sessions line');
  assert.ok(cliOutput.includes('Total Raw Error Tokens'), 'Should include Total Raw Error Tokens line');
  assert.ok(cliOutput.includes('Total SQUEEZE Tokens Used'), 'Should include Total SQUEEZE Tokens Used line');
  assert.ok(cliOutput.includes('Net Context Tokens Saved'), 'Should include Net Context Tokens Saved line');
  assert.ok(cliOutput.includes('Estimated USD Cost Saved'), 'Should include Estimated USD Cost Saved line');
  assert.ok(cliOutput.includes('Estimated INR Cost Saved'), 'Should include Estimated INR Cost Saved line');
  assert.ok(cliOutput.includes('Instant Memory Cache Hits'), 'Should include Instant Memory Cache Hits line');

  console.log('✅ CLI ASCII Analytics Dashboard rendering verified!\n');

  console.log('======================================================================');
  console.log('🎉 ALL PHASE 5 VERIFICATION TESTS PASSED CLEANLY!');
  console.log('======================================================================\n');
}

testPhase5Stats().catch(err => {
  console.error('❌ Phase 5 Test Failed:', err);
  process.exit(1);
});
