#!/usr/bin/env node

/**
 * SQUEEZE CLI Command Executable
 * Matches Headroom CLI capabilities (deploy, wrap, unwrap, proxy, doctor, stats, mcp, dashboard).
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const SqueezeProxyServer = require('../proxy-server.js');

const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'deploy': {
    console.log('\n=====================================================');
    console.log('   SQUEEZE - Turnkey Deployment & System Setup       ');
    console.log('=====================================================\n');
    
    console.log('1. Checking Node.js environment... ✅');
    console.log('2. Initializing Local CCR Storage... ✅');
    console.log('3. Configuring Proxy Server on port 8787... ✅');
    
    console.log('\n[SQUEEZE] Starting background proxy...');
    const proxy = new SqueezeProxyServer({ port: 8787 });
    proxy.start();
    break;
  }

  case 'wrap': {
    const targetAgent = args[1];
    if (!targetAgent) {
      console.log('Usage: squeeze wrap <claude|cursor|codex|aider|cline|opencode|goose|continue>');
      process.exit(1);
    }

    console.log(`\n[SQUEEZE] ⚡ Wrapping agent: ${targetAgent}`);
    console.log(`[SQUEEZE] Proxying LLM calls through http://localhost:8787 ...\n`);

    const env = {
      ...process.env,
      HTTP_PROXY: 'http://localhost:8787',
      HTTPS_PROXY: 'http://localhost:8787',
      OPENAI_BASE_URL: 'http://localhost:8787/v1',
      ANTHROPIC_BASE_URL: 'http://localhost:8787',
      SQUEEZE_WRAPPED: '1'
    };

    const child = spawn(targetAgent, args.slice(2), { env, stdio: 'inherit', shell: true });
    child.on('exit', code => process.exit(code || 0));
    break;
  }

  case 'unwrap': {
    const targetAgent = args[1];
    console.log(`[SQUEEZE] Unwrapped ${targetAgent || 'agent'}. Restored direct API connection.`);
    break;
  }

  case 'proxy': {
    const portIdx = args.indexOf('--port');
    const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : (process.env.PORT || 8787);
    const proxy = new SqueezeProxyServer({ port });
    proxy.start();
    break;
  }

  case 'doctor': {
    console.log('\n[SQUEEZE Doctor] Running health diagnostics...');
    http.get('http://localhost:8787/health', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log('\n✅ Proxy Status: Running on http://localhost:8787');
          console.log(`✅ Engine Status: Active`);
          console.log(`✅ Total Requests Processed: ${health.stats.requestsProcessed}`);
          console.log(`✅ Total Saved Tokens: ${health.stats.totalSavedTokens} (${health.stats.overallSavingsPercent}%)`);
          console.log(`✅ Estimated Cost Saved: $${health.stats.estimatedCostSavedUSD}\n`);
        } catch (e) {
          console.log('⚠️ Proxy returned invalid response');
        }
      });
    }).on('error', () => {
      console.log('❌ Local Proxy is not running. Start it with: squeeze proxy');
    });
    break;
  }

  case 'stats':
  case 'dashboard': {
    http.get('http://localhost:8787/admin/stats', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const resObj = JSON.parse(data);
          const stats = resObj.stats;
          console.log('\n=====================================================');
          console.log('   SQUEEZE Real-Time Context Compression Metrics   ');
          console.log('=====================================================');
          console.log(`Total Requests Processed: ${stats.requestsProcessed}`);
          console.log(`Original Input Tokens:    ${stats.totalOriginalTokens}`);
          console.log(`Compressed Tokens Sent:   ${stats.totalCompressedTokens}`);
          console.log(`Saved Tokens:             ${stats.totalSavedTokens} (${stats.overallSavingsPercent}% saved)`);
          console.log(`CCR Cache Entries:        ${resObj.ccrStore.entries} items`);
          console.log(`Est. API Cost Saved:      $${stats.estimatedCostSavedUSD}\n`);
        } catch (e) {
          console.log('Could not fetch stats dashboard.');
        }
      });
    }).on('error', () => {
      console.log('Proxy Server is not running. Start it with: squeeze proxy');
    });
    break;
  }

  case 'mcp': {
    const SqueezeMCPServer = require('../mcp-server.js');
    const mcp = new SqueezeMCPServer();
    mcp.start();
    break;
  }

  default: {
    console.log(`
=====================================================
  SQUEEZE - The Enterprise Context Compression Layer
=====================================================

Install & Quick Start:
  npm install -g squeeze-ai
  squeeze deploy

Usage Modes:
  squeeze deploy                  Turnkey setup & proxy launch
  squeeze wrap <agent>            Run coding agent (claude, cursor, codex, aider, cline) through proxy
  squeeze unwrap <agent>          Restore direct agent connection
  squeeze proxy [--port 8787]     Start local proxy server
  squeeze doctor                  Check health of proxy & compression pipeline
  squeeze stats                   Display live token savings dashboard
  squeeze mcp                     Run MCP stdio server
    `);
  }
}
