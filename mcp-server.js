/**
 * SQUEEZE Model Context Protocol (MCP) Server
 * Built with Anthropic's official @modelcontextprotocol/sdk for 100% Claude Desktop & Cursor compatibility.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
const { globalCCR } = require('./Squeeze_Internal_Pro/modules/ccr-store.js');

// Redirect standard console logging to stderr so stdout is 100% reserved for MCP stdio JSON-RPC
console.log = (...args) => process.stderr.write(`[SQUEEZE MCP INFO] ${args.join(' ')}\n`);
console.info = (...args) => process.stderr.write(`[SQUEEZE MCP INFO] ${args.join(' ')}\n`);
console.warn = (...args) => process.stderr.write(`[SQUEEZE MCP WARN] ${args.join(' ')}\n`);
console.error = (...args) => process.stderr.write(`[SQUEEZE MCP ERR] ${args.join(' ')}\n`);

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
            contentType: { type: 'string', description: 'Optional explicit content type (json, code, prose, autodetect)' }
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Squeeze MCP Server connected using official Anthropic SDK.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}

module.exports = server;
