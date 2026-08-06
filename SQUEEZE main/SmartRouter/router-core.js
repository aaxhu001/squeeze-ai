// SmartRouter Core — Prompt Complexity Classifier
// Standalone module. Zero dependencies on Squeeze.
// Reads config from window.__squeezeRouterConfig

(function() {
  "use strict";

  const CFG = window.__squeezeRouterConfig;
  if (!CFG) {
    console.warn("[SmartRouter] Config not loaded. Classifier disabled.");
    return;
  }

  /**
   * Classify a prompt's complexity and recommend a model.
   *
   * @param {string} promptText - The user's raw prompt
   * @param {object} [context] - Optional context signals
   * @param {number} [context.messageCount] - Number of messages in the thread
   * @param {string} [context.currentModel] - Currently selected model name
   * @returns {object} Classification result
   */
  function classifyPrompt(promptText, context = {}) {
    if (!promptText || promptText.trim().length < CFG.minPromptLength) {
      return null;
    }

    const lower = promptText.toLowerCase().trim();
    const words = lower.split(/\s+/);
    const wordCount = words.length;

    if (wordCount < CFG.minPromptWords) return null;

    let score = 30; // Baseline neutral score

    // 1. Length adjustments
    if (wordCount <= 10)  score -= 15;
    else if (wordCount <= 25)  score += 0;
    else if (wordCount <= 100) score += 10;
    else score += 20;

    // 2. Keyword adjustments
    const simpleHits = CFG.keywords.simple.filter(k => lower.includes(k)).length;
    const moderateHits = CFG.keywords.moderate.filter(k => lower.includes(k)).length;
    const complexHits = CFG.keywords.complex.filter(k => lower.includes(k)).length;

    score -= simpleHits * 15;
    score += moderateHits * 8;
    score += complexHits * 22;

    // 3. Code adjustments
    const codeBlockCount = (promptText.match(/```/g) || []).length / 2;
    const inlineCodeCount = (promptText.match(/`[^`]+`/g) || []).length;
    const hasFileExtensions = /\.(js|py|ts|jsx|tsx|css|html|java|cpp|go|rs|rb|php|sql)\b/i.test(promptText);

    if (codeBlockCount >= 1) score += 30;
    if (inlineCodeCount >= 2) score += 10;
    if (hasFileExtensions) score += 10;

    // 4. Question mark count
    const questionMarks = (promptText.match(/\?/g) || []).length;
    if (questionMarks === 1 && wordCount <= 15) score -= 10;
    else if (questionMarks >= 3) score += 15;

    // 5. Output format adjustments
    const complexOutputPatterns = [
      /comprehensive\s+(?:report|analysis|review|breakdown)/i,
      /detailed\s+(?:explanation|writeup|documentation)/i,
      /step[\s-]by[\s-]step/i,
      /with\s+(?:examples?|code\s+samples?|diagrams?)/i
    ];
    if (complexOutputPatterns.some(p => p.test(lower))) score += 20;

    // ── 6. TASK STRUCTURE signals (Round 2 fix: weight multi-part asks) ──
    // Count numbered list items (1. 2. 3. or 1) 2) a) b))
    const numberedItems = (promptText.match(/(?:^|\n)\s*(?:\d+[\.\)]\s+|[a-d][\.\)]\s+)/gm) || []).length;
    if (numberedItems >= 2) score += numberedItems * 12; // 2 items = +24, 3 = +36, etc.

    // Count bullet points
    const bulletItems = (promptText.match(/(?:^|\n)\s*[-*•]\s+/gm) || []).length;
    if (bulletItems >= 3) score += bulletItems * 6;

    // Multi-part instruction markers ("first", "then", "finally", "also", "additionally")
    const sequentialMarkers = (lower.match(/\b(?:first|second|third|then|finally|additionally|also|moreover|furthermore|and also)\b/g) || []).length;
    if (sequentialMarkers >= 2) score += sequentialMarkers * 8;

    // Explicit sub-question markers ("How does", "Why does", "What is", "Can you also")
    const subQuestionMarkers = (lower.match(/\b(?:how does|why does|what is|what are|can you also|please also|and also explain|explain also)\b/g) || []).length;
    if (subQuestionMarkers >= 2) score += subQuestionMarkers * 10;

    // Conditional logic in the prompt ("if X, then Y", "depending on", "based on")
    const conditionalMarkers = (lower.match(/\b(?:if\s+\w+,?\s+then|depending\s+on|based\s+on|in\s+case\s+of|for\s+each|for\s+every)\b/g) || []).length;
    if (conditionalMarkers >= 1) score += conditionalMarkers * 10;

    // Clamp to 0–100
    score = Math.max(0, Math.min(100, score));

    // Determine provider (claude vs gemini)
    const currentModel = detectCurrentModel(context.currentModel);
    const isGemini = currentModel === "flash" || currentModel === "pro" || 
                     (context.hostname && (context.hostname.includes("gemini") || context.hostname.includes("aistudio")));
    const provider = isGemini ? "gemini" : "claude";

    // Map score to tier
    const tier = mapScoreToTier(score, provider);
    const shouldSuggest = tier.model !== currentModel && currentModel !== null;

    // Build result
    const result = {
      score: score,
      tier: tier.level,
      recommendedModel: tier.model,
      confidence: tier.confidence,
      reason: buildReason(simpleHits, moderateHits, complexHits, wordCount, numberedItems, subQuestionMarkers),
      currentModel: currentModel,
      shouldSuggest: shouldSuggest,
      savingsEstimate: shouldSuggest ? getSavingsEstimate(currentModel, tier.model) : null,
      signals: {
        wordCount: wordCount,
        simpleHits: simpleHits,
        moderateHits: moderateHits,
        complexHits: complexHits,
        codeBlocks: codeBlockCount,
        numberedItems: numberedItems,
        subQuestions: subQuestionMarkers
      }
    };

    return result;
  }

  // ── Tier Mapping ──

  function mapScoreToTier(score, provider = "claude") {
    if (provider === "gemini") {
      // Gemini Flash is extremely fast and robust, mapping larger portion of queries to flash
      if (score <= 45) {
        return { level: "low", model: "flash", confidence: score <= 20 ? 0.9 : 0.7 };
      }
      return { level: "high", model: "pro", confidence: 0.8 };
    }

    // Default Claude mapping
    if (score <= CFG.thresholds.lowCeiling) {
      return { level: "low", model: "haiku", confidence: score <= 15 ? 0.9 : 0.7 };
    }
    if (score <= CFG.thresholds.mediumCeiling) {
      return { level: "medium", model: "sonnet", confidence: 0.65 };
    }
    return { level: "high", model: "opus", confidence: score >= 75 ? 0.85 : 0.6 };
  }

  // ── Model Detection ──

  function detectCurrentModel(contextModel) {
    if (contextModel) {
      const lower = contextModel.toLowerCase();
      for (const [model, names] of Object.entries(CFG.modelNames)) {
        if (names.some(n => lower.includes(n))) return model;
      }
      // Fuzzy fallback
      if (lower.includes("haiku")) return "haiku";
      if (lower.includes("sonnet")) return "sonnet";
      if (lower.includes("opus")) return "opus";
      if (lower.includes("flash")) return "flash";
      if (lower.includes("pro")) return "pro";
    }
    return null;
  }

  // ── Savings Estimate ──

  function getSavingsEstimate(fromModel, toModel) {
    const key = `${toModel}_from_${fromModel}`;
    return CFG.savingsLabels[key] || null;
  }

  // ── Human-Readable Reason ──

  function buildReason(simpleHits, moderateHits, complexHits, wordCount, numberedItems = 0, subQuestions = 0) {
    const reasons = [];

    if (complexHits >= 3) reasons.push("multiple complex engineering keywords");
    else if (complexHits >= 1) reasons.push("advanced engineering request");
    
    if (numberedItems >= 3) reasons.push(`${numberedItems} numbered sub-tasks`);
    else if (numberedItems >= 2) reasons.push("multi-step numbered ask");

    if (subQuestions >= 2) reasons.push(`${subQuestions} distinct sub-questions`);
    
    if (simpleHits >= 2 && numberedItems === 0 && complexHits === 0) reasons.push("simple task phrasing");
    
    if (wordCount <= 10 && numberedItems === 0) reasons.push(`only ${wordCount} words`);

    return reasons.length > 0 ? reasons.join(", ") : "general analysis";
  }

  // ── Expose API ──
  window.__squeezeRouterClassify = classifyPrompt;

})();
