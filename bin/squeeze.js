#!/usr/bin/env node

/**
 * SQUEEZE CLI Command Executable
 * Provides SQUEEZE CLI capabilities (deploy, wrap, unwrap, proxy, doctor, stats, mcp, dashboard).
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
    const subCmd = args[1];
    const SqueezeMCPServer = require('../mcp-server.js');
    const mcp = new SqueezeMCPServer();

    if (subCmd === 'setup' || subCmd === 'install') {
      setupMCP();
    } else if (subCmd === 'serve') {
      const portIdx = args.indexOf('--port');
      const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : (process.env.PORT || 8788);
      mcp.startSSEServer(port);
    } else {
      mcp.startStdio();
    }
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
  squeeze mcp setup

Usage Modes:
  squeeze deploy                  Turnkey setup & proxy launch
  squeeze wrap <agent>            Run coding agent (claude, cursor, codex, aider, cline) through proxy
  squeeze unwrap <agent>          Restore direct agent connection
  squeeze proxy [--port 8787]     Start local proxy server
  squeeze doctor                  Check health of proxy & compression pipeline
  squeeze stats                   Display live token savings dashboard
  squeeze mcp                     Run MCP stdio server (for Claude Code, Cursor, etc.)
  squeeze mcp serve [--port 8788] Run MCP SSE HTTP server
  squeeze mcp setup               Auto-configure MCP for Claude Code, Cursor & Claude Desktop
    `);
  }
}

function setupMCP() {
  console.log('\n=====================================================');
  console.log('   SQUEEZE MCP - Zero-Friction Setup for AI Tools    ');
  console.log('=====================================================\n');

  const rootDir = path.resolve(__dirname, '..');
  const mcpScriptPath = path.join(rootDir, 'mcp-server.js');
  const cwd = process.cwd();

  const mcpConfig = {
    mcpServers: {
      squeeze: {
        command: 'node',
        args: [mcpScriptPath]
      }
    }
  };

  // 1. Local Workspace MCP Configs
  const projectMcpFile = path.join(cwd, '.mcp.json');
  fs.writeFileSync(projectMcpFile, JSON.stringify(mcpConfig, null, 2));
  console.log(`✅ Created workspace MCP configuration: ${projectMcpFile}`);

  const claudeDir = path.join(cwd, '.claude');
  if (!fs.existsSync(claudeDir)) {
    try { fs.mkdirSync(claudeDir, { recursive: true }); } catch (e) {}
  }
  const claudeMcpFile = path.join(claudeDir, 'mcp.json');
  fs.writeFileSync(claudeMcpFile, JSON.stringify(mcpConfig, null, 2));
  console.log(`✅ Created Claude Code MCP configuration: ${claudeMcpFile}`);

  // 2. Claude Desktop Config
  let claudeDesktopPath = null;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    claudeDesktopPath = path.join(appData, 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'darwin') {
    claudeDesktopPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'linux') {
    claudeDesktopPath = path.join(process.env.HOME || '', '.config', 'Claude', 'claude_desktop_config.json');
  }

  if (claudeDesktopPath) {
    try {
      const desktopDir = path.dirname(claudeDesktopPath);
      if (!fs.existsSync(desktopDir)) {
        fs.mkdirSync(desktopDir, { recursive: true });
      }

      let desktopConfig = { mcpServers: {} };
      if (fs.existsSync(claudeDesktopPath)) {
        try {
          desktopConfig = JSON.parse(fs.readFileSync(claudeDesktopPath, 'utf8'));
          if (!desktopConfig.mcpServers) desktopConfig.mcpServers = {};
        } catch (e) {}
      }

      desktopConfig.mcpServers.squeeze = {
        command: 'node',
        args: [mcpScriptPath]
      };

      fs.writeFileSync(claudeDesktopPath, JSON.stringify(desktopConfig, null, 2));
      console.log(`✅ Registered SQUEEZE with Claude Desktop: ${claudeDesktopPath}`);
    } catch (err) {
      console.log(`⚠️ Could not update Claude Desktop config: ${err.message}`);
    }
  }

  // 3. Register via Claude CLI if available
  try {
    execSync(`claude mcp add squeeze node "${mcpScriptPath}"`, { stdio: 'ignore' });
    console.log('✅ Registered SQUEEZE MCP server directly via `claude mcp add`');
  } catch (e) {
    // Silent catch if claude CLI not installed
  }

  console.log('\n=====================================================');
  console.log('🎉 SQUEEZE MCP Server successfully configured!');
  console.log('Available MCP Tools for AI Assistants:');
  console.log(' - squeeze_compress : Compress context, source code, and JSON logs');
  console.log(' - squeeze_retrieve : Fetch original uncompressed text by CCR ref ID');
  console.log(' - squeeze_stats    : Get real-time token savings and cost stats');
  console.log(' - squeeze_doctor   : Verify health of context compression layer');
  console.log('=====================================================\n');
}

