/**
 * SQUEEZE Local Proxy Server
 * Drop-in HTTP/HTTPS proxy listening on localhost:8787 for AI Coding Agents & LLM clients.
 * Zero-code change integration for Claude Code, Cursor, Aider, Codex, Windsurf, OpenCode.
 */

const http = require('http');
const https = require('https');
const url = require('url');

const ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
const { globalCCR } = require('./Squeeze_Internal_Pro/modules/ccr-store.js');
const OutputShaper = require('./Squeeze_Internal_Pro/modules/output-shaper.js');

class SqueezeProxyServer {
  constructor(options = {}) {
    this.port = options.port || 8787;
    this.targetHost = options.targetHost || 'api.anthropic.com';
    this.stats = {
      requestsProcessed: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalSavedTokens: 0,
      startTime: Date.now()
    };
    this.server = null;
  }

  start() {
    this.server = http.createServer((req, res) => this._handleRequest(req, res));
    this.server.listen(this.port, () => {
      console.log(`\n[SQUEEZE Proxy] Running on http://localhost:${this.port}`);
      console.log(`[SQUEEZE Proxy] Intercepting context & optimizing tokens in real-time.\n`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('[SQUEEZE Proxy] Server stopped.');
    }
  }

  _handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);

    // Endpoint: Health check
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/doctor') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version: '1.0.0-pro',
        proxy: true,
        stats: this.getStats()
      }));
      return;
    }

    // Endpoint: Stats dashboard
    if (parsedUrl.pathname === '/admin/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        stats: this.getStats(),
        ccrStore: globalCCR.stats()
      }));
      return;
    }

    // Endpoint: CCR Item Retrieval
    if (parsedUrl.pathname.startsWith('/admin/ccr/')) {
      const refId = parsedUrl.pathname.replace('/admin/ccr/', '');
      const content = globalCCR.get(refId);
      if (content) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: refId, content }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CCR reference key not found' }));
      }
      return;
    }

    // Proxy API payload compression endpoints (/v1/messages, /v1/chat/completions, or generic /compress)
    let bodyData = '';
    req.on('data', chunk => bodyData += chunk);
    req.on('end', () => {
      try {
        if (!bodyData) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'squeeze proxy active' }));
          return;
        }

        const payload = JSON.parse(bodyData);
        const processedPayload = this._compressPayload(payload);

        // Forward to upstream host if Authorization/API headers exist, else return compressed payload directly
        const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
        if (authHeader) {
          this._forwardToUpstream(req, res, processedPayload);
        } else {
          // Direct compression mode
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'success',
            squeezeMetrics: {
              originalTokens: processedPayload._squeezeMetrics?.originalTokens || 0,
              compressedTokens: processedPayload._squeezeMetrics?.compressedTokens || 0,
              savingsPercent: processedPayload._squeezeMetrics?.savingsPercent || 0
            },
            payload: processedPayload
          }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload', details: err.message }));
      }
    });
  }

  _compressPayload(payload) {
    let origTokens = 0;
    let compTokens = 0;

    // 1. Process Messages Array (OpenAI & Anthropic format)
    if (payload.messages && Array.isArray(payload.messages)) {
      payload.messages = payload.messages.map(msg => {
        if (typeof msg.content === 'string') {
          const res = ContentRouter.compress(msg.content);
          origTokens += res.originalTokens;
          compTokens += res.compressedTokens;
          return { ...msg, content: res.compressed };
        } else if (Array.isArray(msg.content)) {
          msg.content = msg.content.map(block => {
            if (block.type === 'text' && typeof block.text === 'string') {
              const res = ContentRouter.compress(block.text);
              origTokens += res.originalTokens;
              compTokens += res.compressedTokens;
              return { ...block, text: res.compressed };
            }
            return block;
          });
        }
        return msg;
      });
    }

    // 2. Output Steering & Effort Shaping
    if (payload.system) {
      if (typeof payload.system === 'string') {
        payload.system = OutputShaper.steerSystemPrompt(payload.system);
      } else if (Array.isArray(payload.system)) {
        payload.system.push({ type: 'text', text: OutputShaper.steerSystemPrompt('') });
      }
    }

    OutputShaper.shapeEffort(payload);

    // Update global stats
    this.stats.requestsProcessed++;
    this.stats.totalOriginalTokens += origTokens;
    this.stats.totalCompressedTokens += compTokens;
    this.stats.totalSavedTokens += Math.max(0, origTokens - compTokens);

    const savingsPercent = origTokens > 0 ? Math.round(((origTokens - compTokens) / origTokens) * 100) : 0;

    payload._squeezeMetrics = {
      originalTokens: origTokens,
      compressedTokens: compTokens,
      savingsPercent
    };

    return payload;
  }

  _forwardToUpstream(clientReq, clientRes, payload) {
    const isAnthropic = clientReq.headers['x-api-key'] || clientReq.url.includes('/messages');
    const hostname = isAnthropic ? 'api.anthropic.com' : (process.env.OPENAI_BASE_URL || 'api.openai.com').replace('https://', '').replace('http://', '');

    const postData = JSON.stringify(payload);

    const options = {
      hostname,
      port: 443,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: hostname,
        'content-length': Buffer.byteLength(postData)
      }
    };

    const proxyReq = https.request(options, upstreamRes => {
      clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(clientRes, { end: true });
    });

    proxyReq.on('error', err => {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Upstream connection error', details: err.message }));
    });

    proxyReq.write(postData);
    proxyReq.end();
  }

  getStats() {
    const overallSavings = this.stats.totalOriginalTokens > 0
      ? Math.round(((this.stats.totalOriginalTokens - this.stats.totalCompressedTokens) / this.stats.totalOriginalTokens) * 100)
      : 0;

    return {
      ...this.stats,
      overallSavingsPercent: overallSavings,
      estimatedCostSavedUSD: (this.stats.totalSavedTokens * 0.000003).toFixed(4)
    };
  }
}

if (require.main === module) {
  const proxy = new SqueezeProxyServer({ port: process.env.PORT || 8787 });
  proxy.start();
}

module.exports = SqueezeProxyServer;
