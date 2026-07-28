// SmartRouter Configuration — Standalone Module
// Zero dependencies on Squeeze codebase

const ROUTER_CONFIG = {
  // ── Feature Toggles ──
  enabled: true,
  autoSwitch: false,             // Phase 1: suggest only, don't auto-switch
  showConfirmationToast: true,
  showDismissButton: true,

  // ── Timing ──
  debounceMs: 800,               // Wait after user stops typing before classifying
  toastDurationMs: 2500,         // How long the "Switched!" toast stays visible
  badgeFadeMs: 300,              // Badge show/hide animation duration

  // ── Thresholds ──
  minPromptLength: 8,            // Don't classify prompts shorter than this (chars)
  minPromptWords: 2,             // Don't classify prompts with fewer words
  thresholds: {
    lowCeiling: 25,              // Score ≤ 25 → Haiku
    mediumCeiling: 55            // Score ≤ 55 → Sonnet, else → Opus
  },

  // ── Dismissal Learning ──
  suppressAfterDismissals: 3,    // Stop suggesting after N dismissals per session
  sessionDismissalKey: "__squeezeRouterSessionDismissals",

  // ── Keyword Banks ──
  keywords: {
    simple: [
      "what is", "what are", "define", "translate", "format this",
      "convert", "list", "yes or no", "how do i", "how to",
      "quick question", "spell check", "rewrite", "rephrase",
      "fix grammar", "explain briefly", "tldr", "tl;dr",
      "one liner", "short answer", "simple question",
      "what does", "is it", "can you", "give me",
      "meaning of", "synonym", "antonym", "example of", "photosynthesis"
    ],
    moderate: [
      "write code", "create a function", "create function",
      "explain how", "compare", "analyze", "implement",
      "generate", "write a script", "build", "design",
      "refactor", "unit test", "debug", "api", "database",
      "write me", "help me build", "create a class",
      "write a program", "make a", "develop", "code for",
      "algorithm for", "data structure", "sort", "filter",
      "parse", "regex", "css for", "html for", "component",
      "web scraper", "scraper", "crawler", "python script"
    ],
    complex: [
      "architect", "system design", "deep analysis",
      "security audit", "review entire", "comprehensive",
      "trade-offs", "trade offs", "optimize algorithm",
      "research paper", "long-form", "multi-step plan",
      "evaluate thoroughly", "critical thinking", "in-depth",
      "distributed system", "scalability", "microservice",
      "full stack", "production ready", "enterprise",
      "complex", "advanced", "thorough review",
      "entire codebase", "migration strategy", "performance audit",
      "concurrency", "concurrent", "async", "parallel", "multithreading",
      "raft", "consensus", "fault tolerance", "mutex", "distributed",
      "worker pools", "pooling", "connection pool", "heavy traffic",
      "microservices", "distributed transactions", "consistency", "migration steps"
    ]
  },

  // ── Signal Weights (sum should approximate 100%) ──
  weights: {
    promptLength: 0.25,
    taskKeywords: 0.30,
    codePresence: 0.15,
    questionStructure: 0.10,
    outputFormat: 0.10,
    conversationDepth: 0.10
  },

  // ── Model Cost Table (per 1K tokens, USD) ──
  // Updated to reflect current Claude and Gemini pricing
  modelCosts: {
    haiku:  { input: 0.00025, output: 0.00125 },
    sonnet: { input: 0.003,   output: 0.015   },
    opus:   { input: 0.015,   output: 0.075   },
    flash:  { input: 0.000075, output: 0.0003  },
    pro:    { input: 0.00125,  output: 0.005   }
  },

  // ── Model Display Names (for fuzzy matching in Claude and Gemini UI) ──
  modelNames: {
    haiku:  ["haiku", "claude 3 haiku", "claude 3.5 haiku", "claude haiku"],
    sonnet: ["sonnet", "claude 3.5 sonnet", "claude sonnet", "claude 4 sonnet"],
    opus:   ["opus", "claude 3 opus", "claude opus", "claude 4 opus"],
    flash:  ["flash", "gemini 1.5 flash", "gemini 2.0 flash", "gemini flash"],
    pro:    ["pro", "gemini 1.5 pro", "gemini 2.0 pro", "gemini pro", "gemini advanced", "gemini 1.5 pro / advanced", "gemini 2.0 pro / advanced"]
  },

  // ── Savings Display ──
  savingsLabels: {
    haiku_from_sonnet: "~90%",
    haiku_from_opus: "~98%",
    sonnet_from_opus: "~80%",
    flash_from_pro: "~94%",
    flash_from_haiku: "~70%",
    pro_from_opus: "~91%"
  }
};

// Export for use in other SmartRouter modules
if (typeof window !== "undefined") {
  window.__squeezeRouterConfig = ROUTER_CONFIG;
}
