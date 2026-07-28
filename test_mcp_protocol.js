/**
 * Test script simulating Claude Desktop MCP stdio JSON-RPC connection
 */
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'mcp-server.js');
const mcp = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let outputData = '';
mcp.stdout.on('data', chunk => {
  outputData += chunk.toString();
  console.log('[MCP STDOUT]:', chunk.toString().trim());
});

mcp.stderr.on('data', chunk => {
  console.log('[MCP STDERR]:', chunk.toString().trim());
});

function send(msg) {
  const str = JSON.stringify(msg) + '\n';
  console.log('[MCP SEND]:', str.trim());
  mcp.stdin.write(str);
}

// 1. Send Initialize
send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'claude-test', version: '1.0' }
  }
});

// 2. Send Initialized Notification
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
}, 200);

// 3. List Tools
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
}, 400);

// 4. Call Tool
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'squeeze_compress',
      arguments: {
        content: '{"user_id": 1, "status": "active"}'
      }
    }
  });
}, 600);

// 5. Ping
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 4,
    method: 'ping'
  });
}, 800);

setTimeout(() => {
  mcp.kill();
  process.exit(0);
}, 1200);
