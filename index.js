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

let ContentRouter, SmartJSONCrusher, CodeCompressor, CCRStore, globalCCR, OutputShaper, SelfHealEngine;
try {
  ContentRouter = require('./SQUEEZE main/modules/router.js');
  SmartJSONCrusher = require('./SQUEEZE main/modules/json-crusher.js');
  CodeCompressor = require('./SQUEEZE main/modules/code-compressor.js');
  const ccrMod = require('./SQUEEZE main/modules/ccr-store.js');
  CCRStore = ccrMod.CCRStore;
  globalCCR = ccrMod.globalCCR;
  OutputShaper = require('./SQUEEZE main/modules/output-shaper.js');
  SelfHealEngine = require('./SQUEEZE main/modules/self-heal.js');
} catch (e) {
  ContentRouter = require('./Squeeze_Internal_Pro/modules/router.js');
  SmartJSONCrusher = require('./Squeeze_Internal_Pro/modules/json-crusher.js');
  CodeCompressor = require('./Squeeze_Internal_Pro/modules/code-compressor.js');
  const ccrMod = require('./Squeeze_Internal_Pro/modules/ccr-store.js');
  CCRStore = ccrMod.CCRStore;
  globalCCR = ccrMod.globalCCR;
  OutputShaper = require('./Squeeze_Internal_Pro/modules/output-shaper.js');
  try {
    SelfHealEngine = require('./SQUEEZE main/modules/self-heal.js');
  } catch (err) {
    SelfHealEngine = null;
  }
}
const SqueezeProxyServer = require('./proxy-server.js');
const SqueezeMCPServer = require('./mcp-server.js');

// Global Feature Flags (Disabled by default for production safety)
const config = {
  ENABLE_SQUEEZE_SELF_HEAL: process.env.ENABLE_SQUEEZE_SELF_HEAL === 'true' || false
};

function setFeatureFlag(flagName, value) {
  config[flagName] = Boolean(value);
  return config;
}

function getFeatureFlags() {
  return { ...config };
}

/**
 * Pipeline Interception Hook for Self-Healing
 */
async function selfHealPipeline(prompt, codeGeneratorFn, options = {}) {
  const isEnabled = options.enableSelfHeal !== undefined ? options.enableSelfHeal : config.ENABLE_SQUEEZE_SELF_HEAL;

  if (!isEnabled) {
    // Feature Flag is FALSE: Safe pass-through execution
    if (typeof codeGeneratorFn === 'function') {
      const code = codeGeneratorFn(prompt, '', 1);
      return { status: 'PASSTHROUGH_DISABLED', code, selfHealActive: false };
    }
    return { status: 'PASSTHROUGH_DISABLED', selfHealActive: false };
  }

  // Feature Flag is TRUE: Run SQUEEZE Self-Correction Loop
  if (SelfHealEngine && typeof SelfHealEngine.runSelfCorrectionLoop === 'function') {
    const result = await SelfHealEngine.runSelfCorrectionLoop(prompt, codeGeneratorFn, options);
    return { ...result, selfHealActive: true };
  } else {
    throw new Error('[SQUEEZE Error]: SelfHealEngine module is unavailable.');
  }
}

const { SqueezeMemory, globalMemory } = require('./SQUEEZE main/modules/memory.js');

module.exports = {
  compress: (input, options) => ContentRouter.compress(input, options),
  SmartJSONCrusher,
  CodeCompressor,
  CCRStore,
  globalCCR,
  OutputShaper,
  SqueezeProxyServer,
  SqueezeMCPServer,
  SelfHealEngine,
  SqueezeMemory,
  globalMemory,
  squeezeErrorReducer: SelfHealEngine ? SelfHealEngine.squeezeErrorReducer : null,
  runSelfCorrectionLoop: SelfHealEngine ? SelfHealEngine.runSelfCorrectionLoop : null,
  selfHealPipeline,
  setFeatureFlag,
  getFeatureFlags,
  config
};

