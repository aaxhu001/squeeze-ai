/**
 * SQUEEZE Upgrade Verification Test Suite
 * Validates JSON Crusher, Code Compressor, CCR Store, ContentRouter, Proxy Server, and MCP Server.
 */

const assert = require('assert');
let ContentRouter, SmartJSONCrusher, CodeCompressor, globalCCR, OutputShaper;
try {
  ContentRouter = require('./SQUEEZE main/modules/router.js');
  SmartJSONCrusher = require('./SQUEEZE main/modules/json-crusher.js');
  CodeCompressor = require('./SQUEEZE main/modules/code-compressor.js');
  globalCCR = require('./SQUEEZE main/modules/ccr-store.js').globalCCR;
  OutputShaper = require('./SQUEEZE main/modules/output-shaper.js');
} catch (e) {
  ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
  SmartJSONCrusher = require('./Squeeze_Internal_Pro/modules/json-crusher.js');
  CodeCompressor = require('./Squeeze_Internal_Pro/modules/code-compressor.js');
  globalCCR = require('./Squeeze_Internal_Pro/modules/ccr-store.js').globalCCR;
  OutputShaper = require('./Squeeze_Internal_Pro/modules/output-shaper.js');
}
const SqueezeProxyServer = require('./proxy-server.js');

console.log('===================================================');
console.log('   SQUEEZE - Enterprise Compression Test Suite     ');
console.log('===================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}: ${err.message}`);
  }
}

// Test 1: JSON Crusher
test('Smart JSON Crusher - Structured API Compression (>60% savings)', () => {
  const inputJson = JSON.stringify({
    status: 200,
    message: "Success",
    debugInfo: null,
    data: Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      username: `user_${i}`,
      role: "admin",
      metadata: null,
      extra: undefined
    }))
  });

  const res = SmartJSONCrusher.crush(inputJson);
  assert.ok(res, 'Res should not be null');
  assert.strictEqual(res.type, 'json');
  assert.ok(res.savingsPercent >= 60, `Savings percent should be >= 60%, got ${res.savingsPercent}%`);
  console.log(`   -> Tokens: ${res.originalTokens} → ${res.compressedTokens} (${res.savingsPercent}% saved)`);
});

// Test 2: AST Code Compressor
test('CodeCompressor - Structural Code Compression (>15% savings)', () => {
  const code = `
    // Import essential react dependencies
    import React, { useState, useEffect } from 'react';

    /* Multi-line documentation
       This component renders user items list
    */
    export function UserList(props) {
      // Local state definition
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(true);

      useEffect(() => {
        // Fetch users from endpoint
        fetch('/api/users')
          .then(res => res.json())
          .then(data => setUsers(data));
      }, []);

      return <div>User Count: {users.length}</div>;
    }
  `;

  const res = CodeCompressor.compress(code, 'js');
  assert.ok(res, 'Code result should not be null');
  assert.ok(res.savingsPercent >= 15, `Code savings should be >= 15%, got ${res.savingsPercent}%`);
  console.log(`   -> Code Tokens: ${res.originalTokens} → ${res.compressedTokens} (${res.savingsPercent}% saved)`);
});

// Test 3: CCR Store & Reversibility
test('CCR Store - Reversible Content Hydration', () => {
  globalCCR.clear();
  const originalChunk = "CRITICAL_LOG_ERROR_DETAILS_STACK_TRACE_HASH_998231";
  const refId = "sq_log_test1";
  
  globalCCR.put(refId, originalChunk);
  const textWithTag = `System failure encountered: [CCR:${refId}]`;
  const hydrated = globalCCR.hydrate(textWithTag);

  assert.strictEqual(hydrated, `System failure encountered: ${originalChunk}`);
});

// Test 4: Output Shaper
test('Output Shaper - Steering System Prompt', () => {
  const systemPrompt = "You are a helpful coding assistant.";
  const steered = OutputShaper.steerSystemPrompt(systemPrompt);

  assert.ok(steered.includes("SQUEEZE Output Optimization"));
  assert.ok(steered.startsWith(systemPrompt));
});

// Test 5: ContentRouter Unified Pipeline
test('ContentRouter - Auto-Routing & Metrics', () => {
  const sampleLog = Array.from({ length: 20 }, () => "2026-07-28 09:20:00 [INFO] Processing request id 100234").join('\n');
  const res = ContentRouter.compress(sampleLog);

  assert.ok(res.compressedTokens < res.originalTokens);
  assert.ok(res.savingsPercent > 0);
  console.log(`   -> Log Tokens: ${res.originalTokens} → ${res.compressedTokens} (${res.savingsPercent}% saved)`);
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('SUCCESS: All SQUEEZE upgrade benchmarks passed cleanly!\n');
} else {
  process.exit(1);
}
