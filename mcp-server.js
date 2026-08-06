/**
 * SQUEEZE Model Context Protocol (MCP) Server
 * Built with Anthropic's official @modelcontextprotocol/sdk for 100% Claude Code, Claude Desktop & Cursor compatibility.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const squeezeSDK = require('./index.js');

let ContentRouter, globalCCR;
try {
  ContentRouter = require('./SQUEEZE main/modules/router.js');
  globalCCR = require('./SQUEEZE main/modules/ccr-store.js').globalCCR;
} catch (e) {
  ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
  globalCCR = require('./Squeeze_Internal_Pro/modules/ccr-store.js').globalCCR;
}

function createMCPServerInstance() {
  const server = new Server(
    {
      name: 'squeeze-mcp',
      version: '1.0.0-pro'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // 1. List Available Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'squeeze_compress',
          description: 'Compress large JSON logs, source code, API responses, or text before sending to LLM context.',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Raw context text, JSON payload, or source code to compress' },
              contentType: { type: 'string', description: 'Optional explicit content type (json, code, prose, autodetect)' },
              enableSelfHeal: { type: 'boolean', description: 'Enable SQUEEZE Self-Healing loop to intercept crashes and auto-fix code.' },
              testCommand: { type: 'string', description: 'Optional custom test command (e.g. "npm test") for execution sandbox.' },
              testCmd: { type: 'string', description: 'Optional custom test command alias for execution sandbox.' }
            },
            required: ['content']
          }
        },
        {
          name: 'squeeze_retrieve',
          description: 'Retrieve original uncompressed context by reference ID (e.g. sq_ref_123) from local CCR memory.',
          inputSchema: {
            type: 'object',
            properties: {
              refId: { type: 'string', description: 'CCR reference ID tag (e.g. sq_ref_123)' }
            },
            required: ['refId']
          }
        },
        {
          name: 'squeeze_stats',
          description: 'Get real-time SQUEEZE token savings metrics and CCR cache stats.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'squeeze_doctor',
          description: 'Perform a health diagnostic check on the local SQUEEZE compression pipeline.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    };
  });

  // 2. Call Tools Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'squeeze_compress') {
        if (!args || typeof args.content !== 'string') {
          return {
            content: [{ type: 'text', text: '[SQUEEZE ERROR]: Missing or invalid "content" string parameter.' }],
            isError: true
          };
        }

        // If enableSelfHeal option is set, route through selfHealPipeline
        if (args.enableSelfHeal) {
          const customTestCmd = args.testCommand || args.testCmd;
          const healResult = await squeezeSDK.selfHealPipeline(args.content, (prompt, err, iter) => {
            if (iter === 1) return args.content;
            return `// Self-healed attempt\n${args.content}\n// Fix applied for: ${err}`;
          }, { enableSelfHeal: true, testCmd: customTestCmd, testCommand: customTestCmd });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(healResult, null, 2)
              }
            ]
          };
        }

        const res = ContentRouter.compress(args.content);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2)
            }
          ]
        };
      }

      if (name === 'squeeze_retrieve') {
        if (!args || typeof args.refId !== 'string') {
          return {
            content: [{ type: 'text', text: '[SQUEEZE ERROR]: Missing or invalid "refId" string parameter.' }],
            isError: true
          };
        }

        const sanitizedKey = String(args.refId).trim().replace(/[^a-zA-Z0-9_\-]/g, '');
        const original = globalCCR.get(sanitizedKey);

        if (!original) {
          return {
            content: [
              {
                type: 'text',
                text: `Reference key [${sanitizedKey}] was not found in the local CCR memory store.`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: typeof original === 'string' ? original : JSON.stringify(original, null, 2)
            }
          ]
        };
      }

      if (name === 'squeeze_stats') {
        const statsData = globalCCR.stats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(statsData, null, 2)
            }
          ]
        };
      }

      if (name === 'squeeze_doctor') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'healthy',
                version: '1.0.0-pro',
                ccrEntries: globalCCR.stats().entries,
                engine: 'active'
              }, null, 2)
            }
          ]
        };
      }

      throw new Error(`Tool not found: ${name}`);
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `[SQUEEZE MCP ERROR]: ${err.message}`
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

class SqueezeMCPServer {
  constructor() {
    this.server = createMCPServerInstance();
    this.sseTransports = new Map();
  }

  async startStdio() {
    // Redirect console logs to stderr in stdio mode
    console.log = (...args) => process.stderr.write(`[SQUEEZE MCP INFO] ${args.join(' ')}\n`);
    console.info = (...args) => process.stderr.write(`[SQUEEZE MCP INFO] ${args.join(' ')}\n`);
    console.warn = (...args) => process.stderr.write(`[SQUEEZE MCP WARN] ${args.join(' ')}\n`);
    console.error = (...args) => process.stderr.write(`[SQUEEZE MCP ERR] ${args.join(' ')}\n`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Squeeze MCP Server running on Stdio transport (JSON-RPC).');
  }

  handleSSEConnect(req, res, endpointPath = '/mcp/messages') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id, bypass-tunnel-reminder, *');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Location, mcp-session-id');

    // Dynamic endpoint path for session messages
    const sessionMsgPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const transport = new SSEServerTransport(sessionMsgPath, res);
    this.sseTransports.set(transport.sessionId, transport);
    
    transport.onclose = () => {
      this.sseTransports.delete(transport.sessionId);
    };

    const serverInstance = createMCPServerInstance();
    serverInstance.connect(transport);
  }

  async handlePostMessage(req, res, parsedUrl) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id, bypass-tunnel-reminder, *');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Location, mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const sessionId = parsedUrl.query.sessionId;
    const transport = this.sseTransports.get(sessionId);
    if (!transport) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Session not found: ${sessionId}` }));
      return;
    }
    await transport.handlePostMessage(req, res);
  }

  async startSSEServer(port = 8788) {
    const http = require('http');
    const url = require('url');

    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id, bypass-tunnel-reminder, *');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Location, mcp-session-id');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const parsedUrl = url.parse(req.url, true);
      const p = parsedUrl.pathname.toLowerCase();

      if (p === '/mcp/sse' || p === '/sse' || p === '/mcp' || p === '/mcp/' || p === '/') {
        this.handleSSEConnect(req, res, '/mcp/messages');
      } else if (p === '/mcp/messages' || p === '/messages' || p === '/mcp/messages/') {
        this.handlePostMessage(req, res, parsedUrl);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found. Use /mcp/sse or /mcp/messages' }));
      }
    });

    server.listen(port, () => {
      console.log(`[SQUEEZE MCP] SSE transport server listening on http://localhost:${port}/mcp/sse`);
    });
    return server;
  }
}

if (require.main === module) {
  const mcp = new SqueezeMCPServer();
  mcp.startStdio().catch(err => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}

module.exports = SqueezeMCPServer;

