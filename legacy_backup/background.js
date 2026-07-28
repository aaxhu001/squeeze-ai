// Squeeze background service worker

chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings and stats if not present
  chrome.storage.local.get([
    "apiProvider",
    "apiKey",
    "optimizationMode",
    "ollamaModel",
    "stats_promptsOptimized",
    "stats_tokensSaved",
    "stats_costSaved"
  ], (result) => {
    const defaults = {};
    if (!result.apiProvider) defaults.apiProvider = "openrouter";
    if (!result.ollamaModel) defaults.ollamaModel = "openrouter/free";
    if (result.stats_promptsOptimized === undefined) defaults.stats_promptsOptimized = 0;
    if (result.stats_tokensSaved === undefined) defaults.stats_tokensSaved = 0;
    if (result.stats_costSaved === undefined) defaults.stats_costSaved = 0.0;
    if (!result.optimizationMode) defaults.optimizationMode = "balanced";
    
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
  // Standard approximation: 1 token ≈ 4 chars or 0.75 words.
  // We'll take a safe average:
  const tokenEstChars = Math.ceil(chars / 4);
  const tokenEstWords = Math.ceil(words * 1.3);
  return Math.max(tokenEstChars, tokenEstWords);
}

// System instructions generator
function getSystemPrompt(mode) {
  let modeInstruction = "";
  
  if (mode === "squeeze") {
    modeInstruction = "Extreme Token Squeeze: Compress the prompt aggressively. Strip all descriptive adjectives, polite filler words, and verbose sentences. Keep only critical keywords, technical details, code blocks, and absolute constraints. The output must be as compact as possible, even if it looks telegraphic, as long as it contains the exact instructions.";
  } else if (mode === "polish") {
    modeInstruction = "Prompt Enhancement: Clean up phrasing, structure instructions using clear markdown lists or headings, remove ambiguity, and eliminate redundant explanations. Focus on making the prompt clearer and more effective for the LLM while still removing filler words and polite phrasing.";
  } else {
    // balanced
    modeInstruction = "Balanced Optimization: Remove polite filler (e.g., 'could you please', 'can you write a'), passive voice, and wordy repetitions. Restructure sentences to be concise and direct. Keep the prompt natural and detailed, but remove all unnecessary fluff. Ensure no instructions or rules are lost.";
  }

  return `You are Squeeze, an AI assistant built to optimize prompt efficiency.
Your job is to rewrite the user's prompt so that it uses the minimum possible tokens and words, while strictly maintaining 100% of the original prompt's instructions, context, rules, structural requirements, and intent.
Never add intro text, explanations, markdown code block wrappers around the entire response, or conversational responses.
You must output ONLY the optimized prompt and nothing else.

Optimization Mode instructions:
${modeInstruction}`;
}

// OpenRouter API Caller (Free Cloud AI)
async function callOpenRouter(modelName, apiKey, userPrompt, systemPrompt) {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const payload = {
    model: modelName || "openrouter/free",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://squeeze.github.io",
        "X-Title": "Squeeze"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error("Invalid response format from OpenRouter");
    }
  } catch (err) {
    throw new Error(`OpenRouter API failed: ${err.message}`);
  }
}

// Anthropic API Caller (Claude)
async function callAnthropic(modelName, apiKey, userPrompt, systemPrompt) {
  const url = "https://api.anthropic.com/v1/messages";
  const payload = {
    model: modelName || "claude-3-5-haiku-20241022",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      { role: "user", content: userPrompt }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      return data.content[0].text.trim();
    } else {
      throw new Error("Invalid response structure from Anthropic API");
    }
  } catch (err) {
    throw new Error(`Anthropic API failed: ${err.message}`);
  }
}

// OpenAI API Caller (GPT)
async function callOpenAI(modelName, apiKey, userPrompt, systemPrompt) {
  const url = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: modelName || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error("Invalid response structure from OpenAI API");
    }
  } catch (err) {
    throw new Error(`OpenAI API failed: ${err.message}`);
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "optimizePrompt") {
    const { prompt, mode } = message;
    
    // Retrieve configuration
    chrome.storage.local.get(["apiProvider", "apiKey", "optimizationMode", "ollamaModel"], async (result) => {
      const provider = result.apiProvider || "openrouter";
      const key = result.apiKey;
      const optMode = mode || result.optimizationMode || "balanced";
      const modelName = result.ollamaModel;
      
      const providerDisplayName = provider === "openrouter" ? "OpenRouter" : provider === "anthropic" ? "Anthropic" : "OpenAI";
      if (!key) {
        sendResponse({ success: false, error: `${providerDisplayName} API Key not configured. Please open the Squeeze extension popup to enter it.` });
        return;
      }
      
      try {
        const systemPrompt = getSystemPrompt(optMode);
        let optimized = "";
        
        if (provider === "openrouter") {
          optimized = await callOpenRouter(modelName || "openrouter/free", key, prompt, systemPrompt);
        } else if (provider === "anthropic") {
          optimized = await callAnthropic(modelName || "claude-3-5-haiku-20241022", key, prompt, systemPrompt);
        } else if (provider === "openai") {
          optimized = await callOpenAI(modelName || "gpt-4o-mini", key, prompt, systemPrompt);
        } else {
          throw new Error(`Unsupported API Provider: ${provider}`);
        }
        
        // Calculate stats
        const originalTokens = estimateTokens(prompt);
        const optimizedTokens = estimateTokens(optimized);
        const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
        
        // Cost estimation: Assume $3.00 per million tokens (Claude 3.5 Sonnet average inputs)
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
          optimized: optimized,
          originalTokens: originalTokens,
          optimizedTokens: optimizedTokens,
          tokensSaved: tokensSaved,
          percentageSaved: originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0
        });
      } catch (err) {
        console.error("Optimization failed:", err);
        sendResponse({ success: false, error: err.message });
      }
    });
    
    return true; // Keep message channel open for asynchronous response
  }
});
