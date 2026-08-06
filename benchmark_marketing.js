/**
 * Marketing benchmark — real Squeeze numbers for user-facing stats
 */
const ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
const SmartJSONCrusher = require('./Squeeze_Internal_Pro/modules/json-crusher.js');
const CodeCompressor = require('./Squeeze_Internal_Pro/modules/code-compressor.js');
const { globalCCR } = require('./Squeeze_Internal_Pro/modules/ccr-store.js');

const healthPayload = {
  timestamp: '2026-07-28T21:00:00Z',
  environment: 'production-us-east-1',
  service: 'user-auth-service',
  metrics: {
    cpu_percent: 84.5,
    memory_mb: 4096,
    active_connections: 1280,
    error_rate_percent: 14.2
  },
  logs: [
    { id: 'log_1001', level: 'INFO', component: 'DBPool', message: 'Connection established with primary pool master-01.us-east.db.internal:5432', latency_ms: 12 },
    { id: 'log_1002', level: 'WARN', component: 'AuthMiddleware', message: 'JWKS token validation delayed for user_id=usr_9981245', latency_ms: 450 },
    { id: 'log_1003', level: 'ERROR', component: 'UserRoute', message: 'Database query timeout during user profile fetch', stack_trace: 'Error: QueryTimeout\n  at TimeoutManager.check (c:\\app\\db.js:142:15)\n  at processTicksAndRejections (node:internal/process/task_queues:95:5)', user_id: 'usr_9981245' },
    { id: 'log_1004', level: 'ERROR', component: 'UserRoute', message: 'Database query timeout during user profile fetch', stack_trace: 'Error: QueryTimeout\n  at TimeoutManager.check (c:\\app\\db.js:142:15)\n  at processTicksAndRejections (node:internal/process/task_queues:95:5)', user_id: 'usr_3341890' },
    { id: 'log_1005', level: 'INFO', component: 'CacheStore', message: 'Redis cache hit ratio dropped below threshold (42.1%)', latency_ms: 3 }
  ]
};

const handlerCode = `async function handleGetUserProfile(req, res) {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required", code: "INVALID_INPUT" });
    }
    console.log("Fetching user profile for ID:", userId);
    const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    const preferences = await db.query("SELECT * FROM user_preferences WHERE user_id = $1", [userId]);
    const activityLogs = await db.query("SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50", [userId]);
    if (!user.rows[0]) {
      return res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
    }
    return res.status(200).json({
      success: true,
      user: user.rows[0],
      preferences: preferences.rows[0] || {},
      activity: activityLogs.rows
    });
  } catch (err) {
    console.error("Failed to handle user profile request:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}`;

const fullPrompt = `Please analyze this large backend system payload, extract the key error patterns, and optimize the user handler code below.

=== SYSTEM HEALTH & LOG DATA (JSON) ===
${JSON.stringify(healthPayload, null, 2)}

=== USER HANDLER CODE TO REFACTOR ===
${handlerCode}

Task:
1. Explain why the database timeouts are occurring based on the log payload.
2. Refactor handleGetUserProfile to fix the sequential bottleneck and reduce latency.`;

const bigApiPayload = JSON.stringify({
  status: 200,
  message: 'Success',
  debugInfo: null,
  data: Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    username: `user_${i}`,
    role: 'admin',
    metadata: null,
    extra: undefined
  }))
});

const repetitiveLogs = Array.from({ length: 100 }, () =>
  '2026-07-28 10:14:02.102 [ERROR] [http-worker-9] UserService : Database connection timeout on node-01'
).join('\n');

const tsCode = `/**
 * UserDashboardComponent.tsx
 */
import React, { useState, useEffect } from 'react';
// import { fetchUserData } from '../api/userService';

interface UserDashboardProps {
  initialFilter?: string;
  onUserSelect: (id: number) => void;
}

export function UserDashboard({ initialFilter = 'all', onUserSelect }: UserDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // console.log("Fetching user dashboard records...");
    setLoading(false);
  }, []);

  return (
    <div className="dashboard-wrapper">
      <h2>User Directory Overview</h2>
      {loading ? <p>Loading users...</p> : <div>Data Loaded</div>}
    </div>
  );
}`;

function run(name, input) {
  globalCCR.clear();
  const r = ContentRouter.compress(input);
  return {
    name,
    contentType: r.contentType,
    originalTokens: r.originalTokens,
    compressedTokens: r.compressedTokens,
    savedTokens: r.originalTokens - r.compressedTokens,
    savingsPercent: r.savingsPercent,
    ccrChunks: r.ccrChunksCount,
    originalChars: typeof input === 'string' ? input.length : JSON.stringify(input).length,
    compressedChars: r.compressed.length
  };
}

const scenarios = [
  run('Full dev prompt (logs JSON + handler + task)', fullPrompt),
  run('Production health JSON only', JSON.stringify(healthPayload, null, 2)),
  run('Node.js handler code only', handlerCode),
  run('50-row REST API response', bigApiPayload),
  run('100 duplicate error log lines', repetitiveLogs),
  run('React/TypeScript component', tsCode)
];

globalCCR.clear();
const jsonPeak = SmartJSONCrusher.crush(bigApiPayload);
globalCCR.clear();
const codePeak = CodeCompressor.compress(tsCode, 'ts');

// Best practice: compress structured blocks separately (MCP/proxy per-section)
const jsonPart = JSON.stringify(healthPayload, null, 2);
const codePart = handlerCode;
const taskPart = `Please analyze this backend payload, extract error patterns, and optimize the handler.

Task:
1. Explain why database timeouts are occurring.
2. Refactor handleGetUserProfile to fix sequential bottleneck.`;
const splitJson = run('Best practice: health JSON (isolated)', jsonPart);
const splitCode = run('Best practice: handler code (isolated)', codePart);
const splitTask = run('Best practice: task prose (isolated)', taskPart);
const splitTotalOrig = splitJson.originalTokens + splitCode.originalTokens + splitTask.originalTokens;
const splitTotalComp = splitJson.compressedTokens + splitCode.compressedTokens + splitTask.compressedTokens;

if (require.main === module) {
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  engine: 'Squeeze ContentRouter v1.0.0-pro',
  tokenEstimateMethod: 'chars / 4',
  scenarios,
  enginePeaks: {
    jsonCrusher: {
      label: '50-row API payload',
      originalTokens: jsonPeak.originalTokens,
      compressedTokens: jsonPeak.compressedTokens,
      savingsPercent: jsonPeak.savingsPercent
    },
    codeCompressor: {
      label: 'React/TS dashboard',
      originalTokens: codePeak.originalTokens,
      compressedTokens: codePeak.compressedTokens,
      savingsPercent: codePeak.savingsPercent
    }
  },
  aggregate: {
    originalTokens: scenarios.reduce((s, x) => s + x.originalTokens, 0),
    compressedTokens: scenarios.reduce((s, x) => s + x.compressedTokens, 0),
    savedTokens: scenarios.reduce((s, x) => s + x.savedTokens, 0),
    savingsPercent: Math.round(
      (scenarios.reduce((s, x) => s + x.savedTokens, 0) /
        scenarios.reduce((s, x) => s + x.originalTokens, 0)) * 100
    )
  },
  bestPracticeSplit: {
    scenarios: [splitJson, splitCode, splitTask],
    originalTokens: splitTotalOrig,
    compressedTokens: splitTotalComp,
    savedTokens: splitTotalOrig - splitTotalComp,
    savingsPercent: Math.round(((splitTotalOrig - splitTotalComp) / splitTotalOrig) * 100)
  },
  costEstimatesUSD_at_3_per_1M_input_tokens: {
    fullMixedPrompt_per1000: Number(((scenarios[0].savedTokens / 1_000_000) * 3 * 1000).toFixed(2)),
    duplicateLogs_per1000: Number(((scenarios[4].savedTokens / 1_000_000) * 3 * 1000).toFixed(2)),
    apiPayload_per1000: Number(((scenarios[3].savedTokens / 1_000_000) * 3 * 1000).toFixed(2)),
    bestPracticeSplit_per1000: Number((((splitTotalOrig - splitTotalComp) / 1_000_000) * 3 * 1000).toFixed(2))
  }
}, null, 2));
}
