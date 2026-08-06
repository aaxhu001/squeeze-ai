/**
 * SQUEEZE AI - Developer Savings Telemetry & Stats Recorder
 * 
 * Accrues and persists self-healing session metrics into `.squeeze_stats.json`.
 */

const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(process.cwd(), '.squeeze_stats.json');

// Standard LLM cost calculation: ~$0.003 / 1,000 tokens (e.g. GPT-4o / Claude Sonnet average)
const USD_PER_1K_TOKENS = 0.003;
const INR_PER_USD = 84.00;

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      return {
        totalSessions: data.totalSessions || 0,
        totalRawTokens: data.totalRawTokens || 0,
        totalSqueezeTokens: data.totalSqueezeTokens || 0,
        netTokensSaved: data.netTokensSaved || 0,
        estimatedCostSavedUSD: data.estimatedCostSavedUSD || 0,
        estimatedCostSavedINR: data.estimatedCostSavedINR || 0,
        memoryCacheHits: data.memoryCacheHits || 0
      };
    }
  } catch (e) {}

  return {
    totalSessions: 0,
    totalRawTokens: 0,
    totalSqueezeTokens: 0,
    netTokensSaved: 0,
    estimatedCostSavedUSD: 0,
    estimatedCostSavedINR: 0,
    memoryCacheHits: 0
  };
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (e) {
    console.error('[SQUEEZE Stats] Error saving stats:', e.message);
  }
}

function recordSessionMetrics({ rawTokens = 0, squeezeTokens = 0, savedTokens = 0, isMemoryHit = false }) {
  const stats = loadStats();
  
  stats.totalSessions += 1;
  stats.totalRawTokens += rawTokens;
  stats.totalSqueezeTokens += squeezeTokens;
  
  const actualSaved = Math.max(0, savedTokens || (rawTokens - squeezeTokens));
  stats.netTokensSaved += actualSaved;

  if (isMemoryHit) {
    stats.memoryCacheHits += 1;
  }

  // Calculate estimated USD and INR savings
  const costSavedUSD = (stats.netTokensSaved / 1000) * USD_PER_1K_TOKENS;
  const costSavedINR = costSavedUSD * INR_PER_USD;

  stats.estimatedCostSavedUSD = parseFloat(costSavedUSD.toFixed(2));
  stats.estimatedCostSavedINR = parseFloat(costSavedINR.toFixed(2));

  saveStats(stats);
  return stats;
}

module.exports = {
  loadStats,
  saveStats,
  recordSessionMetrics,
  STATS_FILE
};
