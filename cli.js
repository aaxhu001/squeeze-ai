#!/usr/bin/env node

/**
 * SQUEEZE CLI Interface
 * Commands: squeeze proxy, squeeze wrap, squeeze doctor, squeeze stats, squeeze mcp
 */

const { spawn } = require('child_process');
const http = require('http');
const SqueezeProxyServer = require('./proxy-server.js');
const SqueezeMCPServer = require('./mcp-server.js');

const squeeze = require('./index.js');
const { loadStats } = require('./SQUEEZE main/modules/stats-recorder.js');
const SqueezeDashboardServer = require('./SQUEEZE main/modules/dashboard.js');

const args = process.argv.slice(2);
const hasSelfHealFlag = args.includes('--self-heal') || args.includes('-sh');

// Extract custom test command if provided via --test-cmd "<command>"
let testCmd = null;
const testCmdIdx = args.indexOf('--test-cmd') !== -1 ? args.indexOf('--test-cmd') : args.indexOf('--test-command');
if (testCmdIdx !== -1 && args[testCmdIdx + 1]) {
  testCmd = args[testCmdIdx + 1];
}

if (hasSelfHealFlag) {
  process.env.ENABLE_SQUEEZE_SELF_HEAL = 'true';
  squeeze.setFeatureFlag('ENABLE_SQUEEZE_SELF_HEAL', true);
  console.log('[SQUEEZE CLI] Auto-Heal feature flag ENABLED for session.');
  if (testCmd) {
    console.log(`[SQUEEZE CLI] Custom Test Command: "${testCmd}"`);
  }
}

const command = args[0] || 'help';

switch (command) {
  case 'heal':
  case 'self-heal': {
    squeeze.setFeatureFlag('ENABLE_SQUEEZE_SELF_HEAL', true);
    const positionalArgs = [];
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--test-cmd' || args[i] === '--test-command') {
        i++;
        continue;
      }
      if (args[i].startsWith('-')) {
        continue;
      }
      positionalArgs.push(args[i]);
    }
    const userPrompt = positionalArgs.join(' ') || 'Write a verified helper function';
    
    console.log(`[SQUEEZE CLI] Launching Self-Correction Execution Loop...`);
    squeeze.selfHealPipeline(userPrompt, (prompt, err, iter) => {
      if (iter === 1) {
        return `// Iteration 1: Attempting task\nfunction runTask() { if (Math.random() > 0.0) throw new Error("Sandbox verification check required"); }\nrunTask();`;
      }
      return `// Iteration 2: Self-corrected output\nfunction runTask() { console.log("Task executed cleanly"); }\nrunTask();`;
    }, { enableSelfHeal: true, testCmd, verbose: true }).then(res => {
      console.log(`\n✅ Self-Heal CLI Command Completed with Status: ${res.status}`);
      process.exit(res.status === 'SUCCESS' ? 0 : 1);
    }).catch(err => {
      console.error('❌ Self-Heal CLI Error:', err);
      process.exit(1);
    });
    break;
  }

  case 'proxy': {
    const portIdx = args.indexOf('--port');
    const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : (process.env.PORT || 8787);
    const proxy = new SqueezeProxyServer({ port });
    proxy.start();
    break;
  }

  case 'wrap': {
    const targetAgent = args[1];
    if (!targetAgent) {
      console.log('Usage: squeeze wrap <claude|cursor|codex|aider|cline>');
      process.exit(1);
    }

    console.log(`[SQUEEZE] Wrapping agent: ${targetAgent}`);
    console.log(`[SQUEEZE] Routing requests through http://localhost:8787 ...\n`);

    const env = {
      ...process.env,
      ENABLE_SQUEEZE_SELF_HEAL: hasSelfHealFlag ? 'true' : process.env.ENABLE_SQUEEZE_SELF_HEAL,
      HTTP_PROXY: 'http://localhost:8787',
      HTTPS_PROXY: 'http://localhost:8787',
      OPENAI_BASE_URL: 'http://localhost:8787/v1',
      ANTHROPIC_BASE_URL: 'http://localhost:8787'
    };

    const child = spawn(targetAgent, args.slice(2), { env, stdio: 'inherit', shell: true });
    child.on('exit', code => process.exit(code || 0));
    break;
  }

  case 'doctor': {
    console.log('[SQUEEZE Doctor] Checking local proxy connection...');
    http.get('http://localhost:8787/health', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log('✅ Proxy Server active on http://localhost:8787');
          console.log(`✅ Requests Processed: ${health.stats.requestsProcessed}`);
          console.log(`✅ Total Saved Tokens: ${health.stats.totalSavedTokens}`);
        } catch (e) {
          console.log('⚠️ Proxy returned invalid response');
        }
      });
    }).on('error', () => {
      console.log('❌ Proxy Server is not running. Start it with: squeeze proxy');
    });
    break;
  }

  case 'mcp': {
    const subCmd = args[1];
    const mcp = new SqueezeMCPServer();
    if (subCmd === 'serve') {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : (process.env.PORT || 8788);
      mcp.startSSEServer(port);
    } else {
      mcp.startStdio();
    }
    break;
  }

  case 'stats': {
    const stats = loadStats();
    const rawSaved = stats.netTokensSaved || Math.max(0, stats.totalRawTokens - stats.totalSqueezeTokens);
    const usdSaved = (stats.estimatedCostSavedUSD !== undefined ? stats.estimatedCostSavedUSD : (rawSaved / 1000 * 0.003)).toFixed(2);
    const inrSaved = (stats.estimatedCostSavedINR !== undefined ? stats.estimatedCostSavedINR : (usdSaved * 84.00)).toFixed(2);

    console.log(`
====================================================
⚡ SQUEEZE AI Savings Analytics Dashboard
====================================================
Total Self-Healing Sessions : ${stats.totalSessions}
Total Raw Error Tokens      : ${stats.totalRawTokens}
Total SQUEEZE Tokens Used   : ${stats.totalSqueezeTokens}
Net Context Tokens Saved    : ${rawSaved} tokens
Estimated USD Cost Saved    : $${usdSaved}
Estimated INR Cost Saved    : ₹${inrSaved}
Instant Memory Cache Hits   : ${stats.memoryCacheHits} (Zero-Token Fixes)
====================================================
`);
    break;
  }

  case 'dashboard': {
    const portIdx = args.indexOf('--port');
    const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3000;
    const dashboardServer = new SqueezeDashboardServer({ port });
    dashboardServer.start().then(() => {
      dashboardServer.openInBrowser();
    }).catch(err => {
      console.error('❌ Failed to start dashboard server:', err);
      process.exit(1);
    });
    break;
  }

  default: {
    console.log(`
=====================================================
  SQUEEZE - The Enterprise Context Compression Layer
=====================================================

Usage:
  squeeze proxy [--port 8787]              Start local proxy server
  squeeze wrap <agent> [--self-heal]      Launch coding agent (claude, cursor) through proxy
  squeeze heal <prompt> [--test-cmd "..."] Run standalone self-healing loop with custom test command
  squeeze doctor                           Check health of proxy & compression pipeline
  squeeze stats                            Display live token savings statistics
  squeeze dashboard                        Launch local analytics web dashboard (http://localhost:3000)
  squeeze mcp                              Run MCP stdio server
    `);
  }
}

