/**
 * Test script for SQUEEZE MCP Server over HTTP/SSE Transport
 */
const http = require('http');
const SqueezeMCPServer = require('./mcp-server.js');

async function testSSE() {
  console.log('Starting Squeeze MCP SSE Server test on port 8799...');
  const mcp = new SqueezeMCPServer();
  const server = await mcp.startSSEServer(8799);

  // 1. Establish SSE Connection
  const req = http.get('http://localhost:8799/mcp/sse', (res) => {
    console.log(`[SSE GET Response Status]: ${res.statusCode}`);
    console.log(`[SSE Content-Type]: ${res.headers['content-type']}`);

    let endpointUrl = '';

    res.on('data', (chunk) => {
      const str = chunk.toString();
      console.log(`[SSE EVENT DATA]: ${str.trim()}`);
      if (str.includes('event: endpoint')) {
        const match = str.match(/data:\s*([^\s]+)/);
        if (match) {
          endpointUrl = match[1];
          console.log(`[SSE Endpoint Received]: ${endpointUrl}`);
          // 2. Send JSON-RPC Post Message
          sendPostMessage(endpointUrl);
        }
      }
    });
  });

  function sendPostMessage(endpoint) {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    });

    const postOptions = {
      hostname: 'localhost',
      port: 8799,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const postReq = http.request(postOptions, (postRes) => {
      console.log(`[POST Message Response Status]: ${postRes.statusCode}`);
      postRes.on('data', (d) => console.log(`[POST Response Data]: ${d.toString()}`));
      
      setTimeout(() => {
        req.destroy();
        server.close();
        console.log('✅ SQUEEZE MCP SSE Transport test passed successfully!');
        process.exit(0);
      }, 500);
    });

    postReq.write(postData);
    postReq.end();
  }
}

testSSE().catch(err => {
  console.error('SSE Test Error:', err);
  process.exit(1);
});
