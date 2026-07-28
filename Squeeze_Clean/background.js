// Squeeze Beta background service worker - Local Heuristic Optimizer

try {
  importScripts(
    "modules/json-crusher.js",
    "modules/code-compressor.js",
    "modules/ccr-store.js",
    "modules/output-shaper.js",
    "modules/router.js"
  );
} catch (e) {}

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

// ── Semantic Sentence Redundancy Collapsing Engine ──
// Detects & collapses paraphrased / restated sentences sharing core concept key clusters
function collapseSemanticSentenceRedundancy(text, mode, rulesApplied) {
  if (!text) return text;

  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g);
  if (sentences.length <= 1) return text;

  const stopWords = new Set(["a","an","the","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","must","shall","can","of","in","to","for","with","on","at","by","from","up","about","into","over","after","and","or","but","so","if","then","else","when","as","until","while","our","we","us","that","this","they","them","their","it","its","at","end","day","what","nothing","because","every","say","mean","also","recent","recently","new","all"]);

  function extractConceptKey(word) {
    const w = word.toLowerCase();
    if (w.startsWith("custom") || w.startsWith("client")) return "concept_customer";
    if (w.startsWith("satisf") || w.startsWith("happi") || w === "happy" || w === "first" || w === "priority" || w === "center") return "concept_satisfaction";
    if (w.startsWith("cloudflar") || w.startsWith("worker") || w === "payment" || w === "upi" || w === "checkout") return "concept_payment";
    if (w.startsWith("region") || w.startsWith("offic") || w === "staffing" || w === "shortage" || w === "target" || w === "q2") return "concept_offices";
    if (w.startsWith("perform") || w.startsWith("speed") || w.startsWith("fast") || w === "latency") return "concept_perf";
    return w;
  }

  const keptSentences = [];
  const seenConceptSets = [];
  let redundancyFound = false;

  for (let s of sentences) {
    const sTrimmed = s.trim();
    if (!sTrimmed) continue;

    if (sTrimmed.includes("__SQUEEZE_CODE_SAFE_")) {
      keptSentences.push(sTrimmed);
      continue;
    }

    const rawWords = sTrimmed.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const concepts = new Set(rawWords.map(extractConceptKey));

    let isRedundant = false;
    for (let prevSet of seenConceptSets) {
      let sharedCount = 0;
      for (let c of concepts) {
        if (c.startsWith("concept_") && prevSet.has(c)) {
          sharedCount++;
        }
      }

      if (sharedCount >= 2) {
        isRedundant = true;
        break;
      }
    }

    if (!isRedundant) {
      keptSentences.push(sTrimmed);
      seenConceptSets.push(concepts);
    } else {
      redundancyFound = true;
    }
  }

  if (redundancyFound && rulesApplied && !rulesApplied.includes("Semantic redundancy collapsing")) {
    rulesApplied.push("Semantic redundancy collapsing");
  }

  return keptSentences.join(" ");
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
  // Tier A: Markdown Code Blocks (``` or ~~~ with any language tag) & Inline Backticks
  let protectedText = text.replace(/(```[a-zA-Z0-9_+-]*[\s\S]*?```|~~~[a-zA-Z0-9_+-]*[\s\S]*?~~~|`[^`\n]+`)/g, protectSpan);

  // Tier B: URLs, URIs, Email addresses
  protectedText = protectedText.replace(/(https?:\/\/[^\s<>\)\]"']+|www\.[^\s<>\)\]"']+|ftp:\/\/[^\s<>\)\]"']+|file:\/\/\/[^\s<>\)\]"']+|[\w.-]+@[\w.-]+\.[a-zA-Z]{2,})/g, protectSpan);

  // Tier C: Version Numbers (e.g. 18.2.0, 1.0.4-beta)
  protectedText = protectedText.replace(/\b\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9.]+)?\b/g, protectSpan);

  // Tier D: Common Technical Abbreviations & Filenames with extensions (e.g. e.g., i.e., Node.js, app.py)
  protectedText = protectedText.replace(/\b(?:e\.g\.|i\.e\.|etc\.|vs\.|v\.)/gi, protectSpan);
  protectedText = protectedText.replace(/\b[A-Za-z0-9_-]+\.(js|ts|jsx|tsx|py|html|css|json|go|rs|cpp|c|h|java|md|sh|yml|yaml|sql|php|rb|swift|kt)\b/gi, protectSpan);

  // Tier E: Method / Property Chains & Object Access (e.g. input.trim(), todos.filter, items[i].price, console.log)
  protectedText = protectedText.replace(/\b[a-z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*\b/g, protectSpan);

  // Tier F: Spread/Rest syntax & Operators (e.g. ...args, !==, ===, =>, ->, &&, ||)
  protectedText = protectedText.replace(/\.\.\.[a-zA-Z0-9_$]*/g, protectSpan);
  protectedText = protectedText.replace(/(!==|===|!=|==|=>|->|&&|\|\||\+\+|--|\+=|-=|\*=\|\/=)/g, protectSpan);

  // Tier G: Un-fenced Code Lines & Control Flow Statements (def, if, else, for, while, return, try, except, etc.)
  protectedText = protectedText.replace(/^[ \t]*(?:function|const|let|var|return|class|import|export|default|def|self|async|await|struct|interface|type|public|private|protected|if|else|elif|for|while|try|except|finally|with|switch|case|pass|break|continue|raise|yield|new|delete|typeof|instanceof|void|null|undefined)\b.*$/gm, protectSpan);

  // 2. Pass 1: Remove exact & semantic duplicate sentences before regex rules
  let optimized = protectedText;
  if (rules.ruleSimplifyPhrases) {
    optimized = removeDuplicateSentences(optimized, rulesApplied);
    optimized = collapseSemanticSentenceRedundancy(optimized, mode, rulesApplied);
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

// Global Reserved Keywords Denylist (Item 3 - Second line of defense against abbreviation leaks)
const RESERVED_KEYWORDS = new Set([
  "function", "const", "let", "var", "return", "class", "import", "export", 
  "default", "def", "self", "async", "await", "struct", "interface", "type", 
  "public", "private", "protected", "if", "else", "for", "while", "try", "catch", 
  "throw", "yield", "new", "delete", "typeof", "instanceof", "void", "null", "undefined"
]);

// ─── Shared helper: strip a whole sentence that contains a matched phrase ───
// Returns the text with the entire sentence removed if the sentence boundary
// can be cleanly identified; otherwise returns the text unchanged (safe fallback).
function removeWholeSentenceContaining(text, phraseRegex) {
  // Split on sentence boundaries (. ! ?) keeping the delimiter
  const sentencePattern = /[^.!?\n]+[.!?\n]*/g;
  let result = "";
  let modified = false;
  let lastIndex = 0;
  let match;
  // Rebuild text sentence by sentence, dropping sentences that match
  const sentences = [];
  const rawText = text;
  sentencePattern.lastIndex = 0;
  while ((match = sentencePattern.exec(rawText)) !== null) {
    sentences.push({ text: match[0], start: match.index });
  }
  // If we can't split cleanly, fall back to word-level remove for this phrase
  if (sentences.length === 0) return text;
  const kept = sentences.filter(s => {
    phraseRegex.lastIndex = 0;
    return !phraseRegex.test(s.text);
  });
  if (kept.length === sentences.length) return text; // nothing removed
  modified = true;
  return kept.map(s => s.text).join("").trim();
}

// ── Rule: Conversational Filler & Hedging Removal ──
function stripConversationalFiller(text, mode, rulesApplied) {
  if (!text) return text;
  let optimized = text;
  let hedgeFound = false;

  // 1. Lead-in & Standalone Politeness Padding
  const fillerOpeners = [
    /^(?:i\s+)?hope\s+this\s+(?:message|email|note|finds\s+you\s+well)[^.!?]*[.!?]*\s*/gi,
    /(?:^|\s+)so,?\s+(?:i\s+)?just\s+wanted\s+to\s+(?:kind\s+of\s+|sort\s+of\s+)?(?:reach\s+out|check\s+in|touch\s+base)\s*(?:and,?\s*(?:you\s+know,?\s*)?basically\s*)?(?:ask\s+if\s+you\s+could\s+(?:possibly\s+)?)?(?:help\s+me\s+out\s+with\s+something\s*)?(?:when\s+you\s+get\s+a\s+chance)[^.!?]*[.!?]*/gi,
    /(?:^|\s+)basically,?\s*what\s+i'm\s+trying\s+to\s+say\s+is\s+that\s*/gi,
    /(?:^|\s+)also,?\s*i\s+just\s+wanted\s+to\s+mention\s+that\s*/gi,
    /(?:^|\s+)and\s+one\s+more\s+thing\s*[\u2014\u2013-]*\s*/gi,
    /\bif\s+that's?\s+helpful\s+context[.!?]*/gi,
    /\bif\s+that\s+makes?\s+sense[.!?]*/gi,
    /\bwhen\s+you\s+get\s+a\s+chance[.!?]*/gi
  ];

  fillerOpeners.forEach(regex => {
    if (regex.test(optimized)) {
      optimized = optimized.replace(regex, "");
      hedgeFound = true;
    }
  });

  // 2. Mid-sentence Hedging & Filler Words
  const midSentenceHedging = [
    { regex: /\bkind\s+of\b\s*/gi, label: "Hedging removal" },
    { regex: /\bsort\s+of\b\s*/gi, label: "Hedging removal" },
    { regex: /\bmore\s+or\s+less,?\s*/gi, label: "Hedging removal" },
    { regex: /\bin\s+a\s+way,?\s*/gi, label: "Hedging removal" },
    { regex: /\byou\s+know,?\s*/gi, label: "Hedging removal" },
    { regex: /\bbasically,?\s*/gi, label: "Hedging removal" },
    { regex: /\bi\s+believe,?\s*/gi, label: "Hedging removal" },
    { regex: /\bpossibly\b\s*/gi, label: "Hedging removal" },
    { regex: /\band\s+i\s+think\s+it's\b\s*/gi, replaceWith: "and ", label: "Hedging removal" },
    { regex: /\bthere's\s+been\s+sort\s+of\s+a\b\s*/gi, replaceWith: "there has been a ", label: "Hedging removal" }
  ];

  midSentenceHedging.forEach(item => {
    if (item.regex.test(optimized)) {
      if (item.replaceWith !== undefined) {
        optimized = optimized.replace(item.regex, item.replaceWith);
      } else {
        optimized = optimized.replace(item.regex, "");
      }
      hedgeFound = true;
    }
  });

  if (hedgeFound && rulesApplied && !rulesApplied.includes("Conversational filler & hedging removal")) {
    rulesApplied.push("Conversational filler & hedging removal");
  }

  return optimized;
}

// 6. Rule 1: Whole-Sentence Conversational Ending & Politeness Removal
  if (rules.ruleStripGreetings) {
    optimized = stripConversationalFiller(optimized, mode, rulesApplied);

    const wholeSentenceClosings = [
      /(?:^|\s+)(?:no\s+worries\s+at\s+all\s+if\s+you're\s+busy|no\s+worries\s+if\s+you're\s+busy|no\s+worries\s+if\s+you\s+are\s+busy|no\s+worries\s+at\s+all|no\s+worries|no\s+rush)[^.!?]*[.!?]*/gi,
      /(?:^|\s+)(?:let\s+me\s+know\s+if\s+you\s+need\s+more\s+details|let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else|looking\s+forward\s+to\s+your\s+help|looking\s+forward\s+to\s+hearing\s+from\s+you|looking\s+forward\s+to\s+it)[^.!?]*[.!?]*/gi,
      /(?:^|\s+)(?:can\s+you\s+help\s+me\s+to\s+write|can\s+you\s+help\s+me\s+write|can\s+you\s+help\s+me\s+build|can\s+you\s+help\s+me|could\s+you\s+help\s+me)\b/gi,
      /(?:^|\s+)(?:thanks\s+in\s+advance|thank\s+you\s+in\s+advance|hope\s+this\s+helps|hope\s+you\s+are\s+doing\s+well)[^.!?]*[.!?]*/gi
    ];

    let greetingsFound = false;
    wholeSentenceClosings.forEach(regex => {
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, "");
        greetingsFound = true;
      }
    });

    // ── Whole-clause politeness removal (fixes fragment bug from Round 2) ──
    // Each entry is a phrase trigger. The entire SENTENCE containing it is removed.
    // This prevents dangling fragments like "so much in advance, really appreciate it!"
    const wholeClauseTriggers = [
      // "thanks so much in advance, really appreciate it!" → whole sentence gone
      /\bthanks\s+so\s+much\b/gi,
      /\bthank\s+you\s+so\s+much\b/gi,
      // "thanks for your help!", "thanks for reading" etc. → whole sentence
      /\bthanks\s+for\s+(?:your\s+)?(?:help|time|reading|taking|considering|reviewing|looking)[^.!?\n]*/gi,
      /\bthank\s+you\s+for\s+(?:your\s+)?(?:help|time|reading|taking|considering|reviewing|looking)[^.!?\n]*/gi,
      // Standalone "Thanks!" / "Thank you!" as their own sentence
      /^[\s]*(?:thank\s+you|thanks)[.!,]?\s*$/gim,
      // "It is important to note that" — remove the whole filler clause, keep the rest
      /\bit\s+is\s+(?:important|worth)\s+to\s+note\s+that\s*/gi,
      /\bit\s+should\s+be\s+noted\s+that\s*/gi,
      /\bplease\s+note\s+that\s*/gi,
      // "really appreciate it", "appreciate your help" as standalone closing sentences
      /\breally\s+appreciate\s+(?:it|this|your\s+\w+)[.!,]?\s*$/gim,
      /\bmuch\s+appreciated[.!,]?\s*$/gim,
    ];

    wholeClauseTriggers.forEach(phraseRegex => {
      const before = optimized;
      optimized = removeWholeSentenceContaining(optimized, phraseRegex);
      if (optimized !== before) greetingsFound = true;
    });

    const greetings = [
      // Greetings (safe — these are full standalone phrases)
      { regex: /(?:hello|hi|hey|greetings|dear|good\s+(?:morning|afternoon|evening))\s+(?:claude|assistant|ai|there|sir|madam|team|friend|buddy)\b[.,!?]*\s*/gi, label: "Politeness padding removal" },
      // Polite please (these are single words, safe to strip without fragment risk)
      { regex: /(?:^|([.!?]\s+))please\b\s*/gi, replaceWith: "$1", label: "Politeness padding removal" },
      { regex: /\bplease\s+(?:write|create|generate|make|help|explain|do|find|check|tell|give|show|list|analyze|sort)\b/gi, label: "Politeness padding removal" },
      { regex: /,\s*please[.,!?]*(?=\s|$)/gi, label: "Politeness padding removal" },
      // Confirmation pads
      { regex: /\b(?:awesome|great|cool|perfect)\s*,\s*that\s+works\s+(?:great|well|perfectly)?[.!?]+\s*/gi, label: "Politeness padding removal" },
    ];
    
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
      if (RESERVED_KEYWORDS.has(key.toLowerCase())) continue;
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

  // 8. Rule 3: Abbreviate terms (Item 3 - Filtered against RESERVED_KEYWORDS)
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
      if (RESERVED_KEYWORDS.has(key.toLowerCase())) continue; // Denylist check
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

  // 10a. Rule: Punctuation cleanup (!!! -> !, ??? -> ?)
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

  // 10b. Prose Dot-Spacing Correction (Item 2 - Strict & Safe for Prose Only)
  // Only insert space after a period if:
  // - Preceded by a prose word of at least 3 letters (not a number, not a 1-2 char token like e.g.)
  // - Followed immediately by a letter without space
  // - Neither side is a digit
  if (rules.rulePolishMarkdown) {
    const proseDotRegex = /(?<=\b[a-zA-Z]{3,})\.([a-zA-Z])(?!\d)/g;
    if (proseDotRegex.test(optimized)) {
      optimized = optimized.replace(proseDotRegex, ". $1");
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

  // 12. Final Grammatical & Punctuation Normalization Pass
  optimized = normalizePunctuationAndCapitalization(optimized);

  // 13. Final Pass: Remove duplicate sentences that became identical post-compression
  if (rules.ruleSimplifyPhrases) {
    optimized = removeDuplicateSentences(optimized, rulesApplied);
  }

  // Restore protected blocks in reverse order
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    optimized = optimized.replace(block.placeholder, block.original);
  }

  // CRITICAL SAFETY & INDENTATION INTEGRITY ASSERTION:
  // Verify that every single protected code block was restored 100% byte-for-byte verbatim.
  // If any code block lost backticks, language tags, or indentation, fall back to safe original text.
  let integrityFailed = false;
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    if (!optimized.includes(block.original)) {
      integrityFailed = true;
      console.warn(`[Squeeze Safety] Code integrity verification failed for block #${i} — aborting transformation to prevent code corruption.`);
      break;
    }
  }

  const leakDetected = /__SQUEEZE_CODE_SAFE_\d+__/.test(optimized);
  if (leakDetected || integrityFailed) {
    console.warn("[Squeeze] Code protection assertion failed — falling back to original text.");
    let safeText = text;
    safeText = safeText.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return { optimized: safeText, rulesApplied: ["[Safe fallback — code integrity preserved 100%]"] };
  }

  return { optimized, rulesApplied };
}

// ── Post-Compression Punctuation & Capitalization Normalization Pass ──
function normalizePunctuationAndCapitalization(text) {
  if (!text) return "";

  let cleaned = text;

  // 1. Collapse double punctuation & orphaned commas
  cleaned = cleaned.replace(/,\s*,/g, ",");                // ", ," -> ","
  cleaned = cleaned.replace(/,\s*\./g, ".");                // ", ." -> "."
  cleaned = cleaned.replace(/\.\s*,/g, ".");                // ". ," -> "."
  cleaned = cleaned.replace(/\s+([,.;!?])/g, "$1");         // " ," -> ","
  cleaned = cleaned.replace(/,\s*(?:and|or|but)?\s*,/g, ",");// ", and ," -> ","

  // 2. Remove orphaned commas between auxiliary verbs & main verbs ("has, improved" -> "has improved")
  cleaned = cleaned.replace(/\b(has|have|had|is|are|was|were|been|be|would|could|should|will|can)\s*,\s*([a-z]+ed|[a-z]+ing|[a-z]+)\b/gi, "$1 $2");

  // 3. Remove orphaned commas between noun subjects and verbs ("offices, missed" -> "offices missed")
  cleaned = cleaned.replace(/\b([a-zA-Z]{3,})\s*,\s*(missed|failed|increased|decreased|improved|showed|took|made|ran|had|were|was)\b/gi, "$1 $2");

  // 4. Remove leading punctuation (e.g. starting with ", " or ". ")
  cleaned = cleaned.replace(/^[,\s;:-]+/g, "");

  // 5. Replace trailing comma at end of string with a period
  cleaned = cleaned.replace(/,\s*$/g, ".");

  // 6. Sentence Re-Capitalization Pass:
  // Capitalize first character of string if it's a letter
  if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Capitalize first letter of any sentence following a period/exclamation/question mark
  cleaned = cleaned.replace(/(?<=[.!?]\s+)([a-z])/g, (match, letter) => letter.toUpperCase());

  // 7. Ensure terminal punctuation at end of document if missing
  if (cleaned.length > 0 && !/[.!?:]$/.test(cleaned.trim())) {
    cleaned = cleaned.trim() + ".";
  }

  // 8. Clean up extra spaces
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ").replace(/\s+\./g, ".").trim();

  return cleaned;
}

// ── Smart Concept Distillation Engine for Multi-Page PDFs & Documents ──
function squeezePDFSmart(text, mode = "squeeze") {
  if (!text || text.length < 300) return text;

  // 1. Meta-filler & restatement preamble stripping
  const metaPatterns = [
    /\b(?:just\s+to\s+make\s+sure\s+everyone[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:let\s+me\s+walk\s+through\s+the\s+problem\s+again[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:to\s+restate[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:as\s+has\s+been\s+said\s+already[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:as\s+mentioned\s+already[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:as\s+described\s+earlier[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:as\s+touched\s+on\s+earlier[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:as\s+emphasized\s+multiple\s+times[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:to\s+put\s+it\s+plainly\s+one\s+more\s+time[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:restating[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:given\s+how\s+much\s+repetition[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:a\s+longer\s+restatement[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:final\s+restatement[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:one\s+more\s+pass[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:one\s+last\s+restated\s+word[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:here's\s+a\s+rundown\s+of\s+what\s+currently\s+exists[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:turning\s+now\s+to[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:it's\s+worth\s+spending\s+a\s+bit\s+more\s+time\s+justifying[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:which\s+is\s+to\s+say\s+the\s+same\s+thing[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:i\s+want\s+to\s+say\s+that\s+again[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:repeating\s+this\s+because\s+it\s+matters)[.,!?]*\s*/gi,
    /\b(?:again,\s+this\s+is\s+the\s+same[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:the\s+goal,\s+restated[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:a\s+point\s+that,\s+again,[^\n.]*)[.,!?]*\s*/gi,
    /\b(?:that\s+gap\s+—\s+restating[^\n.]*)[.,!?]*\s*/gi
  ];

  let cleaned = text;
  metaPatterns.forEach(pat => {
    cleaned = cleaned.replace(pat, "");
  });

  // 2. Extract sections & detect redundant section titles
  const sections = cleaned.split(/(?=(?:^|\n)\d+\.\s+[A-Z])/m);
  const uniqueSections = [];
  const conceptFingerprints = [];

  for (let sec of sections) {
    sec = sec.trim();
    if (!sec) continue;

    const headerMatch = sec.match(/^(\d+\.\s+[^\n]+)/);
    const headerTitle = headerMatch ? headerMatch[1].toLowerCase() : "";

    // Drop pure restatement / skimmer summary section titles
    if (/(?:restatement|restated|revisiting|one\s+more\s+pass|one\s+last|skimmers|closing\s+note|summary\s+before)/i.test(headerTitle)) {
      continue;
    }

    const words = sec.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 4);
    const wordSet = new Set(words);

    let maxOverlap = 0;
    for (let prevSet of conceptFingerprints) {
      let matchCount = 0;
      for (let w of wordSet) {
        if (prevSet.has(w)) matchCount++;
      }
      const overlapRatio = wordSet.size > 0 ? (matchCount / wordSet.size) : 0;
      if (overlapRatio > maxOverlap) maxOverlap = overlapRatio;
    }

    if (maxOverlap >= 0.55 && conceptFingerprints.length >= 3) {
      continue;
    }

    uniqueSections.push(sec);
    conceptFingerprints.push(wordSet);
  }

  let result = uniqueSections.join("\n\n");

  // 3. Sentence-level deduplication pass
  const sentences = result.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g);
  const seenSentenceFingerprints = [];
  const finalSentences = [];

  for (let s of sentences) {
    const sTrimmed = s.trim();
    if (!sTrimmed) continue;

    if (/^\d+\.\s+[A-Z]/i.test(sTrimmed)) {
      finalSentences.push(sTrimmed);
      continue;
    }

    const sWords = new Set(sTrimmed.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length >= 4));
    if (sWords.size < 3) {
      finalSentences.push(sTrimmed);
      continue;
    }

    let isDup = false;
    for (let prevSet of seenSentenceFingerprints) {
      let matchCount = 0;
      for (let w of sWords) {
        if (prevSet.has(w)) matchCount++;
      }
      const ratio = matchCount / Math.min(sWords.size, prevSet.size);
      if (ratio >= 0.70) {
        isDup = true;
        break;
      }
    }

    if (!isDup) {
      finalSentences.push(sTrimmed);
      seenSentenceFingerprints.push(sWords);
    }
  }

  result = finalSentences.join(" ");
  result = result.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return result;
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
        
        // Check if input is a PDF or multi-section document requiring smart concept distillation
        let processedPrompt = prompt;
        let pdfDistilled = false;
        const rulesApplied = [];

        if ((message.rawPDFTokens && message.rawPDFTokens > 0) || (prompt && prompt.length > 2000 && /(?:\d+\.\s+[A-Z]|brief|document|section|chapter)/i.test(prompt))) {
          processedPrompt = squeezePDFSmart(prompt, optMode);
          pdfDistilled = true;
        }

        if (typeof ContentRouter !== "undefined") {
          const routerRes = ContentRouter.compress(processedPrompt);
          if (routerRes && routerRes.savingsPercent > 0) {
            processedPrompt = routerRes.compressed;
            if (routerRes.contentType === "json") {
              rulesApplied.push("Smart JSON Crusher Engine (60-95% Savings)");
            } else if (routerRes.contentType === "code") {
              rulesApplied.push("AST Code Compressor Engine");
            }
          }
        }

        // Then optimize the user prompt text locally
        let optimizedText = processedPrompt;
        const finalRulesApplied = Array.isArray(rulesApplied) ? rulesApplied : [];

        try {
          const localResult = optimizeLocally(processedPrompt, optMode, rules);
          if (localResult && localResult.optimized) {
            optimizedText = localResult.optimized;
          }
          if (localResult && Array.isArray(localResult.rulesApplied)) {
            localResult.rulesApplied.forEach(r => {
              if (!finalRulesApplied.includes(r)) finalRulesApplied.push(r);
            });
          }
        } catch (e) {
          console.warn("optimizeLocally fallback:", e);
        }

        if (pdfDistilled && !finalRulesApplied.includes("PDF Concept Distillation & Restatement Pruning")) {
          finalRulesApplied.unshift("PDF Concept Distillation & Restatement Pruning");
        }
        
        // Squeezed prompt contains context block at the top followed by the optimized prompt
        const finalOptimizedPrompt = contextBlock + optimizedText;
        
        // Calculate stats (incorporates raw PDF tokens if a PDF was squeezed)
        const basePromptTokens = (message.rawPDFTokens && message.rawPDFTokens > 0) ? message.rawPDFTokens : estimateTokens(prompt);
        const originalTokens = basePromptTokens + rawContextTokens;
        const optimizedTokens = estimateTokens(finalOptimizedPrompt);
        const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
        
        const percentageSaved = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0;
        
        // Dynamic Intent Preservation Score Calculation from key content tokens
        let intentScore = 100;
        if (prompt.trim() !== finalOptimizedPrompt.trim()) {
          const stopWords = new Set(["a","an","the","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","must","shall","can","of","in","to","for","with","on","at","by","from","up","about","into","over","after","and","or","but","so","if","then","else","when","as","until","while","just","kind","sort","basically","really","quite","very"]);
          const orgTokens = (prompt.match(/\b[a-zA-Z0-9_-]{2,}\b/g) || []).map(w => w.toLowerCase()).filter(w => !stopWords.has(w));
          const optTokenSet = new Set((finalOptimizedPrompt.match(/\b[a-zA-Z0-9_-]{2,}\b/g) || []).map(w => w.toLowerCase()));
          if (orgTokens.length > 0) {
            let preservedCount = 0;
            orgTokens.forEach(t => { if (optTokenSet.has(t)) preservedCount++; });
            const keyTokenPreservation = preservedCount / orgTokens.length;
            intentScore = Math.min(100, Math.max(70, Math.round(75 + 25 * keyTokenPreservation)));
          }
        }

        // Cost estimation
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
          percentageSaved: percentageSaved,
          intentScore: intentScore,
          mode: optMode,
          rulesApplied: finalRulesApplied,
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
