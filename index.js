/**
 * SQUEEZE Node.js & TypeScript SDK
 * The enterprise context compression layer for AI agents.
 * 
 * Usage:
 *   const { compress } = require('squeeze-ai');
 *   // or: import { compress } from 'squeeze-ai';
 * 
 *   const result = compress(myLargePayload);
 *   console.log(result.compressed, result.savingsPercent);
 */

const ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
const SmartJSONCrusher = require('./Squeeze_Internal_Pro/modules/json-crusher.js');
const CodeCompressor = require('./Squeeze_Internal_Pro/modules/code-compressor.js');
const { CCRStore, globalCCR } = require('./Squeeze_Internal_Pro/modules/ccr-store.js');
const OutputShaper = require('./Squeeze_Internal_Pro/modules/output-shaper.js');
const SqueezeProxyServer = require('./proxy-server.js');
const SqueezeMCPServer = require('./mcp-server.js');

module.exports = {
  compress: (input, options) => ContentRouter.compress(input, options),
  SmartJSONCrusher,
  CodeCompressor,
  CCRStore,
  globalCCR,
  OutputShaper,
  SqueezeProxyServer,
  SqueezeMCPServer
};
