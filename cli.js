#!/usr/bin/env node

/**
 * SQUEEZE CLI Interface
 * Commands: squeeze proxy, squeeze wrap, squeeze doctor, squeeze stats, squeeze mcp
 */

const { spawn } = require('child_process');
const http = require('http');
const SqueezeProxyServer = require('./proxy-server.js');
const SqueezeMCPServer = require('./mcp-server.js');

const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
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
    const mcp = new SqueezeMCPServer();
    mcp.start();
    break;
  }

  case 'stats': {
    http.get('http://localhost:8787/admin/stats', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const stats = JSON.parse(data);
          console.log('\n--- SQUEEZE Compression Performance ---');
          console.log(`Total Requests: ${stats.stats.requestsProcessed}`);
          console.log(`Original Tokens: ${stats.stats.totalOriginalTokens}`);
          console.log(`Compressed Tokens: ${stats.stats.totalCompressedTokens}`);
          console.log(`Saved Tokens: ${stats.stats.totalSavedTokens} (${stats.stats.overallSavingsPercent}% reduction)`);
          console.log(`Est. Cost Saved: $${stats.stats.estimatedCostSavedUSD}\n`);
        } catch (e) {
          console.log('Could not parse stats.');
        }
      });
    }).on('error', () => {
      console.log('Proxy Server is not running. Start it with: squeeze proxy');
    });
    break;
  }

  default: {
    console.log(`
=====================================================
  SQUEEZE - The Enterprise Context Compression Layer
=====================================================

Usage:
  squeeze proxy [--port 8787]     Start local proxy server
  squeeze wrap <agent>            Launch coding agent (claude, cursor, codex) through proxy
  squeeze doctor                  Check health of proxy & compression pipeline
  squeeze stats                   Display live token savings statistics
  squeeze mcp                     Run MCP stdio server
    `);
  }
}
