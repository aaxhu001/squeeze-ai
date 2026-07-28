// Squeeze Beta background service worker - Local Heuristic Optimizer

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default local rules and stats if not present
  chrome.storage.local.get([
    "optimizationMode",
    "ruleStripGreetings",
    "ruleSimplifyPhrases",
    "ruleAbbreviate",
    "ruleStripArticles",
    "rulePolishMarkdown",
    "stats_promptsOptimized",
    "stats_tokensSaved",
    "stats_costSaved"
  ], (result) => {
    const defaults = {};
    if (result.optimizationMode === undefined) defaults.optimizationMode = "balanced";
    if (result.ruleStripGreetings === undefined) defaults.ruleStripGreetings = true;
    if (result.ruleSimplifyPhrases === undefined) defaults.ruleSimplifyPhrases = true;
    if (result.ruleAbbreviate === undefined) defaults.ruleAbbreviate = true;
    if (result.ruleStripArticles === undefined) defaults.ruleStripArticles = false;
    if (result.rulePolishMarkdown === undefined) defaults.rulePolishMarkdown = true;
    if (result.stats_promptsOptimized === undefined) defaults.stats_promptsOptimized = 0;
    if (result.stats_tokensSaved === undefined) defaults.stats_tokensSaved = 0;
    if (result.stats_costSaved === undefined) defaults.stats_costSaved = 0.0;
    
    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

// Simple token estimator
function estimateTokens(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  const tokenEstChars = Math.ceil(chars / 4);
  const tokenEstWords = Math.ceil(words * 1.3);
  return Math.max(tokenEstChars, tokenEstWords);
}

// Local Prompt Optimizer Engine - Safe Duplicate Sentence Remover
function removeDuplicateSentences(text, rulesApplied) {
  if (!text) return "";
  
  // Split by line first to preserve paragraph and list formatting
  const lines = text.split("\n");
  const seenSentences = new Set();
  const processedLines = [];
  let duplicatesFound = false;

  for (let line of lines) {
    if (!line.trim()) {
      processedLines.push("");
      continue;
    }

    // Skip sentence splitting if line contains code placeholders
    if (line.includes("__SQUEEZE_CODE_SAFE_")) {
      processedLines.push(line);
      continue;
    }

    // Split line into true sentences (punctuation followed by whitespace and a capital/number or EOL)
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'\(\[])/g);
    const lineResult = [];

    for (let sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      
      const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      // Only treat as duplicate if normalized sentence is > 20 chars to avoid stripping bullet items
      if (normalized.length > 20 && seenSentences.has(normalized)) {
        duplicatesFound = true;
      } else {
        if (normalized.length > 20) {
          seenSentences.add(normalized);
        }
        lineResult.push(sentence);
      }
    }

    if (lineResult.length > 0) {
      processedLines.push(lineResult.join(" "));
    }
  }
  
  if (duplicatesFound && rulesApplied && !rulesApplied.includes("Duplicate sentence removal")) {
    rulesApplied.push("Duplicate sentence removal");
  }
  
  return processedLines.join("\n").replace(/[ \t]{2,}/g, " ").trim();
}

// Local Prompt Optimizer Engine
function optimizeLocally(text, mode, rules) {
  if (!text) return { optimized: "", rulesApplied: [] };

  const rulesApplied = [];
  const codeBlocks = [];
  let placeholderCount = 0;

  function protectSpan(match) {
    const placeholder = `__SQUEEZE_CODE_SAFE_${placeholderCount}__`;
    codeBlocks.push({ placeholder, original: match });
    placeholderCount++;
    return placeholder;
  }

  // 1. Multi-Tier Code & Technical Token Protection
  // Tier A: Markdown Code Blocks & Inline Backticks
  let protectedText = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, protectSpan);

  // Tier B: URLs, URIs, Email addresses
  protectedText = protectedText.replace(/(https?:\/\/[^\s<>\)\]"']+|www\.[^\s<>\)\]"']+|ftp:\/\/[^\s<>\)\]"']+|file:\/\/\/[^\s<>\)\]"']+|[\w.-]+@[\w.-]+\.[a-zA-Z]{2,})/g, protectSpan);

  // Tier C: Version Numbers (e.g. 18.2.0, 1.0.4-beta)
  protectedText = protectedText.replace(/\b\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9.]+)?\b/g, protectSpan);

  // Tier D: Common Technical Abbreviations & Filenames with extensions (e.g. e.g., i.e., Node.js, app.py)
  protectedText = protectedText.replace(/\b(?:e\.g\.|i\.e\.|etc\.|vs\.|v\.)/gi, protectSpan);
  protectedText = protectedText.replace(/\b[A-Za-z0-9_-]+\.(js|ts|jsx|tsx|py|html|css|json|go|rs|cpp|c|h|java|md|sh|yml|yaml|sql|php|rb|swift|kt)\b/gi, protectSpan);

  // Tier E: Method / Property Chains & Object Access (e.g. input.trim(), todos.filter, items[i].price, console.log)
  protectedText = protectedText.replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*\b/g, protectSpan);

  // Tier F: Spread/Rest syntax & Operators (e.g. ...args, !==, ===, =>, ->, &&, ||)
  protectedText = protectedText.replace(/\.\.\.[a-zA-Z0-9_$]*/g, protectSpan);
  protectedText = protectedText.replace(/(!==|===|!=|==|=>|->|&&|\|\||\+\+|--|\+=|-=|\*=\|\/=)/g, protectSpan);

  // Tier G: Un-fenced Code Lines (lines starting with keywords like function, const, let, var, return, class, import, etc.)
  protectedText = protectedText.replace(/^[ \t]*(?:function|const|let|var|return|class|import|export|def|async|await|struct|interface|type)\b.*$/gm, protectSpan);

  // 2. Pass 1: Remove duplicate sentences before regex rules
  let optimized = protectedText;
  if (rules.ruleSimplifyPhrases) {
    optimized = removeDuplicateSentences(optimized, rulesApplied);
  }

  // 3. Rule: Meta-commentary & recap removal
  if (rules.ruleStripGreetings) {
    const metaCommentaries = [
      /\b(?:just\s+to\s+clarify|as\s+stated\s+previously|mind\s+you|bear\s+in\s+mind\s+that|it's\s+worth\s+noting\s+that|to\s+be\s+clear|note\s+that)\b[.,!?]*\s*/gi,
      /\b(?:so\s+)?as\s+i\s+(?:mentioned|stated)(?:\s+(?:above|earlier|previously|before))?\b[.,!?]*\s*/gi,
      /\b(?:as\s+we\s+discussed|just\s+to\s+recap\s+our\s+discussion|recap\s+our\s+discussion)\b(?:\s+(?:earlier\s+in\s+the\s+thread|above|previously|before))?[.,!?]*\s*/gi
    ];
    let metaFound = false;
    metaCommentaries.forEach(regex => {
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, "");
        metaFound = true;
      }
    });
    if (metaFound) {
      rulesApplied.push("Meta-commentary removal");
    }
  }

  // 4. Rule: Redundant qualifier stripping
  if (rules.ruleSimplifyPhrases) {
    const qualifiers = [
      { regex: /\b(?:please\s+)?make\s+sure\s+that\s+you\b\s*/gi, label: "Redundant qualifier stripping" },
      { regex: /\bi\s+need\s+you\s+to\b\s*/gi, label: "Redundant qualifier stripping" },
      { regex: /\bi\s+want\s+you\s+to\b\s*/gi, label: "Redundant qualifier stripping" },
      { regex: /\bit\s+is\s+important\s+(?:that|to)\s+you\b\s*/gi, label: "Redundant qualifier stripping" },
      { regex: /\bbe\s+sure\s+to\b\s*/gi, label: "Redundant qualifier stripping" },
      { regex: /\bensure\s+that\s+you\b\s*/gi, label: "Redundant qualifier stripping" },
      { regex: /\bgo\s+ahead\s+and\b\s*/gi, label: "Redundant qualifier stripping" }
    ];
    
    let qualifierFound = false;
    qualifiers.forEach(item => {
      if (item.regex.test(optimized)) {
        optimized = optimized.replace(item.regex, "");
        qualifierFound = true;
      }
    });
    
    if (qualifierFound) {
      rulesApplied.push("Redundant qualifier stripping");
    }
  }

  // 5. Rule: Role-play preamble compaction
  if (rules.ruleStripGreetings) {
    const rolePlayRegex = /\bact\s+as\s+(?:if\s+you\s+were\s+)?(?:though\s+you\s+were\s+)?(?:a\s+|an\s+)?(?:the\s+)?(?:expert\s+|professional\s+|senior\s+|experienced\s+)?([\w\s-]+?)(?:\s+with\s+\d+\s+years\s+of\s+experience|\s+with\s+experience)?\s*([.,!?]|$)/gi;
    if (rolePlayRegex.test(optimized)) {
      optimized = optimized.replace(rolePlayRegex, (match, roleName, punctuation) => {
        return `Act as ${roleName.trim()}${punctuation || "."}`;
      });
      rulesApplied.push("Role-play preamble compaction");
    }
  }

  // 6. Rule 1: Strip greetings & politeness
  if (rules.ruleStripGreetings) {
    const greetings = [
      // 1. Softener & filler openers/closings
      { regex: /\b(?:no\s+worries\s+at\s+all\s+if\s+you're\s+busy|no\s+worries\s+if\s+you're\s+busy|no\s+worries\s+if\s+you\s+are\s+busy|no\s+worries\s+at\s+all|no\s+worries|no\s+rush)[.,!?]*\s*/gi, label: "Politeness padding removal" },
      { regex: /\b(?:let\s+me\s+know\s+if\s+you\s+need\s+more\s+details|let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else|looking\s+forward\s+to\s+your\s+help|looking\s+forward\s+to\s+hearing\s+from\s+you|looking\s+forward\s+to\s+it)[.,!?]*\s*/gi, label: "Politeness padding removal" },
      { regex: /\b(?:can\s+you\s+help\s+me\s+to\s+write|can\s+you\s+help\s+me\s+write|can\s+you\s+help\s+me\s+build|can\s+you\s+help\s+me|could\s+you\s+help\s+me)\b\s*/gi, label: "Politeness padding removal" },
      
      // 2. Common confirmation pads
      { regex: /\b(?:thank\s+you|thanks)(?:\s+for\s+[^.!?]+)?(?:\s*,\s*it\s+was\s+[^.!?]+)?[.!?]+\s*/gi, label: "Politeness padding removal" },
      { regex: /\b(?:thank\s+you|thanks)\s*,\s*(?:that\s+worked|that\s+works\s+(?:great|well)?)[.!?]+\s*/gi, label: "Politeness padding removal" },
      { regex: /\b(?:awesome|great|cool|perfect)\s*,\s*that\s+works\s+(?:great|well|perfectly)?[.!?]+\s*/gi, label: "Politeness padding removal" },
      
      // 3. Specific politeness phrases
      { regex: /\bthanks\s+in\s+advance[.,!?]*\s*/gi, label: "Politeness padding removal" },
      { regex: /\bi\s+would\s+(?:really\s+)?appreciate\s+it\s+if\s+you\s+could\b\s*/gi, label: "Politeness padding removal" },
      { regex: /\bhope\s+you\s+are\s+doing\s+well[.,!?]*\s*/gi, label: "Politeness padding removal" },
      { regex: /\bhope\s+this\s+helps[.,!?]*\s*/gi, label: "Politeness padding removal" },
      { regex: /\bbest\s+regards|regards|sincerely|yours\s+truly\b[.,!?]*\s*/gi, label: "Politeness padding removal" },
      
      // 4. Greetings
      { regex: /(?:hello|hi|hey|greetings|dear|good\s+(?:morning|afternoon|evening))\s+(?:claude|assistant|ai|there|sir|madam|team|friend|buddy)\b[.,!?]*\s*/gi, label: "Politeness padding removal" },
      
      // 5. Polite auxiliary queries & starts
      { regex: /\b(?:could|can|would)\s+you\s+please\s+(?:help\s+me\s+(?:to\s+)?)?/gi, label: "Politeness padding removal" },
      { regex: /\b(?:could|can|would)\s+you\s+(?:help\s+me\s+(?:to\s+)?)?/gi, label: "Politeness padding removal" },
      { regex: /\b(?:i\s+would\s+like\s+you\s+to|i\s+want\s+you\s+to|i\s+need\s+you\s+to|i'm\s+looking\s+for\s+a|i\s+was\s+wondering\s+if\s+you\s+could)\b\s*/gi, label: "Politeness padding removal" },
      
      // 6. Polite please
      { regex: /(?:^|([.!?]\s+))please\b\s*/gi, replaceWith: "$1", label: "Politeness padding removal" },
      { regex: /\bplease\s+(?:write|create|generate|make|help|explain|do|find|check|tell|give|show|list|analyze|sort)\b/gi, label: "Politeness padding removal" },
      { regex: /,\s*please[.,!?]*(?=\s|$)/gi, label: "Politeness padding removal" },
      
      // 7. General thanks/thank you
      { regex: /\bthank\s+you\b[.,!?]*\s*/gi, label: "Politeness padding removal" },
      { regex: /\bthanks\b[.,!?]*\s*/gi, label: "Politeness padding removal" }
    ];
    
    let greetingsFound = false;
    greetings.forEach(item => {
      if (item.regex.test(optimized)) {
        if (item.replaceWith !== undefined) {
          optimized = optimized.replace(item.regex, item.replaceWith);
        } else {
          optimized = optimized.replace(item.regex, "");
        }
        greetingsFound = true;
      }
    });
    
    if (greetingsFound) {
      rulesApplied.push("Politeness padding removal");
    }
  }

  // 7. Rule 2: Simplify verbose phrases
  if (rules.ruleSimplifyPhrases) {
    const verboseReplacements = {
      "in order to": "to",
      "due to the fact that": "because",
      "at this point in time": "now",
      "for the purpose of": "to",
      "has the ability to": "can",
      "take into consideration": "consider",
      "make a decision": "decide",
      "utilize": "use",
      "utilizes": "uses",
      "utilizing": "using",
      "as well as": "and",
      "a number of": "several",
      "along the lines of": "like",
      "referred to as": "called",
      "in the event that": "if",
      "on a daily basis": "daily",
      "with respect to": "regarding",
      "in addition to": "and",
      "so as to": "to",
      "is responsible for": "does",
      "by means of": "by",
      "in close proximity to": "near",
      "make use of": "use",
      "perform an analysis of": "analyze",
      "provide an explanation of": "explain",
      "conduct an investigation into": "investigate",
      "has a requirement for": "needs",
      "it is important to note that": "note that",
      "bearing in mind that": "considering",
      "for the reason that": "because",
      "in the near future": "soon",
      "in the course of": "during",
      "with the exception of": "except",
      "are in agreement": "agree",
      "make adjustments to": "adjust",
      "give rise to": "cause",
      "draw attention to": "highlight",
      "at the present time": "currently",
      "subsequent to": "after",
      "prior to": "before",
      "take steps to": "try to",
      "despite the fact that": "although"
    };

    let verboseFound = false;
    for (const [key, value] of Object.entries(verboseReplacements)) {
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, value);
        verboseFound = true;
      }
    }
    if (verboseFound) {
      rulesApplied.push("Verbosity simplification");
    }
  }

  // 8. Rule 3: Abbreviate terms (Notice 'function' is NOT here to avoid code breakage!)
  if (rules.ruleAbbreviate) {
    let abbreviateReplacements = {
      "information": "info",
      "database": "DB",
      "parameter": "param",
      "parameters": "params",
      "configuration": "config",
      "administrator": "admin",
      "development": "dev",
      "application": "app",
      "applications": "apps",
      "for example": "e.g.",
      "that is": "i.e.",
      "versus": "vs",
      "approximately": "~",
      "without": "w/o",
      "with": "w/",
      "number": "num",
      "numbers": "nums",
      "between": "betw",
      "through": "thru",
      "standard": "std",
      "environment": "env",
      "temporary": "temp",
      "documentation": "docs",
      "different": "diff",
      "difference": "diff",
      "developer": "dev",
      "developers": "devs",
      "repository": "repo",
      "repositories": "repos",
      "directory": "dir",
      "directories": "dirs",
      "implementation": "impl",
      "implementations": "impls"
    };

    if (mode === "balanced" || mode === "polish") {
      abbreviateReplacements = {
        "for example": "e.g.",
        "that is": "i.e.",
        "versus": "vs",
        "approximately": "~"
      };
    }

    let abbreviateFound = false;
    for (const [key, value] of Object.entries(abbreviateReplacements)) {
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, value);
        abbreviateFound = true;
      }
    }
    if (abbreviateFound) {
      rulesApplied.push("Abbreviation substitution");
    }
  }

  // 9. Rule 4: Strip articles (Squeeze mode)
  if (rules.ruleStripArticles && mode === "squeeze") {
    // 1. Simplify key phrase verbs BEFORE dropping articles to allow matching
    const verbShorteners = {
      "should make a request to": "request",
      "should make a request": "request",
      "should make request to": "request",
      "should make request": "request",
      "make a request to": "request",
      "make request to": "request",
      "is going to be": "will be",
      "should be": "be",
      "ought to": "should",
      "will be able to": "can",
      "it is necessary that": "must",
      "you can": "can",
      "we can": "can",
      "should": ""
    };
    
    let verbShortened = false;
    for (const [key, value] of Object.entries(verbShorteners)) {
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, value);
        verbShortened = true;
      }
    }

    // 2. Now strip articles and pronouns
    const articleRegex = /\b(?:the|a|an)\b\s+/gi;
    let articleStripped = false;
    if (articleRegex.test(optimized)) {
      optimized = optimized.replace(articleRegex, "");
      articleStripped = true;
    }
    
    if (verbShortened || articleStripped) {
      rulesApplied.push("Article & auxiliary stripping");
    }
  }

  // 10. Rule: Punctuation cleanup (!!! -> !, ??? -> ?)
  if (rules.rulePolishMarkdown) {
    const multiExclamation = /!{2,}/g;
    const multiQuestion = /\?{2,}/g;
    let puncCleaned = false;
    if (multiExclamation.test(optimized)) {
      optimized = optimized.replace(multiExclamation, "!");
      puncCleaned = true;
    }
    if (multiQuestion.test(optimized)) {
      optimized = optimized.replace(multiQuestion, "?");
      puncCleaned = true;
    }
    if (puncCleaned) {
      rulesApplied.push("Punctuation cleanup");
    }
  }

  // 11. Rule 5: Polish formatting & Markdown cleanup
  if (rules.rulePolishMarkdown) {
    optimized = optimized.replace(/(^|\n)(#{1,6})([^\s#])([^\n]+)/g, "$1$2 $3$4");
    optimized = optimized.replace(/(^|\n)[*+]\s+/g, "$1- ");
    optimized = optimized.replace(/[ \t]{2,}/g, " ");
    optimized = optimized.replace(/^[ \t]+/gm, "").replace(/[ \t]+$/gm, "");
    optimized = optimized.replace(/\n{3,}/g, "\n\n");
  }

  optimized = optimized.trim();

  // 12. Final Pass: Remove duplicate sentences that became identical post-compression
  if (rules.ruleSimplifyPhrases) {
    optimized = removeDuplicateSentences(optimized, rulesApplied);
  }

  // Restore protected blocks in reverse order
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    optimized = optimized.replace(block.placeholder, block.original);
  }

  return { optimized, rulesApplied };
}

// Sensitive data masker for security
function maskSensitiveData(text) {
  if (!text) return "";
  let masked = text;
  // 1. Key-value pairs for passwords, tokens, API keys
  masked = masked.replace(/\b(api[-_]?key|secret|password|passwd|pass|token|credential|auth[-_]?key|private[-_]?key)\s*[:=]\s*["']([^"'\n]{4,})["']/gi, (match, key, val) => {
    return `${key}: "[MASKED]"`;
  });
  // 2. Generic high-entropy strings (e.g. OpenAI keys sk-..., AWS keys, Slack tokens)
  masked = masked.replace(/\b(sk-[a-zA-Z0-9_-]{20,})\b/g, "[MASKED_API_KEY]");
  masked = masked.replace(/\b(AIzaSy[a-zA-Z0-9-_]{30,})\b/g, "[MASKED_API_KEY]");
  // 3. Password assignments in env files
  masked = masked.replace(/\b(DB_PASSWORD|PASSWORD|SECRET|TOKEN|KEY)\s*=\s*([^\s\n]{3,})/gi, "$1=[MASKED]");
  return masked;
}

// Extract context from endpoint JSON shape variations
function extractContextFromResponse(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (data.context && typeof data.context === "string") return data.context;
  if (data.text && typeof data.text === "string") return data.text;
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === "string") return item;
      if (item.content) return item.content;
      if (item.text) return item.text;
      return JSON.stringify(item);
    }).join("\n\n");
  }
  if (data.results && Array.isArray(data.results)) {
    return data.results.map(item => item.content || item.text || JSON.stringify(item)).join("\n\n");
  }
  return JSON.stringify(data);
}

// Fetch context from Unabyss/MCP local server url
async function fetchServerContext(url, promptText) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 4000); // 4 sec timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText }),
      signal: controller.signal
    });
    
    clearTimeout(id);
    if (!response.ok) {
      return fetchServerContextGetFallback(url);
    }
    
    const data = await response.json();
    return extractContextFromResponse(data);
  } catch (err) {
    clearTimeout(id);
    return fetchServerContextGetFallback(url);
  }
}

async function fetchServerContextGetFallback(url) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) return "";
    const data = await response.json();
    return extractContextFromResponse(data);
  } catch (err) {
    clearTimeout(id);
    return "";
  }
}

// Load and process Context Vault items
async function processVaultContext(promptText, mode, rules) {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      "vaultPreferences",
      "vaultPrefAlwaysInject",
      "vaultSmartTriggers",
      "vaultFiles",
      "vaultServerUrl",
      "vaultServerEnabled"
    ], async (data) => {
      const preferences = data.vaultPreferences || "";
      const alwaysInjectPref = data.vaultPrefAlwaysInject !== false;
      const smartTriggers = data.vaultSmartTriggers !== false;
      const files = data.vaultFiles || [];
      const serverUrl = data.vaultServerUrl || "";
      const serverEnabled = !!data.vaultServerEnabled;

      const attachedContexts = [];
      const contextBlocks = [];
      let totalRawContextLength = 0;

      // 1. Global Preferences
      if (preferences.trim() && alwaysInjectPref) {
        totalRawContextLength += preferences.length;
        const squeezedPref = optimizeLocally(preferences, "balanced", {
          ruleStripGreetings: true,
          ruleSimplifyPhrases: true,
          ruleAbbreviate: false,
          ruleStripArticles: false,
          rulePolishMarkdown: true
        }).optimized;
        
        contextBlocks.push(`[Personal Preferences]\n${squeezedPref}`);
        attachedContexts.push("Personal Preferences");
      }

      // 2. Vault Files
      if (files.length > 0) {
        const promptLower = promptText.toLowerCase();
        
        for (const file of files) {
          let matched = false;
          if (smartTriggers) {
            // Split filename to extract keywords
            const nameWithoutExt = file.name.replace(/\.[a-z0-9]+$/i, "");
            const tokens = nameWithoutExt.toLowerCase().split(/[^a-z0-9]+/);
            const keywords = tokens.filter(t => t.length >= 3 || ["db", "js", "go", "py"].includes(t));
            
            for (const kw of keywords) {
              const regex = new RegExp("\\b" + kw + "\\b", "i");
              if (regex.test(promptLower)) {
                matched = true;
                break;
              }
            }
          } else {
            // Inject all files if smart triggers are disabled
            matched = true;
          }

          if (matched && file.content) {
            totalRawContextLength += file.content.length;
            const maskedContent = maskSensitiveData(file.content);
            const squeezedContent = optimizeLocally(maskedContent, mode, rules).optimized;
            
            contextBlocks.push(`[File: ${file.name}]\n${squeezedContent}`);
            attachedContexts.push(file.name);
          }
        }
      }

      // 3. Unabyss Endpoint
      if (serverEnabled && serverUrl) {
        try {
          const serverContext = await fetchServerContext(serverUrl, promptText);
          if (serverContext) {
            totalRawContextLength += serverContext.length;
            const maskedServerContext = maskSensitiveData(serverContext);
            const squeezedServerContext = optimizeLocally(maskedServerContext, mode, rules).optimized;
            
            contextBlocks.push(`[Server Context]\n${squeezedServerContext}`);
            attachedContexts.push("Unabyss Endpoint");
          }
        } catch (err) {
          console.warn("Unabyss server query failed:", err);
        }
      }

      let combinedContextBlock = "";
      if (contextBlocks.length > 0) {
        combinedContextBlock = `=== SQUEEZED CONTEXT VAULT ===\n${contextBlocks.join("\n\n")}\n==============================\n\n`;
      }

      resolve({
        contextBlock: combinedContextBlock,
        attachedContexts: attachedContexts,
        rawContextTokens: Math.ceil(totalRawContextLength / 4)
      });
    });
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "optimizePrompt") {
    const { prompt, mode } = message;
    
    // Retrieve local configuration
    chrome.storage.local.get([
      "optimizationMode",
      "ruleStripGreetings",
      "ruleSimplifyPhrases",
      "ruleAbbreviate",
      "ruleStripArticles",
      "rulePolishMarkdown"
    ], async (result) => {
      const optMode = mode || result.optimizationMode || "balanced";
      
      const rules = {
        ruleStripGreetings: result.ruleStripGreetings !== false,
        ruleSimplifyPhrases: result.ruleSimplifyPhrases !== false,
        ruleAbbreviate: result.ruleAbbreviate !== false,
        ruleStripArticles: result.ruleStripArticles !== false,
        rulePolishMarkdown: result.rulePolishMarkdown !== false
      };

      try {
        // First process context vault asynchronously
        const { contextBlock, attachedContexts, rawContextTokens } = await processVaultContext(prompt, optMode, rules);
        
        // Then optimize the user prompt text
        const { optimized, rulesApplied } = optimizeLocally(prompt, optMode, rules);
        
        // Squeezed prompt contains context block at the top followed by the optimized prompt
        const finalOptimizedPrompt = contextBlock + optimized;
        
        // Calculate stats
        const originalTokens = estimateTokens(prompt) + rawContextTokens;
        const optimizedTokens = estimateTokens(finalOptimizedPrompt);
        const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
        
        // Cost estimation: Assume $3.00 per million tokens (Claude Sonnet 5 / Fable 5 average inputs)
        const costSaved = tokensSaved * 0.000003; 
        
        // Update stats in storage
        chrome.storage.local.get(["stats_promptsOptimized", "stats_tokensSaved", "stats_costSaved"], (stats) => {
          const updated = {
            stats_promptsOptimized: (stats.stats_promptsOptimized || 0) + 1,
            stats_tokensSaved: (stats.stats_tokensSaved || 0) + tokensSaved,
            stats_costSaved: (stats.stats_costSaved || 0) + costSaved
          };
          chrome.storage.local.set(updated);
        });
        
        sendResponse({
          success: true,
          original: prompt,
          optimized: finalOptimizedPrompt,
          originalTokens: originalTokens,
          optimizedTokens: optimizedTokens,
          tokensSaved: tokensSaved,
          percentageSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0,
          mode: optMode,
          rulesApplied: rulesApplied,
          attachedContexts: attachedContexts
        });
      } catch (err) {
        console.error("Local optimization failed:", err);
        sendResponse({ success: false, error: err.message });
      }
    });
    
    return true; // Keep message channel open for asynchronous response
  }
});
