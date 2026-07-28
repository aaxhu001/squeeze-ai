const fs = require('fs');
const path = require('path');

// Auto-load .env file if present
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        let v = trimmed.substring(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.substring(1, v.length - 1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const { callSqueezeModel, estimateTokens } = require('../services/squeezeService');

const sampleConversation = `
[USER]: I'm building a SaaS invoicing tool called Lemon for freelancers in India.
[ASSISTANT]: Great, what's the core feature set?
[USER]: Invoice creation, UPI payment links, and history tracking. Using Cloudflare Workers and KV storage.
[ASSISTANT]: For UPI links, you'll want deep link format upi://pay?pa=...
[USER]: Got it working, live at lemon.aashu.workers.dev. Now I need a QR code fallback for desktop users.
`;

(async () => {
  console.log("====================================================");
  console.log("   SQUEEZE GEMINI MODEL CONTEXT CAPTURE TEST        ");
  console.log("====================================================\n");

  const inputTokens = estimateTokens(sampleConversation);
  console.log(`Input Length: ${sampleConversation.length} chars (~${inputTokens} tokens)`);
  console.log("Calling Gemini API with Squeeze Prompt Template...\n");

  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in environment.");
    console.warn("Set GEMINI_API_KEY in .env file or environment before running online test.\n");
    process.exit(0);
  }

  try {
    const result = await callSqueezeModel(sampleConversation);
    const outputText = JSON.stringify(result, null, 2);
    const outputTokens = estimateTokens(outputText);

    console.log("SQUEEZED JSON CONTEXT CAPSULE:\n");
    console.log(outputText);
    console.log("\n📊 STATS:");
    console.log(`   Source Tokens: ${inputTokens}`);
    console.log(`   Output Tokens: ${outputTokens}`);
    console.log(`   Tokens Saved:  ${inputTokens - outputTokens} (${Math.round(((inputTokens - outputTokens)/inputTokens)*100)}% savings)`);

    // Verify key entity preservation (lemon.aashu.workers.dev, Cloudflare Workers)
    const entitiesStr = JSON.stringify(result.entities || {}) + JSON.stringify(result.artifacts || []);
    const preservedDomain = entitiesStr.toLowerCase().includes("lemon.aashu.workers.dev");
    const preservedWorkers = entitiesStr.toLowerCase().includes("cloudflare") || outputText.toLowerCase().includes("cloudflare");

    console.log(`\nExact Entity Preservation Check:`);
    console.log(`- Domain 'lemon.aashu.workers.dev': ${preservedDomain ? "✅ PRESERVED" : "⚠️ CHECK ENTITIES"}`);
    console.log(`- 'Cloudflare Workers':           ${preservedWorkers ? "✅ PRESERVED" : "⚠️ CHECK ENTITIES"}`);

  } catch (err) {
    console.error('Test failed:', err.message);
  }
  console.log("\n====================================================\n");
})();
