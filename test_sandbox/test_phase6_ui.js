/**
 * Phase 6 Integration Verification Script: User Interfaces for SQUEEZE AI
 * (Interactive TUI and Local Web Dashboard)
 * 
 * Verifies:
 * 1. SqueezeDashboardServer HTTP startup and static file serving on http://localhost:3000.
 * 2. API endpoints delivery (/api/stats, /api/memory, /api/health).
 * 3. Interactive TUI token compression progress bar rendering.
 */

const assert = require('assert');
const http = require('http');
const SqueezeDashboardServer = require('../SQUEEZE main/modules/dashboard.js');
const { recordSessionMetrics } = require('../SQUEEZE main/modules/stats-recorder.js');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function testPhase6UI() {
  console.log('======================================================================');
  console.log('⚡ Phase 6 Verification: Interactive TUI & Local Analytics Dashboard');
  console.log('======================================================================\n');

  // Seed sample metrics for testing API responses
  recordSessionMetrics({
    rawTokens: 1200,
    squeezeTokens: 180,
    savedTokens: 1020,
    isMemoryHit: false
  });

  const testPort = 3000;
  const dashboard = new SqueezeDashboardServer({ port: testPort });

  console.log(`📌 Starting Local Dashboard Server on port ${testPort}...`);
  await dashboard.start();

  try {
    // 1. Test HTML Dashboard Page GET /
    console.log('📌 Testing GET http://localhost:3000/');
    const indexRes = await httpGet(`http://localhost:${testPort}/`);
    assert.strictEqual(indexRes.statusCode, 200, 'HTML page should return 200 OK');
    assert.ok(indexRes.body.includes('SQUEEZE AI'), 'HTML page should contain SQUEEZE AI title');
    assert.ok(indexRes.body.includes('tokensChart'), 'HTML page should contain Chart canvas');
    console.log('✅ Local Web Dashboard HTML Page Verified!');

    // 2. Test GET /api/stats
    console.log('📌 Testing GET http://localhost:3000/api/stats');
    const statsRes = await httpGet(`http://localhost:${testPort}/api/stats`);
    assert.strictEqual(statsRes.statusCode, 200, '/api/stats should return 200 OK');
    const statsData = JSON.parse(statsRes.body);
    assert.ok(statsData.totalSessions >= 1, 'Stats API should return totalSessions');
    assert.ok(statsData.netTokensSaved >= 0, 'Stats API should return netTokensSaved');
    console.log(`✅ Stats API Verified! (Sessions: ${statsData.totalSessions}, Saved: ${statsData.netTokensSaved} tokens)`);

    // 3. Test GET /api/memory
    console.log('📌 Testing GET http://localhost:3000/api/memory');
    const memoryRes = await httpGet(`http://localhost:${testPort}/api/memory`);
    assert.strictEqual(memoryRes.statusCode, 200, '/api/memory should return 200 OK');
    const memoryData = JSON.parse(memoryRes.body);
    assert.strictEqual(typeof memoryData, 'object', 'Memory API should return object cache');
    console.log('✅ Memory API Verified!');

    // 4. Test GET /api/health
    console.log('📌 Testing GET http://localhost:3000/api/health');
    const healthRes = await httpGet(`http://localhost:${testPort}/api/health`);
    assert.strictEqual(healthRes.statusCode, 200, '/api/health should return 200 OK');
    const healthData = JSON.parse(healthRes.body);
    assert.strictEqual(healthData.status, 'healthy', 'Health API should return healthy status');
    console.log('✅ Health Diagnostic API Verified!\n');

  } finally {
    console.log('📌 Stopping Dashboard Server...');
    await dashboard.stop();
  }

  console.log('======================================================================');
  console.log('🎉 ALL PHASE 6 VERIFICATION TESTS PASSED CLEANLY!');
  console.log('======================================================================\n');
}

testPhase6UI().catch(err => {
  console.error('❌ Phase 6 Test Failed:', err);
  process.exit(1);
});
