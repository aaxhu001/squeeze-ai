// Standalone Test Runner for Smart Model Routing Classifier
// Supports both Claude and Gemini model mapping verification.

const fs = require('fs');
const path = require('path');

// Mock browser objects
global.window = {};

// Load config first
const configCode = fs.readFileSync(path.join(__dirname, '../Squeeze_Beta/SmartRouter/router-config.js'), 'utf8');
eval(configCode);

// Load core classifier
const coreCode = fs.readFileSync(path.join(__dirname, '../Squeeze_Beta/SmartRouter/router-core.js'), 'utf8');
eval(coreCode);

const classify = global.window.__squeezeRouterClassify;

function runClassifierTests() {
  console.log("=== RUNNING SMART MODEL ROUTER CLASSIFIER TESTS ===\n");

  const testCases = [
    // ── Claude Tests ──
    {
      name: "Claude Simple Question",
      prompt: "What is the capital of France?",
      context: { currentModel: "sonnet", hostname: "claude.ai" },
      expectedModel: "haiku",
      shouldSuggest: true
    },
    {
      name: "Claude Complex Code Gen",
      prompt: "Write a high-performance concurrent web scraper in Go using channels, sync.Pool, worker pools, and connection pooling to limit resource consumption under heavy traffic.",
      context: { currentModel: "sonnet", hostname: "claude.ai" },
      expectedModel: "opus",
      shouldSuggest: true
    },
    {
      name: "Claude Already Optimal",
      prompt: "define photosynthesis",
      context: { currentModel: "haiku", hostname: "claude.ai" },
      expectedModel: "haiku",
      shouldSuggest: false
    },

    // ── Gemini Tests ──
    {
      name: "Gemini Simple Question",
      prompt: "Who wrote Romeo and Juliet?",
      context: { currentModel: "pro", hostname: "gemini.google.com" },
      expectedModel: "flash",
      shouldSuggest: true
    },
    {
      name: "Gemini Complex Design",
      prompt: "Architect a scalable microservices structure for an e-commerce backend. Explain data consistency, distributed transactions, database selection, and migration steps thoroughly.",
      context: { currentModel: "flash", hostname: "gemini.google.com" },
      expectedModel: "pro",
      shouldSuggest: true
    },
    {
      name: "Gemini Already Optimal",
      prompt: "summarize this page in 3 sentences: ...",
      context: { currentModel: "flash", hostname: "gemini.google.com" },
      expectedModel: "flash",
      shouldSuggest: false
    }
  ];

  let passedCount = 0;
  testCases.forEach((tc, idx) => {
    const res = classify(tc.prompt, tc.context);
    
    if (!res) {
      console.log(`[FAIL] Case #${idx + 1} (${tc.name}): No classification returned.`);
      return;
    }

    const modelMatch = res.recommendedModel === tc.expectedModel;
    const suggestMatch = res.shouldSuggest === tc.shouldSuggest;

    if (modelMatch && suggestMatch) {
      console.log(`[PASS] Case #${idx + 1} (${tc.name})`);
      passedCount++;
    } else {
      console.log(`[FAIL] Case #${idx + 1} (${tc.name})`);
      console.log(`  Prompt:       "${tc.prompt.substring(0, 60)}..."`);
      console.log(`  Context Model: ${tc.context.currentModel}`);
      console.log(`  Output Model:  ${res.recommendedModel} (Expected: ${tc.expectedModel})`);
      console.log(`  Suggest Check: ${res.shouldSuggest} (Expected: ${tc.shouldSuggest})`);
      console.log(`  Total Score:   ${res.score}`);
    }
  });

  console.log(`\nResults: ${passedCount}/${testCases.length} Tests Passed.`);
  return passedCount === testCases.length;
}

if (runClassifierTests()) {
  console.log("\nALL STANDALONE CLASSIFIER TESTS COMPLETED SUCCESSFULLY!");
} else {
  console.log("\nTEST SUITE DETECTED UNEXPECTED RESULTS. PLEASE REFINE SCORING ALGORITHMS.");
  process.exit(1);
}
